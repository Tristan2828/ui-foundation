// Client-side form validation for the login screen. This does not replace
// the wire-shaped LoginRequest generated into schema.d.ts (AGENTS.md
// "NEVER hand-write an API type") — the gateway builds that shape itself
// from these two plain strings.
import { z } from 'zod'

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

export const LOGIN_FORM_DEFAULTS: LoginFormValues = {
  email: '',
  password: '',
}

// The second step, when the account has TOTP: six digits from an
// authenticator app, or (switched to) one of the account's recovery codes.
export const totpCodeFormSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
})

export const recoveryCodeFormSchema = z.object({
  code: z.string().trim().min(1, 'Enter a recovery code').max(64, 'That is longer than a recovery code'),
})

export type CodeFormValues = z.infer<typeof totpCodeFormSchema>
