// The URL-building half of useTableUrlState (./use-table-url-state.ts),
// kept free of React and of component imports so tests/ can unit-test it.

// Structurally DataTable's SortingState. Not imported from there: that is a
// .tsx module, and tests/ is type-checked without JSX.
type Sort = readonly { id: string; desc: boolean }[]

export type UrlChanges = Record<string, string | string[] | null>

export type TableView<F extends string, M extends string> = {
  /** Its pill's word in DataTable's `views` ("Current"); the view's id unless set. */
  label?: string
  filters?: Partial<Record<F, string>>
  multiFilters?: Partial<Record<M, string[]>>
  /**
   * The part of the view the filter bar has no control for (4.105): a
   * computed rule the server applies, such as `{ overdue: 'true' }`. It's
   * in the URL like a filter and counts toward the view being on, but the
   * reader can't see or change it, so it lasts only while the view does:
   * the first filter the reader changes clears it (filterChanges), and
   * the rows are then what the bar shows. Put everything a control can
   * show in `filters` and `multiFilters`, so the bar says why rows are
   * hidden.
   */
  rule?: Partial<Record<F, string>>
  sort?: Sort
  /**
   * The ids of the columns this view shows, for DataTable's
   * `visibleColumns`. Leave it out to show the table's default columns.
   * Applies only while the view is active (see activeViewOf).
   */
  columns?: readonly string[]
  /**
   * The grouping this view turns on, for DataTable's `grouping`: a
   * grouping's id, or '' for None. Pressing the view sets it; a view that
   * leaves it out keeps whatever grouping is on, since a grouping is how
   * the rows are read, not which rows they are.
   */
  group?: string
}

export function serializeSort(next: Sort) {
  return next[0] ? `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` : null
}

// The next query string: each changed key is replaced outright. An array
// repeats the key, and null or '' removes it. Keys not in `changes` are
// kept, so unrelated params (and other tables' state) survive.
export function applyUrlChanges(previous: URLSearchParams, changes: UrlChanges) {
  const next = new URLSearchParams(previous)
  for (const [key, value] of Object.entries(changes)) {
    next.delete(key)
    if (Array.isArray(value)) for (const item of value) next.append(key, item)
    else if (value !== null && value !== '') next.set(key, value)
  }
  return next
}

// A view is "this combination and nothing else": every filter and the sort
// are set, and any the view doesn't name are cleared. Merging over the
// current state instead would let a leftover filter silently show something
// other than the view. Decided with the developer on 2026-09-28.
//
// The view the list opens on (`asDefault`, useTableUrlState's
// `defaultView`) is written as no filters at all, so the list's plain
// address is that view (readFilterState fills its filters back in).
export function viewToUrlChanges<F extends string, M extends string>(
  filterNames: readonly F[],
  multiFilterNames: readonly M[],
  view: TableView<F, M>,
  asDefault = false,
): UrlChanges {
  const own: Partial<Record<F, string>> = asDefault ? {} : viewFilters(view)
  return {
    // First, so a list's own filter of that name (one with no default view) wins.
    [NO_VIEW_PARAM]: null,
    ...Object.fromEntries(filterNames.map((name) => [name, own[name] ?? ''])),
    ...Object.fromEntries(multiFilterNames.map((name) => [name, asDefault ? [] : (view.multiFilters?.[name] ?? [])])),
    sort: view.sort ? serializeSort(view.sort) : null,
    ...(view.group === undefined ? {} : { group: view.group || null }),
    page: null,
  }
}

// A view's single-value filters with its rule: everything it sets.
function viewFilters<F extends string, M extends string>(view: TableView<F, M>): Partial<Record<F, string>> {
  return { ...view.filters, ...view.rule }
}

/**
 * The query parameter that says "no view, no filters" on a list with a
 * `defaultView` (4.105): `?view=none`. Without it a list's plain address
 * is its default view, so clearing the last filter by hand writes it, or
 * the default view's filters would come straight back.
 */
export const NO_VIEW_PARAM = 'view'

/** Every filter that some view's `rule` sets: the ones no control shows. */
export function ruleFilterNames<F extends string, M extends string>(
  views: Readonly<Record<string, TableView<F, M>>>,
): F[] {
  const names = new Set<F>()
  for (const view of Object.values(views)) for (const name of Object.keys(view.rule ?? {})) names.add(name as F)
  return [...names]
}

