// A record's notes on paper: EntityView's Print notes button and the copy
// it prints. Sections marked `print` (the long text: details, prep,
// questions) are printed under the record's title and subtitle, and
// nothing else: no sidebar, no header bar, no rail, no buttons.
//
// The copy is rendered only while printing, into <body> (a portal, so it
// sits beside the app rather than inside its layout), and styles/index.css
// "Printed notes" hides everything else on paper and keeps it light even
// in the dark theme. On screen it never shows. Its content is each
// section's own markup, read-only (PrintingContext): <Markdown> prints
// whole, unfolded, with tables ruled and room in their empty cells to
// write. A section marked `print: { answerSpace: true }` leaves space
// under each item of its numbered lists, for questions answered by hand.
//
// How long the copy stays depends on the browser. A desktop browser blocks
// in window.print() until the dialog closes, so `afterprint` ends it. A
// phone (Android Chrome, iOS Safari) returns from print() at once and
// fires `afterprint` before its preview is built, and a copy that went then
// would leave the preview to print the whole app page. So when print()
// returns in under a second, that early `afterprint` is ignored and the copy
// stays until the person next touches the page (a pointerdown or a key).
// Hidden on screen, it costs nothing to keep. The one visible side effect:
// the browser's own print (Ctrl+P) made before that touch prints the notes
// copy rather than the page. Otherwise Ctrl+P prints the page as it is; only
// the button prints the notes alone.
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconAction } from './icon-action'
import { PrintingContext } from './print-context'

/** What a section marked to print gives the printed copy. */
export type EntityViewPrintSection = {
  title: string
  /** The section's content, or its fields as label/value rows. */
  content?: ReactNode
  fields?: { label: string; value: ReactNode }[]
  emptyLabel?: string
  answerSpace: boolean
}

function isEmpty(value: ReactNode) {
  return value === null || value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0)
}

function PrintedSection({ section }: { section: EntityViewPrintSection }) {
  return (
    <section data-answer-space={section.answerSpace ? '' : undefined} className="flex flex-col gap-3">
      {/* A label with a rule under it, so the text's own headings (on
          their bands) stay the larger ones. */}
      <h2 className="border-b border-border pb-1 type-label tracking-[0.08em] text-muted-foreground uppercase">{section.title}</h2>
      {section.fields ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 type-body">
          {section.fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="type-label text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0 break-words text-foreground">{isEmpty(field.value) ? '—' : field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="min-w-0 type-body break-words text-foreground">
          {isEmpty(section.content) ? <span className="text-muted-foreground">{section.emptyLabel ?? 'Not set'}</span> : section.content}
        </div>
      )}
    </section>
  )
}

function PrintedNotes({ title, subtitle, sections }: { title?: string; subtitle?: ReactNode; sections: EntityViewPrintSection[] }) {
  return createPortal(
    <PrintingContext.Provider value={true}>
      <article data-print-notes="" data-slot="entity-view-print" className="hidden flex-col gap-6 bg-background text-foreground print:flex">
        <header className="flex flex-col gap-1">
          <h1 className="type-heading-1 break-words">{title}</h1>
          {subtitle && <div className="type-body break-words text-muted-foreground">{subtitle}</div>}
        </header>
        {sections.map((section) => (
          <PrintedSection key={section.title} section={section} />
        ))}
      </article>
    </PrintingContext.Provider>,
    document.body,
  )
}

/** A print() that returns sooner than this didn't wait for the dialog: a phone's. */
const BLOCKING_PRINT_MS = 1000

/**
 * The header's Print notes button and, while it prints, the printed copy.
 * The copy mounts, then the browser's print dialog opens on it. Where
 * print() blocks (a desktop browser) it goes when the dialog closes
 * (`afterprint`). Where print() returns at once (a phone) `afterprint`
 * comes too early to mean anything, so the copy goes on the person's next
 * pointerdown or key instead.
 */
export function PrintNotes({
  label,
  look = 'icon',
  title,
  subtitle,
  sections,
}: {
  label: string
  /** An icon with `label` as its tooltip and name (the default), or a button with its words. */
  look?: 'icon' | 'words'
  title?: string
  subtitle?: ReactNode
  sections: EntityViewPrintSection[]
}) {
  // How many times it's been pressed since the copy last went: a press
  // while one is up (a browser that never said the dialog closed, or a phone
  // still holding the copy) prints it again rather than doing nothing.
  const [printing, setPrinting] = useState(0)
  useEffect(() => {
    if (printing === 0) return
    const release = () => setPrinting(0)
    // Whether print() waited for the dialog; unknown until it returns, and an
    // `afterprint` inside the call is kept until then.
    let blocked: boolean | undefined = undefined
    let endedInside = false
    const onAfterPrint = () => {
      if (blocked === undefined) endedInside = true
      else if (blocked) release()
    }
    window.addEventListener('afterprint', onAfterPrint)
    const started = performance.now()
    window.print()
    blocked = performance.now() - started >= BLOCKING_PRINT_MS
    if (blocked) {
      if (endedInside) release()
    } else {
      // A phone: the copy waits for the person to come back to the page.
      window.addEventListener('pointerdown', release)
      window.addEventListener('keydown', release)
    }
    return () => {
      window.removeEventListener('afterprint', onAfterPrint)
      window.removeEventListener('pointerdown', release)
      window.removeEventListener('keydown', release)
    }
  }, [printing])
  return (
    <>
      {look === 'icon' ? (
        <IconAction icon={PrinterIcon} label={label} onClick={() => setPrinting((count) => count + 1)} />
      ) : (
        <Button variant="outline" onClick={() => setPrinting((count) => count + 1)}>
          <PrinterIcon />
          {label}
        </Button>
      )}
      {printing > 0 && <PrintedNotes title={title} subtitle={subtitle} sections={sections} />}
    </>
  )
}
