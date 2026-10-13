"""Direct filter validation, snapshots, resolution, and independent distribution selection."""

from typing import Any

import pytest
from pydantic import ValidationError

from team_hermes.elasticsearch import (
    DateHistogramFacet,
    DynamicFacetFamily,
    FacetKind,
    InvalidSearchRequestError,
    NumericHistogramFacet,
    RangeFilter,
    SearchDefinition,
    SearchRequest,
    TermsFacet,
    UnknownFacetError,
)
from team_hermes.elasticsearch.facet_plan import (
    _resolve_facets,
    _resolve_field,
)
from team_hermes.elasticsearch.indexing import DynamicField
from team_hermes.elasticsearch.input import RangeBound
from tests.search_test_helpers import StubSearchClient


@pytest.mark.parametrize(
    "minimum, maximum",
    [(0, 1), (1, 1), (None, None), (0, None), (None, 1), ("now", None), (None, "now"), ("now-2d", "now-1d")],
)
def test_ranges_support_numeric_date_and_open_bounds(minimum: RangeBound, maximum: RangeBound) -> None:
    bounds = RangeFilter(min=minimum, max=maximum)
    assert (bounds.min, bounds.max) == (minimum, maximum)


@pytest.mark.parametrize("minimum, maximum", [(1, "now"), ("now", 1), ([], None), (None, {})])
def test_range_validation_rejects_invalid_bounds(minimum: Any, maximum: Any) -> None:
    with pytest.raises(ValidationError):
        RangeFilter(min=minimum, max=maximum)


def test_inverted_range_is_a_validation_error() -> None:
    with pytest.raises(ValidationError, match="Invalid range filter"):
        RangeFilter(min=2, max=1)


@pytest.mark.parametrize("value", [True, False, float("nan"), float("inf"), -float("inf"), ""])
@pytest.mark.parametrize("endpoint", ["min", "max"])
def test_ranges_reject_invalid_endpoint_values(value: Any, endpoint: str) -> None:
    with pytest.raises(ValidationError):
        RangeFilter(**{endpoint: value})


@pytest.mark.parametrize("values", ["A", (1,), ("A", None)])
def test_terms_reject_non_string_collections(values: Any) -> None:
    with pytest.raises(ValidationError):
        SearchDefinition().search().with_facet_filters(terms={"category": values})


@pytest.mark.parametrize("key", ["", None])
def test_filter_names_are_validated_before_execution(key: Any) -> None:
    with pytest.raises(ValidationError):
        SearchDefinition().search().with_facet_filters(terms={key: []})
    with pytest.raises(ValidationError):
        SearchDefinition().search().with_facet_filters(ranges={key: RangeFilter()})


def test_request_filters_are_snapshotted_and_branches_are_independent() -> None:
    client = StubSearchClient(total=0)
    definition = SearchDefinition(facets=(TermsFacet(field="brand"), NumericHistogramFacet(field="price")))
    request = SearchRequest(terms={"brand": ["Acme"]}, ranges={"price": RangeFilter(min=0, max=10)})
    base = (
        definition.search()
        .using(client)
        .index("items")
        .apply_request(request)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )
    changed = base.with_facet_filters(terms={"brand": ["Other"]})
    request.terms["brand"].append("Changed")
    request.ranges["price"].min = 5
    request.ranges.clear()
    base.execute()
    changed.execute()
    base.with_facet_filters().execute()
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"terms": {"brand": ["Acme"]}},
        {"range": {"price": {"gte": 0, "lte": 10}}},
    ]
    assert client.calls[1]["post_filter"]["bool"]["filter"] == [{"terms": {"brand": ["Other"]}}]
    assert "post_filter" not in client.calls[2]
    assert all(not hasattr(facet, "selection") for facet in definition.facets)


