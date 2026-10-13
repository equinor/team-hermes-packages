"""Tests for data-defined facets, using a synthetic ``attributes`` family.

Deliberately domain-free: the pattern (sparse, caller-defined attributes indexed
as ``<path>.<name>`` plus a keyword list of the names) is the library's, not
WellCoreDB's, so these document the pattern rather than the measurements index.
"""

from dataclasses import replace

import pytest
from elasticsearch.dsl import Q
from pydantic import ValidationError

from team_hermes.elasticsearch import (
    AvailableFacetCatalog,
    CardinalityAggregation,
    DynamicFacetFamily,
    FacetKind,
    FacetValueType,
    NumericHistogramFacet,
    RangeFilter,
    SearchDefinition,
    SearchRequest,
    TermsFacet,
    UnknownFacetError,
)
from team_hermes.elasticsearch.aggregations import AggregationsResponse
from team_hermes.elasticsearch.elasticsearch import build_aggregations
from team_hermes.elasticsearch.errors import InvalidSearchRequestError
from team_hermes.elasticsearch.facet_plan import FacetPlan, _resolve_facets
from team_hermes.elasticsearch.indexing import DynamicField
from tests.faceted_search.search_test_helpers import StubSearchClient


def _field_names_response(**counts: int) -> AggregationsResponse:
    return AggregationsResponse(
        {
            "attributes_fields": {
                "attributes_fields": {"buckets": [{"key": key, "doc_count": count} for key, count in counts.items()]}
            }
        }
    )


# ── Request selections ─────────────────────────────────────────────────────


def test_an_inverted_range_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Invalid range filter"):
        RangeFilter(min=1.0, max=0.0)


# ── Available field names (step 1) ─────────────────────────────────────────


def test_name_lists_are_aggregated_only_when_requested(attributes: DynamicFacetFamily) -> None:
    """Enumerating every attribute name spans the whole result set, so it is
    opt-in: the query explicitly requests available field names for a family."""
    quiet_plan = FacetPlan.from_inputs(definitions=(attributes,), terms={}, ranges={})
    loud_plan = FacetPlan.from_inputs(
        definitions=(attributes,), terms={}, ranges={}, requested_family_names=("attributes",)
    )
    quiet, _ = build_aggregations(quiet_plan, ())
    loud, _ = build_aggregations(loud_plan, ())

    assert quiet == {}
    assert set(loud) == {"attributes_fields"}


def test_equal_names_in_different_sources_remain_distinct(attributes: DynamicFacetFamily) -> None:
    facets = _field_names_response(**{"categorical_attributes.weight": 3, "numeric_attributes.weight": 7})

    catalog = attributes.extract_catalog(facets)

    assert isinstance(catalog, AvailableFacetCatalog)
    assert [(d.key, d.kind, d.value_type, d.source) for d in catalog.descriptors] == [
        ("categorical_attributes.weight", FacetKind.TERM, FacetValueType.STRING, "categorical_attributes"),
        ("numeric_attributes.weight", FacetKind.RANGE, FacetValueType.NUMBER, "numeric_attributes"),
    ]


def test_available_facets_report_document_counts(attributes: DynamicFacetFamily) -> None:
    """The name-list buckets already carry the counts a picker needs."""
    facets = _field_names_response(**{"numeric_attributes.weight": 7})

    assert attributes.extract_catalog(facets).counts == {"numeric_attributes.weight": 7}


@pytest.mark.parametrize(
    "response", [AggregationsResponse({}), _field_names_response()], ids=["absent", "empty-buckets"]
)
def test_catalog_is_empty_without_available_attributes(
    response: AggregationsResponse, attributes: DynamicFacetFamily
) -> None:
    catalog = attributes.extract_catalog(response)

    assert catalog.descriptors == []
    assert catalog.counts == {}


# ── Materialization (step 2) ───────────────────────────────────────────────


def test_selected_attribute_is_described_with_its_source(attributes: DynamicFacetFamily) -> None:
    """``source`` identifies the qualified filter-key prefix."""
    (bound,) = _resolve_facets((attributes,), {}, {"numeric_attributes.weight": RangeFilter()})

    descriptor = bound.describe()

    assert (descriptor.key, descriptor.kind, descriptor.source) == (
        "numeric_attributes.weight",
        FacetKind.RANGE,
        "numeric_attributes",
    )


