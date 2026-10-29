import doctest
import json
import re
from collections.abc import Iterator
from pathlib import Path
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def readme_example(*section_names: str) -> doctest.DocTest:
    readme_path = Path(__file__).resolve().parents[1] / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    sections = [readme.partition(f"## {name}\n")[2].partition("\n## ")[0] for name in section_names]
    assert all(sections)
    name = "README " + " + ".join(section_names)
    example = doctest.DocTestParser().get_doctest("\n".join(sections), {}, name, str(readme_path), 0)
    result = doctest.DocTestRunner().run(example, clear_globs=False)
    assert result.failed == 0
    assert result.attempted > 0
    return example


@pytest.fixture
def configured_example() -> doctest.DocTest:
    return readme_example("Quick Start", "Configured Example")


@pytest.fixture
def configured_app(configured_example: doctest.DocTest) -> FastAPI:
    return configured_example.globs["app"]


def test_readme_quick_start() -> None:
    example = readme_example("Quick Start")
    with TestClient(example.globs["app"]) as client:
        accepted = client.post("/orders/order-1/approval", json={"total": 60})
        missing = client.post("/orders/missing/approval", json={"total": 50})
        invalid = client.post("/orders/order-1/approval", json={"total": 0})
        rejected = client.post("/orders/order-1/approval", json={"total": 150})
        malformed = client.post("/orders/order-1/approval", json={"total": "invalid"})

    assert accepted.status_code == 200
    assert accepted.json() == {"id": "order-1", "status": "approved", "total": 60}
    assert example.globs["orders"]["order-1"] == 60
    assert missing.status_code == 404
    assert missing.headers["content-type"] == "application/problem+json"
    problem = missing.json()
    assert problem["status"] == 404
    assert problem["detail"] == "Order not found"
    assert problem["extensions"]["requestPath"] == "/orders/missing/approval"
    assert problem["extensions"]["orderId"] == "missing"
    UUID(problem["extensions"]["errorId"])
    assert invalid.status_code == 400
    assert invalid.json()["errors"] == [
        {"pointer": "#/total", "code": "positive_total_required", "detail": "Total must be positive"}
    ]
    assert rejected.status_code == 422
    assert rejected.json()["extensions"]["ruleCode"] == "order_limit_exceeded"
    assert malformed.status_code == 422


def test_readme_configured_example(configured_app: FastAPI) -> None:
    with TestClient(configured_app) as client:
        accepted = client.post("/orders/order-1/approval", json={"total": 50})
        missing = client.post("/orders/order-404/approval", json={"total": 50})
        invalid = client.post("/orders/order-1/approval", json={"total": 0})
        malformed = client.post("/orders/order-1/approval", json={"total": "invalid"})
        unknown_route = client.get("/unknown")
        wrong_method = client.get("/orders/order-1/approval")

    assert accepted.status_code == 200
    assert accepted.json() == {"id": "order-1", "status": "approved", "total": 50}
    assert missing.status_code == 404
    assert missing.json()["type"] == "/docs/problems/order-not-found"
    assert missing.json()["extensions"]["orderId"] == "order-404"
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Order total must be positive"
    assert malformed.status_code == 422
    assert unknown_route.status_code == 404
    assert unknown_route.json()["title"] == "Not Found"
    assert wrong_method.status_code == 405
    assert wrong_method.json()["status"] == 405
    assert wrong_method.headers["allow"] == "POST"
    documented_responses = configured_app.openapi()["paths"]["/orders/{order_id}/approval"]["post"]["responses"]
    assert {"400", "404", "422", "502", "503"} <= documented_responses.keys()
    assert "application/problem+json" in documented_responses["503"]["content"]


def test_readme_configuration(configured_app: FastAPI, configured_example: doctest.DocTest) -> None:
    namespace = configured_example.globs
    config = namespace["config"]
    router = namespace["APIRouter"](
        route_class=namespace["ExceptionHandlingRoute"].with_config(config),
    )
    upstream_exception = namespace["UpstreamApiException"]

    @router.get("/upstream")
    def fail_upstream() -> None:
        raise upstream_exception("Order service unavailable")

    @router.get("/timeout")
    def fail_timeout() -> None:
        raise TimeoutError("Private connection details")

    configured_app.include_router(router)
    with TestClient(configured_app) as client:
        upstream = client.get("/upstream")
        timeout = client.get("/timeout", headers={"X-Trace-Id": "timeout-trace"})
        another_timeout = client.get("/timeout")

    assert config.logger.name == "orders.errors"
    assert upstream.status_code == 502
    upstream_extensions = upstream.json()["extensions"]
    UUID(upstream_extensions["traceId"])
    assert upstream_extensions["apiVersion"] == "v1"
    assert upstream_extensions["method"] == "GET"
    assert upstream_extensions["severity"] == "ERROR"

    assert timeout.status_code == 503
    assert timeout.headers["content-type"] == "application/problem+json"
    problem = timeout.json()
    assert problem["type"] == "/docs/problems/order-timeout"
    assert problem["status"] == 503
    assert problem["title"] == "Service unavailable"
    assert problem["detail"] == "Order service timed out"
    assert problem["extensions"]["traceId"] == "timeout-trace"
    assert problem["extensions"]["requestPath"] == "/timeout"
    assert problem["extensions"]["apiVersion"] == "v1"
    assert problem["extensions"]["method"] == "GET"
    UUID(problem["extensions"]["errorId"])
    assert "Private" not in timeout.text

    next_trace_id = another_timeout.json()["extensions"]["traceId"]
    UUID(next_trace_id)
    assert next_trace_id != upstream_extensions["traceId"]
    assert namespace["request_trace_id"].get() == ""
    assert namespace["error_counts"] == {"UpstreamApiException": 1}


