# Team Hermes FastAPI Error Handling

FastAPI error handling for Team Hermes Python projects.

**Requires:** Python 3.12+, FastAPI, Pydantic 2+, Starlette, and `team-hermes-core>=0.1.0`.
FastAPI is not restricted to one minor release. CI tests current dependencies and
FastAPI 0.115.6. No query, validation, database, or cloud package is required.

## Installation

Build the workspace distributions, then install the FastAPI wheel:

```shell
mise run python:build
uv pip install --find-links team-hermes-packages-python/dist \
	team-hermes-packages-python/dist/team_hermes_fastapi_error_handling-*.whl
```

Dependencies, including core, are installed automatically. `--find-links` makes the
locally built core wheel available; omit it when core is available from your configured
package source. The uv workspace source override is for development only.

## Error Handling

Set the route class before defining routes. Response documentation is opt-in and
does not install exception handlers globally.

```pycon
>>> from fastapi import APIRouter, FastAPI
>>> from fastapi.testclient import TestClient
>>> from team_hermes.core import NotFoundException
>>> from team_hermes.fastapi_error_handling import ExceptionHandlingRoute
>>> from team_hermes.fastapi_error_handling.exception_handling.responses import responses
>>> app = FastAPI()
>>> router = APIRouter(route_class=ExceptionHandlingRoute, responses=responses)
>>> @router.get("/orders/{order_id}")
... async def get_order(order_id: str):
...     raise NotFoundException("Order not found", extensions={"orderId": order_id})
...
>>> app.include_router(router)
>>> with TestClient(app) as client:
...     response = client.get("/orders/order-1")
>>> response.status_code
404
>>> response.json()["detail"]
'Order not found'
>>> response.json()["extensions"]["orderId"]
'order-1'

```

The response uses `application/json` with `type`, `title`, `status`, `detail`,
`instance`, `errors`, and `extensions`. Nullable fields are retained. The extension
object includes `requestPath`, `traceId`, a fresh UUID `errorId`, and application
exception severity plus any supplied extension fields.

| Exception                                                                 | HTTP Status |
| ------------------------------------------------------------------------- | ----------- |
| `ValidationException`                                                     | 400         |
| `UnauthorizedException`                                                   | 401         |
| `MissingPrivilegeException`                                               | 403         |
| `NotFoundException`                                                       | 404         |
| `DuplicateException`, `ConflictException`                                 | 409         |
| `BusinessRuleViolationException`                                          | 422         |
| Pydantic `ValidationError`, FastAPI `RequestValidationError`              | 422         |
| Other `ApplicationException` subclasses, including `UpstreamApiException` | 500         |
| Unhandled exceptions and response validation failures                     | 500         |

Subclasses inherit their parent's mapping. Unexpected failures return a generic
message; their exception text is logged, not returned. Application errors log at
their declared severity. Request/model validation errors log at error level.

FastAPI and Starlette `HTTPException`s raised within `ExceptionHandlingRoute`
return Problem Details directly, preserving their status, detail, and headers.
The route's configuration controls problem types and extensions. These exceptions
do not reach application-registered HTTP exception handlers. Routing errors such
as unmatched URLs (404) and unsupported methods (405) remain outside this wrapper
and retain the framework response unless an application handler is registered.

### Framework HTTP Exceptions as Problem Details

Optionally register `framework_http_exception_handler` on the application to also
return Problem Details for HTTP exceptions outside the route wrapper, including
routing errors such as 404 and 405.
Register the Starlette base class so FastAPI's HTTP exceptions are covered too.
The route and application handler can share the same configuration, as below.
Registration replaces the application's handler for that exception class.

