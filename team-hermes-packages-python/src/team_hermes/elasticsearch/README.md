# 🔍 Elasticsearch

Build typed Elasticsearch searches with filters, facets, sorting, pagination, and aggregations.
Import the public API from `team_hermes.elasticsearch`.

For installation, see the [main README](../../../../README.md).

**Contents**

- [🧭 Overview](#-overview)
- [🚀 Quick start](#-quick-start)
- [🔌 Application integration](#-application-integration)
- [🧩 Search recipes](#-search-recipes)
- [📤 Results and responses](#-results-and-responses)
- [📚 API reference](#-api-reference)
- [⚠️ Errors and edge cases](#️-errors-and-edge-cases)
- [🛠️ Maintainer notes](#️-maintainer-notes)

## 🧭 Overview

**Define → configure → execute → read results.**

- **`SearchDefinition`** describes reusable facet, sorting, and pagination capabilities.
- **`SearchQuery`** lets you choose which documents to find, how to sort and page them,
  and which counts or facet values to return. Chain its methods, then call `execute()`.
- **Facets** describe categorical values (`TermsFacet`), numeric ranges
  (`NumericHistogramFacet`), dates (`DateHistogramFacet`), or dynamic attributes (`DynamicFacetFamily`).
- **Aggregations** calculate summaries such as distinct counts or sums across matching documents.
- **`SearchResult`** contains hits, facets, aggregation values, totals, and navigation.
- **`SearchRequest` / `FacetedSearchResponse`** provide validated HTTP inputs and typed responses.
- **`ElasticsearchClient`** executes searches and provides index-management operations.

The library builds searches, shapes their results, and provides a synchronous client.
Your application supplies connection settings and owns index naming, lifecycle decisions,
text-query logic, authorization, and response payload models. Definition and query setters
return new instances; configuring a `SearchQuery` performs no I/O until `execute()`.

## 🚀 Quick start

This example searches an existing `products` index with `product_id`, `tenant_id`, `brand`,
and `price` fields. It returns the first 20 matching products and brand buckets.

Supply a configured [ESClient](client.py) and a tenant ID from the authenticated context.
The [integration section](#-application-integration) explains the client contract.
Defining the search below does not connect to Elasticsearch or create an index.
Pass the field-to-mapping dictionary, not an outer `mappings` or `properties` wrapper.

```python
from elasticsearch.dsl import Q

from team_hermes.elasticsearch import (
    NumericHistogramFacet,
    RangeFilter,
    SearchDefinition,
    SearchResult,
    SortClause,
)
from team_hermes.elasticsearch.client import ESClient

PRODUCTS = (
    SearchDefinition.from_mapping(
        {
            "product_id": {"type": "keyword"},
            "tenant_id": {"type": "keyword"},
            "brand": {"type": "keyword"},
            "price": {"type": "float"},
        }
    )
    .with_facets(
        overrides=(NumericHistogramFacet(field="price", interval=10),),
        exclude={"product_id", "tenant_id"},
    )
    .with_sorting(tiebreakers=(SortClause(field="product_id", order="asc"),))
)


def search_products(client: ESClient, tenant_id: str) -> SearchResult:
    return (
        PRODUCTS.search()
        .using(client)
        .index("products")
        .add_base_filter(Q("term", tenant_id=tenant_id))
        .with_facet_filters(
            terms={"brand": ["Acme"]},
            ranges={"price": RangeFilter(min=10, max=50)},
        )
        .aggregate_facets("brand")
        .sort("price", "asc")
        .offset_page(number=1, size=20)
        .execute()
    )
```

With your application's `client` and authenticated `tenant_id`:

```python
result = search_products(client, tenant_id)

for hit in result.hits:
    print(hit.product_id, hit.brand, hit.price)
```

Read `result.facets` for brand buckets, `result.total` for the matching-document count,
and `result.cursors` for navigation. The brand distribution keeps the tenant and price
restrictions but omits the selected brand, so users can see alternative brands.

> **Authorization always belongs in `add_base_filter()`, never in facet filters.**
> Facet distributions intentionally omit their own selections. Base filters apply to
> both hits and calculations.

## 🔌 Application integration

### Supply a search client

The [ESClient](client.py) protocol requires one synchronous method:
`execute(search, *, index_name)`. It receives a DSL `Search` and must return a DSL `Response`,
not a raw response dictionary. An existing application client can satisfy this contract;
it does not need to inherit from `ESClient`.

Use the packaged [ElasticsearchClient](elasticsearch_client.py) for a ready-made implementation:

```python
from team_hermes.elasticsearch import ElasticsearchClient


def create_search_client(url: str, api_key: str | None = None) -> ElasticsearchClient:
    return ElasticsearchClient(url=url, api_key=api_key)
```

Call `create_search_client()` with settings from your application and pass the returned client
to `search_products()`. The constructor also accepts `index_prefix=""`, which is stored for
application naming helpers; it is not automatically prepended to index or alias arguments.
`SearchQuery.index("products")` selects an existing index; it does not create or populate one.

For custom connection configuration or an existing application client, keep implementing
`ESClient`. Search consumers and test doubles do not need index-management methods or the
broader [ElasticsearchClientInterface](elasticsearch_client_interface.py).

When calling `ElasticsearchClient.execute()` directly, pass a DSL `Search` without bound
indices if you want only `index_name` searched. The underlying DSL appends that name to any
indices already attached to the search.

### Manage indices

The concrete client also implements the following operations. Your application decides when
to run them and supplies the index schema and concrete index names.

| Method                                                  | Behavior                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `create_index(index_name, index)`                       | Create an index from a DSL `Index` with a 60-second request timeout                                 |
| `delete_index(index_name)`                              | Delete an index, ignoring a missing index                                                           |
| `index_exists(index_name)`                              | Return whether an index exists                                                                      |
| `bulk_index(index_name, documents, id_field="id")`      | Index documents and return `BulkIndexResult(has_errors, error_count)`                               |
| `force_merge(index_name, *, max_num_segments=1)`        | Merge segments with a 3,600-second request timeout                                                  |
| `swap_alias_and_delete_old(alias_name, new_index_name)` | Point an alias at a new index and delete the previously aliased indices in one alias-update request |

An empty bulk input returns a successful result without sending a request. Bulk indexing
does not force a refresh, and item failures are counted rather than raised; transport failures
still propagate. A document missing `id_field` is submitted without an explicit ID.
Run force-merge only after bulk indexing is complete for write-once/read-many indices.

> **Alias replacement deletes data.** `swap_alias_and_delete_old()` deletes the entire old
> indices, not just their aliases, and returns their names. Supply a new index that is not
> already behind the alias. Do not blindly retry with an already-active target: the copied
> operation does not exclude that target from deletion.

### Apply a validated request

Use `SearchRequest` when filters and paging come from an incoming request body.
The helper below accepts the configured `PRODUCTS` definition from the quick start.
Supply `tenant_id` from the authenticated context, not from that body.

```python
from elasticsearch.dsl import Q

from team_hermes.elasticsearch import SearchDefinition, SearchRequest, SearchResult
from team_hermes.elasticsearch.client import ESClient


def search_product_request(
    definition: SearchDefinition, client: ESClient, request: SearchRequest, tenant_id: str
) -> SearchResult:
    query = (
        definition.search()
        .using(client)
        .index("products")
        .add_base_filter(Q("term", tenant_id=tenant_id))
        .apply_request(request)
    )
    if request.q:
        query = query.query(Q("match", brand=request.q))
    return query.execute()


request = SearchRequest.model_validate(
    {
        "terms": {"brand": ["Acme"]},
        "ranges": {"price": {"min": 10, "max": 50}},
        "aggregate_facets": ["brand", "price"],
        "include_facet_counts": True,
        "sort_by": "price",
        "sort_order": "asc",
        "page": 1,
        "per_page": 20,
    }
)
```

Call `search_product_request(PRODUCTS, client, request, tenant_id)`.
`apply_request()` handles filters, distributions, discovery, sorting, pagination, and metadata;
it does not turn `q` into a text query. This example matches `brand`, but your application
chooses which fields and query types to use.

### Infer capabilities from a DSL document

Use `from_document()` instead of `from_mapping()` when your fields are already declared
on an Elasticsearch DSL document. Both factories inspect local mappings without contacting
Elasticsearch. Apply the same facet exclusions and sorting policy as in the quick start.

```python
from elasticsearch.dsl import Document, Float, Keyword

from team_hermes.elasticsearch import NumericHistogramFacet, SearchDefinition, SortClause


class ProductDocument(Document):
    product_id = Keyword()
    tenant_id = Keyword()
    brand = Keyword()
    price = Float()


PRODUCTS_FROM_DOCUMENT = (
    SearchDefinition.from_document(ProductDocument)
    .with_facets(
        overrides=(NumericHistogramFacet(field="price", interval=10),),
        exclude={"product_id", "tenant_id"},
    )
    .with_sorting(tiebreakers=(SortClause(field="product_id", order="asc"),))
)
```

You can pass `PRODUCTS_FROM_DOCUMENT` to `search_product_request()` in place of `PRODUCTS`.

## 🧩 Search recipes

Unless a recipe defines its own mapping, its `query` argument is a `SearchQuery` configured
with a client, index, and authorization restrictions, using the product fields above.

### Filters and facets

| Goal                           | Method                 | Effect                                       |
| ------------------------------ | ---------------------- | -------------------------------------------- |
| Enforce access restrictions    | `add_base_filter()`    | Restricts hits and every calculation         |
| Select documents interactively | `with_facet_filters()` | Applies selected values and ranges           |
| Return facet distributions     | `aggregate_facets()`   | Requests buckets without selecting documents |

Values within a terms filter use OR; different filters use AND. Facet distributions omit
their own field/kind selection while retaining the other filters and access restrictions.
Empty terms or fully open ranges do not filter documents. Calling `with_facet_filters()`
without arguments clears interactive filters, not authorization restrictions.

```python
from team_hermes.elasticsearch import RangeFilter, SearchQuery


def filter_products(query: SearchQuery) -> SearchQuery:
    return query.with_facet_filters(
        terms={"brand": ["Acme", "Other"]},
        ranges={"price": RangeFilter(min=10, max=50)},
    ).aggregate_facets("brand", "price")
```

### Field names and histograms

`field` is the indexed path; `name` is the public filter/response key. Match fields to your index mapping.
Numeric histograms can infer intervals from fetched bounds; dates use calendar or fixed intervals.

```python
from team_hermes.elasticsearch import (
    DateHistogramFacet,
    NumericHistogramFacet,
    SearchDefinition,
    TermsFacet,
)

custom_definition = SearchDefinition(
    facets=(
        TermsFacet(field="brand_name", name="brand", keyword=True),
        NumericHistogramFacet(field="price", max_buckets=20),
        DateHistogramFacet(field="created_at", calendar_interval="month"),
    )
)
```

Use `with_facets(overrides=..., exclude=...)` to customize an inferred definition.
Overrides replace matching public names or owned indexed fields. Exclusions use
indexed fields or dynamic family names, not static aliases; overrides supplied in
the same call take precedence. With no arguments, the current catalog is preserved.
Excluding a facet does not hide that field in returned documents or restrict sorting.

### Dynamic attributes

Declare a matching `ClassVar[DynamicField]` on the document. `index_values()` prepares
numeric values, categorical values, and the field-name catalog for indexing together.

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

Index `document` through the application's normal indexing path. Discovery returns field names
and counts; aggregation returns value distributions. A truncated discovery catalog raises an error.

### Sorting and pagination

Use a stable sort with a unique tiebreaker. Keep filters and sorting fixed between pages.
Pass the query returned by `first_page()` into `next_page()`.
The default offset window is 10,000 documents; use cursors for deeper results.
Keep the index and text query fixed too: cursor tokens are positions, not snapshots.
Factories do not read index settings; pass the actual `max_result_window` if it differs.

For pages beyond the offset window, see [errors and edge cases](#️-errors-and-edge-cases).

```python
from team_hermes.elasticsearch import Cursor, SearchQuery, SearchResult


def first_page(query: SearchQuery) -> SearchQuery:
    return query.sort("price", "asc").offset_page(number=1, size=20)


def next_page(query: SearchQuery, result: SearchResult) -> SearchQuery | None:
    cursor = result.cursors.next
    if isinstance(cursor, Cursor):
        return query.cursor_page(cursor, size=20)
    return None
```

### Aggregations

Aggregations use all active filters. Keep the definition to read its typed result.

```python
from team_hermes.elasticsearch import CardinalityAggregation, ScopeCounts, SearchQuery


def count_brands(query: SearchQuery) -> ScopeCounts:
    brands = CardinalityAggregation(name="brands", fields=("brand",))
    result = query.aggregations(brands).offset_page(size=0).execute()
    return result.aggregation_by(brands)
```

Other summaries: `IntegerSumAggregation` sums an integer field, `ExistsCountsAggregation`
counts documents containing fields, and `SampledTermsAggregation` returns buckets from
a relevance-selected sample. Aggregation fields use indexed paths, and names must be unique.
`offset_page(size=0)` is valid only on page one. It returns no hits or cursors and
`pages=None`; exact totals remain independently configurable. This is distinct from
the automatic result-window probe described under [errors and edge cases](#️-errors-and-edge-cases).

### Counts and optional metadata

Facet buckets, discovery, and summaries are opt-in; exact totals are enabled by default.
`with_facet_counts()` counts documents containing each static facet and overrides bucket-derived counts.
These presence counts use all active filters, unlike distributions that omit their
own selection. With aggregations disabled, ordinary results have `facets=[]` and
aggregation lookup raises `LookupError`; disabling exact totals gives `total=None`
and `pages=None`. Result-window probes are an exception; missing
indices always report zero totals and pages.
For ordinary hits-only pages, skip both calculations (or use `SearchRequest(include_metadata=False)`):

```python
from team_hermes.elasticsearch import SearchQuery


def hits_only(query: SearchQuery) -> SearchQuery:
    return query.with_aggregations(enabled=False).with_exact_total(enabled=False)
```

## 📤 Results and responses

### Read search results

| Attribute         | Meaning                                                |
| ----------------- | ------------------------------------------------------ |
| `hits`            | Documents in the returned page                         |
| `facets`          | Facet descriptors and any requested buckets or counts  |
| `total` / `pages` | Matching-document count and page count, when available |
| `page`            | Current page information                               |
| `cursors`         | Next and previous navigation cursors                   |
| `missing_index`   | Whether the index was absent                           |

Use `result.aggregation_by(definition)` for named aggregation results. Totals and summaries
cover matching documents, not just the returned page. A facet's `aggregated` flag tells you
whether its distribution was computed; an unrequested distribution is not a zero-match result.

### Build typed response payloads

Customize both payloads with `FacetedSearchResponse[ItemT, MetricsT]`:

- **Items:** map `result.hits` into your own model to rename, derive, or omit fields.
  The supplied `items` become the HTTP payload; raw hits are not copied automatically.
- **Metrics:** register aggregations before execution, then map their values into your own model.
  These summaries cover matching documents, not just the returned page.
- **Search metadata:** `from_result()` preserves facets, totals, page information, and encoded cursors.
  `facet.aggregated` indicates whether a distribution was computed.

```python
from pydantic import BaseModel

from team_hermes.elasticsearch import (
    CardinalityAggregation,
    FacetedSearchResponse,
    SearchQuery,
    SearchResult,
)


class ProductItem(BaseModel):
    id: str
    label: str


class ProductMetrics(BaseModel):
    matching_documents: int
    distinct_brands: int


PRODUCT_SCOPE = CardinalityAggregation(name="product_scope", fields=("brand",))


def product_response(result: SearchResult) -> FacetedSearchResponse[ProductItem, ProductMetrics]:
    items = [ProductItem(id=hit.product_id, label=hit.brand) for hit in result.hits]
    metrics: ProductMetrics | None
    try:
        counts = result.aggregation_by(PRODUCT_SCOPE)
    except LookupError:
        metrics = None
    else:
        metrics = ProductMetrics(
            matching_documents=counts.doc_count,
            distinct_brands=counts.cardinalities["brand"],
        )
    return FacetedSearchResponse[ProductItem, ProductMetrics].from_result(result, items=items, metrics=metrics)


def search_product_response(query: SearchQuery) -> FacetedSearchResponse[ProductItem, ProductMetrics]:
    result = query.aggregations(PRODUCT_SCOPE).execute()
    return product_response(result)
```

Pass a query with its request controls, client, index, and authorization already configured
to `search_product_response()`. It returns `items` containing only `id` and `label`, and
`metrics` containing the matching-document count and estimated distinct-brand count.
If the aggregation is unavailable, for example when metadata is disabled, this example
returns `metrics=None` rather than zero counts. Both `items` and `metrics` must be supplied
to `from_result()`; `items=[]` stays empty. Mapping the payload does not mutate `SearchResult`.

## 📚 API reference

Definition and query setters return new instances. Keep the returned value when configuring
a search. See [search.py](search.py) for full type signatures.

### SearchDefinition

| Method                                                                                      | Purpose                                      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `from_mapping(properties, *, max_result_window=10_000, supports_cursor_pagination=True)`    | Infer capabilities from mapping properties   |
| `from_document(document, *, max_result_window=10_000, supports_cursor_pagination=True)`     | Infer capabilities from a DSL document class |
| `with_facets(*, overrides=(), exclude=())`                                                  | Customize available facets                   |
| `with_sorting(*, fields=None, namespaces=None, exclude=(), default=None, tiebreakers=None)` | Configure allowed sorts and defaults         |
| `search()`                                                                                  | Create a `SearchQuery`                       |

For explicit capabilities, construct `SearchDefinition(facets=(...))`.

### SearchQuery

| Method                                            | Purpose                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `using(client)`                                   | Set the client implementing `ESClient`                                                |
| `index(name)`                                     | Select an existing index                                                              |
| `query(query)`                                    | Set a base query applied to documents and all calculations                            |
| `add_base_filter(query)`                          | Add an AND restriction that always applies                                            |
| `with_facet_filters(*, terms=None, ranges=None)`  | Replace both interactive filter maps; omitted maps are cleared                        |
| `aggregate_facets(*names)`                        | Request facet value buckets or histograms                                             |
| `discover_facets(*families)`                      | Request dynamic attribute names and document counts                                   |
| `aggregations(*definitions)`                      | Request named summaries                                                               |
| `sort(field=None, order="asc")`                   | Sort by an allowed field plus tiebreakers; no field restores the default              |
| `offset_page(*, number=1, size=20)`               | Select a page by number; size zero on page one requests no hits                       |
| `cursor_page(cursor, *, size=20, display_page=1)` | Page from a cursor; `display_page` is only a display label                            |
| `with_facet_counts(*, enabled=True)`              | Request presence counts for static facets, not value buckets                          |
| `with_aggregations(*, enabled=True)`              | Toggle buckets, discovery, summaries, and presence counts                             |
| `with_exact_total(*, enabled=True)`               | Toggle exact totals and total pages independently                                     |
| `apply_request(request)`                          | Apply validated request controls, excluding text-query construction and authorization |
| `execute()`                                       | Validate, send search requests, and assemble the result                               |

`aggregate_facets()`, `discover_facets()`, and `aggregations()` replace their previous selections;
calling them without arguments clears those requests. Disabling aggregations does not remove
filters or change the exact-total setting.

### Requests, responses, and cursors

| Method                                                                          | Purpose                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `SearchRequest.model_validate(body)`                                            | Validate an incoming request body                  |
| `SearchResult.aggregation_by(definition)`                                       | Read an aggregation using an equivalent definition |
| `FacetedSearchResponse[ItemT, MetricsT].from_result(result, *, items, metrics)` | Build a typed response from mapped payloads        |
| `Cursor.encode()` / `Cursor.decode(token)`                                      | Convert between cursor values and transport tokens |

## ⚠️ Errors and edge cases

### Validation and execution failures

The application decides how to expose errors to callers. The library does not assign HTTP
status codes. See [errors.py](errors.py) for the search-specific exceptions.

| Error                       | Meaning                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| Pydantic `ValidationError`  | An input model could not validate the supplied data                              |
| `InvalidSearchRequestError` | Request controls are incompatible with the search definition                     |
| `UnknownFacetError`         | A requested facet is not available                                               |
| `InvalidRangeFilterError`   | A range has its minimum above its maximum                                        |
| `InvalidCursorError`        | A cursor token is malformed or has an unknown direction                          |
| `ResultWindowError`         | Matching documents at this offset must be reached with cursor pagination         |
| `FacetBoundsPrefetchError`  | Fetching bounds for an automatic histogram failed; inspect the chained exception |

A missing index returns an empty result with `missing_index=True` and zero totals and pages.
Other search failures propagate rather than becoming empty results. A truncated dynamic
discovery catalog raises an error rather than silently returning an incomplete catalog.

### Offset-window probes

An offset page crossing the configured result window triggers a zero-hit probe. If matches
remain at the requested offset, the library raises `ResultWindowError`; otherwise it returns
an empty page. The probe forces exact totals and requested aggregations even when disabled,
but skips explicit static-facet presence counts.

This differs from explicitly requesting `offset_page(size=0)`: that request returns no hits
or cursors, has `pages=None`, and respects the independent exact-total setting.

## 🛠️ Maintainer notes

The internal flow is **resolve and plan → build requests → execute → project results**.

### Module responsibilities

| Module                                                                                                                     | Responsibility                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [search.py](search.py)                                                                                                     | Definitions, customization, fluent queries, and execution orchestration                |
| [mapping.py](mapping.py), [indexing.py](indexing.py)                                                                       | Capability inference and dynamic field storage                                         |
| [facet_plan.py](facet_plan.py)                                                                                             | Per-request resolution, validation, filters, and work selection                        |
| [facets/](facets/__init__.py)                                                                                              | Facet configuration, field ownership, aggregation building, extraction, and projection |
| [filters.py](filters.py)                                                                                                   | Shared Elasticsearch filter scoping, keys, and field-path primitives                   |
| [elasticsearch.py](elasticsearch.py), [client.py](client.py)                                                               | Request construction, bounds fetching, and client contract                             |
| [elasticsearch_client.py](elasticsearch_client.py), [elasticsearch_client_interface.py](elasticsearch_client_interface.py) | Synchronous search execution, index administration, and bulk result contract           |
| [aggregations/](aggregations/__init__.py)                                                                                  | Non-facet calculations and response readers                                            |
| [input.py](input.py), [result.py](result.py)                                                                               | Validated inputs, assembled results, and HTTP response models                          |
| [sort.py](sort.py), [pagination.py](pagination.py)                                                                         | Sorting policy and page/cursor handling                                                |
