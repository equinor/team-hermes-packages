"""Filter-scoped document counts and distinct-value estimates."""

from collections.abc import Sequence
from dataclasses import dataclass

from elasticsearch.dsl import A
from elasticsearch.dsl.aggs import Agg

from ..filters import Filter, agg_key, filter_bucket, queries
from .response import AggregationPayload

DEFAULT_PRECISION_THRESHOLD = 40_000


@dataclass(frozen=True, slots=True)
class ScopeCounts:
    """Matching document count and estimated distinct counts by indexed field."""

    doc_count: int
    cardinalities: dict[str, int]


@dataclass(frozen=True, slots=True)
class CardinalityAggregation:
    """Count distinct values over all matching documents; request with query.aggregations()."""

    name: str
    fields: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "fields", tuple(dict.fromkeys(self.fields)))

    def build_agg(self, filters: Sequence[Filter]) -> tuple[str, Agg]:
        """Build one named aggregation containing the scoped cardinalities."""
        subs = {
            agg_key("card", field): A("cardinality", field=field, precision_threshold=DEFAULT_PRECISION_THRESHOLD)
            for field in self.fields
        }
        return self.name, filter_bucket(queries(filters), subs)

    def extract(self, wrapper: AggregationPayload) -> ScopeCounts:
        return ScopeCounts(
            doc_count=wrapper.get("doc_count", 0),
            cardinalities={field: wrapper.get(agg_key("card", field), {}).get("value", 0) for field in self.fields},
        )
