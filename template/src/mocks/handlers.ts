// MSW request handlers implementing openapi.yaml against the in-memory
// store in ./data. This is what lets the whole UI run with no backend at all.
import { http, HttpResponse } from "msw";
import { authHandlers, environmentHandlers } from "@tristan2828/ui-foundation/mocks";
import { nextWidgetId, widgetCategories, widgets } from "./data";
import type { components } from "../api/schema";

type Widget = components["schemas"]["Widget"];
type WidgetCreate = components["schemas"]["WidgetCreate"];
type WidgetUpdate = components["schemas"]["WidgetUpdate"];
type ValidationIssue = components["schemas"]["ValidationErrorBody"]["detail"][number];
type WidgetTag = components["schemas"]["WidgetTag"];

const WIDGET_TAGS: readonly WidgetTag[] = ["fragile", "bulky", "seasonal", "featured"];

const REQUIRED_FIELDS = ["name", "categoryId", "status", "availableFrom", "price", "description"] as const;
const PRICE_RE = /^\d+\.\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateWidgetInput(
  input: Partial<WidgetCreate>,
  { partial }: { partial: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!partial) {
    for (const field of REQUIRED_FIELDS) {
      if (input[field] === undefined || input[field] === null || input[field] === "") {
        issues.push({ loc: ["body", field], msg: "field required", type: "value_error.missing" });
      }
    }
  }
  if (input.price !== undefined && !PRICE_RE.test(String(input.price))) {
    issues.push({
      loc: ["body", "price"],
      msg: 'string does not match regex "^\\d+\\.\\d{2}$"',
      type: "value_error.str.regex",
    });
  }
  if (input.tags !== undefined) {
    const tags = input.tags as unknown[];
    const valid = Array.isArray(tags) && tags.every((tag) => WIDGET_TAGS.includes(tag as WidgetTag));
    if (!valid) {
      issues.push({ loc: ["body", "tags"], msg: "value is not a valid enumeration member", type: "type_error.enum" });
    } else if (new Set(tags).size !== tags.length) {
      issues.push({ loc: ["body", "tags"], msg: "tags must be unique", type: "value_error.list.unique_items" });
    }
  }
  // inStock is a plain boolean (never null): an omitted one keeps its value
  // on PATCH and defaults to true on create; anything else is a 422.
  if (input.inStock !== undefined && typeof input.inStock !== "boolean") {
    issues.push({ loc: ["body", "inStock"], msg: "value is not a valid boolean", type: "type_error.bool" });
  }
  if (input.status !== undefined && !["draft", "active", "archived"].includes(String(input.status))) {
    issues.push({ loc: ["body", "status"], msg: "value is not a valid enumeration member", type: "type_error.enum" });
  }
  if (
    input.assigneeEmail !== undefined &&
    input.assigneeEmail !== null &&
    !EMAIL_RE.test(String(input.assigneeEmail))
  ) {
    issues.push({ loc: ["body", "assigneeEmail"], msg: "value is not a valid email address", type: "value_error.email" });
  }
  // Multi reference: a list of unique, existing category ids. null is a
  // 422 on PATCH (leaving it out keeps the set).
  if (input.extraCategoryIds !== undefined) {
    const ids = input.extraCategoryIds as unknown;
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
      issues.push({ loc: ["body", "extraCategoryIds"], msg: "value is not a valid list of ids", type: "type_error.list" });
    } else if (new Set(ids).size !== ids.length) {
      issues.push({ loc: ["body", "extraCategoryIds"], msg: "extraCategoryIds must be unique", type: "value_error.list.unique_items" });
    } else if (!ids.every((id) => widgetCategories.some((c) => c.id === id))) {
      issues.push({ loc: ["body", "extraCategoryIds"], msg: "unknown category ids", type: "value_error.foreign_key" });
    }
  }
  // Sub-records: an ordered list of {text, done}, at most 50. A problem in
  // one item is keyed by its path, e.g. ["body", "checklist", 2, "text"].
  if (input.checklist !== undefined) {
    const items = input.checklist as unknown;
    if (!Array.isArray(items)) {
      issues.push({ loc: ["body", "checklist"], msg: "value is not a valid list", type: "type_error.list" });
    } else if (items.length > 50) {
      issues.push({ loc: ["body", "checklist"], msg: "List should have at most 50 items", type: "too_long" });
    } else {
      items.forEach((item, index) => {
        const text = typeof item?.text === "string" ? item.text.trim() : "";
        if (text.length < 1 || text.length > 300) {
          issues.push({ loc: ["body", "checklist", index, "text"], msg: "Text must be 1–300 characters", type: "string_too_short" });
        }
        if (typeof item?.done !== "boolean") {
          issues.push({ loc: ["body", "checklist", index, "done"], msg: "value is not a valid boolean", type: "bool_type" });
        }
      });
    }
  }
  if (input.categoryId !== undefined && !widgetCategories.some((c) => c.id === input.categoryId)) {
    issues.push({ loc: ["body", "categoryId"], msg: "category not found", type: "value_error.foreign_key" });
  }

  return issues;
}

// The backend trims item text before storing it; so do the mocks.
function trimChecklist(items: Widget["checklist"]): Widget["checklist"] {
  return items.map((item) => ({ text: item.text.trim(), done: item.done }));
}

// The computed, read-only checklistState (openapi.yaml): worked out from
// the checklist on every write, never taken from the request.
function checklistStateOf(checklist: Widget["checklist"]): Widget["checklistState"] {
  if (checklist.length === 0) return "none";
  return checklist.some((item) => !item.done) ? "open" : "complete";
}

