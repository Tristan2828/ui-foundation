// Ready-made fields for editing in place (cell-patterns.md "Editable
// value", "Presets"): `inPlace.text`, `.number`, `.date`, `.monthDay`,
// `.money`, `.select`, `.reference`, `.link`, and `.fields` for two or more values
// edited and saved as one. Each carries its own control, its check (run
// before anything is sent, its message under the field) and how the value
// reads at rest (`shown`, which EntityView and EditableValue show when
// the screen gives no value of its own), so a screen writes one line per
// field:
//
//   { label: 'Price', edit: inPlace.money({ value: w.price, save: (price) => save({ price }) }) }
//
// A preset is an `EditInPlace` like any `editInPlace({...})`: the same
// store, the same saving and refusing, the same leave prompt. A field
// whose control is the app's own (the form's, from `<entity>-fields.tsx`)
// keeps `editInPlace` with that control.
import type { ReactNode } from 'react'
import type { AppError } from '@/api/contracts'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { linkHost, linkRule } from '@/lib/link-href'
import { formatMonthDay, monthDayProblem, type MonthDay } from '@/lib/month-day'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import { DateField } from './date-field'
import { MonthDayField } from './month-day-field'
import type { EditControlProps, EditInPlace } from './edit-in-place'
import { NONE, Parts, ReferencePicker } from './edit-in-place-controls'
import { LinkOut } from './row-edit-cells'

// ─── One kind of control ────────────────────────────────────────────────

import type { AnyKind, Checked, Kind } from './edit-in-place-controls'

const REQUIRED = 'Required'

// The props every control spreads onto its element.
function controlAria(props: Pick<EditControlProps<unknown>, 'label' | 'describedBy' | 'invalid'>) {
  return {
    'aria-label': props.label,
    'aria-describedby': props.describedBy,
    'aria-invalid': props.invalid || undefined,
  }
}

// ─── Options ────────────────────────────────────────────────────────────

/** What the value saves as: with `required: true` never `null` (a blank is refused). */
export type InPlaceSaved<TValue, TRequired extends boolean> = TRequired extends true ? TValue : TValue | null

type Common<TValue, TSaved> = {
  /** The saved value. */
  value: TValue
  /** Saves the checked value (the entity's single-field save, `mutateAsync`). Rejects with the AppError. */
  save: (value: TSaved) => Promise<unknown>
  /** How the value reads at rest, in place of the preset's own (a badge, a link to the record). */
  shown?: ReactNode
}

/** One line of text. Blank saves `null` unless `required`. */
export type InPlaceTextConfig<TRequired extends boolean = boolean> = {
  /** A blank is refused ("Required"). */
  required?: TRequired
  /** The most characters it takes. */
  maxLength?: number
  placeholder?: string
}

/** A number typed in one line. Blank saves `null` unless `required`. */
export type InPlaceNumberConfig<TRequired extends boolean = boolean> = {
  required?: TRequired
  /** The smallest it may be ("At least 0"). */
  min?: number
  /** The largest it may be ("At most 10"). */
  max?: number
  /** Whole numbers only. */
  integer?: boolean
  /** Shown after the number, at rest and beside the box ("kg", "min"). */
  unit?: string
  placeholder?: string
  locale?: string
}

/**
 * An amount of money, two decimals, as the API writes a decimal: a string
 * (`"1234.50"`). It reads as the currency formats it ("$1,234.50"); `$`
 * and thousands separators typed in are fine. Blank saves `null` unless `required`.
 */
export type InPlaceMoneyConfig<TRequired extends boolean = boolean> = {
  required?: TRequired
  /** ISO 4217 code. Defaults to `USD`. */
  currency?: string
  /** For the symbol and the separators. Defaults to `en-US`. */
  locale?: string
  /** The smallest amount. Defaults to 0: no negative amounts. */
  min?: number
  /** The largest amount. */
  max?: number
  placeholder?: string
}

/** A plain day, `'YYYY-MM-DD'` (DateField). Not `required`: Clear saves `null`. */
export type InPlaceDateConfig<TRequired extends boolean = boolean> = {
  required?: TRequired
  /** How the day reads. Defaults to `{ dateStyle: 'medium' }`. */
  format?: Intl.DateTimeFormatOptions
  locale?: string
  placeholder?: string
}

