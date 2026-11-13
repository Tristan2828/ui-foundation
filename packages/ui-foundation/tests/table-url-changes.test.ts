import { describe, expect, it } from "vitest";
import { activeViewOf, applyUrlChanges, filterChanges, readFilterState, viewToUrlChanges } from "../src/hooks/table-url-changes";

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

  it("sets a view's grouping ('' turns it off) and keeps the one on when the view names none", () => {
    const grouped = new URLSearchParams("group=status&page=2");
    expect(applyUrlChanges(grouped, viewToUrlChanges(FILTERS, MULTI, { group: "area" })).get("group")).toBe("area");
    expect(applyUrlChanges(grouped, viewToUrlChanges(FILTERS, MULTI, { group: "" })).has("group")).toBe(false);
    expect(applyUrlChanges(grouped, viewToUrlChanges(FILTERS, MULTI, {})).get("group")).toBe("status");
  });

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

// Views fill the filters (4.105): the default view at the plain address,
// a view's rule that no control shows, and a hand change that keeps what
// the bar shows.
describe("views fill the filters", () => {
  const F = ["search", "overdue"] as const;
  const M = ["status"] as const;
  const OPEN = ["open", "waiting"];
  const views = {
    open: { label: "Open", multiFilters: { status: OPEN } },
    overdue: { label: "Overdue", rule: { overdue: "true" }, multiFilters: { status: OPEN } },
    all: { label: "All", multiFilters: { status: ["open", "waiting", "closed"] } },
  };
  const at = (query: string, withDefault = true) =>
    readFilterState(new URLSearchParams(query), F, M, withDefault ? views.open : undefined);

  it("fills the bar with the default view's filters at the plain address, and it's the active view", () => {
    const state = at("");
    expect(state.atDefault).toBe(true);
    expect(state.multiFilters.status).toEqual(OPEN);
    expect(activeViewOf(views, state.filters, state.multiFilters)).toBe("open");
    // Sort and page aren't filters: still the plain address.
    expect(at("sort=name:asc&page=2").atDefault).toBe(true);
    // Any filter in the URL, or ?view=none, is the URL's own.
    expect(at("search=x").multiFilters.status).toEqual([]);
    expect(at("view=none").atDefault).toBe(false);
    // With no default view the plain address is no filters, as before.
    expect(at("", false).multiFilters.status).toEqual([]);
  });

  it("counts a view's rule toward it being on", () => {
    const state = at("overdue=true&status=open&status=waiting");
    expect(activeViewOf(views, state.filters, state.multiFilters)).toBe("overdue");
    const without = at("status=open&status=waiting");
    expect(activeViewOf(views, without.filters, without.multiFilters)).toBe("open");
  });

  it("writes the rule into the URL when the view is pressed, and the default view as the plain address", () => {
    const next = applyUrlChanges(new URLSearchParams("view=none&search=x"), viewToUrlChanges(F, M, views.overdue));
    expect(next.toString()).toBe("overdue=true&status=open&status=waiting");
    const home = applyUrlChanges(next, viewToUrlChanges(F, M, views.open, true));
    expect(home.toString()).toBe("");
  });

  it("keeps the default view's filters when one changes by hand, and the pill follows", () => {
    const state = at("");
    const next = applyUrlChanges(new URLSearchParams(), filterChanges(state, { search: "pump" }, ["overdue"], true));
    expect(next.getAll("status")).toEqual(OPEN);
    expect(next.get("search")).toBe("pump");
    const after = readFilterState(next, F, M, views.open);
    expect(activeViewOf(views, after.filters, after.multiFilters)).toBeNull();
    // Ticking every status by hand is the All view.
    const all = applyUrlChanges(next, filterChanges(after, { search: "", status: ["open", "waiting", "closed"] }, ["overdue"], true));
    const allState = readFilterState(all, F, M, views.open);
    expect(activeViewOf(views, allState.filters, allState.multiFilters)).toBe("all");
  });

  it("clears a view's rule on a hand change, so the rows are what the bar shows", () => {
    const on = new URLSearchParams("overdue=true&status=open&status=waiting&page=3");
    const state = readFilterState(on, F, M, views.open);
    const next = applyUrlChanges(on, filterChanges(state, { status: ["open"] }, ["overdue"], true));
    expect(next.toString()).toBe("status=open");
    // Unless the change sets it itself.
    const kept = applyUrlChanges(on, filterChanges(state, { overdue: "true", status: ["open"] }, ["overdue"], true));
    expect(kept.get("overdue")).toBe("true");
  });

  it("writes ?view=none when the last filter is cleared by hand, so the default view doesn't come back", () => {
    const state = readFilterState(new URLSearchParams("status=open"), F, M, views.open);
    const next = applyUrlChanges(new URLSearchParams("status=open"), filterChanges(state, { status: [] }, [], true));
    expect(next.toString()).toBe("view=none");
    expect(readFilterState(next, F, M, views.open).multiFilters.status).toEqual([]);
    // Setting a filter again drops it; with no default view it's never written.
    expect(applyUrlChanges(next, filterChanges(readFilterState(next, F, M, views.open), { search: "a" }, [], true)).toString()).toBe("search=a");
    expect(filterChanges(state, { status: [] }, [], false)).not.toHaveProperty("view");
  });

  it("leaves a list's own filter named view alone when the list has no default view", () => {
    const own = ["view"] as const;
    const params = new URLSearchParams("view=grid");
    expect(applyUrlChanges(params, viewToUrlChanges(own, [], { filters: { view: "list" } })).get("view")).toBe("list");
    const state = readFilterState(params, own, []);
    expect(applyUrlChanges(params, filterChanges(state, { other: "x" }, [], false)).get("view")).toBe("grid");
  });
});
