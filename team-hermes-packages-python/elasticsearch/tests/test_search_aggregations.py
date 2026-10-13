"""Aggregation definitions, registration, search execution, and typed result lookup."""

from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock

import pytest
from elasticsearch import NotFoundError
from elasticsearch.dsl import A, Q

from team_hermes import elasticsearch as faceted_search
from team_hermes.elasticsearch import (
    Aggregation,
    AggregationBucket,
    CardinalityAggregation,
    Cursor,
    ExistsCountsAggregation,
    IntegerSumAggregation,
    SampledTermsAggregation,
    ScopeCounts,
    SearchDefinition,
    SearchRequest,
    SortClause,
    TermsFacet,
    aggregations,
)
from tests.search_test_helpers import StubSearchClient


@pytest.fixture
def wells() -> SampledTermsAggregation:
    """A sampled well distribution isolated to one test."""
    return SampledTermsAggregation(name="wells", field="well", keyword=True, size=5, shard_size=500)


@pytest.fixture
def scope() -> CardinalityAggregation:
    """Document and distinct-well counts."""
    return CardinalityAggregation(name="scope", fields=("well.keyword",))


@pytest.fixture
def aggregation(request: pytest.FixtureRequest, wells: SampledTermsAggregation) -> Aggregation:
    """Resolve named aggregation cases after fixtures have been created."""
    cases: dict[str, Aggregation] = {
        "sampled-terms": wells,
        "integer-sum": IntegerSumAggregation(field="measurement_count"),
        "cardinality": CardinalityAggregation(name="wells", fields=()),
    }
    return cases[request.param]


@pytest.fixture
def definitions(
    request: pytest.FixtureRequest, scope: CardinalityAggregation, wells: SampledTermsAggregation
) -> tuple[Aggregation, ...]:
    """Construct duplicate-name cases with fresh aggregation definitions."""
    cases: dict[str, tuple[Aggregation, ...]] = {
        "same-definition": (scope, scope),
        "different-metrics": (scope, IntegerSumAggregation(name="scope", field="measurement_count")),
        "sampled-and-metric": (wells, CardinalityAggregation(name="wells", fields=("well.keyword",))),
    }
    return cases[request.param]


@pytest.mark.parametrize(
    "name",
    [
        "Aggregation",
        "AggregationBucket",
        "AggregationValue",
        "CardinalityAggregation",
        "ExistsCountsAggregation",
        "IntegerSumAggregation",
        "SampledTermsAggregation",
        "ScopeCounts",
    ],
)
def test_root_aggregation_exports_match_the_flat_package(name: str) -> None:
    assert getattr(faceted_search, name) is getattr(aggregations, name)


@pytest.mark.parametrize("name", ["CardinalityMetrics", "ExistsCountsMetrics", "SumMetric", "RelevantTerms"])
def test_legacy_aggregation_names_are_not_public_aliases(name: str) -> None:
    """Guard the intentionally small public API against reintroducing removed aliases."""
    assert not hasattr(faceted_search, name)
    assert not hasattr(aggregations, name)


