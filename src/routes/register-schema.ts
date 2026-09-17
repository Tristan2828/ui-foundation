// Client-side form validation for the register screen — same pattern as
// login-schema.ts. Mirrors RegisterRequest (email, name, password) plus one
// addition beyond the wire shape: a client-only confirmPassword field, since
// a mistyped password with no confirmation is a real, cheaply-prevented
// failure mode (docs/BUILD-PLAN.md Phase 11).
import { z } from 'zod'

export const registerFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const REGISTER_FORM_DEFAULTS: RegisterFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}
