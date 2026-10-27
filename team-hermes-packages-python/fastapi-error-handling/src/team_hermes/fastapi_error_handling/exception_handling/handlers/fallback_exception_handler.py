from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import ErrorHandlingConfig
from ..problem_details import ProblemDetails
from .utils.build_common_extensions import build_common_extensions


def fallback_exception_handler(
    request: Request, uncaught_exception: Exception, config: ErrorHandlingConfig | None = None
) -> JSONResponse:
    config = config or ErrorHandlingConfig()
    logger = config.logger
    logger.exception(f"Unhandled exception {request.method} {request.url}: {str(uncaught_exception)}")

    if config.exception_observer:
        config.exception_observer(uncaught_exception)

    problem_details = ProblemDetails(
        type=config.problem_type_for(uncaught_exception),
        title="Internal Server Error",
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An internal error occurred. Please contact support.",
        extensions=build_common_extensions(request, config=config),
    )
    return JSONResponse(problem_details.model_dump(), status_code=problem_details.status)
