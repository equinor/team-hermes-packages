from typing import NamedTuple

import pytest

from team_hermes.core.exceptions import (
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


class ExceptionCase(NamedTuple):
    exception_class: type[ApplicationException]
    problem_type: str
    title: str
    detail: str
    severity: ExceptionSeverity


EXCEPTION_CASES: list[ExceptionCase] = [
    ExceptionCase(
        MissingPrivilegeException,
        "forbidden",
        "Forbidden",
        "You do not have the required permissions.",
        ExceptionSeverity.WARNING,
    ),
    ExceptionCase(
        NotFoundException,
        "not-found",
        "Not Found",
        "The requested resource could not be found.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        ValidationException,
        "validation-error",
        "Unprocessable Entity",
        "The received data is invalid.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        UnauthorizedException,
        "unauthorized",
        "Unauthorized",
        "Token validation failed.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        BusinessRuleViolationException,
        "business-rule-violation",
        "Business Rule Violation",
        "The requested operation violates a business rule.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        DuplicateException,
        "duplicate",
        "Duplicate",
        "A resource with the same identifier already exists.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        ConflictException,
        "conflict",
        "Conflict",
        "The request could not be completed due to a conflict with the current state of the resource.",
        ExceptionSeverity.ERROR,
    ),
    ExceptionCase(
        UpstreamApiException,
        "upstream-api-error",
        "Upstream API Error",
        "An upstream API returned an unexpected response.",
        ExceptionSeverity.ERROR,
    ),
]


def test_application_exception_defaults():
    error = ApplicationException()
    assert error.args == (None,)
    assert error.to_dict() == {
        "type": "about:blank",
        "title": None,
        "detail": None,
        "instance": None,
        "extensions": None,
        "severity": "ERROR",
    }


@pytest.mark.parametrize("severity", list(ExceptionSeverity))
def test_application_exception_custom_fields_and_extension_identity(severity):
    extensions = {"resource_id": "item-1", "nested": {"retry": False}}
    error = ApplicationException("custom:type", "Custom title", "Custom detail", "item-1", extensions, severity)
    assert str(error) == "Custom detail"
    assert error.args == ("Custom detail",)
    assert error.to_dict() == {
        "type": "custom:type",
        "title": "Custom title",
        "detail": "Custom detail",
        "instance": "item-1",
        "extensions": extensions,
        "severity": severity.name,
    }
    assert error.extensions is extensions
    assert error.to_dict()["extensions"] is extensions


@pytest.mark.parametrize("exception_class,problem_type,title,detail,severity", EXCEPTION_CASES)
def test_exception_defaults(exception_class, problem_type, title, detail, severity):
    error = exception_class()
    assert isinstance(error, ApplicationException)
    assert str(error) == detail
    assert error.severity is severity
    assert error.to_dict() == {
        "type": f"/docs/problems/{problem_type}",
        "title": title,
        "detail": detail,
        "instance": None,
        "extensions": None,
        "severity": severity.name,
    }
    with pytest.raises(ApplicationException) as caught:
        raise error
    assert caught.value is error


@pytest.mark.parametrize("exception_class", [case.exception_class for case in EXCEPTION_CASES])
def test_exception_customization(exception_class):
    extensions = {"field": "name"}
    error = exception_class("Custom detail", "Custom title", extensions)
    assert error.detail == "Custom detail"
    assert error.title == "Custom title"
    assert error.extensions is extensions
    assert error.instance is None


@pytest.mark.parametrize("exception_class", [ApplicationException, ValidationException])
@pytest.mark.parametrize(
    "errors",
    [[], [{"code": "positive_total_required", "detail": "Total must be positive", "pointer": "#/total"}]],
)
def test_structured_errors(exception_class, errors):
    error = exception_class(detail="Order validation failed", errors=errors, extensions={"orderId": "order-1"})
    assert error.errors is errors
    assert error.to_dict()["errors"] == errors
    assert error.extensions == {"orderId": "order-1"}
    assert exception_class().errors is None


def test_severity_values():
    assert {severity.name: severity.value for severity in ExceptionSeverity} == {
        "WARNING": 1,
        "ERROR": 2,
        "CRITICAL": 3,
    }
