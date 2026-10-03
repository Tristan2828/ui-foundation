// Anti-corruption layer for the WidgetCategories resource (used by the widget
// form's async-search combobox).
import type { components } from "../schema";
import { safeFetch, toAppError } from "@tristan2828/ui-foundation/gateway";

type WidgetCategory = components["schemas"]["WidgetCategory"];

export async function listWidgetCategories(search?: string): Promise<WidgetCategory[]> {
  const params = new URLSearchParams();
  if (search !== undefined) params.set("search", search);
  const qs = params.toString();
  const res = await safeFetch(`/widget-categories${qs ? `?${qs}` : ""}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as WidgetCategory[];
}

// Exactly these categories (GET /widget-categories?ids=1&ids=3), for naming
// references a widget already holds: a multi-reference field's chips and
// table badges. No ids means nothing to name, so no request: an empty
// `ids` would otherwise read as "every category".
export async function getWidgetCategoriesByIds(ids: readonly number[]): Promise<WidgetCategory[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams();
  for (const id of ids) params.append("ids", String(id));
  const res = await safeFetch(`/widget-categories?${params.toString()}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as WidgetCategory[];
}
