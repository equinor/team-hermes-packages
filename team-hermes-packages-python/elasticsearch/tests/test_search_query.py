"""SearchQuery composition, immutable branches, metadata controls, and execution failures."""

from typing import Any
from unittest.mock import MagicMock

import pytest
from elasticsearch import ApiError, NotFoundError, TransportError
from elasticsearch.dsl import Q

from team_hermes.elasticsearch import (
    CardinalityAggregation,
    DateHistogramFacet,
    DynamicFacetFamily,
    ExistsCountsAggregation,
    FacetBoundsPrefetchError,
    IntegerSumAggregation,
    NumericHistogramFacet,
    RangeFilter,
    ScopeCounts,
    SearchDefinition,
    SearchRequest,
    TermsFacet,
    UnknownFacetError,
)
from team_hermes.elasticsearch.errors import InvalidSearchRequestError
from tests.search_test_helpers import StubSearchClient


def test_branches_do_not_mutate_base_or_execute_during_configuration(
    client: StubSearchClient, definition: SearchDefinition, scope: CardinalityAggregation
) -> None:
    base = definition.search().using(client).index("items").aggregations(scope)
    first = base.aggregate_facets("category").offset_page(number=1, size=1)
    second = (
        base.aggregate_facets("brand")
        .offset_page(number=2, size=1)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    assert client.calls == []
    first.execute()
    second.execute()
    base.execute()
    assert set(client.calls[0]["aggs"]) == {"category", "scope"}
    assert client.calls[1]["from"] == 1
    assert "aggs" not in client.calls[1]
    assert set(client.calls[2]["aggs"]) == {"scope"}
    assert client.calls[2]["from"] == 0
    assert client.calls[2]["size"] == 20


def test_selection_is_snapshotted_and_sort_is_replaceable(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    terms = {"category": ["A"]}
    query = definition.search().using(client).index("items").with_facet_filters(terms=terms).sort("id")
    terms["category"] = ["B"]
    query.execute()
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"terms": {"category": ["A"]}}]
    assert client.calls[0]["sort"] == [{"id": {"order": "asc", "missing": "_last"}}]
    query.with_facet_filters().sort().aggregate_facets("brand").aggregate_facets().execute()
    assert "post_filter" not in client.calls[1]
    assert "sort" not in client.calls[1]
    assert "aggs" not in client.calls[1]


