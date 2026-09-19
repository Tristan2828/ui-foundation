// Anti-corruption layer for the Widgets resource. Translates between the
// wire shapes in openapi.yaml (offset/limit, {items,total}, FastAPI-style
// error bodies) and the UI-owned contracts in src/api/contracts.ts. Nothing
// above this module may see a wire-shaped response — see
// docs/BUILD-PLAN.md "Anti-Corruption Layer".
import type { Page, QuerySpec } from "../contracts";
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type Widget = components["schemas"]["Widget"];
type WidgetCreate = components["schemas"]["WidgetCreate"];
type WidgetUpdate = components["schemas"]["WidgetUpdate"];
type WidgetListResponse = components["schemas"]["WidgetListResponse"];

function buildListQuery(query: QuerySpec): string {
  const params = new URLSearchParams();
  const offset = (query.page - 1) * query.pageSize;
  params.set("offset", String(offset));
  params.set("limit", String(query.pageSize));
  if (query.sort) {
    params.set("sort", `${query.sort.field}:${query.sort.dir}`);
  }
  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (Array.isArray(value)) {
        // Multi-value filters repeat the parameter (style: form, explode:
        // true in openapi.yaml) — tags=a&tags=b, never "a,b". An empty
        // array means "no filter", so it sends nothing.
        for (const item of value) params.append(key, String(item));
      } else if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
  }
  return params.toString();
}

export async function listWidgets(query: QuerySpec): Promise<Page<Widget>> {
  const res = await safeFetch(`/widgets?${buildListQuery(query)}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  const body = res.body as WidgetListResponse;
  return { items: body.items, total: body.total, page: query.page, pageSize: query.pageSize };
}

export async function getWidget(id: number): Promise<Widget> {
  const res = await safeFetch(`/widgets/${id}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as Widget;
}

export async function createWidget(input: WidgetCreate): Promise<Widget> {
  const res = await safeFetch("/widgets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status !== 201) throw toAppError(res.status, res.body);
  return res.body as Widget;
}

export async function updateWidget(id: number, input: WidgetUpdate): Promise<Widget> {
  const res = await safeFetch(`/widgets/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as Widget;
}

export async function deleteWidget(id: number): Promise<void> {
  const res = await safeFetch(`/widgets/${id}`, { method: "DELETE" });
  if (res.status !== 204) throw toAppError(res.status, res.body);
}
