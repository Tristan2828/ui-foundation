// A refusal in words: why a save (or any call to the gateway) failed, for
// the line, field error or toast that shows it. Here, below the editor and
// editing in place, so both can word one without importing the other.
import type { AppError } from '@/api/contracts'

/**
 * Why a save was refused, in the server's words: for a 422, the message
 * on a field the save sent (the first field error otherwise), else the
 * `AppError`'s message.
 */
export function refusalReason(error: AppError, sent?: object): string {
  const fieldErrors = Object.entries(error.fieldErrors ?? {})
  const fields = Object.keys(sent ?? {})
  const onSentField = fieldErrors.find(([key]) => fields.some((field) => key === field || key.startsWith(`${field}.`)))
  return (onSentField ?? fieldErrors[0])?.[1][0] ?? error.message
}

/** Why a save failed, in words to show beside what was being saved. */
export function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'kind' in error) return refusalReason(error as AppError)
  if (error instanceof Error) return error.message
  return 'The save failed. Try again.'
}
