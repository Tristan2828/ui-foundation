// A stored colour on a form (a label's colour, a calendar's): a grid of
// named swatches and Custom, one radio group, for a react-hook-form
// `Controller` like DateField. The value is a hex string, always
// `storedColor`'s form (`#c0392b`), and the design language's "A stored
// colour" is the why of the swatches themselves (ColorSwatch).
//
// - One radio group (shadcn's RadioGroup on Base UI): one tab stop, the
//   arrow keys move and pick, Space picks. Each choice is a radio with its
//   ColorSwatch, and the swatch's name is the radio's label, written out:
//   the colour is never the only way to tell. The picked one shows its
//   radio's dot and a primary border, so it's marked by more than its
//   colour; the focused one wears the focus ring.
// - Custom is the last choice. Clicking it opens the browser's own colour
//   picker (`<input type="color">`, beside it, which is also a button of
//   its own); reaching it by the keyboard only picks it, and Tab goes on to
//   the picker. The chosen hex is written beside it.
// - A value that's none of the named colours (a hex typed elsewhere,
//   uppercase or 3-digit included) shows Custom picked, with its hex.
//   Colours compare in full (`#FFF` is `#ffffff`), so a named colour stored
//   another way still shows as its name. A value that isn't a colour
//   (missing, empty, a typo) shows nothing picked.
// - The swatch fills are data (ColorSwatch's inline style); everything
//   around them is semantic tokens.
import { useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { cn } from 'cn'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { choiceIndex, COLOR_CHOICES, pickerHex, type ColorChoice } from '@/lib/color-choices'
import { storedColor } from '@/lib/stored-color'
import { ColorSwatch } from './color-swatch'

const CUSTOM = 'custom'

// A choice's box: the radio and its swatch, a primary border when picked
// (the dot says it too), the focus ring on the one the keyboard is on.
const CHOICE = cn(
  'flex h-(--control-height,--spacing(8)) min-w-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 type-body text-foreground',
  'hover:bg-muted has-data-checked:border-primary has-data-checked:bg-primary/12',
  'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
  'has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50',
)

export type ColorFieldProps = {
  /** The radio group's id, for the field's `<FieldLabel htmlFor>` (its `required` marks the group). */
  id?: string
  /** The stored colour: a hex, with or without `#`, in 3, 4, 6 or 8 digits. Missing or invalid picks nothing. */
  value: string | null | undefined
  /** Called with the picked colour in `storedColor`'s form (`#c0392b`). */
  onChange: (value: string) => void
  /** Called when focus leaves the whole field (react-hook-form's `onBlur`). */
  onBlur?: () => void
  /** The named colours offered, in order. Defaults to `COLOR_CHOICES`, twelve that read on a card everywhere. */
  colors?: readonly ColorChoice[]
  /** The value was refused: `aria-invalid` on the group and a destructive outline. */
  invalid?: boolean
  disabled?: boolean
  className?: string
  /** Name the group: the FieldLabel's id (a label's `htmlFor` can't name a group). */
  'aria-labelledby'?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

export function ColorField({
  id,
  value,
  onChange,
  onBlur,
  colors = COLOR_CHOICES,
  invalid = false,
  disabled = false,
  className,
  ...aria
}: ColorFieldProps) {
  const picker = useRef<HTMLInputElement>(null)
  // Custom picked by the person while the value is still a named colour:
  // it stays picked until they pick a named one.
  const [customPicked, setCustomPicked] = useState(false)
  const index = choiceIndex(value, colors)
  const hex = storedColor(value)
  const picked = customPicked || (index === -1 && hex) ? CUSTOM : index === -1 ? null : String(index)

  const choose = (next: unknown) => {
    if (next === CUSTOM) {
      setCustomPicked(true)
      return
    }
    const choice = colors[Number(next)]
    const color = storedColor(choice?.color)
    if (!color) return
    setCustomPicked(false)
    if (color !== hex) onChange(color)
  }

  // A pointer's click on Custom (its radio or its word) opens the picker;
  // a label's forwarded click and the keyboard's (`detail` 0) don't.
  const openPicker = (event: MouseEvent) => {
    if (disabled || event.detail === 0) return
    const input = picker.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.click()
    }
  }

  const leave = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.()
  }

  return (
    <div data-slot="color-field" className={cn('min-w-0', className)} onBlur={leave}>
      <RadioGroup
        id={id}
        value={picked}
        onValueChange={choose}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1 rounded-md',
          invalid && 'ring-3 ring-destructive/20 dark:ring-destructive/40',
        )}
        {...aria}
      >
        {colors.map((choice, at) => (
          <label key={`${choice.name}-${at}`} data-slot="color-field-choice" className={CHOICE}>
            <RadioGroupItem value={String(at)} aria-invalid={invalid || undefined} />
            <ColorSwatch color={choice.color} label={choice.name} />
          </label>
        ))}
        <div data-slot="color-field-custom" className="col-span-full flex min-w-0 flex-wrap items-center gap-2">
          <label className={cn(CHOICE, 'w-fit')} onClick={openPicker}>
            <RadioGroupItem value={CUSTOM} aria-invalid={invalid || undefined} />
            Custom
          </label>
          <input
            ref={picker}
            type="color"
            data-slot="color-field-picker"
            aria-label="Custom Colour"
            value={pickerHex(value)}
            disabled={disabled}
            onChange={(event) => {
              const color = storedColor(event.target.value)
              if (!color) return
              setCustomPicked(true)
              onChange(color)
            }}
            // The radio group's arrow keys are for its radios, not this button.
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              'box-border size-(--control-height,--spacing(8)) shrink-0 cursor-pointer rounded-md border border-muted-foreground bg-transparent p-0.5 outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
              '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0',
            )}
          />
          {picked === CUSTOM && hex && (
            <span data-slot="color-field-hex" className="type-body text-muted-foreground tabular-nums">
              {hex}
            </span>
          )}
        </div>
      </RadioGroup>
    </div>
  )
}
