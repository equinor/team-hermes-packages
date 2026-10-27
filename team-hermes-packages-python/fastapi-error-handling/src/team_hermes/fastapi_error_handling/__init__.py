"""FastAPI error handling for Team Hermes projects."""

from .exception_handling.exception_handling_route import ExceptionHandlingRoute
from .exception_handling.handlers import (
    ErrorHandlingConfig,
    application_exception_handler,
    build_common_extensions,
    fallback_exception_handler,
    request_validation_exception_handler,
    validation_exception_handler,
)
from .exception_handling.problem_details import ErrorItem, ErrorSource, ProblemDetails, ProblemDetailsExtensions

__all__ = [
    "ErrorHandlingConfig",
    "ErrorItem",
    "ErrorSource",
    "ExceptionHandlingRoute",
    "ProblemDetails",
    "ProblemDetailsExtensions",
    "application_exception_handler",
    "build_common_extensions",
    "fallback_exception_handler",
    "request_validation_exception_handler",
    "validation_exception_handler",
]
