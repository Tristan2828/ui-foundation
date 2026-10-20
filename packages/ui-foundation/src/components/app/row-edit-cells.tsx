// The three cells a small entity edited in its rows is made of (cell
// pattern 18, "In a table's rows"): a name, a single choice and an
// optional link. Each is an EditableValue over `editInPlace`, so DataTable
// runs it like any editable value: one cell open at a time, "Saving…" and
// a refusal (a taken name's 422) in the cell, the leave-page prompt.
//
// Each is named by its `label`, the column and the row ("Name of Home"),
// so its pencil reads "Edit Name of Home". `save` is the record's
// single-field save (`useRecordUpdate` with `optimistic: false,
// toastOnError: false`, `mutateAsync`): rejecting with the AppError keeps
// the draft open with the reason under it. Render one from a column's
// `cell` inside a component that calls the save hook (a hook can't be
// called in a column definition).
import type { ReactNode } from 'react'
import { ExternalLinkIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { linkHref } from '@/lib/link-href'
import { editInPlace, type EditInPlaceOptions } from './edit-in-place'
import { EditableValue } from './editable-value'

type Schema<TValue> = EditInPlaceOptions<unknown, TValue>['schema']

export type NameCellProps = {
  /** The cell's name, column and row: "Name of Home". */
  label: string
  /** The saved name. */
  value: string
  /** Saves the new name (already checked by `schema`). Rejects with the AppError. */
  save: (name: string) => Promise<unknown>
  /** The form's rule for the name (`schema.shape.name`): checked before anything is sent. */
  schema?: Schema<string>
  /** How the name shows at rest (an icon beside it). Defaults to the name. */
  children?: ReactNode
  /** The input's width class. Defaults to `w-48`. */
  inputClassName?: string
}

/** A name in one line: Enter saves, the form's rule runs first, a taken name's 422 shows in the cell. */
export function NameCell({ label, value, save, schema, children, inputClassName = 'w-48' }: NameCellProps) {
  return (
    <EditableValue
      label={label}
      layout="inline"
      edit={editInPlace<string>({
        kind: 'text',
        value,
        schema,
        save,
        control: (props) => (
          <Input
            id={props.id}
            className={inputClassName}
            value={props.value}
            readOnly={props.disabled}
            aria-invalid={props.invalid || undefined}
            aria-label={props.label}
            aria-describedby={props.describedBy}
            onChange={(event) => props.onChange(event.target.value)}
          />
        ),
      })}
    >
      {children ?? value}
    </EditableValue>
  )
}

export type ChoiceCellProps<T extends string> = {
  /** The cell's name, column and row: "Colour of Home". */
  label: string
  /** The saved value. */
  value: T
  /** Every value, in the order the list shows them. */
  options: readonly T[]
  /** How a value shows: at rest, on the open trigger and in the list (a swatch and its word). */
  render: (value: T) => ReactNode
  /** Saves the picked value. Rejects with the AppError. */
  save: (value: T) => Promise<unknown>
  /** The trigger's width class. Defaults to `w-40`. */
  triggerClassName?: string
}

/** A single choice: its list opens with the cell, a pick saves, closing it with no pick gives up. */
export function ChoiceCell<T extends string>({
  label,
  value,
  options,
  render,
  save,
  triggerClassName = 'w-40',
}: ChoiceCellProps<T>) {
  return (
    <EditableValue
      label={label}
      layout="inline"
      edit={editInPlace<T>({
        kind: 'choice',
        value,
        save,
        control: (props) => (
          <Select
            value={props.value}
            onValueChange={(next) => {
              if (next) props.commit(next as T)
            }}
            disabled={props.disabled}
            defaultOpen
            modal={false}
            onOpenChange={(open) => {
              if (!open) props.cancel()
            }}
          >
            <SelectTrigger
              id={props.id}
              className={triggerClassName}
              aria-invalid={props.invalid || undefined}
              aria-label={props.label}
              aria-describedby={props.describedBy}
            >
              <SelectValue>{(shown: T) => render(shown)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {render(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      })}
    >
      {render(value)}
    </EditableValue>
  )
}

export type LinkCellProps = {
  /** The cell's name, column and row: "Website of Home". */
  label: string
  /** The saved address, or null when there's none. */
  value: string | null
  /** Saves the address, or null to clear it (the box left blank). Rejects with the AppError. */
  save: (link: string | null) => Promise<unknown>
  /** The link's text at rest. Defaults to the address without its scheme. */
  linkText?: string | ((href: string) => ReactNode)
  /** What the cell says with no address. Defaults to "Not set". */
  emptyLabel?: string
  /** The input's width class. Defaults to `w-64`. */
  inputClassName?: string
}

// A web or email address (`example.com` gains https://), blank for none.
// Another scheme (`javascript:`) is refused before anything is sent.
const LINK_RULE: Schema<string | null> = {
  safeParse: (value: unknown) => {
    const href = linkHref(String(value ?? ''))
    if (href === '') return { success: true, data: null }
    if (href === null) {
      return { success: false, error: { issues: [{ message: 'Use a web or email address' }] } }
    }
    return { success: true, data: href }
  },
}

function shownLinkText(href: string, linkText: LinkCellProps['linkText']) {
  if (typeof linkText === 'function') return linkText(href)
  return linkText ?? href.replace(/^(https?:\/\/|mailto:)/i, '').replace(/\/$/, '')
}

/** An optional link: shown as a link out (or the not-set label), edited as one line; blank clears it. */
export function LinkCell({ label, value, save, linkText, emptyLabel = 'Not set', inputClassName = 'w-64' }: LinkCellProps) {
  // Only an address the editor would have saved is shown as a link: a
  // stored `javascript:` reads as text, never as something to click.
  const href = value ? linkHref(value) : null
  return (
    <EditableValue
      label={label}
      layout="inline"
      edit={editInPlace<string, string | null>({
        kind: 'text',
        value: value ?? '',
        schema: LINK_RULE,
        save,
        control: (props) => (
          <Input
            id={props.id}
            type="url"
            inputMode="url"
            className={inputClassName}
            value={props.value}
            placeholder="https://"
            readOnly={props.disabled}
            aria-invalid={props.invalid || undefined}
            aria-label={props.label}
            aria-describedby={props.describedBy}
            onChange={(event) => props.onChange(event.target.value)}
          />
        ),
      })}
    >
      {!value ? (
        <span className="text-muted-foreground">{emptyLabel}</span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-link underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {shownLinkText(href, linkText)}
          <ExternalLinkIcon aria-hidden="true" className="ml-0.5 inline size-3 align-baseline" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        value
      )}
    </EditableValue>
  )
}
