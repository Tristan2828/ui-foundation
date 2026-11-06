// The lint rule that makes every list say how it opens a record
// (`uiFoundation({ requireTableOpens: true })`): a DataTable without
// `opens` fails, one with it passes, and it's off unless asked for.
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { TABLE_OPENS } from '../eslint/index.js'

function lint(code: string, rules: object[]) {
  const linter = new Linter({ configType: 'flat' })
  return linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        rules: { 'no-restricted-syntax': ['error', ...rules] },
      },
    ],
    'list.tsx',
  )
}

const without = `export const List = () => <DataTable columns={[]} data={[]} />`
const withOpens = `export const List = () => <DataTable columns={[]} opens={{ kind: 'rows' }} data={[]} />`

describe('requireTableOpens', () => {
  it('fails a DataTable that does not say how it opens a record', () => {
    const messages = lint(without, [TABLE_OPENS])
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('opens')
  })

  it('passes one that does', () => {
    expect(lint(withOpens, [TABLE_OPENS])).toEqual([])
  })

  it('leaves other components alone', () => {
    expect(lint(`export const X = () => <EntityView title="x" />`, [TABLE_OPENS])).toEqual([])
  })

  it('is off without the option', () => {
    expect(lint(without, [])).toEqual([])
  })
})
