"""Facet results: join extracted values with the selectable catalog for API responses."""

from collections.abc import Container, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from ..filters import FacetKind


class FacetBucket(BaseModel):
    """One categorical value and its document count."""

    value: str
    count: int


class HistogramBucket(BaseModel):
    key: float | str
    count: int


class HistogramData(BaseModel):
    buckets: list[HistogramBucket] = Field(default_factory=list)
    min: float | str | None = None
    max: float | str | None = None
    mean: float | str | None = None


@dataclass(frozen=True, slots=True)
class FacetData:
    """One extracted facet value; numeric counts remain available even without buckets."""

    buckets: list[FacetBucket] = field(default_factory=list)
    histogram: HistogramData | None = None
    count: int | None = None


type ExtractedFacets = dict[str, FacetData]


class FacetValueType(StrEnum):
    """How the facet's values are typed in the index."""

    STRING = "string"
    NUMBER = "number"
    DATE = "date"


@dataclass(frozen=True, slots=True)
class FacetDescriptor:
    """Selectable identity and optional dynamic namespace."""

    key: str
    kind: FacetKind
    value_type: FacetValueType
    source: str | None = None


class _FacetBase(BaseModel):
    # Required, even when nullable: generated TypeScript properties must not be optional.
    key: str
    value_type: FacetValueType
    source: str | None
    count: int | None
    aggregated: bool


class TermFacetResponse(_FacetBase):
    """A flat distribution of categorical values."""

    kind: Literal[FacetKind.TERM] = FacetKind.TERM
    buckets: list[FacetBucket]


class RangeFacetResponse(_FacetBase):
    """Continuous buckets and observed extent, or None when unavailable."""

    kind: Literal[FacetKind.RANGE] = FacetKind.RANGE
    histogram: HistogramData | None


type FacetResponse = Annotated[TermFacetResponse | RangeFacetResponse, Field(discriminator="kind")]


def project_facets(
    catalog: Sequence[FacetDescriptor],
    facets: ExtractedFacets,
    *,
    counts: Mapping[str, int] | None = None,
    exclude: Container[str] = (),
) -> list[FacetResponse]:
    """Join the catalog with extracted values in declaration order; the first descriptor wins.

    Membership in ``facets`` determines ``aggregated``. Include empty ``FacetData``
    for computed facets; omit uncomputed facets. Internal discovery keys are never published.
    """
    seen: set[str] = set()
    projected: list[FacetResponse] = []
    for descriptor in catalog:
        if descriptor.key in seen or descriptor.key in exclude:
            continue
        seen.add(descriptor.key)
        projected.append(_project_one(descriptor, facets, counts or {}))
    return projected


def _project_one(
    descriptor: FacetDescriptor,
    facets: ExtractedFacets,
    counts: Mapping[str, int],
) -> FacetResponse:
    """Project a facet; explicit presence counts, including zero, take precedence."""
    common: dict[str, Any] = {
        "key": descriptor.key,
        "value_type": descriptor.value_type,
        "source": descriptor.source,
        "aggregated": descriptor.key in facets,
    }
    data = facets.get(descriptor.key, FacetData())
    if descriptor.kind is FacetKind.TERM:
        buckets = data.buckets
        return TermFacetResponse(
            **common,
            count=counts.get(descriptor.key, sum(bucket.count for bucket in buckets)),
            buckets=buckets,
        )
    return RangeFacetResponse(**common, count=counts.get(descriptor.key, data.count), histogram=data.histogram)
