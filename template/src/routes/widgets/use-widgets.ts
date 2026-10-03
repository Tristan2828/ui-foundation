// TanStack Query hooks for the Widgets resource. Consumes src/api/gateway/
// only — nothing here sees a wire-shaped response or calls fetch directly.
// See AGENTS.md's "NEVER fetch in useEffect" rule (this is the TanStack
// Query alternative).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppError, Page, QuerySpec } from '@tristan2828/ui-foundation'
import {
  createWidget,
  deleteWidget,
  getWidget,
  listWidgets,
  updateWidget,
} from '@/api/gateway/widgets'
import type { components } from '@/api/schema'

type Widget = components['schemas']['Widget']
type WidgetCreate = components['schemas']['WidgetCreate']
type WidgetUpdate = components['schemas']['WidgetUpdate']

const widgetsKeys = {
  all: ['widgets'] as const,
  list: (query: QuerySpec) => [...widgetsKeys.all, 'list', query] as const,
  detail: (id: number) => [...widgetsKeys.all, 'detail', id] as const,
}

export function useWidgetsQuery(query: QuerySpec) {
  return useQuery<Page<Widget>, AppError>({
    queryKey: widgetsKeys.list(query),
    queryFn: () => listWidgets(query),
    // Keeps the previous page's rows on screen while a new page/sort/filter
    // is loading, instead of flashing the skeleton on every change — the
    // skeleton is reserved for the true first load. See e2e/widgets-table.spec.ts
    // "loading" test, which delays the *initial* request.
    placeholderData: keepPreviousData,
  })
}

export function useWidgetQuery(id: number, options?: { enabled?: boolean }) {
  return useQuery<Widget, AppError>({
    queryKey: widgetsKeys.detail(id),
    queryFn: () => getWidget(id),
    enabled: options?.enabled ?? true,
  })
}

// Create and update both land on the widget's view, so the saved widget
// goes straight into its detail cache: the view shows what was saved at
// once, rather than the copy from before the edit until a refetch lands.
export function useCreateWidgetMutation() {
  const queryClient = useQueryClient()
  return useMutation<Widget, AppError, WidgetCreate>({
    mutationFn: (input) => createWidget(input),
    onSuccess: (widget) => {
      queryClient.setQueryData(widgetsKeys.detail(widget.id), widget)
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}

export function useUpdateWidgetMutation(id: number) {
  const queryClient = useQueryClient()
  return useMutation<Widget, AppError, WidgetUpdate>({
    mutationFn: (input) => updateWidget(id, input),
    onSuccess: (widget) => {
      queryClient.setQueryData(widgetsKeys.detail(id), widget)
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}

export function useDeleteWidgetMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, AppError, number>({
    mutationFn: (id) => deleteWidget(id),
    onSuccess: (_result, id) => {
      // Dropped, not refetched: the view still on screen would otherwise
      // fetch the deleted widget and flash "Not found" while it leaves.
      queryClient.removeQueries({ queryKey: widgetsKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}

// A yes/no flipped straight from a table row: saves on its own (a PATCH of
// that one field) instead of through the form. Optimistic: every cached
// list page shows the new value at once, and goes back if the save fails.
// Afterwards the lists refetch, so a filter on the field (In stock only)
// drops the row once the server agrees.
export function useToggleWidgetInStockMutation() {
  const queryClient = useQueryClient()
  type Snapshot = [readonly unknown[], Page<Widget> | undefined][]
  return useMutation<Widget, AppError, { id: number; inStock: boolean }, { snapshot: Snapshot }>({
    mutationFn: ({ id, inStock }) => updateWidget(id, { inStock }),
    onMutate: async ({ id, inStock }) => {
      const lists = { queryKey: [...widgetsKeys.all, 'list'] }
      await queryClient.cancelQueries(lists)
      const snapshot = queryClient.getQueriesData<Page<Widget>>(lists)
      queryClient.setQueriesData<Page<Widget>>(lists, (page) =>
        page && {
          ...page,
          items: page.items.map((widget) => (widget.id === id ? { ...widget, inStock } : widget)),
        },
      )
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, page] of context?.snapshot ?? []) queryClient.setQueryData(queryKey, page)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}
