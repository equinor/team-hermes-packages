from collections.abc import Callable
from typing import Any

import pytest
from pydantic import BaseModel, ConfigDict, ValidationError
from team_hermes.query import FilterBy, FilterExpression, OrderBy, SortDirection

from team_hermes.fastapi_query import PageParams, PaginatedResponse, paginate


class Item(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str


class InMemoryRepository[Entity]:
    def __init__(self, items: list[Entity]) -> None:
        self.items = items
        self.count_calls: list[FilterBy | None] = []
        self.list_calls: list[dict[str, Any]] = []

    def count(self, filters: FilterBy | None) -> int:
        self.count_calls.append(filters)
        return len(self.items)

    def list(
        self,
        orderby: list[OrderBy] | None = None,
        filters: FilterBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
        fetch_relationships: Callable[[type[Entity]], list[Any]] | None = None,
    ) -> list[Entity]:
        self.list_calls.append(
            {
                "filters": filters,
                "orderby": orderby,
                "limit": limit,
                "offset": offset,
                "fetch_relationships": fetch_relationships,
            }
        )
        start = offset or 0
        return self.items[start : None if limit is None else start + limit]


def test_pagination_forwards_query_and_relationships():
    repository = InMemoryRepository[Item | dict[str, str]](
        [Item(name="skip"), Item(name="skip"), {"name": "first"}, Item(name="second"), Item(name="last")]
    )
    filters = FilterExpression(key="active", operator="eq", value=True)
    orderby = [OrderBy(key="name", direction=SortDirection.asc)]

    def relationships(entity_type: type[Item | dict[str, str]]) -> list[Any]:
        return []

    result = paginate(repository, filters, orderby, PageParams(page=2, per_page=2), Item, relationships)
    assert repository.count_calls == [filters]
    assert repository.list_calls == [
        {"filters": filters, "orderby": orderby, "limit": 2, "offset": 2, "fetch_relationships": relationships}
    ]
    assert isinstance(result, PaginatedResponse)
    assert all(isinstance(item, Item) for item in result.items)
    assert result.model_dump() == {"count": 5, "pages": 3, "items": [{"name": "first"}, {"name": "second"}]}


@pytest.mark.parametrize("count,pages", [(0, 0), (1, 1), (10, 2), (11, 3)])
def test_page_count_and_empty_results(count, pages):
    repository = InMemoryRepository([Item(name=str(index)) for index in range(count)])
    result = paginate(repository, None, None, PageParams(page=99, per_page=5), Item)
    assert result.count == count
    assert result.pages == pages
    assert result.items == []
    assert repository.list_calls[0]["offset"] == 490


def test_pagination_validates_repository_items():
    repository = InMemoryRepository([{"unexpected": "value"}])
    with pytest.raises(ValidationError):
        paginate(repository, None, None, PageParams(page=1, per_page=100), Item)


def test_pagination_propagates_repository_errors():
    class FailingRepository(InMemoryRepository[Item]):
        def count(self, filters: FilterBy | None) -> int:
            raise RuntimeError("count failed")

    repository = FailingRepository([])
    with pytest.raises(RuntimeError, match="count failed"):
        paginate(repository, None, None, PageParams(page=1, per_page=100), Item)
    assert repository.list_calls == []
