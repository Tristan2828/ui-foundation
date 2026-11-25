// The emoji EmojiField offers first, as Suggested: a hand-picked set for
// labelling things in a personal app (a routine, a list, a step), in one
// flat list. Their keywords are merged into the generated entries'
// (emoji-data.generated.ts, every emoji Unicode has), so a search for
// "meds" finds 💊 in every section it is in.
//
// The search: a word of the query matches a word of the name or keywords
// that starts with it, and an entry matches when every word of the query
// does.
export type EmojiEntry = { emoji: string; name: string; keywords?: string }
export type EmojiGroup = { label: string; emojis: EmojiEntry[] }

export const SUGGESTED_EMOJI: EmojiEntry[] = [
  { emoji: '☀️', name: 'Sun', keywords: 'morning day bright' },
  { emoji: '🌅', name: 'Sunrise', keywords: 'morning dawn' },
  { emoji: '⏰', name: 'Alarm clock', keywords: 'wake time' },
  { emoji: '🌙', name: 'Moon', keywords: 'night evening' },
  { emoji: '😴', name: 'Sleeping face', keywords: 'sleep bed rest' },
  { emoji: '🛏️', name: 'Bed', keywords: 'sleep bedroom' },
  { emoji: '🌄', name: 'Sunrise over mountains', keywords: 'morning' },
  { emoji: '🌃', name: 'Night with stars', keywords: 'evening' },
  { emoji: '🧘', name: 'Person in lotus position', keywords: 'yoga meditate breathe calm' },
  { emoji: '🏃', name: 'Person running', keywords: 'run exercise workout cardio' },
  { emoji: '🏋️', name: 'Person lifting weights', keywords: 'gym strength workout' },
  { emoji: '🚴', name: 'Person biking', keywords: 'cycling exercise' },
  { emoji: '🏊', name: 'Person swimming', keywords: 'pool exercise' },
  { emoji: '🤸', name: 'Person cartwheeling', keywords: 'stretch gymnastics' },
  { emoji: '💪', name: 'Flexed biceps', keywords: 'strength muscle' },
  { emoji: '🦷', name: 'Tooth', keywords: 'dentist brush teeth' },
  { emoji: '🪥', name: 'Toothbrush', keywords: 'brush teeth' },
  { emoji: '💊', name: 'Pill', keywords: 'medicine meds vitamins' },
  { emoji: '🩺', name: 'Stethoscope', keywords: 'doctor health' },
  { emoji: '❤️', name: 'Red heart', keywords: 'love health' },
  { emoji: '🫁', name: 'Lungs', keywords: 'breathe breath' },
  { emoji: '🧠', name: 'Brain', keywords: 'mind think' },
  { emoji: '🚿', name: 'Shower', keywords: 'wash clean' },
  { emoji: '🛁', name: 'Bathtub', keywords: 'bath wash' },
  { emoji: '🧼', name: 'Soap', keywords: 'wash clean hands' },
  { emoji: '🧴', name: 'Lotion bottle', keywords: 'skincare moisturizer sunscreen' },
  { emoji: '🪒', name: 'Razor', keywords: 'shave' },
  { emoji: '💇', name: 'Person getting haircut', keywords: 'hair' },
  { emoji: '🧖', name: 'Person in steamy room', keywords: 'sauna spa relax' },
  { emoji: '🕯️', name: 'Candle', keywords: 'calm relax' },
  { emoji: '🍳', name: 'Cooking', keywords: 'breakfast egg pan' },
  { emoji: '🥣', name: 'Bowl with spoon', keywords: 'cereal oatmeal breakfast' },
  { emoji: '🥗', name: 'Green salad', keywords: 'lunch healthy' },
  { emoji: '🍽️', name: 'Plate with cutlery', keywords: 'meal dinner eat' },
  { emoji: '🍎', name: 'Red apple', keywords: 'fruit snack' },
  { emoji: '🥑', name: 'Avocado', keywords: 'food' },
  { emoji: '☕', name: 'Hot beverage', keywords: 'coffee tea' },
  { emoji: '🍵', name: 'Teacup', keywords: 'tea' },
  { emoji: '💧', name: 'Droplet', keywords: 'water drink hydrate' },
  { emoji: '🥤', name: 'Cup with straw', keywords: 'drink' },
  { emoji: '🛒', name: 'Shopping cart', keywords: 'groceries store' },
  { emoji: '🏠', name: 'House', keywords: 'home' },
  { emoji: '🧹', name: 'Broom', keywords: 'sweep clean chores' },
  { emoji: '🧽', name: 'Sponge', keywords: 'scrub clean dishes' },
  { emoji: '🧺', name: 'Basket', keywords: 'laundry' },
  { emoji: '👕', name: 'T-shirt', keywords: 'laundry clothes' },
  { emoji: '🗑️', name: 'Wastebasket', keywords: 'trash garbage' },
  { emoji: '🛠️', name: 'Hammer and wrench', keywords: 'repair fix tools' },
  { emoji: '🔧', name: 'Wrench', keywords: 'repair fix' },
  { emoji: '🔑', name: 'Key', keywords: 'lock keys' },
  { emoji: '🪴', name: 'Potted plant', keywords: 'garden water plants' },
  { emoji: '🌱', name: 'Seedling', keywords: 'garden grow plant' },
  { emoji: '🌿', name: 'Herb', keywords: 'garden plant' },
  { emoji: '🐕', name: 'Dog', keywords: 'pet walk' },
  { emoji: '🐈', name: 'Cat', keywords: 'pet' },
  { emoji: '💻', name: 'Laptop', keywords: 'computer work code' },
  { emoji: '📧', name: 'Email', keywords: 'mail inbox' },
  { emoji: '📅', name: 'Calendar', keywords: 'date plan schedule' },
  { emoji: '📝', name: 'Memo', keywords: 'notes write journal' },
  { emoji: '✅', name: 'Check mark', keywords: 'done task todo' },
  { emoji: '📋', name: 'Clipboard', keywords: 'list checklist' },
  { emoji: '📚', name: 'Books', keywords: 'read study learn' },
  { emoji: '📖', name: 'Open book', keywords: 'read' },
  { emoji: '🎓', name: 'Graduation cap', keywords: 'study school learn' },
  { emoji: '✏️', name: 'Pencil', keywords: 'write draw' },
  { emoji: '🎯', name: 'Bullseye', keywords: 'goal focus target' },
  { emoji: '💡', name: 'Light bulb', keywords: 'idea' },
  { emoji: '🧾', name: 'Receipt', keywords: 'bills budget' },
  { emoji: '💰', name: 'Money bag', keywords: 'finance budget savings' },
  { emoji: '🎵', name: 'Musical note', keywords: 'music song' },
  { emoji: '🎧', name: 'Headphones', keywords: 'music podcast listen' },
  { emoji: '🎸', name: 'Guitar', keywords: 'music practice' },
  { emoji: '🎹', name: 'Piano keyboard', keywords: 'music practice' },
  { emoji: '🎨', name: 'Artist palette', keywords: 'paint draw art' },
  { emoji: '🎮', name: 'Video game', keywords: 'play controller' },
  { emoji: '📺', name: 'Television', keywords: 'tv watch show' },
  { emoji: '🎬', name: 'Clapper board', keywords: 'movie film' },
  { emoji: '📷', name: 'Camera', keywords: 'photo picture' },
  { emoji: '🧩', name: 'Puzzle piece', keywords: 'game' },
  { emoji: '🚶', name: 'Person walking', keywords: 'walk steps' },
  { emoji: '🥾', name: 'Hiking boot', keywords: 'hike trail' },
  { emoji: '🌳', name: 'Tree', keywords: 'park nature' },
  { emoji: '⛰️', name: 'Mountain', keywords: 'hike' },
  { emoji: '🌧️', name: 'Rain cloud', keywords: 'weather' },
  { emoji: '❄️', name: 'Snowflake', keywords: 'winter cold' },
  { emoji: '🚗', name: 'Car', keywords: 'drive commute' },
  { emoji: '🚌', name: 'Bus', keywords: 'commute transit' },
  { emoji: '✈️', name: 'Airplane', keywords: 'travel flight trip' },
  { emoji: '🧳', name: 'Luggage', keywords: 'travel pack trip' },
  { emoji: '⭐', name: 'Star', keywords: 'favorite' },
  { emoji: '✨', name: 'Sparkles', keywords: 'new clean' },
  { emoji: '🔥', name: 'Fire', keywords: 'streak hot' },
  { emoji: '🎉', name: 'Party popper', keywords: 'celebrate' },
  { emoji: '🏆', name: 'Trophy', keywords: 'win goal' },
  { emoji: '🔔', name: 'Bell', keywords: 'reminder notify' },
  { emoji: '⏱️', name: 'Stopwatch', keywords: 'timer time' },
  { emoji: '⏳', name: 'Hourglass', keywords: 'wait time' },
  { emoji: '🔄', name: 'Counterclockwise arrows', keywords: 'repeat again refresh' },
  { emoji: '🙏', name: 'Folded hands', keywords: 'gratitude thanks pray' },
  { emoji: '😊', name: 'Smiling face', keywords: 'happy' },
  { emoji: '🌈', name: 'Rainbow', keywords: 'colour' },
]

