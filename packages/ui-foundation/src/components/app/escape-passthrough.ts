// An Esc the rich-text editor didn't use. ProseMirror marks every Esc
// handled (its own keydown calls preventDefault, to stop the browser's
// default), so a field around the editor can't tell from
// `defaultPrevented` whether a menu over the text took it. The editor
// records the ones none of its menus did, and editing in place acts on
// those (cell-patterns.md "Editable value": Esc gives up, or saves).
const passedThrough = new WeakSet<Event>()

export function passEscapeThrough(event: Event) {
  passedThrough.add(event)
}

export function escapePassedThrough(event: Event): boolean {
  return passedThrough.has(event)
}
