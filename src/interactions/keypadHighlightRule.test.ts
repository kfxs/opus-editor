import { describe, it, expect } from 'vitest'
import { multipleNotesSelected, type SelectionItem } from './selection'
import { beamHighlight, beamRoleHighlight, noNoteInSelection, secondaryBreakHighlight, type BeamSource } from './keypadSync'
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

describe('beamHighlight (the dev shell\'s Beam row)', () => {
  it('reports the selected note\'s beam when exactly one note is selected', () => {
    const state = stateWith([note('a')])
    state.selectedBeam = 'begin'   // SelectionController syncs this from the note
    expect(beamHighlight(state, null)).toBe('begin')
  })

  it('reports nothing with no selection — "auto" is a real BeamMode, so an ungated row would claim one', () => {
    const state = stateWith([])
    state.selectedBeam = 'auto'
    expect(beamHighlight(state, null)).toBeNull()
  })

  it('reports nothing when more than one note is selected', () => {
    const state = stateWith([note('a'), note('b')])
    state.selectedBeam = 'begin'
    expect(beamHighlight(state, null)).toBeNull()
  })

  it('reports the ARMED beam in entry mode', () => {
    const state = stateWith([], 'entry')
    state.selectedBeam = 'single'
    expect(beamHighlight(state, null)).toBe('single')
  })

  it('reports nothing under a marking tool — it enters no note to beam', () => {
    const state = stateWith([], 'entry')
    state.selectedBeam = 'single'
    state.selectedMarkingTool = { kind: 'tie' }
    expect(beamHighlight(state, null)).toBeNull()
  })

  it('reports nothing for a selected REST — you cannot beam silence', () => {
    const state = stateWith([note('r')])
    state.selectedBeam = 'auto'
    const rests: BeamSource = { getNote: () => ({ isRest: true }), getBeamRole: () => null }
    expect(beamHighlight(state, rests)).toBeNull()
    expect(beamRoleHighlight(state, rests)).toBeNull()
  })

  it('secondaryBreakHighlight lights only for a single selected note carrying the flag', () => {
    const broken: BeamSource = { getNote: () => ({ secondaryBreak: true }), getBeamRole: () => 'begin' }
    expect(secondaryBreakHighlight(stateWith([note('a')]), broken)).toBe(true)
    // No flag, a rest, more than one note, entry mode (there is no armed value) — all dark.
    expect(secondaryBreakHighlight(stateWith([note('a')]), { getNote: () => ({}), getBeamRole: () => null })).toBe(false)
    expect(secondaryBreakHighlight(stateWith([note('r')]), {
      getNote: () => ({ isRest: true, secondaryBreak: true }), getBeamRole: () => null,
    })).toBe(false)
    expect(secondaryBreakHighlight(stateWith([note('a'), note('b')]), broken)).toBe(false)
    expect(secondaryBreakHighlight(stateWith([note('a')], 'entry'), broken)).toBe(false)
  })

  it('a selected NOTE still reports both facts', () => {
    const state = stateWith([note('a')])
    state.selectedBeam = 'auto'
    const notes: BeamSource = { getNote: () => ({}), getBeamRole: () => 'begin' }
    expect(beamHighlight(state, notes)).toBe('auto')
    expect(beamRoleHighlight(state, notes)).toBe('begin')
  })
})
