// MSW request handlers implementing the Widgets/Categories contract from
// openapi.yaml against the in-memory store in ./data. This is what lets the
// whole UI run with no backend at all. See docs/BUILD-PLAN.md "Backend
// Decoupling".
import { http, HttpResponse } from "msw";
import {
  categories,
  getCurrentMockUser,
  isAuthenticated,
  isEmailRegistered,
  mockUser,
  MOCK_PASSWORD,
  nextWidgetId,
  registerMockUser,
  setAuthenticated,
  setCurrentMockUser,
  widgets,
} from "./data";
import type { components } from "../api/schema";

type Widget = components["schemas"]["Widget"];
type WidgetCreate = components["schemas"]["WidgetCreate"];
type LoginRequest = components["schemas"]["LoginRequest"];
type RegisterRequest = components["schemas"]["RegisterRequest"];
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
  http.post("*/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as Partial<RegisterRequest>;
    // Mirrors backend/app/routers/auth.py's register(): Pydantic-level
    // field validation, then the hand-raised duplicate-email check, both
    // landing on the same 422/{detail:[...]} shape.
    const issues: ValidationIssue[] = [];
    if (!body.name) issues.push({ loc: ["body", "name"], msg: "field required", type: "value_error.missing" });
    if (!body.email) issues.push({ loc: ["body", "email"], msg: "field required", type: "value_error.missing" });
    if (!body.password || body.password.length < 8) {
      issues.push({
        loc: ["body", "password"],
        msg: "ensure this value has at least 8 characters",
        type: "value_error.any_str.min_length",
      });
    }
    if (body.email && isEmailRegistered(body.email)) {
      issues.push({ loc: ["body", "email"], msg: "email already registered", type: "value_error.email_exists" });
    }
    if (issues.length > 0) {
      return HttpResponse.json({ detail: issues }, { status: 422 });
    }

    const user = registerMockUser(body.email!, body.name!);
    setAuthenticated(true);
    return HttpResponse.json(user);
  }),

  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    if (body.email !== mockUser.email || body.password !== MOCK_PASSWORD) {
      return HttpResponse.json({ detail: "Invalid email or password" }, { status: 401 });
    }
    setCurrentMockUser(mockUser);
    setAuthenticated(true);
    return HttpResponse.json(mockUser);
  }),

  http.post("*/api/auth/logout", () => {
    setAuthenticated(false);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/auth/me", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    return HttpResponse.json(getCurrentMockUser());
  }),

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
    // Repeated param (tags=a&tags=b), matching any of them — openapi.yaml.
    const tags = url.searchParams.getAll("tags");

    let result = widgets;
    if (status) result = result.filter((w) => w.status === status);
    if (categoryId) result = result.filter((w) => w.categoryId === Number(categoryId));
    if (search) result = result.filter((w) => w.name.toLowerCase().includes(search));
    if (tags.length > 0) result = result.filter((w) => w.tags.some((tag) => tags.includes(tag)));
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
    const widget: Widget = { assigneeEmail: null, ...input, tags: input.tags ?? [], id: nextWidgetId() };
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
