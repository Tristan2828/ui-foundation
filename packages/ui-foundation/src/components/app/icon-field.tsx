// One icon out of a given set, picked from a grid: a task category's icon,
// a place's. The value is the option's `value`. A button showing the icon
// and its label (or the app's own `renderIcon`, a tinted glyph), opening
// a 6-across grid of the set's icons with one line under it naming the
// icon under the pointer or focus, or else the current one, so a phone,
// which has no hover, still shows the names. A Popover on a laptop; below
// 768px a sheet from the bottom of the screen with bigger buttons. No
// search (a set is a few dozen at most) and no Clear: a set of icons is
// for a field that always has one. Lucide for the app's own things, emoji
// (EmojiField) for things the person names.
import { useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { IconComponent } from './icon-component'

export type IconFieldOption<T extends string = string> = {
  value: T
  /** The icon's name: the button's accessible name, and the line under the grid. */
  label: string
  icon: IconComponent
}

export type IconFieldProps<T extends string = string> = {
  /** The trigger button's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  options: readonly IconFieldOption<T>[]
  /** The chosen option's value. */
  value: T
  /** Called with the picked value; the grid closes. */
  onChange: (value: T) => void
  /** Draws the trigger's icon instead of the option's own (a category's tinted glyph). */
  renderIcon?: (value: T) => ReactNode
  /** The value was refused: `aria-invalid` on the button. */
  invalid?: boolean
  /** Saving: the button shows the icon but won't open. */
  readOnly?: boolean
  /** Open on mount (for stories and editing in place). */
  defaultOpen?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function IconField<T extends string>({
  id,
  options,
  value,
  onChange,
  renderIcon,
  invalid = false,
  readOnly = false,
  defaultOpen = false,
  className,
  ...aria
}: IconFieldProps<T>) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(defaultOpen && !readOnly)
  const chosen = options.find((option) => option.value === value)
  // Opening focuses the current icon, so the grid starts where the value is.
  const current = useRef<HTMLButtonElement>(null)

  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
  }
  const pick = (next: T) => {
    onChange(next)
    changeOpen(false)
  }

  const trigger: ReactElement = (
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-invalid={invalid || undefined}
      aria-readonly={readOnly || undefined}
      className={cn('justify-start font-normal', className)}
      {...aria}
    />
  )
  const face = (
    <>
      {renderIcon ? renderIcon(value) : chosen ? <chosen.icon aria-hidden="true" className="size-4" /> : null}
      <span className="truncate">{chosen?.label ?? value}</span>
    </>
  )
  const grid = open ? <IconGrid options={options} value={value} onPick={pick} large={isMobile} current={current} /> : null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetTrigger render={trigger}>{face}</SheetTrigger>
        <SheetContent
          side="bottom"
          data-slot="icon-field-popup"
          initialFocus={current}
          className="max-h-[80dvh] gap-2 px-4 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">Icon</SheetTitle>
          {/* Room for the sheet's Close button above the grid. */}
          <div className="flex flex-col gap-2 pt-8">{grid}</div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={trigger}>{face}</PopoverTrigger>
      <PopoverContent
        className="w-auto gap-2 p-2"
        align="start"
        data-slot="icon-field-popup"
        aria-label="Icon"
        initialFocus={current}
      >
        {grid}
      </PopoverContent>
    </Popover>
  )
}

function IconGrid<T extends string>({
  options,
  value,
  onPick,
  large,
  current,
}: {
  options: readonly IconFieldOption<T>[]
  value: T
  onPick: (value: T) => void
  large: boolean
  current: RefObject<HTMLButtonElement | null>
}) {
  // The icon under the pointer or focus; the line falls back to the current one.
  const [pointed, setPointed] = useState<T | null>(null)
  const named = options.find((option) => option.value === (pointed ?? value))
  return (
    <>
      <div
        role="group"
        aria-label="Icons"
        className={cn('grid grid-cols-6 gap-1 overflow-y-auto', large ? 'max-h-[60dvh] justify-between' : 'w-max')}
        onPointerLeave={() => setPointed(null)}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            ref={option.value === value ? current : undefined}
            type="button"
            variant="ghost"
            aria-label={option.label}
            title={option.label}
            aria-pressed={option.value === value}
            onClick={() => onPick(option.value)}
            onPointerEnter={() => setPointed(option.value)}
            onFocus={() => setPointed(option.value)}
            onBlur={() => setPointed(null)}
            className={cn('p-0 text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground', large ? 'size-12' : 'size-9')}
          >
            <option.icon aria-hidden="true" className="size-5" />
          </Button>
        ))}
      </div>
      <p data-slot="icon-field-name" aria-live="polite" className="truncate px-1 text-sm text-muted-foreground">
        {named?.label ?? ' '}
      </p>
    </>
  )
}
