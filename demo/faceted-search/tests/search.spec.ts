import { expect, test, type Page } from "@playwright/test";
import type { SearchResponse } from "../frontend/src/api";

const ids = (start: number, count: number, step = 1) =>
  Array.from({ length: count }, (_, i) => `W-${String(start + i * step).padStart(3, "0")}`);

const resultIds = (page: Page) => page.locator("tbody tr td:first-child");
const facet = (page: Page, key: string) => page.locator(`[data-facet-key="${key}"]`);

async function addFacet(page: Page, name: string) {
  await page.getByRole("combobox").filter({ hasText: "Add Filter" }).click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

test("loads exact results, combines terms, preserves alternatives, and restores the URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("40 results");
  await expect(resultIds(page)).toHaveText(ids(0, 20));

  const country = facet(page, "country");
  await expect(country.getByText("Norway", { exact: true }).locator("..")).toHaveText("Norway20");
  await country.getByText("Norway", { exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("20 results");
  await expect(resultIds(page)).toHaveText(ids(0, 20, 2));
  await expect(country.getByText("UK", { exact: true }).locator("..")).toHaveText("UK20");

  await facet(page, "field").getByText("Alpha", { exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("10 results");
  await expect(resultIds(page)).toHaveText(ids(0, 10, 2));
  await expect(page).toHaveURL(/terms=/);
  await page.reload();
  await expect(resultIds(page)).toHaveText(ids(0, 10, 2));
  await expect(country.getByRole("checkbox", { name: /Norway/ })).toBeChecked();
});

test("paginates, sorts, and resets the page on a filter change", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(resultIds(page)).toHaveText(ids(20, 20));
  await facet(page, "country").getByText("Norway", { exact: true }).click();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(resultIds(page)).toHaveText(ids(0, 20, 2));
  await page.getByLabel("Sort by").selectOption("total_depth");
  await page.getByRole("button", { name: "Ascending", exact: true }).click();
  await expect(resultIds(page)).toHaveText(ids(38, 20, -2));
});

test("adds a numeric facet and restores numeric range bounds after reload", async ({ page }) => {
  await page.goto("/");
  await addFacet(page, "total depth");
  const depth = facet(page, "total_depth");
  await expect(depth.getByTestId("histogram-bars")).toBeVisible();
  await depth.getByLabel("Minimum value").fill("3000");
  await depth.getByLabel("Minimum value").blur();
  await expect(page.getByRole("status")).toHaveText("20 results");
  await expect(resultIds(page)).toHaveText(ids(20, 20));
  await page.reload();
  await expect(resultIds(page)).toHaveText(ids(20, 20));
  await expect(depth.getByLabel("Minimum value")).toHaveValue("3000");
});

test("filters dates and discovers dynamic categorical and numeric facets", async ({ page }) => {
  await page.goto("/");
  await addFacet(page, "spud date");
  const date = facet(page, "spud_date");
  await date.getByLabel("Minimum value").fill("2005-01-01");
  await date.getByLabel("Minimum value").blur();
  await expect(resultIds(page)).toHaveText(ids(20, 20));

  await addFacet(page, "formation");
  await facet(page, "categorical_attributes.formation").getByText("Sandstone", { exact: true }).click();
  await expect(resultIds(page)).toHaveText(ids(20, 10, 2));
  await addFacet(page, "porosity");
  const porosity = facet(page, "numeric_attributes.porosity");
  await expect(porosity.getByTestId("histogram-bars")).toBeVisible();
  await porosity.getByLabel("Minimum value").fill("20");
  await porosity.getByLabel("Minimum value").blur();
  await expect(resultIds(page)).toHaveText(ids(30, 5, 2));
});

test("shows an empty state and an explicit search failure, then recovers", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search wells").fill("not-a-well");
  await expect(page.getByRole("status")).toHaveText("0 results");
  await expect(page.getByText("No wells match these filters.")).toBeVisible();

  await page.route("**/api/wells/search", (route) =>
    route.fulfill({ status: 503, json: { detail: "Elasticsearch is unavailable" } }),
  );
  await page.getByLabel("Search wells").fill("Norway");
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await expect(resultIds(page)).toHaveCount(0);
  await page.unroute("**/api/wells/search");
  await page.getByLabel("Search wells").fill("");
  await expect(page.getByRole("status")).toHaveText("40 results");
});

test("catalog failure does not block search results", async ({ page }) => {
  await page.route("**/api/wells/facets", (route) =>
    route.fulfill({ status: 503, json: { detail: "Catalog unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Facet catalog: HTTP 503");
  await expect(resultIds(page)).toHaveText(ids(0, 20));
});

test("invalid URL ranges are visible errors and do not issue an unfiltered search", async ({ page }) => {
  const searches: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/wells/search")) searches.push(request.url());
  });
  await page.goto("/?ranges=total_depth:bad~");
  await expect(page.getByRole("alert")).toContainText("Invalid numeric bound");
  await expect(resultIds(page)).toHaveCount(0);
  expect(searches).toHaveLength(0);
});

test("real API returns exact facet counts and rejects invalid requests", async ({ request }) => {
  const response = await request.post("/api/wells/search", {
    data: {
      terms: { country: ["Norway"] },
      ranges: { total_depth: { min: 3000 } },
      aggregate_facets: ["country", "total_depth"],
      include_facet_counts: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  const result: SearchResponse = await response.json();
  expect(result.total).toBe(10);
  expect(result.items.map((well) => well.id)).toEqual(ids(20, 10, 2));
  expect(result.facets).toContainEqual({
    key: "country",
    kind: "term",
    source: null,
    value_type: "string",
    count: 10,
    aggregated: true,
    buckets: [
      { value: "Norway", count: 10 },
      { value: "UK", count: 10 },
    ],
  });

  for (const data of [
    { page: 0 },
    { terms: { unknown: ["value"] } },
    { ranges: { total_depth: { min: 5000, max: 1000 } } },
  ]) {
    const invalid = await request.post("/api/wells/search", { data });
    expect(invalid.status()).toBe(422);
    expect(await invalid.json()).toHaveProperty("detail");
  }
});
