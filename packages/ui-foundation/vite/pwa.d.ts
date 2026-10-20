// The helpers behind pwa(), typed for the package's own tests. Apps use
// `pwa` from `@tristan2828/ui-foundation/vite` (./index.d.ts).
import type { HtmlTagDescriptor, Plugin } from 'vite'
import type { PwaOptions } from './index'

export function themeToken(css: string, name: string): string
export function oklchToHex(value: string): string
export function solidPng(size: number, hex: string): Buffer
export function letterSvg(name: string, background: string, foreground: string): string
export function pwaFiles(
  options: PwaOptions,
  base?: string,
  root?: string,
): {
  files: Map<string, { type: string; source: string | Buffer }>
  tags: (HtmlTagDescriptor & { attrs: Record<string, string> })[]
}
export function pwa(options: PwaOptions): Plugin
