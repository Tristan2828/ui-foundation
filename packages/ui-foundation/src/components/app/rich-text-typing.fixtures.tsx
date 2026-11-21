import type { Meta, StoryObj } from '@/fixtures/types'
import { useId, useState } from 'react'
import { RichTextEditor } from './rich-text-editor'

// How the editor behaves as you type: leaving a block at a note's
// edge, typed Markdown, Backspace and Tab in lists, the slash menu on any line. Each editor has
// the Markdown it would save beside it (e2e/rich-text-editor.spec.ts).
const meta: Meta<typeof RichTextEditor> = {
  title: 'app/RichTextEditor Typing',
  component: RichTextEditor,
  parameters: { controls: { disable: true } },
}

export default meta

function Saved({ label, markdown }: { label: string; markdown: string }) {
  const labelId = useId()
  const [saved, setSaved] = useState(markdown)
  return (
    <div className="flex flex-col gap-2" data-fixture={label}>
      <span id={labelId} className="type-label text-foreground">
        {label}
      </span>
      <RichTextEditor aria-labelledby={labelId} defaultValue={markdown} onChange={setSaved} />
      <pre data-testid={`saved-${label}`} className="sr-only">
        {saved}
      </pre>
    </div>
  )
}

export const Typing: StoryObj<typeof RichTextEditor> = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <Saved label="onlyCode" markdown={'```\nlast line\n```\n'} />
      <Saved label="codeFirst" markdown={'```\nfirst line\n```\n\nAfter the code.\n'} />
      <Saved label="onlyTable" markdown={'| Part | Count |\n| --- | --- |\n| Top | 1 |\n'} />
      <Saved label="quoteLast" markdown={'Before.\n\n> Quoted words.\n'} />
      <Saved label="plainLast" markdown={'Only a line.\n'} />
      <Saved label="list" markdown={'Above.\n\n- one\n- two\n'} />
      <Saved label="nested" markdown={'- one\n  - two\n'} />
      <Saved label="heading" markdown={'# Title\n\n- item\n'} />
      <Saved label="tasks" markdown={'- [ ] Open item\n- [x] Done item\n'} />
      <Saved label="cells" markdown={'| Part | Count |\n| --- | --- |\n| Top | 1 |\n\nAfter the table.\n'} />
      <Saved label="writing" markdown={'Start here.\n'} />
    </div>
  ),
}
