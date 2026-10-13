"""Deterministic Elasticsearch I/O for shared search contract tests."""

from dataclasses import dataclass, field
from typing import Any

from elasticsearch.dsl import Search
from elasticsearch.dsl.response import Response

from team_hermes.elasticsearch.client import ESClient


@dataclass
class StubSearchClient(ESClient):
    """Inject canned responses through ``SearchQuery.using()`` without network I/O.

    Tests supply the total, aggregations, and hits for the current response page.
    Only ``size`` and ``track_total_hits`` affect the response; queries, filters,
    sorting, offsets, and cursors are recorded but not evaluated. Aggregations
    and totals are not calculated from hits. Real DSL response parsing is retained.
    """

    total: int
    aggregations: dict[str, Any] = field(default_factory=dict)
    hits: list[dict[str, Any]] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)
    indices: list[str] = field(default_factory=list)
    error: Exception | None = None

    def execute(self, search: Search, *, index_name: str) -> Response:
        """Record the request, then raise the configured error or return the canned response."""
        body = search.to_dict()
        self.calls.append(body)
        self.indices.append(index_name)
        if self.error is not None:
            raise self.error
        hits: dict[str, Any] = {"hits": self.hits[: body.get("size", 0)]}
        if body.get("track_total_hits", True):
            hits["total"] = {"value": self.total, "relation": "eq"}
        return Response(search, {"hits": hits, "aggregations": self.aggregations})
