// TanStack Query hooks for the Widgets resource. Consumes src/api/gateway/
// only — nothing here sees a wire-shaped response or calls fetch directly.
// See AGENTS.md's "NEVER fetch in useEffect" rule (this is the TanStack
// Query alternative).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRecordUpdate, type AppError, type Page, type QuerySpec } from '@tristan2828/ui-foundation'
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

// One widget's fields saved on their own, without the form: the table
// row's In Stock switch and the view's quick actions (status, In Stock,
// ticking checklist items). Optimistic in the detail and every list page,
// replaced by the widget the server returns, rolled back with a toast if
// it's refused; saves of one widget run in order, so quick changes don't
// lose each other (the foundation's useRecordUpdate). Call it once per
// control: `isPending` is that control's own save.
export function useSaveWidgetField(id: number) {
  return useRecordUpdate<Widget, WidgetUpdate>({
    id,
    detailKey: widgetsKeys.detail(id),
    listsKey: [...widgetsKeys.all, 'list'],
    update: updateWidget,
    name: (widget) => widget.name,
  })
}