// checklistState sorts in its enum order, not alphabetically.
const CHECKLIST_STATE_ORDER: Record<Widget["checklistState"], number> = { none: 0, open: 1, complete: 2 };

function sortWidgets(list: Widget[], sort: string | null): Widget[] {
  if (!sort) return list;
  const [field, dir] = sort.split(":") as [keyof Widget, "asc" | "desc"];
  const sorted = [...list].sort((a, b) => {
    const av = field === "checklistState" ? CHECKLIST_STATE_ORDER[a.checklistState] : a[field];
    const bv = field === "checklistState" ? CHECKLIST_STATE_ORDER[b.checklistState] : b[field];
    if (av == null || bv == null) return 0;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

export const handlers = [
  // /auth/* and /environment — the foundation's contract, mocked by the
  // foundation (/environment answers null: mock data is MockModeBanner's).
  ...authHandlers,
  ...environmentHandlers,

  http.get("*/api/widget-categories", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? 20);
    // Repeated ids=1&ids=3: exactly those, unknown ones left out (openapi.yaml).
    const ids = url.searchParams.getAll("ids").map(Number);
    let result = search ? widgetCategories.filter((c) => c.name.toLowerCase().includes(search)) : widgetCategories;
    if (ids.length > 0) result = result.filter((c) => ids.includes(c.id));
    return HttpResponse.json(result.slice(0, limit));
  }),

  http.get("*/api/widgets", ({ request }) => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const status = url.searchParams.get("status");
    const categoryId = url.searchParams.get("categoryId");
    const search = url.searchParams.get("search")?.toLowerCase();
    // Repeated param (tags=a&tags=b), matching any of them — openapi.yaml.
    const tags = url.searchParams.getAll("tags");
    // "true" or "false"; absent means either (openapi.yaml).
    const inStock = url.searchParams.get("inStock");
    const checklistState = url.searchParams.get("checklistState");
    // Repeated, any of them (openapi.yaml).
    const extraCategoryIds = url.searchParams.getAll("extraCategoryIds").map(Number);

    let result = widgets;
    if (status) result = result.filter((w) => w.status === status);
    if (categoryId) result = result.filter((w) => w.categoryId === Number(categoryId));
    if (search) result = result.filter((w) => w.name.toLowerCase().includes(search));
    if (tags.length > 0) result = result.filter((w) => w.tags.some((tag) => tags.includes(tag)));
    if (inStock === "true" || inStock === "false") {
      result = result.filter((w) => w.inStock === (inStock === "true"));
    }
    if (checklistState) result = result.filter((w) => w.checklistState === checklistState);
    if (extraCategoryIds.length > 0) {
      result = result.filter((w) => w.extraCategoryIds.some((id) => extraCategoryIds.includes(id)));
    }
    result = sortWidgets(result, url.searchParams.get("sort"));

    const total = result.length;
    const items = result.slice(offset, offset + limit);
    return HttpResponse.json({ items, total });
  }),

  http.get("*/api/widgets/:id", ({ params }) => {
    const widget = widgets.find((w) => w.id === Number(params.id));
    if (!widget) {
      return HttpResponse.json({ detail: `Widget ${params.id} not found` }, { status: 404 });
    }
    return HttpResponse.json(widget);
  }),

  http.post("*/api/widgets", async ({ request }) => {
    const input = (await request.json()) as WidgetCreate;
    const issues = validateWidgetInput(input, { partial: false });
    if (issues.length > 0) {
      return HttpResponse.json({ detail: issues }, { status: 422 });
    }
    const widget: Widget = {
      assigneeEmail: null,
      ...input,
      tags: input.tags ?? [],
      inStock: input.inStock ?? true,
      extraCategoryIds: [...(input.extraCategoryIds ?? [])].sort((a, b) => a - b),
      checklist: trimChecklist(input.checklist ?? []),
      id: nextWidgetId(),
      // Last, so a client-sent checklistState can't survive the spread.
      checklistState: checklistStateOf(input.checklist ?? []),
    };
    widgets.push(widget);
    return HttpResponse.json(widget, { status: 201 });
  }),

  http.patch("*/api/widgets/:id", async ({ request, params }) => {
    const widget = widgets.find((w) => w.id === Number(params.id));
    if (!widget) {
      return HttpResponse.json({ detail: `Widget ${params.id} not found` }, { status: 404 });
    }
    const input = (await request.json()) as WidgetUpdate;
    const issues = validateWidgetInput(input, { partial: true });
    if (issues.length > 0) {
      return HttpResponse.json({ detail: issues }, { status: 422 });
    }
    Object.assign(widget, input);
    // Read back in ascending id order, like the backend.
    if (input.extraCategoryIds) widget.extraCategoryIds = [...input.extraCategoryIds].sort((a, b) => a - b);
    if (input.checklist) widget.checklist = trimChecklist(input.checklist);
    // Recomputed after every write, and never taken from the request.
    // (readOnly in the generated type, since only the server sets it.)
    Object.assign(widget, { checklistState: checklistStateOf(widget.checklist) });
    return HttpResponse.json(widget);
  }),

  http.delete("*/api/widgets/:id", ({ params }) => {
    const index = widgets.findIndex((w) => w.id === Number(params.id));
    if (index === -1) {
      return HttpResponse.json({ detail: `Widget ${params.id} not found` }, { status: 404 });
    }
    widgets.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
