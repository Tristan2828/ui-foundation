import { describe, expect, it } from 'vitest'
import { loginFormSchema } from '../src/routes/login-schema'
import { registerFormSchema } from '../src/routes/register-schema'

// The user-visible messages each form shows, keyed by field. Pinned here so a
// zod upgrade that changes error plumbing (zod 4 dropped `required_error`)
// can't silently swap a custom message for a library default.
function fieldMessages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const messages: Record<string, string> = {}
  for (const issue of result.error?.issues ?? []) {
    const field = String(issue.path[0])
    messages[field] ??= issue.message
  }
  return messages
}

describe('loginFormSchema', () => {
  it('requires both fields', () => {
    const messages = fieldMessages(loginFormSchema.safeParse({ email: '', password: '' }))
    expect(messages).toEqual({ email: 'Email is required', password: 'Password is required' })
  })

  it('trims before validating the email', () => {
    const result = loginFormSchema.safeParse({ email: ' dev@example.com ', password: 'x' })
    expect(result.success && result.data.email).toBe('dev@example.com')
    expect(fieldMessages(loginFormSchema.safeParse({ email: 'nope', password: 'x' })).email).toBe(
      'Enter a valid email address',
    )
  })
})

describe('registerFormSchema', () => {
  it('flags a mismatched confirmation on confirmPassword', () => {
    const result = registerFormSchema.safeParse({
      name: 'A',
      email: 'a@example.com',
      password: 'long-enough',
      confirmPassword: 'different',
    })
    expect(fieldMessages(result)).toEqual({ confirmPassword: 'Passwords do not match' })
  })
})
