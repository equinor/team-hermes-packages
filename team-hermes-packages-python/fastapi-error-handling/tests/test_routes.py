from collections.abc import AsyncIterator
from functools import partial

import pytest
from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse, StreamingResponse
from team_hermes.core import NotFoundException, ValidationException

from team_hermes.fastapi_error_handling import (
    ErrorHandlingConfig,
    ExceptionHandlingRoute,
    ProblemDetails,
    framework_http_exception_handler,
)
from team_hermes.fastapi_error_handling.exception_handling.responses import responses


class Order(BaseModel):
    quantity: int


def make_app(config=None):
    app = FastAPI()
    route_class = ExceptionHandlingRoute.with_config(config) if config else ExceptionHandlingRoute
    router = APIRouter(route_class=route_class, responses=responses)

    @router.get("/missing")
    def missing():
        raise NotFoundException("Order not found")

    @router.post("/orders")
    async def orders(order: Order):
        return order

    @router.get("/model")
    def invalid_model():
        return Order.model_validate({"quantity": "private invalid input"})

    @router.get("/fallback")
    async def unexpected():
        raise RuntimeError("private failure")

    @router.get("/framework")
    def framework():
        raise HTTPException(401, detail="Login required", headers={"WWW-Authenticate": "Bearer"})

    @router.get("/starlette")
    async def starlette():
        raise StarletteHTTPException(429, detail="Slow down", headers={"Retry-After": "30"})

    @router.get("/response", response_model=Order)
    def invalid_response():
        return {"quantity": "private invalid output"}

    app.include_router(router)
    return app


@pytest.mark.parametrize(
    "path,status_code,problem_type",
    [
        ("/missing", 404, "/docs/problems/not-found"),
        ("/model", 422, "about:blank"),
        ("/fallback", 500, "about:blank"),
        ("/response", 500, "about:blank"),
    ],
)
def test_route_error_dispatch(path, status_code, problem_type):
    with TestClient(make_app()) as client:
        response = client.get(path, headers={"X-Trace-Id": "client-trace"})
    assert response.status_code == status_code
    assert response.headers["content-type"] == "application/problem+json"
    assert "instance" not in response.json()
    assert "traceId" not in response.json()
    problem = ProblemDetails.model_validate(response.json())
    assert problem.type == problem_type
    assert problem.extensions is not None
    assert problem.extensions.requestPath == path
    assert problem.extensions.traceId == "client-trace"
    if status_code == 500:
        assert "private" not in response.text


def test_request_validation_and_success():
    with TestClient(make_app()) as client:
        response = client.post("/orders", json={"quantity": "invalid"})
        assert response.status_code == 422
        assert response.headers["content-type"] == "application/problem+json"
        assert response.json()["type"] == "about:blank"
        assert response.json()["errors"][0]["source"]["pointer"] == "/body/quantity"
        assert "received" not in response.text
        success = client.post("/orders", json={"quantity": 3})
        assert success.json() == {"quantity": 3}
        assert success.headers["content-type"] == "application/json"
        assert client.post("/orders", content="{", headers={"content-type": "application/json"}).status_code == 422


@pytest.mark.parametrize(
    "path,status_code,header,value,detail",
    [
        ("/framework", 401, "WWW-Authenticate", "Bearer", "Login required"),
        ("/starlette", 429, "Retry-After", "30", "Slow down"),
    ],
)
def test_framework_http_exceptions_return_problem_details(path, status_code, header, value, detail):
    with TestClient(make_app()) as client:
        response = client.get(path)
        assert response.status_code == status_code
        assert response.headers[header] == value
        problem = ProblemDetails.model_validate(response.json())
        assert problem.type == "about:blank"
        assert problem.status == status_code
        assert problem.detail == detail
        assert client.get("/unknown").json() == {"detail": "Not Found"}


