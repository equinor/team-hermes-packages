"""Metric aggregation, typed extraction, and application-owned response mapping."""

from collections.abc import Mapping
from typing import Any

import pytest
from elasticsearch.dsl import Q
from elasticsearch.dsl.aggs import Agg
from pydantic import BaseModel

from team_hermes.elasticsearch import (
    CardinalityAggregation,
    ExistsCountsAggregation,
    FacetedSearchResponse,
    IntegerSumAggregation,
    ScopeCounts,
    SearchDefinition,
)
from team_hermes.elasticsearch.aggregations import (
    DEFAULT_PRECISION_THRESHOLD,
    Metric,
    cardinality,
    exists_counts,
    types,
)
from team_hermes.elasticsearch.aggregations import sum as sum_metrics
from team_hermes.elasticsearch.elasticsearch import build_aggregations
from team_hermes.elasticsearch.facet_plan import FacetPlan
from team_hermes.elasticsearch.filters import FacetKind, Filter
from tests.faceted_search.search_test_helpers import StubSearchClient


class CustomMetricsResponse(BaseModel):
    message: str


def test_aggregation_package_preserves_metric_exports() -> None:
    assert CardinalityAggregation is cardinality.CardinalityAggregation
    assert ScopeCounts is cardinality.ScopeCounts
    assert IntegerSumAggregation is sum_metrics.IntegerSumAggregation
    assert ExistsCountsAggregation is exists_counts.ExistsCountsAggregation
    assert Metric is types.Metric
    assert DEFAULT_PRECISION_THRESHOLD == cardinality.DEFAULT_PRECISION_THRESHOLD == 40_000


def test_exists_counts_can_be_mapped_to_application_metrics() -> None:
    metric = ExistsCountsAggregation(name="presence", fields={"brand": "brand.keyword"})
    client = StubSearchClient(
        total=4, aggregations={"presence": {"by_field": {"buckets": {"brand": {"doc_count": 4}}}}}
    )
    search_result = SearchDefinition().search().using(client).index("items").aggregations(metric).execute()

    response_model = FacetedSearchResponse[str, dict[str, int]]
    response = response_model.from_result(search_result, items=[], metrics=search_result.aggregation_by(metric))

    assert search_result.aggregation_by(metric) == {"brand": 4}
    assert response.model_dump(mode="json")["metrics"] == {"brand": 4}
    assert response_model.model_validate_json(response.model_dump_json()) == response


def test_unsupported_metric_is_rejected_before_io() -> None:
    client = StubSearchClient(total=0)
    unsupported: Any = object()
    with pytest.raises(TypeError, match="Unsupported aggregation"):
        SearchDefinition().search().using(client).index("items").aggregations(unsupported)
    assert client.calls == []


def test_application_maps_extracted_metrics_to_its_response_model() -> None:
    metric = IntegerSumAggregation(field="total")
    client = StubSearchClient(total=1, aggregations={"total": {"sum_total": {"value": 7}}})
    result = SearchDefinition().search().using(client).index("items").aggregations(metric).execute()
    response_model = FacetedSearchResponse[str, CustomMetricsResponse]

    response = response_model.from_result(
        result, items=[], metrics=CustomMetricsResponse(message=f"Total: {result.aggregation_by(metric)}")
    )

    assert response.items == []
    assert response.metrics == CustomMetricsResponse(message="Total: 7")
    assert response.model_dump(mode="json")["metrics"] == {"message": "Total: 7"}
    assert response_model.model_validate_json(response.model_dump_json()) == response


@pytest.mark.parametrize("metrics", [None, {}])
def test_explicit_empty_metrics_are_preserved(metrics: dict[str, int] | None) -> None:
    metric = IntegerSumAggregation(field="total")
    result = SearchDefinition().search().using(StubSearchClient(total=0)).index("items").aggregations(metric).execute()

    response = FacetedSearchResponse[str, dict[str, int]].from_result(result, items=[], metrics=metrics)

    assert response.metrics == metrics
    assert result.aggregation_by(metric) is None


