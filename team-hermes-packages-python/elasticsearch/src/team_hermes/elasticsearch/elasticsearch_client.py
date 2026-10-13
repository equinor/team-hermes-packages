from typing import Any

from elasticsearch import Elasticsearch, NotFoundError
from elasticsearch.dsl import Index, Search
from elasticsearch.dsl.response import Response
from elasticsearch.helpers import bulk

from .elasticsearch_client_interface import BulkIndexResult, ElasticsearchClientInterface

_FORCE_MERGE_TIMEOUT_SECONDS = 3600
_CREATE_INDEX_TIMEOUT_SECONDS = 60


class ElasticsearchClient(ElasticsearchClientInterface):
    def __init__(self, url: str, api_key: str | None = None, index_prefix: str = "") -> None:
        self._client = Elasticsearch(
            hosts=[url],
            api_key=api_key,
        )
        self.index_prefix = index_prefix

    def create_index(self, index_name: str, index: Index) -> None:
        self._client.options(request_timeout=_CREATE_INDEX_TIMEOUT_SECONDS).indices.create(
            index=index_name, **index.to_dict()
        )

    def delete_index(self, index_name: str) -> None:
        self._client.indices.delete(index=index_name, ignore_unavailable=True)

    def index_exists(self, index_name: str) -> bool:
        return bool(self._client.indices.exists(index=index_name))

    def bulk_index(
        self,
        index_name: str,
        documents: list[dict[str, Any]],
        id_field: str = "id",
    ) -> BulkIndexResult:
        if not documents:
            return BulkIndexResult(has_errors=False, error_count=0)
        actions = ({"_index": index_name, "_id": doc.get(id_field), "_source": doc} for doc in documents)
        _, errors = bulk(self._client, actions, raise_on_error=False, refresh=False, stats_only=True)
        error_count = errors if isinstance(errors, int) else len(errors)
        return BulkIndexResult(has_errors=error_count > 0, error_count=error_count)

    def force_merge(self, index_name: str, *, max_num_segments: int = 1) -> None:
        self._client.options(request_timeout=_FORCE_MERGE_TIMEOUT_SECONDS).indices.forcemerge(
            index=index_name, max_num_segments=max_num_segments
        )

    def execute(self, search: Search, *, index_name: str) -> Response:
        return search.using(self._client).index(index_name).execute()

    def swap_alias_and_delete_old(self, alias_name: str, new_index_name: str) -> list[str]:
        old_indices = self._resolve_alias_indices(alias_name)
        actions: list[dict[str, dict[str, str]]] = [{"add": {"index": new_index_name, "alias": alias_name}}]
        actions.extend({"remove_index": {"index": old_index}} for old_index in old_indices)
        self._client.indices.update_aliases(actions=actions)
        return old_indices

    def _resolve_alias_indices(self, alias_name: str) -> list[str]:
        """Return the concrete index names currently behind the alias."""
        try:
            response = self._client.indices.get_alias(name=alias_name)
            return list(response.body)
        except NotFoundError:
            return []
