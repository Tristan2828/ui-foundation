import { describe, expect, it } from 'vitest'
import { loginFormSchema } from '../src/routes/login-schema'
import { registerFormSchema } from '../src/routes/register-schema'
import { WIDGET_FORM_DEFAULTS, widgetFormSchema } from '../src/routes/widgets/widget-schema'

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

const validWidget = {
  ...WIDGET_FORM_DEFAULTS,
  name: 'Lamp',
  categoryId: 1,
  availableFrom: new Date(2026, 0, 1),
  price: '9.50',
  description: 'A lamp.',
}

describe('widgetFormSchema', () => {
  it('shows the custom required messages for an untouched form', () => {
    const messages = fieldMessages(widgetFormSchema.safeParse(WIDGET_FORM_DEFAULTS))
    expect(messages.categoryId).toBe('Category is required')
    expect(messages.availableFrom).toBe('Available-from date is required')
    expect(messages.name).toBe('Name is required')
  })

  it('accepts an empty assignee and a padded valid one, rejects an invalid one', () => {
    expect(widgetFormSchema.safeParse({ ...validWidget, assigneeEmail: '' }).success).toBe(true)
    const padded = widgetFormSchema.safeParse({ ...validWidget, assigneeEmail: '  a@example.com ' })
    expect(padded.success && padded.data.assigneeEmail).toBe('a@example.com')
    const invalid = widgetFormSchema.safeParse({ ...validWidget, assigneeEmail: 'not-an-email' })
    expect(fieldMessages(invalid).assigneeEmail).toBe('Enter a valid email address')
  })

  it('rejects a price without exactly two decimals', () => {
    const messages = fieldMessages(widgetFormSchema.safeParse({ ...validWidget, price: '9.5' }))
    expect(messages.price).toBe('Enter a price with exactly two decimal places, e.g. 19.99')
  })
})

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
