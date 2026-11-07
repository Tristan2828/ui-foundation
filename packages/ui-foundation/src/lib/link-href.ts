// The address a link in the rich-text editor points at, from what the
// person typed. Web and email addresses only: a bare `example.com` becomes
// `https://example.com` and a bare `name@example.com` a `mailto:`; a path
// on this site (`/x`, never `//x`) or a heading (`#x`) is kept. Any other scheme
// (`javascript:`, `data:`, `file:`) is refused, so a link can't run code
// or reach a local file. An address with whitespace inside it
// (`example wiki`, `https://a b`) is refused too: it isn't a working link,
// and adding https:// to two words would save one that looks like it is.

/** The `href` to save, `''` to remove the link, or `null` when it's refused. */
export function linkHref(typed: string): string | null {
  const value = typed.trim()
  if (value === '') return ''
  if (/\s/.test(value)) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value
  // A scheme of its own (`javascript:`), not a port (`example.com:8080`).
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return null
  // `//evil.com` (and `/\evil.com`, which browsers read the same way) is
  // another site, not a path on this one.
  if (/^\/[/\\]/.test(value)) return null
  if (value.startsWith('/') || value.startsWith('#')) return value
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`
  return `https://${value}`
}

/** Why `linkHref` refused what was typed, for the message shown with it. */
export function linkRefusal(typed: string): 'whitespace' | 'scheme' {
  return /\s/.test(typed.trim()) ? 'whitespace' : 'scheme'
}

type LinkRuleResult =
  | { success: true; data: string | null }
  | { success: false; error: { issues: { message: string }[] } }

/**
 * The rule for a link field, shaped as a schema (`safeParse`): what was
 * typed becomes the address to save (`linkHref`: `example.com` gains
 * https://), or `null` for a blank box; another scheme (`javascript:`) or
 * a space inside the address is refused with the words to show. LinkCell
 * and the `inPlace.link` preset check with it.
 */
export const linkRule = {
  safeParse(value: unknown): LinkRuleResult {
    const typed = String(value ?? '')
    const href = linkHref(typed)
    if (href === '') return { success: true, data: null }
    if (href === null) {
      const message = linkRefusal(typed) === 'whitespace' ? 'An address has no spaces' : 'Use a web or email address'
      return { success: false, error: { issues: [{ message }] } }
    }
    return { success: true, data: href }
  },
}

/**
 * A link's text when it has no label of its own: the host of a web
 * address (`docs.example.com`), the address of an email link, the path
 * of a link on this site. `href` is one `linkHref` returned.
 */
export function linkHost(href: string): string {
  if (/^mailto:/i.test(href)) return href.slice('mailto:'.length)
  if (/^tel:/i.test(href)) return href.slice('tel:'.length)
  if (/^https?:\/\//i.test(href)) {
    try {
      return new URL(href).host
    } catch {
      return href.replace(/^https?:\/\//i, '')
    }
  }
  return href
}
