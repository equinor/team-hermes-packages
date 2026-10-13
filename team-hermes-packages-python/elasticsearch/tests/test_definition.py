"""Search definitions infer static catalogs, dynamic families, and sorting from mappings and documents."""

from collections.abc import Mapping
from copy import deepcopy
from dataclasses import replace
from types import MappingProxyType
from typing import Any, ClassVar

import pytest
from elasticsearch.dsl import Document, Float, Keyword, Q, Text
from pytest_mock import MockerFixture

from team_hermes.elasticsearch import (
    DateHistogramFacet,
    DynamicFacetFamily,
    NumericHistogramFacet,
    SearchDefinition,
    SearchRequest,
    SortClause,
    TermsFacet,
    UnknownFacetError,
    owned_fields,
    sortable_from_mapping,
)
from team_hermes.elasticsearch.errors import InvalidSearchRequestError
from team_hermes.elasticsearch.facet_plan import FacetPlan
from team_hermes.elasticsearch.indexing import DynamicField
from team_hermes.elasticsearch.mapping import FieldMapping, facets_from_mapping
from tests.search_test_helpers import StubSearchClient


class SampleDocument(Document):
    attributes: ClassVar[DynamicField] = DynamicField("attributes")
    author = Keyword()


ATTRIBUTES = DynamicFacetFamily(field=SampleDocument.attributes)


@pytest.fixture
def properties() -> dict[str, FieldMapping]:
    """Plain mapping metadata isolated from the DSL document's nested dictionaries."""
    return deepcopy(SampleDocument._doc_type.mapping.to_dict()["properties"])


def test_mapping_fixture_does_not_share_nested_metadata_with_document(properties: dict[str, FieldMapping]) -> None:
    metadata = properties["attributes_fields"]["meta"]
    assert isinstance(metadata, dict)

    metadata["family"] = "changed"

    original = SampleDocument._doc_type.mapping.to_dict()["properties"]
    assert original["attributes_fields"]["meta"]["family"] == "attributes"


def test_infers_dynamic_family_alongside_static_facets(properties: dict[str, FieldMapping]) -> None:
    definition = SearchDefinition.from_mapping(properties)

    assert definition.facets == (DynamicFacetFamily(field=SampleDocument.attributes), TermsFacet(field="author"))
    assert definition.static_facets == (TermsFacet(field="author"),)
    assert len(definition.dynamic_facet_families) == 1


def test_inferred_family_matches_explicit_filter_and_listing_behavior(properties: dict[str, FieldMapping]) -> None:
    inferred = SearchDefinition.from_mapping(properties)
    explicit = SearchDefinition.from_mapping(properties).with_facets(
        overrides=(DynamicFacetFamily(field=SampleDocument.attributes),)
    )
    request = SearchRequest.model_validate(
        {
            "ranges": {"numeric_attributes.weight": {"min": 0, "max": 9}},
            "terms": {"categorical_attributes.colour": ["red"]},
            "discover_facets": ["attributes"],
        }
    )

    assert inferred == explicit
    plan = FacetPlan.from_inputs(
        definitions=inferred.facets,
        terms=request.terms,
        ranges=request.ranges,
        requested_family_names=request.discover_facets,
    )
    assert plan == FacetPlan.from_inputs(
        definitions=explicit.facets,
        terms=request.terms,
        ranges=request.ranges,
        requested_family_names=request.discover_facets,
    )
    assert [item.field for item in plan.filters] == [
        "numeric_attributes.weight",
        "categorical_attributes.colour",
    ]
    assert plan.discovery_families == inferred.dynamic_facet_families


def test_policy_override_replaces_inferred_family_without_duplication(properties: dict[str, FieldMapping]) -> None:
    override = DynamicFacetFamily(field=SampleDocument.attributes, terms_size=100, discovery_size=200, max_buckets=40)
    definition = SearchDefinition.from_mapping(properties).with_facets(overrides=(override,))

    assert definition.dynamic_facet_families == (override,)
    assert definition.dynamic_facet_families[0] is override
    assert definition.facets == (override, TermsFacet(field="author"))


