// Screen: /login (Phase 10 — see docs/BUILD-PLAN.md "Auth Boundary"). The
// one route AppShell's auth redirect never catches (see app.tsx). Not built
// on the EntityForm composite — that's specifically create/edit-an-entity
// chrome (title + Cancel + Submit), and a login screen has no "cancel"
// destination — so this uses the same mandated FieldGroup/Field primitives
// directly (AGENTS.md "Correct Patterns").
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
import { LOGIN_FORM_DEFAULTS, loginFormSchema, type LoginFormValues } from './login-schema'
import { returnPath } from './return-path'

export function LoginRoute() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: LOGIN_FORM_DEFAULTS,
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await login(values.email, values.password)
      navigate(returnPath(location.state), { replace: true })
    } catch (err) {
      const error = err as AppError
      if (error.kind === 'validation' && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof LoginFormValues, { message: messages[0] })
        }
      } else {
        // 401 lands here as one form-level message — never bound to the
        // email or password field individually, so a failed attempt can't
        // be used to confirm which part was wrong.
        setSubmitError(error)
      }
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            <h1>Sign in</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register('email')}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>
            </FieldGroup>

            {submitError && <ErrorState error={submitError} />}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              Sign in
            </Button>

            <Button variant="link" size="sm" nativeButton={false} render={<Link to="/register" state={location.state} />}>
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
