# Faceted search demo

A real integration of the local React and Python packages with Elasticsearch.
The browser uses the React package's public components and URL-state hooks.
FastAPI uses the Python package's search definitions, client, request validation,
and facet responses. No search responses are mocked during normal operation.

## Prerequisites

- Docker with Compose.
- Vite+ (`vp`) and the repository's Node runtime.
- uv and Python 3.14+ (uv can install Python).

The demo currently requires Python 3.14 because constructing histogram facets
in the shared package fails on Python 3.13 with a slotted-dataclass `super()`
error. This demo does not change the shared package's supported Python versions.

## Install

From the repository root:

```sh
cd team-hermes-packages-react
vp install --frozen-lockfile
vp run build
cd ../demo/faceted-search
vp install --frozen-lockfile
uv sync --directory backend --locked
vp exec playwright install chromium
```

The React dependency is a local package link, not an import from its source or
Storybook internals. Rebuild the library after changing its code. Python is an
editable local dependency; restart the API after changing it.

The demo has one JavaScript package at its root. `frontend/` contains the Vite
app, and `tests/` contains Playwright tests. Vite deduplicates React and nuqs so
the linked library shares the consuming application's runtime and URL adapter.

## Explore manually

Run these commands from this directory:

```sh
docker compose up -d --wait
vp run dev:api
```

In another terminal, in the same directory:

```sh
vp run dev:web
```

Open <http://127.0.0.1:4173>. API docs are at <http://127.0.0.1:8000/docs>.
Vite proxies `/api` to FastAPI; the browser never connects directly to Elasticsearch.
The built frontend also requires an `/api` reverse proxy if hosted elsewhere;
the development proxy is not included in the static build.

Stop the two foreground processes with Ctrl+C, then stop the demo container:

```sh
docker compose down --volumes
```

Ports 4173, 8000, and 19200 must be available. This is a local demo, not a
production deployment: Elasticsearch authentication is disabled and its port
is bound to localhost only. Do not point it at a shared cluster.

### Dataset and lifecycle

Each API process creates its own `hermes-faceted-demo-<uuid>` index, checks bulk
indexing errors, and refreshes it before accepting requests. Graceful shutdown
deletes only that index. Killing the process forcibly can leave its index behind;
removing the disposable Compose container removes its data. No persistent
Elasticsearch volume is configured.

There are 40 deterministic wells, sorted by ID by default:

- `W-000` through `W-039`.
- Even IDs: Norway; odd IDs: UK (20 of each).
- First 20: Alpha; last 20: Bravo.
- Depth: `1000 + 100 * i` metres.
- Spud date: June 15 of `2000 + floor(i / 4)`.
- Dynamic attributes: porosity (`5 + i / 2`) and formation (Sandstone/Shale).

Use **Add Filter** for depth, dates, and discovered dynamic attributes. These
dynamic fields are Elasticsearch objects managed by `DynamicField`, not
Elasticsearch `nested` documents.

Try selecting Norway and Alpha: exactly 10 wells match. The country distribution
still offers UK because facet distributions omit their own selections. Range,
term, page, sorting, and search-text state are URL-backed.

## Validate

With Elasticsearch running and the manual API/frontend processes stopped:

```sh
vp test
vp run check
vp run check:api
vp run build
vp run test:e2e
```

Playwright starts fresh API and frontend processes, waits for readiness, and
stops them afterwards. It deliberately does not reuse existing servers, which
could hide stale builds or seed data. Two workers share a read-only seeded index.
The suite exercises:

- Exact result IDs, facet counts, and disjunctive term filtering.
- Pagination, sorting, page reset, and URL restoration.
- Numeric/date histograms and discovered dynamic facets.
- HTTP validation failures, empty results, and visible search/catalog failures.
- Invalid numeric URL bounds without silently issuing an unfiltered search.

Only the failure-path tests intercept HTTP responses. Successful search tests
go through both local packages and the real Elasticsearch container.

Unit tests cover the HTTP adapter: zero-based UI pages become one-based API
pages, empty terms are omitted, numeric URL strings become numbers, date strings
are preserved, and `from`/`to` become `min`/`max`.

CI runs the same checks in a separate workflow job. On Linux, install Chromium
and its system dependencies with `vp exec playwright install --with-deps chromium`.
Failed browser runs retain traces under `test-results/`.