@pytest.mark.parametrize(
    "excluded", ["attributes", "attributes_fields", "numeric_attributes", "categorical_attributes"]
)
def test_excluding_family_or_storage_hides_whole_family(properties: dict[str, FieldMapping], excluded: str) -> None:
    definition = SearchDefinition.from_mapping(properties).with_facets(exclude=(excluded,))

    assert definition.facets == (TermsFacet(field="author"),)
    assert definition.dynamic_facet_families == ()


def test_explicit_override_takes_precedence_over_exclusion(properties: dict[str, FieldMapping]) -> None:
    override = DynamicFacetFamily(field=SampleDocument.attributes, terms_size=100)
    definition = SearchDefinition.from_mapping(properties).with_facets(overrides=(override,), exclude=("attributes",))

    assert definition.dynamic_facet_families == (override,)


def test_inference_respects_histogram_bucket_policy(properties: dict[str, FieldMapping]) -> None:
    family, _ = facets_from_mapping(properties, max_histogram_buckets=25)

    assert isinstance(family, DynamicFacetFamily)
    assert family.max_buckets == 25


@pytest.mark.parametrize("family", [None, 12, "", "invalid.family"])
def test_invalid_family_metadata_fails_fast(properties: dict[str, FieldMapping], family: Any) -> None:
    properties["attributes_fields"]["meta"] = {**properties["attributes_fields"]["meta"], "family": family}

    with pytest.raises(ValueError):
        SearchDefinition.from_mapping(properties)


@pytest.mark.parametrize("change", ["wrong_name", "wrong_type", "no_doc_values", "disabled"])
def test_invalid_catalog_mapping_fails_fast(properties: dict[str, FieldMapping], change: str) -> None:
    catalog = properties["attributes_fields"]
    if change == "wrong_name":
        properties["other"] = properties.pop("attributes_fields")
    elif change == "wrong_type":
        catalog["type"] = "float"
    elif change == "no_doc_values":
        catalog["doc_values"] = False
    else:
        catalog["enabled"] = False

    with pytest.raises(ValueError, match="Invalid dynamic catalog"):
        SearchDefinition.from_mapping(properties)


@pytest.mark.parametrize("path", ["numeric_attributes", "categorical_attributes"])
@pytest.mark.parametrize("mapping", [None, {"type": "keyword"}, {"type": "object", "enabled": False}])
def test_missing_or_invalid_namespace_fails_fast(
    properties: dict[str, FieldMapping], path: str, mapping: FieldMapping | None
) -> None:
    if mapping is None:
        del properties[path]
    else:
        properties[path] = mapping

    with pytest.raises(ValueError, match="requires object namespace"):
        SearchDefinition.from_mapping(properties)


def test_unmarked_catalog_is_not_guessed_to_be_dynamic(properties: dict[str, FieldMapping]) -> None:
    del properties["attributes_fields"]["meta"]
    definition = SearchDefinition.from_mapping(properties)

    assert definition.dynamic_facet_families == ()
    assert {facet.name for facet in definition.facets} == {"author", "attributes_fields"}


@pytest.mark.parametrize("key", ["numeric_attributes.weight", "categorical_attributes.colour"])
def test_inferred_sort_namespaces_survive_ordering_configuration(
    properties: dict[str, FieldMapping], key: str
) -> None:
    definition = SearchDefinition.from_mapping(properties).with_sorting(
        default=(SortClause(field="_score", order="desc"),), tiebreakers=(SortClause(field="doc_id", order="asc"),)
    )

    assert definition.search().sort(key, "desc")._sort == (
        SortClause(field=key, order="desc", missing="_last"),
        SortClause(field="doc_id", order="asc"),
    )
    assert definition.search()._sort == (
        SortClause(field="_score", order="desc"),
        SortClause(field="doc_id", order="asc"),
    )


@pytest.mark.parametrize("excluded", ["attributes", "numeric_attributes", "attributes_fields"])
def test_facet_exclusions_do_not_remove_sort_namespaces(properties: dict[str, FieldMapping], excluded: str) -> None:
    definition = SearchDefinition.from_mapping(properties).with_facets(exclude=(excluded,))

    assert definition.dynamic_facet_families == ()
    for path in SampleDocument.attributes.paths:
        assert definition.search().sort(f"{path}.weight")._sort == (
            SortClause(field=f"{path}.weight", order="asc", missing="_last"),
        )


