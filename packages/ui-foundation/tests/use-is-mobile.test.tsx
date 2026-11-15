import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useIsMobile } from '@/hooks/use-mobile'
import { useIsPhone } from '@/hooks/use-is-phone'

// useIsMobile (shadcn's name, read by the sidebar and sonner) is useIsPhone:
// one breakpoint. Off the browser it answers "not a phone" instead of
// reading `window`. The browser behaviour (the sidebar's sheet below 768px)
// is the template's mobile-sidebar spec.
function Both() {
  return <p>{`${useIsMobile()} ${useIsPhone()}`}</p>
}

describe('useIsMobile', () => {
  it('renders where there is no window, and agrees with useIsPhone', () => {
    expect(typeof window).toBe('undefined')
    expect(renderToString(<Both />)).toBe('<p>false false</p>')
  })
})
