import {
  FacetSidebar,
  useFinderPagination,
  useRangeFilters,
  useTermFilters,
  useUrlSorting,
  type Facet,
} from "@team-hermes/react-components";
import { useQueryState } from "nuqs";
import { pinnedFacets, searchRequest, useRemote, type SearchResponse } from "./api";

function label(key: string) {
  return key.replace(/^(numeric|categorical)_attributes\./, "").replaceAll("_", " ");
}

export function App() {
  const { pagination, setPagination, resetPage } = useFinderPagination({ defaultPageSize: 20 });
  const termFiltering = useTermFilters({ onFilterChange: resetPage });
  const rangeFiltering = useRangeFilters({ onFilterChange: resetPage });
  const { sorting, setSorting } = useUrlSorting({
    defaultSortColumn: "id",
    onSortChange: resetPage,
  });
  const [q, setQ] = useQueryState("q", { defaultValue: "" });
  const enabledFacets = [
    ...new Set([
      ...pinnedFacets,
      ...Object.keys(termFiltering.termFilters),
      ...Object.keys(rangeFiltering.rangeFilters),
    ]),
  ];

  let body: string | undefined;
  let requestError: string | undefined;
  try {
    body = JSON.stringify(
      searchRequest(
        termFiltering.termFilters,
        rangeFiltering.rangeFilters,
        pagination.pageIndex,
        pagination.pageSize,
        sorting[0] ?? { id: "id", desc: false },
        q,
      ),
    );
  } catch (error) {
    requestError = error instanceof Error ? error.message : String(error);
  }

  const search = useRemote<SearchResponse>("/api/wells/search", body ?? null);
  const catalog = useRemote<Facet[]>("/api/wells/facets");
  const data = !requestError && search.status === "success" ? search.data : undefined;
  const addable =
    catalog.status === "success" ? catalog.data.filter((facet) => !enabledFacets.includes(facet.key)) : [];
  const pickerGroups = [
    { value: "Well", items: addable.filter((facet) => facet.source === null) },
    { value: "Attributes", items: addable.filter((facet) => facet.source !== null) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="demo">
      <header>
        <h1>Faceted search</h1>
        <p>Local React components + Python search package + Elasticsearch</p>
      </header>
      <div className="demo-layout">
        <aside aria-label="Search filters">
          {catalog.status === "error" && <p role="alert">Facet catalog: {catalog.message}</p>}
          <FacetSidebar
            termFiltering={termFiltering}
            rangeFiltering={rangeFiltering}
            facets={data?.facets ?? []}
            enabledFacets={enabledFacets}
            pinnedFacets={pinnedFacets}
            pickerGroups={pickerGroups}
            isFetching={!requestError && search.status === "loading"}
            parseFacetLabel={label}
            facetUnits={{ total_depth: "m", "numeric_attributes.porosity": "%" }}
          />
        </aside>
        <main>
          <div className="toolbar">
            <label>
              Search wells
              <input
                type="search"
                value={q}
                onChange={(event) => {
                  void setQ(event.target.value);
                  resetPage();
                }}
                placeholder="Norway, Alpha, W-000"
              />
            </label>
            <label>
              Sort by
              <select
                value={sorting[0]?.id ?? "id"}
                onChange={(event) => setSorting([{ id: event.target.value, desc: false }])}
              >
                <option value="id">Well ID</option>
                <option value="total_depth">Depth</option>
                <option value="spud_date">Spud date</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSorting([{ id: sorting[0]?.id ?? "id", desc: !sorting[0]?.desc }])}
            >
              {sorting[0]?.desc ? "Descending" : "Ascending"}
            </button>
          </div>
          {requestError && <p role="alert">{requestError}</p>}
          {search.status === "error" && <p role="alert">Search: {search.message}</p>}
          {!requestError && search.status === "loading" && <p role="status">Loading results...</p>}
          {data && (
            <>
              <p role="status">{data.total} results</p>
              {data.items.length === 0 && <p>No wells match these filters.</p>}
              <table aria-label="Wells">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Country</th>
                    <th>Field</th>
                    <th>Depth (m)</th>
                    <th>Spud date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((well) => (
                    <tr key={well.id}>
                      <td>{well.id}</td>
                      <td>{well.country}</td>
                      <td>{well.field}</td>
                      <td>{well.total_depth}</td>
                      <td>{well.spud_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <nav aria-label="Result pages">
            <button
              type="button"
              disabled={!data || pagination.pageIndex === 0}
              onClick={() => setPagination((previous) => ({ ...previous, pageIndex: previous.pageIndex - 1 }))}
            >
              Previous
            </button>
            <span>
              Page {pagination.pageIndex + 1} of {Math.max(1, data?.pages ?? 1)}
            </span>
            <button
              type="button"
              disabled={!data || pagination.pageIndex + 1 >= (data.pages ?? 0)}
              onClick={() => setPagination((previous) => ({ ...previous, pageIndex: previous.pageIndex + 1 }))}
            >
              Next
            </button>
          </nav>
        </main>
      </div>
    </div>
  );
}