@pytest.mark.parametrize(
    ("excluded", "allowed"),
    [
        ("attributes", set()),
        ("numeric_attributes", {"categorical_attributes"}),
        ("categorical_attributes", {"numeric_attributes"}),
        ("attributes_fields", {"numeric_attributes", "categorical_attributes"}),
        ("author", {"numeric_attributes", "categorical_attributes"}),
    ],
)
def test_sort_exclusions_apply_to_families_or_individual_namespaces(
    properties: dict[str, FieldMapping], excluded: str, allowed: set[str]
) -> None:
    definition = SearchDefinition.from_mapping(properties).with_sorting(exclude=(excluded,))

    assert len(definition.dynamic_facet_families) == 1
    for path in SampleDocument.attributes.paths:
        key = f"{path}.weight"
        if path in allowed:
            assert definition.search().sort(key)._sort == (SortClause(field=key, order="asc", missing="_last"),)
        else:
            with pytest.raises(InvalidSearchRequestError):
                definition.search().sort(key)
    if excluded == "author":
        with pytest.raises(InvalidSearchRequestError):
            definition.search().sort("author")


@pytest.mark.parametrize(
    "key", ["attributes_fields", "numeric_attributes.", "numeric_attributes.bad/name", "other.weight"]
)
def test_inferred_sorting_rejects_catalogs_and_invalid_names(properties: dict[str, FieldMapping], key: str) -> None:
    definition = SearchDefinition.from_mapping(properties)

    assert definition.sorting.fields == {"author": "author"}
    with pytest.raises(InvalidSearchRequestError):
        definition.search().sort(key)


def test_document_factory_matches_mapping_without_connection(
    properties: dict[str, FieldMapping], mocker: MockerFixture
) -> None:
    # Run the real factory; patch only the network boundary to catch accidental I/O.
    connection = mocker.patch(
        "elasticsearch.dsl.connections.get_connection",
        side_effect=AssertionError("Document inference must not connect to Elasticsearch"),
    )

    definition = SearchDefinition.from_document(SampleDocument)

    assert definition == SearchDefinition.from_mapping(properties)
    assert SampleDocument._doc_type.mapping.to_dict()["properties"] == properties
    connection.assert_not_called()


@pytest.fixture(params=["mapping", "document"])
def readme_definition(request: pytest.FixtureRequest) -> SearchDefinition:
    """The two equivalent product definitions shown in the README."""

    class ProductDocument(Document):
        product_id = Keyword()
        tenant_id = Keyword()
        brand = Keyword()
        price = Float()

    return (
        SearchDefinition.from_document(ProductDocument)
        if request.param == "document"
        else SearchDefinition.from_mapping(
            {
                "product_id": {"type": "keyword"},
                "tenant_id": {"type": "keyword"},
                "brand": {"type": "keyword"},
                "price": {"type": "float"},
            }
        )
    )


@pytest.fixture(params=[None, "Acme"], ids=["no-text", "text"])
def readme_request(request: pytest.FixtureRequest) -> SearchRequest:
    """The quick-start HTTP controls, with optional application-owned text input."""
    return SearchRequest.model_validate(
        {
            "q": request.param,
            "terms": {"brand": ["Acme"]},
            "ranges": {"price": {"min": 10, "max": 50}},
            "aggregate_facets": ["brand", "price"],
            "include_facet_counts": True,
            "sort_by": "price",
            "sort_order": "asc",
            "page": 1,
            "per_page": 20,
        }
    )


