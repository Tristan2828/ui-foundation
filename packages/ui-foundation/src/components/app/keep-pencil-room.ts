// Set by a container whose inline <EditableValue>s must keep their
// pencil's room at rest (KeyStats, 4.115), as `keepPencilRoom` does for
// one: a value growing on hover moved the values after it along a
// wrapping row, and a nearly full row wrapped, so the hovered value slid
// out from under the mouse and a click opened the next one.
import { createContext } from 'react'

export const KeepPencilRoomContext = createContext(false)
