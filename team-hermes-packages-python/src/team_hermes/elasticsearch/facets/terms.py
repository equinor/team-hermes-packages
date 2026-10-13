"""Categorical (``terms``) facet with disjunctive scoping."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from elasticsearch.dsl import A
from elasticsearch.dsl.aggs import Agg

from ..aggregations import AggregationsResponse
from ..filters import FacetKind, Filter, drop_none, filter_bucket, queries_excluding, resolve_keyword_field
from .result import (
    FacetBucket,
    FacetData,
    FacetDescriptor,
    FacetValueType,
)

# Default cap on returned terms buckets.
DEFAULT_TERMS_SIZE = 1_000


@dataclass(frozen=True, slots=True, kw_only=True)
class TermsFacet:
    """Categorical facet backed by an ES ``terms`` aggregation, with disjunctive scoping.

    A facet's own selection is excluded from its aggregation, so alternatives
    stay visible while every other active filter applies::

        TermsFacet(field="category")
        TermsFacet(field="tag", keyword=True)

    """

    field: str
    name: str = ""
    source: str | None = None
    keyword: bool = False
    size: int = DEFAULT_TERMS_SIZE
    order: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        if not self.name:
            object.__setattr__(self, "name", self.field)

    # -- Identity --

    @property
    def indexed_field_path(self) -> str:
        """Elasticsearch field path for queries and aggregations, resolving ``.keyword`` when enabled."""
        return resolve_keyword_field(self.field, keyword=self.keyword)

    def describe(self) -> FacetDescriptor:
        return FacetDescriptor(
            key=self.name,
            kind=FacetKind.TERM,
            value_type=FacetValueType.STRING,
            source=self.source,
        )

    def build_agg(self, filters: Sequence[Filter]) -> tuple[str, Agg]:
        """Build one named aggregation with the facet's own selection excluded."""
        scoped = queries_excluding(filters, field=self.field, kind=FacetKind.TERM)
        terms = A("terms", **drop_none(field=self.indexed_field_path, size=self.size, order=self.order))
        return self.name, filter_bucket(scoped, {self.name: terms})

    def extract(self, aggs: AggregationsResponse) -> FacetData:
        """Read this facet's buckets; absent or empty aggregations yield empty data."""
        return FacetData(
            buckets=[
                FacetBucket(value=bucket.key, count=bucket.doc_count) for bucket in aggs.extract_buckets(self.name)
            ]
        )
