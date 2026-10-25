import type { ComponentType } from 'react'

/**
 * Anything drawn like a Lucide icon: sized by a `size-*` class, coloured
 * through `currentColor` or its own fills, and hidden from screen readers
 * by `aria-hidden` (which it should pass to its `<svg>`). Every
 * `LucideIcon` is one, and so is an app's own mark (a brand logo from
 * Simple Icons' paths, say), so a slot typed with it takes either.
 */
export type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
