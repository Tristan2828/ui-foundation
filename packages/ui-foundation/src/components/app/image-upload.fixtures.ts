// Fake `upload`s for the stories of ImageField and the rich-text editor's
// image upload (and so for their e2e specs): no server, the picked file
// shown from memory. Not shipped: the build leaves *.fixtures.ts out.
import type { ImageUpload } from '@/lib/image-file'

let stored = 0

/** Stores the file after `ms` (shown from memory), so the busy state is seen. */
export function delayedUpload(ms = 1200): ImageUpload {
  return (file) =>
    new Promise((resolve) =>
      setTimeout(() => {
        const url = URL.createObjectURL(file)
        stored++
        resolve({ id: `file-${stored}`, thumbUrl: url, url })
      }, ms),
    )
}

/** Refuses every file after `ms`, as a server would (an `AppError`). */
export function failingUpload(ms = 600, message = 'Storage is full. Free some space and try again.'): ImageUpload {
  return () => new Promise((_resolve, reject) => setTimeout(() => reject({ kind: 'server', message }), ms))
}

/** A record's saved photo, served from a path as an app's files are (.storybook/public). */
export const SAVED_PHOTO = '/sample-photo.svg'

/** A photo far wider than any record's column. */
export const WIDE_PHOTO = '/wide-photo.svg'
