"""Fluent cursor navigation and offset-window boundaries with fake Elasticsearch I/O."""

from dataclasses import replace

import pytest
from elasticsearch.dsl import Q

from team_hermes.elasticsearch import (
    BACKWARD,
    CardinalityAggregation,
    Cursor,
    Cursors,
    NumericHistogramFacet,
    ResultWindowError,
    SearchDefinition,
    SearchRequest,
    SortClause,
    SortOrder,
)
from team_hermes.elasticsearch.errors import InvalidCursorError, InvalidSearchRequestError
from tests.faceted_search.search_test_helpers import StubSearchClient


def test_backward_cursor_restores_display_order_and_named_neighbors(
    definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(
        total=3, hits=[{"_id": str(number), "_source": {}, "sort": [number]} for number in (2, 1)]
    )
    result = (
        definition.search()
        .using(client)
        .index("items")
        .sort("id")
        .cursor_page(Cursor(anchor=(3,), direction=BACKWARD).encode(), size=2, display_page=2)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )
    assert [hit.meta.id for hit in result.hits] == ["1", "2"]
    assert client.calls[0]["sort"] == [{"id": {"order": "desc", "missing": "_first"}}]
    assert client.calls[0]["search_after"] == [3]
    assert "from" not in client.calls[0]
    assert result.cursors.prev == Cursor(anchor=(1,), direction=BACKWARD)
    assert result.cursors.next == Cursor(anchor=(2,))


@pytest.mark.parametrize("order", ["asc", "desc"])
def test_backward_default_sort_crosses_the_missing_value_boundary(order: SortOrder) -> None:
    valued_hits = [
        {"_id": "first", "_source": {"label": "a"}, "sort": ["a", "first"]},
        {"_id": "second", "_source": {"label": "b"}, "sort": ["b", "second"]},
    ]
    if order == "desc":
        valued_hits.reverse()
    missing_hits = [
        {"_id": "missing-1", "_source": {}, "sort": [None, "missing-1"]},
        {"_id": "missing-2", "_source": {}, "sort": [None, "missing-2"]},
    ]
    client = StubSearchClient(total=4, hits=valued_hits)
    query = (
        SearchDefinition()
        .with_sorting(
            default=(SortClause(field="label", order=order),),
            tiebreakers=(SortClause(field="id", order="asc"),),
        )
        .search()
        .using(client)
        .index("items")
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    first = query.offset_page(size=2).execute()
    assert first.cursors.next is not None
    assert client.calls[0]["sort"] == [{"label": {"order": order}}, {"id": {"order": "asc"}}]

    client.hits = missing_hits
    second = query.cursor_page(first.cursors.next, size=2).execute()
    assert second.cursors.prev == Cursor(anchor=(None, "missing-1"), direction=BACKWARD)
    assert second.cursors.prev is not None

    client.hits = list(reversed(valued_hits))
    backward = query.cursor_page(second.cursors.prev, size=2).execute()
    assert client.calls[2]["sort"] == [
        {"label": {"order": "desc" if order == "asc" else "asc", "missing": "_first"}},
        {"id": {"order": "desc", "missing": "_first"}},
    ]
    assert client.calls[2]["search_after"] == [None, "missing-1"]
    assert [hit.meta.id for hit in backward.hits] == [hit.meta.id for hit in first.hits]
    assert backward.cursors.next == first.cursors.next


@pytest.mark.parametrize("order", ["asc", "desc"])
@pytest.mark.parametrize("hits_only", [False, True])
def test_cursor_round_trip_preserves_navigation_after_page_size_change(
    order: SortOrder, hits_only: bool, definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    hits = [{"_id": str(number), "_source": {}, "sort": [number]} for number in range(1, 5)]
    if order == "desc":
        hits.reverse()
    client = search_client_factory(total=4, hits=hits[:2])
    query = (
        definition.search()
        .using(client)
        .index("items")
        .sort("id", order)
        .with_aggregations(enabled=not hits_only)
        .with_exact_total(enabled=not hits_only)
    )
    first = query.offset_page(size=2).execute()
    assert first.cursors.prev is None
    next_cursor = first.cursors.next
    assert next_cursor is not None
    assert client.calls[0]["from"] == 0
    assert "search_after" not in client.calls[0]

    client.hits = hits[2:]
    second = query.cursor_page(next_cursor, size=2).execute()
    prev_cursor = second.cursors.prev
    assert prev_cursor is not None
    assert client.calls[1]["search_after"] == hits[1]["sort"]

    # Increasing page size makes the backward response short at the beginning.
    client.hits = list(reversed(hits[:2]))
    backward = query.cursor_page(prev_cursor, size=3).execute()
    assert [hit.meta.id for hit in backward.hits] == [hit.meta.id for hit in first.hits]
    assert backward.cursors.prev is None
    assert backward.cursors.next == first.cursors.next
    next_cursor = backward.cursors.next
    assert next_cursor is not None
    assert client.calls[2]["search_after"] == hits[2]["sort"]
    assert client.calls[2]["sort"] == [{"id": {"order": "desc" if order == "asc" else "asc", "missing": "_first"}}]

    client.hits = hits[2:]
    resumed = query.cursor_page(next_cursor, size=2).execute()
    assert [hit.meta.id for hit in resumed.hits] == [hit.meta.id for hit in second.hits]
    assert client.calls[3]["search_after"] == hits[1]["sort"]
    assert all("from" not in body for body in client.calls[1:])


@pytest.mark.parametrize("hits_only", [False, True])
@pytest.mark.parametrize("cursor", [Cursor(anchor=(1,)), Cursor(anchor=(1,)).encode()])
def test_cursor_without_sort_is_rejected_before_io(
    hits_only: bool, cursor: Cursor | str, client: StubSearchClient
) -> None:
    definition = SearchDefinition(facets=(NumericHistogramFacet(field="price"),))
    query = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets("price")
        .cursor_page(cursor)
        .with_aggregations(enabled=not hits_only)
        .with_exact_total(enabled=not hits_only)
    )

    with pytest.raises(ValueError, match="Cursor pagination requires an explicit stable sort"):
        query.execute()

    assert client.calls == []


@pytest.mark.parametrize("cursor", [Cursor(anchor=(1,)), Cursor(anchor=(1,)).encode()])
def test_cursor_sort_can_be_configured_after_page(
    cursor: Cursor | str, client: StubSearchClient, definition: SearchDefinition
) -> None:
    query = definition.search().using(client).index("items").cursor_page(cursor).sort("id")

    query.execute()

    (body,) = client.calls
    assert body["search_after"] == [1]
    assert body["sort"] == [{"id": {"order": "asc", "missing": "_last"}}]
    assert "from" not in body


@pytest.mark.parametrize("anchor", [(1,), (1, 2, 3)])
@pytest.mark.parametrize("encoded", [False, True])
@pytest.mark.parametrize("hits_only", [False, True])
def test_cursor_anchor_length_is_validated_before_any_io(
    anchor: tuple[int, ...],
    encoded: bool,
    hits_only: bool,
    client: StubSearchClient,
) -> None:
    definition = SearchDefinition(facets=(NumericHistogramFacet(field="price"),)).with_sorting(
        default=(SortClause(field="price", order="asc"),), tiebreakers=(SortClause(field="id", order="asc"),)
    )
    cursor = Cursor(anchor=anchor)
    query = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets("price")
        .cursor_page(cursor.encode() if encoded else cursor)
        .with_aggregations(enabled=not hits_only)
        .with_exact_total(enabled=not hits_only)
    )

    with pytest.raises(InvalidCursorError, match="one value for each sort field"):
        query.execute()

    assert client.calls == []


def test_cursor_anchor_includes_tiebreaker_and_permits_null_sort_values(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    definition = definition.with_sorting(
        default=(SortClause(field="price", order="asc"),), tiebreakers=(SortClause(field="id", order="asc"),)
    )

    definition.search().using(client).index("items").cursor_page(Cursor(anchor=(None, "item-id"))).execute()

    assert client.calls[0]["search_after"] == [None, "item-id"]
    assert client.calls[0]["sort"] == [{"price": {"order": "asc"}}, {"id": {"order": "asc"}}]


@pytest.mark.parametrize("cursor", [Cursor(anchor=(20,)), Cursor(anchor=(20,)).encode()])
def test_cursor_pagination_never_uses_the_offset_window_probe(
    cursor: Cursor | str, client: StubSearchClient, definition: SearchDefinition
) -> None:
    result = (
        definition.search()
        .using(client)
        .index("items")
        .sort("id")
        .cursor_page(cursor, size=2, display_page=10_001)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )
    assert client.calls[0]["search_after"] == [20]
    assert client.calls[0]["size"] == 2
    assert client.calls[0]["track_total_hits"] is False
    assert "from" not in client.calls[0]
    assert result.page == 10_001


def test_offset_page_ending_at_result_window_does_not_probe(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    (
        definition.search()
        .using(client)
        .index("items")
        .offset_page(number=500, size=20)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )
    assert client.calls[0]["from"] == 9_980
    assert client.calls[0]["size"] == 20
    assert client.calls[0]["track_total_hits"] is False


@pytest.mark.parametrize(("aggregations_enabled", "exact_total"), [(True, True), (False, False), (True, False)])
@pytest.mark.parametrize("include_counts", [False, True])
@pytest.mark.parametrize(
    ("number", "size", "total"),
    [(501, 20, 0), (501, 20, 10_000), (501, 20, 10_001), (334, 30, 9_990), (334, 30, 9_991)],
)
def test_deep_offset_probes_exact_total_without_deep_from(
    number: int,
    size: int,
    total: int,
    aggregations_enabled: bool,
    exact_total: bool,
    include_counts: bool,
    definition: SearchDefinition,
    scope: CardinalityAggregation,
    search_client_factory: type[StubSearchClient],
) -> None:
    client = search_client_factory(total=total, aggregations={"scope": {"doc_count": total}})
    query = (
        definition.search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(terms={"category": ["A"]})
        .aggregations(scope)
        .offset_page(number=number, size=size)
        .with_facet_counts(enabled=include_counts)
        .with_aggregations(enabled=aggregations_enabled)
        .with_exact_total(enabled=exact_total)
    )
    if total > (number - 1) * size:
        with pytest.raises(ResultWindowError):
            query.execute()
    else:
        result = query.execute()
        assert result.total == total
        assert result.page == number
        assert result.pages == (total + size - 1) // size
        assert result.aggregation_by(scope).doc_count == total
        assert result.hits == []
        assert result.cursors == Cursors(None, None)
    assert len(client.calls) == 1
    assert client.calls[0]["from"] == 0
    assert client.calls[0]["size"] == 0
    assert "search_after" not in client.calls[0]
    assert client.calls[0]["track_total_hits"] is True
    assert set(client.calls[0]["aggs"]) == {"scope"}
    assert client.calls[0]["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"terms": {"category": ["A"]}}]


@pytest.mark.parametrize(("number", "size"), [(0, 20), (-1, 20), (1, -1), (1, 10_001)])
@pytest.mark.parametrize("cursor_mode", [False, True], ids=["offset", "cursor"])
def test_invalid_page_is_rejected(number: int, size: int, cursor_mode: bool, definition: SearchDefinition) -> None:
    query = definition.search()

    with pytest.raises(ValueError, match="Page number and size"):
        if cursor_mode:
            query.cursor_page(Cursor(anchor=(1,)), display_page=number, size=size)
        else:
            query.offset_page(number=number, size=size)


@pytest.mark.parametrize("cursor", ["opaque", Cursor(anchor=(1,))])
def test_definition_can_disable_cursor_pagination_for_direct_callers(cursor: Cursor | str) -> None:
    definition = SearchDefinition(supports_cursor_pagination=False)

    with pytest.raises(InvalidSearchRequestError, match="Cursor pagination"):
        definition.search().cursor_page(cursor)


def test_offset_only_definition_suppresses_cursors_on_full_sorted_pages(
    definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    definition = replace(definition, supports_cursor_pagination=False)
    client = search_client_factory(
        total=4, hits=[{"_id": str(number), "_source": {}, "sort": [number]} for number in (3, 4)]
    )

    result = definition.search().using(client).index("items").sort("id").offset_page(number=2, size=2).execute()

    assert len(result.hits) == 2
    assert result.cursors == Cursors(prev=None, next=None)
    assert client.calls[0]["from"] == 2
    assert client.calls[0]["size"] == 2
    assert "search_after" not in client.calls[0]


def test_pagination_methods_replace_modes_without_mutating_other_branches(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    base = definition.search().using(client).index("items").sort("id")
    offset = base.offset_page(number=3, size=2)
    resumed = offset.cursor_page(Cursor(anchor=(20,)), size=2, display_page=10_001)
    reset = resumed.offset_page(number=2, size=2)

    offset.execute()
    result = resumed.execute()
    reset.execute()
    base.execute()

    assert client.calls[0]["from"] == 4
    assert "search_after" not in client.calls[0]
    assert client.calls[1]["search_after"] == [20]
    assert client.calls[1]["size"] == 2
    assert "from" not in client.calls[1]
    assert result.page == 10_001
    assert client.calls[2]["from"] == 2
    assert "search_after" not in client.calls[2]
    assert client.calls[3]["from"] == 0


def test_apply_request_preserves_cursor_display_labels(client: StubSearchClient, definition: SearchDefinition) -> None:
    base = definition.search().using(client).index("items").sort("id")
    cursor = Cursor(anchor=(20,))

    applied = base.apply_request(SearchRequest(page=4, per_page=2, cursor=cursor.encode(), sort_by="id")).execute()
    explicit = base.cursor_page(cursor, size=2, display_page=4).execute()

    assert client.calls[0] == client.calls[1]
    assert applied.page == explicit.page == 4


def test_apply_request_without_cursor_resets_previous_cursor_to_offset_pagination(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    base = definition.search().using(client).index("items").sort("id")
    resumed = base.cursor_page(Cursor(anchor=(20,)), size=2)

    applied = resumed.apply_request(SearchRequest(page=4, per_page=2, sort_by="id")).execute()
    explicit = base.offset_page(number=4, size=2).execute()
    resumed.execute()

    assert client.calls[0] == client.calls[1]
    assert client.calls[0]["from"] == 6
    assert "search_after" not in client.calls[0]
    assert client.calls[2]["search_after"] == [20]
    assert applied.page == explicit.page == 4


def test_cursor_pagination_rejects_zero_page_size(definition: SearchDefinition) -> None:
    with pytest.raises(ValueError, match="Page number and size"):
        definition.search().cursor_page(Cursor(anchor=(1,)), size=0)


@pytest.mark.parametrize("number", [-1, 0, 2])
def test_aggregation_only_requests_require_page_one(number: int, definition: SearchDefinition) -> None:
    with pytest.raises(ValueError, match="Aggregation-only searches require page number 1"):
        definition.search().offset_page(number=number, size=0)


def test_malformed_cursor_is_rejected_before_any_io(client: StubSearchClient) -> None:
    query = (
        SearchDefinition(facets=(NumericHistogramFacet(field="price"),))
        .with_sorting(default=(SortClause(field="id", order="asc"),))
        .search()
        .using(client)
        .index("items")
        .aggregate_facets("price")
        .cursor_page("invalid")
    )

    with pytest.raises(InvalidCursorError):
        query.execute()

    assert client.calls == []