def test_permanent_filters_reach_bounds_hits_metrics_and_picker_counts(
    definition: SearchDefinition, scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=2, aggregations={"prefetch_price": {"stats": {"min": 0, "max": 100}}})
    definition = SearchDefinition(
        facets=(*definition.facets, NumericHistogramFacet(field="price")),
    )
    tenant = Q("term", tenant="one")
    query = (
        definition.search()
        .using(client)
        .index("items")
        .add_base_filter(tenant)
        .add_base_filter(Q("term", active=True))
        .query(Q("match_all"))
        .with_facet_filters(terms={"category": ["A"]}, ranges={"price": RangeFilter(min=10, max=20)})
        .aggregate_facets("category", "price")
        .aggregations(scope)
        .with_facet_counts()
    )
    tenant.tenant = "changed"
    query.execute()
    assert len(client.calls) == 2
    assert client.indices == ["items"] * 2
    for body in client.calls:
        assert body["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}, {"term": {"active": True}}]
    bounds, main = client.calls
    category = {"terms": {"category": ["A"]}}
    price = {"range": {"price": {"gte": 10, "lte": 20}}}
    assert bounds["aggs"]["prefetch_price"]["filter"]["bool"]["filter"] == [category]
    assert main["aggs"]["category"]["filter"]["bool"]["filter"] == [price]
    assert main["aggs"]["scope"]["filter"]["bool"]["filter"] == [category, price]
    assert main["aggs"]["facet_counts"]["filter"]["bool"]["filter"] == [category, price]
    assert bounds["size"] == 0
    assert bounds["track_total_hits"] is False


def test_picker_zero_counts_and_metrics_are_assembled(
    definition: SearchDefinition, scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(
        total=3,
        aggregations={
            "scope": {"doc_count": 3, "card_category": {"value": 2}},
            "facet_counts": {"by_field": {"buckets": {"category": {"doc_count": 0}, "brand": {"doc_count": 3}}}},
        },
    )
    result = (
        definition.search()
        .using(client)
        .index("items")
        .aggregations(scope)
        .offset_page(size=2)
        .with_facet_counts()
        .execute()
    )
    assert {facet.key: facet.count for facet in result.facets} == {"category": 0, "brand": 3}
    assert all(not facet.aggregated for facet in result.facets)
    assert result.aggregation_by(scope).cardinalities == {"category": 2}
    assert (result.total, result.page, result.pages) == (3, 1, 2)


def test_public_presence_metrics_remain_scoped_without_requested_distributions(
    search_client_factory: type[StubSearchClient],
) -> None:
    brand = TermsFacet(field="brand")
    counts = ExistsCountsAggregation.over((brand,))
    client = search_client_factory(
        total=0, aggregations={"facet_counts": {"by_field": {"buckets": {"brand": {"doc_count": 0}}}}}
    )
    result = (
        SearchDefinition(facets=(brand,))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(terms={"brand": ["Acme"]})
        .aggregations(counts)
        .execute()
    )

    assert result.aggregation_by(counts) == {"brand": 0}
    assert all(not facet.aggregated for facet in result.facets)
    (body,) = client.calls
    filters = [{"terms": {"brand": ["Acme"]}}]
    assert body["post_filter"]["bool"]["filter"] == filters
    assert set(body["aggs"]) == {counts.name}
    assert body["aggs"][counts.name]["filter"]["bool"]["filter"] == filters


@pytest.mark.parametrize("value", [42, 0, None])
def test_scalar_metric_lookup_preserves_values(
    value: int | None, definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    metric = IntegerSumAggregation(name="total_measurements", field="measurement_count")
    client = search_client_factory(
        total=2, aggregations={"total_measurements": {"sum_total_measurements": {"value": value}}}
    )
    result = definition.search().using(client).index("items").aggregations(metric).execute()

    total: int | None = result.aggregation_by(metric)

    assert total == value
    assert set(client.calls[0]["aggs"]) == {"total_measurements"}
    assert client.calls[0]["aggs"]["total_measurements"]["aggs"] == {
        "sum_total_measurements": {"sum": {"field": "measurement_count"}}
    }


def test_metric_lookup_rejects_unregistered_handle(client: StubSearchClient, definition: SearchDefinition) -> None:
    result = definition.search().using(client).index("items").execute()

    with pytest.raises(LookupError, match="No aggregation named 'unregistered'"):
        result.aggregation_by(IntegerSumAggregation(name="unregistered", field="measurement_count"))


def test_date_math_bounds_reach_elasticsearch_unchanged(client: StubSearchClient) -> None:
    definition = SearchDefinition(facets=(DateHistogramFacet(field="created", calendar_interval="day"),))

    definition.search().using(client).index("items").with_facet_filters(
        ranges={"created": RangeFilter(min="now-2d", max="now-1d")}
    ).with_aggregations(enabled=False).with_exact_total(enabled=False).execute()

    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"range": {"created": {"gte": "now-2d", "lte": "now-1d"}}}
    ]


@pytest.mark.parametrize("ranges", [{"created": (1, None)}, {"price": ("1", None)}])
def test_static_range_types_are_validated_for_fluent_callers(ranges: dict[str, Any], client: StubSearchClient) -> None:
    definition = SearchDefinition(facets=(DateHistogramFacet(field="created"), NumericHistogramFacet(field="price")))

    with pytest.raises(InvalidSearchRequestError):
        definition.search().using(client).index("items").with_facet_filters(
            ranges={key: RangeFilter(min=bounds[0], max=bounds[1]) for key, bounds in ranges.items()}
        ).with_aggregations(enabled=False).with_exact_total(enabled=False).execute()

    assert client.calls == []


def test_independent_term_selection_keeps_its_keyword_alias(client: StubSearchClient) -> None:
    definition = SearchDefinition(
        facets=(TermsFacet(field="country"), TermsFacet(field="city_name", name="city", keyword=True))
    )
    result = (
        definition.search()
        .using(client)
        .index("items")
        .with_facet_filters(terms={"city": ["Oslo"]})
        .aggregate_facets("city")
        .execute()
    )
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"terms": {"city_name.keyword": ["Oslo"]}}]
    facets = {facet.key: facet for facet in result.facets}
    assert not facets["country"].aggregated
    assert facets["city"].aggregated


