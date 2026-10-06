// The address a link in the rich-text editor points at, from what the
// person typed. Web and email addresses only: a bare `example.com` becomes
// `https://example.com` and a bare `name@example.com` a `mailto:`; a path
// on this site (`/x`) or a heading (`#x`) is kept. Any other scheme
// (`javascript:`, `data:`, `file:`) is refused, so a link can't run code
// or reach a local file.

/** The `href` to save, `''` to remove the link, or `null` when it's refused. */
export function linkHref(typed: string): string | null {
  const value = typed.trim()
  if (value === '') return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value
  // A scheme of its own (`javascript:`), not a port (`example.com:8080`).
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return null
  if (value.startsWith('/') || value.startsWith('#')) return value
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`
  return `https://${value}`
}
