// TanStack Query hook backing the widget-form's async-search category
// combobox. See src/api/gateway/categories.ts (the ACL) for the wire
// translation.
import { useQuery } from '@tanstack/react-query'
import type { AppError } from '@/api/contracts'
import { listCategories } from '@/api/gateway/categories'
import type { components } from '@/api/schema'

type Category = components['schemas']['Category']

export function useCategoriesQuery(search: string) {
  return useQuery<Category[], AppError>({
    queryKey: ['categories', 'search', search],
    queryFn: () => listCategories(search),
    placeholderData: (previous) => previous,
  })
}
