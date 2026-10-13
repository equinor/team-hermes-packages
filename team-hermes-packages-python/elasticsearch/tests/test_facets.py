"""Facet descriptors, aggregation extraction, and client-facing projection over plain data."""

from copy import deepcopy
from dataclasses import replace

import pytest

from team_hermes.elasticsearch import (
    DateHistogramFacet,
    DynamicFacetFamily,
    FacetBucket,
    FacetData,
    FacetDescriptor,
    FacetKind,
    FacetValueType,
    NumericHistogramFacet,
    RangeFacetResponse,
    RangeFilter,
    SearchDefinition,
    TermFacetResponse,
    TermsFacet,
    project_facets,
)
from team_hermes.elasticsearch.aggregations import AggregationsResponse
from team_hermes.elasticsearch.facet_plan import FacetPlan, _resolve_facets
from team_hermes.elasticsearch.facets.result import HistogramBucket, HistogramData
from team_hermes.elasticsearch.indexing import DynamicField
from team_hermes.elasticsearch.result import _project_search_facets


def term(key: str, *, source: str | None = None) -> FacetDescriptor:
    return FacetDescriptor(key=key, kind=FacetKind.TERM, value_type=FacetValueType.STRING, source=source)


def numeric(key: str, *, source: str | None = None) -> FacetDescriptor:
    return FacetDescriptor(key=key, kind=FacetKind.RANGE, value_type=FacetValueType.NUMBER, source=source)


# ── Flat extraction ────────────────────────────────────────────────────────


@pytest.mark.parametrize("keyword", [False, True])
@pytest.mark.parametrize("order", [None, {"_key": "asc"}])
def test_terms_aggregation_retains_field_size_and_optional_order(keyword: bool, order: dict[str, str] | None) -> None:
    facet = TermsFacet(field="vendor", keyword=keyword, size=25, order=order)
    field = "vendor.keyword" if keyword else "vendor"

    key, aggregation = facet.build_agg(())

    assert key == "vendor"
    assert facet.indexed_field_path == field
    assert aggregation.to_dict() == {
        "filter": {"match_all": {}},
        "aggs": {key: {"terms": {"field": field, "size": 25, **({"order": order} if order is not None else {})}}},
    }


@pytest.mark.parametrize(
    "facet, expected_path",
    [
        (TermsFacet(field="vendor", name="supplier"), "vendor"),
        (TermsFacet(field="vendor", name="supplier", keyword=True), "vendor.keyword"),
        (NumericHistogramFacet(field="price", name="cost"), "price"),
        (DateHistogramFacet(field="created_at", name="created"), "created_at"),
    ],
    ids=["terms", "keyword-terms", "numeric", "date"],
)
def test_indexed_field_path_is_independent_of_facet_name(
    facet: TermsFacet | NumericHistogramFacet | DateHistogramFacet, expected_path: str
) -> None:
    assert facet.indexed_field_path == expected_path
    assert facet.indexed_field_path != facet.name


@pytest.mark.parametrize(
    "response, expected",
    [
        (AggregationsResponse({}), FacetData()),
        (AggregationsResponse({"vendor": {"vendor": {"buckets": []}}}), FacetData()),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}}}),
            FacetData(buckets=[FacetBucket(value="Acme", count=3)]),
        ),
    ],
    ids=["missing", "empty", "populated"],
)
def test_terms_extracts_one_value_by_public_name(response: AggregationsResponse, expected: FacetData) -> None:
    facet = TermsFacet(field="vendor_name", name="vendor", keyword=True)

    actual = facet.extract(response)

    assert actual == expected


@pytest.fixture
def vendor_plan() -> FacetPlan:
    """An aliased term distribution independent of its indexed field path."""
    facet = TermsFacet(field="vendor_name", name="vendor", keyword=True)
    return FacetPlan(catalog=(facet,), filters=(), facets_to_aggregate=(facet,), discovery_families=())