def test_route_http_exception_handling_precedes_application_handler():
    app = make_app()
    app.add_exception_handler(
        StarletteHTTPException, lambda request, exception: JSONResponse({"custom": True}, status_code=418)
    )
    with TestClient(app) as client:
        response = client.get("/framework")
        assert response.status_code == 401
        assert response.json()["detail"] == "Login required"
        assert response.json()["type"] == "about:blank"
        assert client.get("/unknown").json() == {"custom": True}


@pytest.mark.parametrize(
    "method,path,status_code,title,detail,headers",
    [
        ("GET", "/framework", 401, "Unauthorized", "Login required", {"WWW-Authenticate": "Bearer"}),
        ("GET", "/starlette", 429, "Too Many Requests", "Slow down", {"Retry-After": "30"}),
        ("GET", "/unknown", 404, "Not Found", "Not Found", {}),
        ("GET", "/orders", 405, "Method Not Allowed", "Method Not Allowed", {"Allow": "POST"}),
    ],
)
def test_framework_problem_details_handler(method, path, status_code, title, detail, headers):
    app = make_app()
    app.add_exception_handler(StarletteHTTPException, framework_http_exception_handler)
    with TestClient(app) as client:
        response = client.request(method, path, headers={"X-Trace-Id": "client-trace"})
    assert response.status_code == status_code
    assert response.headers["content-type"] == "application/problem+json"
    for name, value in headers.items():
        assert response.headers[name] == value
    problem = ProblemDetails.model_validate(response.json())
    assert problem.type == "about:blank"
    assert problem.status == status_code
    assert problem.title == title
    assert problem.detail == detail
    assert problem.extensions is not None
    assert problem.extensions.requestPath == path
    assert problem.extensions.traceId == "client-trace"
    assert problem.extensions.errorId


@pytest.mark.parametrize("register_globally", [False, True])
def test_framework_problem_details_configuration_and_isolation(register_globally):
    config = ErrorHandlingConfig(
        problem_type_map={StarletteHTTPException: "urn:orders:http-error"},
        trace_id_provider=lambda: "configured-trace",
        extension_provider=lambda request: {"service": "orders"},
    )
    app = make_app(config)
    if register_globally:
        app.add_exception_handler(StarletteHTTPException, partial(framework_http_exception_handler, config=config))
    with TestClient(app) as client, TestClient(make_app()) as default:
        problem = client.get("/framework", headers={"X-Trace-Id": "client-trace"}).json()
        assert problem["type"] == "urn:orders:http-error"
        assert problem["extensions"]["traceId"] == "configured-trace"
        assert problem["extensions"]["service"] == "orders"
        default_problem = default.get("/framework").json()
        assert default_problem["type"] == "about:blank"
        assert default_problem["detail"] == "Login required"
        assert default_problem["extensions"]["traceId"] == ""
        assert client.get("/missing").json()["type"] == "/docs/problems/not-found"


@pytest.mark.parametrize("detail", [{"code": "expired", "reasons": ["login"]}, ["invalid", 3], 42])
def test_framework_problem_details_preserves_structured_detail(detail):
    app = make_app()
    app.add_exception_handler(StarletteHTTPException, framework_http_exception_handler)

    @app.get("/structured")
    def structured():
        raise HTTPException(400, detail=detail)

    with TestClient(app) as client:
        response = client.get("/structured")
    assert response.status_code == 400
    assert "detail" not in response.json()
    assert response.json()["extensions"]["httpExceptionDetail"] == detail


@pytest.mark.parametrize("status_code", [204, 304])
def test_framework_problem_details_respects_bodyless_statuses(status_code):
    app = make_app()
    app.add_exception_handler(StarletteHTTPException, framework_http_exception_handler)

    @app.get("/bodyless")
    def bodyless():
        raise StarletteHTTPException(status_code, detail="Must not be returned", headers={"ETag": "revision"})

    with TestClient(app) as client:
        response = client.get("/bodyless")
    assert response.status_code == status_code
    assert response.content == b""
    assert response.headers["ETag"] == "revision"


