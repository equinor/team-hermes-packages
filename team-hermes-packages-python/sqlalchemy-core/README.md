# Team Hermes SQLAlchemy Core

SQLAlchemy 2.x filter compilation for Python 3.13+, using
[shared query contracts](../query/README.md). This package does not create
connections, execute queries, manage sessions, or provide repositories or facets.

"Core" means the shared Team Hermes foundation here; these helpers also support
ORM relationships and are not limited to SQLAlchemy's Core expression layer.

For local development, follow the [workspace setup](../README.md).

## Usage

```pycon
>>> from sqlalchemy import create_engine, select
>>> from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
>>> from team_hermes.query import FilterExpression, FilterOperator
>>> from team_hermes.sqlalchemy_core import apply_filters
>>> class Base(DeclarativeBase):
...     pass
>>> class Item(Base):
...     __tablename__ = "items"
...     id: Mapped[int] = mapped_column(primary_key=True)
...     name: Mapped[str]
>>> engine = create_engine("sqlite://")
>>> Base.metadata.create_all(engine)
>>> with Session(engine) as session:
...     session.add_all([Item(name="Alpha"), Item(name="Beta")])
...     filters = FilterExpression(key="name", operator=FilterOperator.eq, value="Alpha")
...     query = apply_filters(Item, select(Item), filters)
...     names = [item.name for item in session.scalars(query)]
>>> names
['Alpha']
>>> engine.dispose()

```

`apply_filters(entity, query, filters)` adds a WHERE clause and returns the new
statement, preserving existing conditions, selected columns, ordering, and
pagination. Passing `None` returns the input statement unchanged. Statements
can be executed with application-owned synchronous or asynchronous sessions.

Supported filters include comparisons, null checks, string matching, list
membership, and nested AND/OR groups. Dotted relationship paths use `any()` or
`has()`, including multiple levels. Missing attributes raise
`team_hermes.core.ValidationException`.

## Compatibility and Boundaries

- LIKE variants surround input with `%`, translate `*` to `%` and `?` to `_`,
  and double `_`. SQL wildcard characters are not escaped for literal matching.
- List operators split on commas without trimming whitespace or coercing values.
- Each relationship expression uses its own `EXISTS`, so separate conditions
  may match different related rows. Relationship-only paths are not scalar targets.
- Values are bound by SQLAlchemy. Applications must still validate allowed
  fields, enforce authorization, and limit filter depth and query cost.

[Repository](../sqlalchemy-repository/README.md) and
[Faceted Search](../sqlalchemy-faceted-search/README.md) independently build on
this package. Neither is required to use filtering. HTTP parsing is available
separately through [FastAPI Query](../fastapi-query/README.md).

## Development

```shell
mise run python:test -- sqlalchemy-core/tests
mise run python:test:sqlalchemy
mise run python:typecheck
mise run python:build:sqlalchemy
```

Tests execute SQLite queries and compile PostgreSQL statements; no live
PostgreSQL server is required. The `python:test:sqlalchemy` task builds the packages
and runs each package's tests and README doctest against installed wheels in a
separate isolated environment. Dependencies are resolved automatically from the
build directory and configured package index.

## License

See [LICENSE](LICENSE).
