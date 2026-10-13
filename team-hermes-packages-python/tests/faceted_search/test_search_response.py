"""Explicit application payloads preserve shared search metadata and validation."""

import base64
import json
from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock

import pytest
from elasticsearch import NotFoundError
from elasticsearch.dsl.response import Hit
from fastapi import FastAPI
from pydantic import BaseModel, ValidationError

from team_hermes.elasticsearch import (
    BACKWARD,
    Cursor,
    Cursors,
    FacetedSearchResponse,
    FacetValueType,
    IntegerSumAggregation,
    SearchDefinition,
    SearchRequest,
    SearchResult,
    SortClause,
    TermFacetResponse,
)
from tests.faceted_search.search_test_helpers import StubSearchClient


class Product(BaseModel):
    name: str


class ProductResponse(FacetedSearchResponse[Product, dict[str, int]]):
    """A concrete application response with its own schema name."""


class ProductMetrics(BaseModel):
    total_price: int | None


class ProductMetricsResponse(FacetedSearchResponse[Product, ProductMetrics]):
    """An application response owning both payload schemas."""


@pytest.fixture
def populated_result() -> SearchResult:
    """A completed page with source fields, metadata and a computed metric."""
    return SearchResult(
        hits=[Hit({"_id": "1", "_index": "products", "_source": {"name": "Core"}})],
        facets=[],
        total=1,
        page=1,
        pages=1,
        cursors=Cursors(next=Cursor(anchor=(1,))),
        _aggregation_values={"price": (IntegerSumAggregation(name="price", field="price"), 42)},
    )


@pytest.mark.parametrize("payloads", [{}, {"items": []}, {"metrics": None}])
def test_response_requires_both_payload_arguments(populated_result: SearchResult, payloads: dict[str, Any]) -> None:
    with pytest.raises(TypeError, match="required keyword-only"):
        ProductResponse.from_result(populated_result, **payloads)


def test_explicit_payloads_do_not_read_hit_sources(populated_result: SearchResult) -> None:
    hit = MagicMock(spec=Hit)
    result = replace(populated_result, hits=[hit])

    response = ProductResponse.from_result(result, items=[Product(name="Mapped")], metrics={"price": 42})

    hit.to_dict.assert_not_called()
    assert response.items == [Product(name="Mapped")]
    assert response.metrics == {"price": 42}
    assert ProductResponse.model_validate_json(response.model_dump_json()) == response


@pytest.mark.parametrize("items", [[], [Product(name="Mapped")]])
def test_explicit_items_replace_sources_including_an_empty_list(
    populated_result: SearchResult, items: list[Product]
) -> None:
    response = ProductResponse.from_result(populated_result, items=items, metrics=None)

    assert response.items == items
    assert response.total == 1


@pytest.mark.parametrize("item", [{}, {"name": 42}])
def test_explicit_item_payloads_are_validated(populated_result: SearchResult, item: Any) -> None:
    with pytest.raises(ValidationError) as error:
        ProductResponse.from_result(populated_result, items=[item], metrics=None)

    assert error.value.errors()[0]["loc"] == ("items", 0, "name")


@pytest.mark.parametrize("response_model", [FacetedSearchResponse[Product, ProductMetrics], ProductMetricsResponse])
@pytest.mark.parametrize("computed", [False, True], ids=["metadata-disabled", "computed"])
def test_explicit_payloads_preserve_metadata_and_round_trip(
    populated_result: SearchResult, response_model: type[FacetedSearchResponse[Any, ProductMetrics]], computed: bool
) -> None:
    result = (
        populated_result if computed else replace(populated_result, total=None, pages=None, _aggregation_values=None)
    )
    metrics = (
        ProductMetrics(total_price=result.aggregation_by(IntegerSumAggregation(name="price", field="price")))
        if computed
        else None
    )

    response = response_model.from_result(result, items=[Product(name="Core")], metrics=metrics)

    if computed:
        assert isinstance(response.metrics, ProductMetrics)
    else:
        assert response.metrics is None
    assert response.model_dump(mode="json")["metrics"] == ({"total_price": 42} if computed else None)
    assert response.model_dump(mode="json")["items"] == [{"name": "Core"}]
    assert (response.facets, response.total, response.page, response.pages) == ([], result.total, 1, result.pages)
    assert response.next_cursor == Cursor(anchor=(1,)).encode()
    assert response.prev_cursor is None
    assert response_model.model_validate_json(response.model_dump_json()) == response


