// Credits the outside services a record's data comes from, as many free
// APIs require on every screen showing their data ("This product uses the
// TMDB API but is not endorsed or certified by TMDB"). EntityView's
// `footer` is its usual home. Text and links only: a service's logo and
// its usage rules are the app's.
import { Fragment } from 'react'
import { ExternalLinkIcon } from 'lucide-react'

export type Source = {
  /** The service's name, the link's text: "TMDB". */
  name: string
  /** Its site; the link opens in a new tab. */
  href: string
  /** A sentence the service's terms ask for, shown after the list as written. */
  note?: string
}

export type SourceCreditProps = {
  sources: Source[]
  /** What comes before the names. Defaults to "Data from". */
  lead?: string
}

function joined(index: number, count: number) {
  if (index === 0) return ''
  if (index === count - 1) return count === 2 ? ' and ' : ', and '
  return ', '
}

export function SourceCredit({ sources, lead = 'Data from' }: SourceCreditProps) {
  if (sources.length === 0) return null
  const notes = sources.flatMap((source) => (source.note ? [source.note] : []))
  return (
    <p data-slot="source-credit" className="type-caption text-muted-foreground">
      {lead}{' '}
      {sources.map((source, index) => (
        <Fragment key={source.name}>
          {joined(index, sources.length)}
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {source.name}
            <ExternalLinkIcon aria-hidden="true" className="ml-0.5 inline size-3 align-baseline" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Fragment>
      ))}
      .{notes.map((note) => ` ${note}`).join('')}
    </p>
  )
}
