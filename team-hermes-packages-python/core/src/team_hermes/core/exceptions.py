"""Application exceptions independent of transport and persistence frameworks."""

from enum import Enum, unique
from typing import Any


@unique
class ExceptionSeverity(Enum):
    WARNING = 1
    ERROR = 2
    CRITICAL = 3


class ApplicationException(Exception):
    """Base class for application-specific exceptions."""

    def __init__(
        self,
        type: str = "about:blank",
        title: str | None = None,
        detail: str | None = None,
        instance: str | None = None,
        extensions: dict[str, Any] | None = None,
        severity: ExceptionSeverity = ExceptionSeverity.ERROR,
    ) -> None:
        super().__init__(detail)
        self.type = type
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extensions = extensions
        self.severity = severity

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "title": self.title,
            "detail": self.detail,
            "instance": self.instance,
            "extensions": self.extensions,
            "severity": self.severity.name if self.severity else None,
        }


class MissingPrivilegeException(ApplicationException):
    """Raised when a user lacks necessary privileges."""

    def __init__(
        self,
        detail: str = "You do not have the required permissions.",
        title: str = "Forbidden",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            type="/docs/problems/forbidden",
            title=title,
            detail=detail,
            extensions=extensions,
            severity=ExceptionSeverity.WARNING,
        )


class NotFoundException(ApplicationException):
    """Raised when a requested resource is not found."""

    def __init__(
        self,
        detail: str = "The requested resource could not be found.",
        title: str = "Not Found",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(type="/docs/problems/not-found", title=title, detail=detail, extensions=extensions)


class ValidationException(ApplicationException):
    """Raised when input data fails validation."""

    def __init__(
        self,
        detail: str = "The received data is invalid.",
        title: str = "Unprocessable Entity",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(type="/docs/problems/validation-error", title=title, detail=detail, extensions=extensions)


class UnauthorizedException(ApplicationException):
    """Raised when authentication fails."""

    def __init__(
        self,
        detail: str = "Token validation failed.",
        title: str = "Unauthorized",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(type="/docs/problems/unauthorized", title=title, detail=detail, extensions=extensions)


class BusinessRuleViolationException(ApplicationException):
    """Raised when an operation violates a business rule."""

    def __init__(
        self,
        detail: str = "The requested operation violates a business rule.",
        title: str = "Business Rule Violation",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            type="/docs/problems/business-rule-violation", title=title, detail=detail, extensions=extensions
        )


class DuplicateException(ApplicationException):
    """Raised when attempting to create a duplicate resource."""

    def __init__(
        self,
        detail: str = "A resource with the same identifier already exists.",
        title: str = "Duplicate",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(type="/docs/problems/duplicate", title=title, detail=detail, extensions=extensions)


class ConflictException(ApplicationException):
    """Raised when an operation conflicts with the current resource state."""

    def __init__(
        self,
        detail: str = "The request could not be completed due to a conflict with the current state of the resource.",
        title: str = "Conflict",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(type="/docs/problems/conflict", title=title, detail=detail, extensions=extensions)


class UpstreamApiException(ApplicationException):
    """Raised when an upstream API returns an unexpected or malformed response."""

    def __init__(
        self,
        detail: str = "An upstream API returned an unexpected response.",
        title: str = "Upstream API Error",
        extensions: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            type="/docs/problems/upstream-api-error",
            title=title,
            detail=detail,
            extensions=extensions,
            severity=ExceptionSeverity.ERROR,
        )
