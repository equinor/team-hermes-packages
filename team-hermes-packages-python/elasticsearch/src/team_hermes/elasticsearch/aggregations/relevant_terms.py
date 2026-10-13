"""Terms aggregated over a relevance-selected sample of matching documents."""

from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from types import MappingProxyType

from elasticsearch.dsl import A
from elasticsearch.dsl.aggs import Agg

from ..filters import Filter, filter_bucket, queries, resolve_keyword_field
from .response import AggregationBucket, AggregationPayload, AggregationsResponse


@dataclass(frozen=True, slots=True, kw_only=True)
class SampledTermsAggregation:
    """Count-ordered terms from a relevance-selected sample.

    All active filters apply before sampling. The sampler selects high-scoring
    documents per shard; terms are then ordered by their document counts within
    that sample, not directly by relevance score. Sub-aggregation definitions
    are snapshotted at construction and provide per-bucket metadata.
    """

    name: str
    field: str
    keyword: bool = False
    keyword_field: str | None = None
    size: int = 10
    shard_size: int = 500
    sub_aggs: Mapping[str, Agg] = dataclass_field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Aggregation name must not be empty")
        if not self.field.strip():
            raise ValueError("Aggregation field must not be empty")
        if self.size < 1 or self.shard_size < 1:
            raise ValueError("Aggregation size and shard_size must be positive")
        object.__setattr__(self, "sub_aggs", MappingProxyType(deepcopy(dict(self.sub_aggs))))

    @property
    def field_path(self) -> str:
        """Return the indexed keyword field used for grouping."""
        return resolve_keyword_field(self.field, keyword=self.keyword, keyword_field=self.keyword_field)

    def build_agg(self, filters: Sequence[Filter]) -> tuple[str, Agg]:
        """Build a filter-scoped sampler containing the requested terms."""
        terms = A("terms", field=self.field_path, size=self.size)
        for name, aggregation in self.sub_aggs.items():
            terms.bucket(name, deepcopy(aggregation))
        sampler = A("sampler", shard_size=self.shard_size)
        sampler.bucket(self.name, terms)
        return self.name, filter_bucket(queries(filters), {self.name: sampler})

    def extract(self, wrapper: AggregationPayload) -> list[AggregationBucket]:
        """Extract sampled buckets from this aggregation's filter payload."""
        return AggregationsResponse(wrapper).extract_buckets(self.name)
