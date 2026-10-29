from http import HTTPStatus

from fastapi.exceptions import RequestValidationError
from pydantic_core import ErrorDetails
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import ErrorHandlingConfig
from ..problem_details import ErrorItem, ErrorSource, ProblemDetails
from .utils.build_common_extensions import build_common_extensions


def _create_error_item(error: ErrorDetails) -> ErrorItem:
    if isinstance(error, dict):
        location = error.get("loc")
        pointer = None
        if isinstance(location, list | tuple) and location:
            pointer = "/" + "/".join(str(part) for part in location)
        return ErrorItem(
            code=error.get("type"),
            title="Request validation error",
            detail=error.get("msg"),
            source=ErrorSource(pointer=pointer) if pointer else None,
        )
    return ErrorItem(
        code=None,
        title="Request validation error",
        detail="Invalid error format",
        source=ErrorSource(pointer=None),
    )


def request_validation_exception_handler(
    request: Request, exception: RequestValidationError, config: ErrorHandlingConfig | None = None
) -> JSONResponse:
    config = config or ErrorHandlingConfig()
    logger = config.logger
    logger.error(f"Request Validation Exception {request.method} {request.url}:  {str(exception)}")

    errors = [_create_error_item(error) for error in exception.errors()]

    error_count = len(errors)
    detail = f"{error_count} invalid value{'' if error_count == 1 else 's'}"

    problem_details = ProblemDetails(
        type=config.problem_type_for(exception),
        title="Request Validation Failed",
        status=HTTPStatus.UNPROCESSABLE_ENTITY,
        detail=detail,
        errors=errors,
        extensions=build_common_extensions(request, config=config),
    )

    return problem_details.to_response()
