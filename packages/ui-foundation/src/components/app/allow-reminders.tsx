// "Allow reminders": says what they are, then asks, on a click, never on
// load. One per device, wherever the app's reminders are set (a settings
// page, the top of a reminders list). Takes usePushPermission()'s result,
// so a story or test can show any state:
//
//   const push = usePushPermission()
//   <AllowReminders push={push} />
//
// Each state says what to do next in the person's own terms: on an
// iPhone, add the app to the Home Screen first; once refused, only the
// browser's site settings undo it.
import type { ReactNode } from 'react'
import { BellIcon, BellOffIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PushPermission } from '@/hooks/use-push-permission'
import { Notice } from './notice'

export type AllowRemindersProps = {
  push: PushPermission
  /** What reminders are for, in the app's words, shown before asking. */
  description?: ReactNode
  className?: string
}

const DEFAULT_DESCRIPTION =
  'Get a notification on this device at the times you set, even when the app is closed. Your browser will ask first.'

export function AllowReminders({ push, description = DEFAULT_DESCRIPTION, className }: AllowRemindersProps) {
  const { status, pending, error } = push
  return (
    <div
      data-slot="allow-reminders"
      className={cn('flex flex-col gap-3', className)}
      aria-busy={status === undefined || pending}
    >
      {status === undefined && <Skeleton className="h-9 w-full max-w-md" />}
      {status === 'off' && (
        <>
          <p className="text-sm text-foreground">{description}</p>
          <div>
            <Button onClick={push.enable} disabled={pending}>
              <BellIcon aria-hidden="true" />
              {pending ? 'Turning on…' : 'Allow reminders'}
            </Button>
          </div>
        </>
      )}
      {status === 'on' && (
        <Notice
          tone="success"
          icon={BellIcon}
          action={
            <Button size="sm" variant="outline" onClick={push.disable} disabled={pending}>
              <BellOffIcon aria-hidden="true" />
              {pending ? 'Turning off…' : 'Turn off'}
            </Button>
          }
        >
          Reminders are on for this device.
        </Notice>
      )}
      {status === 'needs-install' && (
        <Notice title="Add the app to your Home Screen first">
          On iPhone and iPad, reminders work in the app from the Home Screen. Tap Share, then Add to Home Screen,
          open the app from there and allow reminders.
        </Notice>
      )}
      {status === 'blocked' && (
        <Notice tone="warning" title="Notifications are blocked" icon={BellOffIcon}>
          This browser was told not to show this app&rsquo;s notifications. Allow them in the site&rsquo;s settings
          (the icon beside the address), then reload.
        </Notice>
      )}
      {status === 'unsupported' && (
        <p className="text-sm text-muted-foreground">This browser can&rsquo;t show reminders.</p>
      )}
      {status === 'mock' && (
        <p className="text-sm text-muted-foreground">
          Reminders need the real backend: with mock data nothing can send them.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      )}
    </div>
  )
}
