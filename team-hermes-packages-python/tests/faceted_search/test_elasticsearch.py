"""Stateless execution helpers, replacing only Elasticsearch I/O."""

import pytest
from elasticsearch.dsl import Q

from team_hermes.elasticsearch import (
    Bounds,
    DateHistogramFacet,
    DynamicFacetFamily,
    ExistsCountsAggregation,
    IntegerSumAggregation,
    NumericHistogramFacet,
    OffsetPagination,
    RangeFilter,
    TermsFacet,
)
from team_hermes.elasticsearch.elasticsearch import (
    _build_search,
    build_aggregations,
    compose_query,
    fetch_histogram_bounds,
)
from team_hermes.elasticsearch.facet_plan import FacetPlan
from team_hermes.elasticsearch.indexing import DynamicField
from tests.faceted_search.search_test_helpers import StubSearchClient


def test_zero_size_request_remains_aggregation_only() -> None:
    client = StubSearchClient(total=1, hits=[{"_id": "1", "_source": {}, "sort": [1]}])
    response = client.execute(
        _build_search("items", Q("match_all"), pagination=OffsetPagination(page_size=0), aggregations={}),
        index_name="items",
    )
    (body,) = client.calls
    assert body["from"] == 0
    assert body["size"] == 0
    assert "search_after" not in body
    assert "aggs" not in body
    assert "sort" not in body
    assert list(response.hits) == []
    assert response.to_dict()["hits"]["total"]["value"] == client.total