def test_extraction_preserves_internal_types_and_ignores_unrequested_aggregations() -> None:
    scope = CardinalityAggregation(name="scope", fields=("brand.keyword",))
    total = IntegerSumAggregation(name="total", field="value")
    client = StubSearchClient(
        total=4,
        aggregations={
            "scope": {"doc_count": 0, "card_brand.keyword": {"value": 0}},
            "total": {"sum_total": {"value": -2}},
            "facet_counts": {"by_field": {"buckets": {"brand": {"doc_count": 4}}}},
        },
    )
    result = SearchDefinition().search().using(client).index("items").aggregations(scope, total).execute()

    assert result.aggregation_by(scope) == ScopeCounts(doc_count=0, cardinalities={"brand.keyword": 0})
    assert result.aggregation_by(total) == -2
    with pytest.raises(LookupError, match="No aggregation named 'facet_counts'"):
        result.aggregation_by(ExistsCountsAggregation(name="facet_counts", fields={"brand": "brand"}))


# ── Aggregation compilation and extraction ─────────────────────────────────


def _compile_metrics(*metrics: Metric) -> Mapping[str, Agg]:
    plan = FacetPlan(catalog=(), filters=(), facets_to_aggregate=(), discovery_families=())
    aggregations, _ = build_aggregations(plan, metrics)
    return aggregations


def test_aggs_omits_metrics_by_default() -> None:
    assert _compile_metrics() == {}


def test_distinct_counts_group_attaches_filter_wrapped_stats() -> None:
    fields = ("site_identifier_source.keyword",)

    aggs = _compile_metrics(CardinalityAggregation(name="search_stats", fields=fields))

    assert "search_stats" in aggs
    body = aggs["search_stats"].to_dict()
    # The group is wrapped in a filter bucket carrying cardinality sub-aggs.
    assert "filter" in body
    assert "aggs" in body
    assert body["aggs"]["card_site_identifier_source.keyword"]["cardinality"]["field"] == fields[0]


def test_cardinality_results_use_exact_field_paths_and_default_missing_counts_to_zero() -> None:
    metric = CardinalityAggregation(name="scope", fields=("site.keyword", "report_ids", "sample_type"))

    result = metric.extract(
        {
            "doc_count": 3,
            "card_site.keyword": {"value": 2},
            "card_report_ids": {"value": 0},
            "card_not_requested": {"value": 999},
        }
    )

    assert result.doc_count == 3
    assert result.cardinalities == {"site.keyword": 2, "report_ids": 0, "sample_type": 0}


def test_duplicate_cardinality_fields_are_counted_once_in_declaration_order() -> None:
    metric = CardinalityAggregation(name="scope", fields=("report_ids", "sample_type", "report_ids"))

    assert metric.fields == ("report_ids", "sample_type")
    key, aggregation = metric.build_agg(())
    assert key == "scope"
    body = aggregation.to_dict()
    assert list(body["aggs"]) == ["card_report_ids", "card_sample_type"]


def test_empty_cardinality_fields_return_only_the_scope_document_count() -> None:
    metric = CardinalityAggregation(name="scope", fields=())

    key, aggregation = metric.build_agg(())
    assert key == "scope"
    assert aggregation.to_dict().get("aggs", {}) == {}
    result = metric.extract({"doc_count": 4})
    assert result.doc_count == 4
    assert result.cardinalities == {}


def test_metric_aggregation_is_scoped_once() -> None:
    filters = (Filter(field="brand", kind=FacetKind.TERM, query=Q("terms", brand=["Acme"])),)
    metric = IntegerSumAggregation(field="price")
    plan = FacetPlan(catalog=(), filters=filters, facets_to_aggregate=(), discovery_families=())
    aggs, _ = build_aggregations(plan, (metric,))
    body = aggs["price"].to_dict()
    key, aggregation = metric.build_agg(filters)
    assert key == "price"
    assert body == aggregation.to_dict()
    assert body["filter"] == {"bool": {"filter": [{"terms": {"brand": ["Acme"]}}]}}
    assert body["aggs"] == {"sum_price": {"sum": {"field": "price"}}}
