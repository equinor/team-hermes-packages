"""Histogram facets: interval inference and the numeric/date subclasses sharing a private base."""

import math
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, ClassVar, Literal

from elasticsearch.dsl import A
from elasticsearch.dsl.aggs import Agg

from ..aggregations import AggregationsResponse
from ..filters import (
    FacetKind,
    Filter,
    agg_key,
    filter_bucket,
    queries_excluding,
)
from .result import (
    FacetData,
    FacetDescriptor,
    FacetValueType,
    HistogramBucket,
    HistogramData,
)

#: Calendar intervals ES accepts for a ``date_histogram``.
type CalendarInterval = Literal["minute", "hour", "day", "week", "month", "quarter", "year"]

DEFAULT_MAX_HISTOGRAM_BUCKETS = 30
DEFAULT_INTERVAL = 0.01


@dataclass(frozen=True, slots=True)
class Bounds:
    """Inclusive numeric extent used for histogram sizing."""

    min: float
    max: float

    @property
    def span(self) -> float:
        return self.max - self.min

    @classmethod
    def from_optional(cls, lo: float | None, hi: float | None) -> "Bounds | None":
        return None if lo is None or hi is None else cls(min=lo, max=hi)


def infer_histogram_interval(
    bounds: Bounds | None,
    *,
    max_buckets: int = DEFAULT_MAX_HISTOGRAM_BUCKETS,
) -> float:
    """Choose a nice interval including both endpoint buckets; keep the empty-data fallback.

    Elasticsearch buckets at floor(value / interval). Reserving one slot for
    the first bucket bounds floor(max / interval) - floor(min / interval) + 1,
    including negative ranges and endpoints lying exactly on bucket boundaries.
    """
    if max_buckets < 2:
        raise ValueError("max_buckets must be at least 2")
    if bounds is None or bounds.span <= 0:
        return DEFAULT_INTERVAL
    return nice_step(bounds.span / (max_buckets - 1))


def nice_step(raw: float) -> float:
    """Round ``raw`` up to the nearest 1/2/5 × 10ⁿ step (d3/matplotlib rule)."""
    if raw <= 0:
        return 1.0

    exp = math.floor(math.log10(raw))
    base = 10.0**exp
    fraction = raw / base
    if fraction <= 1:
        nice = 1.0
    elif fraction <= 2:
        nice = 2.0
    elif fraction <= 5:
        nice = 5.0
    else:
        nice = 10.0
    return nice * base


def _iso_date_from_millis(ms: float) -> str:
    """Convert an epoch-millis date_histogram stat (min/max/avg) to a UTC ``YYYY-MM-DD`` date string."""
    return datetime.fromtimestamp(ms / 1000, tz=UTC).date().isoformat()


@dataclass(frozen=True, slots=True, kw_only=True)
class _HistogramFacetBase(ABC):
    """Abstract Template-Method base for numeric/date histogram facets."""

    field: str
    name: str = ""
    source: str | None = None
    value_type: ClassVar[FacetValueType] = FacetValueType.NUMBER

    def __post_init__(self) -> None:
        if not self.name:
            object.__setattr__(self, "name", self.field)

    @property
    def indexed_field_path(self) -> str:
        """Elasticsearch field path for queries and aggregations; numeric/date fields are unchanged."""
        return self.field

    @property
    def agg_key(self) -> str:
        return agg_key("hist", self.name)

    @property
    def stats_agg_key(self) -> str:
        return f"{self.agg_key}_stats"

    def describe(self) -> FacetDescriptor:
        return FacetDescriptor(self.name, FacetKind.RANGE, self.value_type, self.source)

    @abstractmethod
    def _build_histogram_agg(self, bounds: Bounds | None) -> Agg:
        """Required subclass hook: build the inner ``histogram`` / ``date_histogram`` agg."""
        raise NotImplementedError

    def build_agg(self, filters: Sequence[Filter], *, bounds: Bounds | None = None) -> tuple[str, Agg]:
        """Build one named histogram/stats aggregation in the disjunctive filter scope."""
        return self.agg_key, filter_bucket(
            queries_excluding(filters, field=self.field, kind=FacetKind.RANGE),
            {
                self.agg_key: self._build_histogram_agg(bounds),
                self.stats_agg_key: A("stats", field=self.field),
            },
        )


