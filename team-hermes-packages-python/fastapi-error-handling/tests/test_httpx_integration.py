import json
import logging
from uuid import UUID

import httpx
import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
from team_hermes.fastapi_error_handling.exception_handling.integrations.httpx import http_exception_handler


def make_app(exception: Exception, config: ErrorHandlingConfig | None = None) -> FastAPI:
    route_class = ExceptionHandlingRoute.with_config(config) if config is not None else ExceptionHandlingRoute
    router = APIRouter(route_class=route_class)

    @router.get("/upstream")
    def endpoint():
        raise exception

    app = FastAPI()
    app.include_router(router)
    return app


def httpx_config() -> ErrorHandlingConfig:
    return ErrorHandlingConfig(exception_handlers={httpx.HTTPError: http_exception_handler})


@pytest.mark.parametrize("upstream_status", [401, 403, 404, 429, 500, 503])
def test_upstream_status_and_metadata_are_not_exposed(upstream_status):
    outgoing = httpx.Request("GET", "https://internal.example/orders?token=private-token")
    upstream = httpx.Response(
        upstream_status,
        request=outgoing,
        headers={"X-Internal-Token": "private-header"},
        text="private response body",
    )
    exception = httpx.HTTPStatusError("private exception detail", request=outgoing, response=upstream)

    with TestClient(make_app(exception, httpx_config())) as client:
        response = client.get("/upstream", headers={"X-Trace-Id": "trace-1"})

    body = response.json()
    assert response.status_code == 502
    assert response.headers["content-type"] == "application/json"
    assert body == {
        "type": "about:blank",
        "title": "Bad Gateway",
        "status": 502,
        "detail": "An upstream service request failed.",
        "instance": None,
        "errors": None,
        "extensions": {
            "requestPath": "/upstream",
            "traceId": "trace-1",
            "errorId": body["extensions"]["errorId"],
        },
    }
    assert UUID(body["extensions"]["errorId"]).version == 4
    assert "private" not in response.text
    assert "internal.example" not in response.text
    assert "X-Internal-Token" not in response.headers


@pytest.mark.parametrize(
    ("error_type", "expected_status", "expected_title", "expected_detail"),
    [
        (httpx.HTTPError, 502, "Bad Gateway", "An upstream service request failed."),
        (httpx.ConnectError, 502, "Bad Gateway", "An upstream service request failed."),
        (httpx.RemoteProtocolError, 502, "Bad Gateway", "An upstream service request failed."),
        (httpx.ConnectTimeout, 504, "Gateway Timeout", "An upstream service did not respond in time."),
        (httpx.ReadTimeout, 504, "Gateway Timeout", "An upstream service did not respond in time."),
        (httpx.WriteTimeout, 504, "Gateway Timeout", "An upstream service did not respond in time."),
        (httpx.PoolTimeout, 504, "Gateway Timeout", "An upstream service did not respond in time."),
    ],
)
def test_errors_without_request_or_response(error_type, expected_status, expected_title, expected_detail):
    exception = error_type("private transport detail")

    with TestClient(make_app(exception, httpx_config())) as client:
        response = client.get("/upstream")

    body = response.json()
    assert response.status_code == expected_status
    assert body["status"] == expected_status
    assert body["title"] == expected_title
    assert body["detail"] == expected_detail
    assert "private transport detail" not in response.text


def test_httpx_handling_requires_explicit_registration():
    exception = httpx.ConnectError("private connection detail")

    with TestClient(make_app(exception)) as client:
        response = client.get("/upstream")

    assert response.status_code == 500
    assert response.json()["title"] == "Internal Server Error"


def test_configuration_logging_and_observer_are_used(caplog):
    observed: list[Exception] = []
    exception = httpx.ReadTimeout("private timeout detail")
    config = ErrorHandlingConfig(
        logger=logging.getLogger("test.httpx.errors"),
        exception_handlers={httpx.HTTPError: http_exception_handler},
        problem_type_map={
            httpx.TimeoutException: "urn:orders:upstream-timeout",
            httpx.HTTPError: "urn:orders:upstream-failure",
        },
        trace_id_provider=lambda: "active-trace",
        extension_provider=lambda request: {"service": "orders"},
        exception_observer=observed.append,
    )

    with TestClient(make_app(exception, config)) as client:
        response = client.get("/upstream", headers={"X-Trace-Id": "client-trace"})

    body = response.json()
    assert response.status_code == 504
    assert body["type"] == "urn:orders:upstream-timeout"
    assert body["extensions"]["traceId"] == "active-trace"
    assert body["extensions"]["service"] == "orders"
    assert observed == [exception]
    assert caplog.records[-1].name == "test.httpx.errors"
    assert caplog.records[-1].levelname == "ERROR"
    assert "ReadTimeout" in caplog.records[-1].message
    assert "private timeout detail" not in caplog.text


def test_direct_handler_uses_default_configuration():
    request = Request({"type": "http", "method": "GET", "path": "/upstream", "headers": []})
    response = http_exception_handler(request, httpx.ConnectError("private detail"))
    assert response.status_code == 502
    assert json.loads(bytes(response.body))["type"] == "about:blank"


def test_rejects_unrelated_exceptions():
    request = Request({"type": "http", "method": "GET", "path": "/upstream", "headers": []})
    with pytest.raises(TypeError, match="Expected httpx.HTTPError"):
        http_exception_handler(request, ValueError("not an HTTP error"))
