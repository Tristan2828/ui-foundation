// MSW request handlers implementing the Widgets/Categories contract from
// openapi.yaml against the in-memory store in ./data. This is what lets the
// whole UI run with no backend at all. See docs/BUILD-PLAN.md "Backend
// Decoupling".
import { http, HttpResponse } from "msw";
import { categories, nextWidgetId, widgets } from "./data";
import type { components } from "../api/schema";

type Widget = components["schemas"]["Widget"];
type WidgetCreate = components["schemas"]["WidgetCreate"];
type WidgetUpdate = components["schemas"]["WidgetUpdate"];
type ValidationIssue = components["schemas"]["ValidationErrorBody"]["detail"][number];

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
  if (input.categoryId !== undefined && !categories.some((c) => c.id === input.categoryId)) {
    issues.push({ loc: ["body", "categoryId"], msg: "category not found", type: "value_error.foreign_key" });
  }

  return issues;
}

function sortWidgets(list: Widget[], sort: string | null): Widget[] {
  if (!sort) return list;
  const [field, dir] = sort.split(":") as [keyof Widget, "asc" | "desc"];
  const sorted = [...list].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null || bv == null) return 0;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

export const handlers = [
  http.get("*/api/categories", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const result = search ? categories.filter((c) => c.name.toLowerCase().includes(search)) : categories;
    return HttpResponse.json(result.slice(0, limit));
  }),

  http.get("*/api/widgets", ({ request }) => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const status = url.searchParams.get("status");
    const categoryId = url.searchParams.get("categoryId");
    const search = url.searchParams.get("search")?.toLowerCase();

    let result = widgets;
    if (status) result = result.filter((w) => w.status === status);
    if (categoryId) result = result.filter((w) => w.categoryId === Number(categoryId));
    if (search) result = result.filter((w) => w.name.toLowerCase().includes(search));
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
    const widget: Widget = { assigneeEmail: null, ...input, id: nextWidgetId() };
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