def test_mutated_range_models_are_revalidated() -> None:
    bounds = RangeFilter(min=0, max=1)
    bounds.min = 2.0
    with pytest.raises(ValidationError, match="Invalid range filter"):
        SearchDefinition().search().with_facet_filters(ranges={"price": bounds})


@pytest.mark.parametrize("value", [True, float("inf"), "", "now"])
def test_mutated_range_endpoints_are_revalidated(value: Any) -> None:
    bounds = RangeFilter(min=0, max=1)
    bounds.min = value
    with pytest.raises(ValidationError):
        SearchDefinition().search().with_facet_filters(ranges={"price": bounds})


def test_unsupported_facet_is_rejected_at_definition_time() -> None:
    unsupported: Any = object()
    with pytest.raises(TypeError, match="Unsupported facet"):
        SearchDefinition(facets=(unsupported,))


@pytest.mark.parametrize("value", [(0, 1), "invalid", None])
def test_range_maps_require_range_models(value: Any) -> None:
    with pytest.raises(TypeError, match="RangeFilter"):
        SearchDefinition().search().with_facet_filters(ranges={"price": value})


def test_static_dynamic_and_date_fields_resolve_without_copying_static_configuration() -> None:
    definitions = (
        TermsFacet(field="category"),
        NumericHistogramFacet(field="price"),
        DateHistogramFacet(field="created"),
        DynamicFacetFamily(DynamicField("attributes")),
    )
    terms = {"category": ["good"], "categorical_attributes.quality": ["good"]}
    ranges = {
        "price": RangeFilter(min=0, max=1),
        "numeric_attributes.porosity": RangeFilter(min=0, max=1),
        "created": RangeFilter(min="now-2d", max="now-1d"),
    }
    facets = _resolve_facets(definitions, terms, ranges)
    assert all(facets[index] is definitions[index] for index in range(3))
    assert isinstance(facets[3], NumericHistogramFacet)
    assert isinstance(facets[4], TermsFacet)
    assert all(not hasattr(facet, "selection") for facet in facets)


def test_resolution_preserves_aliases_empty_values_and_date_math_across_calls() -> None:
    city = TermsFacet(field="city_name", name="city", keyword=True)
    created = DateHistogramFacet(field="created")
    family = DynamicFacetFamily(DynamicField("attributes"))
    definitions = (city, created, family)
    terms = {"city": [], "categorical_attributes.quality.v2": ["good"]}
    ranges = {"created": RangeFilter(min="now-2d", max="now"), "numeric_attributes.porosity": RangeFilter()}
    facets = _resolve_facets(definitions, terms, ranges)
    assert _resolve_facets(definitions, {}, {}) == (city, created)
    assert _resolve_facets(definitions, terms, ranges) == facets


def test_dynamic_order_keeps_families_sources_and_selections_before_requested_fields() -> None:
    definitions = (
        TermsFacet(field="category"),
        DynamicFacetFamily(DynamicField("other")),
        DateHistogramFacet(field="created"),
        DynamicFacetFamily(DynamicField("attributes")),
    )
    terms = {
        "categorical_attributes.z": [],
        "categorical_other.z": [],
        "categorical_attributes.a": [],
    }
    ranges = {
        "numeric_attributes.z": RangeFilter(),
        "numeric_other.z": RangeFilter(),
        "numeric_attributes.a": RangeFilter(),
    }
    requested = (
        "categorical_attributes.requested",
        "numeric_other.requested",
        "numeric_attributes.a",
        "numeric_attributes.requested",
        "category",
        "categorical_other.requested",
        "categorical_attributes.z",
        "numeric_attributes.requested",
    )

    facets = _resolve_facets(definitions, terms, ranges, facet_names_to_aggregate=requested)

    assert [facet.name for facet in facets] == [
        "category",
        "numeric_other.z",
        "numeric_other.requested",
        "categorical_other.z",
        "categorical_other.requested",
        "created",
        "numeric_attributes.z",
        "numeric_attributes.a",
        "numeric_attributes.requested",
        "categorical_attributes.z",
        "categorical_attributes.a",
        "categorical_attributes.requested",
    ]


