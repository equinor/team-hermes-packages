from http import HTTPStatus

from pydantic_core import ErrorDetails, ValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import ErrorHandlingConfig
from ..problem_details import ErrorItem, ErrorSource, ProblemDetails
from .utils.build_common_extensions import build_common_extensions


def _build_error_item(error_details: ErrorDetails) -> ErrorItem:
    raw_loc = error_details.get("loc", ["null"])
    location = ".".join(str(part) for part in raw_loc) if isinstance(raw_loc, list | tuple) else "null"

    validation_error_type = error_details.get("type", "null")
    error_msg = error_details.get("msg", validation_error_type)
    input_value = error_details.get("input")

    if input_value is not None:
        detail = f"{error_msg} (received: {input_value})"
    else:
        detail = error_msg

    return ErrorItem(
        source=ErrorSource(pointer=location),
        code=validation_error_type,
        title=error_msg,
        detail=detail,
    )


def validation_exception_handler(
    request: Request, exception: ValidationError, config: ErrorHandlingConfig | None = None
) -> JSONResponse:
    config = config or ErrorHandlingConfig()
    logger = config.logger
    logger.error(f"Validation Exception {request.method} {request.url}:  {str(exception)}")

    raw_errors = exception.errors(include_url=False, include_context=False)
    errors = [_build_error_item(err) for err in raw_errors]
    count = len(errors)
    detail = f"{count} invalid value{'' if count == 1 else 's'}"

    problem_details = ProblemDetails(
        type=config.problem_type_for(exception),
        title="Model Validation Failed",
        status=HTTPStatus.UNPROCESSABLE_ENTITY,
        detail=detail,
        errors=errors,
        extensions=build_common_extensions(request, config=config),
    )

    return JSONResponse(problem_details.model_dump(), status_code=problem_details.status)
