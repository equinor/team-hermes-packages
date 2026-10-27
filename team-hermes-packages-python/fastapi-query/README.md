# Team Hermes FastAPI Query

FastAPI dependencies for filtering, field selection, ordering, and page-based
pagination. Uses the models from [team-hermes-query](../query/README.md) and
exceptions from [team-hermes-core](../core/README.md).

Requires Python 3.13+, FastAPI 0.115.6+, and Pydantic 2.9 or newer within version 2. No database or error-handling
package is required. This is not a complete OData implementation.

## Installation

```shell
uv pip install team-hermes-fastapi-query
```

The distributions must be available from your configured package source. For local
development, follow the [workspace setup](../README.md). To install built artifacts:

```shell
mise run python:build
uv pip install --find-links team-hermes-packages-python/dist \
  team-hermes-packages-python/dist/team_hermes_fastapi_query-*.whl
```

## Query Dependencies

```pycon
>>> from typing import Annotated
>>> from fastapi import Depends, FastAPI
>>> from fastapi.testclient import TestClient
>>> from team_hermes.fastapi_query import (
...     PageParams,
...     create_order_by_options,
...     parse_filter,
...     parse_select,
... )
>>> from team_hermes.query import FilterBy, OrderBy, Select
>>> app = FastAPI()
>>> @app.get("/items")
... def items(
...     filters: Annotated[FilterBy | None, Depends(parse_filter(["name", "age"]))],
...     select: Annotated[Select | None, Depends(parse_select())],
...     orderby: Annotated[list[OrderBy], Depends(create_order_by_options(["name", "age"]))],
...     page_params: Annotated[PageParams, Depends(PageParams)],
... ):
...     return {"filters": filters, "select": select, "orderby": orderby, "page": page_params}
>>> with TestClient(app) as client:
...     response = client.get("/items", params={
...         "filters": "age gt 30", "$select": "name,age", "orderby": "name asc", "page": 2,
...     })
>>> response.status_code
200
>>> response.json()["filters"]["expression"]
{'operator': 'gt', 'value': 30}
>>> response.json()["select"]
{'fields': ['name', 'age']}
>>> response.json()["orderby"]
[{'key': 'name', 'direction': 'asc'}]
>>> response.json()["page"]
{'page': 2, 'per_page': 100}

```

For example: `/items?filters=age%20gt%2030&$select=name,age&orderby=name%20asc&page=2&per_page=5`.

| Parameter  | Default | Behavior                                                                          |
| ---------- | ------- | --------------------------------------------------------------------------------- |
| `filters`  | `None`  | Comparisons and parenthesized `and`/`or` groups                                   |
| `$select`  | `None`  | Comma-separated field names                                                       |
| `orderby`  | `[]`    | Comma-separated fields with optional `asc` or `desc`; omitted direction is `desc` |
| `page`     | `1`     | Page number, at least 1                                                           |
| `per_page` | `100`   | Page size, from 1 to 10000                                                        |

These names are retained from the existing helpers: `$filter`, `$orderby`, `$top`,
and `$skip` are not aliases. The helpers parse contracts; they do not execute queries
or apply field selection to response data.

## Pagination

`paginate(repository, filters, orderby, page_params, response_model, fetch_relationships=None)`
calls `repository.count(filters)` and `repository.list(...)`, converts each item with
`response_model.model_validate`, and returns `PaginatedResponse` with `count`, `items`,
and `pages`. It uses offset `(page - 1) * per_page` and rounds the page count up.
No results means zero pages; an out-of-range page is not clamped.

Repositories structurally implement `PaginationRepository`; inheritance is not
required. They supply synchronous `count` and `list` methods. The optional
`fetch_relationships` callback is forwarded unchanged to the repository. No ORM
is imported. Configure `from_attributes=True` on the response model for ORM objects.
Use a synchronous endpoint or arrange thread offloading when repository calls block.

## Compatibility and Limits

This extraction retains existing parser behavior rather than introducing a new grammar:

- Parentheses define groups. Within a group, the last logical operator applies to
  every expression; there is no implicit `and`-before-`or` precedence.
- The filter tokenizer is permissive and does not validate the entire input.
  Some malformed input is ignored, and input with no recognized expressions can
  raise `IndexError`. It is not a strict query validator.
- Single-quoted strings, numbers, booleans, nulls, and date-shaped values are
  supported. Date-shaped values are parsed as `%Y-%m-%d`, even when quoted;
  invalid dates can raise `ValueError`.
- `parse_select(valid_options)` retains its existing reversed set-difference check:
  it requires every configured field to appear but does not reject extra fields.
  Do not use it as an allow-list or authorization control. Validate selected fields
  separately in the application before using them.
- Selection retains ordering, duplicates, and empty fields. Sorting directions
  are case-sensitive, and invalid directions raise `ValueError`.
- Field/operator checks raise `team_hermes.core.ValidationException`. This package
  does not register exception handlers. Applications decide how to map failures to
  HTTP responses; [FastAPI Error Handling](../fastapi-error-handling/README.md) is
  an optional, separately installed integration. Page-query constraints are handled
  by FastAPI's request validation.
- Filters, selection, sorting, and pagination do not enforce permissions or guarantee
  stable ordering. Apply authorization and deterministic ordering in the application.

## Development

From the repository root:

```shell
mise run python:test -- fastapi-query/tests
mise run python:test:fastapi-query
mise run python:lint
mise run python:typecheck
mise run python:build
```

The `python:test:fastapi-query` task builds core, query, and FastAPI query wheels,
then runs the regular tests and README doctest against those installed artifacts
in an isolated environment. CI checks current dependencies and FastAPI 0.115.6
with Pydantic 2.9.0 on Python 3.13. Pagination tests use a concrete in-memory
repository; no database or error-handling package is needed.

## License

See [LICENSE](LICENSE).
