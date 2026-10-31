// One emoji on a form: a routine's mark, a list's icon. The value is the
// emoji itself, or `''` for none. A button showing the choice, opening a
// Popover with a search box and a curated set of emoji in groups (not the
// whole of Unicode: `emoji-field-data.ts`). Like DateField it is one
// control for a react-hook-form `Controller`; `clearable` adds Clear.
import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { filterEmojiGroups } from './emoji-field-data'

export type EmojiFieldProps = {
  /** The trigger button's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** The emoji, or `''` for none. */
  value: string
  /** Called with the picked emoji, or `''` when cleared. */
  onChange: (value: string) => void
  /** What the button says with none picked. Defaults to "Pick an emoji". */
  placeholder?: string
  /** Offer Clear in the popup, for an optional field. */
  clearable?: boolean
  /** The value was refused: `aria-invalid` on the button. */
  invalid?: boolean
  /** Saving: the button shows the emoji but won't open. */
  readOnly?: boolean
  /** Open on mount (for stories and editing in place). */
  defaultOpen?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function EmojiField({
  id,
  value,
  onChange,
  placeholder = 'Pick an emoji',
  clearable = false,
  invalid = false,
  readOnly = false,
  defaultOpen = false,
  className,
  ...aria
}: EmojiFieldProps) {
  const [open, setOpen] = useState(defaultOpen && !readOnly)
  const [query, setQuery] = useState('')
  const groups = filterEmojiGroups(query)

  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
    if (!next) setQuery('')
  }
  const pick = (next: string) => {
    onChange(next)
    changeOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-readonly={readOnly || undefined}
            className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground', className)}
            {...aria}
          />
        }
      >
        {value ? (
          <span className="text-base leading-none">{value}</span>
        ) : (
          <>
            <SmilePlus aria-hidden="true" className="size-4" />
            {placeholder}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 gap-2 p-2" align="start" data-slot="emoji-field-popup" aria-label="Emoji">
        <Input
          type="search"
          autoComplete="off"
          aria-label="Search emoji"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-64 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No emoji match "{query.trim()}".</p>
          ) : (
            groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="mb-2 last:mb-0">
                <h3 className="px-1 py-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
                <div className="grid grid-cols-7 gap-0.5">
                  {group.emojis.map((entry) => (
                    <button
                      key={entry.emoji}
                      type="button"
                      aria-label={entry.name}
                      title={entry.name}
                      aria-pressed={entry.emoji === value}
                      onClick={() => pick(entry.emoji)}
                      className="flex size-8 items-center justify-center rounded-md text-xl leading-none outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-accent"
                    >
                      {entry.emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        {clearable && value && (
          <div className="border-t border-border pt-2">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => pick('')}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
