// TanStack Query hook backing the widget-form's async-search category
// combobox. See src/api/gateway/widget-categories.ts (the ACL) for the wire
// translation.
import { useQuery } from '@tanstack/react-query'
import type { AppError } from '@tristan2828/ui-foundation'
import { getWidgetCategoriesByIds, listWidgetCategories } from '@/api/gateway/widget-categories'
import type { components } from '@/api/schema'

type WidgetCategory = components['schemas']['WidgetCategory']

export function useWidgetCategoriesQuery(search: string) {
  return useQuery<WidgetCategory[], AppError>({
    queryKey: ['widget-categories', 'search', search],
    queryFn: () => listWidgetCategories(search),
    placeholderData: (previous) => previous,
  })
}

// Names for exactly these category ids (GET /widget-categories?ids=...): the chips
// of a multi-reference field and the names in its table column, whether or
// not they match any search. Sorted into the key so the same set is one
// cache entry in any order.
export function useWidgetCategoriesByIdsQuery(ids: readonly number[]) {
  const sorted = [...new Set(ids)].sort((a, b) => a - b)
  return useQuery<WidgetCategory[], AppError>({
    queryKey: ['widget-categories', 'ids', sorted],
    queryFn: () => getWidgetCategoriesByIds(sorted),
    placeholderData: (previous) => previous,
  })
}

// id → name from any number of category lists (search results, a by-ids
// lookup), for getLabel and table cells.
export function widgetCategoryNames(...lists: (WidgetCategory[] | undefined)[]): Map<number, string> {
  const names = new Map<number, string>()
  for (const list of lists) for (const category of list ?? []) names.set(category.id, category.name)
  return names
}
