// Anti-corruption layer for the Categories resource (used by the widget
// form's async-search combobox). See docs/BUILD-PLAN.md "Anti-Corruption
// Layer".
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type Category = components["schemas"]["Category"];

export async function listCategories(search?: string): Promise<Category[]> {
  const params = new URLSearchParams();
  if (search !== undefined) params.set("search", search);
  const qs = params.toString();
  const res = await safeFetch(`/categories${qs ? `?${qs}` : ""}`);
  if (res.status !== 200) throw toAppError(res.status, res.body);
  return res.body as Category[];
}