def test_wrong_static_kind_never_falls_back_to_dynamic_source() -> None:
    facet = TermsFacet(field="label", name="numeric_attributes.weight")
    static = {facet.name: facet}
    families = (DynamicFacetFamily(DynamicField("attributes")),)
    assert _resolve_field(facet.name, FacetKind.TERM, static, families) is facet
    assert _resolve_field(facet.name, None, static, families) is facet
    with pytest.raises(UnknownFacetError):
        _resolve_field(facet.name, FacetKind.RANGE, static, families)


@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("kind", [None, FacetKind.RANGE, FacetKind.TERM])
def test_dynamic_resolution_preserves_similar_namespaces_and_family_settings(
    reverse: bool, kind: FacetKind | None
) -> None:
    families = (
        DynamicFacetFamily(DynamicField("attributes"), terms_size=17, max_buckets=7),
        DynamicFacetFamily(DynamicField("attributes_extra"), terms_size=23, max_buckets=11),
    )
    if reverse:
        families = tuple(reversed(families))
    for family in families:
        for source in family.source_descriptors:
            if kind is not None and kind is not source.kind:
                continue
            key = f"{source.key}.pore.size"
            expected = (
                NumericHistogramFacet(field=key, source=source.key, max_buckets=family.max_buckets)
                if source.kind is FacetKind.RANGE
                else TermsFacet(field=key, source=source.key, size=family.terms_size)
            )
            assert _resolve_field(key, kind, {}, families) == expected


@pytest.mark.parametrize("namespace", ["numeric_attributes", "categorical_attributes"])
@pytest.mark.parametrize("suffix", ["", "_extra.weight", "weight", "_extra."])
@pytest.mark.parametrize("kind", [None, FacetKind.RANGE, FacetKind.TERM])
def test_dynamic_resolution_requires_an_exact_namespace(namespace: str, suffix: str, kind: FacetKind | None) -> None:
    key = f"{namespace}{suffix}"
    with pytest.raises(UnknownFacetError) as error:
        _resolve_field(key, kind, {}, (DynamicFacetFamily(DynamicField("attributes")),))
    assert error.value.unknown == [key]


@pytest.mark.parametrize(
    "key, kind",
    [("numeric_attributes.weight", FacetKind.TERM), ("categorical_attributes.color", FacetKind.RANGE)],
)
def test_dynamic_resolution_rejects_wrong_filter_kind(key: str, kind: FacetKind) -> None:
    with pytest.raises(InvalidSearchRequestError, match=f"does not accept {kind.value} filters"):
        _resolve_field(key, kind, {}, (DynamicFacetFamily(DynamicField("attributes")),))


@pytest.mark.parametrize(
    "namespace, kind", [("numeric_attributes", FacetKind.RANGE), ("categorical_attributes", FacetKind.TERM)]
)
@pytest.mark.parametrize("infer_kind", [False, True])
def test_dynamic_resolution_rejects_empty_attribute_names(namespace: str, kind: FacetKind, infer_kind: bool) -> None:
    with pytest.raises(InvalidSearchRequestError, match="Dynamic attribute names must not be empty"):
        _resolve_field(
            f"{namespace}.", None if infer_kind else kind, {}, (DynamicFacetFamily(DynamicField("attributes")),)
        )


@pytest.mark.parametrize(
    "facet, bounds",
    [
        (NumericHistogramFacet(field="value"), RangeFilter(min="now")),
        (NumericHistogramFacet(field="value"), RangeFilter(max="now")),
        (DateHistogramFacet(field="value"), RangeFilter(min=0)),
        (DateHistogramFacet(field="value"), RangeFilter(max=0)),
    ],
)
def test_range_types_are_checked_for_both_endpoints(facet: Any, bounds: RangeFilter) -> None:
    with pytest.raises(InvalidSearchRequestError, match="requires"):
        _resolve_facets((facet,), {}, {"value": bounds})


