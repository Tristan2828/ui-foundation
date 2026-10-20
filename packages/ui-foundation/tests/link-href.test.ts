// linkHref (src/lib/link-href.ts): the address a link in the rich-text
// editor gets from what was typed.
import { describe, expect, it } from 'vitest'
import { linkHref, linkRefusal } from '../src/lib/link-href'

describe('linkHref', () => {
  it('keeps a web, email or phone address as typed', () => {
    expect(linkHref('https://example.com/a?b=c')).toBe('https://example.com/a?b=c')
    expect(linkHref('http://example.com')).toBe('http://example.com')
    expect(linkHref('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    expect(linkHref('tel:+15550100')).toBe('tel:+15550100')
  })

  it('adds https:// to a bare address, and mailto: to a bare email', () => {
    expect(linkHref('  example.com/setup ')).toBe('https://example.com/setup')
    expect(linkHref('example.com:8080/x')).toBe('https://example.com:8080/x')
    expect(linkHref('someone@example.com')).toBe('mailto:someone@example.com')
  })

  it('keeps a path on this site and a heading', () => {
    expect(linkHref('/widgets/1')).toBe('/widgets/1')
    expect(linkHref('#setup')).toBe('#setup')
  })

  it('refuses any other scheme', () => {
    for (const typed of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'vbscript:x']) {
      expect(linkHref(typed)).toBeNull()
    }
  })

  it('refuses a protocol-relative address, which is another site, not a path', () => {
    for (const typed of ['//evil.com', '//evil.com/widgets', '/\\evil.com', '  //evil.com']) {
      expect(linkHref(typed)).toBeNull()
    }
  })

  it('refuses whitespace inside an address, whatever its kind (#177)', () => {
    for (const typed of [
      'example wiki',
      'notes page',
      'example.com/a b',
      'https://a b',
      'http://example.com/a\tb',
      'mailto:a b@example.com',
      'a b@example.com',
      'tel:+1 555 0100',
      '/widgets/a b',
      '#a b',
      'example.com/a\nb',
      'example.com/a\u00a0b',
    ]) {
      expect(linkHref(typed), typed).toBeNull()
      expect(linkRefusal(typed), typed).toBe('whitespace')
    }
    // Only inside: around the address it's trimmed as before.
    expect(linkHref('  example.com/wiki\t')).toBe('https://example.com/wiki')
    expect(linkHref('example.com/a%20b')).toBe('https://example.com/a%20b')
  })

  it('says a refusal without whitespace is the scheme', () => {
    expect(linkRefusal('javascript:alert(1)')).toBe('scheme')
    expect(linkRefusal('  //evil.com ')).toBe('scheme')
  })

  it('reads empty as "remove the link"', () => {
    expect(linkHref('   ')).toBe('')
  })
})
