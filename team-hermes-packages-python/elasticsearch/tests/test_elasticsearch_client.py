from unittest.mock import MagicMock

import pytest
from elasticsearch import NotFoundError
from elasticsearch.dsl import Index, Search
from elasticsearch.dsl.response import Response
from pytest_mock import MockerFixture

from team_hermes.elasticsearch import (
    BulkIndexResult,
    ElasticsearchClient,
    ElasticsearchClientInterface,
    ESClient,
    SearchDefinition,
)


@pytest.fixture
def client_and_transport(mocker: MockerFixture) -> tuple[ElasticsearchClient, MagicMock]:
    constructor = mocker.patch("team_hermes.elasticsearch.elasticsearch_client.Elasticsearch")
    transport = constructor.return_value
    transport.search.return_value.body = {"hits": {"total": {"value": 0}, "hits": []}}
    return ElasticsearchClient(url="http://example.invalid:9200"), transport


def test_constructor_preserves_connection_settings_and_prefix(mocker: MockerFixture) -> None:
    constructor = mocker.patch("team_hermes.elasticsearch.elasticsearch_client.Elasticsearch")

    client = ElasticsearchClient("http://example.invalid:9200", api_key="test-key", index_prefix="products")

    constructor.assert_called_once_with(hosts=["http://example.invalid:9200"], api_key="test-key")
    assert isinstance(client, ElasticsearchClientInterface)
    assert client.index_prefix == "products"


