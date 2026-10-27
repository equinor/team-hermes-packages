import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from requests import Request as OutgoingRequest
from requests import Response
from requests.exceptions import HTTPError
from team_hermes.core import ValidationException

from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
from team_hermes.fastapi_error_handling.exception_handling.integrations.requests import http_exception_handler
from team_hermes.fastapi_error_handling.exception_handling.integrations.telemetry import get_trace_id, record_exception


@pytest.mark.parametrize("upstream_status,expected", [(None, 502), (200, 200), (404, 502), (500, 502)])
@pytest.mark.parametrize("problem_type", [None, "urn:orders:upstream"])
def test_requests_integration_preserves_response_truthiness(upstream_status, expected, problem_type):
    upstream = None
    if upstream_status is not None:
        upstream = Response()
        upstream.status_code = upstream_status
        upstream.headers["X-Upstream"] = "value"
    outgoing = OutgoingRequest("GET", "https://example.com/orders").prepare()
    exception = HTTPError("private upstream failure", response=upstream, request=outgoing)
    config = ErrorHandlingConfig(
        exception_handlers={HTTPError: http_exception_handler},
        problem_type_map={HTTPError: problem_type} if problem_type else {},
    )
    router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))

    @router.get("/upstream")
    def endpoint():
        raise exception

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.get("/upstream")
    assert response.status_code == expected
    assert response.json()["type"] == (problem_type or "about:blank")
    assert response.json()["extensions"]["url"] == "https://example.com/orders"
    assert response.json()["extensions"]["response_headers"] == ({"X-Upstream": "value"} if upstream_status else {})
    assert "private upstream failure" not in response.text


def test_requests_is_not_implicitly_enabled():
    router = APIRouter(route_class=ExceptionHandlingRoute)

    @router.get("/upstream")
    def endpoint():
        raise HTTPError()

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.get("/upstream")
    assert response.status_code == 500
    assert response.json()["type"] == "about:blank"


def test_trace_id_uses_active_context_without_sdk():
    assert get_trace_id() is None
    context = trace.SpanContext(trace_id=42, span_id=7, is_remote=False)
    with trace.use_span(trace.NonRecordingSpan(context)):
        assert get_trace_id() == "0000000000000000000000000000002a"


@pytest.fixture
def telemetry():
    provider = TracerProvider()
    exporter = InMemorySpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    try:
        yield provider.get_tracer(__name__), exporter
    finally:
        provider.shutdown()


def test_telemetry_annotation_and_recording(telemetry):
    tracer, exporter = telemetry
    application_error = ValidationException("invalid")
    with tracer.start_as_current_span("application"):
        record_exception(application_error)
    with tracer.start_as_current_span("unhandled"):
        record_exception(RuntimeError("failure"))

    application_span, failure_span = exporter.get_finished_spans()
    assert application_span.attributes == {
        "Exception type": application_error.type,
        "Exception title": application_error.title,
        "Exception detail": "invalid",
        "Exception severity": "ERROR",
    }
    assert not application_span.events
    assert len(failure_span.events) == 1
    event = failure_span.events[0]
    assert event.name == "exception"
    assert event.attributes["exception.type"] == "RuntimeError"
    assert event.attributes["exception.message"] == "failure"

    with trace.use_span(trace.NonRecordingSpan(failure_span.context)):
        record_exception(RuntimeError("not recorded"))
    assert len(exporter.get_finished_spans()) == 2
    assert len(failure_span.events) == 1


def test_telemetry_hooks_work_in_route(telemetry):
    tracer, exporter = telemetry
    config = ErrorHandlingConfig(trace_id_provider=get_trace_id, exception_observer=record_exception)
    router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))

    @router.get("/traced")
    async def endpoint():
        raise ValidationException()

    app = FastAPI()
    app.include_router(router)
    with tracer.start_as_current_span("request") as span, TestClient(app) as client:
        response = client.get("/traced", headers={"X-Trace-Id": "client-trace"})
        assert response.json()["extensions"]["traceId"] == format(span.get_span_context().trace_id, "032x")
    (recorded_span,) = exporter.get_finished_spans()
    assert recorded_span.attributes["Exception severity"] == "ERROR"
