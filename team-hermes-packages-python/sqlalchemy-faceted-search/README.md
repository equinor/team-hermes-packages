# Team Hermes SQLAlchemy Faceted Search

SQLAlchemy 2.x faceting helpers for Python 3.12+, using
[shared filtering](../sqlalchemy-core/README.md) and [query contracts](../query/README.md).
No repository or FastAPI dependency, database
driver, engine creation, session management, or transaction handling is included.

For local development, follow the [workspace setup](../README.md).
Install a database driver separately when using a database other than SQLite.

## Filtering and Faceting

```pycon
>>> from sqlalchemy import create_engine, select
>>> from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
>>> from team_hermes.query import FilterExpression, FilterOperator, LogicalFilter, LogicalOperator
>>> from team_hermes.sqlalchemy_core import apply_filters
>>> from team_hermes.sqlalchemy_faceted_search import FacetConfig, FacetCountsResponse, serialize_value
>>> class Base(DeclarativeBase):
...     pass
>>> class Item(Base):
...     __tablename__ = "items"
...     id: Mapped[int] = mapped_column(primary_key=True)
...     name: Mapped[str]
...     category: Mapped[str]
...     price: Mapped[int]
>>> filters = LogicalFilter(
...     operator=LogicalOperator.and_,
...     filters=[
...         FilterExpression(key="category", operator=FilterOperator.eq, value="tools"),
...         FilterExpression(key="price", operator=FilterOperator.gt, value=10),
...     ],
... )
>>> engine = create_engine("sqlite://")
>>> Base.metadata.create_all(engine)
>>> with Session(engine) as session:
...     session.add_all([
...         Item(name="Wrench", category="tools", price=25),
...         Item(name="Screw", category="tools", price=5),
...         Item(name="Manual", category="books", price=20),
...     ])
...     session.flush()
...     query = apply_filters(Item, select(Item), filters)
...     names = [item.name for item in session.scalars(query)]
...     facet_query = FacetConfig().resolve_query("category", Item, filters)
...     counts = {serialize_value(value): count for value, count in session.execute(facet_query)}
...     response = FacetCountsResponse(facets={"category": counts})
>>> names
['Wrench']
>>> response.facets == {"category": {"books": 1, "tools": 1}}
True
>>> engine.dispose()

```

`apply_filters(entity, query, filters)` adds a WHERE clause to an existing
SQLAlchemy `Select`. Passing `None` returns the query unchanged. Existing WHERE
clauses, ordering, and pagination remain in place. The helper does not execute
the query; applications can execute the statements with their own synchronous
or asynchronous SQLAlchemy sessions.

Filters support comparisons, null checks, string matching, comma-separated
lists, and nested AND/OR groups. Dotted relationship paths such as
`children.name` use correlated `EXISTS` expressions through SQLAlchemy's `any()`
or `has()`, including multiple relationship levels. Missing attributes raise
`team_hermes.core.ValidationException`.

## Facet Configuration

`FacetConfig.resolve_query(facet_id, entity, filters)` returns a grouped count
statement. It removes filters on the current facet before applying the remaining
filters. This allows other values of the selected facet to remain visible.

- `cross_filter_exclusions`: additional filter keys to remove when counting.
- `column_override`: SQLAlchemy expression to group by instead of resolving the facet ID.
- `scope`: fixed WHERE condition applied to the default grouped query.
- `build_query`: callable accepting the entity and returning a custom `Select`, for joins or distinct counts.

A custom `build_query` replaces the default query, including `column_override`
and `scope`. It must add its own joins, grouping, and mandatory scope conditions;
remaining cross-filters are still applied afterward. Default counts are row
counts, not distinct entity counts. Queries return the value and count columns
without an implicit sort or limit.

`serialize_value` converts `None` to `"null"`, booleans to lowercase strings, and
other values using `str`. `FacetCountsResponse` contains
`facets: dict[str, dict[str, int]]`. Values with identical serialized strings
(for example, `None` and the string `"null"`) need application-specific handling
if they must remain distinct.

## Compatibility and Boundaries

The extracted implementations retain their existing behavior:

- LIKE variants surround the input with `%`, translate `*` to `%` and `?` to `_`,
  and double `_`. They do not escape SQL wildcard characters for literal matching.
- List operators split on commas without trimming whitespace or coercing values.
- Each relationship filter uses its own `EXISTS`; separate conditions may match
  different related rows. Relationship-only paths are not scalar filter targets.
- Facet pruning removes matching keys from both AND and OR groups, collapses
  single-child groups, and does not mutate the original filter tree.
- Facet column resolution uses attribute traversal, not the relationship-aware
  filter resolver. Relationship facets generally need a custom query and joins.

Applications must validate allowed fields and enforce authorization. Facet
filter removal is not suitable for mandatory security or tenant restrictions:
use `scope` for the default query, or enforce them inside `build_query`.
SQLAlchemy binds filter values, but these helpers do not impose an attribute
allow-list or limit filter depth or query cost.

Ordering, selection, pagination, and database configuration stay with the
application. The independent [Repository](../sqlalchemy-repository/README.md)
package provides CRUD operations; this package only builds facet-count queries
and response models, not a complete search-results workflow.
[FastAPI Query](../fastapi-query/README.md) can parse HTTP
filters into the same shared contracts without being a dependency of this package.

## Development

From the repository root:

```shell
mise run python:test -- sqlalchemy-faceted-search/tests
mise run python:test:sqlalchemy
mise run python:typecheck
mise run python:build:sqlalchemy
```

Tests execute facet counts on SQLite. They do not require a live PostgreSQL server.

The `python:test:sqlalchemy` task builds the packages and runs the faceting tests
and README doctest against installed wheels in an isolated environment, without
repository, FastAPI, or application packages. Dependencies are resolved automatically.

## License

See [LICENSE](LICENSE).
