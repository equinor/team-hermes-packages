from requests.exceptions import HTTPError
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import ErrorHandlingConfig
from ..problem_details import ProblemDetails
from .utils.build_common_extensions import build_common_extensions


def http_exception_handler(
    request: Request, exception: Exception, config: ErrorHandlingConfig | None = None
) -> JSONResponse:
    if not isinstance(exception, HTTPError):
        raise TypeError("Expected requests.exceptions.HTTPError")
    config = config or ErrorHandlingConfig()
    logger = config.logger
    logger.error(f"HTTP Exception {request.method} {request.url}:  {str(exception)}")

    status_code = exception.response.status_code if exception.response else status.HTTP_502_BAD_GATEWAY
    custom_extensions = {
        "url": getattr(getattr(exception, "request", None), "url", None),
        "response_headers": dict(getattr(exception.response, "headers", {}) or {}),
    }

    problem_details = ProblemDetails(
        type=config.problem_type_for(exception),
        title="External HTTP Request Failed",
        status=status_code,
        detail="Failed to fetch external resource.",
        extensions=build_common_extensions(request, custom_extensions, config),
    )

    return JSONResponse(problem_details.model_dump(), status_code=problem_details.status)
