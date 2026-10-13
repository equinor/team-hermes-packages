import logging
from collections.abc import Callable, Container, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Self, overload

from elasticsearch.dsl.response import Hit
from pydantic import BaseModel, ValidationError

from .aggregations import (
    Aggregation,
    AggregationBucket,
    AggregationsResponse,
    AggregationValue,
    CardinalityAggregation,
    ExistsCountsAggregation,
    IntegerSumAggregation,
    SampledTermsAggregation,
    ScopeCounts,
)
from .facet_plan import FacetPlan
from .facets.result import FacetResponse, project_facets
from .pagination import Cursors

logger = logging.getLogger(__name__)


def _project_search_facets(
    values: AggregationsResponse,
    *,
    facet_plan: FacetPlan,
    counts: Mapping[str, int],
    exclude: Container[str],
) -> list[FacetResponse]:
    """Project requested distributions and available fields without mutating the catalog, response, or counts."""
    extracted = {facet.name: facet.extract(values) for facet in facet_plan.facets_to_aggregate}
    # Requested facets are a catalog-ordered subset; keep that order within both groups.
    projected_catalog = sorted(facet_plan.describe_catalog(), key=lambda descriptor: descriptor.key not in extracted)
    presence_counts = dict(counts)
    for family in facet_plan.discovery_families:
        available = family.extract_catalog(values)
        projected_catalog.extend(available.descriptors)
        presence_counts.update(available.counts)
    return project_facets(
        projected_catalog,
        extracted,
        counts=presence_counts,
        exclude=exclude,
    )


@dataclass(frozen=True, slots=True)
class SearchResult:
    hits: list[Hit]
    facets: list[FacetResponse]
    total: int | None
    page: int
    pages: int | None
    cursors: Cursors
    missing_index: bool = False
    _aggregation_values: dict[str, tuple[Aggregation, AggregationValue]] | None = field(
        default_factory=dict, repr=False
    )

    @overload
    def aggregation_by(self, aggregation: CardinalityAggregation) -> ScopeCounts: ...

    @overload
    def aggregation_by(self, aggregation: IntegerSumAggregation) -> int | None: ...

    @overload
    def aggregation_by(self, aggregation: ExistsCountsAggregation) -> dict[str, int]: ...

    @overload
    def aggregation_by(self, aggregation: SampledTermsAggregation) -> list[AggregationBucket]: ...

    def aggregation_by(self, aggregation: Aggregation) -> AggregationValue:
        """Read a computed value using an equivalent registered definition."""
        if self.missing_index or self._aggregation_values is None:
            raise LookupError("Aggregations were not computed for this result")
        if aggregation.name not in self._aggregation_values:
            raise LookupError(f"No aggregation named {aggregation.name!r} in search")
        definition, value = self._aggregation_values[aggregation.name]
        if aggregation != definition:
            raise LookupError(
                f"Aggregation definition for {aggregation.name!r} does not match the requested aggregation"
            )
        return value


class FacetedSearchResponse[ItemT, MetricsT](BaseModel):
    """Application-owned payloads with completed search metadata."""

    items: list[ItemT]
    facets: list[FacetResponse]
    metrics: MetricsT | None
    total: int | None
    page: int
    pages: int | None
    next_cursor: str | None = None
    prev_cursor: str | None = None

    @classmethod
    def from_result(
        cls: type[Self],
        result: SearchResult,
        *,
        items: list[ItemT],
        metrics: MetricsT | None,
    ) -> Self:
        """Validate payloads and copy completed search metadata and encoded cursors.

        Applications supply both payloads, including empty items or null metrics.
        Payloads must validate against the selected response types.
        """
        return cls(
            items=items,
            facets=result.facets,
            metrics=metrics,
            total=result.total,
            page=result.page,
            pages=result.pages,
            next_cursor=result.cursors.next.encode() if result.cursors.next is not None else None,
            prev_cursor=result.cursors.prev.encode() if result.cursors.prev is not None else None,
        )


def safe_map_hits[T: BaseModel](hits: Iterable[Hit], mapper: Callable[[Hit], T], *, log_label: str) -> list[T]:
    """Map hits, logging and skipping validation failures caused by index/model drift."""
    items: list[T] = []
    for hit in hits:
        try:
            items.append(mapper(hit))
        except ValidationError:
            logger.exception("Skipping malformed %s hit %s", log_label, hit.meta.id)
    return items
