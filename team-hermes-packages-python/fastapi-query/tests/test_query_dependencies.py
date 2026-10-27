import asyncio
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from team_hermes.core import ValidationException
from team_hermes.query import FilterBy, OrderBy, Select, SortDirection

from team_hermes.fastapi_query import PageParams, create_order_by_options, parse_filter, parse_select


def make_app():
    app = FastAPI()

    @app.get("/items")
    def items(
        filters: Annotated[FilterBy | None, Depends(parse_filter(["name", "age"]))],
        select: Annotated[Select | None, Depends(parse_select())],
        orderby: Annotated[list[OrderBy], Depends(create_order_by_options(["name", "age"]))],
        page_params: Annotated[PageParams, Depends(PageParams)],
    ):
        return {"filters": filters, "select": select, "orderby": orderby, "page": page_params}

    return app


def test_query_defaults():
    with TestClient(make_app()) as client:
        response = client.get("/items")
    assert response.status_code == 200
    assert response.json() == {
        "filters": None,
        "select": None,
        "orderby": [],
        "page": {"page": 1, "per_page": 100},
    }


def test_query_parsing_through_fastapi():
    with TestClient(make_app()) as client:
        response = client.get(
            "/items",
            params={
                "filters": "age gt 30",
                "$select": "name, age",
                "orderby": "name asc, age",
                "page": 2,
                "per_page": 5,
            },
        )
    assert response.status_code == 200
    assert response.json() == {
        "filters": {"key": "age", "expression": {"operator": "gt", "value": 30}},
        "select": {"fields": ["name", "age"]},
        "orderby": [{"key": "name", "direction": "asc"}, {"key": "age", "direction": "desc"}],
        "page": {"page": 2, "per_page": 5},
    }


@pytest.mark.parametrize("parameter,value", [("page", 0), ("per_page", 0), ("per_page", 10001), ("page", "bad")])
def test_invalid_page_query(parameter, value):
    with TestClient(make_app()) as client:
        response = client.get("/items", params={parameter: value})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["query", parameter]


def test_openapi_parameter_names_and_limits():
    parameters = {item["name"]: item for item in make_app().openapi()["paths"]["/items"]["get"]["parameters"]}
    assert set(parameters) == {"filters", "$select", "orderby", "page", "per_page"}
    assert all(item["in"] == "query" and not item["required"] for item in parameters.values())
    assert parameters["per_page"]["schema"]["maximum"] == 10000
    assert parameters["page"]["schema"]["minimum"] == 1


@pytest.mark.parametrize("parameter", ["filters", "orderby"])
def test_field_validation_remains_an_application_exception(parameter):
    with TestClient(make_app()) as client, pytest.raises(ValidationException):
        client.get("/items", params={parameter: "unknown eq 1" if parameter == "filters" else "unknown"})


def test_select_preserves_order_duplicates_and_empty_fields():
    assert parse_select()(" name,age,name ") == Select(fields=["name", "age", "name"])
    assert parse_select()("") == Select(fields=[""])


def test_select_preserves_existing_valid_options_check():
    parser = parse_select(["name", "age"])
    with pytest.raises(ValidationException, match="age"):
        parser("name")
    assert parser("name,age,extra") == Select(fields=["name", "age", "extra"])


def test_ordering_defaults_and_validation():
    parser = create_order_by_options(["name", "age"])
    assert asyncio.run(parser("")) == []
    assert asyncio.run(parser("name")) == [OrderBy(key="name", direction=SortDirection.desc)]
    with pytest.raises(ValueError):
        asyncio.run(parser("name invalid"))
    with pytest.raises(ValidationException, match="unknown"):
        asyncio.run(parser("unknown asc"))
