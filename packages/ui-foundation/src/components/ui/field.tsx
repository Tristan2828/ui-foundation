import { useLayoutEffect, useMemo, useRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { fieldRows, type FieldKind, type FieldSize } from "@/lib/field-rows"

// The foundation's additions to shadcn's Field (4.85, the form standard):
//
// - FieldGroup lays its fields out itself: consecutive short fields
//   (`<Field size="s" | "m" | "l">`) share a row, up to three, each as
//   wide as its size; `<Field solo>` keeps a short one alone
//   (lib/field-rows.ts has the rule). Below 48rem each takes its own row
//   but two dates or two numbers. A choice (a Field holding ChoiceButtons,
//   4.98) shares a row only with another choice, and two choices stay side
//   by side on a phone while both fit. The rows are worked out from the DOM, so
//   a Field inside the app's own component still counts.
// - Compact: 14px between fields and 32px controls (40px under 48rem or
//   on a touch screen), from `--control-height`, which FieldGroup sets
//   and the inputs, selects and buttons read (styles/index.css).
// - `<FieldLabel required>`: an asterisk in the destructive text tone,
//   hidden from screen readers, and `aria-required` on the control it
//   names, which says it instead.

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  )
}

// What a Field holds, when it doesn't say (`kind`): a date or a number
// box keeps its partner on a phone.
// DateField marks its own box (`data-kind="date"`, 4.88).
const DATE_CONTROL = "input[type=date], [data-kind=date]"
const NUMBER_CONTROL = "input[type=number], input[inputmode=numeric], input[inputmode=decimal]"

// A row of choice buttons (ChoiceButtons, 4.98): two to a row (9C).
const CHOICE_CONTROL = "[data-slot=choice-buttons]"

function kindOf(field: HTMLElement): FieldKind | null {
  const said = field.dataset.kind
  if (said === "date" || said === "number" || said === "choice") return said
  if (field.querySelector(CHOICE_CONTROL)) return "choice"
  if (field.querySelector(DATE_CONTROL)) return "date"
  if (field.querySelector(NUMBER_CONTROL)) return "number"
  return null
}

const SIZES = new Set(["s", "m", "l", "full"])

/** Puts each of the group's own fields in its row (lib/field-rows.ts). */
function layOut(group: HTMLElement) {
  const children = Array.from(group.children) as HTMLElement[]
  const items = children.map((child) => {
    const isField = child.dataset.slot === "field"
    const size = isField ? child.dataset.size : undefined
    return {
      size: (size && SIZES.has(size) ? size : "full") as FieldSize,
      solo: child.dataset.solo !== undefined,
      kind: isField ? kindOf(child) : null,
    }
  })
  fieldRows(items).forEach((place, at) => {
    const child = children[at]
    if (place.share === null) {
      child.style.removeProperty("--field-share")
      child.style.removeProperty("--field-gaps")
      delete child.dataset.fieldRow
      delete child.dataset.phonePair
      delete child.dataset.phoneFit
      return
    }
    child.style.setProperty("--field-share", String(place.share))
    child.style.setProperty("--field-gaps", String(place.gaps))
    child.dataset.fieldRow = ""
    if (place.phonePair) child.dataset.phonePair = ""
    else delete child.dataset.phonePair
    if (place.phoneFit) child.dataset.phoneFit = ""
    else delete child.dataset.phoneFit
  })
}

function FieldGroup({ className, ref, ...props }: React.ComponentProps<"div">) {
  const own = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const group = own.current
    if (!group) return
    layOut(group)
    // Fields come and go (a conditional field, an error line), and a
    // field's size can change: lay it out again. Only what layOut reads
    // is watched, so its own writes don't wake it.
    const observer = new MutationObserver(() => layOut(group))
    observer.observe(group, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-size", "data-solo", "data-kind", "type", "inputmode"],
    })
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={(node) => {
        own.current = node
        if (typeof ref === "function") return ref(node)
        if (ref) ref.current = node
      }}
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-wrap gap-x-3 gap-y-3.5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-y-3.5 has-[>[data-slot=form-section]]:gap-y-6",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-2 data-[invalid=true]:text-destructive-text",
  {
    variants: {
      orientation: {
        vertical: "flex-col gap-1.5 *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  size,
  solo = false,
  kind,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    /**
     * How much it holds, so FieldGroup can put short fields side by side:
     * `s` a number or a short code, `m` a date, a status, a choice of two
     * to four or a rating, `l` a name or a pick of a record, `full` (the
     * default) long text, a list or anything that needs the row.
     */
    size?: FieldSize
    /** Keep this short field on a row of its own, where a pairing would read wrong. */
    solo?: boolean
    /**
     * A date or a number: two of a kind stay side by side on a phone.
     * `choice`: two to a row, side by side on a phone while both fit.
     * Found by itself for a date or number `<input>`, DateField (which
     * marks itself, 4.88) and ChoiceButtons; say it for a control of your own.
     */
    kind?: FieldKind
  }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      data-size={size}
      data-solo={solo ? "" : undefined}
      data-kind={kind}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
        className
      )}
      {...props}
    />
  )
}

const REQUIRABLE_ROLES = new Set(["combobox", "textbox", "listbox", "radiogroup", "spinbutton", "searchbox", "gridcell", "tree", "treegrid", "checkbox", "switch"])

/** Whether `aria-required` is allowed on it: a form control, or a role that takes it. */
function takesRequired(control: HTMLElement): boolean {
  const role = control.getAttribute("role")
  if (role) return REQUIRABLE_ROLES.has(role)
  if (control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) return true
  if (control instanceof HTMLInputElement) return !["button", "submit", "reset", "image", "hidden"].includes(control.type)
  return false
}

function FieldLabel({
  className,
  required = false,
  children,
  ...props
}: React.ComponentProps<typeof Label> & {
  /**
   * A field that must be filled: an asterisk after the words, and
   * `aria-required` on the control `htmlFor` names where its role takes
   * it (a box, a select, a combobox; not a date picker's button). Nothing
   * marks an optional one (no "(optional)").
   */
  required?: boolean
}) {
  const { htmlFor } = props
  useLayoutEffect(() => {
    if (!required || !htmlFor) return
    const control = document.getElementById(htmlFor)
    // Only where the control's role takes it (ARIA): a box, a list or a
    // group of choices, not a button (a date picker's trigger).
    if (!control || !takesRequired(control)) return
    control.setAttribute("aria-required", "true")
    return () => control.removeAttribute("aria-required")
  }, [required, htmlFor])
  return (
    <Label
      data-slot="field-label"
      data-required={required ? "" : undefined}
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden="true" data-slot="field-required" className="-ml-1.5 text-destructive-text">
          *
        </span>
      )}
    </Label>
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
        "last:mt-0 nth-last-2:-mt-1",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive-text", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
