"""Index-owned dynamic fields, listed and selected alongside ordinary facets."""

from dataclasses import dataclass, replace

from ..aggregations import AggregationsResponse
from ..errors import InvalidSearchRequestError
from ..filters import FacetKind
from ..indexing import DynamicField
from .histogram import DEFAULT_MAX_HISTOGRAM_BUCKETS
from .result import FacetDescriptor, FacetValueType
from .terms import DEFAULT_TERMS_SIZE, TermsFacet


@dataclass(frozen=True, slots=True)
class AvailableFacetCatalog:
    """Available dynamic fields in matching documents, with their descriptors and document counts."""

    descriptors: list[FacetDescriptor]
    counts: dict[str, int]


@dataclass(frozen=True, slots=True)
class DynamicFacetFamily:
    """Declare dynamic namespaces, resolve ordinary facets, and optionally list available fields."""

    field: DynamicField
    terms_size: int = DEFAULT_TERMS_SIZE
    discovery_size: int = DEFAULT_TERMS_SIZE
    max_buckets: int = DEFAULT_MAX_HISTOGRAM_BUCKETS

    def __post_init__(self) -> None:
        if min(self.terms_size, self.discovery_size) < 1:
            raise ValueError("Dynamic facet bucket limits must be positive")
        if self.max_buckets < 2:
            raise ValueError("max_buckets must be at least 2")

    @property
    def name(self) -> str:
        return self.field.name

    @property
    def source_descriptors(self) -> tuple[FacetDescriptor, ...]:
        """Namespace metadata shared by filter validation and available-field listing."""
        return (
            FacetDescriptor(self.field.numeric_path, FacetKind.RANGE, FacetValueType.NUMBER, self.field.numeric_path),
            FacetDescriptor(
                self.field.categorical_path, FacetKind.TERM, FacetValueType.STRING, self.field.categorical_path
            ),
        )

    def field_names_facet(self) -> TermsFacet:
        """Build the internal term facet that lists available field names and document counts."""
        return TermsFacet(field=self.field.discovery_field, size=self.discovery_size, order={"_key": "asc"})

    @property
    def internal_keys(self) -> frozenset[str]:
        """Internal field-name aggregation keys, never published as selectable facets.

        Pass to ``project_facets(exclude=...)`` so the name lists cannot leak
        into the client contract.
        """
        return frozenset({self.field.discovery_field})

    def extract_catalog(self, aggs: AggregationsResponse) -> AvailableFacetCatalog:
        """Read available qualified names and counts; reject incomplete or unknown namespaces."""
        key = self.field.discovery_field
        field_names = aggs.get(key, {}).get(key, {})
        if field_names.get("sum_other_doc_count", 0):
            raise InvalidSearchRequestError(
                f"Available facets for {self.name!r} exceed {self.discovery_size} attributes; refine your search."
            )
        descriptors: list[FacetDescriptor] = []
        counts: dict[str, int] = {}
        sources = {source.key: source for source in self.source_descriptors}
        for bucket in aggs.extract_buckets(key):
            namespace, _, name = bucket.key.partition(".")
            source = sources.get(namespace)
            if source is None or not name:
                raise ValueError(f"Invalid discovery key {bucket.key!r} for {self.name!r}")
            descriptors.append(replace(source, key=bucket.key))
            counts[bucket.key] = bucket.doc_count
        return AvailableFacetCatalog(descriptors=descriptors, counts=counts)
