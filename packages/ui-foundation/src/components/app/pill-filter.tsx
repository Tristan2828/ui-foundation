// One quick filter as pills above a table's rows (All / Video / Audio /
// Text), for a filter with few values that switching between is the main
// thing people do; a dropdown hides the choices behind a click. One pill
// is pressed at a time, and pressing the pressed one again leaves it so:
// "All" is how the filter comes off.
//
// Holds no state: the app passes the value it keeps in the URL like any
// filter (useTableUrlState's `filters.<name>`, '' for All) and sets it
// with `setFilter`. Built on shadcn's ToggleGroup (Base UI): a group named
// by `label`, one tab stop, the arrow keys along it, each pill a toggle
// button with aria-pressed.
import { cn } from 'cn'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { navCountText } from './app-shell-nav'

export type PillFilterOption = { value: string; label: string }

export type PillFilterProps = {
  /** What the pills choose ("Type"): the group's accessible name. */
  label: string
  options: readonly PillFilterOption[]
  /** The pressed option's value; '' is All. */
  value: string
  onValueChange: (value: string) => void
  /** The first pill, which clears the filter. null leaves it out, for a filter that always has a value. */
  allLabel?: string | null
  /** On the group: `flex-nowrap` (with a scrolling parent) keeps the pills on one line. */
  className?: string
}

// The All pill's value inside the group: Base UI's toggles need one that
// isn't empty, and '' is what the app's filter calls All.
const ALL = '__all__'

// Pressed is filled with the primary colour: the toggle's own pressed tint
// (bg-muted) is ~3% off the page, too faint to say which one is on.
const PILL_CLASS =
  'rounded-full px-3 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground ' +
  'aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground'

export function PillFilter({ label, options, value, onValueChange, allLabel = 'All', className }: PillFilterProps) {
  return (
    <PillGroup label={label} options={options} value={value} onValueChange={onValueChange} allLabel={allLabel} className={className} />
  )
}

/**
 * One pill as PillGroup draws it: a PillFilterOption, and, for DataTable's
 * views, a count after the label, "Needs a Look · 3".
 */
export type PillGroupOption = PillFilterOption & {
  /** The number shown after the label; null, undefined or 0 shows none, past 99 "99+". */
  count?: number | null
  /**
   * The pill keeps room for a two-digit count from its first render, so
   * a count that arrives later (or never) moves no pill.
   */
  counted?: boolean
}

// The count as drawn: navCountText's rules (nothing at 0 or while loading,
// "99+" past 99), shared with the sidebar's counts.
function countText(count: number | null | undefined) {
  return navCountText(count ?? undefined)
}

// PillFilter's pills, with an optional count per pill. Internal: DataTable's
// views draw theirs with it (data-table-tools.tsx's ViewPills).
export function PillGroup({
  label,
  options,
  value,
  onValueChange,
  allLabel = 'All',
  className,
}: Omit<PillFilterProps, 'options'> & { options: readonly PillGroupOption[] }) {
  const pills: readonly PillGroupOption[] = allLabel === null ? options : [{ value: ALL, label: allLabel }, ...options]
  const pressed = value === '' && allLabel !== null ? ALL : value
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={1}
      className={cn('flex-wrap', className)}
      value={[pressed]}
      onValueChange={(next) => {
        // [] is the pressed pill pressed again: it stays on.
        const chosen = next[0]
        if (chosen === undefined || chosen === pressed) return
        onValueChange(chosen === ALL ? '' : chosen)
      }}
    >
      {pills.map((option) => {
        const count = countText(option.count)
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // Read as "Needs a Look, 3": the dot isn't in the name.
            aria-label={count !== undefined ? `${option.label}, ${count}` : undefined}
            className={PILL_CLASS}
          >
            {option.counted || count !== undefined ? <CountedLabel label={option.label} count={count} counted={option.counted} /> : option.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

// "Needs a Look · 3". A hidden copy with a two-digit count (::after, not in
// the DOM's text or the name) holds the pill at that width while the count
// loads, is 0 or is one digit, the way EntityView's tab names hold their
// bold width; the label sits centred in it.
function CountedLabel({ label, count, counted }: { label: string; count: string | undefined; counted: boolean | undefined }) {
  return (
    <span
      data-slot="pill-label"
      data-reserve={counted ? `${label} · 00` : undefined}
      className="inline-grid after:invisible after:col-start-1 after:row-start-1 after:h-0 after:tabular-nums after:content-[attr(data-reserve)]"
    >
      {/* One text with the label, so the count is the label's colour and
          axe measures them together (it skips a lone digit). */}
      <span data-slot="pill-text" className="col-start-1 row-start-1 justify-self-center tabular-nums">
        {count !== undefined ? `${label} · ${count}` : label}
      </span>
    </span>
  )
}
