// While the rich-text editor is full screen, the page behind it is out of
// reach: every sibling of the field, and of each element above it up to
// <body>, is made `inert` (no focus, no clicks, hidden from screen
// readers), so Tab stays in the field and a reader reads only it. The
// toasts stay live wherever the app renders them (a save's failure still
// says so), and what a portal puts under <body> once full screen is on (a
// menu, a popover, the link box) is none of those siblings, so it works
// as ever. Each element gets back the `inert` it had when full screen
// ends or the field goes.
import { useEffect } from 'react'

// What stays live beside the field: the toasts' region.
function liveRegions(): Element[] {
  return Array.from(document.querySelectorAll('[data-sonner-toaster]')).map((list) => list.closest('section') ?? list)
}

const TABBABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'

// The field's tab stops, in order: what Tab can reach in it now. The
// editable text is one (whatever its tabIndex says); what's inside it,
// its links included, is none.
function tabStops(field: HTMLElement): HTMLElement[] {
  return Array.from(field.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (element) =>
      (element.getAttribute('contenteditable') === 'true' ||
        (element.tabIndex >= 0 && !element.parentElement?.closest('[contenteditable="true"]'))) &&
      !element.matches(':disabled') &&
      !element.closest('[inert], [hidden]') &&
      element.getClientRects().length > 0,
  )
}

/** Holds focus in `field` while `on`: the rest of the page inert. */
export function useHoldFocus(field: HTMLElement | null, on: boolean): void {
  useEffect(() => {
    if (!on || !field) return
    const live = [field, ...liveRegions()]
    // Every element on the way from a live one up to <body>.
    const path = new Set<Element>()
    for (const element of live) {
      for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) path.add(node)
    }
    const changed: HTMLElement[] = []
    for (const element of path) {
      if (live.includes(element)) continue
      for (const child of Array.from(element.children)) {
        if (path.has(child) || !(child instanceof HTMLElement) || child.inert) continue
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue
        child.inert = true
        changed.push(child)
      }
    }
    // Tab from the field's last stop goes round to its first (and
    // Shift+Tab the other way), rather than out to the browser.
    const wrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
      const stops = tabStops(field)
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const active = document.activeElement
      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      }
    }
    field.addEventListener('keydown', wrap)
    return () => {
      field.removeEventListener('keydown', wrap)
      for (const element of changed) element.inert = false
    }
  }, [field, on])
}
