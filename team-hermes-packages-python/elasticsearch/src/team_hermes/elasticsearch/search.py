"""Reusable search definitions and copy-on-change fluent queries."""

from collections.abc import Collection, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Self

from elasticsearch import NotFoundError
from elasticsearch.dsl import Document
from elasticsearch.dsl.aggs import Agg
from elasticsearch.dsl.query import Query
from elasticsearch.dsl.response import Response

from .aggregations import (
    Aggregation,
    AggregationsResponse,
    AggregationValue,
    CardinalityAggregation,
    ExistsCountsAggregation,
    IntegerSumAggregation,
    SampledTermsAggregation,
)
from .client import ESClient
from .elasticsearch import _build_search, build_aggregations, compose_query, fetch_histogram_bounds
from .errors import InvalidCursorError, InvalidSearchRequestError, ResultWindowError
from .facet_plan import FacetPlan
from .facets import Facet, owned_fields
from .facets.dynamic import DynamicFacetFamily
from .facets.histogram import DateHistogramFacet, NumericHistogramFacet
from .facets.terms import TermsFacet
from .indexing import DynamicField
from .input import RangeFilter, SearchRequest, validate_ranges, validate_terms
from .mapping import FieldMapping, facets_from_mapping, sortable_from_mapping
from .pagination import Cursor, CursorPagination, Cursors, Pagination, _WindowProbe, resolve_pagination
from .result import SearchResult, _project_search_facets
from .sort import SortClause, SortOrder, SortPolicy

DEFAULT_RESULT_WINDOW = 10_000


def _configure_facets(
    facets: Sequence[Facet | DynamicFacetFamily],
    *,
    overrides: tuple[Facet | DynamicFacetFamily, ...] = (),
    exclude: Collection[str] = (),
) -> tuple[Facet | DynamicFacetFamily, ...]:
    """Prepend explicit overrides to the remaining current catalog without mutating it.

    Overrides replace matching names or owned indexed fields. Exclusions target
    indexed fields or dynamic family names, not static aliases. This call's
    overrides take precedence over exclusions, including their owned fields.
    """
    overrides = tuple(overrides)
    replaced_names = {facet.name for facet in overrides}
    excluded = frozenset(exclude)
    skipped_fields = owned_fields(overrides) | excluded
    return (
        *overrides,
        *(
            facet
            for facet in facets
            if facet.name not in replaced_names
            and not owned_fields((facet,)).intersection(skipped_fields)
            and not (isinstance(facet, DynamicFacetFamily) and facet.name in excluded)
        ),
    )


