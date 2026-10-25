// Images a person picks, pastes or drops, before they're uploaded: which
// files are accepted, and why one isn't, in words. Shared by ImageField
// and the rich-text editor's upload. The upload itself is the app's (an
// `ImageUpload`): the package knows no endpoint and no storage.

/** What an app's upload resolves to: the stored file's id and its addresses. */
export type ImageUploadResult = {
  /** The stored file's id, what the record keeps (ImageField's value). */
  id: string
  /** A small version for a thumbnail (ImageField shows it). */
  thumbUrl: string
  /**
   * The full-size image, for text (`![](url)` in the rich-text editor).
   * Without it the editor inserts `thumbUrl`.
   */
  url?: string
}

/**
 * The app's upload: sends one file to its own storage and resolves to
 * where it is, or rejects (an `AppError`, an `Error`: its `message` is
 * shown).
 */
export type ImageUpload = (file: File) => Promise<ImageUploadResult>

/** The image types accepted unless a field says otherwise. */
export const DEFAULT_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

export type ImageFileRules = {
  /** MIME types, `image/jpeg`; `image/*` for any image. Defaults to `DEFAULT_IMAGE_TYPES`. */
  accept?: readonly string[]
  /** The largest file accepted, in bytes. No limit when unset. */
  maxSize?: number
}

// How a type is named to a person: "JPEG", not "image/jpeg".
const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/avif': 'AVIF',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
  'image/svg+xml': 'SVG',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF',
  'application/pdf': 'PDF',
}

function typeName(type: string): string {
  if (TYPE_NAMES[type]) return TYPE_NAMES[type]
  if (type === 'image/*') return 'image'
  const subtype = type.split('/')[1] ?? type
  return subtype.replace(/^x-/, '').toUpperCase()
}

// "JPEG, PNG or WebP".
function listOr(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
}

/** A size as a person reads it: "820 KB", "4.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)} MB`
}

function accepts(accept: readonly string[], type: string): boolean {
  return accept.some((allowed) => allowed === type || (allowed.endsWith('/*') && type.startsWith(allowed.slice(0, -1))))
}

/** The `accept` attribute for a file input: `image/jpeg,image/png,image/webp`. */
export function acceptAttribute(accept: readonly string[] = DEFAULT_IMAGE_TYPES): string {
  return accept.join(',')
}

/**
 * Why a file can't be uploaded, as a sentence to show under the field, or
 * null when it can: a type not accepted, or over the size limit.
 */
export function imageRefusal(file: Pick<File, 'type' | 'size'>, rules: ImageFileRules = {}): string | null {
  const accept = rules.accept ?? DEFAULT_IMAGE_TYPES
  if (!accepts(accept, file.type)) {
    const wanted = listOr(accept.map(typeName))
    const choose = accept.length === 1 && accept[0] === 'image/*' ? 'Choose an image.' : `Choose a ${wanted} image.`
    // A type with a name people know is named; any other file that isn't
    // an image is just that.
    const named = TYPE_NAMES[file.type] ?? (file.type.startsWith('image/') ? typeName(file.type) : null)
    return named ? `That file is ${article(named)} ${named}. ${choose}` : `That file isn't an image. ${choose}`
  }
  if (rules.maxSize !== undefined && file.size > rules.maxSize) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(rules.maxSize)}.`
  }
  return null
}

// "a GIF", "an SVG", "an HEIC": by how the name is said, letter by letter
// when it's an acronym.
function article(name: string): 'a' | 'an' {
  const spelled = /^[A-Z][A-Z0-9]+$/.test(name)
  return (spelled ? /^[AEFHILMNORSX]/ : /^[aeiou]/i).test(name) ? 'an' : 'a'
}

/** What a failed upload says: the rejection's own `message` (an `AppError`'s), else a generic sentence. */
export function uploadFailure(error: unknown, noun = 'image'): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return `The ${noun} couldn't be uploaded. Try again.`
}