def test_facet_aggregation_selection_retains_hidden_filters_and_static_presence_fields() -> None:
    client = StubSearchClient(total=0)
    static = (
        NumericHistogramFacet(field="price"),
        NumericHistogramFacet(field="fixed_price", interval=5),
        NumericHistogramFacet(field="hidden_price"),
    )
    ranges = {"hidden_price": RangeFilter(min=10, max=20), "numeric_attributes.weight": RangeFilter()}
    result = (
        SearchDefinition(facets=(*static, DynamicFacetFamily(DynamicField("attributes"))))
        .search()
        .using(client)
        .index("items")
        .with_facet_filters(ranges=ranges)
        .aggregate_facets("price", "fixed_price", "numeric_attributes.weight")
        .with_facet_counts()
        .execute()
    )
    bounds, main = client.calls
    assert set(bounds["aggs"]) == {"prefetch_price", "prefetch_numeric_attributes.weight"}
    filters = [{"range": {"hidden_price": {"gte": 10, "lte": 20}}}]
    assert main["post_filter"]["bool"]["filter"] == filters
    assert set(main["aggs"]) == {"hist_price", "hist_fixed_price", "hist_numeric_attributes.weight", "facet_counts"}
    for body in client.calls:
        assert all(aggregation["filter"]["bool"]["filter"] == filters for aggregation in body["aggs"].values())
    assert main["aggs"]["facet_counts"]["aggs"]["by_field"]["filters"]["filters"] == {
        "price": {"exists": {"field": "price"}},
        "fixed_price": {"exists": {"field": "fixed_price"}},
        "hidden_price": {"exists": {"field": "hidden_price"}},
    }
    assert [facet.key for facet in result.facets if facet.aggregated] == [
        "price",
        "fixed_price",
        "numeric_attributes.weight",
    ]


@pytest.mark.parametrize(
    "requested, expected",
    [(("city",), ("city",)), (("city", "brand", "city"), ("brand", "city")), ((), ())],
)
def test_facet_aggregation_selection_preserves_catalog(requested: tuple[str, ...], expected: tuple[str, ...]) -> None:
    client = StubSearchClient(total=0)
    facets = (TermsFacet(field="brand"), TermsFacet(field="country"), TermsFacet(field="city"))
    definition = SearchDefinition(facets=facets)
    result = definition.search().using(client).index("items").aggregate_facets(*requested).execute()

    (body,) = client.calls
    assert tuple(body.get("aggs", {})) == expected
    assert tuple(facet.key for facet in result.facets if facet.aggregated) == expected
    assert {facet.key for facet in result.facets} == {"brand", "country", "city"}
    assert definition.facets == facets


@pytest.mark.parametrize("key", ["unknown", "unknown.weight", "attributes_fields"])
def test_resolution_rejects_unknown_requested_distributions(key: str) -> None:
    definitions = (TermsFacet(field="brand"), DynamicFacetFamily(DynamicField("attributes")))

    with pytest.raises(UnknownFacetError) as error:
        _resolve_facets(definitions, {}, {}, facet_names_to_aggregate=(key,))

    assert error.value.unknown == [key]
    assert set(error.value.known) == {"brand", "numeric_attributes.*", "categorical_attributes.*"}


@pytest.mark.parametrize("facet", [TermsFacet(field="value"), NumericHistogramFacet(field="value")])
def test_requested_distribution_does_not_bypass_filter_kind_validation(
    facet: TermsFacet | NumericHistogramFacet,
) -> None:
    terms = {"value": []} if isinstance(facet, NumericHistogramFacet) else {}
    ranges = {"value": RangeFilter()} if isinstance(facet, TermsFacet) else {}

    with pytest.raises(UnknownFacetError):
        _resolve_facets((facet,), terms, ranges, facet_names_to_aggregate=("value", "value"))