@pytest.mark.parametrize("include_aggregations", [False, True])
@pytest.mark.parametrize("track_exact_total", [False, True])
@pytest.mark.parametrize("include_facet_counts", [False, True])
def test_request_controls_totals_aggregations_and_counts_independently(
    include_aggregations: bool,
    track_exact_total: bool,
    include_facet_counts: bool,
) -> None:
    client = StubSearchClient(
        total=3,
        hits=[{"_id": "one", "_source": {"price": 10}}],
        aggregations={"prefetch_price": {"stats": {"min": 0, "max": 30}}},
    )
    facets = (NumericHistogramFacet(field="price"),)
    plan = FacetPlan.from_inputs(
        definitions=facets,
        terms={},
        ranges={"price": RangeFilter(min=10, max=20)},
        facet_names_to_aggregate=("price",),
    )
    query = compose_query(None, (Q("term", tenant="one"),))
    aggregations = {}
    if include_aggregations:
        bounds = fetch_histogram_bounds(client, "items", query, plan)
        aggregations, _ = build_aggregations(
            plan,
            (IntegerSumAggregation(name="total_price", field="price"),),
            bounds=bounds,
            presence_counts=ExistsCountsAggregation.over(facets) if include_facet_counts else None,
        )
    response = client.execute(
        _build_search(
            "items",
            query,
            pagination=OffsetPagination(page_size=1),
            filters=plan.filters,
            aggregations=aggregations,
            track_exact_total=track_exact_total,
        ),
        index_name="items",
    )
    assert len(client.calls) == (2 if include_aggregations else 1)
    for request in client.calls:
        assert request["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]
    main = client.calls[-1]
    assert main["post_filter"]["bool"]["filter"] == [{"range": {"price": {"gte": 10, "lte": 20}}}]
    assert main["track_total_hits"] is track_exact_total
    assert ("total" in response.to_dict()["hits"]) is track_exact_total
    assert [hit.meta.id for hit in response.hits] == ["one"]
    if include_aggregations:
        assert set(main["aggs"]) == (
            {"hist_price", "total_price", "facet_counts"} if include_facet_counts else {"hist_price", "total_price"}
        )
    else:
        assert "aggs" not in main


@pytest.mark.parametrize("request_price", [False, True])
def test_plan_only_aggregates_requested_facets_and_prefetches_automatic_numeric_bounds(request_price: bool) -> None:
    client = StubSearchClient(total=2, aggregations={"prefetch_price": {"stats": {"min": 0, "max": 30}}})
    facets = (
        NumericHistogramFacet(field="price"),
        NumericHistogramFacet(field="unrequested"),
        NumericHistogramFacet(field="weight", interval=10),
        DateHistogramFacet(field="created"),
        TermsFacet(field="brand"),
    )
    requested_names = ("weight", "created", "brand") + (("price",) if request_price else ())
    plan = FacetPlan.from_inputs(definitions=facets, terms={}, ranges={}, facet_names_to_aggregate=requested_names)

    bounds = fetch_histogram_bounds(client, "items", Q("match_all"), plan)
    aggregations, _ = build_aggregations(plan, (), bounds=bounds)

    assert bounds == ({"price": Bounds(0, 30)} if request_price else {})
    assert len(client.calls) == int(request_price)
    if request_price:
        assert set(client.calls[0]["aggs"]) == {"prefetch_price"}
    assert set(aggregations) == {"hist_weight", "hist_created", "brand"} | ({"hist_price"} if request_price else set())


def test_presence_counts_use_indexed_paths_and_public_aliases_for_all_facet_types() -> None:
    facets = (
        TermsFacet(field="brand", name="brands", keyword=True),
        NumericHistogramFacet(field="price", name="prices"),
        DateHistogramFacet(field="created", name="dates"),
    )

    counts = ExistsCountsAggregation.over(iter(facets), name="presence")

    assert counts.name == "presence"
    assert counts.fields == {"brands": "brand.keyword", "prices": "price", "dates": "created"}


def test_internal_counts_take_a_free_key_and_their_reader_follows_it() -> None:
    facet = TermsFacet(field="facet_counts")
    metric = ExistsCountsAggregation(name="_facet_counts", fields={"brand": "brand"})
    plan = FacetPlan(catalog=(facet,), filters=(), facets_to_aggregate=(facet,), discovery_families=())
    aggregations, counts = build_aggregations(plan, (metric,), presence_counts=ExistsCountsAggregation.over((facet,)))
    without_counts, absent = build_aggregations(plan, (metric,))
    assert set(aggregations) == {"facet_counts", "_facet_counts", "__facet_counts"}
    assert counts is not None
    assert counts.name == "__facet_counts"
    assert counts.extract({"by_field": {"buckets": {"facet_counts": {"doc_count": 0}}}}) == {"facet_counts": 0}
    assert set(without_counts) == {"facet_counts", "_facet_counts"}
    assert absent is None
    assert facet.name == "facet_counts"
    assert metric.name == "_facet_counts"


def test_aggregations_preserve_each_facets_filter_scope_and_bounds() -> None:
    brand = TermsFacet(field="brand")
    price = NumericHistogramFacet(field="price")
    metric = IntegerSumAggregation(name="total_price", field="price")
    family = DynamicFacetFamily(DynamicField("attributes"))
    counts = ExistsCountsAggregation.over((brand, price))
    plan = FacetPlan.from_inputs(
        definitions=(brand, price, family),
        terms={"brand": ["A"]},
        ranges={"price": RangeFilter(min=10, max=20)},
        facet_names_to_aggregate=("brand", "price"),
        requested_family_names=("attributes",),
    )
    aggregations, _ = build_aggregations(plan, (metric,), bounds={"price": Bounds(0, 100)}, presence_counts=counts)
    assert list(aggregations) == ["brand", "hist_price", "total_price", "attributes_fields", "facet_counts"]
    for facet_or_metric in (brand, metric, family.field_names_facet(), counts):
        key, expected = facet_or_metric.build_agg(plan.filters)
        assert aggregations[key].to_dict() == expected.to_dict()
    key, expected = price.build_agg(plan.filters, bounds=Bounds(0, 100))
    assert key == "hist_price"
    assert aggregations[key].to_dict() == expected.to_dict()


@pytest.mark.parametrize("with_counts", [False, True])
def test_internal_counts_are_omitted_when_no_static_fields_exist(with_counts: bool) -> None:
    facet = TermsFacet(field="brand")
    plan = FacetPlan(catalog=(facet,), filters=(), facets_to_aggregate=(facet,), discovery_families=())
    aggregations, counts = build_aggregations(
        plan,
        (),
        presence_counts=ExistsCountsAggregation.over(()) if with_counts else None,
    )
    assert set(aggregations) == {"brand"}
    assert counts is None


@pytest.mark.parametrize(
    "conflicting_item", [TermsFacet(field="price"), IntegerSumAggregation(name="price", field="price")]
)
def test_aggregations_reject_duplicate_keys_from_facets_or_metrics(
    conflicting_item: TermsFacet | IntegerSumAggregation,
) -> None:
    price = TermsFacet(field="price")
    with pytest.raises(ValueError, match="Duplicate aggregation key 'price'"):
        if isinstance(conflicting_item, TermsFacet):
            facets = (price, conflicting_item)
            plan = FacetPlan(catalog=facets, filters=(), facets_to_aggregate=facets, discovery_families=())
            build_aggregations(plan, ())
        else:
            plan = FacetPlan(catalog=(price,), filters=(), facets_to_aggregate=(price,), discovery_families=())
            build_aggregations(plan, (conflicting_item,))


@pytest.mark.parametrize("conflict_with_metric", [False, True])
def test_discovery_rejects_collisions_with_public_aggregations(conflict_with_metric: bool) -> None:
    family = DynamicFacetFamily(DynamicField("attributes"))
    facets = () if conflict_with_metric else (TermsFacet(field="brand", name="attributes_fields"),)
    metrics = (IntegerSumAggregation(field="price", name="attributes_fields"),) if conflict_with_metric else ()
    plan = FacetPlan(catalog=facets, filters=(), facets_to_aggregate=facets, discovery_families=(family,))

    with pytest.raises(ValueError, match="Duplicate aggregation key 'attributes_fields'"):
        build_aggregations(plan, metrics)


def test_histogram_collisions_use_the_emitted_key_not_the_public_name() -> None:
    histogram = NumericHistogramFacet(field="price", name="cost", interval=10)
    term = TermsFacet(field="brand", name="hist_cost")
    facets = (histogram, term)
    plan = FacetPlan(catalog=facets, filters=(), facets_to_aggregate=facets, discovery_families=())

    with pytest.raises(ValueError, match="Duplicate aggregation key 'hist_cost'"):
        build_aggregations(plan, ())
