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

This app approves orders, returning 404 for a missing order, 400 for an invalid
total, and 422 when the purchasing limit is exceeded. The dictionary is example
storage; replace it with your application's data access.

```python
import logging
from functools import partial

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from team_hermes.core import (
    BusinessRuleViolationException,
    NotFoundException,
    ValidationException,
)
from team_hermes.fastapi_error_handling import (
    ErrorHandlingConfig,
    ExceptionHandlingRoute,
    framework_http_exception_handler,
)
from team_hermes.fastapi_error_handling.exception_handling.responses import responses


logging.basicConfig(level=logging.INFO)
config = ErrorHandlingConfig(logger=logging.getLogger("orders.errors"))
app = FastAPI()
app.add_exception_handler(
    HTTPException,
    partial(framework_http_exception_handler, config=config),
)
router = APIRouter(
    route_class=ExceptionHandlingRoute.with_config(config),
    responses=responses,
)
orders = {"order-1": 50}


class OrderApproval(BaseModel):
    total: int


def approve_order(order_id: str, total: int) -> dict[str, str | int]:
    if order_id not in orders:
        raise NotFoundException("Order not found", extensions={"orderId": order_id})
    if total <= 0:
        raise ValidationException("Order total must be positive")
    if total > 100:
        raise BusinessRuleViolationException(
            "Order total exceeds the purchasing limit",
            extensions={"ruleCode": "order_limit_exceeded"},
        )
    orders[order_id] = total
    return {"id": order_id, "status": "approved", "total": total}


@router.post("/orders/{order_id}/approval")
def approve(order_id: str, body: OrderApproval):
    return approve_order(order_id, body.total)


app.include_router(router)
```

Configure the route class on **every participating router, before defining routes**.
It catches exceptions from that router's endpoints and dependencies; it does not
wrap other routers or endpoints registered directly with `@app`.

Let core exceptions propagate to the route wrapper so it can log them and produce
the response; no per-endpoint `try`/`except` is needed. The catch block in the
[core example](../core/README.md#quick-start) demonstrates a caller handling the
error itself, rather than delegating to an HTTP integration.

`responses=responses` adds default error schemas to OpenAPI. The application-level
handler is optional: it handles HTTP exceptions, including unmatched URLs and
unsupported methods, preserving headers such as `Allow`. It does not handle core
exceptions globally.

Send a request that exceeds the purchasing limit:

```shell
curl -i http://127.0.0.1:8000/orders/order-1/approval \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: example-trace' \
  -d '{"total": 150}'
```

## Problem Details

The request returns **422** and `Content-Type: application/json`, with a generated
`errorId` for each occurrence:

```json
{
  "type": "/docs/problems/business-rule-violation",
  "title": "Business Rule Violation",
  "status": 422,
  "detail": "Order total exceeds the purchasing limit",
  "instance": null,
  "errors": null,
  "extensions": {
    "requestPath": "/orders/order-1/approval",
    "traceId": "example-trace",
    "errorId": "2ee44ba8-d14b-413f-ae31-099d8f6bb75e",
    "severity": "ERROR",
    "ruleCode": "order_limit_exceeded"
  }
}
```

[RFC 9457](https://www.rfc-editor.org/info/rfc9457/) defines Problem Details for
HTTP APIs. This package uses a compatibility format: `application/json` rather
than `application/problem+json`, retained nulls, and nested `extensions`.
The `/docs/problems/...` types identify categories; no documentation endpoints are
created. Clients should use status, type, or extension codes, not parse `detail`.

## Choosing an Exception

Import from `team_hermes.core` and choose by the meaning of the failure.
The handler maps the exception class to an HTTP status, not its message or severity:

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

## Important Notes

- Application details and extensions are public, even on 5xx responses. Use safe,
  JSON-compatible values. Model-validation errors can include invalid input values;
  request validation omits them. Avoid overwriting correlation or severity fields.
- The application owns logging configuration and redaction. `ErrorHandlingConfig`
  can customize `logger`, `status_map`, `problem_type_map`, and `trace_id_provider`.
  Put specific class mappings before base classes and update OpenAPI for custom statuses.
- `UnauthorizedException` adds no authentication challenge. When needed, raise
  `HTTPException(401, detail="Login required", headers={"WWW-Authenticate": "Bearer"})`
  at the authentication boundary; the handler preserves its headers.
- The wrapper cannot replace responses after streaming/background work starts.
  Outer middleware, lifespan, and WebSockets are outside its scope.

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
