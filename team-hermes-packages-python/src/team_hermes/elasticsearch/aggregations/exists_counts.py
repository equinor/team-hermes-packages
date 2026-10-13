"""Filter-scoped field-presence counts, including internal facet counts."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

from elasticsearch.dsl import A, Q
from elasticsearch.dsl.aggs import Agg

from ..filters import Filter, filter_bucket, queries
from .response import AggregationPayload

if TYPE_CHECKING:
    from ..facets import Facet


@dataclass(frozen=True, slots=True)
class ExistsCountsAggregation:
    """Count matching documents with each field in one batched filters aggregation."""

    name: str
    fields: dict[str, str]

    @classmethod
    def over(cls, facets: Iterable["Facet"], *, name: str = "facet_counts") -> "ExistsCountsAggregation":
        """Select eligible static fields; dynamic families have no single indexed field path."""
        return cls(name=name, fields={facet.name: facet.indexed_field_path for facet in facets})

    def build_agg(self, filters: Sequence[Filter]) -> tuple[str, Agg]:
        """Build one named aggregation containing scoped field-presence counts."""
        per_field = A("filters", filters={name: Q("exists", field=field) for name, field in self.fields.items()})
        return self.name, filter_bucket(queries(filters), {"by_field": per_field})

    def extract(self, wrapper: AggregationPayload) -> dict[str, int]:
        buckets = wrapper.get("by_field", {}).get("buckets", {})
        return {name: int(bucket.get("doc_count", 0)) for name, bucket in buckets.items()}