@dataclass(frozen=True, slots=True)
class NumericHistogramFacet(_HistogramFacetBase):
    """Numeric range and histogram: explicit interval, otherwise inferred from scoped bounds."""

    interval: float | None = None
    max_buckets: int = DEFAULT_MAX_HISTOGRAM_BUCKETS

    def __post_init__(self) -> None:
        super(NumericHistogramFacet, self).__post_init__()  # noqa: UP008 - Slotted dataclass on Python 3.13.
        if self.interval is not None and (not math.isfinite(self.interval) or self.interval <= 0):
            raise ValueError("Histogram interval must be finite and positive")
        if self.max_buckets < 2:
            raise ValueError("max_buckets must be at least 2")

    def _build_histogram_agg(self, bounds: Bounds | None) -> Agg:
        interval = (
            self.interval
            if self.interval is not None
            else infer_histogram_interval(bounds, max_buckets=self.max_buckets)
        )
        return A("histogram", field=self.field, interval=interval, min_doc_count=1)

    def extract(self, aggs: AggregationsResponse) -> FacetData:
        """Read numeric buckets and stats, retaining observed extents even without buckets."""
        buckets = aggs.extract_buckets(self.agg_key)
        stats = aggs.get(self.agg_key, {}).get(self.stats_agg_key, {})
        count = stats.get("count", 0)
        if not buckets and not count:
            return FacetData(count=count)
        mean = stats.get("avg")
        return FacetData(
            histogram=HistogramData(
                buckets=[HistogramBucket(key=bucket.key, count=bucket.doc_count) for bucket in buckets],
                min=stats.get("min"),
                max=stats.get("max"),
                mean=round(mean, 1) if mean is not None else None,
            ),
            count=count,
        )


@dataclass(frozen=True, slots=True)
class DateHistogramFacet(_HistogramFacetBase):
    """Date range and histogram, using either calendar or fixed intervals."""

    calendar_interval: CalendarInterval | None = None
    fixed_interval: str | None = None
    min_doc_count: int = field(default=1, kw_only=True)
    value_type: ClassVar[FacetValueType] = FacetValueType.DATE

    def __post_init__(self) -> None:
        super(DateHistogramFacet, self).__post_init__()  # noqa: UP008 - Slotted dataclass on Python 3.13.
        # ES rejects a date_histogram with both intervals set; surfacing it at
        # spec-construction time is friendlier than a 400 at query time.
        if self.calendar_interval is not None and self.fixed_interval is not None:
            raise ValueError(
                f"DateHistogramFacet({self.name!r}): set either calendar_interval or "
                f"fixed_interval, not both (got calendar_interval={self.calendar_interval!r}, "
                f"fixed_interval={self.fixed_interval!r})."
            )

    def _build_histogram_agg(self, bounds: Bounds | None) -> Agg:
        kwargs: dict[str, Any] = {"field": self.field, "min_doc_count": self.min_doc_count}
        if self.fixed_interval is not None:
            kwargs["fixed_interval"] = self.fixed_interval
        else:
            kwargs["calendar_interval"] = self.calendar_interval or "year"
        return A("date_histogram", **kwargs)

    def extract(self, aggs: AggregationsResponse) -> FacetData:
        """Read date buckets and UTC extents; absent buckets retain a null count and histogram."""
        buckets = aggs.extract_buckets(self.agg_key)
        if not buckets:
            return FacetData()
        stats = aggs.get(self.agg_key, {}).get(self.stats_agg_key, {})
        extent = {key: stats.get(stat) for key, stat in (("min", "min"), ("max", "max"), ("mean", "avg"))}
        return FacetData(
            histogram=HistogramData(
                buckets=[
                    HistogramBucket(key=bucket.get("key_as_string", str(bucket.key)), count=bucket.doc_count)
                    for bucket in buckets
                ],
                **{key: _iso_date_from_millis(value) if value is not None else None for key, value in extent.items()},
            ),
            count=sum(bucket.doc_count for bucket in buckets),
        )
