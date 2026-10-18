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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
}

// The All pill's value inside the group: Base UI's toggles need one that
// isn't empty, and '' is what the app's filter calls All.
const ALL = '__all__'

// Pressed is filled with the primary colour: the toggle's own pressed tint
// (bg-muted) is ~3% off the page, too faint to say which one is on.
const PILL_CLASS =
  'rounded-full px-3 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground ' +
  'aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground'

export function PillFilter({ label, options, value, onValueChange, allLabel = 'All' }: PillFilterProps) {
  const pills = allLabel === null ? options : [{ value: ALL, label: allLabel }, ...options]
  const pressed = value === '' && allLabel !== null ? ALL : value
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={1}
      className="flex-wrap"
      value={[pressed]}
      onValueChange={(next) => {
        // [] is the pressed pill pressed again: it stays on.
        const chosen = next[0]
        if (chosen === undefined || chosen === pressed) return
        onValueChange(chosen === ALL ? '' : chosen)
      }}
    >
      {pills.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className={PILL_CLASS}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
