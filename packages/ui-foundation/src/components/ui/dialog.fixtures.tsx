import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DiscardChangesDialog,
  type DialogSize,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// DialogContent's `size` (420, 640 and 1,120px; a confirm is a bottom
// sheet under 48rem, a form the whole screen) and `dirty` (closing asks
// "Discard your changes?" while something typed is unsaved).
// Confirm and Discard prompt start open, for axe in both themes
// (fixtures-visual.spec.ts); e2e/dialog.spec.ts drives the rest.

function SizeDialog({ size, label }: { size: DialogSize; label: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>{label}</DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>A {size} dialog</DialogTitle>
          <DialogDescription>
            {size === 'confirm' && '420px: a question and two buttons. A sheet from the bottom on a phone.'}
            {size === 'form' && '640px: a small form. The whole screen on a phone.'}
            {size === 'record' && '1,120px: a record over its list, as wide as its page.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SizesDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <SizeDialog size="confirm" label="A confirm" />
      <SizeDialog size="form" label="A small form" />
      <SizeDialog size="record" label="A record" />
    </div>
  )
}

function ConfirmDemo() {
  const [open, setOpen] = useState(true)
  const [deleted, setDeleted] = useState(false)
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="type-body">{deleted ? 'The Nov 1 balance is gone.' : 'Balances: Nov 1, Oct 1.'}</p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Delete the Nov 1 balance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="confirm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete the Nov 1 balance?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleted(true)
                setOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// A shelf's name: typing makes it dirty, so Esc, the close button, a click
// outside and Cancel ask first. Save closes it from code, which never asks.
function DirtyDemo() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="type-body" data-testid="shelf-result">
        {saved ? `Saved ${saved}` : 'Nothing saved yet'}
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setName('')
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>New shelf</DialogTrigger>
        <DialogContent size="form" dirty={name !== ''}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setSaved(name)
              setName('')
              setOpen(false)
            }}
          >
            <DialogHeader>
              <DialogTitle>New Shelf</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="shelf-name">Name</FieldLabel>
                <Input id="shelf-name" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit">Add Shelf</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DiscardDemo() {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ask Again
      </Button>
      <DiscardChangesDialog open={open} onKeepEditing={() => setOpen(false)} onDiscard={() => setOpen(false)} />
    </div>
  )
}

const meta: Meta = {
  title: 'ui/Dialog',
}
export default meta

type Story = StoryObj

export const Sizes: Story = { render: () => <SizesDemo /> }

export const Confirm: Story = { render: () => <ConfirmDemo /> }

export const Dirty: Story = { render: () => <DirtyDemo /> }

export const DiscardPrompt: Story = { name: 'Discard prompt', render: () => <DiscardDemo /> }