```pycon
>>> from functools import partial
>>> from starlette.exceptions import HTTPException
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig, framework_http_exception_handler
>>> config = ErrorHandlingConfig(trace_id_provider=lambda: "example-trace")
>>> app = FastAPI()
>>> app.add_exception_handler(HTTPException, partial(framework_http_exception_handler, config=config))
>>> router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))
>>> @router.get("/private")
... async def private():
...     raise HTTPException(401, detail="Login required", headers={"WWW-Authenticate": "Bearer"})
>>> app.include_router(router)
>>> with TestClient(app) as client:
...     response = client.get("/private")
...     missing = client.get("/unknown")
>>> response.status_code, response.headers["WWW-Authenticate"]
(401, 'Bearer')
>>> response.json()["title"], response.json()["detail"]
('Unauthorized', 'Login required')
>>> response.json()["extensions"]["traceId"]
'example-trace'
>>> missing.status_code, missing.json()["title"]
(404, 'Not Found')

```

The handler preserves the exception's HTTP status and headers, including
`WWW-Authenticate`, `Retry-After`, and `Allow`. It uses `application/json`, matching
the other handlers. The problem title is the HTTP reason phrase, or `HTTP Error`
for an unknown status. Problem types and correlation extensions use the supplied
configuration. Omit `partial(...)` and register the handler directly to use defaults.

String details populate `detail`. FastAPI also permits structured details; these
are JSON-encoded in `extensions.httpExceptionDetail`, leaving `detail` null.
Details are returned as supplied, so do not include sensitive information.
Statuses that forbid response bodies, such as 204 and 304, retain their status
and headers but have no Problem Details body. Application-level registration is
separate from `ErrorHandlingConfig.exception_handlers`, which does not intercept
framework HTTP exceptions.

## Configuration

Use a configured route class to keep policies isolated between routers and apps.
The logger defaults to `logging.getLogger("team_hermes.fastapi_error_handling")`; importing this
package never configures logging handlers or telemetry providers.

```pycon
>>> import logging
>>> from fastapi import APIRouter, FastAPI
>>> from fastapi.testclient import TestClient
>>> from team_hermes.core import BusinessRuleViolationException
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
>>> config = ErrorHandlingConfig(
...     logger=logging.getLogger("orders.errors"),
...     status_map={BusinessRuleViolationException: 409},
...     problem_type_map={BusinessRuleViolationException: "urn:orders:business-rule"},
...     extension_provider=lambda request: {"service": "orders"},
... )
>>> router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))
>>> @router.post("/orders")
... async def create_order():
...     raise BusinessRuleViolationException("Order limit reached")
...
>>> configured_app = FastAPI()
>>> configured_app.include_router(router)
>>> with TestClient(configured_app) as client:
...     response = client.post("/orders")
>>> response.status_code
409
>>> response.json()["type"]
'urn:orders:business-rule'
>>> response.json()["extensions"]["service"]
'orders'

```

Custom status mappings are checked in insertion order before defaults; put specific
subclasses before broad base classes. The supplied response documentation describes
default mappings; adjust it when using custom statuses.

`problem_type_map` overrides problem-type URIs by exception class, also in insertion
order. Application exceptions retain their own `type` unless overridden. Other
library-generated problems default to `about:blank`; no `/docs` endpoint is assumed
or provided. Use your own documentation URLs or URNs. An `Exception` entry can
provide a catch-all override, including for core exception types.

`trace_id_provider` can supply a trace ID. Otherwise the handler uses `X-Trace-Id`,
then the raw `traceparent` header, then an empty string. It does not validate client
trace headers or generate an entire trace. `errorId` identifies each error occurrence.
Configured extension fields override common fields; exception extension fields
override both, including severity and correlation fields, for compatibility.

`exception_observer` receives application and unhandled exceptions, not request/model
validation failures. `exception_handlers` maps additional exception classes to
synchronous callables accepting `(request, exception, config)` and returning a
Starlette response. Standard application, validation, and framework exceptions take
precedence over these handlers. Callbacks run during handling and must return valid
values without raising. Treat configuration mappings as immutable after startup.

## Optional Integrations

Install the `requests` extra when using upstream `requests.exceptions.HTTPError`:

```shell
uv pip install 'team-hermes-fastapi-error-handling[requests]'
```

This command assumes the distribution and core are available from your configured
package source. For local builds, use the built wheel path with `[requests]` appended.
Installing an extra does not enable its behavior automatically.

