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
| `foundation_backend.push` | `ui-foundation-backend` | `send_push(session, user_id, title, body, url)`: encrypted (RFC 8291), signed (VAPID), to every device the user allowed; optionally a `PushAction` button and `renotify` |
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
  (the package's fixtures, `app/AllowReminders`):

| `status` | Means | Shows |
|---|---|---|
| `off` | Can be turned on | The description and "Allow Reminders" |
| `on` | This device gets them | "Reminders are on for this device", and "Turn Off" |
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
- **Reminders in a table of the app's own** (another schema, another
  name, as an app with a schema per module keeps them): define its table
  model with the same columns (`id`, `user_id`, `title`, `body`, `url`,
  `time_of_day`, `days`, `time_zone`, `enabled`, `last_sent_on`) and hand
  it to the job, `reminders.register(model=MyReminder)` in place of
  `reminders.register()`. Left out, the job reads the package's
  `reminders` table. Neither table is on `SQLModel.metadata` until the
  app uses it: `push_subscriptions` arrives with `foundation_backend.push`
  (and `foundation_backend.reminders`, which sends through it), the
  package's `reminders` only with its `Reminder` model (imported, or the
  job run without a model). So an app without push, or with its own
  table, gets neither from `create_all` or autogenerate.
- **Channels beyond push** (email, a phone-alert app): hand the job a
  sender per channel, and it still decides what's due and stamps it once.
  A sender is `async def send(session, reminder)`: it returns `None` when
  sent, or a `ChannelResult` ("sent", "failed" with its `error`, or
  "skipped"), and an exception it raises is a failed result. `channels`
  picks a reminder's channels (every one when left out; push is
  `"push"`), and `on_sent` sees each reminder's results before its stamp
  is committed, so a last-sent time per channel lands with it:

  ```python
  reminders.register(
      model=MyReminder,
      senders={"email": send_email},
      channels=lambda r: r.channels.split(","),
      on_sent=stamp_channels,  # async (session, reminder, results)
  )
  ```

  One failed channel doesn't stop the others; it's sent to error
  reporting, and the reminder is done for the day either way (a channel
  that's down isn't tried again every minute). A sender reads the session
  but doesn't write it. `run_due_reminders` (same arguments) returns
  each reminder's results, for a script or a test; a sender named
  `"push"` replaces the package's.
- **Something else to send?** Call `send_push` from the app's own code or
  job: a message when a long task finishes, a daily summary. The `url` is
  always the app's own path.
- **Time zones** come from the system's time zone database. On Windows
  that's the `tzdata` package, which the backend doesn't install: a
  Windows dev machine reads only `UTC` until it's added.

## Repeating reminders (4.95)

