"""Structured requests need no generated fields or host-application DTOs."""

from typing import Any

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from team_hermes.elasticsearch import (
    DateHistogramFacet,
    DynamicFacetFamily,
    InvalidSearchRequestError,
    NumericHistogramFacet,
    RangeFilter,
    SearchDefinition,
    SearchRequest,
    SortClause,
    TermsFacet,
    UnknownFacetError,
)
from team_hermes.elasticsearch.indexing import DynamicField
from tests.search_test_helpers import StubSearchClient


@pytest.fixture
def definition() -> SearchDefinition:
    """A host-independent catalog with static and dynamic filter types."""
    return SearchDefinition(
        facets=(
            TermsFacet(field="country"),
            TermsFacet(field="city"),
            TermsFacet(field="page"),
            NumericHistogramFacet(field="price"),
            DateHistogramFacet(field="created", calendar_interval="year"),
            DynamicFacetFamily(field=DynamicField("attributes")),
        ),
    )


def test_static_filters_convert_independent_terms_and_keep_zero_bounds() -> None:
    request = SearchRequest(
        terms={"country": ["NO"], "city": ["Oslo"]},
        ranges={"price": RangeFilter(min=0, max=0), "created": RangeFilter(min="2020-01-01")},
    )

    assert request.terms == {"country": ["NO"], "city": ["Oslo"]}
    assert request.ranges == {"price": RangeFilter(min=0, max=0), "created": RangeFilter(min="2020-01-01")}
    assert request.aggregate_facets == []


@pytest.mark.parametrize("bound", [2**53 + 1, -(2**53 + 1)])
def test_large_integer_bounds_remain_exact_in_the_search_request(bound: int) -> None:
    request = SearchRequest.model_validate(
        {"ranges": {"counter": {"min": bound, "max": bound}}, "include_metadata": False}
    )
    restored = SearchRequest.model_validate_json(request.model_dump_json())
    assert restored.ranges["counter"].min == bound
    assert restored.ranges["counter"].max == bound
    assert type(restored.ranges["counter"].min) is int
    assert type(restored.ranges["counter"].max) is int

    client = StubSearchClient(total=0)
    definition = SearchDefinition.from_mapping({"counter": {"type": "long"}})
    definition.search().using(client).index("items").apply_request(restored).execute()

    assert client.calls[0]["post_filter"]["bool"]["filter"] == [{"range": {"counter": {"gte": bound, "lte": bound}}}]


def test_filter_named_page_does_not_shadow_pagination() -> None:
    request = SearchRequest(page=3, terms={"page": ["catalog-page"]})

    assert request.page == 3
    assert request.terms == {"page": ["catalog-page"]}


def test_metadata_switch_uses_only_canonical_name() -> None:
    request = SearchRequest(include_metadata=False)

    assert request.include_metadata is False
    with pytest.raises(ValidationError):
        SearchRequest.model_validate({"include_facets": False})


def test_open_numeric_and_date_ranges_are_supported() -> None:
    request = SearchRequest(ranges={"price": RangeFilter(), "created": RangeFilter(max="now/d")})

    assert request.ranges == {
        "price": RangeFilter(),
        "created": RangeFilter(max="now/d"),
    }


