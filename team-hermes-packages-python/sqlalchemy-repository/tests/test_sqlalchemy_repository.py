from collections.abc import Iterator
from inspect import signature
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import ForeignKey, create_engine, event, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, joinedload, mapped_column, relationship
from team_hermes.core import NotFoundException
from team_hermes.query import FilterExpression, FilterOperator, OrderBy, SortDirection

from team_hermes.sqlalchemy_repository import Repository, RepositoryInterface


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"
    uid: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str]
    rank: Mapped[int] = mapped_column(default=0)
    children: Mapped[list["Child"]] = relationship()


class Child(Base):
    __tablename__ = "children"
    uid: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    parent_uid: Mapped[UUID] = mapped_column(ForeignKey("items.uid"))
    name: Mapped[str]


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as database:
            yield database
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "method", ["create", "create_many", "bulk_insert", "get", "update", "delete", "list", "count"]
)
def test_repository_interface_signatures_can_be_inspected(method: str):
    assert "self" in signature(getattr(RepositoryInterface, method)).parameters


def test_crud_persists_changes_and_preserves_return_values(session: Session):
    repository = Repository(session, Item)
    assert isinstance(repository, RepositoryInterface)
    item = Item(uid=uuid4(), name="Original")
    assert repository.create(item) is item
    assert repository.get(item.uid) is item
    replacement = Item(uid=item.uid, name="Updated", rank=2)
    assert repository.update(replacement) is replacement
    session.expire_all()
    assert repository.get(item.uid).name == "Updated"
    uid = item.uid
    repository.delete(uid)
    assert repository.count(None) == 0
    with Session(session.get_bind()) as other_session:
        assert Repository(other_session, Item).count(None) == 0


@pytest.mark.parametrize("batch_size", [0, 1, 3])
def test_create_many_commits_once_and_preserves_orm_identity(session: Session, batch_size: int):
    repository = Repository(session, Item)
    items = [Item(name=f"Item {index}") for index in range(batch_size)]
    pending = Item(name="Already pending")
    session.add(pending)
    commits: list[Session] = []

    @event.listens_for(session, "after_commit")
    def record_commit(committed_session: Session) -> None:
        commits.append(committed_session)

    assert repository.create_many(items) is items
    assert commits == [session]
    assert len({item.uid for item in items}) == batch_size
    for item in items:
        assert isinstance(item.uid, UUID)
        assert inspect(item).persistent
        assert session.get(Item, item.uid) is item

    with Session(session.get_bind()) as other_session:
        persisted = Repository(other_session, Item)
        assert persisted.count(None) == batch_size + 1
        assert persisted.get(pending.uid).name == "Already pending"
        for item in items:
            assert persisted.get(item.uid).name == item.name


def test_create_many_cascades_relationships_and_populates_foreign_keys(session: Session):
    items = [
        Item(name="First", children=[Child(name="One")]),
        Item(name="Second", children=[Child(name="Two"), Child(name="Three")]),
    ]
    assert Repository(session, Item).create_many(items) is items
    for item in items:
        for child in item.children:
            assert isinstance(child.uid, UUID)
            assert child.parent_uid == item.uid
            assert inspect(child).persistent
            assert session.get(Child, child.uid) is child

    with Session(session.get_bind()) as other_session:
        repository = Repository(other_session, Item)
        assert repository.count(None) == 2
        assert Repository(other_session, Child).count(None) == 3
        for item in items:
            loaded = repository.get(item.uid, fetch_relationships=lambda entity: [joinedload(entity.children)])
            assert sorted(child.name for child in loaded.children) == sorted(child.name for child in item.children)


def test_create_many_failure_requires_rollback_and_does_not_partially_persist(session: Session):
    repository = Repository(session, Item)
    duplicate_uid = uuid4()
    items = [Item(uid=duplicate_uid, name="First"), Item(uid=duplicate_uid, name="Duplicate")]

    with pytest.raises(IntegrityError):
        repository.create_many(items)

    assert not session.is_active
    session.rollback()
    with Session(session.get_bind()) as other_session:
        assert Repository(other_session, Item).count(None) == 0

    retry = [Item(name="Retry")]
    assert repository.create_many(retry) is retry
    assert repository.count(None) == 1


@pytest.mark.parametrize("batch_size", [0, 1, 3])
def test_bulk_insert_commits_once_without_loading_entities_or_mutating_rows(session: Session, batch_size: int):
    repository = Repository(session, Item)
    rows: list[dict[str, Any]] = [{"name": f"Item {index}"} for index in range(batch_size)]
    original_rows = [row.copy() for row in rows]
    commits: list[Session] = []

    @event.listens_for(session, "after_commit")
    def record_commit(committed_session: Session) -> None:
        commits.append(committed_session)

    assert repository.bulk_insert(rows) is None
    assert commits == [session]
    assert rows == original_rows
    assert not session.identity_map

    with Session(session.get_bind()) as other_session:
        persisted = Repository(other_session, Item)
        assert persisted.count(None) == batch_size
        items = persisted.list(orderby=[OrderBy(key="name", direction=SortDirection.asc)])
        assert [item.name for item in items] == [row["name"] for row in rows]
        assert len({item.uid for item in items}) == batch_size
        for item in items:
            assert isinstance(item.uid, UUID)
            assert item.rank == 0


