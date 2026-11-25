import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import {
  Bed,
  Briefcase,
  Car,
  House,
  MapPin,
  Monitor,
  PersonStanding,
  Phone,
  ShoppingCart,
  Sofa,
  Trees,
} from 'lucide-react'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { IconField, type IconFieldOption } from './icon-field'

// An icon picked from a grid, closed and open. The second field draws its
// trigger with renderIcon, as a category's tinted glyph would be. Axe and
// the token check run both in both themes (e2e/fixtures-visual.spec.ts);
// e2e/icon-field.spec.ts drives it, at laptop and phone widths.

type Place = 'person-standing' | 'monitor' | 'briefcase' | 'car' | 'house' | 'sofa' | 'bed' | 'phone' | 'shopping-cart' | 'trees' | 'map-pin'

const PLACES: IconFieldOption<Place>[] = [
  { value: 'person-standing', label: 'Up and moving', icon: PersonStanding },
  { value: 'monitor', label: 'Computer', icon: Monitor },
  { value: 'briefcase', label: 'Work', icon: Briefcase },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'house', label: 'House', icon: House },
  { value: 'sofa', label: 'Sofa', icon: Sofa },
  { value: 'bed', label: 'Bed', icon: Bed },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'shopping-cart', label: 'Shopping', icon: ShoppingCart },
  { value: 'trees', label: 'Outside', icon: Trees },
  { value: 'map-pin', label: 'Somewhere else', icon: MapPin },
]

function OnAForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [place, setPlace] = useState<Place>('monitor')
  const [tinted, setTinted] = useState<Place>('house')
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="place-icon">Place Icon</FieldLabel>
        <IconField id="place-icon" options={PLACES} value={place} onChange={setPlace} defaultOpen={defaultOpen} />
        <output data-testid="place-value">{place}</output>
      </Field>
      <Field>
        <FieldLabel htmlFor="tinted-icon">Category Icon</FieldLabel>
        <IconField
          id="tinted-icon"
          options={PLACES}
          value={tinted}
          onChange={setTinted}
          renderIcon={(value) => {
            const Icon = PLACES.find((option) => option.value === value)?.icon ?? MapPin
            return (
              <span data-testid="tinted-glyph" className="inline-flex size-5 items-center justify-center rounded bg-primary text-primary-foreground">
                <Icon aria-hidden="true" className="size-3.5" />
              </span>
            )
          }}
        />
        <output data-testid="tinted-value">{tinted}</output>
      </Field>
    </FieldGroup>
  )
}

const meta: Meta = {
  title: 'app/IconField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const Open: StoryObj = { render: () => <OnAForm defaultOpen /> }
