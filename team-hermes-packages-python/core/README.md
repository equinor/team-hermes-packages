# 🧩 Team Hermes Core

Shared application exceptions for Team Hermes Python projects.
Core describes errors; integrations decide how to handle them.

**Requires:** Python 3.12+. Git is required for installation from source.
Core has no runtime dependencies outside the standard library.

## ⬇️ Installation

Install into a virtual environment:

```shell
python -m pip install \
  "team-hermes-core @ git+https://github.com/equinor/team-hermes-packages.git@main#subdirectory=team-hermes-packages-python/core"
```

For reproducible installs, replace `main` with a release tag or full commit SHA.

## Application Exceptions

Use the common base class to catch application errors and `to_dict()` to inspect
their details independently of an HTTP response or logging framework:

```pycon
>>> from team_hermes.core import ApplicationException, ExceptionSeverity, NotFoundException
>>> try:
...     raise NotFoundException("Order not found", extensions={"order_id": "order-1"})
... except ApplicationException as error:
...     payload = error.to_dict()
...     assert error.severity is ExceptionSeverity.ERROR
...     print(str(error))
Order not found
>>> payload == {
...     "type": "/docs/problems/not-found",
...     "title": "Not Found",
...     "detail": "Order not found",
...     "instance": None,
...     "extensions": {"order_id": "order-1"},
...     "severity": "ERROR",
... }
True

```

`ApplicationException` accepts `type`, `title`, `detail`, `instance`, `extensions`,
and `severity`. Defaults are `about:blank`, `None` for the optional fields, and
`ExceptionSeverity.ERROR`. Its subclasses accept custom `detail`, `title`, and
`extensions`:

- `MissingPrivilegeException` (warning severity)
- `NotFoundException`
- `ValidationException`
- `UnauthorizedException`
- `BusinessRuleViolationException`
- `DuplicateException`
- `ConflictException`
- `UpstreamApiException`

All other subclasses default to error severity. The severity enum also provides
`CRITICAL`. Problem type identifiers and titles are metadata, not HTTP status
mappings; applications own status selection, logging, and disclosure policies.
`to_dict()` retains `None` fields and shares the original extensions dictionary.

## Package Boundaries

All exceptions are exported from `team_hermes.core` and defined in
`team_hermes.core.exceptions`. Core does not configure logging or define HTTP
status mappings, responses, repositories, or database integrations.

## 🛠️ Development

Follow the [workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- core/tests
mise run python:lint
mise run python:typecheck
mise run python:build
```

The README example runs as a doctest through pytest.

Core is also tested as an installed wheel on Python 3.12 in CI. Run this check
without installing the other workspace packages:

```shell
UV_PYTHON=3.12 mise run python:test:core
```

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to suggest
shared functionality. See the [repository guide](../../README.md) for contributing.

## ⚖️ License

See [LICENSE.md](LICENSE.md).
