import { describe, expect, it } from 'vitest'
import { titleCase } from '@/lib/title-case'

describe('titleCase', () => {
  it('capitalises every word but the small ones', () => {
    expect(titleCase('show deleted')).toBe('Show Deleted')
    expect(titleCase('rows per page')).toBe('Rows per Page')
    expect(titleCase('back to the list')).toBe('Back to the List')
    expect(titleCase('save and next')).toBe('Save and Next')
    expect(titleCase('add a row')).toBe('Add a Row')
  })

  it('capitalises a small word first or last', () => {
    expect(titleCase('the list')).toBe('The List')
    expect(titleCase('move to')).toBe('Move To')
    expect(titleCase('group by')).toBe('Group By')
    expect(titleCase('a')).toBe('A')
  })

  it('capitalises the word after a colon', () => {
    expect(titleCase('step one: a plan')).toBe('Step One: A Plan')
  })

  it('leaves a word that already holds a capital as written', () => {
    expect(titleCase('open in GitHub')).toBe('Open in GitHub')
    expect(titleCase('export to CSV')).toBe('Export to CSV')
    expect(titleCase('Rows per Page')).toBe('Rows per Page')
  })

  it('capitalises each part of a hyphenated word', () => {
    expect(titleCase('a follow-up note')).toBe('A Follow-Up Note')
    expect(titleCase('sign-in')).toBe('Sign-In')
  })

  it('keeps apostrophes, punctuation, numbers and spacing', () => {
    expect(titleCase("reset to the list's columns")).toBe("Reset to the List's Columns")
    expect(titleCase('view all 12')).toBe('View All 12')
    expect(titleCase('“quoted” words')).toBe('“Quoted” Words')
    expect(titleCase('  two  spaces ')).toBe('  Two  Spaces ')
    expect(titleCase('')).toBe('')
  })
})
