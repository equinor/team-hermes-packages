from collections.abc import Iterator
from inspect import signature
from uuid import UUID, uuid4

import pytest
from sqlalchemy import ForeignKey, create_engine, inspect
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


@pytest.mark.parametrize("method", ["create", "get", "update", "delete", "list", "count"])
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
