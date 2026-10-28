from http.client import responses

from fastapi.encoders import jsonable_encoder
from fastapi.utils import is_body_allowed_for_status_code
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..config import ErrorHandlingConfig
from ..problem_details import ProblemDetails
from .utils.build_common_extensions import build_common_extensions


def framework_http_exception_handler(
    request: Request, exception: Exception, config: ErrorHandlingConfig | None = None
) -> Response:
    if not isinstance(exception, HTTPException):
        raise TypeError("Expected a Starlette or FastAPI HTTPException")

    if not is_body_allowed_for_status_code(exception.status_code):
        return Response(status_code=exception.status_code, headers=exception.headers)

    config = config or ErrorHandlingConfig()
    detail = exception.detail
    custom_extensions = (
        {"httpExceptionDetail": jsonable_encoder(detail)}
        if detail is not None and not isinstance(detail, str)
        else None
    )
    problem_details = ProblemDetails(
        type=config.problem_type_for(exception),
        title=responses.get(exception.status_code, "HTTP Error"),
        status=exception.status_code,
        detail=detail if isinstance(detail, str) else None,
        extensions=build_common_extensions(request, custom_extensions, config),
    )
    return JSONResponse(problem_details.model_dump(), status_code=exception.status_code, headers=exception.headers)