/**
 * A month and day with no year, `'MM-DD'` (MonthDayField): something that
 * comes round every year. Not `required`: Clear saves `null`. February 29
 * is a day; a stored `'02-30'` is refused ("February has 29 days").
 */
export type InPlaceMonthDayConfig<TRequired extends boolean = boolean> = {
  required?: TRequired
  /** How the day reads. Defaults to `{ month: 'short', day: 'numeric' }` ("Mar 14"). */
  format?: Pick<Intl.DateTimeFormatOptions, 'month' | 'day'>
  locale?: string
  placeholder?: string
}

/** One option of a select: its value and its words. */
export type InPlaceOption<T> = { value: T; label: string }

/** One of a fixed list. Not `required`: the list starts with "Not set", which saves `null`. */
export type InPlaceSelectConfig<T extends string | number, TRequired extends boolean = boolean> = {
  required?: TRequired
  /** Every option, in the order the list shows them. */
  options: readonly InPlaceOption<T>[]
  /** How an option reads, at rest, on the trigger and in the list (a badge). Defaults to its label. */
  render?: (value: T, label: string) => ReactNode
  /** The "Not set" option's words. */
  emptyLabel?: string
  placeholder?: string
}

/** A record found by search, as `search` returns it. */
export type InPlaceRecord<Id> = { id: Id; label: string }

/**
 * Another record, picked from a list searched as you type. The package
 * knows no endpoint: `search` is the app's (its gateway's search, by
 * name), called with what's typed (`''` when the list opens).
 */
export type InPlaceReferenceConfig<Id extends string | number, TRequired extends boolean = boolean> = {
  required?: TRequired
  /** Finds records by what's typed. Rejects to show nothing found. */
  search: (text: string) => Promise<readonly InPlaceRecord<Id>[]>
  /** The saved record's name (the view's lookup by id), shown at rest and in the box. */
  label?: string
  /** The "Not set" option's words, for an optional reference. */
  emptyLabel?: string
  placeholder?: string
  /** What the list says when nothing matches. Defaults to "No matches." */
  emptyText?: string
}

/** A link: its address and an optional label, as the app maps them to its own fields. */
export type InPlaceLinkValue = { url: string | null; label: string | null }

export type InPlaceLinkConfig = {
  /** The address box's placeholder. Defaults to `https://`. */
  placeholder?: string
  /** What reads at rest with no address. Defaults to the field's "Not set". */
  emptyLabel?: string
}

