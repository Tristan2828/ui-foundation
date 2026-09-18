// Screen: /register (Phase 11 — see docs/BUILD-PLAN.md "Phase 11 — Self-
// Service Registration"). Built the same way login.tsx was: FieldGroup/
// Field directly, not EntityForm — a registration form has no "cancel"
// destination either.
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import type { AppError } from '@/api/contracts'
import { useAuth } from '@/auth/use-auth'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { REGISTER_FORM_DEFAULTS, registerFormSchema, type RegisterFormValues } from './register-schema'
import { returnPath } from './return-path'

export function RegisterRoute() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: REGISTER_FORM_DEFAULTS,
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await register(values.email, values.name, values.password)
      navigate(returnPath(location.state), { replace: true })
    } catch (err) {
      const error = err as AppError
      if (error.kind === 'validation' && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field in REGISTER_FORM_DEFAULTS) {
            form.setError(field as keyof RegisterFormValues, { message: messages[0] })
          } else {
            setSubmitError(error)
          }
        }
      } else {
        setSubmitError(error)
      }
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="register-name">Name</FieldLabel>
                <Input
                  id="register-name"
                  autoComplete="name"
                  aria-invalid={!!form.formState.errors.name}
                  {...form.register('name')}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="register-email">Email</FieldLabel>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register('email')}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="register-password">Password</FieldLabel>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.confirmPassword}>
                <FieldLabel htmlFor="register-confirm-password">Confirm password</FieldLabel>
                <Input
                  id="register-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.confirmPassword}
                  {...form.register('confirmPassword')}
                />
                <FieldError errors={[form.formState.errors.confirmPassword]} />
              </Field>
            </FieldGroup>

            {submitError && <ErrorState error={submitError} />}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              Create account
            </Button>

            <Button variant="link" size="sm" nativeButton={false} render={<Link to="/login" state={location.state} />}>
              Sign in instead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
