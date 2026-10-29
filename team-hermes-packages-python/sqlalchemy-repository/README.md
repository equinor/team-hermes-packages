# Team Hermes SQLAlchemy Repository

Generic synchronous CRUD repository for Python 3.12+ and SQLAlchemy 2.x.
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
>>> batch = [Item(name="Beta"), Item(name="Gamma")]
>>> with Session(engine) as session:
...     repository = Repository(session, Item)
...     created = repository.create_many(batch)
...     names = [item.name for item in created]
...     generated_ids = all(isinstance(item.uid, UUID) for item in created)
...     batch_count = repository.count(None)
>>> created is batch
True
>>> names, generated_ids, batch_count
(['Beta', 'Gamma'], True, 2)
>>> rows = [{"name": "Delta"}, {"name": "Epsilon"}]
>>> with Session(engine) as session:
...     repository = Repository(session, Item)
...     result = repository.bulk_insert(rows)
...     total_count = repository.count(None)
>>> result is None
True
>>> total_count, rows
(4, [{'name': 'Delta'}, {'name': 'Epsilon'}])
>>> engine.dispose()

```

## Contract and Behavior

- `Repository(session, entity)` requires a synchronous SQLAlchemy `Session` and
  a mapped entity with `uid: Mapped[UUID]`, described by the exported `HasID` protocol.
- `create(item)` adds one entity with `Session.add` and returns that same entity.
- `create_many(items)` adds a list of entities with `Session.add_all`, commits once
  for the entire batch, and returns the original list in its original order.
  It uses normal ORM persistence, including generated IDs, session identity, and
  configured relationship cascades, not the legacy `bulk_save_objects` API.
  An empty list still commits the session, including any other pending changes.
- `bulk_insert(rows)` accepts a list of dictionaries keyed by mapped ORM attribute
  names and uses `Session.execute(insert(entity), rows)` without `RETURNING`.
  It returns `None`, leaves input dictionaries unchanged, and does not materialize
  or attach inserted entities to the session. Column defaults still apply in the
  database insert, but generated IDs are not returned or added to the dictionaries.
  Supply scalar column values, including any foreign keys; this method does not
  cascade relationship inserts. Use `create_many` for object graphs.
  An empty list performs no insert but still commits other pending session changes.
- `create`, `create_many`, `bulk_insert`, `update`, and `delete` commit the session, including other pending
  changes in that session. The caller owns session lifetime and rollback after failures.
  A failed batch operation propagates the database exception; call `Session.rollback()`
  before reusing the session. Batch operations do not commit each row separately.
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

`RepositoryInterface` is the SQLAlchemy-aware ABC. Custom implementations must
implement `create`, `create_many`, and `bulk_insert`; the latter two are new abstract methods.
Callers migrating from an overloaded `create(list_of_items)` must call
`create_many(list_of_items)` instead, or explicitly supply flat dictionaries to
`bulk_insert` when ORM object persistence is not needed. Neither the
repository nor its interface contains faceting. Use the independent
[Faceted Search](../sqlalchemy-faceted-search/README.md) package for aggregations.

Applications must enforce access control, permitted query fields, deterministic
ordering, and tenant restrictions. This repository has no automatic tenant scope;
in particular, `get`, `update`, and `delete` do not enforce user filters. Its
per-operation commits are not a unit-of-work abstraction, and it does not support
`AsyncSession`.

`bulk_insert` avoids ORM object construction and unit-of-work processing for its
input rows. It is intended for flat batch loading, but performance depends on the
driver, schema, defaults, and batch size. Benchmark representative workloads before
assuming a particular speedup; it does not guarantee a single SQL statement for
every mapping or heterogeneous batch.

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
