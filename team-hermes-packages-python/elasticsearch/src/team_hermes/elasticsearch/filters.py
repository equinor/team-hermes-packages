"""Shared Elasticsearch primitives: resolved filters, aggregation keys, and field paths."""

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Literal

from elasticsearch.dsl import A, Q
from elasticsearch.dsl.aggs import Agg
from elasticsearch.dsl.query import Query

AggPrefix = Literal["hist", "card", "sum", "prefetch"]


def agg_key(prefix: AggPrefix, name: str) -> str:
    """Build a top-level ES aggregation key as ``f"{prefix}_{name}"``."""
    return f"{prefix}_{name}"


def filter_bucket(filters: Iterable[Query] | None, sub_aggs: dict[str, Agg]) -> Agg:
    """Wrap ``sub_aggs`` in an ES ``filter`` agg; empty filters → ``match_all``."""
    filter_queries = list(filters or [])
    wrapper = A("filter", filter=Q("bool", filter=filter_queries) if filter_queries else Q("match_all"))
    for name, sub in sub_aggs.items():
        wrapper.bucket(name, sub)
    return wrapper


def drop_none(**kwargs: Any) -> dict[str, Any]:
    """Drop unset optional arguments from Elasticsearch aggregation calls."""
    return {key: value for key, value in kwargs.items() if value is not None}


def resolve_keyword_field(field: str, *, keyword: bool = False, keyword_field: str | None = None) -> str:
    """Resolve the Elasticsearch field path for a text/keyword pair."""
    if keyword_field is not None:
        return keyword_field
    return f"{field}.keyword" if keyword else field


class FacetKind(StrEnum):
    """How a facet is selected — and, equivalently, which ES clause it compiles to.

    One enum for both because the two have always been 1:1: a categorical
    selection is a ``terms`` query, a continuous one is a ``range`` query.

    Defined here, in the query layer's leaf module, so the ES primitives stay
    usable without the client projection; :mod:`.facets.result` uses it as the wire
    discriminator for :data:`~.facets.result.FacetResponse`. **Its values are serialized**,
    so changing those values is a breaking API change.
    """

    TERM = "term"
    RANGE = "range"


@dataclass(frozen=True, slots=True)
class Filter:
    """An ES filter ``query`` tagged with the scope and ``kind`` it targets.

    ``field`` is the field name, so a facet excludes its own selection when
    aggregating.
    """

    field: str
    kind: FacetKind
    query: Query


def queries(filters: Iterable[Filter]) -> list[Query]:
    return [item.query for item in filters]


def queries_excluding(filters: Iterable[Filter], *, field: str, kind: FacetKind) -> list[Query]:
    """Exclude only the interactive filter matching this field and kind, never permanent restrictions."""
    return [item.query for item in filters if (item.field, item.kind) != (field, kind)]