@pytest.mark.parametrize("metrics", [None, {}, {"replacement": 0}])
def test_explicit_metrics_preserve_empty_values_without_changing_extracted_metrics(
    populated_result: SearchResult, metrics: dict[str, int] | None
) -> None:
    response = ProductResponse.from_result(populated_result, items=[], metrics=metrics)

    assert response.metrics == metrics
    assert populated_result.aggregation_by(IntegerSumAggregation(name="price", field="price")) == 42


@pytest.mark.parametrize("metrics", [{"total_price": "invalid"}, {}])
def test_custom_metrics_payload_is_validated(populated_result: SearchResult, metrics: Any) -> None:
    with pytest.raises(ValidationError) as error:
        ProductMetricsResponse.from_result(populated_result, items=[], metrics=metrics)

    assert error.value.errors()[0]["loc"] == ("metrics", "total_price")


def test_openapi_exposes_concrete_custom_payloads_without_default_metric_types(populated_result: SearchResult) -> None:
    app = FastAPI()

    @app.get("/products", response_model=ProductMetricsResponse)
    def products() -> ProductMetricsResponse:
        return ProductMetricsResponse.from_result(populated_result, items=[], metrics=None)

    schemas = app.openapi()["components"]["schemas"]
    response_schema = schemas["ProductMetricsResponse"]["properties"]
    assert response_schema["items"]["items"] == {"$ref": "#/components/schemas/Product"}
    assert response_schema["metrics"]["anyOf"] == [
        {"$ref": "#/components/schemas/ProductMetrics"},
        {"type": "null"},
    ]
    assert schemas["ProductMetrics"]["required"] == ["total_price"]
    assert "SumMetricResponse" not in schemas
    assert "_Unset" not in schemas
    assert response_schema["facets"]["items"] == {"$ref": "#/components/schemas/FacetResponse"}
    assert schemas["FacetResponse"]["discriminator"] == {
        "propertyName": "kind",
        "mapping": {
            "term": "#/components/schemas/TermFacetResponse",
            "range": "#/components/schemas/RangeFacetResponse",
        },
    }
    common_fields = {"key", "kind", "value_type", "source", "count", "aggregated"}
    assert set(schemas["TermFacetResponse"]["properties"]) == common_fields | {"buckets"}
    assert set(schemas["RangeFacetResponse"]["properties"]) == common_fields | {"histogram"}


@pytest.mark.parametrize(("response_model", "metrics"), [(ProductResponse, {}), (ProductMetricsResponse, None)])
def test_missing_index_preserves_empty_payloads_and_metadata(
    response_model: type[FacetedSearchResponse[Product, Any]], metrics: dict[str, int] | None
) -> None:
    client = StubSearchClient(total=0, error=NotFoundError("missing", meta=MagicMock(status=404), body={}))
    result = SearchDefinition().search().using(client).index("products").offset_page(number=4).execute()
    response = response_model.from_result(result, items=[], metrics=metrics)
    assert result.missing_index
    assert isinstance(response, response_model)
    assert response.items == []
    assert response.facets == []
    assert response.metrics == metrics
    assert (response.total, response.page, response.pages) == (0, 4, 0)
    assert response.next_cursor is None
    assert response.prev_cursor is None

    with pytest.raises(LookupError, match="not computed"):
        result.aggregation_by(IntegerSumAggregation(field="price"))


@pytest.mark.parametrize(("total", "pages"), [(None, None), (0, 0), (21, 3)])
@pytest.mark.parametrize("include_facets", [False, True])
def test_from_result_preserves_engine_metadata_and_unrequested_metrics(
    total: int | None, pages: int | None, include_facets: bool
) -> None:
    next_cursor = Cursor(anchor=(2,))
    prev_cursor = Cursor(anchor=(1,), direction=BACKWARD)
    facet = TermFacetResponse(
        key="category", value_type=FacetValueType.STRING, source=None, count=0, aggregated=False, buckets=[]
    )
    result = SearchResult(
        hits=[],
        facets=[facet] if include_facets else [],
        total=total,
        page=2,
        pages=pages,
        cursors=Cursors(next=next_cursor, prev=prev_cursor),
        _aggregation_values={} if total is not None else None,
    )
    response = ProductResponse.from_result(
        result, items=[Product(name="Core")], metrics={} if total is not None else None
    )
    assert isinstance(response, ProductResponse)
    assert response.items == [Product(name="Core")]
    assert response.facets == result.facets
    assert response.metrics == ({} if total is not None else None)
    assert (response.total, response.page, response.pages) == (total, 2, pages)
    assert (response.next_cursor, response.prev_cursor) == (next_cursor.encode(), prev_cursor.encode())
    assert ProductResponse.model_validate_json(response.model_dump_json()) == response


