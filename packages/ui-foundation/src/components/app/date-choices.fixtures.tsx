import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import type { WeekdayCode } from '@/lib/recurrence'
import { DateChoices } from './date-choices'

// A list row's ⋯ "move to" picker (e2e/date-choices.spec.ts): the parts of
// the day with their start times, the first one over, then Tomorrow with
// its day, then the month. Each choice and each day says what it did in
// the output below, and the day the row is on moves with a picked day.
function MoveRow({ weekStart, noChoices = false }: { weekStart?: WeekdayCode; noChoices?: boolean }) {
  const [day, setDay] = useState<PlainDate>('2026-11-25')
  const [did, setDid] = useState('nothing yet')
  const choices = noChoices
    ? []
    : [
        { label: 'Morning', value: '7:00 AM', disabled: true, onSelect: () => setDid('Morning') },
        { label: 'Work', value: '1:00 PM', onSelect: () => setDid('Work') },
        { label: 'Evening', value: '5:00 PM', onSelect: () => setDid('Evening') },
        { label: 'Night', value: '8:00 PM', onSelect: () => setDid('Night') },
        { label: 'Tomorrow', value: 'Thu, Nov 26', onSelect: () => (setDay('2026-11-26'), setDid('Tomorrow')) },
      ]
  return (
    <div className="flex max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <span className="font-medium text-card-foreground">Water the plants</span>
        <span className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" data-testid="row-day">
            {formatPlainDate(day, { weekday: 'short', month: 'short', day: 'numeric' }, 'en-US')}
          </span>
          <DateChoices
            trigger={<Button size="icon-sm" variant="ghost" aria-label="Move Water the plants" />}
            label="Move Water the plants"
            choicesLabel="Move to"
            choices={choices}
            value={day}
            today="2026-11-25"
            weekStart={weekStart}
            onPick={(next) => (setDay(next), setDid(`picked ${next}`))}
          >
            <MoreHorizontalIcon />
          </DateChoices>
        </span>
      </div>
      <output data-testid="did">{did}</output>
    </div>
  )
}

const meta: Meta = {
  title: 'app/DateChoices',
  parameters: { controls: { disable: true } },
}

export default meta

export const MoveTo: StoryObj = { render: () => <MoveRow /> }

export const WeeksFromSunday: StoryObj = { render: () => <MoveRow weekStart="SU" /> }

export const CalendarOnly: StoryObj = { render: () => <MoveRow noChoices /> }
