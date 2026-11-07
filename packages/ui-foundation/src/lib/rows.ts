// How tall a table's rows are on this device (design-language.md
// "Density", "Rows on this device"). Compact is the default; with
// FoundationProviders' `rowsPicker` the app shell's look menu offers
// Regular too, remembered on this device (localStorage, this store). The
// choice rides on <html> as data-rows, and styles/theme.css's
// [data-rows="regular"] retunes every table's cells under it: DataTable,
// the Table primitive and tables in notes. A data-density on a nearer
// ancestor (a hub's compact wrapper) still wins there.
import { browserStorage, createDeviceChoiceStore, otherTabsSubscriber, type DeviceChoiceStore, type StorageLike } from '@/lib/device-choice'

export const ROWS = ['compact', 'regular'] as const

export type RowsName = (typeof ROWS)[number]

export const ROWS_LABELS: Record<RowsName, string> = {
  compact: 'Compact',
  regular: 'Regular',
}

/** Where a device's chosen rows are kept. */
export const ROWS_STORAGE_KEY = 'ui-foundation:rows'

export function isRowsName(value: unknown): value is RowsName {
  return typeof value === 'string' && (ROWS as readonly string[]).includes(value)
}

export type RowsStore = DeviceChoiceStore<RowsName>

/** The store under useRows (tests/rows.test.ts). */
export function createRowsStore(getStorage: () => StorageLike | undefined): RowsStore {
  return createDeviceChoiceStore(ROWS_STORAGE_KEY, isRowsName, getStorage)
}

export const browserRowsStore = createRowsStore(browserStorage)

export const subscribeToBrowserRowsStore = otherTabsSubscriber(browserRowsStore, ROWS_STORAGE_KEY)