def test_readme_quick_start_connects_request_and_execution(
    readme_definition: SearchDefinition, readme_request: SearchRequest
) -> None:
    client = StubSearchClient(total=1, hits=[{"_source": {"product_id": "p-1", "brand": "Acme", "price": 20}}])
    query = (
        readme_definition.with_facets(
            overrides=(NumericHistogramFacet(field="price", interval=10),), exclude={"product_id", "tenant_id"}
        )
        .with_sorting(tiebreakers=(SortClause(field="product_id", order="asc"),))
        .search()
        .using(client)
        .index("products")
        .add_base_filter(Q("term", tenant_id="tenant-1"))
        .apply_request(readme_request)
    )
    if readme_request.q:
        query = query.query(Q("match", brand=readme_request.q))
    assert client.calls == []

    result = query.execute()

    (body,) = client.calls
    assert client.indices == ["products"]
    assert body["query"]["bool"]["filter"] == [{"term": {"tenant_id": "tenant-1"}}]
    expected_query = {"match": {"brand": readme_request.q}} if readme_request.q else {"match_all": {}}
    assert body["query"]["bool"]["must"] == [expected_query]
    assert body["sort"] == [{"price": {"order": "asc", "missing": "_last"}}, {"product_id": {"order": "asc"}}]
    assert (body["from"], body["size"], body["track_total_hits"]) == (0, 20, True)
    assert set(body["aggs"]) == {"brand", "hist_price", "facet_counts"}
    assert body["post_filter"]["bool"]["filter"] == [
        {"range": {"price": {"gte": 10, "lte": 50}}},
        {"terms": {"brand": ["Acme"]}},
    ]
    assert {facet.key for facet in result.facets if facet.aggregated} == {"brand", "price"}
    assert result.hits[0].product_id == "p-1"
    assert (result.total, result.page, result.pages) == (1, 1, 1)
    assert len(readme_definition.facets) == 4


def test_document_and_mapping_factories_support_the_same_fluent_options(properties: dict[str, FieldMapping]) -> None:
    override = DynamicFacetFamily(field=SampleDocument.attributes, terms_size=100)

    definition = (
        SearchDefinition.from_document(
            SampleDocument,
            max_result_window=500,
            supports_cursor_pagination=False,
        )
        .with_facets(overrides=(override,), exclude={"author"})
        .with_sorting(exclude={"author", "numeric_attributes"})
    )

    assert definition == SearchDefinition.from_mapping(
        properties,
        max_result_window=500,
        supports_cursor_pagination=False,
    ).with_facets(overrides=(override,), exclude={"author"}).with_sorting(exclude={"author", "numeric_attributes"})


def test_document_factory_includes_inherited_and_declared_fields() -> None:
    class ExtendedDocument(SampleDocument):
        measurements: ClassVar[DynamicField] = DynamicField("measurements")
        title = Text(fields={"keyword": Keyword()})

    definition = SearchDefinition.from_document(ExtendedDocument)

    assert definition == SearchDefinition.from_mapping(ExtendedDocument._doc_type.mapping.to_dict()["properties"])
    assert {facet.name for facet in definition.facets} == {"attributes", "measurements", "author", "title"}
    assert definition.sorting.fields == {"author": "author", "title": "title.keyword"}
    assert definition.sorting.namespaces == frozenset(
        (*SampleDocument.attributes.paths, *ExtendedDocument.measurements.paths)
    )


def test_document_factory_handles_empty_document() -> None:
    class EmptyDocument(Document):
        pass

    definition = SearchDefinition.from_document(EmptyDocument)

    assert definition == SearchDefinition.from_mapping({})
    assert definition.facets == ()
    assert definition.sorting.fields == {}
    assert definition.sorting.namespaces == frozenset()


def test_document_factory_preserves_defaults_instead_of_reading_index_settings(
    properties: dict[str, FieldMapping],
) -> None:
    class ConfiguredDocument(SampleDocument):
        class Index:
            name = "document-factory-test"
            settings = {"max_result_window": 500}

    assert SearchDefinition.from_document(ConfiguredDocument) == SearchDefinition.from_mapping(properties)


def test_document_factory_preserves_search_definition_subclass() -> None:
    class CustomSearchDefinition(SearchDefinition):
        pass

    definition = CustomSearchDefinition.from_document(SampleDocument)

    assert isinstance(definition, CustomSearchDefinition)


def test_explicit_namespaces_replace_or_disable_inference_without_mutating_definition(
    properties: dict[str, FieldMapping],
) -> None:
    definition = SearchDefinition.from_mapping(properties)
    for namespaces in ((), ("other",)):
        updated = definition.with_sorting(namespaces=namespaces)
        with pytest.raises(InvalidSearchRequestError):
            updated.search().sort("numeric_attributes.weight")
        assert definition.search().sort("numeric_attributes.weight")._sort == (
            SortClause(field="numeric_attributes.weight", order="asc", missing="_last"),
        )
    assert definition.with_sorting(namespaces=("other",)).search().sort("other.weight")._sort == (
        SortClause(field="other.weight", order="asc", missing="_last"),
    )


