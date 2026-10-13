"""Supported non-facet aggregations, metric subsets, and extracted value types."""

from .cardinality import CardinalityAggregation, ScopeCounts
from .exists_counts import ExistsCountsAggregation
from .relevant_terms import SampledTermsAggregation
from .response import AggregationBucket
from .sum import IntegerSumAggregation

type Metric = CardinalityAggregation | IntegerSumAggregation | ExistsCountsAggregation
type MetricValue = ScopeCounts | int | dict[str, int] | None

type Aggregation = Metric | SampledTermsAggregation
type AggregationValue = MetricValue | list[AggregationBucket]
