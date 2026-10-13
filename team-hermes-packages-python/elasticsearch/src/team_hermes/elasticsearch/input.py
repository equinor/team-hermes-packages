"""Validated search requests and filter values shared by HTTP and fluent callers."""

from collections.abc import Mapping
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from .errors import InvalidRangeFilterError
from .sort import SortOrder

type RangeBound = float | int | str | None


type FilterName = Annotated[str, Field(min_length=1)]
type NumericBound = Annotated[int, Field(strict=True)] | Annotated[float, Field(strict=True, allow_inf_nan=False)]
type DateBound = Annotated[str, Field(strict=True, min_length=1)]


class RangeFilter(BaseModel):
    """Inclusive numeric or date bounds; Elasticsearch orders date-math expressions."""

    model_config = ConfigDict(extra="forbid")

    min: NumericBound | DateBound | None = None
    max: NumericBound | DateBound | None = None

    @model_validator(mode="after")
    def validate_bounds(self) -> Self:
        """Reject mixed bound types and inverted numeric intervals."""
        minimum, maximum = self.min, self.max
        if minimum is None or maximum is None:
            return self
        if isinstance(minimum, str) != isinstance(maximum, str):
            raise ValueError(
                "Range filter for 'selection': min and max must be the same kind (both numeric or both strings)"
            )
        if not isinstance(minimum, str) and not isinstance(maximum, str) and minimum > maximum:
            raise InvalidRangeFilterError("selection", minimum, maximum)
        return self


class SearchRequest(BaseModel):
    """HTTP input shared by search use cases; query text and authorization belong to the application."""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    q: str | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=1000)
    cursor: str | None = None
    sort_by: str | None = None
    sort_order: SortOrder = "asc"
    aggregate_facets: list[FilterName] = Field(
        default_factory=list, description="Facet keys whose distributions should be computed."
    )
    discover_facets: list[FilterName] = Field(
        default_factory=list, description="Dynamic facet families whose available fields should be discovered."
    )
    include_metadata: bool = Field(default=True, description="Compute facets, metrics, and exact totals.")
    include_facet_counts: bool = False
    terms: dict[FilterName, list[str]] = Field(default_factory=dict)
    ranges: dict[FilterName, RangeFilter] = Field(default_factory=dict)


_TERMS_ADAPTER = TypeAdapter(dict[FilterName, tuple[str, ...]])
_RANGES_ADAPTER = TypeAdapter(dict[FilterName, RangeFilter])


def validate_terms(terms: Mapping[str, list[str] | tuple[str, ...]]) -> dict[str, tuple[str, ...]]:
    """Validate and snapshot term values without creating a second request model."""
    return _TERMS_ADAPTER.validate_python(dict(terms))


def validate_ranges(ranges: Mapping[str, RangeFilter]) -> dict[str, RangeFilter]:
    """Revalidate and copy models so subsequent caller mutations cannot affect a query."""
    if any(not isinstance(bounds, RangeFilter) for bounds in ranges.values()):
        raise TypeError("Range filters must be RangeFilter values")
    return _RANGES_ADAPTER.validate_python({name: bounds.model_dump() for name, bounds in ranges.items()})
