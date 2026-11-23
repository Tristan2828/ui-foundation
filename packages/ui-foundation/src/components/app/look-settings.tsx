// The device's look as rows of a settings page: its palette (PaletteSetting)
// and its table rows (RowsSetting), the choices the shell's look menu
// offers, kept in the same place (lib/palettes.ts, lib/rows.ts). Each draws
// nothing where the app doesn't let a device pick (FoundationProviders'
// `palettePicker` and `rowsPicker`), so a page can always render them.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { usePalette } from '@/hooks/use-palette'
import { useRows } from '@/hooks/use-rows'
import { isPaletteName, PALETTE_LABELS, PALETTES, type PaletteName } from '@/lib/palettes'
import { ROWS, ROWS_LABELS } from '@/lib/rows'
import { ChoiceButtons } from './choice-buttons'
import { SettingsRow } from './settings-page'

const THIS_BROWSER = 'For this browser only.'

// A tile: the preview and its name, one radio. The picked one's edge is
// twice as thick as well as another colour; the focused one wears the
// focus ring.
const TILE = cn(
  'relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card',
  'has-data-checked:border-primary has-data-checked:ring-1 has-data-checked:ring-primary',
  'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
)

// A small page in the palette's own colours: a sidebar's strip, then a
// title, a line and a button. Read from the palette primitives, so every
// tile shows its own whichever palette is on screen.
function PalettePreview({ name }: { name: PaletteName }) {
  const colour = (part: string) => `var(--palette-${name}-${part})`
  const bar = (part: string, className?: string) => (
    <span className={cn('h-1.25 rounded-full', className)} style={{ background: colour(part) }} />
  )
  return (
    <span
      aria-hidden
      className="grid h-16 grid-cols-[--spacing(8.5)_minmax(0,1fr)] border-b border-border"
      style={{ background: colour('background') }}
    >
      <span className="flex flex-col gap-1.25 px-1.5 py-2" style={{ background: colour('panel') }}>
        {bar('accent')}
        {bar('dim')}
        {bar('dim')}
      </span>
      <span className="flex flex-col gap-1.5 p-2.25">
        {bar('dim', 'w-[70%]')}
        {bar('second', 'w-[40%]')}
        {bar('accent', 'h-2.5 w-[28%]')}
      </span>
    </span>
  )
}

export type PaletteSettingProps = {
  /** Defaults to "Palette". */
  label?: string
  /** Defaults to "For this browser only." */
  help?: ReactNode
}

/**
 * This device's palette, as a settings row of tiles, each a small page in
 * its palette's colours: one radio group, the page changing at once. Draws
 * nothing unless the app lets a device pick (`palettePicker`).
 */
export function PaletteSetting({ label = 'Palette', help = THIS_BROWSER }: PaletteSettingProps) {
  const { palette, picker, setPalette } = usePalette()
  if (!picker) return null
  return (
    <SettingsRow
      label={label}
      help={help}
      layout="below"
      control={(aria) => (
        <RadioGroup
          {...aria}
          data-slot="palette-tiles"
          value={palette}
          onValueChange={(next) => {
            if (isPaletteName(next)) setPalette(next)
          }}
          className="max-w-180 grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(35)),1fr))] gap-3"
        >
          {PALETTES.map((name) => (
            <label key={name} data-slot="palette-tile" className={TILE}>
              {/* Important: the radio's own size and position come after it. */}
              <RadioGroupItem value={name} className="sr-only!" />
              <PalettePreview name={name} />
              <span className="block px-2.5 py-2 type-caption">{PALETTE_LABELS[name]}</span>
            </label>
          ))}
        </RadioGroup>
      )}
    />
  )
}

export type RowsSettingProps = {
  /** Defaults to "Table Rows". */
  label?: string
  /** Defaults to "For this browser only." */
  help?: ReactNode
}

const ROWS_OPTIONS = ROWS.map((value) => ({ value, label: ROWS_LABELS[value] }))

/**
 * This device's table rows, Compact or Regular, as a settings row. Draws
 * nothing unless the app lets a device pick (`rowsPicker`).
 */
export function RowsSetting({ label = 'Table Rows', help = THIS_BROWSER }: RowsSettingProps) {
  const { rows, picker, setRows } = useRows()
  if (!picker) return null
  return (
    <SettingsRow
      label={label}
      help={help}
      control={(aria) => (
        <ChoiceButtons
          {...aria}
          options={ROWS_OPTIONS}
          value={rows}
          onValueChange={(next) => {
            if (next) setRows(next)
          }}
        />
      )}
    />
  )
}