@pytest.mark.parametrize(
    "counts, expected",
    [
        (
            {},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=False, buckets=[]
            ),
        ),
        (
            {"vendor": 0},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=False, buckets=[]
            ),
        ),
        (
            {"vendor": 7},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=7, aggregated=False, buckets=[]
            ),
        ),
    ],
    ids=["no-presence-count", "zero-presence-count", "nonzero-presence-count"],
)
@pytest.mark.parametrize(
    "response",
    [
        AggregationsResponse({}),
        AggregationsResponse({"vendor": {"vendor": {"buckets": []}}}),
        AggregationsResponse({"vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}}}),
    ],
    ids=["missing", "empty", "populated"],
)
def test_unrequested_terms_ignore_distribution_data(
    vendor_plan: FacetPlan,
    response: AggregationsResponse,
    counts: dict[str, int],
    expected: TermFacetResponse,
) -> None:
    plan = replace(vendor_plan, facets_to_aggregate=())

    actual = _project_search_facets(response, facet_plan=plan, counts=counts, exclude=())

    assert actual == [expected]


@pytest.mark.parametrize(
    "response, counts, expected",
    [
        (
            AggregationsResponse({}),
            {},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({}),
            {"vendor": 0},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({}),
            {"vendor": 7},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=7, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": []}}}),
            {},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": []}}}),
            {"vendor": 0},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=0, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": []}}}),
            {"vendor": 7},
            TermFacetResponse(
                key="vendor", value_type=FacetValueType.STRING, source=None, count=7, aggregated=True, buckets=[]
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}}}),
            {},
            TermFacetResponse(
                key="vendor",
                value_type=FacetValueType.STRING,
                source=None,
                count=3,
                aggregated=True,
                buckets=[FacetBucket(value="Acme", count=3)],
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}}}),
            {"vendor": 0},
            TermFacetResponse(
                key="vendor",
                value_type=FacetValueType.STRING,
                source=None,
                count=0,
                aggregated=True,
                buckets=[FacetBucket(value="Acme", count=3)],
            ),
        ),
        (
            AggregationsResponse({"vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}}}),
            {"vendor": 7},
            TermFacetResponse(
                key="vendor",
                value_type=FacetValueType.STRING,
                source=None,
                count=7,
                aggregated=True,
                buckets=[FacetBucket(value="Acme", count=3)],
            ),
        ),
    ],
    ids=[
        "missing",
        "missing-zero",
        "missing-presence",
        "empty",
        "empty-zero",
        "empty-presence",
        "populated",
        "populated-zero",
        "populated-presence",
    ],
)
def test_requested_terms_project_expected_response(
    vendor_plan: FacetPlan,
    response: AggregationsResponse,
    counts: dict[str, int],
    expected: TermFacetResponse,
) -> None:
    actual = _project_search_facets(
        response,
        facet_plan=vendor_plan,
        counts=counts,
        exclude=(),
    )

    assert actual == [expected]


def test_flat_results_merge_terms_histograms_and_stats() -> None:
    terms = {"categorical_attributes.quality": FacetData(buckets=[FacetBucket(value="good", count=3)])}
    numeric = {
        "numeric_attributes.weight": FacetData(
            histogram=HistogramData(buckets=[HistogramBucket(key=1, count=2)]), count=2
        )
    }
    merged = terms | numeric
    assert merged["numeric_attributes.weight"].count == 2
    assert merged["categorical_attributes.quality"].buckets[0].value == "good"
    assert list(terms) == ["categorical_attributes.quality"]


def test_qualified_dynamic_names_do_not_collide_with_static_names() -> None:
    static = {"formation": FacetData(buckets=[FacetBucket(value="static", count=1)])}
    dynamic = {"categorical_attributes.formation": FacetData(buckets=[FacetBucket(value="dynamic", count=9)])}
    merged = static | dynamic
    assert merged["formation"].buckets[0].count == 1
    assert merged["categorical_attributes.formation"].buckets[0].count == 9


def test_flat_merge_retains_term_buckets() -> None:
    root = FacetBucket(value="NORWAY", count=2)
    merged = {"country": FacetData(buckets=[root])} | {"other": FacetData()}
    assert merged["country"].buckets == [root]


def test_numeric_extraction_keeps_stats_when_no_buckets_meet_min_doc_count() -> None:
    data = NumericHistogramFacet(field="price").extract(
        AggregationsResponse(
            {
                "hist_price": {
                    "hist_price": {"buckets": []},
                    "hist_price_stats": {"min": 0, "max": 10, "avg": 4.56, "count": 3},
                }
            }
        )
    )
    assert data.count == 3
    assert data.histogram == HistogramData(min=0, max=10, mean=4.6)


