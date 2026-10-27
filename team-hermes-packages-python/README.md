# 🐍 Team Hermes Python Packages

Independent Python 3.13+ libraries sharing a uv workspace and lockfile.

## 📦 Packages

- [🔍 Elasticsearch](elasticsearch/README.md): typed search, filtering, pagination, and aggregations.
- [🧩 Core](core/README.md): shared application exceptions with no runtime dependencies.
- [Query](query/README.md): filter, sorting, and selection contracts; depends on core and Pydantic.
- [Validation](validation/README.md): framework-independent validation rules, results, and serializable reports.
- [Authorization](authorization/README.md): dependency-free role and attribute-based permission checks.
- [FastAPI Error Handling](fastapi-error-handling/README.md): application error responses and correlation IDs.
- [FastAPI Query](fastapi-query/README.md): FastAPI filtering, selection, ordering, and pagination helpers.
- [SQLAlchemy Core](sqlalchemy-core/README.md): shared SQLAlchemy filter compilation.
- [SQLAlchemy Repository](sqlalchemy-repository/README.md): generic synchronous CRUD, listing, and counts.
- [SQLAlchemy Faceted Search](sqlalchemy-faceted-search/README.md): independent cross-filtered facet queries.

See each package's README for installation and usage.

## 🛠️ Development

Install [mise](https://mise.jdx.dev/getting-started.html), then run from the repository root:

```shell
mise install
```

Dependencies are installed automatically by the check tasks:

```shell
mise run python:test
mise run python:lint
mise run python:typecheck
mise run python:build
```

Target tests and a Python version:

```shell
UV_PYTHON=3.15 mise run python:test -- elasticsearch/tests
```

Build output: `team-hermes-packages-python/dist/`.

After changing dependencies, run `uv lock` from `team-hermes-packages-python/`
and commit the updated lockfile.

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to report a bug
or suggest an improvement. See the [repository guide](../README.md) for contributing.