def test_replacing_facets_does_not_change_mapping_derived_sorting(properties: dict[str, FieldMapping]) -> None:
    definition = SearchDefinition.from_mapping(properties)
    other = DynamicFacetFamily(field=DynamicField("other"))
    for updated in (replace(definition, facets=()), replace(definition, facets=(other,))):
        assert updated.search().sort("numeric_attributes.weight")._sort == (
            SortClause(field="numeric_attributes.weight", order="asc", missing="_last"),
        )
        with pytest.raises(InvalidSearchRequestError):
            updated.search().sort("numeric_other.weight")


def test_explicit_facets_do_not_grant_sort_namespaces_without_mapping_metadata(
    properties: dict[str, FieldMapping],
) -> None:
    del properties["attributes_fields"]["meta"]
    definition = SearchDefinition.from_mapping(properties).with_facets(
        overrides=(DynamicFacetFamily(field=SampleDocument.attributes),)
    )

    with pytest.raises(InvalidSearchRequestError):
        definition.search().sort("numeric_attributes.weight")


def test_sort_inference_includes_multiple_dynamic_families() -> None:
    class ExtendedDocument(SampleDocument):
        measurements: ClassVar[DynamicField] = DynamicField("measurements")

    definition = SearchDefinition.from_mapping(ExtendedDocument._doc_type.mapping.to_dict()["properties"])

    for path in (*SampleDocument.attributes.paths, *ExtendedDocument.measurements.paths):
        assert definition.search().sort(f"{path}.weight")._sort == (
            SortClause(field=f"{path}.weight", order="asc", missing="_last"),
        )
    assert definition.sorting.fields == {"author": "author"}


# ── Static catalog and indexed storage paths ───────────────────────────────


def test_overrides_own_indexed_paths_not_public_aliases() -> None:
    override = TermsFacet(field="sample_types", name="sample_type")
    catalog = (
        SearchDefinition.from_mapping({"sample_types": {"type": "keyword"}}).with_facets(overrides=(override,)).facets
    )

    assert catalog == (override,)
    assert owned_fields(catalog) == {"sample_types"}


def test_aliased_terms_own_their_individual_indexed_fields() -> None:
    facets = (TermsFacet(field="country_code", name="country"), TermsFacet(field="city_code", name="city"))
    assert owned_fields(facets) == {"country_code", "city_code"}


def test_owned_fields_combines_static_fields_and_dynamic_storage_from_an_iterator() -> None:
    family = DynamicFacetFamily(DynamicField("attributes"))
    facets = (
        TermsFacet(field="city_name", name="city", keyword=True),
        TermsFacet(field="city_name", name="other_city"),
        NumericHistogramFacet(field="price", name="cost"),
        DateHistogramFacet(field="created_at", name="created"),
        family,
    )

    assert owned_fields(iter(facets)) == frozenset(
        {"city_name", "price", "created_at", "numeric_attributes", "categorical_attributes", "attributes_fields"}
    )


def test_owned_fields_accepts_empty_input() -> None:
    assert owned_fields(()) == frozenset()


def test_owned_fields_rejects_unsupported_configuration() -> None:
    unsupported: Any = object()

    with pytest.raises(TypeError, match="Cannot infer indexed fields for object"):
        owned_fields((unsupported,))


@pytest.mark.parametrize(
    "mapping",
    [
        {"type": "keyword", "doc_values": False},
        {"type": "text", "fields": {"keyword": {"type": "text"}}},
        {"type": "text", "fields": {"keyword": {"type": "keyword", "doc_values": False}}},
        {"type": "dense_vector"},
        {"type": "geo_point"},
        {"type": "object", "dynamic": True},
        {"type": "object", "enabled": False},
    ],
)
def test_unsupported_storage_does_not_become_a_facet_or_sort(mapping: FieldMapping) -> None:
    assert facets_from_mapping({"unsupported": mapping}) == ()
    assert sortable_from_mapping({"unsupported": mapping}) == frozenset()


