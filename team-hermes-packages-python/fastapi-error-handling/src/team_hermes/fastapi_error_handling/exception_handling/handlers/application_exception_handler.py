from http import HTTPStatus
from typing import Any

from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse

from team_hermes.core import (
    ApplicationException,
    BusinessRuleViolationException,
    ConflictException,
    DuplicateException,
    ExceptionSeverity,
    MissingPrivilegeException,
    NotFoundException,
    UnauthorizedException,
    ValidationException,
)

from ..config import ErrorHandlingConfig
from ..problem_details import ProblemDetails
from .utils.build_common_extensions import build_common_extensions

STATUS_MAP: dict[type[ApplicationException], int] = {
    ValidationException: status.HTTP_400_BAD_REQUEST,
    UnauthorizedException: status.HTTP_401_UNAUTHORIZED,
    MissingPrivilegeException: status.HTTP_403_FORBIDDEN,
    NotFoundException: status.HTTP_404_NOT_FOUND,
    DuplicateException: status.HTTP_409_CONFLICT,
    ConflictException: status.HTTP_409_CONFLICT,
    BusinessRuleViolationException: HTTPStatus.UNPROCESSABLE_ENTITY,
    ApplicationException: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def _status_for_exception(
    application_exception: ApplicationException, config: ErrorHandlingConfig | None = None
) -> int:
    config = config or ErrorHandlingConfig()
    for mapping in (config.status_map, STATUS_MAP):
        for exception_type, status_code in mapping.items():
            if isinstance(application_exception, exception_type):
                return status_code
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def application_exception_handler(
    request: Request, application_exception: ApplicationException, config: ErrorHandlingConfig | None = None
) -> JSONResponse:
    config = config or ErrorHandlingConfig()
    logger = config.logger
    if application_exception.severity == ExceptionSeverity.CRITICAL:
        logger.critical(application_exception, exc_info=True, stack_info=True)
    elif application_exception.severity == ExceptionSeverity.WARNING:
        logger.warning(application_exception)
    else:
        logger.exception(application_exception)

    custom_extensions: dict[str, Any] = {"severity": application_exception.severity.name}
    if application_exception.extensions:
        custom_extensions.update(application_exception.extensions)

    if config.exception_observer:
        config.exception_observer(application_exception)

    problem_details = ProblemDetails(
        type=config.problem_type_for(application_exception, application_exception.type),
        title=application_exception.title,
        status=_status_for_exception(application_exception, config),
        detail=application_exception.detail,
        instance=application_exception.instance,
        extensions=build_common_extensions(request, custom_extensions, config),
    )

    return JSONResponse(problem_details.model_dump(), status_code=problem_details.status)
