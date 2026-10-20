import type { Facet, RangeFilters, TermFilters } from "@team-hermes/react-components";
import { useEffect, useState } from "react";

export type Well = {
  id: string;
  country: string;
  field: string;
  total_depth: number;
  spud_date: string;
};

export type SearchResponse = {
  items: Well[];
  facets: Facet[];
  total: number | null;
  page: number;
  pages: number | null;
};

export const pinnedFacets = ["country", "field"];

export function searchRequest(
  terms: TermFilters,
  ranges: RangeFilters,
  pageIndex: number,
  pageSize: number,
  sort: { id: string; desc: boolean },
  q: string,
) {
  const bound = (key: string, value: number | string | null | undefined) => {
    if (value === undefined || value === null || value === "") return null;
    if (key === "spud_date") return value;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`Invalid numeric bound for ${key}: ${value}`);
    return numeric;
  };

  return {
    terms: Object.fromEntries(Object.entries(terms).filter(([, values]) => values.length > 0)),
    ranges: Object.fromEntries(
      Object.entries(ranges).map(([key, { from, to }]) => [key, { min: bound(key, from), max: bound(key, to) }]),
    ),
    aggregate_facets: [...new Set([...pinnedFacets, ...Object.keys(terms), ...Object.keys(ranges)])],
    include_facet_counts: true,
    page: pageIndex + 1,
    per_page: pageSize,
    sort_by: sort.id,
    sort_order: sort.desc ? "desc" : "asc",
    q,
  };
}

type Remote<T> =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export function useRemote<T>(url: string, body?: string | null): Remote<T> {
  const key = `${url}:${body === null ? "disabled" : (body ?? "")}`;
  const [state, setState] = useState<{ key: string; result: Remote<T> }>({
    key,
    result: { status: "loading" },
  });

  useEffect(() => {
    if (body === null) return;
    const controller = new AbortController();
    setState({ key, result: { status: "loading" } });

    async function load() {
      const response = await fetch(url, {
        signal: controller.signal,
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data: T = await response.json();
      if (!controller.signal.aborted) setState({ key, result: { status: "success", data } });
    }

    void load().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState({
          key,
          result: {
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });
    return () => controller.abort();
  }, [url, body, key]);

  if (body === null) return { status: "idle" };
  return state.key === key ? state.result : { status: "loading" };
}
