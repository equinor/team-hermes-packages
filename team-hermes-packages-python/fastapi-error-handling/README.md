# Team Hermes FastAPI Error Handling

Core exceptions describe **what went wrong**; this package decides **how to
represent it over HTTP**, turning them into consistent JSON error responses and
logging them.

**Requires:** Python 3.12+, FastAPI, Pydantic 2+, Starlette, and `team-hermes-core>=0.1.0`.

## Installation

From the repository root, build and install the package with its dependencies:

```shell
mise run python:build
uv pip install --find-links team-hermes-packages-python/dist \
  team-hermes-packages-python/dist/team_hermes_fastapi_error_handling-*.whl
```

Omit `--find-links` when core is available from your configured package source.

## Quick Start

This app approves orders, returning 404 for a missing order, 400 for a non-positive
total, and 422 when the purchasing limit is exceeded. The dictionary is example
storage; replace it with your application's data access.

```pycon
>>> import logging
>>> from functools import partial
>>> from fastapi import APIRouter, FastAPI
>>> from pydantic import BaseModel
>>> from starlette.exceptions import HTTPException
>>> from team_hermes.core import (
...     BusinessRuleViolationException,
...     NotFoundException,
...     ValidationException,
... )
>>> from team_hermes.fastapi_error_handling import (
...     ErrorHandlingConfig,
...     ExceptionHandlingRoute,
...     framework_http_exception_handler,
... )
>>> from team_hermes.fastapi_error_handling.exception_handling.responses import responses
>>> logging.basicConfig(level=logging.INFO)
>>> config = ErrorHandlingConfig(logger=logging.getLogger("orders.errors"))
>>> app = FastAPI()
>>> # Optional: handle HTTP errors, including routing 404/405.
>>> app.add_exception_handler(
...     HTTPException,
...     partial(framework_http_exception_handler, config=config),
... )
>>> # Configure each router before adding routes; coverage is router-local.
>>> router = APIRouter(
...     route_class=ExceptionHandlingRoute.with_config(config),
...     responses=responses,  # OpenAPI documentation only.
... )
>>> orders = {"order-1": 50}
>>> class OrderApproval(BaseModel):
...     total: int
...
>>> def approve_order(order_id: str, total: int) -> dict[str, str | int]:
...     if order_id not in orders:
...         raise NotFoundException("Order not found", extensions={"orderId": order_id})
...     if total <= 0:
...         raise ValidationException("Order total must be positive")
...     if total > 100:
...         raise BusinessRuleViolationException(
...             "Order total exceeds the purchasing limit",
...             extensions={
...                 "ruleCode": "order_limit_exceeded",
...                 "limit": 100,
...                 "requestedTotal": total,
...             },
...         )
...     orders[order_id] = total
...     return {"id": order_id, "status": "approved", "total": total}
...
>>> @router.post("/orders/{order_id}/approval")
... def approve(order_id: str, body: OrderApproval):
...     return approve_order(order_id, body.total)
...
>>> app.include_router(router)

```

## Problem Details

Use `errors` for field-validation findings and `extensions` for business-rule
context. These are complementary cases, not alternative validation formats.

**Business-rule rejection (`extensions`):** send a request above the purchasing limit:

```shell
curl -i http://127.0.0.1:8000/orders/order-1/approval \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: example-trace' \
  -d '{"total": 150}'
```

The request returns **422** and `Content-Type: application/problem+json`, with a generated
`errorId` for each occurrence:

```json
{
  "type": "/docs/problems/business-rule-violation",
  "title": "Business Rule Violation",
  "status": 422,
  "detail": "Order total exceeds the purchasing limit",
  "extensions": {
    "requestPath": "/orders/order-1/approval",
    "traceId": "example-trace",
    "errorId": "2ee44ba8-d14b-413f-ae31-099d8f6bb75e",
    "severity": "ERROR",
    "ruleCode": "order_limit_exceeded",
    "limit": 100,
    "requestedTotal": 150
  }
}
```

