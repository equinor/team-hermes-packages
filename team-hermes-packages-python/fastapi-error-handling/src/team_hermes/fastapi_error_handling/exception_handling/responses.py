from typing import Any

from team_hermes.core import (
    ApplicationException,
    BusinessRuleViolationException,
    ConflictException,
    DuplicateException,
    MissingPrivilegeException,
    NotFoundException,
    UnauthorizedException,
    ValidationException,
)

from .problem_details import ProblemDetails


def create_response(exception: ApplicationException) -> dict[str, Any]:
    return {
        "model": ProblemDetails,
        "description": exception.title or "Application error",
        "content": {
            "application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}},
        },
    }


def create_conflict_response() -> dict[str, Any]:
    return {
        **create_response(ConflictException()),
        "description": f"{DuplicateException().title} or {ConflictException().title}",
    }


responses: dict[int | str, dict[str, Any]] = {
    400: create_response(ValidationException()),
    401: create_response(UnauthorizedException()),
    403: create_response(MissingPrivilegeException()),
    404: create_response(NotFoundException()),
    409: create_conflict_response(),
    422: create_response(BusinessRuleViolationException()),
    500: create_response(ApplicationException()),
}