def test_metrics_and_sampled_buckets_share_one_execution(
    wells: SampledTermsAggregation, scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(
        total=10,
        aggregations={
            "scope": {"doc_count": 10, "card_well.keyword": {"value": 2}},
            "wells": {
                "doc_count": 10,
                "wells": {
                    "doc_count": 5,
                    "wells": {
                        "buckets": [
                            {
                                "key": "W1",
                                "doc_count": 5,
                                "country": {"buckets": [{"key": "NO", "doc_count": 5}]},
                            }
                        ]
                    },
                },
            },
        },
    )
    wells = replace(wells, sub_aggs={"country": A("terms", field="country", size=1)})

    result = (
        SearchDefinition()
        .search()
        .using(client)
        .index("measurements")
        .aggregations(scope, wells)
        .offset_page(size=0)
        .with_exact_total(enabled=False)
        .execute()
    )

    counts: ScopeCounts = result.aggregation_by(scope)
    buckets: list[AggregationBucket] = result.aggregation_by(wells)
    assert len(client.calls) == 1
    assert counts == ScopeCounts(doc_count=10, cardinalities={"well.keyword": 2})
    assert len(buckets) == 1
    assert buckets[0].key == "W1"
    assert buckets[0].doc_count == 5
    assert buckets[0].first_key("country") == "NO"
    assert result.hits == []
    assert result.total is None
    assert result.pages is None
    assert result.cursors.prev is None
    assert result.cursors.next is None


def test_sampled_terms_retain_all_filters_before_sampling(
    client: StubSearchClient, wells: SampledTermsAggregation
) -> None:
    definition = SearchDefinition(facets=(TermsFacet(field="country"),))

    result = (
        definition.search()
        .using(client)
        .index("measurements")
        .query(Q("match", description="core"))
        .add_base_filter(Q("term", tenant_id="tenant-1"))
        .with_facet_filters(terms={"country": ["NO"]})
        .aggregate_facets("country")
        .aggregations(wells)
        .offset_page(size=0)
        .execute()
    )

    body = client.calls[0]
    assert body["query"] == {
        "bool": {
            "must": [{"match": {"description": "core"}}],
            "filter": [{"term": {"tenant_id": "tenant-1"}}],
        }
    }
    assert body["aggs"]["country"]["filter"] == {"match_all": {}}
    assert body["aggs"]["wells"]["filter"] == {"bool": {"filter": [{"terms": {"country": ["NO"]}}]}}
    sampler = body["aggs"]["wells"]["aggs"]["wells"]
    assert sampler["sampler"] == {"shard_size": 500}
    assert sampler["aggs"]["wells"]["terms"] == {"field": "well.keyword", "size": 5}
    assert result.aggregation_by(wells) == []
    assert (result.hits, result.total, result.pages) == ([], 0, None)


@pytest.mark.parametrize("aggregation", ["sampled-terms", "integer-sum"], indirect=True)
def test_aggregations_replace_without_mutating_facets_filters_or_other_queries(
    aggregation: Aggregation, client: StubSearchClient, scope: CardinalityAggregation
) -> None:
    base = (
        SearchDefinition(facets=(TermsFacet(field="country"),))
        .search()
        .using(client)
        .index("measurements")
        .with_facet_filters(terms={"country": ["NO"]})
        .aggregate_facets("country")
        .aggregations(scope, aggregation)
    )
    replaced = base.aggregations(aggregation)
    cleared = replaced.aggregations()
    assert client.calls == []

    base.execute()
    replaced.execute()
    cleared.execute()
    base.execute()
    cleared.aggregate_facets().execute()

    assert set(client.calls[0]["aggs"]) == {"country", "scope", aggregation.name}
    assert set(client.calls[1]["aggs"]) == {"country", aggregation.name}
    assert set(client.calls[2]["aggs"]) == {"country"}
    assert client.calls[3] == client.calls[0]
    assert "aggs" not in client.calls[4]
    for body in client.calls:
        assert body["post_filter"]["bool"]["filter"] == [{"terms": {"country": ["NO"]}}]


@pytest.mark.parametrize(
    "aggregation",
    [
        IntegerSumAggregation(name="scope", field="price"),
        CardinalityAggregation(name="scope", fields=("other",)),
        ExistsCountsAggregation(name="scope", fields={"well": "well.keyword"}),
    ],
)
def test_lookup_rejects_a_matching_name_with_another_definition(
    aggregation: Aggregation, scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=2, aggregations={"scope": {"doc_count": 2}})
    result = SearchDefinition().search().using(client).index("measurements").aggregations(scope).execute()

    with pytest.raises(LookupError, match="does not match"):
        result.aggregation_by(aggregation)


def test_lookup_accepts_an_equivalent_cardinality_definition(
    scope: CardinalityAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(
        total=2, aggregations={"scope": {"doc_count": 2, "card_well.keyword": {"value": 1}}}
    )
    result = SearchDefinition().search().using(client).index("measurements").aggregations(scope).execute()

    equivalent = CardinalityAggregation(name="scope", fields=("well.keyword",))

    assert result.aggregation_by(equivalent) == ScopeCounts(doc_count=2, cardinalities={"well.keyword": 1})


def test_equivalent_sampled_definition_can_read_result(
    client: StubSearchClient, wells: SampledTermsAggregation
) -> None:
    wells = replace(wells, sub_aggs={"country": A("terms", field="country", size=1)})
    result = SearchDefinition().search().using(client).index("measurements").aggregations(wells).execute()

    assert result.aggregation_by(replace(wells)) == []
    with pytest.raises(LookupError, match="does not match"):
        result.aggregation_by(replace(wells, size=1))
    with pytest.raises(LookupError, match="does not match"):
        result.aggregation_by(replace(wells, sub_aggs={"country": A("terms", field="other")}))
    with pytest.raises(LookupError, match="does not match"):
        result.aggregation_by(IntegerSumAggregation(name="wells", field="value"))
    with pytest.raises(LookupError, match="No aggregation named"):
        result.aggregation_by(replace(wells, name="unrequested"))


@pytest.mark.parametrize(
    "definitions",
    ["same-definition", "different-metrics", "sampled-and-metric"],
    indirect=True,
)
def test_duplicate_aggregation_names_are_rejected_before_io(
    definitions: tuple[Aggregation, ...], client: StubSearchClient
) -> None:
    query = SearchDefinition().search().using(client).index("measurements")

    with pytest.raises(ValueError, match="Aggregation names must be unique"):
        query.aggregations(*definitions)

    assert client.calls == []
    query.execute()
    assert "aggs" not in client.calls[0]


@pytest.mark.parametrize("aggregation", ["sampled-terms", "cardinality"], indirect=True)
def test_aggregation_cannot_overwrite_a_facet(aggregation: Aggregation, client: StubSearchClient) -> None:
    query = (
        SearchDefinition(facets=(TermsFacet(name="wells", field="well"),))
        .search()
        .using(client)
        .index("measurements")
        .with_facet_filters(terms={"wells": ["W1"]})
        .aggregate_facets("wells")
        .aggregations(aggregation)
    )

    with pytest.raises(ValueError, match="Duplicate aggregation key"):
        query.execute()

    assert client.calls == []


def test_internal_presence_counts_do_not_overwrite_sampled_terms(
    client: StubSearchClient, wells: SampledTermsAggregation
) -> None:
    wells = replace(wells, name="facet_counts")
    result = (
        SearchDefinition(facets=(TermsFacet(field="well"),))
        .search()
        .using(client)
        .index("measurements")
        .aggregations(wells)
        .with_facet_counts()
        .execute()
    )

    assert set(client.calls[0]["aggs"]) == {"facet_counts", "_facet_counts"}
    assert result.aggregation_by(wells) == []


def test_raw_dsl_aggregations_are_not_a_second_public_api() -> None:
    unsupported: Any = A("terms", field="well.keyword")

    with pytest.raises(TypeError, match="Unsupported aggregation"):
        SearchDefinition().search().aggregations(unsupported)


def test_disabled_sampled_aggregations_are_distinct_from_empty_results(
    client: StubSearchClient, wells: SampledTermsAggregation
) -> None:
    query = SearchDefinition().search().using(client).index("measurements").aggregations(wells)

    skipped = query.with_aggregations(enabled=False).execute()
    restored = query.with_aggregations(enabled=False).with_aggregations().execute()

    assert "aggs" not in client.calls[0]
    with pytest.raises(LookupError, match="not computed"):
        skipped.aggregation_by(wells)
    assert restored.aggregation_by(wells) == []


@pytest.mark.parametrize("exact_total", [False, True])
def test_zero_hit_search_keeps_exact_totals_independent(
    exact_total: bool, wells: SampledTermsAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=12, hits=[{"_id": "1", "_source": {}, "sort": [1]}])

    result = (
        SearchDefinition()
        .search()
        .using(client)
        .index("measurements")
        .aggregations(wells)
        .offset_page(size=0)
        .with_exact_total(enabled=exact_total)
        .execute()
    )

    assert client.calls[0]["from"] == 0
    assert client.calls[0]["size"] == 0
    assert client.calls[0]["track_total_hits"] is exact_total
    assert result.total == (12 if exact_total else None)
    assert result.pages is None
    assert result.hits == []
    assert result.cursors.prev is None
    assert result.cursors.next is None


def test_zero_hit_search_clears_cursor_without_mutating_original_query(client: StubSearchClient) -> None:
    definition = SearchDefinition().with_sorting(default=(SortClause(field="id", order="asc"),))
    resumed = definition.search().using(client).index("measurements").cursor_page(Cursor(anchor=(10,)), size=2)

    resumed.offset_page(size=0).execute()
    resumed.execute()

    assert client.calls[0]["size"] == 0
    assert "search_after" not in client.calls[0]
    assert client.calls[1]["size"] == 2
    assert client.calls[1]["search_after"] == [10]


def test_applying_http_request_restores_hit_page_and_retains_typed_aggregations(
    wells: SampledTermsAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(total=2)
    query = SearchDefinition().search().using(client).index("measurements").aggregations(wells).offset_page(size=0)

    result = query.apply_request(SearchRequest(per_page=2)).execute()

    assert client.calls[0]["size"] == 2
    assert result.pages == 1
    assert result.aggregation_by(wells) == []


def test_missing_index_does_not_expose_computed_aggregations(
    wells: SampledTermsAggregation, search_client_factory: type[StubSearchClient]
) -> None:
    client = search_client_factory(
        total=0, error=NotFoundError(message="index_not_found_exception", meta=MagicMock(), body={})
    )

    result = (
        SearchDefinition().search().using(client).index("missing").aggregations(wells).offset_page(size=0).execute()
    )

    assert result.missing_index is True
    assert result.total == 0
    assert result.pages == 0
    assert result.hits == []
    with pytest.raises(LookupError, match="not computed"):
        result.aggregation_by(wells)


@pytest.mark.parametrize(("size", "shard_size"), [(0, 500), (-1, 500), (5, 0), (5, -1)])
def test_sampled_terms_require_positive_limits(size: int, shard_size: int) -> None:
    with pytest.raises(ValueError, match="must be positive"):
        SampledTermsAggregation(name="wells", field="well", size=size, shard_size=shard_size)


@pytest.mark.parametrize(("name", "field"), [("", "well"), (" ", "well"), ("wells", ""), ("wells", " ")])
def test_sampled_terms_require_a_name_and_field(name: str, field: str) -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        SampledTermsAggregation(name=name, field=field)


def test_explicit_keyword_field_overrides_inferred_path(wells: SampledTermsAggregation) -> None:
    definition = replace(wells, keyword_field="well.raw")

    _, aggregation = definition.build_agg(())

    assert definition.field_path == "well.raw"
    assert aggregation.to_dict()["aggs"]["wells"]["aggs"]["wells"]["terms"]["field"] == "well.raw"


def test_sub_aggregations_are_snapshotted_and_rebuilt_independently(wells: SampledTermsAggregation) -> None:
    country = A("terms", field="country", size=1)
    declarations = {"country": country}
    definition = replace(wells, sub_aggs=declarations)
    country.field = "changed"
    declarations.clear()

    _, first = definition.build_agg(())
    original = first.to_dict()
    first["wells"]["wells"]["country"].field = "mutated_build"
    _, second = definition.build_agg(())

    assert first is not second
    assert second.to_dict() == original
    sampler = second.to_dict()["aggs"]["wells"]
    assert sampler["aggs"]["wells"]["aggs"] == {"country": {"terms": {"field": "country", "size": 1}}}
