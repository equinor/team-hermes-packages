"""Histogram bounds, interval limits, and numeric/date extraction.

Search orchestration and filter-scoped bounds requests are tested separately in
the query and request-construction modules; those exercise different contracts.
"""

import math
from typing import Any

import pytest

from team_hermes.elasticsearch import (
    Bounds,
    DateHistogramFacet,
    FacetData,
    HistogramData,
    NumericHistogramFacet,
    SearchDefinition,
)
from team_hermes.elasticsearch.aggregations import AggregationsResponse
from team_hermes.elasticsearch.facets.histogram import _HistogramFacetBase, infer_histogram_interval
from team_hermes.elasticsearch.facets.result import HistogramBucket
from tests.search_test_helpers import StubSearchClient


def test_histogram_base_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError, match="abstract.*_build_histogram_agg"):
        _HistogramFacetBase(field="depth")  # pyrefly: ignore[bad-instantiation]


def test_histogram_subclass_requires_histogram_aggregation_hook() -> None:
    class IncompleteHistogramFacet(_HistogramFacetBase):
        """Deliberately omit the required aggregation hook."""

    with pytest.raises(TypeError, match="abstract.*_build_histogram_agg"):
        IncompleteHistogramFacet(field="depth")  # pyrefly: ignore[bad-instantiation]


@pytest.mark.parametrize(
    "bounds_hints",
    [{"depth": Bounds(0.0, 5000.0)}, {"depth": None}, {}],
    ids=["provided", "empty-prefetch", "absent"],
)
def test_histogram_compilation_uses_available_bounds_or_fallback(bounds_hints: dict[str, Bounds | None]) -> None:
    key, aggregation = NumericHistogramFacet(field="depth").build_agg((), bounds=bounds_hints.get("depth"))

    assert key == "hist_depth"
    histogram = aggregation.to_dict()["aggs"]["hist_depth"]["histogram"]
    assert histogram["field"] == "depth"
    assert histogram["interval"] == infer_histogram_interval(bounds_hints.get("depth"))


@pytest.mark.parametrize(
    "bounds",
    [
        Bounds(0, 30),
        Bounds(1, 31),
        Bounds(-30, 0),
        Bounds(-5, 25),
        Bounds(-0.1, 0.2),
        Bounds(1_000_001, 1_000_031),
        Bounds(0, 29),
        Bounds(0, 0),
    ],
)
@pytest.mark.parametrize("limit", [2, 3, 30])
def test_automatic_interval_caps_both_endpoint_buckets(bounds: Bounds, limit: int) -> None:
    interval = infer_histogram_interval(bounds, max_buckets=limit)
    bucket_count = math.floor(bounds.max / interval) - math.floor(bounds.min / interval) + 1
    assert 1 <= bucket_count <= limit


def test_explicit_interval_skips_bounds_even_with_requested_counts() -> None:
    client = StubSearchClient(total=0)
    (
        SearchDefinition(facets=(NumericHistogramFacet(field="price", interval=2),))
        .search()
        .using(client)
        .index("items")
        .aggregate_facets("price")
        .with_facet_counts()
        .execute()
    )
    assert len(client.calls) == 1
    assert client.calls[0]["aggs"]["hist_price"]["aggs"]["hist_price"]["histogram"]["interval"] == 2


@pytest.mark.parametrize(("interval", "expected"), [(None, 20), (2, 2)])
def test_numeric_histogram_uses_observed_bounds_and_nonempty_buckets(interval: float | None, expected: float) -> None:
    facet = NumericHistogramFacet(field="price", interval=interval, max_buckets=6)
    key, aggregation = facet.build_agg((), bounds=Bounds(0, 100))
    histogram = aggregation.to_dict()["aggs"]["hist_price"]["histogram"]

    assert key == "hist_price"
    assert histogram == {"field": "price", "interval": expected, "min_doc_count": 1}


@pytest.mark.parametrize("option", ["extended_bounds", "missing", "min_doc_count"])
def test_numeric_histogram_rejects_removed_options(option: str) -> None:
    options: dict[str, Any] = {option: None}

    with pytest.raises(TypeError, match=f"unexpected keyword argument '{option}'"):
        NumericHistogramFacet(field="price", **options)


@pytest.mark.parametrize("min_doc_count", [0, 1])
@pytest.mark.parametrize("interval", [{}, {"calendar_interval": "month"}, {"fixed_interval": "1d"}])
def test_date_histogram_retains_interval_and_bucket_configuration(
    interval: dict[str, Any], min_doc_count: int
) -> None:
    facet = DateHistogramFacet(field="created", min_doc_count=min_doc_count, **interval)
    key, aggregation = facet.build_agg(())
    histogram = aggregation.to_dict()["aggs"]["hist_created"]["date_histogram"]

    assert key == "hist_created"
    assert histogram == {
        "field": "created",
        "min_doc_count": min_doc_count,
        **(interval or {"calendar_interval": "year"}),
    }


def test_date_histogram_still_rejects_conflicting_intervals() -> None:
    with pytest.raises(ValueError, match="set either calendar_interval or fixed_interval, not both"):
        DateHistogramFacet(field="created", calendar_interval="month", fixed_interval="1d")


@pytest.mark.parametrize("interval", [0, -1, float("nan"), float("inf"), -float("inf")])
def test_invalid_explicit_intervals_fail_at_definition_time(interval: float) -> None:
    with pytest.raises(ValueError, match="finite and positive"):
        NumericHistogramFacet(field="price", interval=interval)


@pytest.mark.parametrize("limit", [0, 1, -1])
def test_invalid_bucket_limits_fail_at_definition_time(limit: int) -> None:
    with pytest.raises(ValueError, match="at least 2"):
        NumericHistogramFacet(field="price", max_buckets=limit)


def test_date_extraction_keeps_formatted_keys_and_utc_extent() -> None:
    facet = DateHistogramFacet(field="created")
    data = facet.extract(
        AggregationsResponse(
            {
                "hist_created": {
                    "hist_created": {"buckets": [{"key": 0, "key_as_string": "1970-01-01", "doc_count": 2}]},
                    "hist_created_stats": {"min": 0, "max": 86_400_000, "avg": 43_200_000, "count": 3},
                }
            }
        )
    )
    assert data.count == 2  # Preserve the date bucket count rather than numeric stats counting.
    assert data.histogram == HistogramData(
        buckets=[HistogramBucket(key="1970-01-01", count=2)], min="1970-01-01", max="1970-01-02", mean="1970-01-01"
    )


def test_date_extraction_keeps_epoch_key_fallback_and_nullable_stats() -> None:
    data = DateHistogramFacet(field="created").extract(
        AggregationsResponse(
            {
                "hist_created": {
                    "hist_created": {"buckets": [{"key": 0, "doc_count": 1}]},
                }
            }
        )
    )
    assert data == FacetData(histogram=HistogramData(buckets=[HistogramBucket(key="0", count=1)]), count=1)


@pytest.mark.parametrize(
    "facet, expected",
    [
        (DateHistogramFacet(field="created"), FacetData()),
        (NumericHistogramFacet(field="price"), FacetData(count=0)),
    ],
    ids=["date-null-count", "numeric-zero-count"],
)
def test_missing_histogram_aggregation_preserves_count_semantics(
    facet: DateHistogramFacet | NumericHistogramFacet,
    expected: FacetData,
) -> None:
    response = AggregationsResponse({})

    actual = facet.extract(response)

    assert actual == expected
