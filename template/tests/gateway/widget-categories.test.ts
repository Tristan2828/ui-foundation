// Gateway contract tests for src/api/gateway/widget-categories.ts — written
// TDD-style, ahead of the implementation. Derived only from openapi.yaml,
// src/api/contracts.ts and src/api/schema.d.ts. Do NOT make these pass by
// reading the (nonexistent) gateway implementation.
//
// These tests are EXPECTED to fail right now with a "cannot find module"
// style error, because src/api/gateway/widget-categories.ts does not exist yet.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getWidgetCategoriesByIds, listWidgetCategories } from "../../src/api/gateway/widget-categories";
import type { AppError } from "@tristan2828/ui-foundation";
import type { components } from "../../src/api/schema";

type WidgetCategory = components["schemas"]["WidgetCategory"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFetchRejecting(error: unknown) {
  const fetchMock = vi.fn().mockRejectedValue(error);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): URL {
  const [urlArg] = fetchMock.mock.calls[callIndex];
  return new URL(String(urlArg), "http://localhost");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listWidgetCategories", () => {
  it("passes the search param through and resolves with a plain WidgetCategory[] (no pagination wrapper)", async () => {
    const widgetCategories: WidgetCategory[] = [
      { id: 1, name: "Alpha" },
      { id: 2, name: "Beta" },
    ];
    const fetchMock = stubFetch(jsonResponse(widgetCategories, 200));

    const result = await listWidgetCategories("al");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/widget-categories");
    expect(url.searchParams.get("search")).toBe("al");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(widgetCategories);
  });

  it("omits the search param when called with no argument", async () => {
    const fetchMock = stubFetch(jsonResponse([], 200));

    await listWidgetCategories();

    const url = calledUrl(fetchMock);
    expect(url.searchParams.has("search")).toBe(false);
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(listWidgetCategories()).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'network'} on a network-level failure, never resolving", async () => {
    stubFetchRejecting(new TypeError("Failed to fetch"));

    await expect(listWidgetCategories("x")).rejects.toMatchObject({
      kind: "network",
    } satisfies Partial<AppError>);
  });
});

// openapi.yaml: GET /widget-categories?ids=1&ids=3 — "how a form or table gets the
// names of references it already holds". Repeated (exploded) parameter.
describe("getWidgetCategoriesByIds", () => {
  it("sends each id as a repeated ids parameter, with no search, and resolves with WidgetCategory[]", async () => {
    const widgetCategories: WidgetCategory[] = [
      { id: 1, name: "Alpha" },
      { id: 3, name: "Gamma" },
    ];
    const fetchMock = stubFetch(jsonResponse(widgetCategories, 200));

    const result = await getWidgetCategoriesByIds([1, 3]);

    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/widget-categories");
    expect(url.searchParams.getAll("ids")).toEqual(["1", "3"]);
    expect(url.searchParams.has("search")).toBe(false);
    expect(result).toEqual(widgetCategories);
  });

  it("resolves with [] for no ids without making a request (no ids would mean every category)", async () => {
    const fetchMock = stubFetch(jsonResponse([{ id: 1, name: "Alpha" }], 200));

    const result = await getWidgetCategoriesByIds([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(getWidgetCategoriesByIds([1])).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });
});
