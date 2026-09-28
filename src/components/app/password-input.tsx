import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useId, useState } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

// A password field with a show/hide toggle. Composed from shadcn's
// InputGroup rather than hand-rolled: shadcn has no dedicated password
// input, but InputGroupAddon + InputGroupButton is exactly the
// trailing-control shape, and AGENTS.md's Hard Rule is about not
// re-implementing what shadcn ships, not about avoiding composition.
//
// Three fields need this (login, and register's password + confirmation),
// which is why it is a component rather than repeated markup.
//
// One consequence worth knowing before writing a test against a password
// field: the toggle's accessible name contains the word "password", so a
// substring `getByLabel('Password')` now matches both the input and this
// button and fails Playwright's strict mode. Use `{ exact: true }` — the
// button's name is right for users, and the test should be the precise
// one.
export function PasswordInput({
  id,
  autoComplete,
  'aria-invalid': ariaInvalid,
  ...props
}: React.ComponentProps<'input'> & { 'aria-invalid'?: boolean }) {
  const [isVisible, setIsVisible] = useState(false)
  // The toggle's own accessible name changes with state, so a screen
  // reader hears what the button will *do*, not what it is.
  const Icon = isVisible ? EyeOffIcon : EyeIcon
  const describedById = useId()

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type={isVisible ? 'text' : 'password'}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        aria-describedby={describedById}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          // aria-pressed would also be defensible; the changing label is
          // clearer, and announcing both is redundant.
          onClick={() => setIsVisible((shown) => !shown)}
        >
          <Icon />
        </InputGroupButton>
      </InputGroupAddon>
      {/* Revealing a password is visual only — it never leaves the page —
          but a reader should know the field can be shown at all. */}
      <span id={describedById} className="sr-only">
        Password is hidden. Use the show password button to reveal it.
      </span>
    </InputGroup>
  )
}
