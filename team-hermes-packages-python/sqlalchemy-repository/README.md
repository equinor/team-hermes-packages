# Team Hermes SQLAlchemy Repository

Generic synchronous CRUD repository for Python 3.13+ and SQLAlchemy 2.x.
Uses [shared filtering](../sqlalchemy-core/README.md) without a faceting dependency.

For local development, follow the [workspace setup](../README.md).
Install your database driver separately. No engine, session, HTTP integration, or application configuration
is created by importing this package.

## Usage

```pycon
>>> from uuid import UUID, uuid4
>>> from sqlalchemy import create_engine
>>> from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
>>> from team_hermes.query import FilterExpression, FilterOperator, OrderBy, SortDirection
>>> from team_hermes.sqlalchemy_repository import Repository
>>> class Base(DeclarativeBase):
...     pass
>>> class Item(Base):
...     __tablename__ = "items"
...     uid: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
...     name: Mapped[str]
>>> engine = create_engine("sqlite://")
>>> Base.metadata.create_all(engine)
>>> with Session(engine) as session:
...     repository = Repository(session, Item)
...     item = repository.create(Item(name="Alpha"))
...     uid = item.uid
...     retrieved_name = repository.get(uid).name
...     filters = FilterExpression(key="name", operator=FilterOperator.eq, value="Alpha")
...     items = repository.list(
...         filters=filters,
...         orderby=[OrderBy(key="name", direction=SortDirection.asc)],
...         limit=10,
...         offset=0,
...     )
...     names = [item.name for item in items]
...     matching_count = repository.count(filters)
...     item.name = "Updated"
...     updated = repository.update(item)
...     updated_name = repository.get(uid).name
...     repository.delete(uid)
...     remaining_count = repository.count(None)
>>> retrieved_name, names, matching_count
('Alpha', ['Alpha'], 1)
>>> updated_name, remaining_count
('Updated', 0)
>>> engine.dispose()

```

## Contract and Behavior

- `Repository(session, entity)` requires a synchronous SQLAlchemy `Session` and
  a mapped entity with `uid: Mapped[UUID]`, described by the exported `HasID` protocol.
- `create`, `update`, and `delete` commit the session, including other pending
  changes in that session. The caller owns session lifetime and rollback after failures.
- `get` and `delete` raise `team_hermes.core.NotFoundException` for missing IDs.
- `update` uses `Session.merge` and returns the original argument, not the merged
  instance. It may insert a missing entity; it does not enforce update-only semantics.
- `list` supports shared filters, ordered sort keys, limit, offset, and eager loading.
  It materializes unique scalar entities. There is no implicit sort or page-size cap.
- `get` and `list` accept `fetch_relationships`, a callable receiving the entity
  class and returning SQLAlchemy loader options such as `joinedload` or `selectinload`.
- `count(filters)` counts matching rows without pagination. Use `None` for all rows.

The source ordering implementation uses attribute traversal for dotted keys;
it does not automatically join relationships. Invalid sorting attributes raise
`AttributeError`. Filter relationship paths use the shared filter compiler instead.

`RepositoryInterface` preserves the local SQLAlchemy-aware ABC. Neither the
repository nor its interface contains faceting. Use the independent
[Faceted Search](../sqlalchemy-faceted-search/README.md) package for aggregations.

Applications must enforce access control, permitted query fields, deterministic
ordering, and tenant restrictions. This repository has no automatic tenant scope;
in particular, `get`, `update`, and `delete` do not enforce user filters. Its
per-operation commits are not a unit-of-work abstraction, and it does not support
`AsyncSession`.

## Development

```shell
mise run python:test -- sqlalchemy-repository/tests
mise run python:test:sqlalchemy
mise run python:typecheck
mise run python:build:sqlalchemy
```

Tests execute CRUD and relationship queries on SQLite without a database service.
The `python:test:sqlalchemy` task builds the packages and runs the repository tests
and README doctest against installed wheels in an isolated environment, without
faceting, FastAPI, or application packages. Dependencies are resolved automatically.

## License

See [LICENSE](LICENSE).