def test_unbounded_selection_aggregates_but_does_not_filter(attributes: DynamicFacetFamily) -> None:
    """Adding an attribute must show its distribution before a range is chosen."""
    ranges = {"numeric_attributes.weight": RangeFilter()}
    plan = FacetPlan.from_inputs(definitions=(attributes,), terms={}, ranges=ranges)
    (bound,) = plan.catalog

    assert plan.filters == ()
    key, aggregation = bound.build_agg(plan.filters)
    assert key == "hist_numeric_attributes.weight"
    assert aggregation.to_dict()["aggs"][key]["histogram"]["field"] == "numeric_attributes.weight"


def test_bounded_selection_compiles_a_filter(attributes: DynamicFacetFamily) -> None:
    ranges = {"numeric_attributes.weight": RangeFilter(min=1.0, max=9.0)}
    plan = FacetPlan.from_inputs(definitions=(attributes,), terms={}, ranges=ranges)

    (item,) = plan.filters

    assert item.field == "numeric_attributes.weight"
    assert item.kind is FacetKind.RANGE


def test_categorical_selection_compiles_a_terms_filter(attributes: DynamicFacetFamily) -> None:
    terms = {"categorical_attributes.colour": ["red"]}
    plan = FacetPlan.from_inputs(definitions=(attributes,), terms=terms, ranges={})

    (item,) = plan.filters

    assert item.field == "categorical_attributes.colour"
    assert item.kind is FacetKind.TERM


# ── API surface ────────────────────────────────────────────────────────────


def test_name_lists_are_internal(attributes: DynamicFacetFamily) -> None:
    """They are internal field-name lists, never facets a client may pick."""
    assert attributes.internal_keys == {"attributes_fields"}


def test_definition_reports_internal_keys_and_filters_all_families_storage_fields(
    attributes: DynamicFacetFamily,
) -> None:
    other = DynamicFacetFamily(field=DynamicField("other"))
    category = TermsFacet(field="category")
    definition = SearchDefinition(
        facets=(attributes, other, TermsFacet(field="attributes_fields"), TermsFacet(field="other_fields"), category)
    )

    assert definition.internal_facet_keys == frozenset({"attributes_fields", "other_fields"})
    assert definition.facets == (attributes, other, category)
    assert definition.static_facets == (category,)


def test_internal_keys_follow_facet_replacement_without_mutating_other_definitions(
    attributes: DynamicFacetFamily,
) -> None:
    definition = SearchDefinition(facets=(attributes,))
    other = DynamicFacetFamily(field=DynamicField("other"))

    replaced = replace(definition, facets=(other,))
    cleared = replace(definition, facets=())

    assert definition.internal_facet_keys == frozenset({"attributes_fields"})
    assert replaced.internal_facet_keys == frozenset({"other_fields"})
    assert cleared.internal_facet_keys == frozenset()


def test_family_is_not_a_static_presence_count_field(attributes: DynamicFacetFamily) -> None:
    """It spans one field per attribute, so per-field presence counts don't apply."""
    assert SearchDefinition(facets=(attributes,)).static_facets == ()


def test_direct_binding_keeps_sources_separate_and_does_not_mutate_family(attributes: DynamicFacetFamily) -> None:
    ranges = {"numeric_attributes.weight": RangeFilter(min=0, max=9)}
    terms = {"categorical_attributes.colour": ["red"]}
    plan = FacetPlan.from_inputs(definitions=(attributes,), terms=terms, ranges=ranges)

    assert [item.field for item in plan.filters] == [
        "numeric_attributes.weight",
        "categorical_attributes.colour",
    ]
    assert len(plan.catalog) == 2
    numeric, categorical = plan.catalog
    assert isinstance(numeric, NumericHistogramFacet)
    assert isinstance(categorical, TermsFacet)
    assert _resolve_facets((attributes,), {}, {}) == ()
    assert not hasattr(numeric, "selection")
    assert not hasattr(categorical, "selection")


def test_truncated_available_catalog_is_not_silently_published(attributes: DynamicFacetFamily) -> None:
    with pytest.raises(InvalidSearchRequestError, match="refine your search"):
        attributes.extract_catalog(
            AggregationsResponse(
                {"attributes_fields": {"attributes_fields": {"sum_other_doc_count": 1, "buckets": []}}}
            )
        )


@pytest.mark.parametrize("namespace", ["numeric_attributes", "categorical_attributes"])
def test_available_catalog_keeps_dots_in_attribute_names(namespace: str, attributes: DynamicFacetFamily) -> None:
    key = f"{namespace}.pore.size"
    catalog = attributes.extract_catalog(_field_names_response(**{key: 2}))
    assert catalog.descriptors[0].key == key
    assert catalog.descriptors[0].source == namespace
    assert catalog.counts == {key: 2}


