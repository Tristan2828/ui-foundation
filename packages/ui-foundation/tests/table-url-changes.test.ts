import { describe, expect, it } from "vitest";
import { activeViewOf, applyUrlChanges, viewToUrlChanges } from "../src/hooks/table-url-changes";

// The URL-building half of useTableUrlState, the part with semantics worth
// pinning. The hook itself only feeds these to setSearchParams in a single
// call per setter — that one-call rule is what makes setFilters() and
// applyView() safe, and it lives in the hook's comments rather than here
// (vitest runs in node, with no router to render).

const FILTERS = ["search", "status", "from", "to"] as const;
const MULTI = ["tags"] as const;

describe("applyUrlChanges", () => {
  it("changes several filters at once and keeps the params it wasn't given", () => {
    const next = applyUrlChanges(new URLSearchParams("search=mouse&page=3&other=keep"), {
      from: "2026-01-01",
      to: "2026-06-30",
      page: null,
    });
    expect(next.toString()).toBe("search=mouse&other=keep&from=2026-01-01&to=2026-06-30");
  });

  it("repeats a key for an array and removes it for null, '' or []", () => {
    const next = applyUrlChanges(new URLSearchParams("tags=a&status=x&search=y&page=2"), {
      tags: ["b", "c"],
      status: "",
      search: null,
    });
    expect(next.getAll("tags")).toEqual(["b", "c"]);
    expect(next.has("status")).toBe(false);
    expect(next.has("search")).toBe(false);
    expect(applyUrlChanges(next, { tags: [] }).has("tags")).toBe(false);
  });
});

describe("viewToUrlChanges", () => {
  const current = new URLSearchParams("search=mouse&status=draft&tags=bulky&sort=name:asc&page=4&other=keep");

  it("sets exactly the view's filters and sort, clearing every filter it doesn't name", () => {
    const view = viewToUrlChanges(FILTERS, MULTI, {
      filters: { status: "active" },
      multiFilters: { tags: ["fragile"] },
      sort: [{ id: "price", desc: true }],
    });
    const next = applyUrlChanges(current, view);
    expect(Object.fromEntries(next)).toEqual({
      status: "active",
      tags: "fragile",
      sort: "price:desc",
      other: "keep",
    });
  });

  it("an empty view resets filters, sort and page", () => {
    const next = applyUrlChanges(current, viewToUrlChanges(FILTERS, MULTI, {}));
    expect(next.toString()).toBe("other=keep");
  });
});

describe("activeViewOf", () => {
  const VIEWS = {
    all: { columns: ["name", "status"] },
    restock: { filters: { status: "active" }, multiFilters: { tags: ["fragile", "bulky"] }, columns: ["name"] },
    restockByPrice: { filters: { status: "active" }, multiFilters: { tags: ["fragile", "bulky"] }, sort: [{ id: "price", desc: false }] },
  };
  const NO_FILTERS = { search: "", status: "", from: "", to: "" };

  it("is the view whose filters the URL has exactly, multi filters in any order", () => {
    expect(activeViewOf(VIEWS, NO_FILTERS, { tags: [] })).toBe("all");
    expect(activeViewOf(VIEWS, { ...NO_FILTERS, status: "active" }, { tags: ["bulky", "fragile"] })).toBe("restock");
  });

  it("is null once any filter is added, changed or removed", () => {
    expect(activeViewOf(VIEWS, { ...NO_FILTERS, status: "active", search: "mouse" }, { tags: ["fragile", "bulky"] })).toBeNull();
    expect(activeViewOf(VIEWS, { ...NO_FILTERS, status: "draft" }, { tags: ["fragile", "bulky"] })).toBeNull();
    expect(activeViewOf(VIEWS, { ...NO_FILTERS, status: "active" }, { tags: ["fragile"] })).toBeNull();
    expect(activeViewOf(VIEWS, { ...NO_FILTERS, status: "active" }, { tags: ["fragile", "bulky", "bulky"] })).toBeNull();
  });

  it("ignores sort, and takes the first of two views with the same filters", () => {
    expect(activeViewOf({ restockByPrice: VIEWS.restockByPrice, restock: VIEWS.restock }, { ...NO_FILTERS, status: "active" }, { tags: ["fragile", "bulky"] })).toBe("restockByPrice");
  });

  it("is null with no views", () => {
    expect(activeViewOf({}, NO_FILTERS, { tags: [] })).toBeNull();
  });
});
