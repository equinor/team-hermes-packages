"""Pure request construction: scoping, traversal order and page parameters, without any I/O."""

from typing import Any
from unittest.mock import patch

import pytest
from elasticsearch.dsl import Q, Search

from team_hermes.elasticsearch import (
    NumericHistogramFacet,
    RangeFilter,
    SearchDefinition,
    SearchRequest,
    TermsFacet,
)
from team_hermes.elasticsearch.elasticsearch import (
    _build_histogram_bounds_request,
    _build_search,
    compose_query,
)
from team_hermes.elasticsearch.facet_plan import FacetPlan
from team_hermes.elasticsearch.filters import FacetKind, Filter, queries_excluding
from team_hermes.elasticsearch.pagination import (
    BACKWARD,
    Cursor,
    CursorPagination,
    OffsetPagination,
    Pagination,
    _WindowProbe,
)
from team_hermes.elasticsearch.sort import SortClause
from tests.search_test_helpers import StubSearchClient


@pytest.fixture
def sort() -> tuple[SortClause, ...]:
    """Stable public ID sort for request construction."""
    return (SortClause(field="id", order="asc", missing="_last"),)


@pytest.fixture
def sort_payload() -> list[dict[str, dict[str, str]]]:
    """Independent expected serialization of the forward ID sort."""
    return [{"id": {"order": "asc", "missing": "_last"}}]


@pytest.mark.parametrize(("field", "lower"), [("price", 0.0), ("created", "2020-01-01")])
def test_structured_bounds_bind_to_inferred_numeric_and_date_facets(
    field: str, lower: float | str, client: StubSearchClient
) -> None:
    definition = SearchDefinition.from_mapping({"price": {"type": "float"}, "created": {"type": "date"}})
    request = SearchRequest(ranges={field: RangeFilter(min=lower)})

    result = (
        definition.search()
        .using(client)
        .index("items")
        .apply_request(request)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )

    assert request.ranges[field] == RangeFilter(min=lower)
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"range": {field: {"gte": lower}}}]
    assert "aggs" not in client.calls[0]
    assert (result.hits, result.total, result.facets) == ([], None, [])


def test_permanent_filters_are_kept_beside_the_user_query() -> None:
    assert compose_query(None).to_dict() == {"match_all": {}}
    assert compose_query(None, (Q("term", tenant="one"),)).to_dict() == {
        "bool": {"must": [{"match_all": {}}], "filter": [{"term": {"tenant": "one"}}]}
    }


def test_bounds_request_batches_stats_and_excludes_only_each_targets_range_without_io() -> None:
    price = NumericHistogramFacet(field="price", name="price_distribution")
    weight = NumericHistogramFacet(field="weight")
    brand = TermsFacet(field="brand")
    price_term = Filter(field="price", kind=FacetKind.TERM, query=Q("term", price="10"))
    plan = FacetPlan.from_inputs(
        definitions=(brand, price, weight),
        terms={"brand": ["A"]},
        ranges={
            "price_distribution": RangeFilter(min=10, max=20),
            "weight": RangeFilter(min=1, max=2),
        },
    )
    filters = (*plan.filters, price_term)
    base_query = Q("bool", must=[Q("match", title="core")], filter=[Q("term", tenant="one")])

    with patch.object(Search, "execute", side_effect=AssertionError("Construction must not execute")) as execute:
        request = _build_histogram_bounds_request(base_query, (price, weight), filters)

    execute.assert_not_called()
    body = request.to_dict()
    assert body["query"] == base_query.to_dict()
    assert body["size"] == 0
    assert body["track_total_hits"] is False
    assert "post_filter" not in body
    assert set(body["aggs"]) == {"prefetch_price_distribution", "prefetch_weight"}
    assert body["aggs"]["prefetch_price_distribution"]["filter"]["bool"]["filter"] == [
        {"terms": {"brand": ["A"]}},
        {"range": {"weight": {"gte": 1, "lte": 2}}},
        {"term": {"price": "10"}},
    ]
    assert body["aggs"]["prefetch_weight"]["filter"]["bool"]["filter"] == [
        {"terms": {"brand": ["A"]}},
        {"range": {"price": {"gte": 10, "lte": 20}}},
        {"term": {"price": "10"}},
    ]
    assert body["aggs"]["prefetch_price_distribution"]["aggs"] == {"stats": {"stats": {"field": "price"}}}
    assert body["aggs"]["prefetch_weight"]["aggs"] == {"stats": {"stats": {"field": "weight"}}}


