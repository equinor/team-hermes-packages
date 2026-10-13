from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from elasticsearch.dsl import Index, Search
from elasticsearch.dsl.response import Response


@dataclass(frozen=True)
class BulkIndexResult:
    has_errors: bool
    error_count: int


class ElasticsearchClientInterface(ABC):
    index_prefix: str = ""
    """Prefix applications use to derive concrete index and alias names."""

    @abstractmethod
    def create_index(self, index_name: str, index: Index) -> None: ...

    @abstractmethod
    def delete_index(self, index_name: str) -> None: ...

    @abstractmethod
    def index_exists(self, index_name: str) -> bool: ...

    @abstractmethod
    def bulk_index(
        self,
        index_name: str,
        documents: list[dict[str, Any]],
        id_field: str = "id",
    ) -> BulkIndexResult: ...

    @abstractmethod
    def force_merge(self, index_name: str, *, max_num_segments: int = 1) -> None:
        """Merge an index after bulk indexing has completed.

        Intended for write-once/read-many indices built then alias-swapped.
        """
        ...

    @abstractmethod
    def execute(self, search: Search, *, index_name: str) -> Response:
        """Execute a DSL Search and return a typed Response.

        The explicit index name avoids relying on Search._index.
        """
        ...

    @abstractmethod
    def swap_alias_and_delete_old(self, alias_name: str, new_index_name: str) -> list[str]:
        """Point an alias at a new index and delete the previously aliased indices.

        Uses one _aliases request with add and remove_index actions. The target
        must not already be among the indices currently behind the alias.
        Returns the names of the removed indices, or an empty list for a new alias.
        """
        ...