A weekday set and one time is the simple schedule. For anything more
(every 2nd Tuesday, the last day of the month, several times a day, an
end, "every! 3 days" counted from when it's done), a reminder carries a
**recurrence**: the contract's `Recurrence` schema (in the package's
`openapi/foundation.yaml`, marked `x-optional`: copy it into
`components.schemas` and reference it from the reminder's schema), the
package's `RecurrenceField` on the form and `inPlace.recurrence` on the
view, and `foundation_backend.recurrence` on the server. Both sides read
the same rules and agree on every next occurrence.

- **The value**: `{ rule, start, times, timeZone, fromCompletion }`.
  `rule` is RFC 5545's RRULE without DTSTART (`FREQ=MONTHLY;BYDAY=2TU`):
  FREQ daily to yearly, INTERVAL, BYDAY with an nth (`2TU`, `-1FR`),
  BYMONTHDAY (`-1` the last day), BYMONTH, UNTIL (a date) or COUNT.
  `start` is the first day it can fall on; each of `times` is an
  occurrence on every day the rule falls on, read in `timeZone`. A day a
  month lacks is skipped (the 31st, Feb 29), as in RFC 5545.
- **The columns**: the app's reminders model inherits
  `foundation_backend.recurrence_models.RecurringReminderFields` and its
  migration adds them: `recurrence` (JSON), `next_at`, `sent_at`,
  `last_sent_at`, `done_occurrence`, `done_at` (timestamps with time
  zone), `nag_count` (integer, default 0), `nag_every_minutes` and
  `nag_limit` (integers, null for no nagging). `days` and `time_of_day`
  become nullable. Hand the model to the job as before
  (`reminders.register(model=MyReminder)`).
- **What the job does with a row whose `recurrence` is set**: each
  occurrence is due from its time until 15 minutes have passed, so
  several a day go out; one missed past that is skipped, not sent late
  (the run's line says "1 missed"). Sent and not done, it's re-sent
  every `nag_every_minutes`, at most `nag_limit` times (3 when only the
  interval is set). The next occurrence coming round ends the wait; a
  `fromCompletion` rule waits for done instead. A row with no
  `recurrence` is the weekday set, as before.
- **Done**: the app's Done button (or a notification action that calls
  the app) runs `reminders.mark_done(row)` and commits: the occurrence is
  recorded (`done_occurrence`, `done_at`), nagging stops, and the next is
  pending; for `fromCompletion` it counts from the done time (and from
  the notification itself: "A Done button on the notification" below).
  After the rule itself changes, `reminders.schedule_changed(row)` forgets where it
  was.
- **Moving a simple schedule over**: `recurrence.from_weekdays(days,
  time_of_day, time_zone, start=today)` (and the package's
  `recurrenceFromWeekdays`) is the same schedule exactly; store its
  `model_dump(by_alias=True, mode="json")` in `recurrence`.
  `recurrence.as_weekdays(rule)` goes back when a rule is still that
  simple.
- **On screens**: `RecurrenceField` in the form (a `Controller`; check
  with `recurrenceProblem`), `inPlace.recurrence` on the view, and in the
  list `formatRecurrence` for a Repeats column and `nextOccurrence` with
  `formatOccurrence` for a Next one (cell-patterns.md "A repeat and its
  next time").

## A Done button on the notification (4.104)

A repeating reminder's push can carry a **Done** button that marks the
occurrence done without opening the app. The app names its own endpoint;
the job puts it on each occurrence's push:

```python
from foundation_backend import push, reminders

reminders.register(
    model=MyReminder,
    done_action=lambda row, occurrence: push.PushAction(
        f"/api/reminders/{row.id}/done", {"occurrence": occurrence.isoformat()}
    ),
)
```

- **The endpoint is the app's**: an ordinary signed-in route
  (`POST /reminders/{id}/done`, body `{ occurrence }`) that loads the
  user's own row, checks the occurrence is still the pending one (a tap
  on an old notification marks nothing), runs `reminders.mark_done(row)`
  and commits. Answer 2xx when done or already done; anything else counts
  as a failure. Return nothing the worker needs to read.
- **What the service worker does** (`/push-sw.js`, from `pwa()`): shows
  the button where the browser has notification buttons (Chrome, Edge,
  Firefox on desktop, Chrome on Android). Tapped, it POSTs the action's
  body as JSON to its path on the app's own origin with the session
  cookie (`credentials: 'same-origin'`), and opens no window. Done, the
  notification closes. Refused (signed out, a 4xx or 5xx) or offline, it
  opens the reminder's `url` instead, so the person can do it in the app.
- **iOS Safari and any browser without buttons** shows the notification
  without one; a tap opens the `url` as always. Keep a Done button on the
  reminder's own page.
- **Only the app's own paths.** `PushAction`'s `path` (like `url`) must
  start with one `/`: `send_push` refuses `https://...`, `//host`, a
  backslash or a control character, and the worker checks again and
  drops a button whose path resolves to any other origin.
- **Nags sound again.** A nag is re-sent under the same tag
  (`reminder-{id}`), which a browser otherwise replaces silently; the job
  sends it with `renotify`, so it rings again. `send_push(..., tag=...,
  renotify=True, action=PushAction(...))` does the same for an app's own
  pushes.
- **A weekday-set reminder** (no `recurrence`) has no occurrence to mark,
  so it gets no button. Left out, `done_action` adds none: pushes look as
  before.

## Testing

Under MSW the page is held by MSW's service worker, so `usePushPermission`
reads `mock` and never subscribes: screens show the `mock` state, and a
Playwright spec checks it the same way. The rest is the backend's: its
tests decrypt every message as a browser would. To try it end to end, run
the real backend with push on, allow reminders in the browser, then
`python -m foundation_backend.scripts.send_test_push <email>` (from `backend/`).