@pytest.mark.parametrize(
    "values",
    [
        {"page": 0},
        {"per_page": 0},
        {"per_page": 1001},
        {"sort_order": "invalid"},
        {"site": ["Well A"]},
        {"depth_md_min": 0},
        {"measurement_range": ["porosity:0:1"]},
        {"facets": ["country"]},
        {"aggregate_facets": [""]},
        {"aggregate_facets": "country"},
        {"discover_facets": [""]},
        {"discover_facets": "attributes"},
        {"discover": ["attributes"]},
        {"list_available_facets": ["attributes"]},
        {"discover_facets": ["attributes"], "discover": ["other"]},
        {"terms": {"country": "NO"}},
        {"terms": {"country": [1]}},
        {"terms": {"": ["NO"]}},
        {"ranges": {"price": {"min": 2, "max": 1}}},
        {"ranges": {"price": {"min": 1, "max": "now"}}},
        {"ranges": {"price": {"min": True}}},
        {"ranges": {"price": {"min": float("nan")}}},
        {"ranges": {"price": {"max": float("inf")}}},
        {"ranges": {"created": {"min": ""}}},
        {"ranges": {"price": {"minimum": 1}}},
        {"country": ["NO"]},
        {"dynamic": {}},
        {"hierarchy_mode": {}},
        {"hierarchy_modes": {}},
        {"hierarchy_search": {}},
        {"ranges": {"numeric_attributes.weight": {"min": float("inf")}}},
        {"ranges": {"numeric_attributes.weight": {"min": 2, "max": 1}}},
        {"ranges": {"numeric_attributes.weight": {"min": True}}},
        {"terms": {"categorical_attributes.weight": "heavy"}},
    ],
)
def test_invalid_request_shapes_are_rejected(values: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        SearchRequest.model_validate(values)


@pytest.mark.parametrize("field", ["page", "per_page"])
@given(value=st.integers(max_value=0))
def test_nonpositive_pagination_values_are_rejected(field: str, value: int) -> None:
    with pytest.raises(ValidationError) as error:
        SearchRequest.model_validate({field: value})

    assert error.value.errors()[0]["loc"] == (field,)
    assert error.value.errors()[0]["type"] == "greater_than_equal"


@given(per_page=st.integers(min_value=1001))
def test_page_sizes_above_the_limit_are_rejected(per_page: int) -> None:
    with pytest.raises(ValidationError) as error:
        SearchRequest(per_page=per_page)

    assert error.value.errors()[0]["loc"] == ("per_page",)
    assert error.value.errors()[0]["type"] == "less_than_equal"


@pytest.mark.parametrize("field", ["price", "numeric_attributes.weight"])
@given(bounds=st.lists(st.floats(allow_nan=False, allow_infinity=False), min_size=2, max_size=2, unique=True))
def test_inverted_numeric_ranges_are_rejected(field: str, bounds: list[float]) -> None:
    lower, upper = sorted(bounds)

    with pytest.raises(ValidationError) as error:
        SearchRequest.model_validate({"ranges": {field: {"min": upper, "max": lower}}})

    assert error.value.errors()[0]["loc"] == ("ranges", field)


@pytest.mark.parametrize(
    "values",
    [
        {"terms": {"unknown": []}},
        {"terms": {"price": ["1"]}},
        {"ranges": {"unknown": {}}},
        {"ranges": {"country": {"min": 1}}},
        {"discover_facets": ["unknown"]},
        {"ranges": {"unknown.weight": {}}},
        {"ranges": {"numeric_fake.weight": {}}},
        {"ranges": {"weight": {}}},
        {"terms": {"categorical_attributes": []}},
    ],
)
def test_unknown_filter_keys_are_rejected_without_metadata(
    definition: SearchDefinition, values: dict[str, Any]
) -> None:
    request = SearchRequest.model_validate({**values, "include_metadata": False})
    client = StubSearchClient(total=0)

    with pytest.raises(UnknownFacetError):
        definition.search().using(client).index("items").apply_request(request).execute()
    assert client.calls == []


@pytest.mark.parametrize(
    "values",
    [
        {"ranges": {"price": {"min": "1"}}},
        {"ranges": {"created": {"max": 1}}},
        {"terms": {"numeric_attributes.weight": ["heavy"]}},
        {"ranges": {"categorical_attributes.quality": {"min": 0}}},
        {"ranges": {"numeric_attributes.weight": {"min": "1"}}},
        {"ranges": {"numeric_attributes.": {}}},
        {"terms": {"categorical_attributes.": []}},
    ],
)
def test_filter_types_must_match_the_definition(definition: SearchDefinition, values: dict[str, Any]) -> None:
    request = SearchRequest.model_validate(values)
    client = StubSearchClient(total=0)

    with pytest.raises(InvalidSearchRequestError):
        definition.search().using(client).index("items").apply_request(request).execute()
    assert client.calls == []


def test_qualified_namespaces_survive_json_roundtrip() -> None:
    request = SearchRequest(
        discover_facets=["attributes"],
        ranges={"numeric_attributes.weight": RangeFilter(min=0, max=10), "price": RangeFilter(min=1)},
        terms={"categorical_attributes.weight": ["heavy", "light"], "country": ["NO"]},
    )

    restored = SearchRequest.model_validate_json(request.model_dump_json())

    assert restored == request
    assert restored.terms == {
        "categorical_attributes.weight": ["heavy", "light"],
        "country": ["NO"],
    }
    assert restored.ranges == {"numeric_attributes.weight": RangeFilter(min=0, max=10), "price": RangeFilter(min=1)}
    assert "dynamic" not in SearchRequest.model_json_schema()["properties"]


@given(
    terms=st.dictionaries(st.text(min_size=1), st.lists(st.text(), max_size=5), max_size=5),
    bounds=st.lists(st.floats(allow_nan=False, allow_infinity=False), min_size=2, max_size=2),
    page=st.integers(min_value=1),
    per_page=st.integers(min_value=1, max_value=1000),
)
def test_valid_requests_survive_json_roundtrip(
    terms: dict[str, list[str]], bounds: list[float], page: int, per_page: int
) -> None:
    lower, upper = sorted(bounds)
    request = SearchRequest(
        terms=terms,
        ranges={"numeric_attributes.weight": RangeFilter(min=lower, max=upper)},
        discover_facets=["attributes"],
        page=page,
        per_page=per_page,
    )

    restored = SearchRequest.model_validate_json(request.model_dump_json())

    assert restored == request
    assert restored.terms == terms
    assert restored.ranges["numeric_attributes.weight"] == RangeFilter(min=lower, max=upper)
    assert (restored.page, restored.per_page) == (page, per_page)


def test_qualified_attribute_names_keep_dots_and_punctuation() -> None:
    request = SearchRequest(terms={"categorical_attributes.quality.grade:a,b": ["a,b", "c:d"]})
    assert request.terms == {"categorical_attributes.quality.grade:a,b": ["a,b", "c:d"]}


def test_similarly_named_families_resolve_their_own_sources() -> None:
    definition = SearchDefinition(
        facets=(
            DynamicFacetFamily(field=DynamicField("attributes")),
            DynamicFacetFamily(field=DynamicField("attributes_extra")),
        )
    )
    request = SearchRequest(terms={"categorical_attributes_extra.grade": ["good"]})
    assert request.terms == {"categorical_attributes_extra.grade": ["good"]}
    client = StubSearchClient(total=0)
    result = (
        definition.search()
        .using(client)
        .index("items")
        .apply_request(request)
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
        .execute()
    )
    assert client.calls[0]["post_filter"]["bool"]["filter"] == [
        {"terms": {"categorical_attributes_extra.grade": ["good"]}}
    ]
    assert (result.hits, result.facets, result.total, result.pages) == ([], [], None, None)


def test_request_defaults_and_query_filters_do_not_share_mutable_state() -> None:
    request = SearchRequest(terms={"country": ["NO"], "categorical_attributes.weight": ["heavy"]})
    query = SearchDefinition().search().apply_request(request)
    request.terms["country"].append("SE")
    request.aggregate_facets.append("country")
    request.terms["categorical_attributes.weight"].append("light")
    request.ranges["numeric_attributes.weight"] = RangeFilter()

    assert query._terms == {
        "country": ("NO",),
        "categorical_attributes.weight": ("heavy",),
    }
    assert query._ranges == {}
    assert SearchRequest().terms == {}
    assert SearchRequest().aggregate_facets == []
    assert SearchRequest().ranges == {}


def test_empty_dynamic_selections_remain_present() -> None:
    request = SearchRequest(
        terms={"categorical_attributes.quality": []},
        ranges={"numeric_attributes.porosity": RangeFilter()},
    )

    query = SearchDefinition().search().apply_request(request)
    assert query._terms == {"categorical_attributes.quality": ()}
    assert query._ranges == {"numeric_attributes.porosity": RangeFilter()}


def test_date_math_is_not_compared_lexically() -> None:
    request = SearchRequest(ranges={"created": RangeFilter(min="now-2d", max="now-1d")})

    assert request.ranges == {"created": RangeFilter(min="now-2d", max="now-1d")}


def test_conversion_does_not_require_a_search_definition() -> None:
    request = SearchRequest(terms={"application_defined_field": ["value"]})
    assert request.terms == {"application_defined_field": ["value"]}


@pytest.mark.parametrize("by_alias", [False, True])
def test_discover_facets_has_one_python_json_and_schema_name(by_alias: bool) -> None:
    request = SearchRequest(discover_facets=["attributes"])

    assert request.discover_facets == ["attributes"]
    payload = request.model_dump(by_alias=by_alias)
    assert payload["discover_facets"] == ["attributes"]
    assert not {"discover", "list_available_facets"} & payload.keys()
    assert SearchRequest.model_validate_json(request.model_dump_json(by_alias=by_alias)) == request
    for mode in ("validation", "serialization"):
        properties = SearchRequest.model_json_schema(mode=mode)["properties"]
        assert "discover_facets" in properties
        assert not {"discover", "list_available_facets"} & properties.keys()


def test_discover_facets_request_matches_fluent_execution_and_snapshots_input() -> None:
    request = SearchRequest.model_validate({"discover_facets": ["attributes"]})
    client = StubSearchClient(total=0)
    attributes = DynamicFacetFamily(field=DynamicField("attributes"))
    base = SearchDefinition(facets=(attributes,)).search().using(client).index("items")
    applied = base.apply_request(request)
    request.discover_facets.clear()
    assert client.calls == []

    applied.execute()
    base.discover_facets("attributes").execute()
    base.execute()
    assert client.calls[0] == client.calls[1]
    assert set(client.calls[0]["aggs"]) == {"attributes_fields"}
    assert "aggs" not in client.calls[2]
    assert SearchRequest(discover_facets=["attributes"]).model_dump()["discover_facets"] == ["attributes"]
    properties = SearchRequest.model_json_schema()["properties"]
    assert "discover_facets" in properties
    assert not {"discover", "list_available_facets"} & properties.keys()
    assert not hasattr(base, "with_available_facets")


@pytest.mark.parametrize("enabled", [False, True])
def test_http_metadata_switch_controls_both_aggregations_and_exact_totals(enabled: bool) -> None:
    client = StubSearchClient(total=0)
    definition = SearchDefinition(
        facets=(
            TermsFacet(field="brand"),
            NumericHistogramFacet(field="price", interval=10),
            DynamicFacetFamily(field=DynamicField("attributes")),
        ),
    ).with_sorting(default=(SortClause(field="id", order="asc"),))
    base = definition.search().using(client).index("items")
    request = SearchRequest(aggregate_facets=["brand"], include_metadata=enabled)

    base.apply_request(request).execute()
    base.aggregate_facets("brand").with_aggregations(enabled=enabled).with_exact_total(enabled=enabled).execute()

    assert client.calls[0] == client.calls[1]
