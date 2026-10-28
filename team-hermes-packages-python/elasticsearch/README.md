# 🔍 Team Hermes Elasticsearch

Typed Elasticsearch searches with filters, pagination, and aggregations.

**Requires:** Python 3.12+ and Git for installation from source.
Uses the Elasticsearch 8.x Python client (`>=8.18,<9`).

**Contents**

- [Installation](#️-installation)
- [Usage](#-usage)
- [Example](#example)
- [Configure](#configure)
- [Development](#️-development)

## ⬇️ Installation

Install into a virtual environment with pip:

```shell
python -m pip install \
  "team-hermes-elasticsearch @ git+https://github.com/equinor/team-hermes-packages.git@main#subdirectory=team-hermes-packages-python/elasticsearch"
```

Replace `main` with a release tag or full commit SHA for reproducible installs.

## 🚀 Usage

| Type                    | Role                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `SearchDefinition`      | Reusable facet, sorting, and pagination configuration.                 |
| `SearchRequest`         | Validated frontend filters, sorting, and pagination input.             |
| `SearchQuery`           | Per-request configuration and synchronous execution.                   |
| `SearchResult`          | Hits, facets, computed aggregations, and pagination metadata.          |
| `FacetedSearchResponse` | Application-defined items and metrics with JSON-ready search metadata. |
| `ElasticsearchClient`   | Elasticsearch connection, search execution, and index operations.      |

### Example

Requires a `products` index with keyword fields `product_id`, `created_by_id`, `brand`, and numeric `price`.
Set `ELASTICSEARCH_URL` and optionally `ELASTICSEARCH_API_KEY`.

Validates input and returns items, metrics, facets, and pagination as JSON.

Frontend request body:

```json
{
  "terms": { "brand": ["Acme"] },
  "ranges": { "price": { "min": 10, "max": 50 } },
  "aggregate_facets": ["brand", "price"],
  "include_metadata": true,
  "include_facet_counts": true,
  "sort_by": "price",
  "sort_order": "asc",
  "page": 1,
  "per_page": 20,
  "cursor": null
}
```

The backend validates the decoded body and executes the search. User identity comes from
authentication, not this payload.

```python
import os

from elasticsearch.dsl import Q, Document, Float, Keyword
from pydantic import BaseModel

from team_hermes.elasticsearch import (
    CardinalityAggregation,
    ElasticsearchClient,
    FacetedSearchResponse,
    NumericHistogramFacet,
    SearchDefinition,
    SearchRequest,
    SortClause,
)


# Describe the existing index; this does not create it.
class ProductDocument(Document):
    product_id = Keyword()
    created_by_id = Keyword()
    brand = Keyword()
    price = Float()


# Choose the item and summary fields your API returns.
class ProductItem(BaseModel):
    id: str
    label: str
    price: float


class ProductMetrics(BaseModel):
    matching_documents: int
    distinct_brands: int


client = ElasticsearchClient(
    url=os.environ["ELASTICSEARCH_URL"],
    api_key=os.environ.get("ELASTICSEARCH_API_KEY"),
)

# Infer brand's term facet, use 10-unit price buckets, and exclude ID fields from facets.
PRODUCTS = (
    SearchDefinition.from_document(ProductDocument)
    .with_facets(
        overrides=(NumericHistogramFacet(field="price", interval=10),),
        exclude={"product_id", "created_by_id"},
    )
    .with_sorting(
        # A unique tiebreaker keeps pagination deterministic when prices match.
        tiebreakers=(SortClause(field="product_id", order="asc"),)
    )
)
# Summary metrics cover all matches, not just this page. Cardinality is estimated.
PRODUCT_SCOPE = CardinalityAggregation(name="product_scope", fields=("brand",))

# Decoded form of the frontend body above, supplied by your HTTP framework.
incoming_payload = {
    "terms": {"brand": ["Acme"]},
    "ranges": {"price": {"min": 10, "max": 50}},
    "aggregate_facets": ["brand", "price"],
    "include_metadata": True,
    "include_facet_counts": True,
    "sort_by": "price",
    "sort_order": "asc",
    "page": 1,
    "per_page": 20,
    "cursor": None,
}
# Without a cursor, page selects an offset: page 2 skips the first 20 results.
# With a cursor, it determines the position; page is only a client-maintained label.
# This metrics example requires include_metadata=True (also the default).
request = SearchRequest.model_validate(incoming_payload)

# Example access rule: users can search only products they created.
# Obtain the signed-in user's ID from trusted authentication, not search input.
current_user_id = "user-1"
query = (
    PRODUCTS.search()
    .using(client)
    .index("products")
    # Authorization belongs in base filters, never in user-controlled facet filters.
    .add_base_filter(Q("term", created_by_id=current_user_id))
    .aggregations(PRODUCT_SCOPE)
    # Apply filters, requested facets, sorting, and pagination.
    # Term values use OR within a facet; facets combine with AND; range bounds are inclusive.
    # Facet buckets omit their own selection but retain authorization restrictions.
    .apply_request(request)
)
# Text-search behavior is application-owned; apply_request() does not interpret q.
if request.q:
    query = query.query(Q("match", brand=request.q))

# Only execute() sends a search request; it runs synchronously.
result = query.execute()
counts = result.aggregation_by(PRODUCT_SCOPE)

# Map hits and metrics into your payload; copy facet and pagination metadata.
response = FacetedSearchResponse[ProductItem, ProductMetrics].from_result(
    result,
    items=[
        ProductItem(id=hit.product_id, label=hit.brand, price=hit.price)
        for hit in result.hits
    ],
    metrics=ProductMetrics(
        matching_documents=counts.doc_count,
        distinct_brands=counts.cardinalities["brand"],
    ),
)
# Return this payload. If next_cursor is non-null, clients send it as cursor
# in the same payload on their next request, incrementing page for display.
# To go back, send prev_cursor and decrement page. apply_request() uses the cursor.
# Keep filters, sorting, index, and text query fixed. Cursors are not snapshots.
print(response.model_dump_json(indent=2))
```

Example response for two matching products: page 1 of 1, with no previous or next cursor.
`pages` is calculated from the exact total and page size, even when using a cursor;
it is normally `null` when exact totals are disabled.

```json
{
  "items": [
    { "id": "p-1", "label": "Acme", "price": 20.0 },
    { "id": "p-2", "label": "Acme", "price": 35.0 }
  ],
  "facets": [
    {
      "key": "price",
      "value_type": "number",
      "source": null,
      "count": 2,
      "aggregated": true,
      "kind": "range",
      "histogram": {
        "buckets": [
          { "key": 20.0, "count": 1 },
          { "key": 30.0, "count": 1 }
        ],
        "min": 20.0,
        "max": 35.0,
        "mean": 27.5
      }
    },
    {
      "key": "brand",
      "value_type": "string",
      "source": null,
      "count": 2,
      "aggregated": true,
      "kind": "term",
      "buckets": [{ "value": "Acme", "count": 2 }]
    }
  ],
  "metrics": { "matching_documents": 2, "distinct_brands": 1 },
  "total": 2,
  "page": 1,
  "pages": 1,
  "next_cursor": null,
  "prev_cursor": null
}
```

| Facet field  | Meaning                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `aggregated` | Whether a bucket distribution was computed, even if empty.                          |
| `count`      | With `include_facet_counts: true`, matching documents containing the field.         |
| `source`     | Dynamic namespace, such as `numeric_attributes`; `null` for ordinary static facets. |

Presence counts respect all selected filters; buckets omit their own selection, so their counts can differ.
Without explicit presence counts, `count` falls back to available facet data and may be `null`.

### Configure

#### Skip counts and summaries

```python
from team_hermes.elasticsearch import SearchQuery


def hits_only(query: SearchQuery) -> SearchQuery:
    return query.with_aggregations(enabled=False).with_exact_total(enabled=False)
```

Totals default on; buckets and summaries are opt-in. Without metadata, results normally have
`facets=[]` and `total=pages=None`. For hits-only responses, skip `aggregation_by()` (raises `LookupError`)
and use `from_result(..., metrics=None)`.

#### Discover dynamic attributes

```python
from typing import ClassVar

from elasticsearch.dsl import Document, Keyword

from team_hermes.elasticsearch import SearchDefinition
from team_hermes.elasticsearch.indexing import DynamicField


class AttributedProduct(Document):
    product_id = Keyword()
    attributes: ClassVar[DynamicField] = DynamicField("attributes")


document = AttributedProduct(
    product_id="p-1",
    **AttributedProduct.attributes.index_values(
        numeric={"weight": 2.5},
        categorical={"color": "red"},
    ),
)
attribute_definition = SearchDefinition.from_document(AttributedProduct)
attribute_query = (
    attribute_definition.search()
    .discover_facets("attributes")
    .aggregate_facets("numeric_attributes.weight", "categorical_attributes.color")
)
```

Index `document`, then configure `attribute_query` with a client, index, and access filters.
Discovery lists fields; aggregation counts values.

#### Use a mapping dictionary instead

Pass field mappings to `from_mapping()`:

```python
from team_hermes.elasticsearch import NumericHistogramFacet, SearchDefinition, SortClause

PRODUCTS_FROM_MAPPING = (
    SearchDefinition.from_mapping(
        {
            "product_id": {"type": "keyword"},
            "created_by_id": {"type": "keyword"},
            "brand": {"type": "keyword"},
            "price": {"type": "float"},
        }
    )
    .with_facets(
        overrides=(NumericHistogramFacet(field="price", interval=10),),
        exclude={"product_id", "created_by_id"},
    )
    .with_sorting(tiebreakers=(SortClause(field="product_id", order="asc"),))
)
```

Use `PRODUCTS_FROM_MAPPING` in place of `PRODUCTS`. Omit outer `mappings` or `properties`
wrappers. Excluded fields remain in returned documents.

## 🛠️ Development

Follow the [workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- elasticsearch/tests
mise run python:lint
mise run python:typecheck
```

[Issues](https://github.com/equinor/team-hermes-packages/issues) · [Contributing](../../README.md) · [License](LICENSE.md)
