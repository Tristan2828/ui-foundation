import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import type { SortingState } from '@/components/app/data-table'
import {
  activeViewOf,
  applyUrlChanges,
  filterChanges,
  readFilterState,
  ruleFilterNames,
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

/** useTableUrlState's options, with the view the list opens on. */
export type TableUrlStateViewOptions<V extends string> = TableUrlStateOptions & {
  /**
   * The view the list opens on (4.105): at the list's plain address its
   * filters fill the bar and its pill is pressed. Write that view's whole
   * meaning in its filters (`{ status: ['active', 'paused'] }`, not `{}`
   * with the server's default doing the rest), so the bar shows it.
   */
  defaultView?: V
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
// Views fill the filters (4.105). A view's `filters` and `multiFilters` are
// what the bar's controls show while it's on, so the bar says why rows are
// hidden; write each view's whole meaning there. `defaultView` names the
// view the list opens on: at the list's plain address (no filter in the
// URL) `filters` and `multiFilters` are that view's and it's the active
// one, and pressing it goes back to the plain address. Changing a filter
// by hand keeps every other filter the bar shows (the default view's
// too), clears any view's `rule` (what no control shows), and the pills
// follow: the view the result equals, usually none. Clearing every
// filter by hand on a list with a default view writes `?view=none`, so
// the list stays unfiltered.
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
    defaultView,
  }: TableUrlStateViewOptions<NoInfer<V>> = {},
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

  const fallback = defaultView === undefined ? undefined : views[defaultView]
  const state = readFilterState(params, filterNames, multiFilterNames, fallback)
  const { filters, multiFilters } = state

  const activeView = activeViewOf(views, filters, multiFilters)
  const ruleNames = ruleFilterNames<F, M>(views)
  // The reader changing filters by hand: see filterChanges.
  const changeFilters = (changes: Readonly<Record<string, string | string[] | undefined>>) =>
    update(filterChanges(state, changes, ruleNames, fallback !== undefined))

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
    setFilter: (name: F, value: string) => changeFilters({ [name]: value }),
    // Several filters in one call — for any user action that changes more
    // than one (both ends of a date range, "clear filters"). Two setters in
    // the same tick lose all but the last: react-router hands each
    // setSearchParams updater the params from the last render, not the
    // ones the previous updater produced. Single-value filters take a
    // string ('' clears), multi-value ones a list ([] clears).
    setFilters: (changes: Partial<Record<F, string>> & Partial<Record<M, string[]>>) => changeFilters(changes),
    setMultiFilter: (name: M, values: string[]) =>
      changeFilters({ [name]: values }),
    // Replaces the whole filter + sort state at once — a saved view. See
    // viewToUrlChanges() for why anything the view doesn't set is cleared.
    // The default view (by `id`, as DataTable's onViewChange passes it, or
    // the same object) goes back to the list's plain address. `{}` is
    // "no filters": the plain address too, so the default view on a list
    // that has one.
    applyView: (view: TableView<F, M>, id?: string) => {
      if (view.group !== undefined) rememberGrouping(view.group)
      const asDefault = fallback !== undefined && (id === defaultView || view === fallback)
      update(viewToUrlChanges(filterNames, multiFilterNames, view, asDefault))
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