@pytest.mark.parametrize(
    ("requested", "hits_only"),
    [(False, False), (True, False), (True, True)],
    ids=["not-requested", "computed-empty", "metadata-disabled"],
)
def test_facet_state_distinguishes_unrequested_empty_and_skipped(
    requested: bool, hits_only: bool, client: StubSearchClient
) -> None:
    definition = SearchDefinition(facets=(TermsFacet(field="brand"),))
    result = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets(*(["brand"] if requested else []))
        .with_aggregations(enabled=not hits_only)
        .with_exact_total(enabled=not hits_only)
        .execute()
    )

    assert ("aggs" in client.calls[0]) is (requested and not hits_only)
    assert result.total == (None if hits_only else 0)
    if hits_only:
        assert result.facets == []
    else:
        (facet,) = result.facets
        assert facet.key == "brand"
        assert facet.kind == "term"
        assert facet.aggregated is requested
        assert facet.buckets == []


@pytest.mark.parametrize("metrics_after_hits_only", [False, True])
def test_hits_only_skips_counts_bounds_and_uncomputed_totals(
    metrics_after_hits_only: bool,
    client: StubSearchClient,
    definition: SearchDefinition,
    scope: CardinalityAggregation,
) -> None:
    query = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets("category")
        .aggregations(scope)
        .with_facet_counts()
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    if metrics_after_hits_only:
        query = query.aggregations(scope)
    result = query.execute()
    assert len(client.calls) == 1
    assert "aggs" not in client.calls[0]
    assert client.calls[0]["track_total_hits"] is False
    assert (result.total, result.pages, result.facets) == (None, None, [])
    with pytest.raises(LookupError, match="not computed"):
        result.aggregation_by(scope)


@pytest.mark.parametrize("number", [1, 501])
@pytest.mark.parametrize("hits_only", [False, True])
def test_missing_index_is_explicit_not_uncomputed(
    hits_only: bool, number: int, definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=0, error=NotFoundError("missing", meta=MagicMock(status=404), body={}))
    result = (
        definition.search()
        .using(client)
        .index("items")
        .offset_page(number=number)
        .with_aggregations(enabled=not hits_only)
        .with_exact_total(enabled=not hits_only)
        .execute()
    )
    assert result.missing_index
    assert result.page == number
    assert (result.total, result.pages, result.hits, result.facets) == (0, 0, [], [])


def test_unexpected_backend_failure_propagates(
    definition: SearchDefinition, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=0, error=RuntimeError("backend unavailable"))
    with pytest.raises(RuntimeError, match="backend unavailable"):
        definition.search().using(client).index("items").execute()


@pytest.mark.parametrize(
    "selections",
    [SearchRequest(terms={"typo": ["A"]}), SearchRequest(ranges={"category": RangeFilter(min=0, max=1)})],
)
def test_unknown_or_wrong_kind_selection_is_rejected_before_io(
    selections: SearchRequest, client: StubSearchClient, definition: SearchDefinition
) -> None:
    with pytest.raises(UnknownFacetError):
        definition.search().using(client).index("items").with_facet_filters(
            terms=selections.terms, ranges=selections.ranges
        ).execute()
    assert client.calls == []