def test_search_query_accepts_concrete_client(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport

    result = SearchDefinition().search().using(client).index("products").execute()

    assert result.total == 0
    assert result.hits == []
    transport.search.assert_called_once()
    assert set(transport.search.call_args.kwargs["index"]) == {"products"}


@pytest.mark.parametrize(
    "bound_index, expected_indices", [(None, ["products"]), ("existing", ["existing", "products"])]
)
def test_execute_passes_body_and_explicit_index(
    client_and_transport: tuple[ElasticsearchClient, MagicMock],
    bound_index: str | None,
    expected_indices: list[str],
) -> None:
    client, transport = client_and_transport
    search = Search(index=bound_index).query("match_all").extra(size=10)
    search_client: ESClient = client

    search_client.execute(search, index_name="products")

    transport.search.assert_called_once_with(index=expected_indices, body=search.to_dict())


def test_execute_returns_typed_response(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport
    transport.search.return_value.body = {"hits": {"total": {"value": 7}, "hits": [{"_id": "one", "_source": {}}]}}

    result = client.execute(Search(), index_name="products")

    assert isinstance(result, Response)
    assert result.to_dict()["hits"]["total"]["value"] == 7
    assert next(iter(result)).meta.id == "one"


def test_create_index_passes_mapping_and_timeout(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport
    index = Index("unused").settings(number_of_shards=1)

    client.create_index("products", index)

    transport.options.assert_called_once_with(request_timeout=60)
    transport.options.return_value.indices.create.assert_called_once_with(index="products", **index.to_dict())


def test_delete_index_ignores_missing_indices(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport

    client.delete_index("products")

    transport.indices.delete.assert_called_once_with(index="products", ignore_unavailable=True)


@pytest.mark.parametrize("exists", [True, False])
def test_index_exists_returns_boolean(
    client_and_transport: tuple[ElasticsearchClient, MagicMock], exists: bool
) -> None:
    client, transport = client_and_transport
    transport.indices.exists.return_value = exists

    assert client.index_exists("products") is exists
    transport.indices.exists.assert_called_once_with(index="products")


def test_bulk_index_empty_input_skips_transport(
    client_and_transport: tuple[ElasticsearchClient, MagicMock], mocker: MockerFixture
) -> None:
    client, transport = client_and_transport
    bulk_mock = mocker.patch("team_hermes.elasticsearch.elasticsearch_client.bulk")

    assert client.bulk_index("products", []) == BulkIndexResult(has_errors=False, error_count=0)
    bulk_mock.assert_not_called()
    transport.assert_not_called()
    assert transport.mock_calls == []


@pytest.mark.parametrize("errors, expected_count", [(0, 0), (2, 2), ([], 0), ([{"index": {"status": 400}}], 1)])
@pytest.mark.parametrize("id_field", ["id", "product_id"])
def test_bulk_index_actions_options_and_errors(
    client_and_transport: tuple[ElasticsearchClient, MagicMock],
    mocker: MockerFixture,
    errors: int | list[dict[str, object]],
    expected_count: int,
    id_field: str,
) -> None:
    client, transport = client_and_transport
    bulk_mock = mocker.patch("team_hermes.elasticsearch.elasticsearch_client.bulk", return_value=(1, errors))
    documents = [{id_field: "p-1", "brand": "Acme"}, {"brand": "Other"}]

    result = client.bulk_index("products", documents, id_field=id_field)

    assert result == BulkIndexResult(has_errors=expected_count > 0, error_count=expected_count)
    assert bulk_mock.call_args.args[0] is transport
    assert list(bulk_mock.call_args.args[1]) == [
        {"_index": "products", "_id": "p-1", "_source": documents[0]},
        {"_index": "products", "_id": None, "_source": documents[1]},
    ]
    assert bulk_mock.call_args.kwargs == {"raise_on_error": False, "refresh": False, "stats_only": True}


@pytest.mark.parametrize("segments", [None, 3])
def test_force_merge_passes_timeout_and_segments(
    client_and_transport: tuple[ElasticsearchClient, MagicMock], segments: int | None
) -> None:
    client, transport = client_and_transport

    if segments is None:
        client.force_merge("products")
    else:
        client.force_merge("products", max_num_segments=segments)

    transport.options.assert_called_once_with(request_timeout=3600)
    transport.options.return_value.indices.forcemerge.assert_called_once_with(
        index="products", max_num_segments=1 if segments is None else segments
    )


def test_alias_swap_adds_target_and_removes_old_indices_in_one_request(
    client_and_transport: tuple[ElasticsearchClient, MagicMock],
) -> None:
    client, transport = client_and_transport
    transport.indices.get_alias.return_value.body = {"products-old-1": {}, "products-old-2": {}}

    assert client.swap_alias_and_delete_old("products", "products-new") == ["products-old-1", "products-old-2"]

    transport.indices.get_alias.assert_called_once_with(name="products")
    transport.indices.update_aliases.assert_called_once_with(
        actions=[
            {"add": {"index": "products-new", "alias": "products"}},
            {"remove_index": {"index": "products-old-1"}},
            {"remove_index": {"index": "products-old-2"}},
        ]
    )
    transport.indices.delete.assert_not_called()


def test_alias_swap_creates_missing_alias(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport
    transport.indices.get_alias.side_effect = NotFoundError("missing", MagicMock(status=404), {})

    assert client.swap_alias_and_delete_old("products", "products-new") == []

    transport.indices.update_aliases.assert_called_once_with(
        actions=[{"add": {"index": "products-new", "alias": "products"}}]
    )


def test_alias_lookup_failures_propagate(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport
    transport.indices.get_alias.side_effect = RuntimeError("connection failed")

    with pytest.raises(RuntimeError, match="connection failed"):
        client.swap_alias_and_delete_old("products", "products-new")

    transport.indices.update_aliases.assert_not_called()


def test_alias_update_failures_propagate(client_and_transport: tuple[ElasticsearchClient, MagicMock]) -> None:
    client, transport = client_and_transport
    transport.indices.get_alias.return_value.body = {"products-old": {}}
    transport.indices.update_aliases.side_effect = RuntimeError("update failed")

    with pytest.raises(RuntimeError, match="update failed"):
        client.swap_alias_and_delete_old("products", "products-new")

    transport.indices.delete.assert_not_called()
