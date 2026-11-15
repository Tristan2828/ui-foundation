// A fact's extras (4.115), shared by the facts rail, Details and the
// strip's values (KeyStats, 4.120): a hint behind an info button, and a
// small action button under the value. And a `switch` fact's switch (4.120).
import { useId, useState } from 'react'
import { InfoIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EntityViewFactAction, EntityViewFactValue } from './entity-view-facts'
import { usePrinting } from './print-context'

// A fact's hint (4.115): an info button after the value, its words in a
// tooltip on hover and on keyboard focus. On a touch screen, where a
// tooltip has no hover to open it, the words are a line under the value
// instead (and the button goes). A screen reader reads the words with the
// value either way: the line is there for it, only visually hidden on a
// mouse's screen, and it describes the button.
export function FactHint({ label, hint }: { label: string; hint: string }) {
  const id = useId()
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              data-slot="entity-view-fact-hint"
              aria-label={`About ${label}`}
              aria-describedby={id}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:hidden"
            />
          }
        >
          <InfoIcon aria-hidden="true" className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <span id={id} data-slot="entity-view-fact-hint-text" className="sr-only basis-full type-caption text-muted-foreground pointer-coarse:not-sr-only">
        {hint}
      </span>
    </>
  )
}

// A fact's action (4.115): a small button under its value, or the app's
// own action given that button (`render`), so its dialog opens from it.
export function FactAction({ action }: { action: EntityViewFactAction }) {
  const Icon = action.icon
  const button = (
    <Button
      type="button"
      variant="outline"
      size="xs"
      data-slot="entity-view-fact-action"
      onClick={action.render ? undefined : action.onClick}
      className="pointer-coarse:min-h-11"
    >
      {Icon && <Icon aria-hidden="true" data-icon="inline-start" />}
      {action.label}
    </Button>
  )
  return <div className="flex">{action.render ? action.render(button) : button}</div>
}


type SwitchFact = Extract<EntityViewFactValue, { kind: 'switch' }>

// A `switch` fact's switch and its word. The shown state is the app's
// `checked` unless a save is in flight, when it's the state being saved.
export function FactSwitch({ fact, label }: { fact: SwitchFact; label: string }) {
  const printing = usePrinting()
  const [saving, setSaving] = useState<boolean | null>(null)
  const checked = saving ?? fact.checked
  const words = fact.on !== undefined && fact.off !== undefined ? { on: fact.on, off: fact.off } : undefined
  if (printing) return <span data-slot="entity-view-fact-switch-print">{words ? (checked ? words.on : words.off) : checked ? 'Yes' : 'No'}</span>
  const onCheckedChange = (next: boolean) => {
    // One save at a time: a toggle while one is in flight waits for it (focus stays).
    if (saving !== null) return
    const result = fact.onCheckedChange(next)
    if (!result || typeof (result as Promise<unknown>).then !== 'function') return
    setSaving(next)
    ;(result as Promise<unknown>).then(
      () => setSaving(null),
      () => setSaving(null),
    )
  }
  return (
    <span data-slot="entity-view-fact-switch" className="inline-flex max-w-full items-center gap-2 align-middle">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={fact.disabled}
        aria-label={label}
        aria-busy={saving !== null || undefined}
      />
      {words && (
        // Both words in one cell, the hidden one keeping its room, so the
        // line is as wide on either state. The switch says the state to a
        // screen reader; the words are for the eye.
        <span aria-hidden="true" data-slot="entity-view-fact-switch-word" className="grid min-w-0 text-foreground">
          <span className={cn('col-start-1 row-start-1 truncate', !checked && 'invisible')}>{words.on}</span>
          <span className={cn('col-start-1 row-start-1 truncate', checked && 'invisible')}>{words.off}</span>
        </span>
      )}
    </span>
  )
}

