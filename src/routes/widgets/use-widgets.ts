// TanStack Query hooks for the Widgets resource. Consumes src/api/gateway/
// only — nothing here sees a wire-shaped response or calls fetch directly.
// See docs/BUILD-PLAN.md "Anti-Corruption Layer" and AGENTS.md's "NEVER
// fetch in useEffect" rule (this is the TanStack Query alternative).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppError, Page, QuerySpec } from '@/api/contracts'
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

export function useCreateWidgetMutation() {
  const queryClient = useQueryClient()
  return useMutation<Widget, AppError, WidgetCreate>({
    mutationFn: (input) => createWidget(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}

export function useUpdateWidgetMutation(id: number) {
  const queryClient = useQueryClient()
  return useMutation<Widget, AppError, WidgetUpdate>({
    mutationFn: (input) => updateWidget(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}

export function useDeleteWidgetMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, AppError, number>({
    mutationFn: (id) => deleteWidget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: widgetsKeys.all })
    },
  })
}
