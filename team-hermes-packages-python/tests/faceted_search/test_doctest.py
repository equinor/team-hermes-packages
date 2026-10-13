"""Execute public search examples without an Elasticsearch service."""

import doctest

from elasticsearch.dsl import Q

from team_hermes import elasticsearch as faceted_search
from team_hermes.elasticsearch import search as search_module
from tests.faceted_search.search_test_helpers import StubSearchClient


def test_search_module_doctests() -> None:
    """Keep search configuration examples executable."""
    result = doctest.testmod(search_module)

    assert result.failed == 0
    assert result.attempted > 0


def test_quick_start_doctest() -> None:
    """Keep the documented query and typed result extraction executable."""
    client = StubSearchClient(
        total=5,
        aggregations={
            "country": {
                "doc_count": 8,
                "country": {"buckets": [{"key": "NO", "doc_count": 5}, {"key": "SE", "doc_count": 3}]},
            },
            "search_stats": {"doc_count": 5, "card_site.keyword": {"value": 2}},
        },
    )

    result = doctest.testmod(
        faceted_search,
        extraglobs={"es_client": client, "index_name": "items", "base_query": Q("match_all")},
    )

    assert result.failed == 0
    assert result.attempted > 0
    assert client.indices == ["items"]
    body = client.calls[0]
    assert body["post_filter"] == {"bool": {"filter": [{"terms": {"country": ["NO"]}}]}}
    assert body["aggs"]["country"]["filter"] == {"match_all": {}}
    assert body["aggs"]["search_stats"]["filter"] == body["post_filter"]