def test_configured_routes_are_isolated_after_include_router():
    config = ErrorHandlingConfig(status_map={NotFoundException: 410}, trace_id_provider=lambda: "configured")
    with TestClient(make_app(config)) as configured, TestClient(make_app()) as default:
        assert configured.get("/missing").status_code == 410
        assert configured.get("/missing").json()["extensions"]["traceId"] == "configured"
        assert default.get("/missing").status_code == 404
        assert default.get("/missing").json()["extensions"]["traceId"] == ""


@pytest.mark.parametrize("path", ["/missing", "/model", "/fallback", "/response"])
def test_configured_problem_types(path):
    config = ErrorHandlingConfig(
        problem_type_map={NotFoundException: "urn:orders:not-found", Exception: "urn:orders:error"}
    )
    with TestClient(make_app(config)) as client:
        response = client.get(path)
        assert response.json()["type"] == ("urn:orders:not-found" if path == "/missing" else "urn:orders:error")
        assert client.post("/orders", json={}).json()["type"] == "urn:orders:error"


def test_openapi_responses_document_schema_without_fabricated_examples():
    schema = make_app().openapi()
    problem_schema = schema["components"]["schemas"]["ProblemDetails"]
    assert {"extensions", "errors"} <= problem_schema["properties"].keys()
    assert not {"requestPath", "traceId", "errorId"} & problem_schema["properties"].keys()
    metadata_schema = schema["components"]["schemas"]["ProblemDetailsExtensions"]
    assert {"requestPath", "traceId", "errorId"} <= metadata_schema["properties"].keys()
    assert metadata_schema["additionalProperties"] is True
    documented = schema["paths"]["/missing"]["get"]["responses"]
    for status_code in responses:
        content = documented[str(status_code)]["content"]["application/problem+json"]
        assert content["schema"]["$ref"].endswith("/ProblemDetails")
        assert "example" not in content
        assert "examples" not in content
        assert documented[str(status_code)]["description"]


@pytest.mark.parametrize("from_provider", [False, True])
def test_metadata_cannot_override_problem_fields(from_provider):
    metadata = {"type": "metadata:type", "status": 200, "errors": [{"detail": "Metadata error"}], "service": "orders"}
    config = ErrorHandlingConfig(extension_provider=(lambda request: metadata) if from_provider else None)
    app = make_app(config)
    router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))

    @router.get("/collision")
    def collision():
        raise ValidationException(
            "Invalid order",
            errors=[{"detail": "Quantity must be positive", "pointer": "#/items/0/quantity"}],
            extensions=None if from_provider else metadata,
        )

    app.include_router(router)
    with TestClient(app) as client:
        response = client.get("/collision")
    body = response.json()
    assert response.status_code == body["status"] == 400
    assert body["type"] == "/docs/problems/validation-error"
    assert body["errors"] == [{"detail": "Quantity must be positive", "pointer": "#/items/0/quantity"}]
    assert body["extensions"]["service"] == "orders"
    assert body["extensions"]["status"] == 200
    assert body["extensions"]["errors"] == metadata["errors"]
    assert "service" not in body


def test_streaming_and_background_tasks():
    app = FastAPI()
    router = APIRouter(route_class=ExceptionHandlingRoute)
    completed = []

    @router.get("/stream")
    async def stream(background_tasks: BackgroundTasks):
        async def chunks() -> AsyncIterator[bytes]:
            yield b"one"
            yield b"two"

        background_tasks.add_task(completed.append, "done")
        return StreamingResponse(chunks(), background=background_tasks)

    @router.get("/failure")
    async def failure():
        raise ValidationException()

    app.include_router(router)
    with TestClient(app) as client:
        response = client.get("/stream")
        assert response.content == b"onetwo"
        assert completed == ["done"]
        assert client.get("/failure").status_code == 400
