# Reminders

A notification at a time the user chose ("time for your morning routine",
"a short break at 3 pm", a habit, a medication) that reaches them with the
app closed. It's Web Push: the browser subscribes with its push service
(Google's, Mozilla's, Apple's, Microsoft's), the backend encrypts a message
to that subscription and posts it there, and the push service delivers it
to the device, where the app's service worker shows it.

| Part | Where | What it does |
|---|---|---|
| `pwa({ name })` | `vite.config.ts`, from `@tristan2828/ui-foundation/vite` | The app installable: a manifest, icons in the theme's colours, and `/push-sw.js`, the service worker that shows pushes and opens their path |
| `usePushPermission()` | the package | Whether this device gets reminders, and `enable`/`disable` |
| `AllowReminders` | the package | The control: says what reminders are, then asks, on a click |
| `/push/public-key`, `/push/subscriptions` | `openapi.yaml`, the foundation's part (optional) | The VAPID key to subscribe with; this device's subscription saved or dropped |
| `foundation_backend.push` | `ui-foundation-backend` | `send_push(session, user_id, title, body, url)`: encrypted (RFC 8291), signed (VAPID), to every device the user allowed |
| `foundation_backend.reminders`, `reminders` | `ui-foundation-backend` | A reminder row (when, which days, the text, the path), and the `send-reminders` job that sends each one when it's due |

Off until the backend turns it on (`PUSH_ENABLED`, `docs/deploy.md`
"Reminders (Web Push)"). An app without reminders leaves `/push/*` out of
`openapi.yaml` and `pwa()` out of its config.

## Allowing reminders

```tsx
import { AllowReminders, usePushPermission } from '@tristan2828/ui-foundation'

const push = usePushPermission()
<AllowReminders push={push} description="We'll remind you when it's time for your routine." />
```

- **Never ask on page load.** A prompt nobody expected gets refused, and a
  refusal is final: only the browser's site settings undo it. The button
  says what reminders are first; `enable()` asks then, from the click.
- **Put it where reminders are set**: the top of the reminders list, or a
  settings page. One per device: each phone or browser allows its own.
- **Every state says what to do next.** `AllowReminders` shows them all
  (the package's Storybook, `app/AllowReminders`):

| `status` | Means | Shows |
|---|---|---|
| `off` | Can be turned on | The description and "Allow reminders" |
| `on` | This device gets them | "Reminders are on for this device", and "Turn off" |
| `needs-install` | iPhone or iPad in a browser tab | How to add the app to the Home Screen |
| `blocked` | The person said no | Where to allow it again |
| `unsupported` | No push in this browser | That it can't |
| `mock` | The app runs on MSW | That reminders need the real backend |

## On iPhone and iPad

Push works only in the app added to the Home Screen (Share, then Add to
Home Screen) and opened from there, on iOS 16.4 or later. In a Safari tab
there is no push at all, so `usePushPermission` says `needs-install` and
`AllowReminders` shows the steps. `pwa()`'s manifest (`display:
standalone`) is what makes the Home Screen app an app.

## A reminder is the app's own row

The reference backend has a `reminders` table and the job that sends it;
what a reminder means is the app's. Give it an API and screens like any
entity (`add-an-entity.md`): its fields are `title`, `body`, `url` (a
path in the app, opened when it's tapped), `timeOfDay` ("07:30"), `days`
(some of mon,tue,wed,thu,fri,sat,sun), `timeZone` (the person's IANA
zone: `Intl.DateTimeFormat().resolvedOptions().timeZone`) and `enabled`.
Scope it to the signed-in user, as Widgets are.

- **The job** (`send-reminders`, every minute, with `JOBS_ENABLED`)
  sends a reminder when today is one of its days in its time zone and the
  time has come, once a day at most. More than 15 minutes late (the
  backend was down) and it's skipped for the day rather than sent late.
- **Something else to send?** Call `send_push` from the app's own code or
  job: a message when a long task finishes, a daily summary. The `url` is
  always the app's own path.
- **Time zones** come from the system's time zone database. On Windows
  that's the `tzdata` package, which the backend doesn't install: a
  Windows dev machine reads only `UTC` until it's added.

## Testing

Under MSW the page is held by MSW's service worker, so `usePushPermission`
reads `mock` and never subscribes: screens show the `mock` state, and a
Playwright spec checks it the same way. The rest is the backend's: its
tests decrypt every message as a browser would. To try it end to end, run
the real backend with push on, allow reminders in the browser, then
`python -m foundation_backend.scripts.send_test_push <email>` (from `backend/`).