@pytest.mark.parametrize(
    ("mapping", "path"),
    [
        ({"type": "keyword"}, "value"),
        ({"type": "integer"}, "value"),
        ({"type": "long"}, "value"),
        ({"type": "float"}, "value"),
        ({"type": "date"}, "value"),
        ({"type": "text", "fields": {"keyword": {"type": "keyword"}}}, "value.keyword"),
    ],
)
def test_public_sorts_resolve_supported_mapping_types(mapping: FieldMapping, path: str) -> None:
    definition = SearchDefinition.from_mapping({"value": mapping}).with_sorting(
        tiebreakers=(SortClause(field="id", order="asc"),)
    )
    client = StubSearchClient(total=0)

    definition.search().using(client).index("items").sort("value", "desc").execute()

    assert definition.sorting.fields == {"value": path}
    assert client.calls[0]["sort"] == [{path: {"order": "desc", "missing": "_last"}}, {"id": {"order": "asc"}}]


def test_mapping_inference_accepts_typed_nested_properties() -> None:
    properties: Mapping[str, FieldMapping] = MappingProxyType(
        {
            "title": {
                "type": "text",
                "fields": MappingProxyType({"keyword": {"type": "keyword"}}),
                "meta": {"description": "Document title"},
            },
            "details": {
                "type": "object",
                "properties": {"weight": {"type": "float"}},
                "dynamic": "strict",
            },
            "disabled": {"type": "keyword", "enabled": False},
            "no_doc_values": {"type": "keyword", "doc_values": False},
            "unspecified": {},
        }
    )

    definition = SearchDefinition.from_mapping(properties)

    assert definition.facets == (TermsFacet(field="title", keyword=True),)
    assert definition.sorting.fields == {"title": "title.keyword"}
    assert definition.sorting.namespaces == frozenset()


def test_facet_exclusions_and_public_sort_exclusions_are_independent() -> None:
    definition = (
        SearchDefinition.from_mapping(
            {name: {"type": "keyword"} for name in ("id", "category", "doc_id")},
        )
        .with_facets(exclude={"id", "doc_id"})
        .with_sorting(exclude={"doc_id"})
    )

    assert owned_fields(definition.facets) == {"category"}
    assert definition.sorting.fields == {"id": "id", "category": "category"}


def test_fluent_configuration_without_options_preserves_all_capabilities(properties: dict[str, FieldMapping]) -> None:
    definition = SearchDefinition.from_mapping(properties).with_sorting(
        default=(SortClause(field="author", order="asc"),), tiebreakers=(SortClause(field="doc_id", order="asc"),)
    )

    assert definition.with_facets().with_sorting() == definition
    assert definition.with_facets(overrides=(), exclude=()) == definition


@pytest.mark.parametrize("exclude", ["attributes", "numeric_attributes", "categorical_attributes"])
def test_sort_family_exclusions_work_after_facets_are_removed(
    properties: dict[str, FieldMapping], exclude: str
) -> None:
    base = SearchDefinition.from_mapping(properties)
    facets_first = base.with_facets(exclude={"attributes"}).with_sorting(exclude={exclude})
    sorting_first = base.with_sorting(exclude={exclude}).with_facets(exclude={"attributes"})

    assert facets_first == sorting_first
    assert facets_first.dynamic_facet_families == ()
    expected = frozenset() if exclude == "attributes" else frozenset(SampleDocument.attributes.paths) - {exclude}
    assert facets_first.sorting.namespaces == expected
    assert base.sorting.namespaces == frozenset(SampleDocument.attributes.paths)


def test_facet_overrides_replace_owned_fields_and_take_precedence_over_exclusions() -> None:
    base = SearchDefinition.from_mapping({name: {"type": "keyword"} for name in ("category", "author")})
    override = TermsFacet(field="category", name="label", size=100)
    changed = base.with_facets(overrides=(override,), exclude={"category", "author"})

    assert changed.facets == (override,)
    assert changed.with_facets() == changed
    assert changed.sorting == base.sorting
    assert owned_fields(base.facets) == {"category", "author"}
    assert changed.with_facets(exclude={"category"}).facets == ()


def test_facet_overrides_can_replace_names_and_snapshot_caller_collections() -> None:
    base = SearchDefinition(facets=(TermsFacet(field="category", name="label"),))
    override = TermsFacet(field="author", name="label")
    overrides: Any = [override]
    excluded = {"category"}

    changed = base.with_facets(overrides=overrides, exclude=excluded)
    overrides.clear()
    excluded.add("author")

    assert changed.facets == (override,)
    assert base.facets == (TermsFacet(field="category", name="label"),)