def test_numeric_extraction_preserves_zero_mean_and_all_observed_values() -> None:
    data = NumericHistogramFacet(field="price").extract(
        AggregationsResponse(
            {
                "hist_price": {
                    "hist_price": {"buckets": [{"key": 0, "doc_count": 2}]},
                    "hist_price_stats": {"min": 0, "max": 0, "avg": 0, "count": 3},
                }
            }
        )
    )
    assert data.count == 3  # Stats count is not the bucket sum.
    assert data.histogram == HistogramData(buckets=[HistogramBucket(key=0, count=2)], min=0, max=0, mean=0)


@pytest.mark.parametrize("count", [0, 3])
def test_numeric_extraction_keeps_null_extents_and_numeric_bucket_keys(count: int) -> None:
    data = NumericHistogramFacet(field="price", name="cost").extract(
        AggregationsResponse(
            {
                "hist_cost": {
                    "hist_cost": {"buckets": [{"key": 0, "key_as_string": "zero", "doc_count": 1}]},
                    "hist_cost_stats": {"min": None, "max": None, "avg": None, "count": count},
                }
            }
        )
    )
    assert data == FacetData(histogram=HistogramData(buckets=[HistogramBucket(key=0, count=1)]), count=count)


@pytest.mark.parametrize("count", [0, 3])
def test_date_extraction_without_buckets_ignores_stats_count(count: int) -> None:
    data = DateHistogramFacet(field="created").extract(
        AggregationsResponse(
            {
                "hist_created": {
                    "hist_created": {"buckets": []},
                    "hist_created_stats": {"min": 0, "max": 172800000, "avg": 86400000, "count": count},
                }
            }
        )
    )
    assert data == FacetData()


@pytest.mark.parametrize("count", [0, 3])
@pytest.mark.parametrize("has_stats", [False, True])
def test_date_extraction_uses_bucket_counts_string_keys_and_utc_extents(count: int, has_stats: bool) -> None:
    stats = {"min": 0, "max": 172800000, "avg": 86400000, "count": 99} if has_stats else {}
    data = DateHistogramFacet(field="created_at", name="created").extract(
        AggregationsResponse(
            {
                "hist_created": {
                    "hist_created": {
                        "buckets": [
                            {"key": 0, "key_as_string": "1970-01-01T00:00:00.000Z", "doc_count": count},
                            {"key": 172800000, "doc_count": count},
                        ]
                    },
                    "hist_created_stats": stats,
                }
            }
        )
    )
    assert data == FacetData(
        count=2 * count,
        histogram=HistogramData(
            buckets=[
                HistogramBucket(key="1970-01-01T00:00:00.000Z", count=count),
                HistogramBucket(key="172800000", count=count),
            ],
            min="1970-01-01" if has_stats else None,
            max="1970-01-03" if has_stats else None,
            mean="1970-01-02" if has_stats else None,
        ),
    )


# ── project_facets: arms ───────────────────────────────────────────────────


def test_term_arm_carries_its_buckets() -> None:
    facets = {"analysis_type": FacetData(buckets=[FacetBucket(value="CCA", count=4)])}

    (projected,) = project_facets([term("analysis_type")], facets)

    assert isinstance(projected, TermFacetResponse)
    assert projected.aggregated is True
    assert projected.kind is FacetKind.TERM
    assert projected.buckets[0].value == "CCA"


def test_range_arm_carries_the_histogram_verbatim() -> None:
    facets = {
        "depth_md": FacetData(
            histogram=HistogramData(buckets=[HistogramBucket(key=0.0, count=1)], min=0.0, max=50.0, mean=25.0), count=1
        )
    }

    (projected,) = project_facets([numeric("depth_md")], facets)

    assert isinstance(projected, RangeFacetResponse)
    assert projected.aggregated is True
    assert projected.histogram is not None
    assert (projected.histogram.min, projected.histogram.max, projected.histogram.mean) == (0.0, 50.0, 25.0)
    assert projected.histogram.buckets[0].count == 1


def test_range_arm_falls_back_to_field_stats_when_the_histogram_is_absent() -> None:
    """An aggregated field with no histogram buckets still reports its extent."""
    facets = {"depth_md": FacetData(histogram=HistogramData(min=1.0, max=9.0, mean=5.0), count=7)}

    (projected,) = project_facets([numeric("depth_md")], facets)

    assert isinstance(projected, RangeFacetResponse)
    assert projected.histogram is not None
    assert (projected.histogram.min, projected.histogram.max) == (1.0, 9.0)
    assert projected.histogram.buckets == []