/** An emoji without U+FE0F, so `🛏️` and `🛏` are the same entry. */
export const emojiKey = (emoji: string) => emoji.replaceAll('️', '')

/** Suggested's keywords added to the same emoji's in the generated groups. */
export function mergeSuggestedKeywords(groups: EmojiGroup[], suggested: EmojiEntry[] = SUGGESTED_EMOJI): EmojiGroup[] {
  const extra = new Map(suggested.map((entry) => [emojiKey(entry.emoji), entry.keywords ?? '']))
  return groups.map((group) => ({
    ...group,
    emojis: group.emojis.map((entry) => {
      const more = extra.get(emojiKey(entry.emoji))
      return more ? { ...entry, keywords: `${entry.keywords ?? ''} ${more}`.trim() } : entry
    }),
  }))
}

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Whether every word of the query starts a word of the entry's name or keywords. */
export function emojiMatches(entry: EmojiEntry, query: string): boolean {
  const wanted = words(query)
  if (wanted.length === 0) return true
  const have = words(`${entry.name} ${entry.keywords ?? ''}`)
  return wanted.every((word) => have.some((candidate) => candidate.startsWith(word)))
}

/** Suggested and every group searched, in that order, each emoji once. */
export function searchEmoji(query: string, groups: EmojiGroup[], suggested: EmojiEntry[] = SUGGESTED_EMOJI): EmojiEntry[] {
  const seen = new Set<string>()
  const found: EmojiEntry[] = []
  for (const entry of [...suggested, ...groups.flatMap((group) => group.emojis)]) {
    const key = emojiKey(entry.emoji)
    if (seen.has(key) || !emojiMatches(entry, query)) continue
    seen.add(key)
    found.push(entry)
  }
  return found
}

// Recent: this device's last 16 picks, newest first, in localStorage. A
// convenience, so the picker works without it (a private window, blocked
// site data).
const RECENT_KEY = 'ui-foundation:emoji-recent'
const RECENT_MAX = 16

export function readRecentEmoji(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item !== '').slice(0, RECENT_MAX)
      : []
  } catch {
    return []
  }
}

export function writeRecentEmoji(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // No storage: Recent just isn't kept.
  }
}

/** The pick first, then the rest without it, at most 16. */
export function addRecentEmoji(list: readonly string[], emoji: string): string[] {
  return [emoji, ...list.filter((item) => emojiKey(item) !== emojiKey(emoji))].slice(0, RECENT_MAX)
}
