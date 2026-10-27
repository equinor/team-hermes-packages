from pydantic import BaseModel


class FacetCountsResponse(BaseModel):
    facets: dict[str, dict[str, int]]
