// TanStack Query hook backing the widget-form's async-search category
// combobox. See src/api/gateway/categories.ts (the ACL) for the wire
// translation.
import { useQuery } from '@tanstack/react-query'
import type { AppError } from '@tristan2828/ui-foundation'
import { getCategoriesByIds, listCategories } from '@/api/gateway/categories'
import type { components } from '@/api/schema'

type Category = components['schemas']['Category']

export function useCategoriesQuery(search: string) {
  return useQuery<Category[], AppError>({
    queryKey: ['categories', 'search', search],
    queryFn: () => listCategories(search),
    placeholderData: (previous) => previous,
  })
}

// Names for exactly these category ids (GET /categories?ids=...): the chips
// of a multi-reference field and the names in its table column, whether or
// not they match any search. Sorted into the key so the same set is one
// cache entry in any order.
export function useCategoriesByIdsQuery(ids: readonly number[]) {
  const sorted = [...new Set(ids)].sort((a, b) => a - b)
  return useQuery<Category[], AppError>({
    queryKey: ['categories', 'ids', sorted],
    queryFn: () => getCategoriesByIds(sorted),
    placeholderData: (previous) => previous,
  })
}

// id → name from any number of category lists (search results, a by-ids
// lookup), for getLabel and table cells.
export function categoryNames(...lists: (Category[] | undefined)[]): Map<number, string> {
  const names = new Map<number, string>()
  for (const list of lists) for (const category of list ?? []) names.set(category.id, category.name)
  return names
}
