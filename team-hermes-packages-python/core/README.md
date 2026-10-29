# 🧩 Team Hermes Core

Shared, framework- and transport-agnostic Python exceptions for application failures.
They describe what went wrong without knowing about HTTP APIs, status codes, or
response formats. Your application or integration decides how to handle them,
whether in an API, command-line tool, or background worker.

**Requires:** Python 3.12+. Git is required for installation from source.
Core has no runtime dependencies outside the standard library.

## ⬇️ Installation

Install into a virtual environment:

```shell
python -m pip install \
  "team-hermes-core @ git+https://github.com/equinor/team-hermes-packages.git@main#subdirectory=team-hermes-packages-python/core"
```

For reproducible installs, replace `main` with a release tag or full commit SHA.

## Quick Start

Import from `team_hermes.core`, raise a specific exception, and catch it where you
can handle the failure. `ApplicationException` catches any of the built-in categories:

```pycon
>>> from team_hermes.core import ApplicationException, NotFoundException
>>> orders = {"order-1": "pending"}
>>> def get_order_status(order_id: str) -> str:
...     if order_id not in orders:
...         raise NotFoundException("Order not found", extensions={"order_id": order_id})
...     return orders[order_id]
...
>>> try:
...     status = get_order_status("order-404")
...     print(status)
... except ApplicationException as error:
...     print(str(error))
...
Order not found

```

The caller decides how to present the error; the lookup function has no logging
or HTTP dependency.

## Handling Errors

Catch a specific exception when you can recover from that failure. Catch
`ApplicationException` at an application boundary that handles all application
errors: a CLI might display a message and choose an exit code; a worker might
record a failed job or apply its own retry policy.

Core does not send responses, emit logs, retry operations, or manage database
transactions. Titles, type identifiers, and severity are metadata, not HTTP status
mappings. For APIs, the [FastAPI integration](../fastapi-error-handling/README.md#problem-details)
provides response conversion and logging; applications own disclosure policies.

## Choosing an Exception

| Exception                        | Use when                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `NotFoundException`              | A required resource does not exist.                                  |
| `ValidationException`            | Application input is invalid, such as a reversed date range.         |
| `BusinessRuleViolationException` | Valid input violates a policy, such as a purchasing limit.           |
| `ConflictException`              | Current resource state prevents an action, such as a stale revision. |
| `DuplicateException`             | Creation would violate uniqueness.                                   |
| `UnauthorizedException`          | Authentication is missing or invalid.                                |
| `MissingPrivilegeException`      | The caller lacks permission.                                         |
| `UpstreamApiException`           | An upstream API returns an unexpected or malformed response.         |

All eight inherit directly from `ApplicationException`; `DuplicateException` is
not a `ConflictException`. Translate only known failures with an application
meaning, preserving their cause with `raise ... from error`. Do not reclassify
every unexpected programming error as an application exception.

Choose categories consistently so callers can react appropriately. An empty search
result need not be an exception; use `NotFoundException` when a particular resource
is required to exist.

## Exception Details

- Built-in categories accept `detail`, `title`, and `extensions`. Keep messages
  useful and context safe to disclose: integrations may return them to clients.
- `MissingPrivilegeException` defaults to `ExceptionSeverity.WARNING`; the others
  default to `ERROR`. The enum also provides `CRITICAL`. Severity is metadata;
  core does not emit logs.
- The base `ApplicationException` additionally accepts `type`, `instance`, and
  `severity`. Its defaults are `about:blank`, `ERROR`, and `None` for optional fields.
- `ApplicationException` and `ValidationException` accept keyword-only `errors`,
  a list of dictionaries for safe, structured error details. For example,
  `ValidationException("Invalid order", errors=[{"detail": "Total must be positive", "pointer": "#/total"}])`.
  Core stores these details without interpreting them; the FastAPI integration
  exposes supported fields in the response's top-level `errors` array.
- `to_dict()` retains `None` for existing fields and shares the original
  extensions dictionary. It includes `errors` only when supplied, including an
  empty list. It is not an HTTP response.

## 🛠️ Development

Follow the [workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- core/tests
mise run python:lint
mise run python:typecheck
mise run python:build
```

The README example is executed and checked by pytest. To test the installed wheel independently:

```shell
UV_PYTHON=3.12 mise run python:test:core
```

## ⚖️ License

See [LICENSE.md](LICENSE.md).
