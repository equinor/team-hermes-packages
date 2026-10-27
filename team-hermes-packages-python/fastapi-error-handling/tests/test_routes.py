from collections.abc import AsyncIterator

import pytest
from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import StreamingResponse
from team_hermes.core import NotFoundException, ValidationException

from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute, ProblemDetails
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
        assert response.json()["type"] == "about:blank"
        assert response.json()["errors"][0]["source"]["pointer"] == "/body/quantity"
        assert "received" not in response.text
        assert client.post("/orders", json={"quantity": 3}).json() == {"quantity": 3}
        assert client.post("/orders", content="{", headers={"content-type": "application/json"}).status_code == 422


@pytest.mark.parametrize(
    "path,status_code,header,value",
    [("/framework", 401, "WWW-Authenticate", "Bearer"), ("/starlette", 429, "Retry-After", "30")],
)
def test_framework_http_exceptions_are_preserved(path, status_code, header, value):
    with TestClient(make_app()) as client:
        response = client.get(path)
        assert response.status_code == status_code
        assert response.headers[header] == value
        assert set(response.json()) == {"detail"}
        assert client.get("/unknown").json() == {"detail": "Not Found"}


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
    documented = schema["paths"]["/missing"]["get"]["responses"]
    for status_code in responses:
        content = documented[str(status_code)]["content"]["application/json"]
        assert content["schema"]["$ref"].endswith("/ProblemDetails")
        assert "example" not in content
        assert "examples" not in content
        assert documented[str(status_code)]["description"]


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