def _expected_cursor_token(anchor: list[int | str], direction: str) -> str:
    """Build wire expectations without calling the production cursor encoder."""
    payload = json.dumps({"a": anchor, "d": direction}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


@pytest.mark.parametrize(
    ("prev_cursor", "prev_token"),
    [(None, None), (Cursor(anchor=(1, "x"), direction=BACKWARD), _expected_cursor_token([1, "x"], "b"))],
)
@pytest.mark.parametrize(
    ("next_cursor", "next_token"),
    [(None, None), (Cursor(anchor=(1, "x")), _expected_cursor_token([1, "x"], "f"))],
)
def test_response_encodes_cursor_values_without_changing_wire_shape(
    prev_cursor: Cursor | None, prev_token: str | None, next_cursor: Cursor | None, next_token: str | None
) -> None:
    links = Cursors(prev=prev_cursor, next=next_cursor)
    result = SearchResult([], [], None, 2, None, links, _aggregation_values=None)

    response = ProductResponse.from_result(result, items=[], metrics=None)

    body = response.model_dump(mode="json")
    assert body["prev_cursor"] == prev_token
    assert body["next_cursor"] == next_token
    assert result.cursors is links
    assert result.cursors.prev is prev_cursor
    assert result.cursors.next is next_cursor
    assert ProductResponse.model_validate_json(response.model_dump_json()) == response


@pytest.mark.parametrize("name", ["prev_cursor", "next_cursor"])
def test_response_cursor_schema_remains_a_nullable_string(name: str) -> None:
    schema = ProductResponse.model_json_schema()
    assert schema["properties"][name]["anyOf"] == [{"type": "string"}, {"type": "null"}]
    assert "Cursor" not in schema.get("$defs", {})


def test_response_cursor_token_can_resume_a_search_request() -> None:
    client = StubSearchClient(total=2, hits=[{"_id": "1", "_source": {}, "sort": [1]}])
    query = (
        SearchDefinition()
        .with_sorting(default=(SortClause(field="id", order="asc"),))
        .search()
        .using(client)
        .index("products")
    )
    first = query.offset_page(size=1).execute()

    response = ProductResponse.from_result(first, items=[], metrics=None)
    assert response.next_cursor is not None
    request = SearchRequest(page=2, per_page=1, cursor=response.next_cursor)
    query.apply_request(request).execute()

    assert first.cursors.next == Cursor(anchor=(1,))
    assert client.calls[1]["search_after"] == [1]
    assert "from" not in client.calls[1]


@pytest.mark.parametrize("replacement", [{"items": [{"name": 42}]}, {"metrics": [1, 2]}])
def test_concrete_response_validates_items_and_metrics_mapping(replacement: dict[str, Any]) -> None:
    body = {
        "items": [{"name": "Core"}],
        "facets": [],
        "metrics": {"total_value": 1},
        "total": 1,
        "page": 1,
        "pages": 1,
    }
    with pytest.raises(ValidationError):
        ProductResponse.model_validate({**body, **replacement})


def test_response_schema_is_independent_of_domain_statistics() -> None:
    result = SearchDefinition().search().using(StubSearchClient(total=0)).index("products").execute()
    response = FacetedSearchResponse[str, dict[str, int]].from_result(result, items=[], metrics={})
    assert response.metrics == {}
    assert "SearchStats" not in str(response.model_json_schema())


@pytest.mark.parametrize(
    "metric",
    [
        {"value": 12},
        1.5,
        float("inf"),
        "invalid",
    ],
)
def test_response_rejects_invalid_metric_payloads(metric: object) -> None:
    body = ProductResponse.from_result(
        SearchResult([], [], 0, 1, 0, Cursors(None, None)), items=[], metrics={}
    ).model_dump()
    body["metrics"] = {"test": metric}

    with pytest.raises(ValidationError):
        ProductResponse.model_validate(body)


@pytest.mark.parametrize("total", [None, 0])
@pytest.mark.parametrize("computed", [False, True])
@pytest.mark.parametrize("value", [None, 0])
def test_metric_state_is_explicit_and_independent_of_total(
    total: int | None, computed: bool, value: int | None
) -> None:
    metric = IntegerSumAggregation(name="sum", field="value")
    result = SearchResult(
        [],
        [],
        total,
        1,
        None if total is None else 0,
        Cursors(None, None),
        _aggregation_values={"sum": (metric, value)} if computed else None,
    )
    if computed:
        assert result.aggregation_by(metric) == value
    else:
        with pytest.raises(LookupError, match="not computed"):
            result.aggregation_by(metric)
