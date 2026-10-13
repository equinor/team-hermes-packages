"""Search client contract shared by production and stub test clients."""

from typing import Protocol

from elasticsearch.dsl import Search
from elasticsearch.dsl.response import Response


class ESClient(Protocol):
    """Minimal Elasticsearch I/O contract: a DSL search in, a response out."""

    def execute(self, search: Search, *, index_name: str) -> Response: ...
