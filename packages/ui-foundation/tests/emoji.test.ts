// emojiImageName, EmojiField's search, Suggested's merged keywords and
// Recent's order.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMOJI_GROUPS_ALL } from '@/components/app/emoji-data.generated'
import {
  SUGGESTED_EMOJI,
  addRecentEmoji,
  emojiMatches,
  mergeSuggestedKeywords,
  searchEmoji,
} from '@/components/app/emoji-field-data'
import { EMOJI_ASSET_PATH, emojiImageName } from '@/components/app/emoji-image'

const EMOJI_DIR = path.join(import.meta.dirname, '..', 'emoji')

describe('emojiImageName', () => {
  it('leaves fe0f out', () => {
    expect(emojiImageName('❤️')).toBe('2764')
    expect(emojiImageName('❤')).toBe('2764')
    expect(emojiImageName('🛏️')).toBe('1f6cf')
  })
  it('names flags by their regional indicators, and subdivision flags by their tags', () => {
    expect(emojiImageName('🇺🇸')).toBe('1f1fa_1f1f8')
    expect(emojiImageName('\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}')).toBe(
      '1f3f4_e0067_e0062_e0073_e0063_e0074_e007f',
    )
  })
  it('joins a ZWJ sequence, and pads short code points to four digits', () => {
    expect(emojiImageName('🏳️‍🌈')).toBe('1f3f3_200d_1f308')
    expect(emojiImageName('🧑‍💻')).toBe('1f9d1_200d_1f4bb')
    expect(emojiImageName('1️⃣')).toBe('0031_20e3')
  })
  it('serves from the versioned folder', () => {
    expect(EMOJI_ASSET_PATH).toBe('/assets/emoji-18.0/')
  })
})

describe('Suggested', () => {
  it('is 101 emoji, each with a picture', () => {
    expect(SUGGESTED_EMOJI).toHaveLength(101)
    const missing = SUGGESTED_EMOJI.filter(
      (entry) => !fs.existsSync(path.join(EMOJI_DIR, `${emojiImageName(entry.emoji)}.svg`)),
    )
    expect(missing).toEqual([])
  })
  it("adds its keywords to the generated entries'", () => {
    const merged = mergeSuggestedKeywords(EMOJI_GROUPS_ALL)
    const pill = merged.flatMap((group) => group.emojis).find((entry) => entry.emoji === '💊')
    expect(pill?.keywords).toMatch(/\bmeds\b/)
    expect(pill?.keywords).toMatch(/\bdoctor\b/)
  })
})

describe('search', () => {
  const groups = mergeSuggestedKeywords(EMOJI_GROUPS_ALL)
  const dog = { emoji: '🐶', name: 'Dog face', keywords: 'pet puppy' }
  it('matches a word that starts with the query', () => {
    expect(emojiMatches(dog, 'pup')).toBe(true)
    expect(emojiMatches(dog, 'uppy')).toBe(false)
    expect(emojiMatches(dog, 'dog pe')).toBe(true)
  })
  it('finds "meds" → 💊 once, Suggested first', () => {
    const found = searchEmoji('meds', groups)
    expect(found.filter((entry) => entry.emoji === '💊')).toHaveLength(1)
    const dogs = searchEmoji('dog', groups).map((entry) => entry.emoji)
    expect(SUGGESTED_EMOJI.map((entry) => entry.emoji)).toContain(dogs[0])
    expect(dogs).toContain('🐶')
  })
  it('finds nothing for nonsense', () => {
    expect(searchEmoji('zzzz', groups)).toEqual([])
  })
})

describe('Recent', () => {
  it('puts the pick first, without repeats, at most 16', () => {
    expect(addRecentEmoji(['🐶', '🧘'], '🧘')).toEqual(['🧘', '🐶'])
    expect(addRecentEmoji(['🛏'], '🛏️')).toEqual(['🛏️'])
    const many = Array.from({ length: 16 }, (_, index) => String.fromCodePoint(0x1f600 + index))
    const next = addRecentEmoji(many, '🐶')
    expect(next).toHaveLength(16)
    expect(next[0]).toBe('🐶')
    expect(next).not.toContain(many[15])
  })
})
