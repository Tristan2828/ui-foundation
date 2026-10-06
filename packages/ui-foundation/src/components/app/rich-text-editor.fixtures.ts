// Markdown the rich-text editor must round-trip: the content real notes
// hold (headings, nested lists, tables, links, task lists), plus the cases
// its serializer writes its own way. `editorWrites` is what the editor
// serializes each fixture to when nothing is edited (captured from the
// real editor, Milkdown 7.22; recapture when it changes), so
// the merge tests in tests/markdown-merge.test.ts run on genuine output.
// Not shipped: the build leaves *.fixtures.ts out.
export type MarkdownFixture = { markdown: string; editorWrites: string }

export const MARKDOWN_FIXTURES: Record<string, MarkdownFixture> = {
  headings: {
    markdown: "# Title\n\nIntro paragraph.\n\n## Second level\n\nText under it.\n\n### Third level\n\nMore text.\n",
    editorWrites: "# Title\n\nIntro paragraph.\n\n## Second level\n\nText under it.\n\n### Third level\n\nMore text.\n",
  },
  nestedLists: {
    markdown: "- One\n- Two\n  - Two point one\n  - Two point two\n    - Deep\n- Three\n\n1. First\n2. Second\n   1. Nested ordered\n   2. Another\n3. Third\n",
    editorWrites: "- One\n- Two\n  - Two point one\n  - Two point two\n    - Deep\n- Three\n\n1. First\n2. Second\n   1. Nested ordered\n   2. Another\n3. Third\n",
  },
  starBullets: {
    markdown: "* Alpha\n* Beta\n  * Gamma\n",
    editorWrites: "* Alpha\n* Beta\n  * Gamma\n",
  },
  table: {
    markdown: "| Part | Count | Note |\n| :--- | ---: | :---: |\n| Receiver | 1 | small |\n| Battery | 2 | AA |\n\nAfter the table.\n",
    editorWrites: "| Part     | Count |  Note |\n| :------- | ----: | :---: |\n| Receiver |     1 | small |\n| Battery  |     2 |   AA  |\n\nAfter the table.\n",
  },
  links: {
    markdown: "See the [setup guide](https://example.com/setup) and [titled](https://example.com \"Title\").\n\nAn autolink <https://example.com/auto> and a bare https://example.com/bare one.\n",
    editorWrites: "See the [setup guide](https://example.com/setup) and [titled](https://example.com \"Title\").\n\nAn autolink <https://example.com/auto> and a bare <https://example.com/bare> one.\n",
  },
  referenceLinks: {
    markdown: "A [reference link][ref] here.\n\n[ref]: https://example.com/ref\n\nA closing paragraph.\n",
    editorWrites: "A [reference link](https://example.com/ref) here.\n\nA closing paragraph.\n",
  },
  taskList: {
    markdown: "- [ ] Open item\n- [x] Done item\n  - [ ] Nested open\n\nNotes after the list.\n",
    editorWrites: "- [ ] Open item\n- [x] Done item\n  - [ ] Nested open\n\nNotes after the list.\n",
  },
  inline: {
    markdown: "Some *emphasis*, **strong**, `code`, ~~struck~~ and _underscore emphasis_ and __underscore strong__.\n\nSecond paragraph.\n",
    editorWrites: "Some *emphasis*, **strong**, `code`, ~~struck~~ and _underscore emphasis_ and __underscore strong__.\n\nSecond paragraph.\n",
  },
  blocks: {
    markdown: "> A quote\n> over two lines\n\n```ts\nconst x = 1\n```\n\n---\n\nAfter the rule.\n",
    editorWrites: "> A quote\n> over two lines\n\n```ts\nconst x = 1\n```\n\n---\n\nAfter the rule.\n",
  },
  rawHtml: {
    markdown: "Before <b>not bold</b> after.\n\n<div>block html</div>\n\n<script>alert(1)</script>\n\nEnd.\n",
    editorWrites: "Before <b>not bold</b> after.\n\n<div>block html</div>\n\n<script>alert(1)</script>\n\nEnd.\n",
  },
  hardBreak: {
    markdown: "Line one  \nLine two\\\nLine three\n\nAnother paragraph.\n",
    editorWrites: "Line one\\\nLine two\\\nLine three\n\nAnother paragraph.\n",
  },
  shortTableRow: {
    markdown: "Intro line.\n\n| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| only one cell |\n\nOutro.\n",
    editorWrites: "Intro line.\n\n| a             | b | c |\n| ------------- | - | - |\n| 1             | 2 | 3 |\n| only one cell |   |   |\n\nOutro.\n",
  },
  boldLink: {
    markdown: "Intro line.\n\n- [**Example**](https://example.com) is a site\n- second item\n\nOutro.\n",
    editorWrites: "Intro line.\n\n- **[Example](https://example.com)** is a site\n- second item\n\nOutro.\n",
  },
  nestedMarks: {
    markdown: "Intro.\n\n[*__z__*](https://example.com/z) and ~~[**s**](https://example.com/s)~~ and **a *b* c**\n\nOutro.\n",
    editorWrites: "Intro.\n\n*__[z](https://example.com/z)__* and **[~~s~~](https://example.com/s)** and **a *b* c**\n\nOutro.\n",
  },
  mixed: {
    markdown: "# Plan\n\nIntro with a [link](https://example.com).\n\n- [ ] Task one\n- [x] Task two\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n1. Step\n   - sub\n",
    editorWrites: "# Plan\n\nIntro with a [link](https://example.com).\n\n- [ ] Task one\n- [x] Task two\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n1. Step\n   - sub\n",
  },
}