```pycon
>>> from fastapi import APIRouter, FastAPI
>>> from fastapi.testclient import TestClient
>>> from requests import Response
>>> from requests.exceptions import HTTPError
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
>>> from team_hermes.fastapi_error_handling.exception_handling.integrations.requests import http_exception_handler
>>> config = ErrorHandlingConfig(
...     exception_handlers={HTTPError: http_exception_handler},
...     problem_type_map={HTTPError: "urn:orders:upstream"},
... )
>>> router = APIRouter(route_class=ExceptionHandlingRoute.with_config(config))
>>> @router.get("/upstream")
... async def upstream_failure():
...     upstream = Response()
...     upstream.status_code = 503
...     raise HTTPError(response=upstream)
...
>>> upstream_app = FastAPI()
>>> upstream_app.include_router(router)
>>> with TestClient(upstream_app) as client:
...     response = client.get("/upstream")
>>> response.status_code
502
>>> response.json()["type"]
'urn:orders:upstream'

```

Upstream errors include the upstream URL and
response headers in extensions. The original response-truthiness behavior is
preserved: real `requests.Response` objects with 4xx/5xx statuses are falsey, so they
produce **502**, as does a missing response. A truthy response retains its status.
This adapter is separate from framework `HTTPException` handling.

Install the `telemetry` extra for OpenTelemetry API hooks, then enable them explicitly:

```pycon
>>> from opentelemetry import trace
>>> from team_hermes.fastapi_error_handling import ErrorHandlingConfig, ExceptionHandlingRoute
>>> from team_hermes.fastapi_error_handling.exception_handling.integrations.telemetry import get_trace_id, record_exception
>>> config = ErrorHandlingConfig(
...     trace_id_provider=get_trace_id,
...     exception_observer=record_exception,
... )
>>> route_class = ExceptionHandlingRoute.with_config(config)
>>> context = trace.SpanContext(trace_id=42, span_id=7, is_remote=False)
>>> with trace.use_span(trace.NonRecordingSpan(context)):
...     trace_id = get_trace_id()
...     record_exception(RuntimeError("No recording span"))
>>> trace_id
'0000000000000000000000000000002a'
>>> get_trace_id() is None
True

```

Active span IDs take precedence over request headers. Recording spans receive
application exception attributes or an exception event for unhandled failures.
No SDK, exporter, instrumentation, Azure integration, or provider is configured.
Combine these fields with `exception_handlers` in one configuration to use both extras.

## Compatibility and Disclosure

- Application error details and extensions are returned as supplied. Model validation
  details include invalid input values; request validation details omit those values.
  Application owners must avoid sensitive values and configure logging/redaction policy.
- The optional requests adapter exposes upstream URL and response headers. Enable it
  only where those values are safe to disclose, or supply a custom handler.
- Request validation locations use slash-separated paths; model validation locations
  use dot-separated paths. These are compatibility formats, not escaped JSON Pointers.
- The shared OpenAPI response map documents problem schemas and descriptions for
  default application errors. It does not generate example payloads. Applications
  can add representative examples through FastAPI's response metadata.
- Route handling covers endpoint execution, dependencies, and response construction.
  It cannot replace a response once streaming or a background task has started, and
  it does not handle failures in outer middleware, lifespan, or WebSocket endpoints.
- Query parsing, pagination, schema helpers, authentication, and application bootstrap
  are outside this package's current scope.

## Development

All four README examples run with `doctest` as part of pytest. Follow the
[workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- fastapi-error-handling/tests
mise run python:lint
mise run python:typecheck
mise run python:build
```

CI also builds core and FastAPI wheels, installs them in an isolated environment,
and runs the normal suite against the installed packages on Python 3.12.
The integration tests use real OpenTelemetry SDK spans with an in-memory exporter;
the SDK is only a test dependency, not a runtime requirement.

```shell
UV_PYTHON=3.12 mise run python:test:fastapi-error-handling
UV_PYTHON=3.12 FASTAPI_REQUIREMENT='fastapi==0.115.6' mise run python:test:fastapi-error-handling
```

## License

See [LICENSE](LICENSE).