def test_main_request_is_assembled_without_io(
    sort: tuple[SortClause, ...], sort_payload: list[dict[str, dict[str, str]]]
) -> None:
    base_query = compose_query(Q("match", title="core"), (Q("term", tenant="one"),))
    selection = Filter(field="brand", kind=FacetKind.TERM, query=Q("term", brand="A"))
    facet = TermsFacet(field="brand", name="brands")
    key, aggregation = facet.build_agg((selection,))
    assert key == "brands"
    aggregations = {key: aggregation}

    with patch.object(Search, "execute", side_effect=AssertionError("Building must not execute")) as execute:
        search = _build_search(
            "items",
            base_query,
            pagination=OffsetPagination(offset=20, page_size=10),
            filters=(selection,),
            aggregations=aggregations,
            sort=sort,
        )

    execute.assert_not_called()
    assert search._index == ["items"]
    assert search.to_dict() == {
        "query": base_query.to_dict(),
        # Interactive selections filter hits only; the facet's own agg excludes them.
        "post_filter": {"bool": {"filter": [{"term": {"brand": "A"}}]}},
        "aggs": {name: agg.to_dict() for name, agg in aggregations.items()},
        "sort": sort_payload,
        "from": 20,
        "size": 10,
        "track_total_hits": True,
    }


@pytest.mark.parametrize(
    ("pagination", "expected"),
    [
        (
            OffsetPagination(offset=20, page_size=10),
            {"from": 20, "size": 10, "sort": [{"id": {"order": "asc", "missing": "_last"}}]},
        ),
        (
            OffsetPagination(page_size=0),
            {"from": 0, "size": 0, "sort": [{"id": {"order": "asc", "missing": "_last"}}]},
        ),
        (
            CursorPagination(cursor=Cursor(anchor=(20,)), page_size=10),
            {"search_after": [20], "size": 10, "sort": [{"id": {"order": "asc", "missing": "_last"}}]},
        ),
        # Backward paging reverses the request order; the engine re-reverses the hits.
        (
            CursorPagination(cursor=Cursor(anchor=(20,), direction=BACKWARD), page_size=10),
            {"search_after": [20], "size": 10, "sort": [{"id": {"order": "desc", "missing": "_first"}}]},
        ),
        (
            _WindowProbe(requested_offset=10_000, page_size=10),
            {"from": 0, "size": 0, "sort": [{"id": {"order": "asc", "missing": "_last"}}]},
        ),
    ],
)
def test_page_state_becomes_mutually_exclusive_parameters(
    pagination: Pagination, expected: dict[str, Any], sort: tuple[SortClause, ...]
) -> None:
    search = _build_search(
        "items", Q("match_all"), pagination=pagination, aggregations={}, sort=sort, track_exact_total=False
    )

    body = search.to_dict()
    assert {key: body[key] for key in expected} == expected
    assert "search_after" in body or "from" in body
    assert not ("search_after" in body and "from" in body)
    assert sort == (SortClause(field="id", order="asc", missing="_last"),)


@pytest.mark.parametrize("backward", [False, True])
def test_sort_serialization_preserves_field_order_missing_options_and_configuration(backward: bool) -> None:
    clauses = (
        SortClause(field="_score", order="desc"),
        SortClause(field="price", order="asc", missing="_last"),
        SortClause(field="label", order="desc", missing="_first"),
        SortClause(field="id", order="asc", missing="unknown"),
    )
    pagination = (
        CursorPagination(
            page_size=10,
            cursor=Cursor(anchor=(1.5, None, None, "id"), direction=BACKWARD),
        )
        if backward
        else OffsetPagination(page_size=10)
    )

    body = _build_search("items", Q("match_all"), pagination=pagination, aggregations={}, sort=clauses).to_dict()

    assert body["sort"] == [
        {"_score": {"order": "asc" if backward else "desc"}},
        {"price": {"order": "desc" if backward else "asc", "missing": "_first" if backward else "_last"}},
        {"label": {"order": "asc" if backward else "desc", "missing": "_last" if backward else "_first"}},
        {"id": {"order": "desc" if backward else "asc", "missing": "unknown"}},
    ]
    forward = _build_search(
        "items", Q("match_all"), pagination=OffsetPagination(page_size=10), aggregations={}, sort=clauses
    )
    assert forward.to_dict()["sort"][0] == {"_score": {"order": "desc"}}
    assert clauses[1] == SortClause(field="price", order="asc", missing="_last")


@pytest.mark.parametrize("track_exact_total", [False, True])
def test_total_tracking_is_independent_of_aggregations(track_exact_total: bool) -> None:
    search = _build_search(
        "items",
        Q("match_all"),
        pagination=OffsetPagination(page_size=10),
        aggregations={},
        track_exact_total=track_exact_total,
    )

    assert search.to_dict()["track_total_hits"] is track_exact_total
    assert "aggs" not in search.to_dict()


def test_queries_excluding_matches_both_field_and_kind_without_mutating_filters() -> None:
    price_range = Filter(field="price", kind=FacetKind.RANGE, query=Q("range", price={"gte": 10}))
    price_term = Filter(field="price", kind=FacetKind.TERM, query=Q("term", price="10"))
    weight_range = Filter(field="weight", kind=FacetKind.RANGE, query=Q("range", weight={"gte": 1}))
    filters = (price_range, price_term, weight_range)

    queries = queries_excluding(filters, field="price", kind=FacetKind.RANGE)

    assert queries == [price_term.query, weight_range.query]
    assert filters == (price_range, price_term, weight_range)
    assert queries_excluding((), field="price", kind=FacetKind.RANGE) == []
