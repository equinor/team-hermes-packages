"""Execute public search examples without an Elasticsearch service."""

import doctest
import json
import re
import runpy
from pathlib import Path

import pytest
from elasticsearch.dsl import Q
from pytest_mock import MockerFixture

from team_hermes import elasticsearch as faceted_search
from team_hermes.elasticsearch import search as search_module
from tests.search_test_helpers import StubSearchClient


@pytest.mark.parametrize("include_recipes", [False, True], ids=["quick-start", "all-examples"])
@pytest.mark.parametrize("total", [2, 21], ids=["single-page", "next-page"])
def test_readme_quick_start(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mocker: MockerFixture,
    capsys: pytest.CaptureFixture[str],
    include_recipes: bool,
    total: int,
) -> None:
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text()
    examples = re.findall(r"```python\n(.*?)\n```", readme, re.DOTALL)
    assert examples
    assert "SearchDefinition.from_document(" in examples[0]
    assert "SearchDefinition.from_mapping(" not in examples[0]
    assert "SearchRequest.model_validate(" in examples[0]
    assert ".apply_request(request)" in examples[0]
    json_examples = re.findall(r"```json\n(.*?)\n```", readme, re.DOTALL)
    assert len(json_examples) == 2
    documented_request, documented_response = [json.loads(example) for example in json_examples]
    client = StubSearchClient(
        total=total,
        aggregations={
            "product_scope": {"doc_count": total, "card_brand": {"value": 1}},
            "brand": {"doc_count": total, "brand": {"buckets": [{"key": "Acme", "doc_count": total}]}},
            "hist_price": {
                "hist_price": {
                    "buckets": (
                        [{"key": 20, "doc_count": 1}, {"key": 30, "doc_count": 1}]
                        if total == 2
                        else [
                            {"key": 20, "doc_count": 1},
                            {"key": 30, "doc_count": 10},
                            {"key": 40, "doc_count": 10},
                        ]
                    )
                },
                "hist_price_stats": {
                    "min": 20,
                    "max": 35 if total == 2 else 44.5,
                    "avg": 27.5 if total == 2 else 815 / 21,
                    "count": total,
                },
            },
            "facet_counts": {"by_field": {"buckets": {"brand": {"doc_count": total}, "price": {"doc_count": total}}}},
        },
        hits=[
            {"_source": {"product_id": "p-1", "brand": "Acme", "price": 20.0}, "sort": [20.0, "p-1"]},
            {"_source": {"product_id": "p-2", "brand": "Acme", "price": 35.0}, "sort": [35.0, "p-2"]},
        ],
    )
    if total > 20:
        client.hits.extend(
            {
                "_source": {"product_id": f"p-{number}", "brand": "Acme", "price": 35.0 + (number - 2) / 2},
                "sort": [35.0 + (number - 2) / 2, f"p-{number}"],
            }
            for number in range(3, 21)
        )
    constructor = mocker.patch("team_hermes.elasticsearch.ElasticsearchClient", return_value=client)
    monkeypatch.setenv("ELASTICSEARCH_URL", "https://elasticsearch.example.test")
    monkeypatch.setenv("ELASTICSEARCH_API_KEY", "example-key")
    script = tmp_path / "quick_start.py"
    script.write_text("\n\n".join(examples if include_recipes else examples[:1]))

    namespace = runpy.run_path(str(script))

    assert namespace["incoming_payload"] == documented_request
    constructor.assert_called_once_with(url="https://elasticsearch.example.test", api_key="example-key")
    assert client.indices == ["products"]
    body = client.calls[0]
    assert body["query"]["bool"]["filter"] == [{"term": {"created_by_id": "user-1"}}]
    assert body["post_filter"]["bool"]["filter"] == [
        {"range": {"price": {"gte": 10, "lte": 50}}},
        {"terms": {"brand": ["Acme"]}},
    ]
    assert set(body["aggs"]) == {"brand", "hist_price", "facet_counts", "product_scope"}
    assert body["aggs"]["product_scope"]["filter"] == {"bool": {"filter": body["post_filter"]["bool"]["filter"]}}
    assert body["sort"] == [
        {"price": {"order": "asc", "missing": "_last"}},
        {"product_id": {"order": "asc"}},
    ]
    assert body["size"] == 20
    payload = json.loads(capsys.readouterr().out)
    assert payload == namespace["response"].model_dump(mode="json")
    if total == 2:
        assert payload == documented_response
    assert payload["items"] == [
        {"id": hit["_source"]["product_id"], "label": hit["_source"]["brand"], "price": hit["_source"]["price"]}
        for hit in client.hits
    ]
    assert payload["metrics"] == {"matching_documents": total, "distinct_brands": 1}
    assert payload["total"] == total
    assert payload["page"] == 1
    assert {facet["key"] for facet in payload["facets"]} == {"brand", "price"}
    assert bool(payload["next_cursor"]) is (total > 20)
    if total > 20:
        next_request = faceted_search.SearchRequest.model_validate(
            {**namespace["request"].model_dump(mode="json"), "cursor": payload["next_cursor"], "page": 2}
        )
        next_result = namespace["query"].apply_request(next_request).execute()
        assert next_result.page == 2
        assert client.indices == ["products", "products"]
        next_body = client.calls[1]
        assert next_body["search_after"] == [44.0, "p-20"]
        for key in ("query", "post_filter", "sort", "aggs", "size"):
            assert next_body[key] == body[key]

    if include_recipes:
        assert namespace["PRODUCTS"] == namespace["PRODUCTS_FROM_MAPPING"]


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
