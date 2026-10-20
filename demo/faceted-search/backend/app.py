import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from elastic_transport import TransportError
from elasticsearch import ApiError, Elasticsearch
from elasticsearch.dsl import Q
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from team_hermes.elasticsearch import (
    ElasticsearchClient,
    FacetBoundsPrefetchError,
    FacetedSearchResponse,
    FacetResponse,
    InvalidCursorError,
    InvalidRangeFilterError,
    InvalidSearchRequestError,
    ResultWindowError,
    SearchRequest,
    SearchResult,
    UnknownFacetError,
)

from seed import DEFINITION, DOCUMENTS, MAPPING

logger = logging.getLogger(__name__)
ES_URL = "http://127.0.0.1:19200"
INDEX = f"hermes-faceted-demo-{uuid4().hex}"
client = ElasticsearchClient(url=ES_URL)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    with Elasticsearch(ES_URL) as admin:
        admin.indices.create(
            index=INDEX,
            mappings=MAPPING.to_dict(),
            settings={"number_of_shards": 1, "number_of_replicas": 0},
        )
        try:
            outcome = client.bulk_index(INDEX, DOCUMENTS)
            if outcome.has_errors:
                raise RuntimeError(f"Seeding failed: {outcome.error_count} indexing errors")
            admin.indices.refresh(index=INDEX)
            yield
        finally:
            admin.indices.delete(index=INDEX)


app = FastAPI(title="Hermes faceted search demo", lifespan=lifespan)


async def invalid_request(request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(error)})


async def unavailable(request: Request, error: Exception) -> JSONResponse:
    logger.error("Elasticsearch request failed", exc_info=error)
    return JSONResponse(status_code=503, content={"detail": "Elasticsearch is unavailable; check the API logs."})


for error_type in (
    InvalidCursorError,
    InvalidRangeFilterError,
    InvalidSearchRequestError,
    ResultWindowError,
    UnknownFacetError,
):
    app.add_exception_handler(error_type, invalid_request)
for error_type in (ApiError, TransportError, FacetBoundsPrefetchError):
    app.add_exception_handler(error_type, unavailable)


class Well(BaseModel):
    id: str
    country: str
    field: str
    total_depth: float
    spud_date: str


def require_index(result: SearchResult) -> SearchResult:
    if result.missing_index:
        raise HTTPException(503, "The demo index is missing; restart the API to reseed it.")
    return result


@app.get("/api/health")
def health() -> dict[str, str]:
    if not client.index_exists(INDEX):
        raise HTTPException(503, "The demo index is missing.")
    return {"status": "ready"}


@app.post("/api/wells/search")
def search_wells(request: SearchRequest) -> FacetedSearchResponse[Well, None]:
    query = DEFINITION.search().using(client).index(INDEX).apply_request(request)
    if request.q:
        query = query.query(Q("multi_match", query=request.q, fields=["id", "country", "field"]))
    result = require_index(query.execute())
    return FacetedSearchResponse[Well, None].from_result(
        result,
        items=[Well.model_validate(hit.to_dict()) for hit in result.hits],
        metrics=None,
    )


@app.get("/api/wells/facets")
def facet_catalog() -> list[FacetResponse]:
    result = require_index(
        DEFINITION.search()
        .using(client)
        .index(INDEX)
        .discover_facets("attributes")
        .with_facet_counts()
        .offset_page(size=0)
        .execute()
    )
    return result.facets
