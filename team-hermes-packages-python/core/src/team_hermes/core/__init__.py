"""Shared application exceptions."""

from .exceptions import (
    ApplicationException,
    BusinessRuleViolationException,
    ConflictException,
    DuplicateException,
    ExceptionSeverity,
    MissingPrivilegeException,
    NotFoundException,
    UnauthorizedException,
    UpstreamApiException,
    ValidationException,
)

__all__ = [
    "ApplicationException",
    "BusinessRuleViolationException",
    "ConflictException",
    "DuplicateException",
    "ExceptionSeverity",
    "MissingPrivilegeException",
    "NotFoundException",
    "UnauthorizedException",
    "UpstreamApiException",
    "ValidationException",
]
