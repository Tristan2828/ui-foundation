import { useSearchParams } from 'react-router'
import type { SortingState } from '@/components/app/data-table'

// A table's page, sort and filters, kept in the URL query string
// (`?page=2&sort=name:asc&search=mouse&tags=fragile&tags=bulky`) instead of
// component state, so they survive going to the edit form and back, a
// refresh, or a shared link. Every update replaces the history entry rather
// than pushing one — typing in a search box shouldn't fill the back button.
//
// Single-value filters are strings ('' when unset). Multi-value filters
// (multi-choice fields) are string arrays, repeated in the URL the same way
// the API takes them. Changing the sort or any filter returns to page 1.
export function useTableUrlState<F extends string, M extends string = never>(
  filterNames: readonly F[],
  multiFilterNames: readonly M[] = [],
) {
  const [params, setParams] = useSearchParams()

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

  function update(changes: Record<string, string | string[] | null>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key)
          if (Array.isArray(value)) for (const item of value) next.append(key, item)
          else if (value !== null && value !== '') next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  return {
    page,
    sorting,
    filters,
    multiFilters,
    setPage: (next: number) => update({ page: next > 1 ? String(next) : null }),
    setSorting: (next: SortingState) =>
      update({ sort: next[0] ? `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` : null, page: null }),
    setFilter: (name: F, value: string) => update({ [name]: value, page: null }),
    setMultiFilter: (name: M, values: string[]) => update({ [name]: values, page: null }),
  }
}
