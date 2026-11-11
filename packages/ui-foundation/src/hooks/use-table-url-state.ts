import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import type { SortingState } from '@/components/app/data-table'
import {
  activeViewOf,
  applyUrlChanges,
  serializeSort,
  viewToUrlChanges,
  type TableView,
  type UrlChanges,
} from './table-url-changes'
import { browserStore } from './use-table-layout'

export type TableUrlStateOptions = {
  /**
   * Where the table's grouping (DataTable's `grouping`) is remembered on
   * this device, one key per table (`"my-app:tasks:group"`), the way
   * useTableLayout remembers a layout. Without one it lives only in the URL.
   */
  groupStorageKey?: string
  /**
   * The rows-per-page choices, for DataTable's `pageSizes`: `[25, 50, 100]`
   * unless set. A size from the URL or storage that isn't one of them is
   * ignored.
   */
  pageSizes?: readonly number[]
  /** The rows per page until one is picked: 50 unless set (one of `pageSizes`). */
  defaultPageSize?: number
  /**
   * Where the rows per page are remembered on this device, one key per table
   * (`"my-app:tasks:page-size"`). Without one the pick lives only in the URL.
   */
  pageSizeStorageKey?: string
}

const DEFAULT_PAGE_SIZES = [25, 50, 100] as const

// A table's page, sort and filters, kept in the URL query string
// (`?page=2&sort=name:asc&search=mouse&tags=fragile&tags=bulky`) instead of
// component state, so they survive going to the edit form and back, a
// refresh, or a shared link. Every update replaces the history entry rather
// than pushing one — typing in a search box shouldn't fill the back button.
//
// Single-value filters are strings ('' when unset). Multi-value filters
// (multi-choice fields) are string arrays, repeated in the URL the same way
// the API takes them. Changing the sort or any filter returns to page 1.
//
// `views` are the table's saved views, by id. `activeView` is the id of the
// one the current filters are, or null (activeViewOf() says when a view
// counts as active); pass that view's `columns` to DataTable. A view is
// pressed with applyView().
//
// `pageSize` is the rows per page, for the query and DataTable: `?size=` in
// the URL, then the one remembered under `pageSizeStorageKey`, then
// `defaultPageSize`; `setPageSize` (DataTable's `onPageSizeChange`) picks
// one and returns to page 1. `pageSizes` is the menu's choices.
//
// `grouping` is DataTable's: a grouping's id, or '' for None. It's
// `?group=` in the URL, then the one remembered under `groupStorageKey`,
// then None. Like the sort it doesn't change which rows are shown, so it
// keeps the page and doesn't count toward the active view; a view that
// names a `group` sets it when pressed.
//
// Every setter is one update(), and must stay one: see setFilters.
export function useTableUrlState<F extends string, M extends string = never, V extends string = never>(
  filterNames: readonly F[],
  multiFilterNames: readonly M[] = [],
  views: Readonly<Record<V, TableView<NoInfer<F>, NoInfer<M>>>> = {} as Record<V, TableView<F, M>>,
  {
    groupStorageKey,
    pageSizes = DEFAULT_PAGE_SIZES,
    defaultPageSize = 50,
    pageSizeStorageKey,
  }: TableUrlStateOptions = {},
) {
  const [params, setParams] = useSearchParams()
  const rememberedPageSize = useRemembered(pageSizeStorageKey)
  const pageSize = resolvePageSize(pageSizes, params.get('size'), rememberedPageSize, defaultPageSize)

  const rememberedGrouping = useRemembered(groupStorageKey)
  const grouping = params.get('group') ?? rememberedGrouping ?? ''
  const rememberGrouping = (next: string) => {
    if (groupStorageKey !== undefined) browserStore.set(groupStorageKey, next)
  }

  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  const [sortField, sortDir] = (params.get('sort') ?? '').split(':')
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === 'desc' }] : []

  const filters = Object.fromEntries(filterNames.map((name) => [name, params.get(name) ?? ''])) as Record<
    F,
    string
  >
  const multiFilters = Object.fromEntries(multiFilterNames.map((name) => [name, params.getAll(name)])) as Record<
    M,
    string[]
  >

  const activeView = activeViewOf(views, filters, multiFilters)

  function update(changes: UrlChanges) {
    setParams((previous) => applyUrlChanges(previous, changes), { replace: true })
  }

  return {
    page,
    sorting,
    filters,
    multiFilters,
    activeView,
    grouping,
    pageSize,
    pageSizes,
    setPageSize: (next: number) => {
      if (pageSizeStorageKey !== undefined) browserStore.set(pageSizeStorageKey, String(next))
      update({ size: next === defaultPageSize ? null : String(next), page: null })
    },
    setGrouping: (next: string) => {
      rememberGrouping(next)
      update({ group: next || null })
    },
    setPage: (next: number) => update({ page: next > 1 ? String(next) : null }),
    setSorting: (next: SortingState) => update({ sort: serializeSort(next), page: null }),
    setFilter: (name: F, value: string) => update({ [name]: value, page: null }),
    // Several filters in one call — for any user action that changes more
    // than one (both ends of a date range, "clear filters"). Two setters in
    // the same tick lose all but the last: react-router hands each
    // setSearchParams updater the params from the last render, not the
    // ones the previous updater produced. Single-value filters take a
    // string ('' clears), multi-value ones a list ([] clears).
    setFilters: (changes: Partial<Record<F, string>> & Partial<Record<M, string[]>>) =>
      update({ ...changes, page: null }),
    setMultiFilter: (name: M, values: string[]) => update({ [name]: values, page: null }),
    // Replaces the whole filter + sort state at once — a saved view. See
    // viewToUrlChanges() for why anything the view doesn't set is cleared.
    applyView: (view: TableView<F, M>) => {
      if (view.group !== undefined) rememberGrouping(view.group)
      update(viewToUrlChanges(filterNames, multiFilterNames, view))
    },
  }
}

// A value remembered on this device under `key`, or null (none, or no key).
function useRemembered(key: string | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => (key === undefined ? () => {} : browserStore.subscribe(key, listener)),
    [key],
  )
  return useSyncExternalStore(
    subscribe,
    () => (key === undefined ? null : browserStore.get(key)),
    () => null,
  )
}

/** The rows per page: the URL's if it's one of the choices, then the remembered one, then the default. */
export function resolvePageSize(
  pageSizes: readonly number[],
  fromUrl: string | null,
  remembered: string | null,
  defaultPageSize: number,
): number {
  for (const candidate of [fromUrl, remembered]) {
    const size = candidate === null ? NaN : Number(candidate)
    if (pageSizes.includes(size)) return size
  }
  return defaultPageSize
}