def test_descriptor_metadata_is_carried_through() -> None:
    (projected,) = project_facets([numeric("porosity", source="measurements")], {})

    assert projected.key == "porosity"
    assert projected.source == "measurements"
    assert projected.value_type is FacetValueType.NUMBER


def test_a_term_facet_has_only_flat_bucket_metadata() -> None:
    (projected,) = project_facets([term("category")], {})

    assert isinstance(projected, TermFacetResponse)
    assert "levels" not in projected.model_dump()
    assert FacetBucket(value="A", count=2).model_dump() == {"value": "A", "count": 2}
    assert set(FacetBucket.model_json_schema()["properties"]) == {"value", "count"}
    assert set(TermFacetResponse.model_json_schema()["properties"]) == {
        "key",
        "kind",
        "value_type",
        "source",
        "count",
        "aggregated",
        "buckets",
    }


def test_count_sums_the_flat_term_buckets() -> None:
    facets = {
        "country_identifier": FacetData(
            buckets=[
                FacetBucket(value="NORWAY", count=120),
                FacetBucket(value="UK", count=30),
            ]
        )
    }

    (projected,) = project_facets([term("country_identifier")], facets)

    assert projected.count == 150


def test_a_term_projects_cleanly_when_nothing_was_aggregated() -> None:
    (projected,) = project_facets([term("country_identifier")], {})

    assert isinstance(projected, TermFacetResponse)
    assert (projected.buckets, projected.count, projected.aggregated) == ([], 0, False)


# ── project_facets: aggregated flag ────────────────────────────────────────


@pytest.mark.parametrize(
    "descriptor",
    [term("category"), numeric("depth"), FacetDescriptor("date", FacetKind.RANGE, FacetValueType.DATE)],
    ids=["term", "numeric", "date"],
)
@pytest.mark.parametrize("computed", [False, True])
@pytest.mark.parametrize("count", [None, 0, 7])
def test_aggregated_uses_extracted_membership_even_without_data(
    descriptor: FacetDescriptor, computed: bool, count: int | None
) -> None:
    """Empty computed values differ from absent values; presence counts do not imply computation."""
    extracted = {descriptor.key: FacetData()} if computed else {}
    counts = {} if count is None else {descriptor.key: count}

    (projected,) = project_facets([descriptor], extracted, counts=counts)

    assert projected.aggregated is computed
    if isinstance(projected, TermFacetResponse):
        assert projected.buckets == []
    else:
        assert projected.histogram is None
    if count is not None:
        assert projected.count == count
    assert (descriptor.key in extracted) is computed


# ── project_facets: ordering and de-duplication ────────────────────────────


def test_catalog_order_is_preserved() -> None:
    catalog = [term("b"), term("a"), term("c")]

    assert [f.key for f in project_facets(catalog, {})] == ["b", "a", "c"]


def test_first_descriptor_wins_on_duplicate_keys() -> None:
    """Lets a caller prepend the bound plan's descriptors ahead of a static catalog."""
    catalog = [numeric("porosity", source="measurements"), term("porosity")]

    (projected,) = project_facets(catalog, {})

    assert projected.kind is FacetKind.RANGE
    assert projected.source == "measurements"


# ── project_facets: count resolution ───────────────────────────────────────


def test_count_prefers_the_supplied_counts() -> None:
    facets = {"analysis_type": FacetData(buckets=[FacetBucket(value="CCA", count=4)])}

    (projected,) = project_facets([term("analysis_type")], facets, counts={"analysis_type": 99})

    assert projected.count == 99


def test_count_falls_back_to_the_bucket_sum_for_terms() -> None:
    facets = {
        "analysis_type": FacetData(buckets=[FacetBucket(value="CCA", count=4), FacetBucket(value="SCAL", count=6)])
    }

    (projected,) = project_facets([term("analysis_type")], facets)

    assert projected.count == 10


def test_count_falls_back_to_field_stats_for_ranges() -> None:
    facets = {"depth_md": FacetData(histogram=HistogramData(min=1.0, max=9.0, mean=5.0), count=7)}

    (projected,) = project_facets([numeric("depth_md")], facets)

    assert projected.count == 7


def test_a_zero_count_is_not_skipped_over() -> None:
    """The resolution chain tests for ``None``, not truthiness."""
    facets = {"depth_md": FacetData(count=5)}

    (projected,) = project_facets([numeric("depth_md")], facets, counts={"depth_md": 0})

    assert projected.count == 0


