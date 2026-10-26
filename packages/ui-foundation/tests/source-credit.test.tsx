// SourceCredit names each source as a link; an `icon` draws the source's
// mark before the name, hidden from screen readers, so the link's text
// is still the name alone.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SourceCredit } from '../src/components/app/source-credit'

function Mark({ className, ...rest }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return <svg data-mark="" className={className} {...rest} />
}

describe('SourceCredit', () => {
  it('draws a source’s icon before its name, inside the link, hidden', () => {
    const html = renderToStaticMarkup(
      <SourceCredit sources={[{ name: 'TMDB', href: 'https://www.themoviedb.org', icon: Mark }]} />,
    )
    expect(html).toMatch(/<a [^>]*href="https:\/\/www.themoviedb.org"[^>]*><svg data-mark="" class="[^"]*size-3.5[^"]*" aria-hidden="true"><\/svg>TMDB/)
  })

  it('leaves a source without an icon as it was', () => {
    const html = renderToStaticMarkup(
      <SourceCredit
        sources={[
          { name: 'TMDB', href: 'https://www.themoviedb.org', icon: Mark },
          { name: 'IGDB', href: 'https://www.igdb.com' },
        ]}
      />,
    )
    expect(html.match(/data-mark/g)).toHaveLength(1)
    expect(html).toMatch(/href="https:\/\/www.igdb.com"[^>]*>IGDB<svg/)
  })
})
