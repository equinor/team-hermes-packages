import pytest
from sqlalchemy import Column, ForeignKey, Integer, String, cast, create_engine, func, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, declarative_base, relationship
from team_hermes.core import ValidationException
from team_hermes.query import (
    FilterExpression,
    FilterOperator,
    LogicalFilter,
    LogicalOperator,
)

from team_hermes.sqlalchemy_core.filtering import apply_filters

Base = declarative_base()


class TestEntity(Base):
    __test__ = False
    __tablename__ = "test_entity"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    value = Column(Integer)


class ChildEntity(Base):
    __test__ = False
    __tablename__ = "child_entity"
    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("parent_entity.id"))
    name = Column(String)
    grandchildren = relationship("GrandchildEntity", uselist=True)


class GrandchildEntity(Base):
    __test__ = False
    __tablename__ = "grandchild_entity"
    id = Column(Integer, primary_key=True)
    child_id = Column(Integer, ForeignKey("child_entity.id"))
    label = Column(String)


class ParentEntity(Base):
    __test__ = False
    __tablename__ = "parent_entity"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    children = relationship("ChildEntity", uselist=True)
    only_child = relationship("ChildEntity", uselist=False, viewonly=True)


def test_apply_filter_expression_eq():
    filters = FilterExpression(key="name", operator=FilterOperator.eq, value="Item 1")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name == "Item 1"))


def test_apply_filter_expression_gt():
    filters = FilterExpression(key="value", operator=FilterOperator.gt, value=15)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.value > 15))


def test_apply_filter_expression_lt():
    filters = FilterExpression(key="value", operator=FilterOperator.lt, value=15)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.value < 15))


def test_apply_filter_expression_gte():
    filters = FilterExpression(key="value", operator=FilterOperator.gte, value=15)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.value >= 15))


def test_apply_filter_expression_lte():
    filters = FilterExpression(key="value", operator=FilterOperator.lte, value=15)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.value <= 15))


def test_apply_filter_expression_ne():
    filters = FilterExpression(key="name", operator=FilterOperator.neq, value="Item 1")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name != "Item 1"))


def test_apply_filter_expression_like():
    filters = FilterExpression(key="name", operator=FilterOperator.like, value="Item%")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(cast(TestEntity.name, String).like("Item%")))


def test_apply_filter_expression_not_like():
    filters = FilterExpression(key="name", operator=FilterOperator.ilike, value="Item%")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(cast(TestEntity.name, String).ilike("Item%")))


def test_apply_filter_expression_inlist():
    filters = FilterExpression(key="name", operator=FilterOperator.inlist, value="Item 1,Item 2")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name.in_(["Item 1", "Item 2"])))


def test_apply_filter_expression_notinlist():
    filters = FilterExpression(key="name", operator=FilterOperator.notinlist, value="Item 1,Item 2")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name.notin_(["Item 1", "Item 2"])))


def test_apply_filter_expression_isnull():
    filters = FilterExpression(key="name", operator=FilterOperator.isnull, value=None)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name.is_(None)))


def test_apply_filter_expression_notnull():
    filters = FilterExpression(key="name", operator=FilterOperator.notnull, value=None)
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name.isnot(None)))


def test_apply_filter_expression_contains():
    filters = FilterExpression(key="name", operator=FilterOperator.contains, value="Item")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(TestEntity.name.contains("Item")))


def test_apply_filter_expression_notcontains():
    filters = FilterExpression(key="name", operator=FilterOperator.notcontains, value="Item")
    query = apply_filters(TestEntity, select(TestEntity), filters)
    assert str(query) == str(select(TestEntity).where(~TestEntity.name.contains("Item")))


def test_apply_logical_filter_and():
    filters = LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="Item"),
            FilterExpression(key="value", operator=FilterOperator.gt, value=15),
        ],
    )

    query = apply_filters(TestEntity, select(TestEntity), filters)
    expected_query = select(TestEntity).where((TestEntity.name == "Item") & (TestEntity.value > 15))
    assert str(query) == str(expected_query)


def test_apply_logical_filter_or():
    filters = LogicalFilter(
        operator=LogicalOperator.or_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="Item 1"),
            FilterExpression(key="value", operator=FilterOperator.lt, value=30),
        ],
    )

    query = apply_filters(TestEntity, select(TestEntity), filters)
    expected_query = select(TestEntity).where((TestEntity.name == "Item 1") | (TestEntity.value < 30))
    assert str(query) == str(expected_query)


def test_apply_logical_filter_nested():
    filters = LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="Item 1"),
            LogicalFilter(
                operator=LogicalOperator.or_,
                filters=[
                    FilterExpression(key="value", operator=FilterOperator.lt, value=30),
                    FilterExpression(key="value", operator=FilterOperator.gt, value=15),
                ],
            ),
        ],
    )

    query = apply_filters(TestEntity, select(TestEntity), filters)
    expected_query = select(TestEntity).where(
        (TestEntity.name == "Item 1") & ((TestEntity.value < 30) | (TestEntity.value > 15))
    )
    assert str(query) == str(expected_query)


# --- Nested / relationship filter tests ---


def test_apply_filter_one_to_many_relationship_uses_any():
    filters = FilterExpression(key="children.name", operator=FilterOperator.eq, value="Alice")
    query = apply_filters(ParentEntity, select(ParentEntity), filters)
    expected_query = select(ParentEntity).where(ParentEntity.children.any(ChildEntity.name == "Alice"))
    assert str(query) == str(expected_query)


