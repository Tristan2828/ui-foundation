// The URL-building half of useTableUrlState (./use-table-url-state.ts),
// kept free of React and of component imports so tests/ can unit-test it.

// Structurally DataTable's SortingState. Not imported from there: that is a
// .tsx module, and tests/ is type-checked without JSX.
type Sort = readonly { id: string; desc: boolean }[]

export type UrlChanges = Record<string, string | string[] | null>

export type TableView<F extends string, M extends string> = {
  filters?: Partial<Record<F, string>>
  multiFilters?: Partial<Record<M, string[]>>
  sort?: Sort
  /**
   * The ids of the columns this view shows, for DataTable's
   * `visibleColumns`. Leave it out to show the table's default columns.
   * Applies only while the view is active (see activeViewOf).
   */
  columns?: readonly string[]
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
export function viewToUrlChanges<F extends string, M extends string>(
  filterNames: readonly F[],
  multiFilterNames: readonly M[],
  view: TableView<F, M>,
): UrlChanges {
  return {
    ...Object.fromEntries(filterNames.map((name) => [name, view.filters?.[name] ?? ''])),
    ...Object.fromEntries(multiFilterNames.map((name) => [name, view.multiFilters?.[name] ?? []])),
    sort: view.sort ? serializeSort(view.sort) : null,
    page: null,
  }
}

// Which of `views` the current filters are: the first whose filters and
// multi filters equal the URL's exactly (multi filters in any order), or
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
    (Object.keys(filters) as F[]).every((name) => filters[name] === (view.filters?.[name] ?? '')) &&
    (Object.keys(multiFilters) as M[]).every((name) => sameItems(multiFilters[name], view.multiFilters?.[name] ?? []))
  return (Object.keys(views) as V[]).find((id) => matches(views[id])) ?? null
}
