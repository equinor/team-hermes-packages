import json
import logging
from uuid import UUID

import pytest
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from starlette.requests import Request
from team_hermes.core import (
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

from team_hermes.fastapi_error_handling.exception_handling.handlers import (
    ErrorHandlingConfig,
    application_exception_handler,
    build_common_extensions,
    fallback_exception_handler,
    request_validation_exception_handler,
    validation_exception_handler,
)


def make_request(headers=()):
    return Request({"type": "http", "method": "GET", "path": "/orders", "headers": list(headers)})


@pytest.mark.parametrize(
    "exception_type,status_code",
    [
        (ValidationException, 400),
        (UnauthorizedException, 401),
        (MissingPrivilegeException, 403),
        (NotFoundException, 404),
        (DuplicateException, 409),
        (ConflictException, 409),
        (BusinessRuleViolationException, 422),
        (ApplicationException, 500),
        (UpstreamApiException, 500),
    ],
)
def test_application_status_and_payload(exception_type, status_code):
    exception = exception_type(detail="Order problem", extensions={"orderId": "order-1"})
    response = application_exception_handler(make_request(), exception)
    body = json.loads(bytes(response.body))
    assert response.status_code == status_code
    assert body == {
        "type": exception.type,
        "title": exception.title,
        "status": status_code,
        "detail": "Order problem",
        "instance": None,
        "errors": None,
        "extensions": {
            "requestPath": "/orders",
            "traceId": "",
            "errorId": body["extensions"]["errorId"],
            "severity": exception.severity.name,
            "orderId": "order-1",
        },
    }
    assert UUID(body["extensions"]["errorId"]).version == 4
    assert exception.extensions == {"orderId": "order-1"}
    assert response.media_type == "application/json"


@pytest.mark.parametrize("severity", list(ExceptionSeverity))
def test_severity_logging_and_observer(severity, caplog):
    observed = []
    logger = logging.getLogger("test.errors")
    config = ErrorHandlingConfig(logger=logger, exception_observer=observed.append)
    exception = ApplicationException(detail="failure", severity=severity, instance="/instance")
    response = application_exception_handler(make_request(), exception, config)
    assert json.loads(bytes(response.body))["instance"] == "/instance"
    assert observed == [exception]
    assert caplog.records[-1].name == "test.errors"
    assert caplog.records[-1].levelname == severity.name


def test_status_override_and_subclass_matching():
    class OrderNotFound(NotFoundException):
        pass

    exception = OrderNotFound()
    assert application_exception_handler(make_request(), exception).status_code == 404
    config = ErrorHandlingConfig(status_map={OrderNotFound: 410})
    assert application_exception_handler(make_request(), exception, config).status_code == 410
    assert application_exception_handler(make_request(), NotFoundException(), config).status_code == 404


@pytest.mark.parametrize(
    "headers,provided,expected",
    [
        ([], None, ""),
        ([(b"x-trace-id", b"client")], None, "client"),
        ([(b"traceparent", b"00-parent-span-01")], None, "00-parent-span-01"),
        ([(b"x-trace-id", b"client"), (b"traceparent", b"parent")], None, "client"),
        ([(b"x-trace-id", b"client")], "context", "context"),
    ],
)
def test_correlation_precedence_and_unique_error_ids(headers, provided, expected):
    config = ErrorHandlingConfig(trace_id_provider=lambda: provided)
    first = build_common_extensions(make_request(headers), config=config)
    second = build_common_extensions(make_request(headers), config=config)
    assert first.traceId == second.traceId == expected
    assert first.errorId != second.errorId


def test_extension_enrichment_and_exception_overrides():
    config = ErrorHandlingConfig(extension_provider=lambda request: {"path": request.url.path, "severity": "enriched"})
    exception = ValidationException(extensions={"severity": "custom", "traceId": "override"})
    body = json.loads(bytes(application_exception_handler(make_request(), exception, config).body))
    assert body["extensions"]["path"] == "/orders"
    assert body["extensions"]["severity"] == "custom"
    assert body["extensions"]["traceId"] == "override"


def test_model_validation_details():
    class Order(BaseModel):
        quantity: int
        name: str

    with pytest.raises(ValidationError) as caught:
        Order.model_validate({"quantity": "invalid", "name": None})
    response = validation_exception_handler(make_request(), caught.value)
    body = json.loads(bytes(response.body))
    assert response.status_code == 422
    assert body["type"] == "about:blank"
    assert body["detail"] == "2 invalid values"
    assert body["errors"][0]["source"]["pointer"] == "quantity"
    assert body["errors"][0]["detail"].endswith("(received: invalid)")
    assert "received" not in body["errors"][1]["detail"]


@pytest.mark.parametrize("location,pointer", [(("body", "items", 0, "name"), "/body/items/0/name"), ([], None)])
def test_request_validation_details(location, pointer):
    exception = RequestValidationError([{"type": "missing", "msg": "Field required", "loc": location}])
    response = request_validation_exception_handler(make_request(), exception)
    body = json.loads(bytes(response.body))
    assert response.status_code == 422
    assert body["type"] == "about:blank"
    assert body["detail"] == "1 invalid value"
    assert body["errors"][0] == {
        "code": "missing",
        "title": "Request validation error",
        "detail": "Field required",
        "source": {"pointer": pointer} if pointer else None,
    }


def test_malformed_request_error_and_fallback_privacy():
    body = json.loads(
        bytes(request_validation_exception_handler(make_request(), RequestValidationError(["bad"])).body)
    )
    assert body["errors"][0]["detail"] == "Invalid error format"
    observed = []
    exception = RuntimeError("private detail")
    response = fallback_exception_handler(
        make_request(), exception, ErrorHandlingConfig(exception_observer=observed.append)
    )
    assert response.status_code == 500
    assert b"private detail" not in response.body
    assert json.loads(bytes(response.body))["type"] == "about:blank"
    assert observed == [exception]