def test_apply_filter_to_one_relationship_uses_has():
    filters = FilterExpression(key="only_child.name", operator=FilterOperator.eq, value="Bob")
    query = apply_filters(ParentEntity, select(ParentEntity), filters)
    expected_query = select(ParentEntity).where(ParentEntity.only_child.has(ChildEntity.name == "Bob"))
    assert str(query) == str(expected_query)


def test_apply_filter_relationship_with_numeric_operator():
    filters = FilterExpression(key="children.id", operator=FilterOperator.gt, value=5)
    query = apply_filters(ParentEntity, select(ParentEntity), filters)
    expected_query = select(ParentEntity).where(ParentEntity.children.any(ChildEntity.id > 5))
    assert str(query) == str(expected_query)


def test_apply_filter_invalid_nested_key_raises_validation_error():
    filters = FilterExpression(key="children.nonexistent", operator=FilterOperator.eq, value="x")
    with pytest.raises(ValidationException, match="not found"):
        apply_filters(ParentEntity, select(ParentEntity), filters)


def test_apply_filter_invalid_top_level_key_raises_validation_error():
    filters = FilterExpression(key="nonexistent", operator=FilterOperator.eq, value="x")
    with pytest.raises(ValidationException, match="not found"):
        apply_filters(ParentEntity, select(ParentEntity), filters)


# --- Multi-hop relationship filter tests ---


def test_apply_filter_multi_hop_relationship_nests_any():
    filters = FilterExpression(key="children.grandchildren.label", operator=FilterOperator.eq, value="X")
    query = apply_filters(ParentEntity, select(ParentEntity), filters)
    expected_query = select(ParentEntity).where(
        ParentEntity.children.any(ChildEntity.grandchildren.any(GrandchildEntity.label == "X"))
    )
    assert str(query) == str(expected_query)


def test_apply_filter_multi_hop_with_has_and_any():
    filters = FilterExpression(key="only_child.grandchildren.label", operator=FilterOperator.eq, value="Y")
    query = apply_filters(ParentEntity, select(ParentEntity), filters)
    expected_query = select(ParentEntity).where(
        ParentEntity.only_child.has(ChildEntity.grandchildren.any(GrandchildEntity.label == "Y"))
    )
    assert str(query) == str(expected_query)


@pytest.mark.parametrize(
    ("operator", "value", "expected"),
    [
        (FilterOperator.eq, "Alpha", [1]),
        (FilterOperator.neq, "Alpha", [2]),
        (FilterOperator.like, "Al*", [1]),
        (FilterOperator.ilike, "al?", [1]),
        (FilterOperator.notlike, "Al*", [2]),
        (FilterOperator.notilike, "al*", [2]),
        (FilterOperator.contains, "ph", [1]),
        (FilterOperator.notcontains, "ph", [2]),
        (FilterOperator.starts_with, "Al", [1]),
        (FilterOperator.ends_with, "ta", [2]),
        (FilterOperator.inlist, "Alpha,Beta", [1, 2]),
        (FilterOperator.notinlist, "Alpha", [2]),
        (FilterOperator.inlist, "Alpha, Beta", [1]),
        (FilterOperator.isnull, None, [3]),
        (FilterOperator.notnull, None, [1, 2]),
        (FilterOperator.eq, None, [3]),
        (FilterOperator.eq, "Alpha' OR 1=1 --", []),
        (FilterOperator.like, "Al_ha", []),
    ],
)
def test_bound_filter_values_execute_on_sqlite(operator, value, expected):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            session.add_all(
                [
                    TestEntity(id=1, name="Alpha", value=10),
                    TestEntity(id=2, name="Beta", value=20),
                    TestEntity(id=3, name=None, value=30),
                ]
            )
            filters = FilterExpression(key="name", operator=operator, value=value)
            query = apply_filters(TestEntity, select(TestEntity.id).order_by(TestEntity.id), filters)
            assert list(session.scalars(query)) == expected
    finally:
        engine.dispose()


def test_existing_query_and_multiple_selected_columns_are_preserved():
    original = (
        select(TestEntity.id, TestEntity.name).where(TestEntity.value > 10).order_by(TestEntity.id).limit(2).offset(1)
    )
    filters = FilterExpression(key="name", operator=FilterOperator.eq, value="Alpha")
    compiled = apply_filters(TestEntity, original, filters).compile(dialect=postgresql.dialect())
    assert compiled.params["name_1"] == "Alpha"
    assert compiled.params["value_1"] == 10
    assert "ORDER BY" in str(compiled)
    assert "LIMIT" in str(compiled)
    assert "OFFSET" in str(compiled)
    assert "name_1" not in original.compile().params
    assert apply_filters(TestEntity, original, None) is original
    count_query = apply_filters(TestEntity, select(func.count()).select_from(TestEntity), filters)
    assert count_query.compile().params == {"name_1": "Alpha"}


@pytest.mark.parametrize("operator", [FilterOperator.ilike, FilterOperator.notilike])
def test_postgresql_pattern_compilation(operator):
    filters = FilterExpression(key="name", operator=operator, value="A_*?")
    compiled = apply_filters(TestEntity, select(TestEntity), filters).compile(dialect=postgresql.dialect())
    assert "ILIKE" in str(compiled)
    assert list(compiled.params.values()) == ["%A__%_%"]