def test_duplicate_override_names_are_rejected() -> None:
    with pytest.raises(ValueError, match="unique"):
        SearchDefinition().with_facets(overrides=(TermsFacet(field="category"), TermsFacet(field="category")))


def test_definition_from_mapping_preserves_overrides_exclusions_and_order() -> None:
    override = TermsFacet(field="categories", name="category", size=42)
    definition = SearchDefinition.from_mapping(
        {"id": {"type": "keyword"}, "categories": {"type": "keyword"}, "price": {"type": "float"}},
        max_result_window=500,
    ).with_facets(overrides=(override,), exclude={"id"})
    assert definition.facets[0] is override
    result = definition.search().using(StubSearchClient(total=0)).index("items").execute()
    assert [facet.key for facet in result.facets] == ["category", "price"]
    assert isinstance(definition.facets[1], NumericHistogramFacet)
    assert definition.max_result_window == 500


@pytest.mark.parametrize("one_shot", [False, True], ids=["list", "iterator"])
def test_definition_snapshots_facet_iterables_before_hiding_internal_fields(one_shot: bool) -> None:
    category = TermsFacet(field="category")
    facets = [TermsFacet(field="attributes_fields"), category, ATTRIBUTES]
    facet_input: Any = iter(facets) if one_shot else facets

    definition = SearchDefinition(facets=facet_input)
    facets.clear()

    assert definition.facets == (category, ATTRIBUTES)
    assert definition.static_facets == (category,)
    assert definition.dynamic_facet_families == (ATTRIBUTES,)


def test_replacing_definition_facets_does_not_mutate_other_branches() -> None:
    base = SearchDefinition.from_mapping({"category": {"type": "keyword"}})
    dynamic = replace(base, facets=(*base.facets, ATTRIBUTES))
    cleared = replace(dynamic, facets=base.facets)
    assert base.dynamic_facet_families == ()
    assert dynamic.dynamic_facet_families == (ATTRIBUTES,)
    assert cleared.dynamic_facet_families == ()
    assert cleared.facets == base.facets


def test_definition_rejects_duplicate_facet_names() -> None:
    with pytest.raises(ValueError, match="unique"):
        SearchDefinition(facets=(ATTRIBUTES, ATTRIBUTES))


def test_definition_owns_internal_fields() -> None:
    definition = SearchDefinition.from_mapping(
        {key: {"type": "keyword"} for key in ("attributes_fields", "category", "private")},
    ).with_facets(exclude={"private"}, overrides=(ATTRIBUTES,))
    client = StubSearchClient(total=0)
    query = definition.search().using(client).index("items")
    result = query.with_facet_counts().execute()
    assert {facet.key for facet in result.facets} == {"category"}
    fields = client.calls[-1]["aggs"]["facet_counts"]["aggs"]["by_field"]["filters"]["filters"]
    assert set(fields) == {"category"}
    with pytest.raises(UnknownFacetError):
        query.aggregate_facets("attributes_fields").execute()
    with pytest.raises(UnknownFacetError):
        query.with_facet_filters(terms={"attributes_fields": ["anything"]}).execute()


def test_facet_properties_follow_the_definition_not_requested_calculations() -> None:
    static_facets = (TermsFacet(field="category"), TermsFacet(field="brand"))
    definition = SearchDefinition(facets=(*static_facets, ATTRIBUTES))
    base = definition.search()
    branch = (
        base.aggregate_facets("category")
        .discover_facets("attributes")
        .with_aggregations(enabled=False)
        .with_exact_total(enabled=False)
    )

    assert base._definition is branch._definition is definition
    assert definition.static_facets == static_facets
    assert definition.dynamic_facet_families == (ATTRIBUTES,)
    assert definition.internal_facet_keys == frozenset({"attributes_fields"})


def test_definition_exposes_capabilities_without_creating_a_query() -> None:
    definition = SearchDefinition(
        facets=(TermsFacet(field="brand"), NumericHistogramFacet(field="price", interval=10), ATTRIBUTES),
    ).with_sorting(default=(SortClause(field="id", order="asc"),))

    assert definition.static_facets == definition.facets[:2]
    assert definition.dynamic_facet_families == (ATTRIBUTES,)
    assert definition.internal_facet_keys == frozenset({"attributes_fields"})
