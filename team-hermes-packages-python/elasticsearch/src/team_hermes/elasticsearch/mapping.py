"""Derive facets and sorting capabilities from an index mapping.

A field's mapping already says how it can be faceted: a keyword is categorical,
a float is continuous, a date is a timeline. Restating that in a hand-written
catalog duplicates the mapping and needs guard tests to keep the copies in
sync — so derive it instead, and declare only the exceptions.
"""

from collections.abc import Mapping
from typing import Literal, TypedDict

from .facets import Facet
from .facets.dynamic import DynamicFacetFamily
from .facets.histogram import (
    DEFAULT_MAX_HISTOGRAM_BUCKETS,
    CalendarInterval,
    DateHistogramFacet,
    NumericHistogramFacet,
)
from .facets.terms import TermsFacet
from .indexing import DynamicField

# ES numeric field types that a histogram facet can bucket.
_NUMERIC_TYPES = frozenset({"float", "double", "half_float", "scaled_float", "integer", "long", "short", "byte"})


class FieldMapping(TypedDict, total=False):
    """Elasticsearch field mapping options relevant to capability inference.

    All keys are optional because Elasticsearch supplies defaults. This is not
    an exhaustive schema or runtime validator for Elasticsearch mappings.
    """

    type: str
    fields: Mapping[str, "FieldMapping"]
    properties: Mapping[str, "FieldMapping"]
    meta: Mapping[str, str]
    enabled: bool
    doc_values: bool
    dynamic: bool | Literal["strict", "runtime"]


def _facet_for_mapping(
    name: str,
    mapping: FieldMapping,
    *,
    max_buckets: int,
    date_interval: CalendarInterval,
) -> Facet | None:
    """The facet a mapped field implies, or ``None`` when it isn't facetable.

    Objects, geo-points and analysed text without a ``.keyword`` subfield have no
    sensible default facet, so they are skipped rather than guessed at.
    """
    if not _is_sortable(mapping):
        return None
    match mapping.get("type"):
        case "keyword":
            return TermsFacet(field=name)
        case "text":
            return TermsFacet(field=name, keyword=True)
        case "date":
            return DateHistogramFacet(field=name, calendar_interval=date_interval)
        case field_type if field_type in _NUMERIC_TYPES:
            return NumericHistogramFacet(field=name, max_buckets=max_buckets)
    return None


def sortable_from_mapping(properties: Mapping[str, FieldMapping]) -> frozenset[str]:
    """Every mapped field a search may sort by: known scalar types with doc values.

    This is a capability check, not an authorization policy; customize public
    sorting with ``SearchDefinition.with_sorting()``. Analysed ``text`` is included
    only when it carries a ``.keyword`` subfield, whose path the caller resolves. Marked
    dynamic discovery catalogs are internal, never public sort fields.
    """
    return frozenset(
        name
        for name, mapping in properties.items()
        if mapping.get("meta", {}).get("facet_type") != "dynamic"
        if _is_sortable(mapping)
    )


def _is_sortable(mapping: FieldMapping) -> bool:
    if mapping.get("enabled") is False:
        return False
    field_type = mapping.get("type")
    if field_type == "text":
        keyword = mapping.get("fields", {}).get("keyword", {})
        return keyword.get("type") == "keyword" and keyword.get("doc_values", True) is not False
    return (
        field_type in _NUMERIC_TYPES | {"keyword", "date", "date_nanos", "boolean", "ip", "unsigned_long"}
        and mapping.get("doc_values", True) is not False
    )


def facets_from_mapping(
    properties: Mapping[str, FieldMapping],
    *,
    max_histogram_buckets: int = DEFAULT_MAX_HISTOGRAM_BUCKETS,
    date_interval: CalendarInterval = "year",
) -> tuple[Facet | DynamicFacetFamily, ...]:
    """Infer dynamic families and static facets, keeping internal storage fields hidden."""
    dynamic = _dynamic_fields(properties)
    internal = frozenset(path for field in dynamic for path in field.owned_fields)
    return (
        *(DynamicFacetFamily(field=field, max_buckets=max_histogram_buckets) for field in dynamic),
        *(
            facet
            for name, mapping in properties.items()
            if name not in internal
            and (
                facet := _facet_for_mapping(
                    name, mapping, max_buckets=max_histogram_buckets, date_interval=date_interval
                )
            )
            is not None
        ),
    )


def _dynamic_fields(properties: Mapping[str, FieldMapping]) -> tuple[DynamicField, ...]:
    """Read catalog markers, validating their conventional storage layout."""
    fields: list[DynamicField] = []
    for name, mapping in properties.items():
        metadata = mapping.get("meta", {})
        if metadata.get("facet_type") != "dynamic":
            continue
        family = metadata.get("family")
        if not isinstance(family, str):
            raise ValueError(f"Dynamic catalog {name!r} requires a string family")
        field = DynamicField(family)
        if name != field.discovery_field or mapping.get("type") != "keyword" or not _is_sortable(mapping):
            raise ValueError(f"Invalid dynamic catalog mapping for {name!r}")
        for path in field.paths:
            namespace = properties.get(path, {})
            if namespace.get("type") != "object" or namespace.get("enabled") is False:
                raise ValueError(f"Dynamic family {family!r} requires object namespace {path!r}")
        fields.append(field)
    return tuple(fields)
