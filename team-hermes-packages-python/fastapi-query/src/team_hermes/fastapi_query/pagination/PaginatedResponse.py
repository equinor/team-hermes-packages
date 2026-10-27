from typing import Annotated

from pydantic import BaseModel, Field


class PageParams(BaseModel):
    page: Annotated[int, Field(ge=1, description="Page number to be returned", default=1)]
    per_page: Annotated[int, Field(ge=1, le=10000, description="Number of items to be returned per page", default=100)]


class PaginatedResponse[ResponseModel: BaseModel](BaseModel):
    count: int = Field(description="Total number of items")
    items: list[ResponseModel] = Field(description="List of items returned in the response following given criteria")
    pages: int = Field(description="Total number of pages available based on the given criteria")
