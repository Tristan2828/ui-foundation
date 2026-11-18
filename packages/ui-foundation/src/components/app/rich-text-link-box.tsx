// The editor's link box (Ctrl/Cmd+K, milkdown-editor.tsx).
import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PopoverContent } from '@/components/ui/popover'
import { linkHref, linkRefusal } from '@/lib/link-href'
import type { BoxAnchor } from './rich-text-box-anchor'
import type { LinkTarget } from './rich-text-links'

export type LinkBox = LinkTarget & { anchor: BoxAnchor }

// The link box: the address, Apply, and Remove link for an existing one.
// Enter (Ctrl/Cmd+Enter too) applies the link and stays its own: editing
// in place listens for Ctrl/Cmd+Enter through the portal, and would save
// the field without it. Esc is the popover's: it closes the box only.
export function LinkForm({ box, onApply }: { box: LinkBox; onApply: (href: string) => void }) {
  const [typed, setTyped] = useState(box.href)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const apply = () => {
    const href = linkHref(typed)
    if (href === null) {
      setError(
        linkRefusal(typed) === 'whitespace'
          ? 'An address has no spaces. Remove them, or write each as %20.'
          : 'Enter a web or email address, like https://example.com.',
      )
      return
    }
    onApply(href)
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault()
      event.stopPropagation()
      apply()
    }
  }

  return (
    <PopoverContent
      anchor={box.anchor}
      align="start"
      aria-label={box.href ? 'Edit Link' : 'Add Link'}
      initialFocus={inputRef}
      finalFocus={false}
      className="w-80"
      onKeyDown={onKeyDown}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={inputId}>Link Address</FieldLabel>
        <Input
          ref={inputRef}
          id={inputId}
          value={typed}
          placeholder="https://"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setTyped(event.target.value)
            setError(null)
          }}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
        {box.href && (
          <Button size="sm" variant="outline" onClick={() => onApply('')}>
            Remove Link
          </Button>
        )}
      </div>
    </PopoverContent>
  )
}
