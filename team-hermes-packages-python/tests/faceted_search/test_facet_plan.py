"""Facet planning from explicit inputs without query or client dependencies."""

import pytest

from team_hermes.elasticsearch import (
    DateHistogramFacet,
    DynamicFacetFamily,
    FacetDescriptor,
    FacetKind,
    FacetValueType,
    NumericHistogramFacet,
    RangeFilter,
    TermsFacet,
    UnknownFacetError,
)
from team_hermes.elasticsearch.facet_plan import FacetPlan
from team_hermes.elasticsearch.indexing import DynamicField


def test_empty_catalog_produces_an_empty_plan() -> None:
    plan = FacetPlan.from_inputs(definitions=(), terms={}, ranges={})

    assert plan == FacetPlan(catalog=(), filters=(), facets_to_aggregate=(), discovery_families=())
    assert plan.describe_catalog() == ()


def test_describe_catalog_preserves_order_aliases_types_and_dynamic_sources() -> None:
    brand = TermsFacet(field="brand_name", name="brand", keyword=True)
    created = DateHistogramFacet(field="created_at", name="created")
    attributes = DynamicFacetFamily(field=DynamicField("attributes"))
    plan = FacetPlan.from_inputs(
        definitions=(brand, attributes, created),
        terms={"categorical_attributes.quality": []},
        ranges={},
        facet_names_to_aggregate=("numeric_attributes.porosity",),
        requested_family_names=("attributes",),
    )

    descriptors = plan.describe_catalog()

    assert descriptors == (
        FacetDescriptor("brand", FacetKind.TERM, FacetValueType.STRING),
        FacetDescriptor(
            "numeric_attributes.porosity", FacetKind.RANGE, FacetValueType.NUMBER, source="numeric_attributes"
        ),
        FacetDescriptor(
            "categorical_attributes.quality", FacetKind.TERM, FacetValueType.STRING, source="categorical_attributes"
        ),
        FacetDescriptor("created", FacetKind.RANGE, FacetValueType.DATE),
    )
    assert plan.describe_catalog() == descriptors
    assert tuple(facet.name for facet in plan.catalog) == tuple(descriptor.key for descriptor in descriptors)


def test_unrequested_facets_remain_in_catalog_without_calculations() -> None:
    brand = TermsFacet(field="brand")
    attributes = DynamicFacetFamily(field=DynamicField("attributes"))

    plan = FacetPlan.from_inputs(definitions=(brand, attributes), terms={}, ranges={})

    assert plan.catalog == (brand,)
    assert plan.filters == ()
    assert plan.facets_to_aggregate == ()
    assert plan.discovery_families == ()


def test_alias_filters_and_facets_to_aggregate_follow_catalog_order() -> None:
    brand = TermsFacet(field="brand_name", name="brand", keyword=True)
    price = NumericHistogramFacet(field="price")

    plan = FacetPlan.from_inputs(
        definitions=(brand, price),
        terms={"brand": ["Acme"]},
        ranges={},
        facet_names_to_aggregate=("price", "brand", "price"),
    )

    assert plan.catalog == (brand, price)
    assert plan.facets_to_aggregate == (brand, price)
    assert [selection.query.to_dict() for selection in plan.filters] == [{"terms": {"brand_name.keyword": ["Acme"]}}]
    assert plan.discovery_families == ()


def test_dynamic_discovery_and_distributions_remain_independent_of_filters() -> None:
    attributes = DynamicFacetFamily(field=DynamicField("attributes"))

    plan = FacetPlan.from_inputs(
        definitions=(attributes,),
        terms={"categorical_attributes.quality": ["good"]},
        ranges={"numeric_attributes.porosity": RangeFilter(min=0)},
        facet_names_to_aggregate=("categorical_attributes.quality",),
        requested_family_names=("attributes",),
    )

    assert [facet.name for facet in plan.catalog] == [
        "numeric_attributes.porosity",
        "categorical_attributes.quality",
    ]
    assert [facet.name for facet in plan.facets_to_aggregate] == ["categorical_attributes.quality"]
    assert plan.discovery_families == (attributes,)
    assert [selection.query.to_dict() for selection in plan.filters] == [
        {"range": {"numeric_attributes.porosity": {"gte": 0}}},
        {"terms": {"categorical_attributes.quality": ["good"]}},
    ]