/** One part of `inPlace.fields`: its label and its kind's options. */
export type InPlacePart =
  | ({ kind: 'text'; label: string } & InPlaceTextConfig)
  | ({ kind: 'number'; label: string } & InPlaceNumberConfig)
  | ({ kind: 'money'; label: string } & InPlaceMoneyConfig)
  | ({ kind: 'date'; label: string } & InPlaceDateConfig)
  | ({ kind: 'monthDay'; label: string } & InPlaceMonthDayConfig)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each part's own option type; checked where it's written
  | ({ kind: 'select'; label: string } & InPlaceSelectConfig<any>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
  | ({ kind: 'reference'; label: string } & InPlaceReferenceConfig<any>)

/**
 * Two or more of the record's fields edited as one value and saved
 * together, with a rule across them (a model and an effort that must agree).
 */
export type InPlaceFieldsOptions<T extends Record<string, unknown>> = {
  /** The saved values, keyed by the record's field names (`{ model, effort }`). */
  value: T
  /** Each value's part, in the order they show: its label and kind. */
  fields: { [K in keyof T]: InPlacePart }
  /**
   * The rule across them, run once every part's own check passes: the
   * message to show on the pair, or `null` when they agree.
   */
  rule?: (value: T) => string | null
  /** Saves them together (one PATCH of every field). A 422 about one of them shows on its part. */
  save: (value: T) => Promise<unknown>
  /** How the pair reads at rest. Defaults to each part's value, joined by " · ". */
  shown?: ReactNode
}

// ─── The kinds ──────────────────────────────────────────────────────────

const blank = (text: string) => text.trim() === ''

function textKind(config: InPlaceTextConfig): Kind<string | null, string> {
  return {
    editKind: 'text',
    toDraft: (value) => value ?? '',
    check: (draft) => {
      const text = draft.trim()
      if (text === '') return config.required ? { ok: false, message: REQUIRED } : { ok: true, value: null }
      if (config.maxLength !== undefined && text.length > config.maxLength)
        return { ok: false, message: `At most ${config.maxLength} characters` }
      return { ok: true, value: text }
    },
    show: (value) => (value ? value : null),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        placeholder={config.placeholder}
        readOnly={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        {...controlAria(props)}
      />
    ),
  }
}

function numberKind(config: InPlaceNumberConfig): Kind<number | null, string> {
  const format = new Intl.NumberFormat(config.locale)
  return {
    editKind: 'text',
    toDraft: (value) => (value == null ? '' : String(value)),
    check: (draft) => {
      if (blank(draft)) return config.required ? { ok: false, message: REQUIRED } : { ok: true, value: null }
      const typed = draft.trim().replace(/,/g, '')
      const number = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(typed) ? Number(typed) : Number.NaN
      if (!Number.isFinite(number)) return { ok: false, message: 'Enter a number' }
      if (config.integer && !Number.isInteger(number)) return { ok: false, message: 'Enter a whole number' }
      if (config.min !== undefined && number < config.min) return { ok: false, message: `At least ${format.format(config.min)}` }
      if (config.max !== undefined && number > config.max) return { ok: false, message: `At most ${format.format(config.max)}` }
      return { ok: true, value: number }
    },
    show: (value) => (value == null ? null : config.unit ? `${format.format(value)} ${config.unit}` : format.format(value)),
    control: (props) => {
      const input = {
        id: props.id,
        inputMode: config.integer && (config.min ?? 0) >= 0 ? ('numeric' as const) : ('decimal' as const),
        value: props.value,
        placeholder: config.placeholder,
        readOnly: props.disabled,
        onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
        ...controlAria(props),
      }
      if (!config.unit) return <Input {...input} />
      return (
        <InputGroup>
          <InputGroupInput {...input} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{config.unit}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      )
    },
  }
}

const MONEY = /^(-)?(\d+)(?:\.(\d{0,2}))?$/

function moneyKind(config: InPlaceMoneyConfig): Kind<string | number | null, string> {
  const locale = config.locale ?? 'en-US'
  const currency = config.currency ?? 'USD'
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const symbol = money.formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency
  const min = config.min ?? 0
  return {
    editKind: 'text',
    toDraft: (value) => {
      if (value == null || value === '') return ''
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(2) : String(value)
    },
    check: (draft) => {
      if (blank(draft)) return config.required ? { ok: false, message: REQUIRED } : { ok: true, value: null }
      // `$1,234.5` is 1234.50: the symbol, spaces and separators go.
      const typed = draft.replaceAll(symbol, '').replace(/[\s,]/g, '')
      const match = MONEY.exec(typed)
      if (!match) return { ok: false, message: 'Enter an amount, like 12.50' }
      // Built from the digits, never through a float: 0.1 + 0.2 stays 0.30.
      const amount = `${match[1] ?? ''}${String(Number(match[2]))}.${(match[3] ?? '').padEnd(2, '0')}`
      const number = Number(amount)
      if (number < min) return { ok: false, message: `At least ${money.format(min)}` }
      if (config.max !== undefined && number > config.max) return { ok: false, message: `At most ${money.format(config.max)}` }
      return { ok: true, value: amount === '-0.00' ? '0.00' : amount }
    },
    show: (value) => {
      if (value == null || value === '') return null
      const number = Number(value)
      return Number.isFinite(number) ? money.format(number) : String(value)
    },
    control: (props) => (
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>{symbol}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={props.id}
          inputMode="decimal"
          value={props.value}
          placeholder={config.placeholder ?? '0.00'}
          readOnly={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          {...controlAria(props)}
        />
      </InputGroup>
    ),
  }
}

function dateKind(config: InPlaceDateConfig): Kind<PlainDate | null, PlainDate> {
  return {
    editKind: 'choice',
    toDraft: (value) => value ?? '',
    check: (draft) => {
      if (draft === '') return config.required ? { ok: false, message: REQUIRED } : { ok: true, value: null }
      return formatPlainDate(draft) === '' ? { ok: false, message: 'Pick a date' } : { ok: true, value: draft }
    },
    show: (value) => (value ? formatPlainDate(value, config.format, config.locale) || value : null),
    control: (props, alone) => (
      <DateField
        id={props.id}
        value={props.value}
        // Alone, a pick saves and the calendar opens with the field; closing
        // it with nothing picked gives up (a pick has already saved by then).
        onChange={alone ? (day) => props.commit(day) : props.onChange}
        clearable={!config.required}
        placeholder={config.placeholder}
        format={config.format}
        locale={config.locale}
        invalid={props.invalid}
        readOnly={props.disabled}
        defaultOpen={alone}
        modal={alone ? false : undefined}
        onOpenChange={
          alone
            ? (open) => {
                if (!open) props.cancel()
              }
            : undefined
        }
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  }
}

function monthDayKind(config: InPlaceMonthDayConfig): Kind<MonthDay | null, MonthDay> {
  return {
    editKind: 'choice',
    toDraft: (value) => value ?? '',
    check: (draft) => {
      if (draft === '') return config.required ? { ok: false, message: REQUIRED } : { ok: true, value: null }
      const problem = monthDayProblem(draft, config.locale)
      return problem ? { ok: false, message: problem } : { ok: true, value: draft }
    },
    // A stored value that isn't a day of the year reads as written.
    show: (value) => (value ? formatMonthDay(value, config.format, config.locale) || value : null),
    control: (props, alone) => (
      <MonthDayField
        id={props.id}
        value={props.value}
        // Alone, a pick saves and the picker opens with the field; closing
        // it with nothing picked gives up (a pick has already saved by then).
        onChange={alone ? (day) => props.commit(day) : props.onChange}
        clearable={!config.required}
        placeholder={config.placeholder}
        format={config.format}
        locale={config.locale}
        invalid={props.invalid}
        readOnly={props.disabled}
        defaultOpen={alone}
        modal={alone ? false : undefined}
        onOpenChange={
          alone
            ? (open) => {
                if (!open) props.cancel()
              }
            : undefined
        }
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  }
}

function selectKind<T extends string | number>(config: InPlaceSelectConfig<T>): Kind<T | null, T | null> {
  const labelOf = (value: T) => config.options.find((option) => option.value === value)?.label ?? String(value)
  const shownOf = (value: T) => (config.render ? config.render(value, labelOf(value)) : labelOf(value))
  const keyOf = (value: T | null) => {
    const at = value == null ? -1 : config.options.findIndex((option) => option.value === value)
    return at === -1 ? null : String(at)
  }
  const valueOf = (key: string | null): T | null => (key === null || key === NONE ? null : (config.options[Number(key)]?.value ?? null))
  const emptyLabel = config.emptyLabel ?? 'Not set'
  return {
    editKind: 'choice',
    toDraft: (value) => value,
    check: (draft) => (draft == null && config.required ? { ok: false, message: REQUIRED } : { ok: true, value: draft }),
    show: (value) => (value == null ? null : shownOf(value)),
    control: (props, alone) => (
      <Select
        value={keyOf(props.value) ?? (config.required ? null : NONE)}
        onValueChange={(key) => {
          if (key === null) return
          const picked = valueOf(key as string)
          if (alone) props.commit(picked)
          else props.onChange(picked)
        }}
        disabled={props.disabled}
        defaultOpen={alone}
        modal={false}
        onOpenChange={
          alone
            ? (open) => {
                if (!open) props.cancel()
              }
            : undefined
        }
      >
        <SelectTrigger id={props.id} className="min-w-40" {...controlAria(props)}>
          <SelectValue placeholder={config.placeholder ?? 'Pick one'}>
            {(key: string | null) => {
              const value = valueOf(key)
              return value == null ? (key === NONE ? emptyLabel : (config.placeholder ?? 'Pick one')) : shownOf(value)
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {!config.required && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {config.options.map((option, index) => (
            <SelectItem key={String(option.value)} value={String(index)}>
              {shownOf(option.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
  }
}

function referenceKind<Id extends string | number>(config: InPlaceReferenceConfig<Id>): Kind<Id | null, Id | null> {
  return {
    editKind: 'choice',
    toDraft: (value) => value,
    check: (draft) => (draft == null && config.required ? { ok: false, message: REQUIRED } : { ok: true, value: draft }),
    show: (value) => (value == null ? null : (config.label ?? String(value))),
    control: (props, alone) => <ReferencePicker props={props} alone={alone} config={config} />,
  }
}

// A link's address: `linkRule` (LinkCell's), which also says what's refused.
function urlKind(config: InPlaceLinkConfig): Kind<string | null, string> {
  return {
    editKind: 'text',
    toDraft: (value) => value ?? '',
    check: (draft) => {
      const result = linkRule.safeParse(draft)
      return result.success ? { ok: true, value: result.data } : { ok: false, message: result.error.issues[0]!.message }
    },
    show: (value) => value,
    control: (props) => (
      <Input
        id={props.id}
        type="url"
        inputMode="url"
        value={props.value}
        placeholder={config.placeholder ?? 'https://'}
        readOnly={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        {...controlAria(props)}
      />
    ),
  }
}

function kindOf(part: InPlacePart): AnyKind {
  switch (part.kind) {
    case 'text':
      return textKind(part)
    case 'number':
      return numberKind(part)
    case 'money':
      return moneyKind(part)
    case 'date':
      return dateKind(part)
    case 'monthDay':
      return monthDayKind(part)
    case 'select':
      return selectKind(part)
    case 'reference':
      return referenceKind(part)
  }
}

// ─── A field of one kind ────────────────────────────────────────────────

// Two drafts are the same value when both check to the same thing (`12`
// and `12.0`, `$5` and `5.00`), else when they're the same text.
function sameValue<TDraft>(check: (draft: TDraft) => Checked<unknown>) {
  return (a: TDraft, b: TDraft) => {
    const [left, right] = [check(a), check(b)]
    if (left.ok && right.ok) return JSON.stringify(left.value) === JSON.stringify(right.value)
    return JSON.stringify(a) === JSON.stringify(b)
  }
}

function single<TValue, TDraft>(kind: Kind<TValue, TDraft>, options: Common<TValue, never>): EditInPlace {
  return {
    kind: kind.editKind,
    value: kind.toDraft(options.value),
    control: (props) => kind.control(props as EditControlProps<TDraft>, true),
    schema: {
      safeParse: (draft) => {
        const checked = kind.check(draft as TDraft)
        return checked.ok ? { success: true, data: checked.value } : { success: false, error: { issues: [{ message: checked.message }] } }
      },
    },
    save: options.save as (value: unknown) => Promise<unknown>,
    isEqual: sameValue(kind.check) as (a: unknown, b: unknown) => boolean,
    shown: options.shown !== undefined ? options.shown : kind.show(options.value),
  }
}

// ─── Several fields as one ──────────────────────────────────────────────

type Issue = { message: string; path?: readonly PropertyKey[] }

// Which parts a refusal names: the check's issues (each part's own, by
// its key), or a 422's field errors (`model`, `effort.level`).
function partErrors(keys: readonly string[], cause: unknown): Record<string, string> | null {
  const errors: Record<string, string> = {}
  if (cause && typeof cause === 'object' && 'issues' in cause) {
    for (const issue of (cause as { issues: readonly Issue[] }).issues) {
      const key = issue.path?.[0]
      if (typeof key === 'string' && keys.includes(key) && !(key in errors)) errors[key] = issue.message
    }
  } else if (cause && typeof cause === 'object' && 'kind' in cause) {
    for (const [field, messages] of Object.entries((cause as AppError).fieldErrors ?? {})) {
      const key = keys.find((name) => field === name || field.startsWith(`${name}.`))
      if (key && !(key in errors) && messages[0]) errors[key] = messages[0]
    }
  }
  return Object.keys(errors).length > 0 ? errors : null
}

function fieldsInPlace<T extends Record<string, unknown>>(options: InPlaceFieldsOptions<T>): EditInPlace {
  const keys = Object.keys(options.fields)
  const parts = options.fields as Record<string, InPlacePart>
  const kinds = Object.fromEntries(keys.map((key) => [key, kindOf(parts[key]!)])) as Record<string, AnyKind>
  const value = options.value as Record<string, unknown>
  const check = (draft: Record<string, unknown>): Checked<T> & { issues?: Issue[] } => {
    const issues: Issue[] = []
    const checked: Record<string, unknown> = {}
    for (const key of keys) {
      const result = kinds[key]!.check(draft[key])
      if (result.ok) checked[key] = result.value
      else issues.push({ message: `${parts[key]!.label}: ${result.message}`, path: [key] })
    }
    if (issues.length > 0) return { ok: false, message: issues[0]!.message, issues }
    const message = options.rule?.(checked as T) ?? null
    return message === null ? { ok: true, value: checked as T } : { ok: false, message, issues: [{ message }] }
  }
  // Enter saves when every part is typed into; with a list among them,
  // Enter is the list's, and leaving or Ctrl/Cmd+Enter saves.
  const typed = keys.every((key) => kinds[key]!.editKind === 'text')
  const shownParts = keys.map((key) => kinds[key]!.show(value[key])).filter((shown) => shown !== null && shown !== '')
  return {
    kind: typed ? 'text' : 'multi',
    value: Object.fromEntries(keys.map((key) => [key, kinds[key]!.toDraft(value[key])])),
    control: (props) => (
      <Parts props={props as EditControlProps<Record<string, unknown>>} keys={keys} parts={parts} kinds={kinds} />
    ),
    schema: {
      safeParse: (draft) => {
        const result = check(draft as Record<string, unknown>)
        return result.ok ? { success: true, data: result.value } : { success: false, error: { issues: result.issues ?? [] } }
      },
    },
    save: options.save as (value: unknown) => Promise<unknown>,
    isEqual: sameValue((draft: unknown) => {
      const checked: Record<string, unknown> = {}
      for (const key of keys) {
        const result = kinds[key]!.check((draft as Record<string, unknown>)[key])
        if (!result.ok) return result
        checked[key] = result.value
      }
      return { ok: true, value: checked }
    }) as (a: unknown, b: unknown) => boolean,
    fieldErrors: (cause) => partErrors(keys, cause),
    errorsOnFields: true,
    shown:
      options.shown !== undefined
        ? options.shown
        : shownParts.length === 0
          ? null
          : shownParts.map((shown, index) => (
              <span key={index}>
                {index > 0 && ' · '}
                {shown}
              </span>
            )),
  }
}

// ─── A link ─────────────────────────────────────────────────────────────

function linkInPlace(
  options: Common<InPlaceLinkValue, InPlaceLinkValue> & InPlaceLinkConfig,
): EditInPlace {
  const { url, label } = options.value
  const href = url ? linkRule.safeParse(url) : null
  // Only an address the box would have saved is a link: a stored
  // `javascript:` reads as text, never as something to click.
  const shown =
    options.shown !== undefined
      ? options.shown
      : !url
        ? (options.emptyLabel ? <span className="text-muted-foreground">{options.emptyLabel}</span> : null)
        : href?.success && href.data
          ? <LinkOut href={href.data}>{label || linkHost(href.data)}</LinkOut>
          : url
  const urls = urlKind(options)
  const labels = textKind({ placeholder: 'Label (optional)' })
  const kinds: Record<string, AnyKind> = { url: urls, label: labels }
  const parts: Record<string, InPlacePart> = {
    url: { kind: 'text', label: 'URL' },
    label: { kind: 'text', label: 'Label' },
  }
  const check = (draft: Record<string, unknown>) => {
    const address = urls.check(draft.url as string)
    if (!address.ok) return { success: false as const, error: { issues: [{ message: address.message, path: ['url'] }] } }
    const words = labels.check(draft.label as string)
    if (!words.ok) return { success: false as const, error: { issues: [{ message: words.message, path: ['label'] }] } }
    if (address.value === null && words.value !== null)
      return { success: false as const, error: { issues: [{ message: 'Add the address, or clear the label', path: ['url'] }] } }
    return { success: true as const, data: { url: address.value, label: words.value } }
  }
  return {
    // Enter in either box saves, as a one-line field does.
    kind: 'text',
    value: { url: url ?? '', label: label ?? '' },
    control: (props) => (
      <Parts props={props as EditControlProps<Record<string, unknown>>} keys={['url', 'label']} parts={parts} kinds={kinds} />
    ),
    save: options.save as (value: unknown) => Promise<unknown>,
    fieldErrors: (cause) => partErrors(['url', 'label'], cause),
    errorsOnFields: true,
    schema: { safeParse: (draft) => check(draft as Record<string, unknown>) },
    isEqual: (a, b) => {
      const [left, right] = [check(a as Record<string, unknown>), check(b as Record<string, unknown>)]
      if (left.success && right.success) return JSON.stringify(left.data) === JSON.stringify(right.data)
      return JSON.stringify(a) === JSON.stringify(b)
    },
    shown,
  }
}

// ─── The presets ────────────────────────────────────────────────────────

/**
 * Ready-made fields for editing in place, one per kind of control. Each
 * returns an `EditInPlace` carrying its control, its check and how it
 * reads at rest (`shown`), so a field is one line:
 * `{ label: 'Due', edit: inPlace.date({ value: task.due, save: (due) => save({ due }) }) }`.
 */
export const inPlace = {
  /** One line of text; Enter saves. Trimmed; blank saves `null` unless `required`. */
  text<R extends boolean = false>(options: Common<string | null | undefined, InPlaceSaved<string, R>> & InPlaceTextConfig<R>) {
    return single(textKind(options), { ...options, value: options.value ?? null } as Common<string | null, never>)
  },
  /** A number in one line, checked against `min`, `max` and `integer`; `unit` reads after it. */
  number<R extends boolean = false>(options: Common<number | null | undefined, InPlaceSaved<number, R>> & InPlaceNumberConfig<R>) {
    return single(numberKind(options), { ...options, value: options.value ?? null } as Common<number | null, never>)
  },
  /** Money, two decimals, saved as the decimal string (`"1234.50"`), shown as "$1,234.50". */
  money<R extends boolean = false>(
    options: Common<string | number | null | undefined, InPlaceSaved<string, R>> & InPlaceMoneyConfig<R>,
  ) {
    return single(moneyKind(options), { ...options, value: options.value ?? null } as Common<string | number | null, never>)
  },
  /** A plain day (`'YYYY-MM-DD'`) in DateField's calendar, which opens with the field; a pick saves. */
  date<R extends boolean = false>(options: Common<PlainDate | null | undefined, InPlaceSaved<PlainDate, R>> & InPlaceDateConfig<R>) {
    return single(dateKind(options), { ...options, value: options.value || null } as Common<PlainDate | null, never>)
  },
  /**
   * A month and day with no year (`'MM-DD'`, every year's March 14) in
   * MonthDayField's picker, which opens with the field; a pick saves.
   * Reads as "Mar 14"; February 29 is a day, February 30 is refused.
   */
  monthDay<R extends boolean = false>(
    options: Common<MonthDay | null | undefined, InPlaceSaved<MonthDay, R>> & InPlaceMonthDayConfig<R>,
  ) {
    return single(monthDayKind(options), { ...options, value: options.value || null } as Common<MonthDay | null, never>)
  },
  /** One of a fixed list; its list opens with the field and a pick saves. */
  select<T extends string | number, R extends boolean = false>(
    options: Common<T | null | undefined, InPlaceSaved<T, R>> & InPlaceSelectConfig<T, R>,
  ) {
    return single(selectKind(options), { ...options, value: options.value ?? null } as Common<T | null, never>)
  },
  /** Another record, searched as you type through the app's `search`; a pick saves its id. */
  reference<Id extends string | number, R extends boolean = false>(
    options: Common<Id | null | undefined, InPlaceSaved<Id, R>> & InPlaceReferenceConfig<Id, R>,
  ) {
    return single(referenceKind(options), { ...options, value: options.value ?? null } as Common<Id | null, never>)
  },
  /**
   * A link: at rest its label (or the address's host when it has none),
   * opening in a new tab; edited as two boxes, URL and an optional Label,
   * saved together as `{ url, label }`. The address is checked by
   * `linkRule` (LinkCell's): `example.com` gains https://, another scheme
   * is refused. A blank address with no label saves `{ url: null, label: null }`.
   */
  link(options: Common<InPlaceLinkValue, InPlaceLinkValue> & InPlaceLinkConfig) {
    return linkInPlace(options)
  },
  /**
   * Two or more fields edited as one value and saved together, with a
   * `rule` across them: each part its own control and label, a part's
   * refusal (its own check, or a 422 naming its field) under it, the
   * rule's under them all. Saves on leaving it or Ctrl/Cmd+Enter (and on
   * Enter when every part is typed into).
   */
  fields<T extends Record<string, unknown>>(options: InPlaceFieldsOptions<T>) {
    return fieldsInPlace(options)
  },
}
