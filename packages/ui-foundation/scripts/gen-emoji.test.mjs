// The committed output of scripts/gen-emoji.mjs: the data and the
// pictures agree, there are no skin tones, and Unicode's nine groups come
// in Unicode's order. Plus the generator's own parsing and stripping.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMOJI_GROUPS_ALL } from '../src/components/app/emoji-data.generated'
import { imageName, parseAnnotations, parseEmojiTest, stripSvg } from './gen-emoji.mjs'

const EMOJI_DIR = path.join(import.meta.dirname, '..', 'emoji')
const entries = EMOJI_GROUPS_ALL.flatMap((group) => group.emojis)

describe('the committed emoji', () => {
  it('has about 1,900 entries', () => {
    expect(entries.length).toBeGreaterThan(1800)
    expect(entries.length).toBeLessThan(2100)
  })

  it('has no skin-tone modifier', () => {
    expect(entries.filter((entry) => /[\u{1F3FB}-\u{1F3FF}]/u.test(entry.emoji))).toEqual([])
  })

  it('has a picture for every entry, and an entry for every picture', () => {
    const files = new Set(fs.readdirSync(EMOJI_DIR).filter((name) => name.endsWith('.svg')))
    const wanted = new Set(entries.map((entry) => `${imageName(entry.emoji)}.svg`))
    expect([...wanted].filter((name) => !files.has(name))).toEqual([])
    expect([...files].filter((name) => !wanted.has(name))).toEqual([])
    expect(fs.readFileSync(path.join(EMOJI_DIR, 'LICENSE'), 'utf8')).toMatch(
      /Apache License[\s\S]*Open Font License[\s\S]*UNICODE LICENSE V3/i,
    )
  })

  it('has unique emoji and unique names', () => {
    expect(new Set(entries.map((entry) => entry.emoji)).size).toBe(entries.length)
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length)
  })

  it("has Unicode's nine groups in Unicode's order", () => {
    expect(EMOJI_GROUPS_ALL.map((group) => group.label)).toEqual([
      'Smileys and Emotion',
      'People and Body',
      'Animals and Nature',
      'Food and Drink',
      'Travel and Places',
      'Activities',
      'Objects',
      'Symbols',
      'Flags',
    ])
  })

  it('names in sentence case, with keywords', () => {
    const dog = entries.find((entry) => entry.emoji === '🐶')
    expect(dog).toMatchObject({ name: 'Dog face' })
    expect(dog?.keywords).toMatch(/\bpet\b/)
  })

  it('wrote pictures that are plain SVG', () => {
    for (const name of fs.readdirSync(EMOJI_DIR).filter((file) => file.endsWith('.svg'))) {
      const svg = fs.readFileSync(path.join(EMOJI_DIR, name), 'utf8')
      expect(svg.startsWith('<svg'), name).toBe(true)
      expect(svg.includes('&ns_'), name).toBe(false)
    }
  })
})

describe('the generator', () => {
  it("names a picture Noto's way", () => {
    expect(imageName('🏳️‍🌈')).toBe('1f3f3_200d_1f308')
    expect(imageName('1️⃣')).toBe('0031_20e3')
    expect(imageName('🇺🇸')).toBe('1f1fa_1f1f8')
    expect(imageName('©️')).toBe('00a9')
  })

  it('keeps fully-qualified emoji without tones, outside Component', () => {
    const groups = parseEmojiTest(
      [
        '# group: Smileys & Emotion',
        '1F600 ; fully-qualified # 😀 E1.0 grinning face',
        '263A FE0F ; fully-qualified # ☺️ E0.6 smiling face',
        '263A ; unqualified # ☺ E0.6 smiling face',
        '# group: People & Body',
        '1F44B 1F3FD ; fully-qualified # 👋🏽 E1.0 waving hand: medium skin tone',
        '1F44B ; fully-qualified # 👋 E0.6 waving hand',
        '# group: Component',
        '1F3FB ; component # 🏻 E1.0 light skin tone',
      ].join('\n'),
    )
    expect(groups.map((group) => [group.label, group.emojis.map((entry) => entry.emoji)])).toEqual([
      ['Smileys & Emotion', ['😀', '☺️']],
      ['People & Body', ['👋']],
    ])
  })

  it('reads CLDR names and keywords, the first file winning', () => {
    const names = parseAnnotations(
      '<annotation cp="🐶">dog | face | pet</annotation><annotation cp="🐶" type="tts">dog face</annotation>',
      '<annotation cp="🐶" type="tts">puppy</annotation><annotation cp="&amp;">x</annotation>',
    )
    expect(names.get('🐶')).toEqual({ tts: 'dog face', keywords: ['dog', 'face', 'pet'] })
    expect(names.get('&')).toEqual({ keywords: ['x'] })
  })

  it("strips Illustrator's data and refuses a broken result", () => {
    const svg = [
      '<?xml version="1.0"?>',
      '<!-- made -->',
      '<!DOCTYPE svg PUBLIC "x" "y" [ <!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/"> ]>',
      '<svg xmlns:i="&ns_ai;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">',
      '  <title>dog</title>',
      '  <g i:extraneous="self"> <path d="M0 0"/> </g>',
      '  <i:aipgf id="p"><![CDATA[ abc ]]></i:aipgf>',
      '</svg>',
    ].join('\n')
    expect(stripSvg(svg)).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><g><path d="M0 0"/></g></svg>')
    expect(() => stripSvg('<svg><foo:bar/></svg>')).toThrow(/unbound/)
    expect(() => stripSvg('<svg fill="&nope;"></svg>')).toThrow(/entity/)
  })
})
