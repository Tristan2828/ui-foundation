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
