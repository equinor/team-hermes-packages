"""Isolation and dependency injection contracts for the reusable offline client fixture."""

from team_hermes.elasticsearch import SearchDefinition
from tests.search_test_helpers import StubSearchClient


def test_factory_clients_do_not_share_response_data_or_request_history(
    search_client_factory: type[StubSearchClient],
) -> None:
    first = search_client_factory(total=1)
    second = search_client_factory(total=0)
    first.hits.append({"_id": "one", "_source": {}})
    first.aggregations["scope"] = {"doc_count": 1}

    SearchDefinition().search().using(first).index("items").execute()

    assert second.hits == []
    assert second.aggregations == {}
    assert second.calls == []
    assert second.indices == []
    assert first.indices == ["items"]


def test_replacing_client_keeps_original_query_and_responses_independent(
    search_client_factory: type[StubSearchClient],
    definition: SearchDefinition,
) -> None:
    first = search_client_factory(total=1)
    second = search_client_factory(total=2)
    original = definition.search().using(first).index("items")
    changed = original.using(second)

    changed_result = changed.execute()
    original_result = original.execute()

    assert changed_result.total == 2
    assert original_result.total == 1
    assert first.indices == second.indices == ["items"]
    assert first.calls == second.calls
    assert first.calls is not second.calls
