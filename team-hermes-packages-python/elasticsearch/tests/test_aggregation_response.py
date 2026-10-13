"""Aggregation response readers preserve payloads, ordering, and defaults without search I/O."""

import operator
from copy import deepcopy
from types import MappingProxyType
from typing import Any, cast

import pytest

from team_hermes.elasticsearch import FacetBucket, FacetData, TermsFacet
from team_hermes.elasticsearch.aggregations import (
    AggregationBucket,
    AggregationPayload,
    AggregationsResponse,
)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"category": {}},
        {"category": {"category": {}}},
        {"category": {"category": {"buckets": []}}},
        {"category": {"category": {"buckets": None}}},
    ],
)
def test_absent_or_empty_wrapped_buckets_return_an_empty_list(payload: AggregationPayload) -> None:
    assert AggregationsResponse(payload).extract_buckets("category") == []


def test_wrapped_bucket_reading_preserves_order_values_and_raw_payload() -> None:
    raw_bucket = {
        "key": "A",
        "doc_count": 0,
        "country": {"buckets": [{"key": "NO", "doc_count": 2}, {"key": "UK", "doc_count": 1}]},
        "well_count": {"value": 3.0},
    }
    payload = {"category": {"doc_count": 5, "category": {"buckets": [raw_bucket, {"key": "B", "doc_count": 5}]}}}
    original = deepcopy(payload)
    response = AggregationsResponse(payload)

    buckets = response.extract_buckets("category")

    assert [(bucket.key, bucket.doc_count) for bucket in buckets] == [("A", 0), ("B", 5)]
    assert buckets[0].first_key("country") == "NO"
    assert buckets[0].keys_for("country") == ["NO", "UK"]
    assert buckets[0].cardinality("well_count") == 3
    assert list(buckets[0].keys()) == list(raw_bucket)  # Mapping.keys still means raw keys.
    assert buckets[0]["country"] is raw_bucket["country"]
    assert response.get("category") is payload["category"]
    assert len(response) == 1
    assert "category" in response
    assert response.get("absent", {}) == {}
    buckets.clear()
    assert len(response.extract_buckets("category")) == 2
    assert payload == original


@pytest.mark.parametrize("sub", [None, 0, [], "invalid", {}, {"buckets": []}, {"buckets": None}])
def test_empty_or_non_mapping_sub_aggregations_have_no_keys(sub: object) -> None:
    bucket = AggregationBucket({"key": "A", "doc_count": 1, "country": sub})

    assert bucket.first_key("country") is None
    assert bucket.keys_for("country") == []


def test_absent_sub_aggregations_use_defaults() -> None:
    bucket = AggregationBucket({"key": "A", "doc_count": 1})

    assert bucket.first_key("country") is None
    assert bucket.keys_for("country") == []
    assert bucket.cardinality("well_count") == 0


@pytest.mark.parametrize("sub", [None, 0, [], "invalid", {}, {"value": None}, {"value": 0}])
def test_absent_null_and_zero_cardinality_return_zero(sub: object) -> None:
    bucket = AggregationBucket({"key": "A", "doc_count": 1, "well_count": sub})

    assert bucket.cardinality("well_count") == 0


def test_readers_accept_read_only_mappings_and_preserve_numeric_keys() -> None:
    raw_bucket = MappingProxyType({"key": 0.5, "doc_count": 0, "key_as_string": "0.5"})
    response = AggregationsResponse(MappingProxyType({"hist": {"hist": {"buckets": [raw_bucket]}}}))

    (bucket,) = response.extract_buckets("hist")

    assert bucket.key == 0.5
    assert bucket.doc_count == 0
    assert bucket.get("key_as_string") == "0.5"
    assert dict(bucket) == raw_bucket


@pytest.mark.parametrize("reader", [AggregationsResponse({}), AggregationBucket({"key": "A", "doc_count": 1})])
def test_readers_reject_mapping_assignment(reader: AggregationsResponse | AggregationBucket) -> None:
    with pytest.raises(TypeError, match="does not support item assignment"):
        operator.setitem(cast(Any, reader), "new", 1)


def test_malformed_envelopes_are_not_silently_treated_as_empty() -> None:
    with pytest.raises(TypeError):
        AggregationsResponse({"category": None}).extract_buckets("category")


def test_terms_extraction_returns_data_for_absent_empty_and_populated_aggregations() -> None:
    facet = TermsFacet(field="category")

    assert facet.extract(AggregationsResponse({})) == FacetData()
    assert facet.extract(AggregationsResponse({"category": {"category": {"buckets": []}}})) == FacetData()
    assert facet.extract(
        AggregationsResponse({"category": {"category": {"buckets": [{"key": "A", "doc_count": 0}]}}})
    ) == FacetData(buckets=[FacetBucket(value="A", count=0)])