def test_unknown_distribution_reports_known_facets_before_io(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    query = definition.search().using(client).index("items")
    with pytest.raises(UnknownFacetError, match="typo") as error:
        query.aggregate_facets("typo").execute()
    assert set(error.value.known) == {"category", "brand"}
    assert client.calls == []


@pytest.mark.parametrize(
    ("has_client", "has_index"),
    [(False, False), (False, True), (True, False)],
    ids=["missing-both", "missing-client", "missing-index"],
)
def test_client_and_index_are_required_before_io(
    has_client: bool, has_index: bool, client: StubSearchClient, definition: SearchDefinition
) -> None:
    query = definition.search()
    if has_client:
        query = query.using(client)
    if has_index:
        query = query.index("items")

    with pytest.raises(ValueError, match=r"Set using\(client\) and index\(name\)"):
        query.execute()

    assert client.calls == []


@pytest.mark.parametrize("index", ["", " ", "\t"])
def test_blank_index_is_rejected_during_configuration(
    index: str, client: StubSearchClient, definition: SearchDefinition
) -> None:
    with pytest.raises(ValueError, match="An index name is required"):
        definition.search().using(client).index(index)

    assert client.calls == []


@pytest.mark.parametrize("include_dynamic_family", [False, True], ids=["empty", "dynamic-only"])
def test_counts_skip_empty_static_catalog(
    include_dynamic_family: bool, client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    definition = SearchDefinition(facets=(attributes,) if include_dynamic_family else ())
    result = definition.search().using(client).index("items").with_facet_counts().execute()
    assert result.facets == []
    assert len(client.calls) == 1
    assert "aggs" not in client.calls[0]


def test_fluent_definition_executes_without_a_build_step(
    client: StubSearchClient, attributes: DynamicFacetFamily, scope: CardinalityAggregation
) -> None:
    definition = SearchDefinition.from_mapping({"category": {"type": "keyword"}}).with_facets(overrides=(attributes,))
    query = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets("category")
        .aggregations(scope)
        .discover_facets("attributes")
    )
    assert client.calls == []
    result = query.execute()
    assert set(client.calls[0]["aggs"]) == {"category", "scope", "attributes_fields"}
    assert result.facets[0].key == "category"
    assert result.facets[0].aggregated


def test_selected_fields_filter_without_requesting_distributions(
    client: StubSearchClient,
    definition: SearchDefinition,
    attributes: DynamicFacetFamily,
    scope: CardinalityAggregation,
) -> None:
    definition = SearchDefinition(
        facets=(*definition.facets, NumericHistogramFacet(field="price"), attributes),
    )
    result = (
        definition.search()
        .using(client)
        .index("items")
        .with_facet_filters(
            terms={"category": ["A"]},
            ranges={"price": RangeFilter(min=10, max=20), "numeric_attributes.porosity": RangeFilter(min=0, max=1)},
        )
        .aggregate_facets("brand")
        .aggregations(scope)
        .with_facet_counts()
        .execute()
    )
    assert len(client.calls) == 1  # Counts share the main request; hidden histograms never prefetch.
    (main,) = client.calls
    assert set(main["aggs"]) == {"brand", "scope", "facet_counts"}
    filters = main["post_filter"]["bool"]["filter"]
    assert {"range": {"numeric_attributes.porosity": {"gte": 0, "lte": 1}}} in filters
    assert {"range": {"price": {"gte": 10, "lte": 20}}} in filters
    assert {"terms": {"category": ["A"]}} in filters
    assert main["aggs"]["scope"]["filter"]["bool"]["filter"] == filters
    assert main["aggs"]["brand"]["filter"]["bool"]["filter"] == filters
    assert main["aggs"]["facet_counts"]["filter"]["bool"]["filter"] == filters
    assert main["aggs"]["facet_counts"]["aggs"]["by_field"]["filters"]["filters"] == {
        "category": {"exists": {"field": "category"}},
        "brand": {"exists": {"field": "brand"}},
        "price": {"exists": {"field": "price"}},
    }
    assert {facet.key for facet in result.facets if facet.aggregated} == {"brand"}
    assert (
        next(facet for facet in result.facets if facet.key == "numeric_attributes.porosity").source
        == "numeric_attributes"
    )


def test_internal_counts_do_not_collide_with_facets_or_public_metrics(
    search_client_factory: type[StubSearchClient],
) -> None:
    metric = ExistsCountsAggregation(name="_facet_counts", fields={"brand": "brand"})
    definition = SearchDefinition(facets=(TermsFacet(field="facet_counts"),))
    client = search_client_factory(
        total=4,
        aggregations={
            "facet_counts": {"facet_counts": {"buckets": [{"key": "A", "doc_count": 3}]}},
            "_facet_counts": {"by_field": {"buckets": {"brand": {"doc_count": 4}}}},
            "__facet_counts": {"by_field": {"buckets": {"facet_counts": {"doc_count": 0}}}},
        },
    )
    result = (
        definition.search()
        .using(client)
        .index("items")
        .aggregate_facets("facet_counts")
        .aggregations(metric)
        .with_facet_counts()
        .execute()
    )
    assert len(client.calls) == 1
    assert set(client.calls[0]["aggs"]) == {"facet_counts", "_facet_counts", "__facet_counts"}
    assert result.facets[0].count == 0
    assert result.aggregation_by(metric) == {"brand": 4}
    with pytest.raises(LookupError, match="No aggregation named '__facet_counts'"):
        result.aggregation_by(ExistsCountsAggregation(name="__facet_counts", fields={"facet_counts": "facet_counts"}))


def test_presence_counts_preserve_static_aliases_without_requested_distributions(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    definition = SearchDefinition(facets=(TermsFacet(field="title", name="label", keyword=True), attributes))
    definition.search().using(client).index("items").with_facet_filters(
        terms={"categorical_attributes.quality": ["good"]}
    ).with_facet_counts().execute()

    (body,) = client.calls
    assert set(body["aggs"]) == {"facet_counts"}
    assert body["aggs"]["facet_counts"]["aggs"]["by_field"]["filters"]["filters"] == {
        "label": {"exists": {"field": "title.keyword"}}
    }


@pytest.mark.parametrize("error", [ApiError("failed", meta=MagicMock(status=500), body={}), TransportError("offline")])
def test_bounds_failures_are_wrapped_without_executing_the_main_search(
    error: Exception, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=0, error=error)
    query = SearchDefinition(facets=(NumericHistogramFacet(field="price"),)).search().using(client).index("items")
    with pytest.raises(FacetBoundsPrefetchError) as raised:
        query.aggregate_facets("price").execute()
    assert raised.value.__cause__ is error
    assert len(client.calls) == 1


def test_missing_index_during_bounds_is_an_explicit_empty_result(
    scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=0, error=NotFoundError("missing", meta=MagicMock(status=404), body={}))
    result = (
        SearchDefinition(facets=(NumericHistogramFacet(field="price"),))
        .search()
        .using(client)
        .index("items")
        .aggregate_facets("price")
        .with_facet_counts()
        .execute()
    )
    assert result.missing_index
    assert (result.hits, result.facets, result.total) == ([], [], 0)
    with pytest.raises(LookupError, match="not computed"):
        result.aggregation_by(scope)
    assert len(client.calls) == 1


def test_replacing_and_clearing_facet_filters_preserves_base_restrictions(
    client: StubSearchClient, definition: SearchDefinition
) -> None:
    original = (
        definition.search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(terms={"brand": ["Acme"]})
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    restricted = original.add_base_filter(Q("term", active=True))
    replaced = restricted.with_facet_filters(terms={"category": ["A"]})
    cleared = replaced.with_facet_filters()
    assert client.calls == []

    for query in (original, restricted, replaced, cleared):
        query.execute()

    tenant = {"term": {"tenant": "one"}}
    assert client.calls[0]["query"]["bool"]["filter"] == [tenant]
    for body in client.calls[1:]:
        assert body["query"]["bool"]["filter"] == [tenant, {"term": {"active": True}}]
    for body in client.calls[:2]:
        assert body["post_filter"]["bool"]["filter"] == [{"terms": {"brand": ["Acme"]}}]
    assert client.calls[2]["post_filter"]["bool"]["filter"] == [{"terms": {"category": ["A"]}}]
    assert "post_filter" not in client.calls[3]


def test_calculated_metadata_can_be_restored_without_mutating_the_disabled_query(
    client: StubSearchClient,
    definition: SearchDefinition,
    attributes: DynamicFacetFamily,
    scope: CardinalityAggregation,
) -> None:
    disabled = (
        SearchDefinition(facets=(*definition.facets, attributes))
        .search()
        .using(client)
        .index("items")
        .aggregate_facets("category")
        .discover_facets("attributes")
        .aggregations(scope)
        .with_facet_counts()
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    restored = disabled.with_aggregations().with_exact_total()

    restored.execute()
    disabled.execute()

    assert set(client.calls[0]["aggs"]) == {"category", "attributes_fields", "scope", "facet_counts"}
    assert client.calls[0]["track_total_hits"] is True
    assert "aggs" not in client.calls[1]
    assert client.calls[1]["track_total_hits"] is False


def test_replacing_filters_snapshots_values_and_preserves_base_restrictions(
    client: StubSearchClient, products: SearchDefinition
) -> None:
    terms = {"brand": ["Acme"]}
    ranges = {"price": RangeFilter(min=10)}
    original = (
        products.search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(terms=terms, ranges=ranges)
    )

    terms["brand"].append("Other")
    ranges["price"].min = 20
    replaced = original.with_facet_filters(ranges={"price": RangeFilter(max=50)})
    cleared = replaced.with_facet_filters()

    for query in (original, replaced, cleared):
        query.execute()

    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"terms": {"brand": ["Acme"]}},
        {"range": {"price": {"gte": 10.0}}},
    ]
    assert client.calls[1]["post_filter"]["bool"]["filter"] == [{"range": {"price": {"lte": 50.0}}}]
    assert "post_filter" not in client.calls[2]
    for body in client.calls:
        assert body["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]


@pytest.mark.parametrize("aggregations_enabled", [False, True])
@pytest.mark.parametrize("total_enabled", [False, True])
def test_aggregations_and_exact_totals_are_independent(
    aggregations_enabled: bool,
    total_enabled: bool,
    products: SearchDefinition,
    brand_scope: CardinalityAggregation,
    search_client_factory: type[StubSearchClient],
) -> None:
    client = search_client_factory(total=2)
    result = (
        products.search()
        .using(client)
        .index("items")
        .aggregate_facets("brand", "numeric_attributes.weight")
        .discover_facets("attributes")
        .aggregations(brand_scope)
        .with_facet_counts()
        .with_aggregations(enabled=aggregations_enabled)
        .with_exact_total(enabled=total_enabled)
        .execute()
    )

    assert len(client.calls) == (2 if aggregations_enabled else 1)
    search = client.calls[-1]
    assert search["track_total_hits"] is total_enabled
    if aggregations_enabled:
        assert set(search["aggs"]) == {
            "brand",
            "hist_numeric_attributes.weight",
            "attributes_fields",
            "scope",
            "facet_counts",
        }
        assert result.aggregation_by(brand_scope) == ScopeCounts(doc_count=0, cardinalities={"brand": 0})
        assert {facet.key for facet in result.facets if facet.aggregated} == {
            "brand",
            "numeric_attributes.weight",
        }
    else:
        assert "aggs" not in search
        with pytest.raises(LookupError, match="not computed"):
            result.aggregation_by(brand_scope)
        assert result.facets == []
    assert result.total == (2 if total_enabled else None)
    assert result.pages == (1 if total_enabled else None)


def test_reenabling_aggregations_does_not_reenable_exact_totals_or_mutate_another_branch(
    client: StubSearchClient, products: SearchDefinition
) -> None:
    disabled = (
        products.search()
        .using(client)
        .index("items")
        .aggregate_facets("brand")
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    restored = disabled.with_aggregations()

    restored.execute()
    disabled.execute()

    assert set(client.calls[0]["aggs"]) == {"brand"}
    assert "aggs" not in client.calls[1]
    assert all(body["track_total_hits"] is False for body in client.calls)
