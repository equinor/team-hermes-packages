"""Supported facet configurations, their concrete union, and indexed field ownership."""

from collections.abc import Iterable

from .dynamic import DynamicFacetFamily
from .histogram import DateHistogramFacet, NumericHistogramFacet
from .terms import TermsFacet

type Facet = TermsFacet | NumericHistogramFacet | DateHistogramFacet


def owned_fields(facets: Iterable[Facet | DynamicFacetFamily]) -> frozenset[str]:
    """Indexed fields replaced by overrides, not their public response aliases.

    Each static facet owns one indexed field; dynamic families own their storage fields.
    """
    fields: set[str] = set()
    for facet in facets:
        if isinstance(facet, TermsFacet | NumericHistogramFacet | DateHistogramFacet):
            fields.add(facet.field)
        elif isinstance(facet, DynamicFacetFamily):
            fields.update(facet.field.owned_fields)
        else:
            raise TypeError(f"Cannot infer indexed fields for {type(facet).__name__}")
    return frozenset(fields)
