// A list's filter toolbar (the list page standard, L4), for DataTable's
// `toolbar`: search, the list's most-used filters out ("primary", usually
// two), and the rest behind a Filters button (SecondaryFilters, its chips
// beside it). No captions over the controls: each names itself, "Any
// status" while it's off and "Status: Active" once it holds a value
// (FilterSelect here, MultiChoice's `label`).
//
// Below 48rem the search and Filters share one line and every filter,
// primary ones included, is in Filters' bottom sheet; the chips of the ones
// that are on follow on the next line. So a phone gets two lines of
// controls, then the rows.
//
// It holds no state: values come from the URL like every filter
// (useTableUrlState), and so do the chips (`active`, `primaryActive`).
import type { ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsPhone } from '@/hooks/use-is-phone'
import { SecondaryFilters, type ActiveFilter } from './secondary-filters'

export type FilterBarSearch = {
  value: string
  onChange: (value: string) => void
  /** What can be searched ("Search names and notes"). */
  placeholder?: string
  /** The box's accessible name: "Search" unless set. */
  label?: string
}

export type FilterBarProps = {
  search?: FilterBarSearch
  /** The filters shown in the toolbar (two, usually): FilterSelect, MultiChoice with `label`. */
  primary?: ReactNode
  /**
   * The primary filters that are on, as chips: shown only below 48rem,
   * where those filters move into the sheet. Wider, each control shows its
   * own value.
   */
  primaryActive?: readonly ActiveFilter[]
  /** The rest, behind the Filters button: SecondaryFilters' children. */
  secondary?: ReactNode
  /** The secondary filters that are on: SecondaryFilters' `active`. */
  active?: readonly ActiveFilter[]
  /** Takes every secondary filter off, in one update (useTableUrlState's `setFilters`). */
  onClear?: () => void
  /**
   * Takes every filter in the sheet off below 48rem, primary ones too, in
   * one update. `onClear` unless set.
   */
  onClearAll?: () => void
  /** The Filters button's text. */
  filtersLabel?: string
}

const SEARCH_CLASS = 'w-56 max-w-full'

export function FilterBar({
  search,
  primary,
  primaryActive = [],
  secondary,
  active = [],
  onClear,
  onClearAll,
  filtersLabel = 'Filters',
}: FilterBarProps) {
  const isMobile = useIsPhone()
  const searchBox = search ? (
    <InputGroup className={isMobile ? 'min-w-0 flex-1 basis-40' : SEARCH_CLASS} data-slot="filter-bar-search">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
        placeholder={search.placeholder}
        aria-label={search.label ?? 'Search'}
      />
    </InputGroup>
  ) : null

  if (isMobile) {
    const hasSheet = Boolean(primary || secondary)
    return (
      <div data-slot="filter-bar" data-layout="phone" className="flex flex-wrap items-center gap-2">
        {searchBox}
        {hasSheet && (
          // `contents`, so the button sits beside the search and its chips
          // wrap onto the line under them.
          <SecondaryFilters
            className="contents"
            label={filtersLabel}
            active={[...primaryActive, ...active]}
            onClear={onClearAll ?? onClear ?? (() => {})}
          >
            {primary}
            {secondary}
          </SecondaryFilters>
        )}
      </div>
    )
  }

  return (
    <div data-slot="filter-bar" className="flex flex-wrap items-center gap-2">
      {searchBox}
      {primary}
      {secondary && (
        <SecondaryFilters label={filtersLabel} active={active} onClear={onClear ?? (() => {})}>
          {secondary}
        </SecondaryFilters>
      )}
    </div>
  )
}

export type FilterSelectOption = { value: string; label: string }

export type FilterSelectProps = {
  /** What it filters ("Status"): the prefix of the value it shows ("Status: Active"). */
  label: string
  options: readonly FilterSelectOption[]
  /** The picked option's value; '' is any. */
  value: string
  onValueChange: (value: string) => void
  /** What it says while off: "Any <label in lower case>" unless set ("Any status"). */
  anyLabel?: string
  className?: string
}

// Base UI's Select needs a value for "any" that isn't empty.
const ANY = '__any__'

/**
 * A single-choice filter that names itself: "Any status" while off,
 * "Status: Active" with a value, so the toolbar needs no captions.
 */
export function FilterSelect({ label, options, value, onValueChange, anyLabel, className }: FilterSelectProps) {
  const any = anyLabel ?? `Any ${label}`
  const picked = options.find((option) => option.value === value)
  const shown = picked ? `${label}: ${picked.label}` : any
  return (
    <Select
      value={picked ? picked.value : ANY}
      onValueChange={(next) => onValueChange(next === ANY || next === null ? '' : String(next))}
    >
      {/* A combobox takes its name from a label, not its text: the name
          holds the text shown, so voice control can say it too. */}
      <SelectTrigger aria-label={shown} data-slot="filter-select" data-active={picked ? true : undefined} className={className}>
        <SelectValue>{() => shown}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
