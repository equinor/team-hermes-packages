import { describe, expect, test } from "vite-plus/test";
import { searchRequest } from "./api";

const sort = { id: "id", desc: false };

describe("search request adapter", () => {
  test("converts page indexes and keeps enabled facets without sending empty term filters", () => {
    const request = searchRequest({ country: ["Norway"], field: [] }, {}, 1, 20, sort, "");
    expect(request).toMatchObject({
      terms: { country: ["Norway"] },
      aggregate_facets: ["country", "field"],
      page: 2,
      per_page: 20,
      sort_by: "id",
      sort_order: "asc",
    });
  });

  test("restores numeric URL bounds, preserves zero, and maps empty bounds to null", () => {
    const request = searchRequest(
      {},
      {
        total_depth: { from: "0", to: "" },
        "numeric_attributes.porosity": { from: "5.5", to: "12" },
      },
      0,
      20,
      sort,
      "",
    );
    expect(request.ranges).toEqual({
      total_depth: { min: 0, max: null },
      "numeric_attributes.porosity": { min: 5.5, max: 12 },
    });
  });

  test("preserves date bounds and enabled but unselected ranges", () => {
    const request = searchRequest(
      {},
      {
        spud_date: { from: "2005-01-01", to: "2009-12-31" },
        total_depth: {},
      },
      0,
      20,
      { id: "spud_date", desc: true },
      "Norway",
    );
    expect(request.ranges).toEqual({
      spud_date: { min: "2005-01-01", max: "2009-12-31" },
      total_depth: { min: null, max: null },
    });
    expect(request.aggregate_facets).toEqual(["country", "field", "spud_date", "total_depth"]);
    expect(request.sort_order).toBe("desc");
    expect(request.q).toBe("Norway");
  });

  test("rejects invalid numeric bounds rather than sending JSON null", () => {
    expect(() => searchRequest({}, { total_depth: { from: "bad" } }, 0, 20, sort, "")).toThrow(
      "Invalid numeric bound",
    );
  });
});