@dataclass(frozen=True, slots=True)
class SearchDefinition:
    """Reusable facet, sorting, and pagination capabilities for a search.

    Configuration methods return new definitions; retain their return values.
    Factories inspect local mappings without contacting Elasticsearch.
    """

    facets: tuple[Facet | DynamicFacetFamily, ...] = ()
    max_result_window: int = DEFAULT_RESULT_WINDOW
    supports_cursor_pagination: bool = True
    sorting: SortPolicy = field(default_factory=SortPolicy)
    _sort_families: tuple[DynamicField, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        """Validate capabilities and hide discovery fields owned by dynamic families."""
        if self.max_result_window < 1:
            raise ValueError("max_result_window must be positive")

        declared_facets = tuple(self.facets)
        for facet in declared_facets:
            if not isinstance(facet, TermsFacet | NumericHistogramFacet | DateHistogramFacet | DynamicFacetFamily):
                raise TypeError(f"Unsupported facet {type(facet).__name__!r}")

        # Dynamic families own their discovery fields; these are not selectable facets.
        discovery_field_names = frozenset(
            key for facet in declared_facets if isinstance(facet, DynamicFacetFamily) for key in facet.internal_keys
        )
        public_facets = tuple(
            facet
            for facet in declared_facets
            if isinstance(facet, DynamicFacetFamily) or facet.indexed_field_path not in discovery_field_names
        )

        if len({facet.name for facet in public_facets}) != len(public_facets):
            raise ValueError("Facet names must be unique")

        object.__setattr__(self, "facets", public_facets)

    @property
    def static_facets(self) -> tuple[Facet, ...]:
        """Declared individual facets, excluding dynamic families and their query-time resolutions."""
        return tuple(facet for facet in self.facets if not isinstance(facet, DynamicFacetFamily))

    @property
    def dynamic_facet_families(self) -> tuple[DynamicFacetFamily, ...]:
        """Declared namespaces used to resolve and discover dynamic facets."""
        return tuple(facet for facet in self.facets if isinstance(facet, DynamicFacetFamily))

    @property
    def internal_facet_keys(self) -> frozenset[str]:
        """Discovery-field names hidden from public facets; returned hit fields are unaffected."""
        return frozenset(key for family in self.dynamic_facet_families for key in family.internal_keys)

    @classmethod
    def from_document(
        cls,
        document: type[Document],
        *,
        max_result_window: int = DEFAULT_RESULT_WINDOW,
        supports_cursor_pagination: bool = True,
    ) -> Self:
        """Infer facets and sorting from a DSL Document class's local mapping.

        Includes inherited mapped fields and declared dynamic families. No index
        settings are fetched: pass the actual result window if it differs from
        the default. Cursor support is an application-controlled capability.

        Example, where ProductDocument is a DSL Document subclass::

            definition = SearchDefinition.from_document(
                ProductDocument, max_result_window=5_000,
            )
        """
        properties = document._doc_type.mapping.to_dict().get("properties", {})
        return cls.from_mapping(
            properties,
            max_result_window=max_result_window,
            supports_cursor_pagination=supports_cursor_pagination,
        )

    @classmethod
    def from_mapping(
        cls,
        properties: Mapping[str, FieldMapping],
        *,
        max_result_window: int = DEFAULT_RESULT_WINDOW,
        supports_cursor_pagination: bool = True,
    ) -> Self:
        """Infer supported facets and sorting from mapping properties, without I/O.

        Pass the field-to-mapping dictionary, not the outer ``properties`` or
        ``mappings`` wrapper. Supported text sorts use their keyword subfield;
        dynamic families contribute sortable numeric and categorical namespaces.
        Pagination options are configured here, not read from Elasticsearch.

        Example::

            >>> definition = SearchDefinition.from_mapping({
            ...     "brand": {"type": "keyword"},
            ...     "price": {"type": "float"},
            ... })
            >>> sorted(facet.name for facet in definition.static_facets)
            ['brand', 'price']
            >>> sorted(definition.sorting.fields.items())
            [('brand', 'brand'), ('price', 'price')]
        """
        facets = facets_from_mapping(properties)
        sortable_names = sortable_from_mapping(properties)
        dynamic_fields = tuple(facet.field for facet in facets if isinstance(facet, DynamicFacetFamily))

        sort_fields = {
            name: f"{name}.keyword" if properties[name].get("type") == "text" else name for name in sortable_names
        }
        sort_namespaces = frozenset(path for dynamic_field in dynamic_fields for path in dynamic_field.paths)
        sorting = SortPolicy(fields=sort_fields, namespaces=sort_namespaces)

        return cls(
            facets=facets,
            sorting=sorting,
            # Preserve mapping-owned sort families independently of facet exclusions.
            _sort_families=dynamic_fields,
            max_result_window=max_result_window,
            supports_cursor_pagination=supports_cursor_pagination,
        )

    def with_facets(
        self,
        *,
        overrides: tuple[Facet | DynamicFacetFamily, ...] = (),
        exclude: Collection[str] = (),
    ) -> Self:
        """Customize the current catalog without changing sorting or returned hit fields.

        Overrides replace facets with matching names or owned indexed fields.
        Exclude indexed fields or dynamic family names from the current catalog;
        overrides supplied in this call take precedence. No arguments preserves it.
        Excluding any storage field owned by a family removes that family.
        This controls facet capabilities, not access to documents or hit fields.
        """
        return replace(self, facets=_configure_facets(self.facets, overrides=overrides, exclude=exclude))

    def with_sorting(
        self,
        *,
        fields: Mapping[str, str] | None = None,
        namespaces: Collection[str] | None = None,
        exclude: Collection[str] = (),
        default: Sequence[SortClause] | None = None,
        tiebreakers: Sequence[SortClause] | None = None,
    ) -> Self:
        """Return a definition with updated sorting capabilities and trusted defaults.

        ``fields`` maps public names to indexed paths; ``namespaces`` allows
        qualified dynamic paths. Supplied collections replace existing ones,
        ``None`` preserves them, and empty collections clear them. Exclusions
        remove public names, namespace paths, or mapping-inferred family names,
        independently of facet inclusion.

        Defaults and tiebreakers use trusted indexed paths and are not removed
        by exclusions. Use a unique tiebreaker for stable cursor traversal.
        """
        current_sorting = self.sorting

        selected_fields = current_sorting.fields if fields is None else fields
        selected_namespaces = current_sorting.namespaces if namespaces is None else frozenset(namespaces)

        excluded_names = frozenset(exclude)
        excluded_family_paths = frozenset(
            path for family in self._sort_families if family.name in excluded_names for path in family.paths
        )
        excluded_namespaces = excluded_names | excluded_family_paths

        remaining_fields = {name: path for name, path in selected_fields.items() if name not in excluded_names}
        remaining_namespaces = selected_namespaces - excluded_namespaces

        # Public exclusions do not remove trusted defaults or tiebreakers.
        default_sort = current_sorting.default if default is None else tuple(default)
        sort_tiebreakers = current_sorting.tiebreakers if tiebreakers is None else tuple(tiebreakers)

        sorting = SortPolicy(
            fields=remaining_fields,
            namespaces=remaining_namespaces,
            default=default_sort,
            tiebreakers=sort_tiebreakers,
        )
        return replace(self, sorting=sorting)

    def search(self) -> "SearchQuery":
        """Create a fresh query with this definition's default sort and tiebreakers.

        Starts at offset page 1 with 20 hits and exact totals enabled. Facet
        distributions, dynamic discovery, metrics, and presence counts must be
        requested separately. Nothing is sent until ``execute()``.

        Example, using an ESClient implementation::

            query = definition.search().using(client).index("products")
        """
        return SearchQuery(self).sort()


@dataclass(frozen=True, slots=True)
class SearchQuery:
    """Copy-on-change search configuration; only execute() initiates I/O.

    Start with ``definition.search()`` and retain or chain each method's result.
    See the package README for usage examples.
    """

    _definition: SearchDefinition
    _client: ESClient | None = field(default=None, repr=False)
    _index: str = ""
    _query: Query | None = field(default=None, repr=False)
    _base_filters: tuple[Query, ...] = ()
    _terms: Mapping[str, tuple[str, ...]] = field(default_factory=lambda: MappingProxyType({}))
    _ranges: Mapping[str, RangeFilter] = field(default_factory=lambda: MappingProxyType({}))
    _facet_names_to_aggregate: tuple[str, ...] = ()
    _aggregations: tuple[Aggregation, ...] = ()
    _requested_facet_families: tuple[str, ...] = ()
    _sort: tuple[SortClause, ...] = ()
    _page_number: int = 1
    _page_size: int = 20
    _cursor: Cursor | str | None = None
    _facet_counts_enabled: bool = False
    _aggregations_enabled: bool = True
    _track_exact_total: bool = True

    def using(self, client: ESClient) -> Self:
        """Replace the client used for execution.

        The client must implement ``ESClient.execute(search, *, index_name)``;
        a raw Elasticsearch client does not satisfy this contract.
        """
        return replace(self, _client=client)

    def index(self, name: str) -> Self:
        """Replace the target index; reject empty or whitespace-only names with ValueError.

        Does not create the index or check whether it exists.
        """
        if not name.strip():
            raise ValueError("An index name is required")
        return replace(self, _index=name)

    def query(self, query: Query) -> Self:
        """Replace the base query with a deep copy, retaining all filter settings.

        Applies to hits and all aggregations; facet scoping never excludes it.
        """
        return replace(self, _query=deepcopy(query))

    def add_base_filter(self, query: Query) -> Self:
        """Append a deep-copied permanent restriction, never excluded by facet scoping.

        Repeated calls combine with AND. Put authorization restrictions here,
        not in interactive facet filters, which expose alternatives.
        """
        return replace(self, _base_filters=(*self._base_filters, deepcopy(query)))

    def with_facet_filters(
        self,
        *,
        terms: Mapping[str, list[str] | tuple[str, ...]] | None = None,
        ranges: Mapping[str, RangeFilter] | None = None,
    ) -> Self:
        """Replace both interactive filter maps with validated snapshots.

        Omitted maps are cleared; base restrictions remain. Values within a term
        facet use OR; different facets use AND. Ranges are inclusive, with ``None``
        for open ends. Names and value kinds are resolved at execution.

        Distributions omit their own field/kind selection to show alternatives.
        Never put authorization restrictions in these maps.
        """
        return replace(
            self,
            _terms=MappingProxyType(validate_terms({} if terms is None else terms)),
            _ranges=MappingProxyType(validate_ranges({} if ranges is None else ranges)),
        )

    def aggregate_facets(self, *names: str) -> Self:
        """Replace the requested facet distributions without changing active filters.

        Accept static public names or qualified dynamic names. No arguments clears
        distribution requests, not the facet catalog or selections. Computation
        requires aggregations to be enabled; names are validated on execution.
        """
        return replace(self, _facet_names_to_aggregate=names)

    def aggregations(self, *aggregations: Aggregation) -> Self:
        """Replace typed aggregations calculated independently of the hit page.

        Supports cardinality, integer-sum, existence-count, and sampled-terms
        aggregations. Every active filter applies. Names must be unique.
        No arguments clears requests; computation requires aggregations enabled.
        Read values with ``aggregation_by()`` using an equivalent definition.
        """
        for aggregation in aggregations:
            if not isinstance(
                aggregation,
                CardinalityAggregation | IntegerSumAggregation | ExistsCountsAggregation | SampledTermsAggregation,
            ):
                raise TypeError(f"Unsupported aggregation {type(aggregation).__name__!r}")
        names = [aggregation.name for aggregation in aggregations]
        if len(names) != len(set(names)):
            raise ValueError("Aggregation names must be unique")
        return replace(self, _aggregations=aggregations)

    def discover_facets(self, *families: str) -> Self:
        """Replace requests to discover dynamic fields among matching documents.

        Pass family names, not qualified attribute names. Execution returns flat
        facet descriptors and presence counts, not value buckets or histograms.
        All active filters apply. No arguments clears discovery requests;
        aggregations must be enabled for discovery to run.
        """
        return replace(self, _requested_facet_families=families)

    def sort(self, field: str | None = None, order: SortOrder = "asc") -> Self:
        """Replace sorting with an allowed public field and configured tiebreakers.

        Resolve aliases or permitted qualified dynamic paths through the sorting
        policy. No field restores the configured defaults; it does not clear
        sorting. Public field sorting places missing values last.
        """
        return replace(self, _sort=self._definition.sorting.compile(field, order))

    def _validate_page(self, number: int, size: int) -> None:
        """Require positive page numbers and sizes no larger than the result window.

        Raise ValueError for invalid bounds, such as page 0 or size 0. This shared
        check does not test the offset against the window; execution handles that.
        """
        if number < 1 or size < 1 or size > self._definition.max_result_window:
            raise ValueError("Page number and size must be positive; size cannot exceed the result window")

    def offset_page(self, *, number: int = 1, size: int = 20) -> Self:
        """Select a one-based offset page and clear any previous cursor.

        Number must be positive; size must be positive and within the result window,
        except size zero on page one allows aggregation-only execution: no hits,
        page count, or navigation links. Exact totals remain independently configurable.
        Execution probes pages crossing the window and raises ResultWindowError
        if matches remain at the offset. Use cursors for deep traversal.
        """
        if size == 0:
            if number != 1:
                raise ValueError("Aggregation-only searches require page number 1")
        else:
            self._validate_page(number, size)
        return replace(self, _page_number=number, _page_size=size, _cursor=None)

    def cursor_page(self, cursor: Cursor | str, *, size: int = 20, display_page: int = 1) -> Self:
        """Resume from a cursor without applying an offset.

        Accept a Cursor or encoded token; ``display_page`` is response metadata only.
        Page and size must be positive, with size within the result window.
        Requires cursor support and a nonempty stable sort; use a unique tiebreaker.
        Keep index, query, filters, and sorting unchanged; tokens are not snapshots.
        """
        self._validate_page(display_page, size)
        if not isinstance(cursor, Cursor | str):
            raise InvalidCursorError("Cursor pagination requires a cursor value or token")
        if not self._definition.supports_cursor_pagination:
            raise InvalidSearchRequestError("Cursor pagination is not supported by this search")
        return replace(self, _page_number=display_page, _page_size=size, _cursor=cursor)

    def with_facet_counts(self, *, enabled: bool = True) -> Self:
        """Enable or disable document-presence counts for eligible static facets.

        Counts cover all matches with all active filters, populate facets rather
        than public metrics, and override bucket-derived counts. Requires
        aggregations enabled; result-window probes skip these explicit counts.
        """
        return replace(self, _facet_counts_enabled=enabled)

    def with_aggregations(self, *, enabled: bool = True) -> Self:
        """Toggle requested facets, discovery, typed aggregations, and counts.

        Keeps exact totals, filters, and stored requests unchanged. Disabled ordinary
        pages have no facets or computed aggregations; re-enabling restores requests.
        Result-window probes force aggregations even when disabled.
        """
        return replace(self, _aggregations_enabled=enabled)

    def with_exact_total(self, *, enabled: bool = True) -> Self:
        """Toggle exact hit totals and page counts independently of aggregations.

        When disabled, ordinary results have ``total=None`` and ``pages=None``;
        cursor navigation remains available. Result-window probes still calculate
        totals, and missing-index results always report zero totals and pages.
        """
        return replace(self, _track_exact_total=enabled)

    def apply_request(self, request: SearchRequest) -> Self:
        """Replace query controls with the values from a validated HTTP search request.

        Applies filters, distributions, discovery, sort, pagination, and facet counts.
        ``include_metadata`` controls aggregations and exact totals together.
        A cursor overrides offset paging; ``page`` then becomes display metadata only.

        Retains client, index, base query/restrictions, and aggregation definitions.
        The application must handle ``request.q`` and authorization separately.
        """
        query = (
            self.with_facet_filters(terms=request.terms, ranges=request.ranges)
            .aggregate_facets(*request.aggregate_facets)
            .discover_facets(*request.discover_facets)
            .sort(request.sort_by, request.sort_order)
            .with_facet_counts(enabled=request.include_facet_counts)
            .with_aggregations(enabled=request.include_metadata)
            .with_exact_total(enabled=request.include_metadata)
        )
        if request.cursor is not None:
            return query.cursor_page(request.cursor, size=request.per_page, display_page=request.page)
        return query.offset_page(number=request.page, size=request.per_page)

    def execute(self) -> SearchResult:
        """Validate and run the configured search, returning hits and requested metadata.

        Requires ``using(client)`` and ``index(name)``. Resolve facet names and
        pagination before I/O, optionally prefetch automatic histogram bounds,
        then run the main search and assemble facets, aggregations, and cursors.

        A missing-index NotFoundError returns an empty result with
        ``missing_index=True`` and zero totals/pages. Invalid requests and other
        failures are not silently converted to empty results. Offset pages past
        the result window raise ResultWindowError when matches remain there.

        Example::

            result = query.aggregate_facets("brand").offset_page(size=25).execute()
            brands = result.facets
            products = result.hits
        """
        if self._client is None or not self._index:
            raise ValueError("Set using(client) and index(name) before execute()")

        facet_plan = FacetPlan.from_inputs(
            definitions=self._definition.facets,
            terms=self._terms,
            ranges=self._ranges,
            facet_names_to_aggregate=self._facet_names_to_aggregate,
            requested_family_names=self._requested_facet_families,
        )
        pagination = resolve_pagination(
            number=self._page_number,
            size=self._page_size,
            cursor=self._cursor,
            max_result_window=self._definition.max_result_window,
            sort_field_count=len(self._sort),
        )
        is_window_probe = isinstance(pagination, _WindowProbe)

        # Window probes force aggregations and exact totals even when disabled,
        # but omit explicit static-facet presence counts.
        compute_aggregations = is_window_probe or self._aggregations_enabled
        track_exact_total = is_window_probe or self._track_exact_total

        base_query = compose_query(self._query, self._base_filters)
        request_aggregations: dict[str, Agg] = {}

        presence_count_aggregation: ExistsCountsAggregation | None = None
        if compute_aggregations and self._facet_counts_enabled and not is_window_probe:
            presence_count_aggregation = ExistsCountsAggregation.over(self._definition.static_facets)

        try:
            if compute_aggregations:
                bounds = fetch_histogram_bounds(self._client, self._index, base_query, facet_plan)
                request_aggregations, presence_count_aggregation = build_aggregations(
                    facet_plan,
                    self._aggregations,
                    bounds=bounds,
                    presence_counts=presence_count_aggregation,
                )
            search = _build_search(
                self._index,
                base_query,
                filters=facet_plan.filters,
                aggregations=request_aggregations,
                sort=self._sort,
                pagination=pagination,
                track_exact_total=track_exact_total,
            )
            response = self._client.execute(search, index_name=self._index)
        except NotFoundError:
            return SearchResult(
                hits=[],
                facets=[],
                total=0,
                page=self._page_number,
                pages=0,
                cursors=Cursors(),
                missing_index=True,
            )

        return self._assemble_result(
            response,
            pagination,
            facet_plan=facet_plan,
            presence_count_aggregation=presence_count_aggregation,
            compute_aggregations=compute_aggregations,
            track_exact_total=track_exact_total,
        )

    def _assemble_result(
        self,
        response: Response,
        pagination: Pagination,
        *,
        facet_plan: FacetPlan,
        presence_count_aggregation: ExistsCountsAggregation | None,
        compute_aggregations: bool,
        track_exact_total: bool,
    ) -> SearchResult:
        """Extract enabled metadata and restore display order and navigation.

        Hide internal facet keys and retain typed aggregation definitions.
        Raise ResultWindowError when matches remain beyond the result window.
        """
        payload = response.to_dict() if compute_aggregations or track_exact_total else {}
        aggregation_values = AggregationsResponse(payload.get("aggregations", {}))
        total = int(payload["hits"]["total"]["value"]) if track_exact_total else None

        hits = list(response.hits)
        if isinstance(pagination, CursorPagination) and pagination.backward:
            hits.reverse()

        facet_presence_counts: dict[str, int] = {}
        if presence_count_aggregation is not None:
            facet_presence_counts = presence_count_aggregation.extract(
                aggregation_values.get(presence_count_aggregation.name, {})
            )

        extracted_aggregations: dict[str, tuple[Aggregation, AggregationValue]] | None = None
        if compute_aggregations:
            extracted_aggregations = {
                aggregation.name: (aggregation, aggregation.extract(aggregation_values.get(aggregation.name, {})))
                for aggregation in self._aggregations
            }

        if isinstance(pagination, _WindowProbe) and total is not None and pagination.requested_offset < total:
            raise ResultWindowError(self._definition.max_result_window)

        result_facets = []
        if compute_aggregations:
            result_facets = _project_search_facets(
                aggregation_values,
                facet_plan=facet_plan,
                counts=facet_presence_counts,
                exclude=self._definition.internal_facet_keys,
            )

        pages = pagination.pages_for(total) if self._page_size else None

        cursors = Cursors()
        if self._page_size and self._definition.supports_cursor_pagination:
            cursors = pagination.neighbor_cursors(hits)

        return SearchResult(
            hits=hits,
            facets=result_facets,
            total=total,
            page=self._page_number,
            pages=pages,
            cursors=cursors,
            _aggregation_values=extracted_aggregations,
        )
