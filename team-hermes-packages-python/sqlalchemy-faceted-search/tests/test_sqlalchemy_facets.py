from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import Select, create_engine, distinct, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from team_hermes.query import (
    FilterExpression,
    FilterOperator,
    LogicalFilter,
    LogicalOperator,
)

from team_hermes.sqlalchemy_faceted_search.faceting import (
    FacetConfig,
    FacetCountsResponse,
    serialize_value,
)
from team_hermes.sqlalchemy_faceted_search.faceting.facet_config import (
    _remove_facet_from_filters as remove_facet_from_filters,
)

# ---------------------------------------------------------------------------
# serialize_value
# ---------------------------------------------------------------------------


class TestSerializeValue:
    def test_none_returns_null(self):
        assert serialize_value(None) == "null"

    def test_true_returns_lowercase(self):
        assert serialize_value(True) == "true"

    def test_false_returns_lowercase(self):
        assert serialize_value(False) == "false"

    def test_string_passthrough(self):
        assert serialize_value("hello") == "hello"

    def test_integer_to_string(self):
        assert serialize_value(42) == "42"


# ---------------------------------------------------------------------------
# remove_facet_from_filters
# ---------------------------------------------------------------------------


class TestRemoveFacetFromFilters:
    def test_none_returns_none(self):
        assert remove_facet_from_filters(None, "type") is None

    def test_matching_expression_removed(self):
        f = FilterExpression(key="type", operator=FilterOperator.eq, value="report")
        assert remove_facet_from_filters(f, "type") is None

    def test_non_matching_expression_kept(self):
        f = FilterExpression(key="status", operator=FilterOperator.eq, value="draft")
        assert remove_facet_from_filters(f, "type") is f

    def test_logical_all_removed_returns_none(self):
        f = LogicalFilter(
            operator=LogicalOperator.and_,
            filters=[
                FilterExpression(key="type", operator=FilterOperator.eq, value="a"),
                FilterExpression(key="type", operator=FilterOperator.eq, value="b"),
            ],
        )
        assert remove_facet_from_filters(f, "type") is None

    def test_logical_one_remaining_unwrapped(self):
        keep = FilterExpression(key="status", operator=FilterOperator.eq, value="draft")
        f = LogicalFilter(
            operator=LogicalOperator.and_,
            filters=[
                FilterExpression(key="type", operator=FilterOperator.eq, value="a"),
                keep,
            ],
        )
        assert remove_facet_from_filters(f, "type") is keep

    def test_logical_multiple_remaining_kept(self):
        f = LogicalFilter(
            operator=LogicalOperator.or_,
            filters=[
                FilterExpression(key="status", operator=FilterOperator.eq, value="a"),
                FilterExpression(key="name", operator=FilterOperator.eq, value="b"),
                FilterExpression(key="type", operator=FilterOperator.eq, value="c"),
            ],
        )
        result = remove_facet_from_filters(f, "type")
        assert isinstance(result, LogicalFilter)
        assert len(result.filters) == 2

    def test_nested_logical_filters(self):
        inner = LogicalFilter(
            operator=LogicalOperator.and_,
            filters=[
                FilterExpression(key="type", operator=FilterOperator.eq, value="a"),
                FilterExpression(key="status", operator=FilterOperator.eq, value="b"),
            ],
        )
        outer = LogicalFilter(operator=LogicalOperator.or_, filters=[inner])
        result = remove_facet_from_filters(outer, "type")
        # inner collapses to single expression, outer collapses to that expression
        assert isinstance(result, FilterExpression)
        assert result.key == "status"


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str | None]
    tenant: Mapped[int]


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as database:
            database.add_all(
                [
                    Item(category="Alpha", tenant=1),
                    Item(category="Alpha", tenant=1),
                    Item(category="Beta", tenant=1),
                    Item(category=None, tenant=1),
                    Item(category="Beta", tenant=2),
                ]
            )
            database.flush()
            yield database
    finally:
        engine.dispose()


def _execute_counts(session: Session, query: Select) -> dict[Any, int]:
    counts: dict[Any, int] = {}
    for value, count in session.execute(query):
        counts[value] = count
    return counts


def test_facet_counts_execute_with_nulls(session: Session):
    rows = session.execute(FacetConfig().resolve_query("category", Item))
    response = FacetCountsResponse(facets={"category": {serialize_value(value): count for value, count in rows}})
    assert response.facets == {"category": {"Alpha": 2, "Beta": 2, "null": 1}}


def test_cross_filter_exclusions_preserve_original_tree(session: Session):
    filters = LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            FilterExpression(key="category", operator=FilterOperator.eq, value="Alpha"),
            FilterExpression(key="tenant", operator=FilterOperator.eq, value=1),
        ],
    )
    original = filters.model_dump()
    query = FacetConfig().resolve_query("category", Item, filters)
    assert _execute_counts(session, query) == {"Alpha": 2, "Beta": 1, None: 1}
    query = FacetConfig(cross_filter_exclusions=["tenant"]).resolve_query("category", Item, filters)
    assert _execute_counts(session, query) == {"Alpha": 2, "Beta": 2, None: 1}
    assert filters.model_dump() == original


def test_scope_is_not_removed_with_facet_filter(session: Session):
    filters = FilterExpression(key="tenant", operator=FilterOperator.eq, value=2)
    query = FacetConfig(scope=Item.tenant == 1).resolve_query("tenant", Item, filters)
    assert _execute_counts(session, query) == {1: 4}


def test_custom_column_and_empty_results(session: Session):
    config = FacetConfig(column_override=func.coalesce(Item.category, "missing"))
    assert _execute_counts(session, config.resolve_query("label", Item)) == {
        "Alpha": 2,
        "Beta": 2,
        "missing": 1,
    }
    filters = FilterExpression(key="tenant", operator=FilterOperator.eq, value=99)
    assert session.execute(config.resolve_query("label", Item, filters)).all() == []


def test_custom_query_replaces_default_scope_and_column(session: Session):
    config = FacetConfig(
        build_query=lambda entity: select(entity.category, func.count(distinct(entity.tenant))).group_by(
            entity.category
        ),
        column_override=Item.tenant,
        scope=Item.tenant == 99,
    )
    assert _execute_counts(session, config.resolve_query("category", Item)) == {
        "Alpha": 1,
        "Beta": 2,
        None: 1,
    }
    filters = FilterExpression(key="tenant", operator=FilterOperator.eq, value=1)
    assert _execute_counts(session, config.resolve_query("category", Item, filters)) == {
        "Alpha": 1,
        "Beta": 1,
        None: 1,
    }


def test_unknown_facet_preserves_attribute_error():
    with pytest.raises(AttributeError):
        FacetConfig().resolve_query("missing", Item)