@pytest.mark.parametrize(
    "key",
    [
        "unknown.weight",
        "numeric_attributes_extra.weight",
        "categorical_attributes_extra.color",
        "numeric_attributesweight",
        "numeric_attributes",
        "categorical_attributes",
        "numeric_attributes.",
        "categorical_attributes.",
        "",
    ],
)
def test_invalid_catalog_key_is_rejected(key: str, attributes: DynamicFacetFamily) -> None:
    with pytest.raises(ValueError, match="Invalid discovery key"):
        attributes.extract_catalog(_field_names_response(**{key: 1}))


# Query execution


def test_available_dynamic_facets_hide_internal_fields_and_keep_typed_names(
    attributes: DynamicFacetFamily,
    search_client_factory: type[StubSearchClient],
) -> None:
    client = search_client_factory(
        total=2,
        aggregations={
            "attributes_fields": {
                "attributes_fields": {
                    "buckets": [
                        {"key": "categorical_attributes.quality", "doc_count": 0},
                        {"key": "numeric_attributes.porosity", "doc_count": 2},
                    ]
                }
            },
        },
    )
    result = (
        SearchDefinition(facets=(attributes,))
        .search()
        .using(client)
        .index("items")
        .discover_facets("attributes")
        .execute()
    )
    assert [(facet.key, facet.source, facet.count) for facet in result.facets] == [
        ("categorical_attributes.quality", "categorical_attributes", 0),
        ("numeric_attributes.porosity", "numeric_attributes", 2),
    ]
    assert all(not facet.aggregated for facet in result.facets)


def test_dynamic_namespaces_resolve_filters_without_listing_available_fields(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    result = (
        SearchDefinition(facets=(attributes,))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(
            terms={"categorical_attributes.quality": ["good"]},
            ranges={"numeric_attributes.porosity": RangeFilter(min=0)},
        )
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"range": {"numeric_attributes.porosity": {"gte": 0}}},
        {"terms": {"categorical_attributes.quality": ["good"]}},
    ]
    assert result.facets == []
    assert "aggs" not in client.calls[0]
    assert len(client.calls) == 1


@pytest.mark.parametrize(
    ("selections", "error", "message"),
    [
        (SearchRequest(ranges={"unknown.weight": RangeFilter()}), UnknownFacetError, "unknown"),
        (SearchRequest(ranges={"categorical_attributes.weight": RangeFilter()}), InvalidSearchRequestError, "range"),
        (SearchRequest(terms={"numeric_attributes.grade": []}), InvalidSearchRequestError, "term"),
        (
            SearchRequest(ranges={"numeric_attributes.weight": RangeFilter(min="1")}),
            InvalidSearchRequestError,
            "number",
        ),
        (SearchRequest(terms={"categorical_attributes.": []}), InvalidSearchRequestError, "empty"),
    ],
)
def test_invalid_dynamic_selections_are_rejected_before_io(
    selections: SearchRequest,
    error: type[Exception],
    message: str,
    client: StubSearchClient,
    attributes: DynamicFacetFamily,
) -> None:
    query = SearchDefinition(facets=(attributes,)).search().using(client).index("items")

    with pytest.raises(error, match=message):
        query.with_facet_filters(terms=selections.terms, ranges=selections.ranges).with_aggregations(
            enabled=False
        ).with_exact_total(enabled=False).execute()

    assert client.calls == []


def test_dynamic_sources_do_not_shadow_static_filter_attributes(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    definition = SearchDefinition(
        facets=(attributes, TermsFacet(field="categorical_attributes"), TermsFacet(field="dynamic")),
    )
    definition.search().using(client).index("items").with_facet_filters(
        terms={
            "categorical_attributes": ["static"],
            "dynamic": ["also-static"],
            "categorical_attributes.grade": ["good"],
        }
    ).with_aggregations(enabled=False).with_exact_total(enabled=False).execute()

    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"terms": {"categorical_attributes.grade": ["good"]}},
        {"terms": {"categorical_attributes": ["static"]}},
        {"terms": {"dynamic": ["also-static"]}},
    ]


