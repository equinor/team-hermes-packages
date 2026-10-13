"""Generic, domain-agnostic Elasticsearch faceting building blocks.

Quick start
-----------

The doctest harness supplies ``es_client`` (an offline ESClient implementation),
``index_name``, and ``base_query``. Its response contains five matching Norwegian
documents across two sites; the country facet also exposes three Swedish documents
because a facet's own selection is excluded from its distribution.

    >>> SCOPE = CardinalityAggregation(name="search_stats", fields=("site.keyword",))
    >>> ITEMS = SearchDefinition(
    ...     facets=(
    ...         TermsFacet(field="country"),
    ...         NumericHistogramFacet(field="depth"),
    ...         DateHistogramFacet(field="created_at", calendar_interval="year"),
    ...     ),
    ... )
    >>> result = (
    ...     ITEMS.search().using(es_client).index(index_name).query(base_query)
    ...     .with_facet_filters(terms={"country": ["NO"]})
    ...     .aggregate_facets("country").aggregations(SCOPE).offset_page(number=1, size=20).execute()
    ... )
    >>> facets = result.facets  # Flat typed facets, ready to return
    >>> [(facet.key, facet.aggregated) for facet in facets]
    [('country', True), ('depth', False), ('created_at', False)]
    >>> [(bucket.value, bucket.count) for bucket in facets[0].buckets]
    [('NO', 5), ('SE', 3)]
    >>> totals = result.aggregation_by(SCOPE)  # ScopeCounts (typed; pass the handle)
    >>> totals.doc_count
    5
    >>> totals.cardinalities
    {'site.keyword': 2}

Start with search.py: define supported fields, configure a query, execute it.
mapping.py infers capabilities from index mappings; facets/ owns indexed field metadata.
input.py validates filter values; facet_plan.py resolves fields, validates selections,
compiles facet filters, and selects discovery and distribution work;
elasticsearch.py contains stateless Elasticsearch helpers; result.py and pagination.py own the output.
Only execute initiates I/O, through the minimal ESClient boundary.
Facets own their aggregation configuration and extraction, never selected values;
aggregations/ owns non-facet aggregation definitions and extraction; applications map their responses.
"""

from .aggregations import (
    Aggregation,
    AggregationBucket,
    AggregationValue,
    CardinalityAggregation,
    ExistsCountsAggregation,
    IntegerSumAggregation,
    SampledTermsAggregation,
    ScopeCounts,
)
from .client import ESClient
from .elasticsearch_client import ElasticsearchClient
from .elasticsearch_client_interface import BulkIndexResult, ElasticsearchClientInterface
from .errors import (
    FacetBoundsPrefetchError,
    InvalidCursorError,
    InvalidRangeFilterError,
    InvalidSearchRequestError,
    ResultWindowError,
    UnknownFacetError,
)
from .facets import Facet, owned_fields
from .facets.dynamic import AvailableFacetCatalog, DynamicFacetFamily
from .facets.histogram import Bounds, DateHistogramFacet, NumericHistogramFacet
from .facets.result import (
    ExtractedFacets,
    FacetBucket,
    FacetData,
    FacetDescriptor,
    FacetResponse,
    FacetValueType,
    HistogramData,
    RangeFacetResponse,
    TermFacetResponse,
    project_facets,
)
from .facets.terms import TermsFacet
from .filters import FacetKind
from .input import RangeFilter, SearchRequest
from .mapping import facets_from_mapping, sortable_from_mapping
from .pagination import (
    BACKWARD,
    FORWARD,
    Cursor,
    CursorPagination,
    Cursors,
    Direction,
    OffsetPagination,
    Pagination,
    resolve_pagination,
)
from .result import FacetedSearchResponse, SearchResult, safe_map_hits
from .search import SearchDefinition, SearchQuery
from .sort import (
    SortClause,
    SortOrder,
    SortPolicy,
)

__all__ = [
    "ESClient",
    "ElasticsearchClient",
    "ElasticsearchClientInterface",
    "BulkIndexResult",
    # Fluent definition, query and assembled response
    "SearchDefinition",
    "SearchQuery",
    "SearchResult",
    "SearchRequest",
    "FacetedSearchResponse",
    "RangeFilter",
    # Facets
    "TermsFacet",
    "NumericHistogramFacet",
    "DateHistogramFacet",
    "Facet",
    "owned_fields",
    # Data-defined facets (available names listed per search)
    "DynamicFacetFamily",
    "AvailableFacetCatalog",
    # Mapping inference
    "facets_from_mapping",
    "sortable_from_mapping",
    # Typed non-facet aggregations
    "Aggregation",
    "AggregationValue",
    "AggregationBucket",
    "SampledTermsAggregation",
    "CardinalityAggregation",
    "ExistsCountsAggregation",
    "IntegerSumAggregation",
    "ScopeCounts",
    # Result types
    "ExtractedFacets",
    "FacetBucket",
    "HistogramData",
    "FacetData",
    # Client-facing projection
    "FacetResponse",
    "TermFacetResponse",
    "RangeFacetResponse",
    "FacetDescriptor",
    "FacetKind",
    "FacetValueType",
    "project_facets",
    # Errors
    "FacetBoundsPrefetchError",
    "InvalidRangeFilterError",
    "InvalidCursorError",
    "InvalidSearchRequestError",
    "ResultWindowError",
    "UnknownFacetError",
    # Pagination cursors
    "OffsetPagination",
    "CursorPagination",
    "resolve_pagination",
    "Cursor",
    "Cursors",
    "Pagination",
    "FORWARD",
    "BACKWARD",
    "Direction",
    # Helpers
    "Bounds",
    "safe_map_hits",
    # Sort policy and grammar
    "SortPolicy",
    "SortClause",
    "SortOrder",
]
