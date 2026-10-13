"""Filter-scoped integer sums."""

from collections.abc import Sequence
from dataclasses import dataclass

from elasticsearch.dsl import A
from elasticsearch.dsl.aggs import Agg

from ..filters import Filter, agg_key, filter_bucket, queries
from .response import AggregationPayload


@dataclass(frozen=True, slots=True)
class IntegerSumAggregation:
    """Sum an integer-valued field over all matching documents, independently of paging."""

    field: str
    name: str = ""

    def __post_init__(self) -> None:
        if not self.name:
            object.__setattr__(self, "name", self.field)

    def build_agg(self, filters: Sequence[Filter]) -> tuple[str, Agg]:
        """Build one named sum aggregation retaining every active filter."""
        return self.name, filter_bucket(queries(filters), {agg_key("sum", self.name): A("sum", field=self.field)})

    def extract(self, wrapper: AggregationPayload) -> int | None:
        value = wrapper.get(agg_key("sum", self.name), {}).get("value")
        return int(value) if value is not None else None
