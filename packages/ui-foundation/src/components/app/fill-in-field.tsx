// FillInQueue's rows for values that aren't a short choice: text, a number,
// money, a date, and a long list to pick from. Each looks like FillInChoice
// (a label, the control, a suggestion under it) so a record mixes them.
//
// - FillInInput: one text, number, money or date value. The value is the
//   control's own text (`'YYYY-MM-DD'` for a date, `''` for none); the app
//   reads it. A suggestion is a dashed button under it ("Use $12.00"),
//   never filled in for the person.
// - FillInSelect: one value from a list too long for a row of buttons
//   (a reference to another record, a long enum), as a Select.
// - FillInField: given a field as data (`{ name, label, kind, choices }`,
//   as an API describes it), the right row: FillInChoice for up to nine
//   choices, FillInSelect for more, FillInInput for the rest. For a page
//   that draws records it doesn't know in advance.
import { useId, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { DateField } from '@/components/app/date-field'
import { FillInChoice } from '@/components/app/fill-in-queue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatPlainDate } from '@/lib/plain-date'

export type FillInInputKind = 'text' | 'longText' | 'number' | 'money' | 'date'

export interface FillInSuggestion<V> {
  value: V
  /** Why it's suggested: "from similar purchases". */
  note?: ReactNode
}

export interface FillInInputProps {
  label: string
  kind: FillInInputKind
  /** The control's text: `'YYYY-MM-DD'` for a date, a number as typed; `''` for none. */
  value: string
  onChange: (value: string) => void
  /** Offered as a dashed "Use …" button under the control. */
  suggestion?: FillInSuggestion<string>
  /** The currency of a money value, for its symbol and the suggestion. Default "USD". */
  currency?: string
  locale?: string
  placeholder?: string
  className?: string
}

const currencySymbol = (currency: string, locale?: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((part) => part.type === 'currency')
    ?.value ?? currency

function shown(kind: FillInInputKind, value: string, currency: string, locale?: string): string {
  if (kind === 'date') return formatPlainDate(value, { dateStyle: 'medium' }, locale)
  const number = Number(value)
  if (value.trim() === '' || !Number.isFinite(number)) return value
  if (kind === 'money') return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(number)
  if (kind === 'number') return new Intl.NumberFormat(locale).format(number)
  return value
}

/** One text, number, money or date field of a FillInQueue record. */
export function FillInInput({
  label,
  kind,
  value,
  onChange,
  suggestion,
  currency = 'USD',
  locale,
  placeholder,
  className,
}: FillInInputProps) {
  const id = useId()
  const control = (() => {
    switch (kind) {
      case 'date':
        return <DateField id={id} value={value} onChange={onChange} clearable locale={locale} />
      case 'longText':
        return <Textarea id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      case 'money':
        return (
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>{currencySymbol(currency, locale)}</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id={id}
              inputMode="decimal"
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
          </InputGroup>
        )
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      default:
        return <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    }
  })()
  return (
    <div data-slot="fill-in-input" className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      {control}
      {suggestion !== undefined && suggestion.value !== '' && (
        <SuggestionButton
          text={shown(kind, suggestion.value, currency, locale)}
          note={suggestion.note}
          used={value === suggestion.value}
          onUse={() => onChange(suggestion.value)}
        />
      )}
    </div>
  )
}

export interface FillInSelectProps<V extends string | number> {
  label: string
  choices: readonly { value: V; label: ReactNode }[]
  value: V | null | undefined
  onChange: (value: V | null) => void
  suggestion?: FillInSuggestion<V>
  /** What the trigger says with nothing picked. Default "Pick one". */
  placeholder?: string
  className?: string
}

/** One field of a FillInQueue record picked from a long list. */
export function FillInSelect<V extends string | number>({
  label,
  choices,
  value,
  onChange,
  suggestion,
  placeholder = 'Pick one',
  className,
}: FillInSelectProps<V>) {
  const id = useId()
  const keyOf = (v: V) => String(v)
  const byKey = new Map(choices.map((choice) => [keyOf(choice.value), choice]))
  const suggested = suggestion ? byKey.get(keyOf(suggestion.value)) : undefined
  return (
    <div data-slot="fill-in-select" className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <Select
        value={value === null || value === undefined ? null : keyOf(value)}
        onValueChange={(next) => onChange(next === null ? null : (byKey.get(String(next))?.value ?? null))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder}>
            {(key: string | null) => (key === null ? placeholder : (byKey.get(key)?.label ?? key))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={keyOf(choice.value)} value={keyOf(choice.value)}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suggested !== undefined && (
        <SuggestionButton
          text={suggested.label}
          note={suggestion?.note}
          used={value !== null && value !== undefined && keyOf(value) === keyOf(suggested.value)}
          onUse={() => onChange(suggested.value)}
        />
      )}
    </div>
  )
}

function SuggestionButton({ text, note, used, onUse }: { text: ReactNode; note?: ReactNode; used: boolean; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={used}
        onClick={onUse}
        data-slot="fill-in-suggestion"
        className="border-dashed border-info-text"
      >
        Use {text}
      </Button>
      {note !== undefined && note !== null && <span className="type-caption text-muted-foreground">({note})</span>}
    </div>
  )
}

export type FillInFieldKind = 'choice' | 'reference' | FillInInputKind

export type FillInValue = string | number | null

/** A field described as data, as an API sends it. */
export interface FillInFieldSpec {
  name: string
  label: string
  kind: FillInFieldKind
  /** For `choice` and `reference`. */
  choices?: readonly { value: string | number; label: string }[]
  suggestion?: FillInSuggestion<string | number>
}

export interface FillInFieldProps {
  field: FillInFieldSpec
  /** The draft's value: a choice's value, a number for number and money, text for the rest; null for none. */
  value: FillInValue | undefined
  onChange: (value: FillInValue) => void
  /** The number keys pick in this field when it's drawn as a row of choices. One per record. */
  shortcut?: boolean
  currency?: string
  locale?: string
  className?: string
}

const isNumeric = (kind: FillInFieldKind) => kind === 'number' || kind === 'money'

const toText = (value: FillInValue | undefined) => (value === null || value === undefined ? '' : String(value))

/** The row a field's kind calls for: FillInChoice, FillInSelect or FillInInput. */
export function FillInField({ field, value, onChange, shortcut, currency, locale, className }: FillInFieldProps) {
  const { kind, label, choices = [], suggestion } = field
  // A number's text as typed ("1." on the way to "1.5"), kept while it
  // still reads as the draft's value; replaced when the draft changes.
  const [text, setText] = useState(() => toText(value))
  const keeps =
    value === null || value === undefined
      ? text.trim() === '' || !Number.isFinite(Number(text))
      : text.trim() !== '' && Number(text) === value
  if (isNumeric(kind) && !keeps) setText(toText(value))

  if (kind === 'choice' || kind === 'reference') {
    const pick = (next: string | number | null) => onChange(next)
    const current = value === undefined ? null : value
    if (choices.length <= 9) {
      return (
        <FillInChoice
          label={label}
          choices={choices}
          value={current}
          onChange={pick}
          suggestion={suggestion}
          shortcut={shortcut}
          className={className}
        />
      )
    }
    return (
      <FillInSelect label={label} choices={choices} value={current} onChange={pick} suggestion={suggestion} className={className} />
    )
  }

  const numeric = isNumeric(kind)
  return (
    <FillInInput
      label={label}
      kind={kind}
      value={numeric ? text : toText(value)}
      onChange={(next) => {
        if (!numeric) return onChange(next === '' ? null : next)
        setText(next)
        const number = Number(next)
        onChange(next.trim() === '' || !Number.isFinite(number) ? null : number)
      }}
      suggestion={suggestion === undefined ? undefined : { value: String(suggestion.value), note: suggestion.note }}
      currency={currency}
      locale={locale}
      className={className}
    />
  )
}
