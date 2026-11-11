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
// The browser's own print (Ctrl+P) still prints the page as it is; only
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

/**
 * The header's Print notes button and, while it prints, the printed copy.
 * The copy mounts, then the browser's print dialog opens on it; it goes
 * when the dialog closes (`afterprint`).
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
  // while one is up (a browser that never said the dialog closed) prints
  // it again rather than doing nothing.
  const [printing, setPrinting] = useState(0)
  useEffect(() => {
    if (printing === 0) return
    const done = () => setPrinting(0)
    window.addEventListener('afterprint', done)
    window.print()
    return () => window.removeEventListener('afterprint', done)
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
