import math
from collections.abc import Callable, Iterable
from typing import Any, Protocol

from pydantic import BaseModel

from team_hermes.query import FilterBy, OrderBy

from .PaginatedResponse import PageParams, PaginatedResponse


class PaginationRepository[Entity](Protocol):
    def count(self, filters: FilterBy | None) -> int: ...

    def list(
        self,
        orderby: list[OrderBy] | None = None,
        filters: FilterBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
        fetch_relationships: Callable[[type[Entity]], list[Any]] | None = None,
    ) -> Iterable[Entity]: ...


def paginate[ResponseModel: BaseModel, Entity](
    repository: PaginationRepository[Entity],
    filters: FilterBy | None,
    orderby: list[OrderBy] | None,
    page_params: PageParams,
    response_model: type[ResponseModel],
    fetch_relationships: Callable[[type[Entity]], list[Any]] | None = None,
) -> PaginatedResponse[ResponseModel]:
    count = repository.count(filters)
    entity_list = repository.list(
        filters=filters,
        limit=page_params.per_page,
        offset=(page_params.page - 1) * page_params.per_page,
        orderby=orderby,
        fetch_relationships=fetch_relationships,
    )
    items: list[ResponseModel] = [response_model.model_validate(item) for item in entity_list]
    return PaginatedResponse(pages=math.ceil(count / page_params.per_page), items=items, count=count)
