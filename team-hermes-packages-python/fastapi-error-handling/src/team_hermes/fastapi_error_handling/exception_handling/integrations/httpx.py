from httpx import HTTPError, TimeoutException
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import ErrorHandlingConfig
from ..handlers.utils.build_common_extensions import build_common_extensions
from ..problem_details import ProblemDetails


def http_exception_handler(
    request: Request,
    exception: Exception,
    config: ErrorHandlingConfig | None = None,
) -> JSONResponse:
    if not isinstance(exception, HTTPError):
        raise TypeError("Expected httpx.HTTPError")

    config = config or ErrorHandlingConfig()
    config.logger.error(
        "Upstream HTTP failure during %s %s: %s",
        request.method,
        request.url.path,
        type(exception).__name__,
    )

    if config.exception_observer:
        config.exception_observer(exception)

    if isinstance(exception, TimeoutException):
        status_code = status.HTTP_504_GATEWAY_TIMEOUT
        title = "Gateway Timeout"
        detail = "An upstream service did not respond in time."
    else:
        status_code = status.HTTP_502_BAD_GATEWAY
        title = "Bad Gateway"
        detail = "An upstream service request failed."

    problem = ProblemDetails(
        type=config.problem_type_for(exception),
        title=title,
        status=status_code,
        detail=detail,
        extensions=build_common_extensions(request, config=config),
    )

    return JSONResponse(problem.model_dump(), status_code=status_code)
