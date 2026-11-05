// The emoji EmojiField offers: a curated set for labelling things in a
// personal app (a routine, a list, a step), not the whole of Unicode. Each
// has a name (the button's accessible name) and keywords the search reads.
// Single code points or a variation-selector pair only, so every one is one
// glyph on every platform.
export type EmojiEntry = { emoji: string; name: string; keywords?: string }
export type EmojiGroup = { label: string; emojis: EmojiEntry[] }

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: 'Morning and sleep',
    emojis: [
      { emoji: '☀️', name: 'Sun', keywords: 'morning day bright' },
      { emoji: '🌅', name: 'Sunrise', keywords: 'morning dawn' },
      { emoji: '⏰', name: 'Alarm clock', keywords: 'wake time' },
      { emoji: '🌙', name: 'Moon', keywords: 'night evening' },
      { emoji: '😴', name: 'Sleeping face', keywords: 'sleep bed rest' },
      { emoji: '🛏️', name: 'Bed', keywords: 'sleep bedroom' },
      { emoji: '🌄', name: 'Sunrise over mountains', keywords: 'morning' },
      { emoji: '🌃', name: 'Night with stars', keywords: 'evening' },
    ],
  },
  {
    label: 'Body and health',
    emojis: [
      { emoji: '🧘', name: 'Person in lotus position', keywords: 'yoga meditate breathe calm' },
      { emoji: '🏃', name: 'Person running', keywords: 'run exercise workout cardio' },
      { emoji: '🏋️', name: 'Person lifting weights', keywords: 'gym strength workout' },
      { emoji: '🚴', name: 'Person biking', keywords: 'cycling exercise' },
      { emoji: '🏊', name: 'Person swimming', keywords: 'pool exercise' },
      { emoji: '🤸', name: 'Person cartwheeling', keywords: 'stretch gymnastics' },
      { emoji: '💪', name: 'Flexed biceps', keywords: 'strength muscle' },
      { emoji: '🦷', name: 'Tooth', keywords: 'dentist brush teeth' },
      { emoji: '🪥', name: 'Toothbrush', keywords: 'brush teeth' },
      { emoji: '💊', name: 'Pill', keywords: 'medicine vitamins' },
      { emoji: '🩺', name: 'Stethoscope', keywords: 'doctor health' },
      { emoji: '❤️', name: 'Red heart', keywords: 'love health' },
      { emoji: '🫁', name: 'Lungs', keywords: 'breathe breath' },
      { emoji: '🧠', name: 'Brain', keywords: 'mind think' },
    ],
  },
  {
    label: 'Self-care',
    emojis: [
      { emoji: '🚿', name: 'Shower', keywords: 'wash clean' },
      { emoji: '🛁', name: 'Bathtub', keywords: 'bath wash' },
      { emoji: '🧼', name: 'Soap', keywords: 'wash clean hands' },
      { emoji: '🧴', name: 'Lotion bottle', keywords: 'skincare moisturizer sunscreen' },
      { emoji: '🪒', name: 'Razor', keywords: 'shave' },
      { emoji: '💇', name: 'Person getting haircut', keywords: 'hair' },
      { emoji: '🧖', name: 'Person in steamy room', keywords: 'sauna spa relax' },
      { emoji: '🕯️', name: 'Candle', keywords: 'calm relax' },
    ],
  },
  {
    label: 'Food and drink',
    emojis: [
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
    ],
  },
  {
    label: 'Home and chores',
    emojis: [
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
    ],
  },
  {
    label: 'Work and learning',
    emojis: [
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
    ],
  },
  {
    label: 'Play and music',
    emojis: [
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
    ],
  },
  {
    label: 'Outside and travel',
    emojis: [
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
    ],
  },
  {
    label: 'Symbols',
    emojis: [
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
    ],
  },
]

export function filterEmojiGroups(query: string): EmojiGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return EMOJI_GROUPS
  return EMOJI_GROUPS.map((group) => ({
    ...group,
    emojis: group.emojis.filter((e) => `${e.name} ${e.keywords ?? ''}`.toLowerCase().includes(q)),
  })).filter((group) => group.emojis.length > 0)
}
