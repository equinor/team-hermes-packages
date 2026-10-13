"""Stateless Elasticsearch construction helpers and batched histogram bounds I/O."""

from collections.abc import Mapping, Sequence
from dataclasses import replace
from itertools import chain
from typing import Any, assert_never

from elasticsearch import ApiError, NotFoundError, TransportError
from elasticsearch.dsl import A, Q, Search
from elasticsearch.dsl.aggs import Agg
from elasticsearch.dsl.query import Query

from .aggregations import Aggregation, ExistsCountsAggregation
from .client import ESClient
from .errors import FacetBoundsPrefetchError
from .facet_plan import FacetPlan
from .facets.histogram import Bounds, NumericHistogramFacet
from .filters import FacetKind, Filter, agg_key, filter_bucket, queries, queries_excluding
from .pagination import CursorPagination, OffsetPagination, Pagination, _WindowProbe
from .sort import SortClause


def compose_query(query: Query | None, base_filters: Sequence[Query] = ()) -> Query:
    """Combine the user query with permanent restrictions that facet scoping never removes."""
    base = query if query is not None else Q("match_all")
    return Q("bool", must=[base], filter=list(base_filters)) if base_filters else base


def _pagination_parameters(pagination: Pagination) -> dict[str, Any]:
    """Translate a page state into mutually exclusive offset or cursor parameters."""
    match pagination:
        case OffsetPagination():
            return {"from_": pagination.offset, "size": pagination.page_size}
        case CursorPagination():
            return {"search_after": list(pagination.cursor.anchor), "size": pagination.page_size}
        case _WindowProbe():
            return {"from_": 0, "size": 0}
    return assert_never(pagination)


def _serialize_sort(clause: SortClause) -> dict[str, dict[str, str]]:
    """Translate one sort value to Elasticsearch options, omitting unspecified missing values."""
    options: dict[str, str] = {"order": clause.order}
    if clause.missing is not None:
        options["missing"] = clause.missing
    return {clause.field: options}


def _build_search(
    index_name: str,
    base_query: Query,
    *,
    pagination: Pagination,
    aggregations: Mapping[str, Agg],
    filters: Sequence[Filter] = (),
    sort: Sequence[SortClause] = (),
    track_exact_total: bool = True,
) -> Search:
    """Assemble the main request from resolved inputs, without I/O.

    Interactive selections filter hits through ``post_filter`` only; every aggregation already
    carries its own scope, so hiding a distribution never removes its filter.
    """
    search = Search(index=index_name).query(base_query)
    search = search.extra(track_total_hits=track_exact_total, **_pagination_parameters(pagination))
    if sort:
        backward = isinstance(pagination, CursorPagination) and pagination.backward
        search = search.sort(*(_serialize_sort(clause.reversed() if backward else clause) for clause in sort))
    if selection_queries := queries(filters):
        search = search.post_filter(Q("bool", filter=selection_queries))
    for name, aggregation in aggregations.items():
        search.aggs[name] = aggregation
    return search


def _build_histogram_bounds_request(
    base_query: Query, targets: Sequence[NumericHistogramFacet], filters: Sequence[Filter]
) -> Search:
    """Build one batched stats request, retaining permanent restrictions and excluding each target's range."""
    search = Search().query(base_query).extra(size=0, track_total_hits=False)
    for target in targets:
        search.aggs[agg_key("prefetch", target.name)] = filter_bucket(
            queries_excluding(filters, field=target.field, kind=FacetKind.RANGE),
            {"stats": A("stats", field=target.field)},
        )
    return search


def build_aggregations(
    facet_plan: FacetPlan,
    requested_aggregations: Sequence[Aggregation],
    *,
    bounds: Mapping[str, Bounds | None] | None = None,
    presence_counts: ExistsCountsAggregation | None = None,
) -> tuple[dict[str, Agg], ExistsCountsAggregation | None]:
    """Merge requested aggregations and assign internal counts a collision-free key."""
    filters = facet_plan.filters
    aggregations: dict[str, Agg] = {}
    for name, aggregation in chain(
        (
            facet.build_agg(filters, bounds=(bounds or {}).get(facet.name))
            if isinstance(facet, NumericHistogramFacet)
            else facet.build_agg(filters)
            for facet in facet_plan.facets_to_aggregate
        ),
        (aggregation.build_agg(filters) for aggregation in requested_aggregations),
        (family.field_names_facet().build_agg(filters) for family in facet_plan.discovery_families),
    ):
        if name in aggregations:
            raise ValueError(f"Duplicate aggregation key {name!r}")
        aggregations[name] = aggregation
    if presence_counts is None or not presence_counts.fields:
        return aggregations, None
    while presence_counts.name in aggregations:
        presence_counts = replace(presence_counts, name=f"_{presence_counts.name}")
    name, aggregation = presence_counts.build_agg(filters)
    aggregations[name] = aggregation
    return aggregations, presence_counts


def fetch_histogram_bounds(
    client: ESClient,
    index_name: str,
    base_query: Query,
    facet_plan: FacetPlan,
) -> dict[str, Bounds | None]:
    """Fetch requested automatic bounds in one batch, retaining permanent restrictions."""
    targets = tuple(
        facet
        for facet in facet_plan.facets_to_aggregate
        if isinstance(facet, NumericHistogramFacet) and facet.interval is None
    )
    if not targets:
        return {}
    search = _build_histogram_bounds_request(base_query, targets, facet_plan.filters)
    try:
        aggs = client.execute(search, index_name=index_name).to_dict().get("aggregations", {})
    except NotFoundError:
        raise
    except (ApiError, TransportError) as exc:
        raise FacetBoundsPrefetchError(tuple(target.name for target in targets)) from exc
    bounds: dict[str, Bounds | None] = {}
    for target in targets:
        stats = aggs.get(agg_key("prefetch", target.name), {}).get("stats", {})
        bounds[target.name] = Bounds.from_optional(stats.get("min"), stats.get("max"))
    return bounds
