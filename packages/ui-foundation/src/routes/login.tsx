// Screen: /login. The one route AppShell's auth redirect never catches (an
// app mounts it outside the AppShell route, see template/src/App.tsx). Not built
// on the EntityForm composite — that's specifically create/edit-an-entity
// chrome (title + Cancel + Submit), and a login screen has no "cancel"
// destination — so this uses the same mandated FieldGroup/Field primitives
// directly (AGENTS.md "Correct Patterns").
//
// Two steps when the account has TOTP (4.0): the password, then a code
// from an authenticator app or a recovery code. No session exists between
// them; the server keeps a pending sign-in for a few minutes, and when it
// has gone (expired, out of tries) the screen goes back to the password
// with the reason.
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import type { AppError } from '@/api/contracts'
import type { SignInResult } from '@/auth/auth-context'
import { useAuth } from '@/auth/use-auth'
import { ErrorState } from '@/components/app/error-state'
import { PasswordInput } from '@/components/app/password-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  LOGIN_FORM_DEFAULTS,
  loginFormSchema,
  recoveryCodeFormSchema,
  totpCodeFormSchema,
  type CodeFormValues,
  type LoginFormValues,
} from './login-schema'
import { returnPath } from './return-path'

export type LoginRouteProps = {
  /**
   * Where "Create account" links. `null` hides the link, for an app with no
   * self-service sign-up (accounts made by hand, no /register route).
   */
  registerPath?: string | null
}

// A refusal for too many attempts holds the submit button until the
// server's Retry-After has passed, so the screen never offers a retry it
// knows will be refused.
function useRateLimitHold(error: AppError | null): boolean {
  // The refusal whose wait has passed; the button holds until it's this one.
  const [released, setReleased] = useState<AppError | null>(null)
  useEffect(() => {
    if (error?.kind !== 'rate_limited') return
    const seconds = error.retryAfterSeconds ?? 60
    const timer = window.setTimeout(() => setReleased(error), seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [error])
  return error?.kind === 'rate_limited' && released !== error
}

export function LoginRoute({ registerPath = '/register' }: LoginRouteProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<'password' | 'code'>('password')
  // Why the screen came back to the password from the code step.
  const [restartReason, setRestartReason] = useState<string | null>(null)

  const onResult = (result: SignInResult) => {
    if (result.status === 'signed-in') {
      navigate(returnPath(location.state), { replace: true })
    } else if (result.status === 'totp') {
      setRestartReason(null)
      setStep('code')
    } else {
      setRestartReason(result.message)
      setStep('password')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            <h1>Sign in</h1>
          </CardTitle>
          {step === 'code' && <CardDescription>Your account has two-step sign-in.</CardDescription>}
        </CardHeader>
        <CardContent>
          {step === 'password' ? (
            <PasswordStep
              registerPath={registerPath}
              restartReason={restartReason}
              onResult={onResult}
            />
          ) : (
            <CodeStep
              onResult={onResult}
              onStartOver={() => {
                setRestartReason(null)
                setStep('password')
              }}
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function PasswordStep({
  registerPath,
  restartReason,
  onResult,
}: {
  registerPath: string | null
  restartReason: string | null
  onResult: (result: SignInResult) => void
}) {
  const { login } = useAuth()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)
  const held = useRateLimitHold(submitError)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: LOGIN_FORM_DEFAULTS,
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      onResult(await login(values.email, values.password))
    } catch (err) {
      const error = err as AppError
      if (error.kind === 'validation' && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof LoginFormValues, { message: messages[0] })
        }
      } else {
        // 401 lands here as one form-level message — never bound to the
        // email or password field individually, so a failed attempt can't
        // be used to confirm which part was wrong. So does a 429.
        setSubmitError(error)
      }
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {restartReason && <FieldError>{restartReason}</FieldError>}
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
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register('password')}
          />
          <FieldError errors={[form.formState.errors.password]} />
        </Field>
      </FieldGroup>

      {submitError && <ErrorState error={submitError} />}

      <Button type="submit" disabled={isSubmitting || held}>
        {isSubmitting && <Spinner className="size-4" />}
        Sign in
      </Button>

      {registerPath !== null && (
        <Button variant="link" size="sm" nativeButton={false} render={<Link to={registerPath} state={location.state} />}>
          Create account
        </Button>
      )}
    </form>
  )
}

function CodeStep({
  onResult,
  onStartOver,
}: {
  onResult: (result: SignInResult) => void
  onStartOver: () => void
}) {
  const [recovery, setRecovery] = useState(false)
  // A fresh form per mode: its own schema, an empty field, and the
  // browser's one-time-code autofill and numeric keypad following the mode.
  return (
    <CodeForm
      key={recovery ? 'recovery' : 'totp'}
      recovery={recovery}
      onSwitchMode={() => setRecovery((value) => !value)}
      onResult={onResult}
      onStartOver={onStartOver}
    />
  )
}

function CodeForm({
  recovery,
  onSwitchMode,
  onResult,
  onStartOver,
}: {
  recovery: boolean
  onSwitchMode: () => void
  onResult: (result: SignInResult) => void
  onStartOver: () => void
}) {
  const { submitTotp } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)
  const held = useRateLimitHold(submitError)

  const form = useForm<CodeFormValues>({
    resolver: zodResolver(recovery ? recoveryCodeFormSchema : totpCodeFormSchema),
    defaultValues: { code: '' },
  })
  // The field takes the caret when the step (or the mode) appears.
  useEffect(() => form.setFocus('code'), [form])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      onResult(await submitTotp(values.code))
    } catch (err) {
      const error = err as AppError
      if (error.kind === 'auth' || (error.kind === 'validation' && error.fieldErrors?.code)) {
        // A wrong code is the field's error: the code is the only thing typed.
        form.setError('code', { message: error.fieldErrors?.code?.[0] ?? error.message }, { shouldFocus: true })
      } else {
        setSubmitError(error)
      }
    } finally {
      setIsSubmitting(false)
    }
  })

  const invalid = !!form.formState.errors.code
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="login-code">{recovery ? 'Recovery code' : 'Authentication code'}</FieldLabel>
          <Input
            id="login-code"
            autoComplete={recovery ? 'off' : 'one-time-code'}
            inputMode={recovery ? 'text' : 'numeric'}
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby="login-code-description"
            {...form.register('code')}
          />
          <FieldDescription id="login-code-description">
            {recovery
              ? 'One of the recovery codes you saved when two-step sign-in was turned on. Each works once.'
              : 'The 6-digit code your authenticator app shows for this account.'}
          </FieldDescription>
          <FieldError errors={[form.formState.errors.code]} />
        </Field>
      </FieldGroup>

      {submitError && <ErrorState error={submitError} />}

      <Button type="submit" disabled={isSubmitting || held}>
        {isSubmitting && <Spinner className="size-4" />}
        Verify
      </Button>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="link" size="sm" onClick={onSwitchMode}>
          {recovery ? 'Use your authenticator app' : 'Use a recovery code'}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    </form>
  )
}
