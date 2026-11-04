// Whether what's rendering is a printed copy (EntityView's Print notes,
// entity-view-print.tsx). Content that has a screen-only side reads it:
// <Markdown> keeps its headings plain and unfolded and its task boxes as
// pictures, since paper has nothing to click.
import { createContext, useContext } from 'react'

export const PrintingContext = createContext(false)

/** True inside a printed copy of a record's notes. */
export function usePrinting() {
  return useContext(PrintingContext)
}