def test_unknown_discovery_family_is_rejected_before_unknown_selection() -> None:
    with pytest.raises(UnknownFacetError, match="unknown_family"):
        FacetPlan.from_inputs(
            definitions=(),
            terms={"unknown_facet": ["value"]},
            ranges={},
            requested_family_names=("unknown_family",),
        )


def test_unknown_requested_distribution_is_rejected() -> None:
    with pytest.raises(UnknownFacetError, match="unknown_facet"):
        FacetPlan.from_inputs(definitions=(), terms={}, ranges={}, facet_names_to_aggregate=("unknown_facet",))


def test_filters_preserve_catalog_order_aliases_kinds_and_date_math() -> None:
    definitions = (
        TermsFacet(field="city_name", name="city", keyword=True),
        NumericHistogramFacet(field="price"),
        DateHistogramFacet(field="created_at", name="created"),
        DynamicFacetFamily(DynamicField("attributes")),
    )
    plan = FacetPlan.from_inputs(
        definitions=definitions,
        terms={"categorical_attributes.quality.v2": ["good"], "city": ["Oslo", "Bergen"]},
        ranges={
            "numeric_attributes.porosity": RangeFilter(max=1),
            "created": RangeFilter(min="now-2d", max="now"),
            "price": RangeFilter(min=0, max=10),
        },
    )

    assert [(selection.field, selection.kind, selection.query.to_dict()) for selection in plan.filters] == [
        ("city_name", FacetKind.TERM, {"terms": {"city_name.keyword": ["Oslo", "Bergen"]}}),
        ("price", FacetKind.RANGE, {"range": {"price": {"gte": 0, "lte": 10}}}),
        ("created_at", FacetKind.RANGE, {"range": {"created_at": {"gte": "now-2d", "lte": "now"}}}),
        ("numeric_attributes.porosity", FacetKind.RANGE, {"range": {"numeric_attributes.porosity": {"lte": 1}}}),
        (
            "categorical_attributes.quality.v2",
            FacetKind.TERM,
            {"terms": {"categorical_attributes.quality.v2": ["good"]}},
        ),
    ]
    assert plan.facets_to_aggregate == ()


def test_empty_terms_and_open_ranges_retain_catalog_without_filters() -> None:
    definitions = (
        TermsFacet(field="city"),
        NumericHistogramFacet(field="price"),
        DateHistogramFacet(field="created"),
        DynamicFacetFamily(DynamicField("attributes")),
    )
    plan = FacetPlan.from_inputs(
        definitions=definitions,
        terms={"city": [], "categorical_attributes.quality": []},
        ranges={"price": RangeFilter(), "created": RangeFilter(), "numeric_attributes.porosity": RangeFilter()},
    )

    assert plan.filters == ()
    assert tuple(facet.name for facet in plan.catalog) == (
        "city",
        "price",
        "created",
        "numeric_attributes.porosity",
        "categorical_attributes.quality",
    )


@pytest.mark.parametrize(
    "requested, expected",
    [
        ((), ()),
        (("second",), ("second",)),
        (("second", "first", "second"), ("first", "second")),
    ],
)
def test_discovery_selection_preserves_definition_order_without_duplicates(
    requested: tuple[str, ...], expected: tuple[str, ...]
) -> None:
    families = (DynamicFacetFamily(DynamicField("first")), DynamicFacetFamily(DynamicField("second")))

    plan = FacetPlan.from_inputs(definitions=families, terms={}, ranges={}, requested_family_names=requested)

    assert tuple(family.name for family in plan.discovery_families) == expected
    assert plan.catalog == ()
    assert plan.filters == ()
    assert plan.facets_to_aggregate == ()


def test_unknown_discovery_families_report_sorted_unique_names() -> None:
    families = (DynamicFacetFamily(DynamicField("second")), DynamicFacetFamily(DynamicField("first")))

    with pytest.raises(UnknownFacetError) as error:
        FacetPlan.from_inputs(
            definitions=families,
            terms={},
            ranges={},
            requested_family_names=("unknown_z", "first", "unknown_a", "unknown_z"),
        )

    assert error.value.unknown == ["unknown_a", "unknown_z"]
    assert error.value.known == ["first", "second"]
