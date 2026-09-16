// Gateway contract tests for src/api/gateway/categories.ts — written
// TDD-style, ahead of the implementation. Derived only from openapi.yaml,
// src/api/contracts.ts and src/api/schema.d.ts. Do NOT make these pass by
// reading the (nonexistent) gateway implementation.
//
// These tests are EXPECTED to fail right now with a "cannot find module"
// style error, because src/api/gateway/categories.ts does not exist yet.

import { afterEach, describe, expect, it, vi } from "vitest";
import { listCategories } from "../../src/api/gateway/categories";
import type { AppError } from "../../src/api/contracts";
import type { components } from "../../src/api/schema";

type Category = components["schemas"]["Category"];

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

describe("listCategories", () => {
  it("passes the search param through and resolves with a plain Category[] (no pagination wrapper)", async () => {
    const categories: Category[] = [
      { id: 1, name: "Alpha" },
      { id: 2, name: "Beta" },
    ];
    const fetchMock = stubFetch(jsonResponse(categories, 200));

    const result = await listCategories("al");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/categories");
    expect(url.searchParams.get("search")).toBe("al");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(categories);
  });

  it("omits the search param when called with no argument", async () => {
    const fetchMock = stubFetch(jsonResponse([], 200));

    await listCategories();

    const url = calledUrl(fetchMock);
    expect(url.searchParams.has("search")).toBe(false);
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(listCategories()).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'network'} on a network-level failure, never resolving", async () => {
    stubFetchRejecting(new TypeError("Failed to fetch"));

    await expect(listCategories("x")).rejects.toMatchObject({
      kind: "network",
    } satisfies Partial<AppError>);
  });
});
