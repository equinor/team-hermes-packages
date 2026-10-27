# Team Hermes Query

Shared filter, sorting, and selection contracts for Team Hermes Python projects.
Build query descriptions without importing a repository, web framework, or database library.

**Requires:** Python 3.11+, Pydantic 2, and `team-hermes-core>=0.1.0` for application exceptions.
Core remains independently installable without Pydantic or query.

## Installation

Build the workspace distributions and install query with its dependencies:

```shell
mise run python:build
uv pip install --find-links team-hermes-packages-python/dist \
  team-hermes-packages-python/dist/team_hermes_query-*.whl
```

Dependencies are installed automatically. `--find-links` makes the locally built
core wheel available to the resolver; omit it when core is available from your
configured package source.

Outside the workspace, the versioned core dependency must be available from your
configured package source or supplied as a wheel. The local uv workspace override
is only for development; it is not embedded as a local path in the built distribution.

## Query Contracts

```pycon
>>> from team_hermes.query import (
...     FilterBy,
...     FilterExpression,
...     FilterOperator,
...     LogicalFilter,
...     LogicalOperator,
...     OrderBy,
...     Select,
...     SortDirection,
... )
>>> filters: FilterBy = LogicalFilter(
...     operator=LogicalOperator.and_,
...     filters=[
...         FilterExpression(key="quantity", operator=FilterOperator.gte, value=5),
...         LogicalFilter(
...             operator=LogicalOperator.or_,
...             filters=[
...                 FilterExpression(key="status", operator=FilterOperator.eq, value="pending"),
...                 FilterExpression(key="status", operator=FilterOperator.eq, value="ready"),
...             ],
...         ),
...     ],
... )
>>> ordering = [OrderBy(key="created_at", direction=SortDirection.desc)]
>>> selection = Select(fields=["id", "status", "quantity"])
>>> payload = filters.model_dump(mode="json")
>>> payload["operator"]
'and_'
>>> payload["filters"][0]
{'key': 'quantity', 'expression': {'operator': 'gte', 'value': 5}}
>>> payload["filters"][1]["operator"]
'or_'
>>> ordering[0].model_dump(mode="json")["direction"]
'desc'
>>> selection.fields
['id', 'status', 'quantity']

```

`FilterBy` is the union of `FilterExpression` and recursive `LogicalFilter`.
`FilterExpression.operator` and `.value` expose its inner expression values.
The operator selects one of four Pydantic models:

| Model                     | Operators                                                                                                            | Values                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GeneralFilterExpression` | `eq`, `neq`                                                                                                          | Numbers, dates, datetimes, times, booleans, strings, or `None` |
| `NumericFilterExpression` | `gt`, `lt`, `gte`, `lte`                                                                                             | Numbers, dates, datetimes, or times                            |
| `BooleanFilterExpression` | `isnull`, `notnull`                                                                                                  | Boolean or `None`                                              |
| `StringFilterExpression`  | `like`, `ilike`, `notlike`, `notilike`, `contains`, `notcontains`, `inlist`, `notinlist`, `starts_with`, `ends_with` | String                                                         |

`FilterValue`, `FilterExpressions`, and `FilterExpressionDict` provide shared
annotations. All classes and these aliases are available from `team_hermes.query`.
Their implementation lives in `team_hermes.query.models`.

## Compatibility Boundaries

- Query does not parse query strings, execute queries, validate field names against
  a database schema, or define HTTP responses. Repository interfaces, pagination,
  and transport integrations are outside its scope.
- Logical operator values are `and_` and `or_`; sorting values are lowercase `asc`
  and `desc`. Empty logical groups and empty selections are accepted.
- `FilterExpression` takes flat `key`, `operator`, and `value` arguments but
  serializes a nested `expression` object. Its generated schema describes that
  nested output. Passing its serialized output back to `model_validate()` raises
  `KeyError`; it is not a round-trip query interchange format. Construct it from
  flat arguments or retain model instances when composing filters.
- Unknown operators and incompatible operator/value pairs raise
  `team_hermes.core.ValidationException`. Missing constructor keys raise `KeyError`;
  inner Pydantic validation can raise `pydantic.ValidationError`.
- Values are not strictly validated: for example, numeric comparisons accept
  booleans as integers. `inlist` and `notinlist` accept strings, not Python lists;
  interpretation belongs to the consuming integration.
- These contracts are independent of the Elasticsearch search types and the
  standalone validation engine. Neither package depends on query.

## Development

Follow the [workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- query/tests
mise run python:lint
mise run python:typecheck
mise run python:build
```

The README example runs as a doctest through pytest.

Query is also tested independently on Python 3.11 and 3.12 in CI:

```shell
UV_PYTHON=3.11 mise run python:test:query
UV_PYTHON=3.12 mise run python:test:query
```

The [artifact smoke check](tests/artifact_smoke.py) verifies the installed query
and core wheels with only their declared runtime dependencies.

## License

See [LICENSE](LICENSE).
