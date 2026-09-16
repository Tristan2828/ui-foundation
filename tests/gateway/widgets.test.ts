// Gateway contract tests for src/api/gateway/widgets.ts — written TDD-style,
// ahead of the implementation. Derived only from openapi.yaml,
// src/api/contracts.ts and src/api/schema.d.ts. Do NOT make these pass by
// reading the (nonexistent) gateway implementation.
//
// These tests are EXPECTED to fail right now with a "cannot find module"
// style error, because src/api/gateway/widgets.ts does not exist yet.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWidgets,
  getWidget,
  createWidget,
  updateWidget,
  deleteWidget,
} from "../../src/api/gateway/widgets";
import type { AppError, Page, QuerySpec } from "../../src/api/contracts";
import type { components } from "../../src/api/schema";

type Widget = components["schemas"]["Widget"];
type WidgetCreate = components["schemas"]["WidgetCreate"];
type WidgetUpdate = components["schemas"]["WidgetUpdate"];
type WidgetListResponse = components["schemas"]["WidgetListResponse"];

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 1,
    name: "Test Widget",
    categoryId: 10,
    status: "active",
    availableFrom: "2026-01-01T00:00:00Z",
    assigneeEmail: null,
    price: "19.99",
    description: "A widget",
    ...overrides,
  };
}

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
  // The gateway may call fetch with a string, a URL, or a Request — coerce
  // to a URL against a dummy origin so relative "/api/..." paths parse.
  return new URL(String(urlArg), "http://localhost");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listWidgets", () => {
  it("translates QuerySpec to wire query params and normalizes {items,total} into Page<T>", async () => {
    const wireBody: WidgetListResponse = {
      items: [makeWidget({ id: 1 }), makeWidget({ id: 2 })],
      total: 42,
    };
    const fetchMock = stubFetch(jsonResponse(wireBody, 200));

    const query: QuerySpec = {
      page: 3,
      pageSize: 20,
      sort: { field: "name", dir: "asc" },
      filters: { status: "active", categoryId: 10, search: "foo" },
    };

    const result = await listWidgets(query);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/widgets");
    // offset = (page-1)*pageSize = (3-1)*20 = 40
    expect(url.searchParams.get("offset")).toBe("40");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("sort")).toBe("name:asc");
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.get("categoryId")).toBe("10");
    expect(url.searchParams.get("search")).toBe("foo");

    const expected: Page<Widget> = {
      items: wireBody.items,
      total: 42,
      page: 3,
      pageSize: 20,
    };
    expect(result).toEqual(expected);
  });

  it("computes offset 0 for page 1 and omits sort when QuerySpec.sort is undefined", async () => {
    const fetchMock = stubFetch(jsonResponse({ items: [], total: 0 }, 200));

    await listWidgets({ page: 1, pageSize: 20 });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.has("sort")).toBe(false);
  });

  it("throws AppError{kind:'network'} on a network-level failure, never resolving", async () => {
    stubFetchRejecting(new TypeError("Failed to fetch"));

    await expect(listWidgets({ page: 1, pageSize: 20 })).rejects.toMatchObject({
      kind: "network",
    } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'auth'} on 401", async () => {
    stubFetch(jsonResponse({ detail: "Not authenticated" }, 401));

    await expect(listWidgets({ page: 1, pageSize: 20 })).rejects.toMatchObject({
      kind: "auth",
    } satisfies Partial<AppError>);
  });
});

describe("getWidget", () => {
  it("requests /api/widgets/{id} and resolves with the plain Widget", async () => {
    const widget = makeWidget({ id: 7 });
    const fetchMock = stubFetch(jsonResponse(widget, 200));

    const result = await getWidget(7);

    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/widgets/7");
    expect(result).toEqual(widget);
  });

  it("throws AppError{kind:'notfound'} on 404, using the detail string as the message", async () => {
    stubFetch(jsonResponse({ detail: "Widget 999 not found" }, 404));

    await expect(getWidget(999)).rejects.toMatchObject({
      kind: "notfound",
      message: "Widget 999 not found",
    } satisfies Partial<AppError>);
  });
});

describe("createWidget", () => {
  const input: WidgetCreate = {
    name: "",
    categoryId: 1,
    status: "draft",
    availableFrom: "2026-01-01T00:00:00Z",
    price: "bad",
    description: "x",
  };

  it("POSTs the input as JSON and resolves with the created Widget on 201", async () => {
    const created = makeWidget({ id: 99, name: "New Widget" });
    const fetchMock = stubFetch(jsonResponse(created, 201));

    const result = await createWidget({ ...input, name: "New Widget", price: "9.99" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(result).toEqual(created);
  });

  it("throws AppError{kind:'validation'} with fieldErrors keyed by the last loc segment, grouping repeated fields, on 422", async () => {
    const body = {
      detail: [
        { loc: ["body", "name"], msg: "field required", type: "value_error.missing" },
        {
          loc: ["body", "price"],
          msg: "string does not match regex",
          type: "value_error.str.regex",
        },
        { loc: ["body", "price"], msg: "another price issue", type: "value_error" },
      ],
    };
    stubFetch(jsonResponse(body, 422));

    let caught: AppError | undefined;
    try {
      await createWidget(input);
      expect.unreachable("createWidget should have thrown");
    } catch (err) {
      caught = err as AppError;
    }

    expect(caught?.kind).toBe("validation");
    expect(caught?.fieldErrors).toEqual({
      name: ["field required"],
      price: ["string does not match regex", "another price issue"],
    });
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(createWidget(input)).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });
});

describe("updateWidget", () => {
  const patch: WidgetUpdate = { name: "Renamed" };

  it("PATCHes /api/widgets/{id} and resolves with the updated Widget", async () => {
    const updated = makeWidget({ id: 3, name: "Renamed" });
    const fetchMock = stubFetch(jsonResponse(updated, 200));

    const result = await updateWidget(3, patch);

    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/widgets/3");
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("PATCH");
    expect(result).toEqual(updated);
  });

  it("throws AppError{kind:'notfound'} on 404", async () => {
    stubFetch(jsonResponse({ detail: "Widget 3 not found" }, 404));

    await expect(updateWidget(3, patch)).rejects.toMatchObject({
      kind: "notfound",
    } satisfies Partial<AppError>);
  });
});

describe("deleteWidget", () => {
  it("resolves without throwing on 204 with no body", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(deleteWidget(1)).resolves.toBeUndefined();
  });

  it("throws AppError{kind:'notfound'} on 404", async () => {
    stubFetch(jsonResponse({ detail: "Widget 1 not found" }, 404));

    await expect(deleteWidget(1)).rejects.toMatchObject({
      kind: "notfound",
    } satisfies Partial<AppError>);
  });

  it("throws AppError{kind:'server'} on 500", async () => {
    stubFetch(jsonResponse({ detail: "Internal Server Error" }, 500));

    await expect(deleteWidget(1)).rejects.toMatchObject({
      kind: "server",
    } satisfies Partial<AppError>);
  });
});