def test_open_dynamic_selection_is_aggregated_without_filtering(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    result = (
        SearchDefinition(facets=(attributes,))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(ranges={"numeric_attributes.porosity": RangeFilter()})
        .aggregate_facets("numeric_attributes.porosity")
        .execute()
    )
    assert len(client.calls) == 2  # Bounds prefetch plus main query.
    assert client.calls[0]["aggs"]["prefetch_numeric_attributes.porosity"]["filter"] == {"match_all": {}}
    assert "post_filter" not in client.calls[-1]
    assert [(facet.key, facet.aggregated) for facet in result.facets] == [("numeric_attributes.porosity", True)]
    assert "attributes_fields" not in client.calls[-1]["aggs"]


def test_empty_dynamic_terms_are_aggregated_without_filtering(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    result = (
        SearchDefinition(facets=(attributes,))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(terms={"categorical_attributes.quality": []})
        .aggregate_facets("categorical_attributes.quality")
        .execute()
    )

    assert len(client.calls) == 1
    assert "post_filter" not in client.calls[0]
    assert [(facet.key, facet.aggregated) for facet in result.facets] == [("categorical_attributes.quality", True)]


def test_static_qualified_name_takes_precedence_over_dynamic_source(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    definition = SearchDefinition(
        facets=(attributes, TermsFacet(field="weight_label", name="numeric_attributes.weight")),
    )
    query = definition.search().using(client).index("items")

    query.with_facet_filters(terms={"numeric_attributes.weight": ["heavy"]}).with_aggregations(
        enabled=False
    ).with_exact_total(enabled=False).execute()

    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"terms": {"weight_label": ["heavy"]}}]
    with pytest.raises(UnknownFacetError):
        query.with_facet_filters(ranges={"numeric_attributes.weight": RangeFilter(min=0, max=1)}).with_aggregations(
            enabled=False
        ).with_exact_total(enabled=False).execute()
    assert len(client.calls) == 1


def test_available_facet_listing_and_dynamic_aggregation_are_independent_and_replaceable(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    base = (
        SearchDefinition(facets=(attributes,))
        .search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(
            ranges={"numeric_attributes.porosity": RangeFilter(min=0, max=1)},
            terms={"categorical_attributes.quality": ["good"]},
        )
    )
    listing = base.discover_facets("attributes")
    distribution = listing.discover_facets().aggregate_facets("categorical_attributes.quality")
    assert client.calls == []
    listing.execute()
    result = distribution.execute()
    base.execute()
    assert len(client.calls) == 3
    assert set(client.calls[0]["aggs"]) == {"attributes_fields"}
    assert "attributes_fields" not in client.calls[1]["aggs"]
    assert "aggs" not in client.calls[2]
    assert {facet.key for facet in result.facets if facet.aggregated} == {"categorical_attributes.quality"}
    for body in client.calls:
        assert body["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]
        assert len(body["post_filter"]["bool"]["filter"]) == 2


@pytest.mark.parametrize("key", ["attributes", "numeric_attributes", "categorical_attributes"])
def test_aggregation_rejects_family_and_bare_namespace_names(
    key: str, client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    query = SearchDefinition(facets=(attributes,)).search().using(client).index("items")
    with pytest.raises(UnknownFacetError):
        query.discover_facets("porosity").execute()
    with pytest.raises(UnknownFacetError, match=key):
        query.aggregate_facets(key).execute()
    assert client.calls == []


def test_dynamic_bounds_available_fields_and_counts_keep_all_base_restrictions(
    attributes: DynamicFacetFamily,
    search_client_factory: type[StubSearchClient],
) -> None:
    client = search_client_factory(
        total=2, aggregations={"prefetch_numeric_attributes.weight": {"stats": {"min": 0, "max": 30}}}
    )
    result = (
        SearchDefinition(facets=(TermsFacet(field="category"), TermsFacet(field="brand"), attributes))
        .search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(
            terms={"category": ["A"]}, ranges={"numeric_attributes.weight": RangeFilter(min=10, max=20)}
        )
        .aggregate_facets("numeric_attributes.weight")
        .discover_facets("attributes")
        .aggregations(CardinalityAggregation(name="scope", fields=("category",)))
        .with_facet_counts()
        .execute()
    )
    bounds, main = client.calls
    for body in client.calls:
        assert body["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]
    assert bounds["aggs"]["prefetch_numeric_attributes.weight"]["filter"]["bool"]["filter"] == [
        {"terms": {"category": ["A"]}}
    ]
    assert bounds["aggs"]["prefetch_numeric_attributes.weight"]["aggs"]["stats"] == {
        "stats": {"field": "numeric_attributes.weight"}
    }
    assert "hist_numeric_attributes.weight" in main["aggs"]
    filters = main["post_filter"]["bool"]["filter"]
    for key in ("scope", "attributes_fields", "facet_counts"):
        assert main["aggs"][key]["filter"]["bool"]["filter"] == filters
    assert [facet.key for facet in result.facets if facet.aggregated] == ["numeric_attributes.weight"]


def test_selected_dynamic_aggregation_collisions_are_rejected(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    # Both facets emit hist_numeric_attributes.weight despite different public names.
    collision = TermsFacet(field="hist_numeric_attributes.weight")
    query = (
        SearchDefinition(facets=(attributes, collision))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(ranges={"numeric_attributes.weight": RangeFilter()})
        .aggregate_facets("numeric_attributes.weight", collision.name)
    )
    with pytest.raises(ValueError, match="Duplicate aggregation key"):
        query.execute()
    assert len(client.calls) == 1  # Bounds only; no main request with overwritten aggregations.


def test_dynamic_distributions_need_no_placeholder_filters_and_preserve_base_restrictions(
    client: StubSearchClient, products: SearchDefinition
) -> None:
    query = (
        products.search()
        .using(client)
        .index("items")
        .add_base_filter(Q("term", tenant="one"))
        .with_facet_filters(terms={"brand": ["Acme"]})
        .aggregate_facets(
            "categorical_attributes.colour",
            "numeric_attributes.weight",
            "numeric_attributes.weight",
        )
    )

    result = query.execute()

    assert len(client.calls) == 2
    bounds, search = client.calls
    assert set(bounds["aggs"]) == {"prefetch_numeric_attributes.weight"}
    assert set(search["aggs"]) == {"hist_numeric_attributes.weight", "categorical_attributes.colour"}
    for body in client.calls:
        assert body["query"]["bool"]["filter"] == [{"term": {"tenant": "one"}}]
    assert bounds["aggs"]["prefetch_numeric_attributes.weight"]["filter"]["bool"]["filter"] == [
        {"terms": {"brand": ["Acme"]}}
    ]
    assert search["post_filter"]["bool"]["filter"] == [{"terms": {"brand": ["Acme"]}}]
    assert [facet.key for facet in result.facets if facet.aggregated] == [
        "numeric_attributes.weight",
        "categorical_attributes.colour",
    ]


def test_dynamic_distribution_without_any_filters_does_not_add_a_post_filter(
    client: StubSearchClient, products: SearchDefinition
) -> None:
    base = products.search().using(client).index("items")
    selected = base.aggregate_facets("categorical_attributes.colour")

    result = selected.execute()
    base.execute()

    assert set(client.calls[0]["aggs"]) == {"categorical_attributes.colour"}
    assert "aggs" not in client.calls[1]
    assert all("post_filter" not in body for body in client.calls)
    assert [facet.key for facet in result.facets if facet.aggregated] == ["categorical_attributes.colour"]


def test_static_alias_wins_over_dynamic_namespace_for_requested_distributions(
    client: StubSearchClient, attributes: DynamicFacetFamily
) -> None:
    alias = TermsFacet(field="stored_brand", name="numeric_attributes.weight")
    definition = SearchDefinition(facets=(attributes, alias))

    result = definition.search().using(client).index("items").aggregate_facets(alias.name).execute()

    assert len(client.calls) == 1
    assert set(client.calls[0]["aggs"]) == {alias.name}
    assert result.facets[0].key == alias.name
    assert result.facets[0].aggregated is True


@pytest.mark.parametrize("enabled", [False, True])
def test_unknown_dynamic_requests_fail_before_io_even_without_aggregations(
    enabled: bool, client: StubSearchClient, products: SearchDefinition
) -> None:
    query = (
        products.search()
        .using(client)
        .index("items")
        .aggregate_facets("unknown.weight")
        .with_aggregations(enabled=enabled)
    )

    with pytest.raises(UnknownFacetError):
        query.execute()

    assert client.calls == []


def test_requested_dynamic_distribution_does_not_bypass_filter_kind_validation(
    client: StubSearchClient, products: SearchDefinition
) -> None:
    query = (
        products.search()
        .using(client)
        .index("items")
        .with_facet_filters(terms={"numeric_attributes.weight": ["heavy"]})
        .aggregate_facets("numeric_attributes.weight")
    )

    with pytest.raises(InvalidSearchRequestError):
        query.execute()

    assert client.calls == []
