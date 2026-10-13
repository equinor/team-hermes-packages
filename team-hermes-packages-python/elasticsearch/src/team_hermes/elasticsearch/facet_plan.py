"""Resolve, validate, and plan facet inputs shared by request construction and result projection."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Self

from elasticsearch.dsl import Q

from .errors import InvalidSearchRequestError, UnknownFacetError
from .facets import Facet
from .facets.dynamic import DynamicFacetFamily
from .facets.histogram import DateHistogramFacet, NumericHistogramFacet
from .facets.result import FacetDescriptor
from .facets.terms import TermsFacet
from .filters import FacetKind, Filter, drop_none
from .input import RangeFilter


def _unknown_filter(
    key: str, kind: FacetKind | None, static: Mapping[str, Facet], families: Sequence[DynamicFacetFamily]
) -> UnknownFacetError:
    known = [
        name
        for name, facet in static.items()
        if kind is None or isinstance(facet, TermsFacet) == (kind is FacetKind.TERM)
    ]
    known.extend(f"{source.key}.*" for family in families for source in family.source_descriptors)
    return UnknownFacetError([key], sorted(set(known)))


def _resolve_field(
    key: str,
    kind: FacetKind | None,
    static: Mapping[str, Facet],
    families: Sequence[DynamicFacetFamily],
) -> Facet:
    """Resolve filters by explicit kind, or infer the kind for requested distributions.

    Static aliases win; dynamic namespaces match exactly before the first dot.
    """
    if key in static:
        facet = static[key]
        if kind is not None and isinstance(facet, TermsFacet) != (kind is FacetKind.TERM):
            raise _unknown_filter(key, kind, static, families)
        return facet
    namespace, separator, name = key.partition(".")
    for family in families:
        for source in family.source_descriptors:
            if not separator or source.key != namespace:
                continue
            if not name:
                raise InvalidSearchRequestError("Dynamic attribute names must not be empty")
            if kind is not None and source.kind is not kind:
                raise InvalidSearchRequestError(f"Dynamic source {source.key!r} does not accept {kind.value} filters")
            if source.kind is FacetKind.RANGE:
                return NumericHistogramFacet(field=key, max_buckets=family.max_buckets, source=source.key)
            return TermsFacet(field=key, size=family.terms_size, source=source.key)
    raise _unknown_filter(key, kind, static, families)


def _validate_range_type(facet: Facet, bounds: RangeFilter) -> None:
    """Keep numeric and date fields distinct while passing date math through unchanged."""
    requires_date = isinstance(facet, DateHistogramFacet)
    for bound in (bounds.min, bounds.max):
        if bound is not None and isinstance(bound, str) != requires_date:
            expected = "date" if requires_date else "number"
            raise InvalidSearchRequestError(f"Range {facet.name!r} requires {expected} bounds")


def _resolve_facets(
    definitions: Sequence[Facet | DynamicFacetFamily],
    terms: Mapping[str, Sequence[str]],
    ranges: Mapping[str, RangeFilter],
    *,
    facet_names_to_aggregate: Sequence[str] = (),
) -> tuple[Facet, ...]:
    """Validate filters and resolve requested distributions independently.

    Retain static facets and selected or requested dynamic fields. Empty filter
    values remain supported, but are not required to request a distribution.
    """
    static: dict[str, Facet] = {
        facet.name: facet for facet in definitions if not isinstance(facet, DynamicFacetFamily)
    }
    families = tuple(facet for facet in definitions if isinstance(facet, DynamicFacetFamily))
    dynamic: dict[str, Facet] = {}
    for key in terms:
        facet = _resolve_field(key, FacetKind.TERM, static, families)
        if key not in static:
            dynamic[key] = facet
    for key, bounds in ranges.items():
        facet = _resolve_field(key, FacetKind.RANGE, static, families)
        _validate_range_type(facet, bounds)
        if key not in static:
            dynamic[key] = facet
    for key in facet_names_to_aggregate:
        if key not in static and key not in dynamic:
            dynamic[key] = _resolve_field(key, None, static, families)

    resolved: list[Facet] = []
    for definition in definitions:
        if isinstance(definition, DynamicFacetFamily):
            # Preserve numeric-before-categorical order within each dynamic family.
            for source in definition.source_descriptors:
                resolved.extend(facet for facet in dynamic.values() if facet.source == source.key)
        else:
            resolved.append(definition)
    return tuple(resolved)


def _build_facet_filters(
    facets: Sequence[Facet],
    terms: Mapping[str, Sequence[str]],
    ranges: Mapping[str, RangeFilter],
) -> tuple[Filter, ...]:
    """Compile validated values; empty terms and open ranges register fields without filtering."""
    filters: list[Filter] = []
    for facet in facets:
        if isinstance(facet, TermsFacet):
            if values := terms.get(facet.name):
                filters.append(
                    Filter(
                        field=facet.field,
                        kind=FacetKind.TERM,
                        query=Q("terms", **{facet.indexed_field_path: list(values)}),
                    )
                )
        elif (selection := ranges.get(facet.name)) is not None:
            if bounds := drop_none(gte=selection.min, lte=selection.max):
                filters.append(
                    Filter(field=facet.field, kind=FacetKind.RANGE, query=Q("range", **{facet.field: bounds}))
                )
    return tuple(filters)


def _select_facet_families(
    families: Sequence[DynamicFacetFamily], requested_names: Sequence[str]
) -> tuple[DynamicFacetFamily, ...]:
    """Validate and select families whose available field names will be listed later; no I/O."""
    known = {family.name for family in families}
    if unknown := sorted(set(requested_names) - known):
        raise UnknownFacetError(unknown, sorted(known))
    return tuple(family for family in families if family.name in requested_names)


@dataclass(frozen=True, slots=True, kw_only=True)
class FacetPlan:
    """Define the resolved facet inputs for one search, not its computed results."""

    catalog: tuple[Facet, ...]
    filters: tuple[Filter, ...]
    facets_to_aggregate: tuple[Facet, ...]
    discovery_families: tuple[DynamicFacetFamily, ...]

    def describe_catalog(self) -> tuple[FacetDescriptor, ...]:
        """Describe resolved facets in catalog order, without computed results."""
        return tuple(facet.describe() for facet in self.catalog)

    @classmethod
    def from_inputs(
        cls,
        *,
        definitions: Sequence[Facet | DynamicFacetFamily],
        terms: Mapping[str, Sequence[str]],
        ranges: Mapping[str, RangeFilter],
        facet_names_to_aggregate: Sequence[str] = (),
        requested_family_names: Sequence[str] = (),
    ) -> Self:
        families = tuple(facet for facet in definitions if isinstance(facet, DynamicFacetFamily))
        discovery_families = _select_facet_families(families, requested_family_names)
        catalog = _resolve_facets(definitions, terms, ranges, facet_names_to_aggregate=facet_names_to_aggregate)
        filters = _build_facet_filters(catalog, terms, ranges)
        aggregation_names = frozenset(facet_names_to_aggregate)

        return cls(
            catalog=catalog,
            filters=filters,
            facets_to_aggregate=tuple(facet for facet in catalog if facet.name in aggregation_names),
            discovery_families=discovery_families,
        )