@pytest.mark.parametrize(
    ("total", "expected_status", "example_index"),
    [(150, 422, 0), (0, 400, 1)],
    ids=["business-rule", "field-validation"],
)
def test_readme_problem_details_response(
    configured_app: FastAPI, total: int, expected_status: int, example_index: int
) -> None:
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    section = readme.partition("## Problem Details\n")[2].partition("\n## ")[0]
    examples = [json.loads(block) for block in re.findall(r"```json\n(.*?)\n```", section, re.DOTALL)]
    assert len(examples) == 2
    example = examples[example_index]
    with TestClient(configured_app) as client:
        response = client.post(
            "/orders/order-1/approval", json={"total": total}, headers={"X-Trace-Id": "example-trace"}
        )

    assert response.status_code == expected_status
    assert response.headers["content-type"] == "application/problem+json"
    payload = response.json()
    UUID(payload["extensions"]["errorId"])
    payload["extensions"]["errorId"] = example["extensions"]["errorId"]
    assert payload == example


def order_service_stub(status: int, payload: object) -> httpx.Client:
    return httpx.Client(
        base_url="https://orders.example",
        timeout=5.0,
        transport=httpx.MockTransport(lambda request: httpx.Response(status, json=payload)),
    )


def test_readme_usage_guidelines() -> None:
    readme_path = Path(__file__).resolve().parents[1] / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    guidelines = readme.partition("## Usage Guidelines\n")[2].partition("\n## ")[0]
    example = doctest.DocTestParser().get_doctest(guidelines, {}, "README usage guidelines", str(readme_path), 0)
    result = doctest.DocTestRunner().run(example, clear_globs=False)
    assert result.failed == 0
    assert result.attempted > 0

    app = FastAPI()
    router = example.globs["configured_router"]
    upstream_exception = example.globs["UpstreamApiException"]
    validation_exception = example.globs["ValidationException"]
    create_order = example.globs["create_order"]
    upstream_findings = {
        "code": "validation_failed",
        "errors": [
            {
                "field": "order_total",
                "code": "too_small",
                "message": "Private upstream details",
                "value": "Private submitted value",
            },
        ],
        "debug": "Private diagnostic details",
    }
    expected_errors = [{"pointer": "#/total", "code": "positive_total_required", "detail": "Total must be positive"}]

    with order_service_stub(422, upstream_findings) as client:
        with pytest.raises(validation_exception, match="Order validation failed") as caught:
            create_order(client, 0)
        assert caught.value.errors == expected_errors
        assert caught.value.extensions is None
        assert caught.value.__cause__ is None

    order_item = example.globs["OrderItem"]
    items = [order_item(quantity=0), order_item(quantity=0)]
    array_findings = {
        "code": "validation_failed",
        "errors": [
            {"field": "line_items.qty", "index": index, "code": "too_small", "message": "Private item details"}
            for index in (0, 1)
        ],
    }
    with order_service_stub(422, array_findings) as client:
        with pytest.raises(validation_exception) as caught:
            create_order(client, 50, items)
        assert caught.value.errors == [
            {
                "pointer": f"#/items/{index}/quantity",
                "code": "positive_quantity_required",
                "detail": "Quantity must be positive",
            }
            for index in (0, 1)
        ]
        assert caught.value.__cause__ is None

    for index in (-1, True, "0", None, 2):
        payload = {
            "code": "validation_failed",
            "errors": [{"field": "line_items.qty", "index": index, "code": "too_small"}],
        }
        with order_service_stub(422, payload) as client:
            with pytest.raises(upstream_exception):
                create_order(client, 50, items)

    invalid_reports = [
        {"code": "validation_failed"},
        {"code": "validation_failed", "errors": []},
        {"code": "validation_failed", "errors": [{"field": "order_total", "code": None}]},
        {
            "code": "validation_failed",
            "errors": [{"field": "order_total", "code": "too_small", "index": 0}],
        },
        {"code": "validation_failed", "errors": [{"field": "private_field", "code": "unknown"}]},
        {
            "code": "validation_failed",
            "errors": [
                {"field": "order_total", "code": "too_small"},
                {"field": "private_field", "code": "unknown"},
            ],
        },
    ]
    for payload in invalid_reports:
        with order_service_stub(422, payload) as client:
            with pytest.raises(upstream_exception):
                create_order(client, 0)

    with order_service_stub(500, upstream_findings) as client:
        with pytest.raises(upstream_exception, match="Order service rejected the request"):
            create_order(client, 0)

    rejections = [
        (
            422,
            {"code": "limit_exceeded"},
            example.globs["BusinessRuleViolationException"],
            "Purchasing limit exceeded",
        ),
        (409, {"code": "order_exists"}, example.globs["DuplicateException"], "Order already exists"),
        (409, upstream_findings, upstream_exception, "Order service rejected the request"),
        (409, {"code": "limit_exceeded"}, upstream_exception, "Order service rejected the request"),
        (422, {"code": "order_exists"}, upstream_exception, "Order service rejected the request"),
        (422, [], upstream_exception, "Order service rejected the request"),
        (422, "Private upstream details", upstream_exception, "Order service rejected the request"),
        (422, {"code": "unknown_rule"}, upstream_exception, "Order service rejected the request"),
        (401, {"code": "invalid_service_credentials"}, upstream_exception, "Order service rejected the request"),
        (500, {"message": "Private upstream details"}, upstream_exception, "Order service rejected the request"),
    ]
    for status, payload, exception_type, message in rejections:
        with order_service_stub(status, payload) as client:
            with pytest.raises(exception_type, match=message) as caught:
                create_order(client, 150)
            assert caught.value.__cause__ is None
            assert "Private" not in str(caught.value)

    for invalid_order_payload in ({"id": "order-1", "total": "invalid"}, [], "Private upstream details"):
        with order_service_stub(200, invalid_order_payload) as client:
            with pytest.raises(upstream_exception, match="Order service returned invalid order data") as caught:
                create_order(client, 50)
            assert isinstance(caught.value.__cause__, example.globs["ValidationError"])
            assert "Private" not in str(caught.value)

    def successful_order(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/orders"
        assert json.loads(request.content) == {"total": 50}
        return httpx.Response(200, json={"id": "order-1", "total": 50})

    with httpx.Client(base_url="https://orders.example", transport=httpx.MockTransport(successful_order)) as client:
        assert create_order(client, 50).model_dump() == {"id": "order-1", "total": 50}

    with httpx.Client(
        base_url="https://orders.example",
        transport=httpx.MockTransport(lambda request: httpx.Response(502, text="Private upstream details")),
    ) as client:
        with pytest.raises(upstream_exception, match="Order service returned invalid JSON") as caught:
            create_order(client, 50)
        assert isinstance(caught.value.__cause__, json.JSONDecodeError)
        assert "Private upstream details" not in str(caught.value)

    for error_type, message in [
        (httpx.ConnectError, "Order service unavailable"),
        (httpx.ReadTimeout, "Order service timed out"),
    ]:

        def transport_failure(
            request: httpx.Request, exception_type: type[httpx.RequestError] = error_type
        ) -> httpx.Response:
            raise exception_type("Private transport details", request=request)

        with httpx.Client(
            base_url="https://orders.example", transport=httpx.MockTransport(transport_failure)
        ) as client:
            with pytest.raises(upstream_exception, match=message) as caught:
                create_order(client, 50)
            assert isinstance(caught.value.__cause__, error_type)
            assert "Private transport details" not in str(caught.value)

    @router.get("/upstream")
    def fail_upstream() -> None:
        raise upstream_exception("Upstream failed")

    @router.get("/validation")
    def fail_validation() -> None:
        raise validation_exception("Invalid input")

    app.include_router(router)
    with TestClient(app) as client:
        response = client.get("/upstream")
        validation_response = client.get("/validation")

    assert response.status_code == 502
    assert response.json()["status"] == 502
    assert validation_response.status_code == 400
    assert validation_response.json()["status"] == 400
    documented_responses = app.openapi()["paths"]["/upstream"]["get"]["responses"]
    assert "application/problem+json" in documented_responses["502"]["content"]

    upstream_failure: httpx.Response | httpx.RequestError | None = None

    def upstream_handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/orders"
        if isinstance(upstream_failure, httpx.RequestError):
            raise upstream_failure
        if upstream_failure is not None:
            return upstream_failure
        request_body = json.loads(request.content)
        total = request_body["total"]
        if "line_items" in request_body:
            assert request_body == {"total": 50, "line_items": [{"qty": 2}, {"qty": 0}]}
            return httpx.Response(422, json={**array_findings, "errors": [array_findings["errors"][1]]})
        if total == 0:
            return httpx.Response(422, json=upstream_findings)
        return httpx.Response(201, json={"id": "order-1", "total": total})

    def mock_order_client() -> Iterator[httpx.Client]:
        with httpx.Client(
            base_url="https://orders.example", timeout=5.0, transport=httpx.MockTransport(upstream_handler)
        ) as client:
            yield client

    orders_app = example.globs["orders_app"]
    orders_app.dependency_overrides[example.globs["get_order_client"]] = mock_order_client
    with TestClient(orders_app) as client:
        rejected = client.post("/orders", json={"total": 0}, headers={"X-Trace-Id": "example-trace"})
        created = client.post("/orders", json={"total": 50})
        nested_rejected = client.post(
            "/orders",
            json={"total": 50, "items": [{"quantity": 2}, {"quantity": 0}]},
            headers={"X-Trace-Id": "example-trace"},
        )

    upstream_section = guidelines.partition("### Upstream Failures\n")[2].partition("\n### ")[0]
    responses = [json.loads(block) for block in re.findall(r"```json\n(.*?)\n```", upstream_section, re.DOTALL)]
    assert len(responses) == 5
    success_example, validation_example, nested_example, *failure_examples = responses
    assert rejected.status_code == 400
    assert rejected.headers["content-type"] == "application/problem+json"
    problem = rejected.json()
    assert problem["status"] == 400
    assert problem["detail"] == "Order validation failed"
    assert problem["errors"] == expected_errors
    assert "findings" not in problem["extensions"]
    assert "traceId" not in problem
    assert "instance" not in problem
    assert problem["extensions"]["requestPath"] == "/orders"
    UUID(problem["extensions"]["errorId"])
    problem["extensions"]["errorId"] = validation_example["extensions"]["errorId"]
    assert problem == validation_example
    assert "Private" not in rejected.text
    assert created.status_code == 201
    assert created.headers["content-type"] == "application/json"
    assert created.json() == success_example

    assert nested_rejected.status_code == 400
    assert nested_rejected.headers["content-type"] == "application/problem+json"
    nested_problem = nested_rejected.json()
    UUID(nested_problem["extensions"]["errorId"])
    nested_problem["extensions"]["errorId"] = nested_example["extensions"]["errorId"]
    assert nested_problem == nested_example
    assert "Private" not in nested_rejected.text
    assert "line_items" not in nested_rejected.text

    expected_failures = {problem["detail"]: problem for problem in failure_examples}
    expected_failures["Order already exists"] = {
        "type": "/docs/problems/duplicate",
        "title": "Duplicate",
        "status": 409,
        "detail": "Order already exists",
    }
    failures: list[tuple[httpx.Response | httpx.RequestError, str]] = [
        (httpx.Response(422, json={"code": "limit_exceeded"}), "Purchasing limit exceeded"),
        (httpx.Response(409, json={"code": "order_exists"}), "Order already exists"),
        (httpx.Response(422, json={"code": "unknown_rule"}), "Order service rejected the request"),
        (httpx.Response(401, json={"code": "invalid_service_credentials"}), "Order service rejected the request"),
        (httpx.Response(500, json={"message": "Private upstream details"}), "Order service rejected the request"),
        (httpx.Response(502, text="<h1>Bad Gateway</h1>"), "Order service returned invalid JSON"),
        (
            httpx.Response(200, json={"id": "order-1", "total": "invalid"}),
            "Order service returned invalid order data",
        ),
        (
            httpx.Response(422, json={"code": "validation_failed", "errors": []}),
            "Order service returned invalid validation data",
        ),
        (
            httpx.Response(
                422,
                json={"code": "validation_failed", "errors": [{"field": "private_field", "code": "unknown"}]},
            ),
            "Order service returned unsupported validation findings",
        ),
        (httpx.ReadTimeout("Private transport details"), "Order service timed out"),
        (httpx.ConnectError("Private transport details"), "Order service unavailable"),
    ]
    with TestClient(orders_app) as client:
        for failure, detail in failures:
            upstream_failure = failure
            response = client.post("/orders", json={"total": 150})
            expected = expected_failures.get(
                detail,
                {
                    "type": "/docs/problems/upstream-api-error",
                    "title": "Upstream API Error",
                    "status": 500,
                    "detail": detail,
                },
            )
            assert response.status_code == expected["status"]
            assert response.headers["content-type"] == "application/problem+json"
            problem = response.json()
            extensions = problem.pop("extensions")
            assert extensions["requestPath"] == "/orders"
            assert extensions["traceId"] == ""
            UUID(extensions["errorId"])
            assert extensions["severity"] == "ERROR"
            if detail == "Purchasing limit exceeded":
                assert extensions["ruleCode"] == "order_limit_exceeded"
            assert problem == expected
            assert "Private" not in response.text
