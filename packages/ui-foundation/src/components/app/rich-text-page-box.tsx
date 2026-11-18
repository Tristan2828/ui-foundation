// The editor's new-page box ("/page" and Turn into page, milkdown-editor.tsx).
import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PopoverContent } from '@/components/ui/popover'
import type { BoxAnchor } from './rich-text-box-anchor'

// The new page's title box: what it starts with (the selected words, or
// nothing after "/page"), placed at the start of where the link will go.
export type PageBox = { title: string; anchor: BoxAnchor }

// The new page's title box: the title (the selected words to start with),
// and Create page. While the app makes the page it waits, its controls
// held; a refusal shows under the title, in the gateway's words, and the
// text is left as it was. Enter creates; Esc is the popover's, and closes
// it (not while the app is still working).
export function PageForm({ box, busy, onCreate }: { box: PageBox; busy: boolean; onCreate: (title: string) => Promise<string | null> }) {
  const [typed, setTyped] = useState(box.title)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const create = () => {
    const title = typed.replace(/\s+/g, ' ').trim()
    if (!title) {
      setError('Give the page a title.')
      return
    }
    setError(null)
    void onCreate(title).then((refused) => {
      if (refused) {
        setError(refused)
        inputRef.current?.focus()
      }
    })
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault()
      event.stopPropagation()
      if (!busy) create()
    }
  }

  return (
    <PopoverContent
      anchor={box.anchor}
      align="start"
      aria-label="New Page"
      initialFocus={inputRef}
      finalFocus={false}
      className="w-80"
      data-rich-text-menu=""
      data-slot="page-form"
      onKeyDown={onKeyDown}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={inputId}>Page Title</FieldLabel>
        <Input
          ref={inputRef}
          id={inputId}
          value={typed}
          autoComplete="off"
          readOnly={busy}
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
        <Button size="sm" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create Page'}
        </Button>
      </div>
    </PopoverContent>
  )
}