def test_bulk_insert_batches_uniform_rows_without_returning(session: Session):
    statements: list[tuple[str, bool]] = []
    connection = session.connection()

    @event.listens_for(connection, "before_cursor_execute")
    def record_statement(connection, cursor, statement, parameters, context, executemany):
        statements.append((statement, executemany))

    Repository(session, Item).bulk_insert([{"name": "First"}, {"name": "Second"}, {"name": "Third"}])
    assert len(statements) == 1
    statement, executemany = statements[0]
    assert statement.startswith("INSERT INTO")
    assert "RETURNING" not in statement.upper()
    assert executemany


def test_bulk_insert_empty_batch_still_commits_other_pending_changes(session: Session):
    pending = Item(name="Already pending")
    session.add(pending)
    Repository(session, Item).bulk_insert([])

    with Session(session.get_bind()) as other_session:
        repository = Repository(other_session, Item)
        assert repository.count(None) == 1
        assert repository.get(pending.uid).name == "Already pending"


def test_bulk_insert_accepts_explicit_ids_and_foreign_key_values(session: Session):
    parent_uid, child_uid = uuid4(), uuid4()
    Repository(session, Item).bulk_insert([{"uid": parent_uid, "name": "Parent", "rank": 5}])
    Repository(session, Child).bulk_insert([{"uid": child_uid, "parent_uid": parent_uid, "name": "Child"}])
    assert not session.identity_map

    with Session(session.get_bind()) as other_session:
        parent = Repository(other_session, Item).get(
            parent_uid, fetch_relationships=lambda entity: [joinedload(entity.children)]
        )
        assert parent.rank == 5
        assert [child.uid for child in parent.children] == [child_uid]


def test_bulk_insert_failure_propagates_and_can_be_rolled_back(session: Session):
    repository = Repository(session, Item)
    duplicate_uid = uuid4()
    rows = [{"uid": duplicate_uid, "name": "First"}, {"uid": duplicate_uid, "name": "Duplicate"}]
    commits: list[Session] = []

    @event.listens_for(session, "after_commit")
    def record_commit(committed_session: Session) -> None:
        commits.append(committed_session)

    with pytest.raises(IntegrityError):
        repository.bulk_insert(rows)

    assert commits == []
    session.rollback()
    with Session(session.get_bind()) as other_session:
        assert Repository(other_session, Item).count(None) == 0

    repository.bulk_insert([{"name": "Retry"}])
    assert commits == [session]
    assert repository.count(None) == 1


@pytest.mark.parametrize("method", ["get", "delete"])
def test_missing_entity_raises_shared_not_found(session: Session, method: str):
    repository = Repository(session, Item)
    with pytest.raises(NotFoundException, match="Item"):
        getattr(repository, method)(uuid4())


def test_list_count_sorting_and_pagination(session: Session):
    repository = Repository(session, Item)
    session.add_all([Item(name="Alpha", rank=2), Item(name="Beta", rank=1), Item(name="Beta", rank=3)])
    session.flush()
    filters = FilterExpression(key="name", operator=FilterOperator.eq, value="Beta")
    ordering = [OrderBy(key="name", direction=SortDirection.asc), OrderBy(key="rank", direction=SortDirection.desc)]
    assert [item.rank for item in repository.list(orderby=ordering)] == [2, 3, 1]
    assert [item.rank for item in repository.list(orderby=ordering, filters=filters, limit=1, offset=1)] == [1]
    assert repository.list(limit=0) == []
    assert repository.list(offset=10) == []
    assert repository.count(filters) == 2
    assert repository.count(FilterExpression(key="name", operator=FilterOperator.eq, value="Missing")) == 0


def test_relationship_filtering_and_eager_loading(session: Session):
    repository = Repository(session, Item)
    item = repository.create(Item(name="Parent", children=[Child(name="One"), Child(name="Two")]))
    uid = item.uid
    session.expunge_all()
    loaded = repository.get(uid, fetch_relationships=lambda entity: [joinedload(entity.children)])
    assert "children" not in inspect(loaded).unloaded
    assert sorted(child.name for child in loaded.children) == ["One", "Two"]
    session.expunge_all()
    filters = FilterExpression(key="children.name", operator=FilterOperator.eq, value="One")
    items = repository.list(filters=filters, fetch_relationships=lambda entity: [joinedload(entity.children)])
    assert len(items) == 1
    assert len(items[0].children) == 2
    assert repository.count(filters) == 1


def test_update_can_insert_and_does_not_return_merged_instance(session: Session):
    repository = Repository(session, Item)
    item = Item(uid=uuid4(), name="New", rank=1)
    assert repository.update(item) is item
    assert repository.get(item.uid) is not item
    assert repository.count(None) == 1


def test_repository_has_no_faceting_api():
    assert not hasattr(Repository, "facet_counts")
    assert not hasattr(Repository, "resolve_query")
