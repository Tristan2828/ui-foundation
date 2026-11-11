// A record's list of related records (the record page standard, R8): the
// ten newest under a section's heading, then View all N to the whole list
// filtered to this record, so a long care log doesn't push the rest of the
// record away. A DataTable with `limit` and `viewAll` and nothing to page or
// sort: the app's query asks for `limit` rows, newest first, and the total.
//
//   <RelatedTable
//     columns={VISIT_COLUMNS}
//     opens={{ kind: 'dialog', to: (visit) => `/health/visits/${visit.id}` }}
//     data={visits.data?.items ?? []}
//     total={visits.data?.total ?? 0}
//     isLoading={visits.isLoading}
//     error={visits.error}
//     onRetry={() => visits.refetch()}
//     emptyTitle="No visits yet"
//     viewAll={{ to: `/health/visits?provider=${provider.id}` }}
//   />
import { useMemo } from 'react'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { DataTable, type DataTableOpens, type DataTableProps } from './data-table'
import type { DataTableViewAll } from './data-table-tools'

export type RelatedTableProps<TData extends Record<string, unknown>> = Pick<
  DataTableProps<TData>,
  | 'columns'
  | 'data'
  | 'total'
  | 'isLoading'
  | 'error'
  | 'onRetry'
  | 'emptyTitle'
  | 'emptyDescription'
  | 'emptyAction'
  | 'getRowId'
  | 'visibleColumns'
  | 'highlightRow'
  | 'rowActions'
  | 'phoneRow'
  | 'onRowClick'
  | 'width'
> & {
  /** How a row opens its record, as on every list. */
  opens: DataTableOpens<TData>
  /** The most rows shown: 10 unless set. */
  limit?: number
  /** The whole list, filtered to this record: shown when `total` is over `limit`. */
  viewAll?: DataTableViewAll
}

const noop = () => {}
const NO_SORT: never[] = []

export function RelatedTable<TData extends Record<string, unknown>>({
  columns,
  limit = 10,
  ...props
}: RelatedTableProps<TData>) {
  // The headers aren't sort buttons: the newest come first, and View all
  // has the list's own sorting.
  const unsorted = useMemo(
    () => columns.map((column) => ({ ...column, enableSorting: false }) as LegacyColumnDef<TData, unknown>),
    [columns],
  )
  return (
    <DataTable
      {...props}
      columns={unsorted}
      limit={limit}
      page={1}
      pageSize={limit}
      onPageChange={noop}
      sorting={NO_SORT}
      onSortingChange={noop}
    />
  )
}
