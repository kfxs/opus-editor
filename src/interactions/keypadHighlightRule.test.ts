import { describe, it, expect } from 'vitest'
import { multipleNotesSelected, type SelectionItem } from './selection'
import { noNoteInSelection } from './keypadSync'
import { createEditorState } from './EditorState'
import { itemKey } from './selection'

const note = (id: string): SelectionItem => ({ kind: 'note', id })
const dynamic = (id: string): SelectionItem => ({ kind: 'dynamic', id })

function stateWith(items: SelectionItem[], tool: 'selection' | 'entry' = 'selection') {
  const state = createEditorState()
  state.selectedTool = tool
  for (const it of items) state.selectedItems.set(itemKey(it), it)
  const noteIds = items.filter(i => i.kind === 'note') as { id: string }[]
  state.selectedNoteId = noteIds.length ? noteIds[noteIds.length - 1].id : null
  return state
}

describe('multipleNotesSelected', () => {
  it('is false for zero or one note', () => {
    expect(multipleNotesSelected([])).toBe(false)
    expect(multipleNotesSelected([note('a')])).toBe(false)
  })

  it('is true for two or more notes', () => {
    expect(multipleNotesSelected([note('a'), note('b')])).toBe(true)
    expect(multipleNotesSelected([note('a'), note('b'), note('c')])).toBe(true)
  })

  it('counts notes, not items — a note plus a non-note is still single', () => {
    expect(multipleNotesSelected([note('a'), dynamic('d')])).toBe(false)
  })
})

describe('noNoteInSelection (Keypad single-selection gate)', () => {
  it('false when exactly one note is selected (the Keypad reflects it)', () => {
    expect(noNoteInSelection(stateWith([note('a')]))).toBe(false)
  })

  it('true when more than one note is selected (the Keypad shows nothing)', () => {
    expect(noNoteInSelection(stateWith([note('a'), note('b')]))).toBe(true)
  })

  it('true when nothing is selected', () => {
    expect(noNoteInSelection(stateWith([]))).toBe(true)
  })

  it('false outside selection mode (entry mode reflects the armed value)', () => {
    expect(noNoteInSelection(stateWith([note('a'), note('b')], 'entry'))).toBe(false)
  })
})
