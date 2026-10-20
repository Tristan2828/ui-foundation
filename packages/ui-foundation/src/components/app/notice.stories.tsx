import type { Meta, StoryObj } from '@storybook/react-vite'
import { LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Notice, type NoticeTone } from './notice'

// Every tone, with and without a title and an action, on the page and on
// a card, so axe and the glyph check measure each wash in both themes
// (e2e/storybook-visual.spec.ts). EntityView's NoticeAndFooter story shows
// one where it usually goes.
const TONES: { tone: NoticeTone; title: string; message: string }[] = [
  { tone: 'info', title: 'Up next', message: 'This is the next item on the reading list.' },
  { tone: 'success', title: 'Finished', message: 'Every step is done. Nothing is waiting on it.' },
  { tone: 'warning', title: 'On hold', message: 'Read “Dune” and “Hyperion” first: this one follows them.' },
  { tone: 'destructive', title: 'Overdue', message: 'This was due back at the library on Sep 2, 2026.' },
]

const meta: Meta = {
  title: 'app/Notice',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-4">
      {TONES.map(({ tone, title, message }) => (
        <Notice
          key={tone}
          tone={tone}
          title={title}
          action={
            <Button size="sm" variant="outline">
              Show
            </Button>
          }
        >
          {message}
        </Notice>
      ))}
      {TONES.map(({ tone, message }) => (
        <Notice key={`${tone}-plain`} tone={tone}>
          {message}
        </Notice>
      ))}
      <Notice icon={LockIcon} title="Archived">
        This record is read-only. Restore it to make changes.
      </Notice>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {TONES.map(({ tone, title, message }) => (
            <Notice key={`${tone}-card`} tone={tone} title={title}>
              {message}
            </Notice>
          ))}
        </CardContent>
      </Card>
    </div>
  ),
}
