// Anti-corruption layer for the Categories resource (used by the widget
// form's async-search combobox).
import type { components } from "../schema";
import { safeFetch, toAppError } from "@tristan2828/ui-foundation/gateway";

type Category = components["schemas"]["Category"];

export async function listCategories(search?: string): Promise<Category[]> {
  const params = new URLSearchParams();
  if (search !== undefined) params.set("search", search);
  const qs = params.toString();
  const res = await safeFetch(`/categories${qs ? `?${qs}` : ""}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as Category[];
}

// Exactly these categories (GET /categories?ids=1&ids=3), for naming
// references a widget already holds: a multi-reference field's chips and
// table badges. No ids means nothing to name, so no request: an empty
// `ids` would otherwise read as "every category".
export async function getCategoriesByIds(ids: readonly number[]): Promise<Category[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams();
  for (const id of ids) params.append("ids", String(id));
  const res = await safeFetch(`/categories?${params.toString()}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as Category[];
}