export type FilterState<F extends string, M extends string> = {
  filters: Record<F, string>
  multiFilters: Record<M, string[]>
  /** The URL names no filter, so these are the default view's (useTableUrlState's `defaultView`). */
  atDefault: boolean
}

// The filters the bar shows and the query uses: the URL's, or, at a
// list's plain address (no filter and no `?view=none`), its default
// view's. So the default view's controls show what it means, the same as
// any other view's.
export function readFilterState<F extends string, M extends string>(
  params: URLSearchParams,
  filterNames: readonly F[],
  multiFilterNames: readonly M[],
  defaultView?: TableView<F, M>,
): FilterState<F, M> {
  const named =
    filterNames.some((name) => Boolean(params.get(name))) || multiFilterNames.some((name) => params.getAll(name).length > 0)
  const atDefault = defaultView !== undefined && !named && params.get(NO_VIEW_PARAM) !== 'none'
  const own: Partial<Record<F, string>> = atDefault ? viewFilters(defaultView) : {}
  return {
    filters: Object.fromEntries(
      filterNames.map((name) => [name, atDefault ? (own[name] ?? '') : (params.get(name) ?? '')]),
    ) as Record<F, string>,
    multiFilters: Object.fromEntries(
      multiFilterNames.map((name) => [
        name,
        atDefault ? [...(defaultView.multiFilters?.[name] ?? [])] : params.getAll(name),
      ]),
    ) as Record<M, string[]>,
    atDefault,
  }
}

// The URL changes for the reader changing filters by hand (setFilter,
// setFilters, setMultiFilter), 4.105:
// - every filter they didn't touch keeps the value the bar shows, even at
//   the plain address where those come from the default view, so their
//   change is the only change;
// - a view's `rule` is cleared, since no control shows it and the view it
//   belonged to is no longer what's on;
// - with a `defaultView`, a result with no filter at all is written
//   `?view=none`, so it stays empty instead of turning back into the
//   default view.
// The page returns to 1. Which view is on follows from the result
// (activeViewOf): one whose filters it equals, often none.
export function filterChanges<F extends string, M extends string>(
  state: FilterState<F, M>,
  changes: Readonly<Record<string, string | string[] | undefined>>,
  ruleNames: readonly F[],
  hasDefault: boolean,
): UrlChanges {
  const next: Record<string, string | string[]> = {
    ...(state.atDefault ? { ...state.filters, ...state.multiFilters } : {}),
    ...Object.fromEntries(ruleNames.map((name) => [name, ''])),
  }
  for (const [name, value] of Object.entries(changes)) if (value !== undefined) next[name] = value as string | string[]
  const result = { ...state.filters, ...state.multiFilters, ...next } as Record<string, string | string[]>
  const empty = Object.values(result).every((value) => (Array.isArray(value) ? value.length === 0 : !value))
  // The marker only on a list with a default view: without one, `view`
  // may be a filter of the list's own, and is left alone.
  return { ...next, ...(hasDefault ? { [NO_VIEW_PARAM]: empty ? 'none' : null } : {}), page: null }
}

// Which of `views` the current filters are: the first whose filters (with
// its `rule`) and multi filters equal the URL's exactly (multi filters in any order), or
// null. A view is active only while it is still "this combination and
// nothing else", so adding or changing any filter returns the table to its
// default columns: a view's columns are chosen for the records its filters
// select, and would hide a field those other records fill. Sort and page
// don't change which records are shown, so they don't count. Decided with
// the developer on 2026-10-05.
export function activeViewOf<F extends string, M extends string, V extends string>(
  views: Readonly<Record<V, TableView<F, M>>>,
  filters: Readonly<Record<F, string>>,
  multiFilters: Readonly<Record<M, readonly string[]>>,
): V | null {
  const sameItems = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().every((item, index) => item === [...b].sort()[index])
  const matches = (view: TableView<F, M>) =>
    (Object.keys(filters) as F[]).every((name) => filters[name] === (viewFilters(view)[name] ?? '')) &&
    (Object.keys(multiFilters) as M[]).every((name) => sameItems(multiFilters[name], view.multiFilters?.[name] ?? []))
  return (Object.keys(views) as V[]).find((id) => matches(views[id])) ?? null
}