[RFC 9457](https://www.rfc-editor.org/info/rfc9457/) defines Problem Details for
HTTP APIs. Built-in handlers return `application/problem+json` and omit absent
optional fields. `errors` is an optional extension, not a required RFC member;
application validation errors can use `detail`, `code`, and a JSON `pointer`.
Field errors are top-level `errors`; correlation and custom metadata remain under
`extensions`. Both are application-defined extension members; RFC 9457 does not
require these metadata fields or an `extensions` container.
The `/docs/problems/...` types identify categories; no documentation endpoints are
created. For `/docs/problems/validation-error`, `errors` can contain safe `detail`,
machine-readable `code`, and a `pointer` such as `#/items/1/quantity`.
Clients should recognize the problem by `type`, then inspect its documented codes
and fields, not parse `detail`.

The [CodeOpinion article](https://codeopinion.com/handling-http-api-errors-with-problem-details/)
uses `invalidParams` for validation details. This library uses `errors` for that
purpose, not a second `extensions.invalidParams` format.

**Compatibility:** earlier versions returned `application/json` and explicit nulls.
Clients must accept the problem media type and handle missing optional fields.
Metadata paths such as `extensions.traceId` are unchanged.
Passing `errors=` to `ValidationException` requires a core version with structured-error
support. Metadata is never automatically converted into `errors`.

## Exception-to-HTTP Status Mapping

The handler maps exceptions from `team_hermes.core` to HTTP statuses by class,
not by message or severity:

| Exception                        | Use when                                        | Default status |
| -------------------------------- | ----------------------------------------------- | -------------- |
| `NotFoundException`              | A required resource does not exist.             | 404            |
| `ValidationException`            | Application input checks fail.                  | 400            |
| `BusinessRuleViolationException` | A business policy rejects the action.           | 422            |
| `ConflictException`              | Current resource state prevents the action.     | 409            |
| `DuplicateException`             | Creation would violate uniqueness.              | 409            |
| `UnauthorizedException`          | Authentication is missing or invalid.           | 401            |
| `MissingPrivilegeException`      | The caller lacks permission.                    | 403            |
| `UpstreamApiException`           | An upstream API returns an unexpected response. | 500            |

FastAPI/Pydantic request validation returns 422. Unexpected Python exceptions and
response validation failures return a generic 500; `ValueError` is not a 400.
Other `ApplicationException` subclasses default to 500 unless they inherit a more
specific mapping. See the [core exception guide](../core/README.md#choosing-an-exception)
for category details.

## Usage Guidelines

### When to Return or Raise

**Empty search:** no matches is a valid result, not a failure.

```pycon
>>> order_statuses = {"order-1": "pending"}
>>> def search_orders(status: str) -> list[str]:
...     return [order_id for order_id, current in order_statuses.items() if current == status]
...
>>> search_orders("approved")
[]

```

**Optional lookup:** return `None` when absence is allowed.

```pycon
>>> def find_order_status(order_id: str) -> str | None:
...     return order_statuses.get(order_id)
...
>>> find_order_status("missing") is None
True

```

**Required lookup:** raise when the operation requires a record that does not exist.

```pycon
>>> from team_hermes.core import NotFoundException
>>> def require_order_status(order_id: str) -> str:
...     status = find_order_status(order_id)
...     if status is None:
...         raise NotFoundException("Order not found")
...     return status
...
>>> require_order_status("order-1")
'pending'
>>> require_order_status("missing")
Traceback (most recent call last):
...
team_hermes.core.exceptions.NotFoundException: Order not found

```

**Validation check:** return findings when checking data is the operation,
even if the data is invalid.

```pycon
>>> def check_total(total: int) -> list[dict[str, str]]:
...     if total > 0:
...         return []
...     return [{"field": "total", "code": "positive_total_required", "message": "Total must be positive"}]
...
>>> check_total(50)
[]
>>> check_total(0)
[{'field': 'total', 'code': 'positive_total_required', 'message': 'Total must be positive'}]

```

This check neither saves nor approves anything. Findings are expected results;
errors that prevent a check from running should still propagate. A command that
cannot proceed may instead raise an application exception.

### Exception Propagation

**Raise once; let the handler catch it.** Raise the application exception where the
failure is identified, then let it propagate unchanged through callers to
`ExceptionHandlingRoute`. The wrapper logs it and creates the HTTP error response.

Do not add `try`/`except` at each layer merely to log and re-raise the same exception,
and do not return exception objects. Catch only when you need to recover, translate
the failure, or perform necessary cleanup; prefer context managers or `finally` for cleanup.

Here, `load_order` deliberately fails. The endpoint forwards the call without
catching the exception; the route wrapper handles it:

```pycon
>>> from fastapi import APIRouter, FastAPI
>>> from fastapi.testclient import TestClient
>>> from team_hermes.core import NotFoundException
>>> from team_hermes.fastapi_error_handling import ExceptionHandlingRoute
>>> def load_order(order_id: str) -> dict[str, str]:
...     raise NotFoundException("Order not found", extensions={"orderId": order_id})
...
>>> error_app = FastAPI()
>>> error_router = APIRouter(route_class=ExceptionHandlingRoute)
>>> @error_router.get("/orders/{order_id}")
... def get_order(order_id: str):
...     return load_order(order_id)
...
>>> error_app.include_router(error_router)
>>> with TestClient(error_app) as client:
...     response = client.get("/orders/missing")
...
>>> response.status_code
404
>>> response.json()["detail"]
'Order not found'
>>> response.json()["extensions"]["orderId"]
'missing'

```

### Upstream Failures

Translate documented status/code pairs, not status alone. This HTTPX example
(`uv pip install httpx`) inspects responses directly so known rejections can become
application exceptions:

```pycon
>>> import httpx
>>> from pydantic import BaseModel, Field, ValidationError
>>> from team_hermes.core import (
...     ApplicationException,
...     BusinessRuleViolationException,
...     DuplicateException,
...     UpstreamApiException,
...     ValidationException,
... )
>>> class CreatedOrder(BaseModel):
...     id: str
...     total: int
...
>>> class OrderItem(BaseModel):
...     quantity: int
...
>>> class FieldFinding(BaseModel):
...     pointer: str
...     code: str
...     detail: str
...
>>> class UpstreamFinding(BaseModel):
...     field: str
...     code: str
...     index: int | None = Field(default=None, ge=0, strict=True)
...
>>> class UpstreamValidation(BaseModel):
...     errors: list[UpstreamFinding] = Field(min_length=1)
...
>>> def translate_findings(payload: object, item_count: int = 0) -> list[FieldFinding]:
...     try:
...         report = UpstreamValidation.model_validate(payload)
...     except ValidationError as error:
...         raise UpstreamApiException("Order service returned invalid validation data") from error
...     issues = []
...     for finding in report.errors:
...         if (finding.field, finding.code) == ("order_total", "too_small") and finding.index is None:
...             issues.append(FieldFinding(
...                 pointer="#/total",
...                 code="positive_total_required",
...                 detail="Total must be positive",
...             ))
...         elif (
...             (finding.field, finding.code) == ("line_items.qty", "too_small")
...             and finding.index is not None
...             and finding.index < item_count
...         ):
...             issues.append(FieldFinding(
...                 pointer=f"#/items/{finding.index}/quantity",
...                 code="positive_quantity_required",
...                 detail="Quantity must be positive",
...             ))
...         else:
...             raise UpstreamApiException("Order service returned unsupported validation findings")
...     return issues
...
>>> def create_order(client: httpx.Client, total: int, items: list[OrderItem] | None = None) -> CreatedOrder:
...     request_body: dict[str, object] = {"total": total}
...     if items is not None:
...         request_body["line_items"] = [{"qty": item.quantity} for item in items]
...     try:
...         response = client.post("/orders", json=request_body)
...     except httpx.TimeoutException as error:
...         raise UpstreamApiException("Order service timed out") from error
...     except httpx.RequestError as error:
...         raise UpstreamApiException("Order service unavailable") from error
...     try:
...         payload = response.json()
...     except ValueError as error:
...         raise UpstreamApiException("Order service returned invalid JSON") from error
...     if response.status_code in (200, 201):
...         try:
...             return CreatedOrder.model_validate(payload)
...         except ValidationError as error:
...             raise UpstreamApiException("Order service returned invalid order data") from error
...     code = payload.get("code") if isinstance(payload, dict) else None
...     if response.status_code == 422 and code == "validation_failed":
...         findings = translate_findings(payload, item_count=len(items or []))
...         raise ValidationException(
...             "Order validation failed",
...             title="Order validation failed",
...             errors=[finding.model_dump(mode="json") for finding in findings],
...         )
...     if response.status_code == 422 and code == "limit_exceeded":
...         raise BusinessRuleViolationException(
...             "Purchasing limit exceeded",
...             extensions={"ruleCode": "order_limit_exceeded"},
...         )
...     if response.status_code == 409 and code == "order_exists":
...         raise DuplicateException("Order already exists")
...     raise UpstreamApiException("Order service rejected the request")
...

```

**API endpoint:** return the order; let exceptions reach the wrapper.

```pycon
>>> from collections.abc import Iterator
>>> from fastapi import APIRouter, Depends, FastAPI
>>> from team_hermes.fastapi_error_handling import ExceptionHandlingRoute
>>> from team_hermes.fastapi_error_handling.exception_handling.responses import responses
>>> class CreateOrderRequest(BaseModel):
...     total: int
...     items: list[OrderItem] | None = None
...
>>> def get_order_client() -> Iterator[httpx.Client]:
...     with httpx.Client(base_url="https://orders.example", timeout=5.0) as client:
...         yield client
...
>>> orders_app = FastAPI()
>>> orders_router = APIRouter(route_class=ExceptionHandlingRoute, responses=responses)
>>> @orders_router.post("/orders", response_model=CreatedOrder, status_code=201)
... def submit_order(body: CreateOrderRequest, client: httpx.Client = Depends(get_order_client)) -> CreatedOrder:
...     return create_order(client, body.total, body.items)
...
>>> orders_app.include_router(orders_router)

```

**Successful creation:** your API returns `201 Created` (`application/json`).

```shell
curl -i http://127.0.0.1:8000/orders \
  -H 'Content-Type: application/json' \
  -d '{"total": 50}'
```

```json
{
  "id": "order-1",
  "total": 50
}
```

**Field validation (`errors`):** upstream `422` / `validation_failed` becomes
`400 Bad Request` (`application/problem+json`).

```shell
curl -i http://127.0.0.1:8000/orders \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: example-trace' \
  -d '{"total": 0}'
```

```json
{
  "type": "/docs/problems/validation-error",
  "title": "Order validation failed",
  "status": 400,
  "detail": "Order validation failed",
  "errors": [
    {
      "pointer": "#/total",
      "code": "positive_total_required",
      "detail": "Total must be positive"
    }
  ],
  "extensions": {
    "requestPath": "/orders",
    "traceId": "example-trace",
    "errorId": "2ee44ba8-d14b-413f-ae31-099d8f6bb75e",
    "severity": "ERROR"
  }
}
```

For `{"total": 0}`, `#/total` points to the invalid request value. The `errors`
array follows the [RFC 9457 example](https://www.rfc-editor.org/rfc/rfc9457.html#section-3),
with safe messages and stable codes. Private upstream data stays out; `errorId`
changes per response.

**Nested array validation:** upstream finding
`{"field": "line_items.qty", "index": 1, "code": "too_small"}` maps to
`#/items/1/quantity`, the second item's quantity. Indices are zero-based; this
example keeps item order unchanged when sending to the upstream service.

```shell
curl -i http://127.0.0.1:8000/orders \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: example-trace' \
  -d '{"total": 50, "items": [{"quantity": 2}, {"quantity": 0}]}'
```

Your API returns `400 Bad Request` (`application/problem+json`):

```json
{
  "type": "/docs/problems/validation-error",
  "title": "Order validation failed",
  "status": 400,
  "detail": "Order validation failed",
  "errors": [
    {
      "pointer": "#/items/1/quantity",
      "code": "positive_quantity_required",
      "detail": "Quantity must be positive"
    }
  ],
  "extensions": {
    "requestPath": "/orders",
    "traceId": "example-trace",
    "errorId": "2ee44ba8-d14b-413f-ae31-099d8f6bb75e",
    "severity": "ERROR"
  }
}
```

Each invalid item gets its own `errors` entry. Unknown fields or invalid indices
remain upstream failures, not caller validation errors.

**Optional: return `422` instead of `400`.** Configure the router before adding routes:

```pycon
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig
>>> from team_hermes.fastapi_error_handling.exception_handling.responses import create_response
>>> validation_router = APIRouter(
...     route_class=ExceptionHandlingRoute.with_config(
...         ErrorHandlingConfig(status_map={ValidationException: 422}),
...     ),
...     responses={**responses, 422: create_response(ValidationException())},
... )

```

**Failure examples:** send the same request to `orders_app` with its default status
mappings. Each response assumes the upstream outcome shown; `extensions` is omitted
from these excerpts. All errors use `application/problem+json`.

```shell
curl -i http://127.0.0.1:8000/orders \
  -H 'Content-Type: application/json' \
  -d '{"total": 150}'
```

**Purchasing limit:** upstream `422` with `{"code": "limit_exceeded"}` raises
`BusinessRuleViolationException`. Your API returns `422`:

```json
{
  "type": "/docs/problems/business-rule-violation",
  "title": "Business Rule Violation",
  "status": 422,
  "detail": "Purchasing limit exceeded"
}
```

**Duplicate order:** upstream `409` with `{"code": "order_exists"}` raises
`DuplicateException`. Your API returns `409`:

```json
{
  "type": "/docs/problems/duplicate",
  "title": "Duplicate",
  "status": 409,
  "detail": "Order already exists"
}
```

**Unrecognized rejection:** each of these raises `UpstreamApiException`, returning
the same `500` response. A service-credential failure is not your caller's `401`:

- Upstream `422`: `{"code": "unknown_rule"}`
- Upstream `401`: `{"code": "invalid_service_credentials"}`
- Upstream `500`: `{"message": "Private upstream details"}`

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service rejected the request"
}
```

**Invalid JSON:** upstream `502` with an HTML body such as `<h1>Bad Gateway</h1>`
becomes `UpstreamApiException`, with the JSON parsing exception preserved as its cause:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service returned invalid JSON"
}
```

**Invalid order data:** upstream `200` with `{"id": "order-1", "total": "invalid"}`
becomes `UpstreamApiException` caused by Pydantic's `ValidationError`, not a caller `422`:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service returned invalid order data"
}
```

**Malformed findings:** upstream `422` with `{"code": "validation_failed", "errors": []}`
also becomes `UpstreamApiException` caused by `ValidationError`:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service returned invalid validation data"
}
```

**Unsupported finding:** upstream `422` with
`{"code": "validation_failed", "errors": [{"field": "private_field", "code": "unknown"}]}`
becomes `UpstreamApiException`. There is no exception cause to chain for this rejection:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service returned unsupported validation findings"
}
```

**Timeout:** `httpx.ReadTimeout` is chained with `raise UpstreamApiException(...) from error`:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service timed out"
}
```

The client does not retry: the order may already exist upstream. Retrying creation
requires an idempotency guarantee.

**Connection failure:** `httpx.ConnectError` is preserved as the cause in the same way:

```json
{
  "type": "/docs/problems/upstream-api-error",
  "title": "Upstream API Error",
  "status": 500,
  "detail": "Order service unavailable"
}
```

### Safe Metadata

Application details and extensions are public, even on `500`. Prefer an
application-owned message and stable code over response bodies, URLs, or credentials:

```pycon
>>> from team_hermes.core import UpstreamApiException
>>> error = UpstreamApiException(
...     "Catalog service unavailable",
...     extensions={"code": "catalog_unavailable"},
... )
>>> error.detail, error.extensions
('Catalog service unavailable', {'code': 'catalog_unavailable'})

```

Use JSON-compatible values and do not overwrite correlation or severity fields.
Model-validation errors can include input values; request validation omits them.

### Logging and Status Mappings

The application owns logging and redaction. Put specific exception mappings before
base classes, and document custom statuses in OpenAPI:

```pycon
>>> import logging
>>> from fastapi import APIRouter
>>> from team_hermes.core import ApplicationException, UpstreamApiException
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
>>> config = ErrorHandlingConfig(
...     logger=logging.getLogger("example.errors"),
...     status_map={UpstreamApiException: 502, ApplicationException: 500},
... )
>>> configured_router = APIRouter(
...     route_class=ExceptionHandlingRoute.with_config(config),
... )

```

This overrides the default `500` for `UpstreamApiException`; it is an application
policy, not a requirement to use `502` for every dependency failure.

### Authentication Challenges

`UnauthorizedException` does not set `WWW-Authenticate`. Raise an HTTP exception
with the appropriate challenge at the authentication boundary; the handler preserves it:

```pycon
>>> from starlette.exceptions import HTTPException
>>> raise HTTPException(401, headers={"WWW-Authenticate": "Bearer"})
Traceback (most recent call last):
...
starlette.exceptions.HTTPException: 401: Unauthorized

```

### Handler Scope

Configure each participating router before adding routes. Other routers, outer
middleware, lifespan, and WebSockets are outside the wrapper's scope. Errors during
streaming or background work cannot replace a response that has already started.

## Development

The quick start and response payload are executed and checked by pytest. Follow the
[workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- fastapi-error-handling/tests
mise run python:lint
mise run python:typecheck
mise run python:build
```

## License

See [LICENSE](LICENSE).