def test_count_is_none_when_nothing_supplies_one() -> None:
    (projected,) = project_facets([numeric("depth_md")], {})

    assert projected.count is None


@pytest.mark.parametrize("descriptor", [term("k"), numeric("k")], ids=["term", "range"])
def test_empty_catalog_and_result_project_cleanly(descriptor: FacetDescriptor) -> None:
    assert project_facets([], {}) == []
    assert len(project_facets([descriptor], {})) == 1


# ── Facet descriptors and resolved catalog projection ──────────────────────


@pytest.mark.parametrize("requested", [(), ("b", "a"), ("b", "c", "a")])
def test_search_projection_keeps_catalog_order_with_requested_facets_first(requested: tuple[str, ...]) -> None:
    resolved = (TermsFacet(field="b"), TermsFacet(field="c"), TermsFacet(field="a"))
    catalog = tuple(facet.describe() for facet in resolved)

    projected = _project_search_facets(
        AggregationsResponse({}),
        facet_plan=FacetPlan(
            catalog=resolved,
            filters=(),
            facets_to_aggregate=tuple(TermsFacet(field=name) for name in requested),
            discovery_families=(),
        ),
        counts={},
        exclude=(),
    )

    expected_order = [key for key in ("b", "c", "a") if key in requested]
    expected_order.extend(key for key in ("b", "c", "a") if key not in requested)
    assert [facet.key for facet in projected] == expected_order
    assert [facet.aggregated for facet in projected] == [key in requested for key in expected_order]
    assert [descriptor.key for descriptor in catalog] == ["b", "c", "a"]


def test_search_projection_keeps_declared_metadata_when_discovery_repeats_a_key() -> None:
    family = DynamicFacetFamily(field=DynamicField("attributes"))
    facet = TermsFacet(field="weight_label", name="numeric_attributes.weight")
    response = AggregationsResponse(
        {
            facet.name: {facet.name: {"buckets": [{"key": "light", "doc_count": 3}]}},
            "attributes_fields": {"attributes_fields": {"buckets": [{"key": facet.name, "doc_count": 5}]}},
        }
    )

    projected = _project_search_facets(
        response,
        facet_plan=FacetPlan(catalog=(facet,), filters=(), facets_to_aggregate=(facet,), discovery_families=(family,)),
        counts={},
        exclude=family.internal_keys,
    )

    assert projected == [
        TermFacetResponse(
            key=facet.name,
            value_type=FacetValueType.STRING,
            source=None,
            count=5,
            aggregated=True,
            buckets=[FacetBucket(value="light", count=3)],
        )
    ]


def test_terms_facet_describes_itself_as_a_string_term() -> None:
    descriptor = TermsFacet(field="vendor").describe()

    assert (descriptor.key, descriptor.kind, descriptor.value_type) == (
        "vendor",
        FacetKind.TERM,
        FacetValueType.STRING,
    )
    assert descriptor.source is None


def test_numeric_histogram_describes_itself_as_a_numeric_range() -> None:
    descriptor = NumericHistogramFacet(field="price").describe()

    assert (descriptor.kind, descriptor.value_type) == (FacetKind.RANGE, FacetValueType.NUMBER)


def test_date_histogram_describes_itself_as_a_date_range() -> None:
    """Dates filter exactly like numbers, so they share the RANGE kind."""
    descriptor = DateHistogramFacet(field="created_at", calendar_interval="year").describe()

    assert (descriptor.kind, descriptor.value_type) == (FacetKind.RANGE, FacetValueType.DATE)


def test_describe_uses_the_facet_name_over_the_field() -> None:
    descriptor = TermsFacet(field="sample_types", name="sample_type").describe()

    assert descriptor.key == "sample_type"


def test_unbound_dynamic_family_contributes_no_catalog_entries() -> None:
    definition = SearchDefinition(facets=(DynamicFacetFamily(field=DynamicField("attributes")),))
    assert _resolve_facets(definition.facets, {}, {}) == ()


def test_bound_dynamic_attribute_retains_its_namespace_as_source() -> None:
    family = DynamicFacetFamily(field=DynamicField("attributes"))
    (bound,) = _resolve_facets((family,), {}, {"numeric_attributes.porosity": RangeFilter()})
    descriptor = bound.describe()

    assert descriptor.key == "numeric_attributes.porosity"
    assert descriptor.source == "numeric_attributes"


def test_dynamic_binding_is_flat_and_does_not_mutate_the_definition() -> None:
    family = DynamicFacetFamily(field=DynamicField("attributes"))
    bound = _resolve_facets((family,), {f"categorical_attributes.{name}": [] for name in ("colour", "grade")}, {})

    assert [(descriptor.key, descriptor.source) for descriptor in (facet.describe() for facet in bound)] == [
        ("categorical_attributes.colour", "categorical_attributes"),
        ("categorical_attributes.grade", "categorical_attributes"),
    ]
    assert all(isinstance(child, TermsFacet) for child in bound)
    assert _resolve_facets((family,), {}, {}) == ()
    assert len(bound) == 2


def test_unselected_plan_catalog_follows_declaration_order() -> None:
    definition = SearchDefinition(facets=(TermsFacet(field="b"), NumericHistogramFacet(field="a")))
    resolved = _resolve_facets(definition.facets, {}, {})

    assert [facet.name for facet in resolved] == ["b", "a"]


def test_resolved_catalog_retains_filtered_dynamic_attributes() -> None:
    definition = SearchDefinition(
        facets=(
            TermsFacet(field="vendor"),
            DynamicFacetFamily(field=DynamicField("attributes")),
        )
    )
    ranges = {"numeric_attributes.porosity": RangeFilter(min=0, max=1)}
    plan = FacetPlan.from_inputs(definitions=definition.facets, terms={}, ranges=ranges)

    assert [facet.name for facet in plan.catalog] == ["vendor", "numeric_attributes.porosity"]
    assert [item.field for item in plan.filters] == ["numeric_attributes.porosity"]


def test_projection_preserves_catalog_counts_and_repeated_results() -> None:
    definition = SearchDefinition(
        facets=(
            TermsFacet(field="category"),
            TermsFacet(field="vendor"),
            DynamicFacetFamily(field=DynamicField("attributes")),
        )
    )
    plan = FacetPlan.from_inputs(
        definitions=definition.facets,
        terms={},
        ranges={},
        facet_names_to_aggregate=("vendor",),
        requested_family_names=("attributes",),
    )
    aggs = AggregationsResponse(
        {
            "vendor": {"vendor": {"buckets": [{"key": "Acme", "doc_count": 3}]}},
            "attributes_fields": {
                "attributes_fields": {"buckets": [{"key": "numeric_attributes.weight", "doc_count": 2}]}
            },
        }
    )
    counts = {"vendor": 0}
    catalog = plan.describe_catalog()
    original_response = deepcopy(aggs)

    facets = _project_search_facets(
        aggs,
        facet_plan=plan,
        counts=counts,
        exclude=definition.internal_facet_keys,
    )

    assert [(facet.key, facet.count, facet.aggregated) for facet in facets] == [
        ("vendor", 0, True),
        ("category", 0, False),
        ("numeric_attributes.weight", 2, False),
    ]
    assert plan.describe_catalog() == catalog
    assert [descriptor.key for descriptor in catalog] == ["category", "vendor"]
    assert counts == {"vendor": 0}
    assert aggs == original_response
    assert (
        _project_search_facets(
            aggs,
            facet_plan=plan,
            counts=counts,
            exclude=definition.internal_facet_keys,
        )
        == facets
    )


@pytest.mark.parametrize("requested_families", [(), ("other",)])
def test_projection_hides_internal_aliases_even_when_their_family_is_not_listed(
    requested_families: tuple[str, ...],
) -> None:
    definition = SearchDefinition(
        facets=(
            TermsFacet(field="vendor", name="attributes_fields"),
            TermsFacet(field="category"),
            DynamicFacetFamily(field=DynamicField("attributes")),
            DynamicFacetFamily(field=DynamicField("other")),
        )
    )
    resolved = _resolve_facets(definition.facets, {}, {})
    catalog = tuple(facet.describe() for facet in resolved)
    facets = _project_search_facets(
        AggregationsResponse({}),
        facet_plan=FacetPlan.from_inputs(
            definitions=definition.facets,
            terms={},
            ranges={},
            facet_names_to_aggregate=tuple(facet.name for facet in resolved),
            requested_family_names=requested_families,
        ),
        counts={},
        exclude=definition.internal_facet_keys,
    )

    assert [descriptor.key for descriptor in catalog] == ["attributes_fields", "category"]
    assert [facet.key for facet in facets] == ["category"]
