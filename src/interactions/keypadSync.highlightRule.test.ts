import { describe, it, expect } from 'vitest'
import { multipleNotesSelected, type SelectionItem } from './selection'
import { beamHighlight, beamRoleHighlight, beamOverHighlight, noNoteInSelection, secondaryBreakHighlight, tremoloHighlight, tremoloPairHighlight, type BeamSource, type TremoloSource } from './keypadSync'
import type { TremoloMark } from '../types/music'
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

  it('beamOverHighlight lights only for a single selected REST carrying the flag (inverse of subdivide)', () => {
    const over: BeamSource = { getNote: () => ({ isRest: true, beamOver: true }), getBeamRole: () => null }
    expect(beamOverHighlight(stateWith([note('r')]), over)).toBe(true)
    // A NOTE (not a rest) never lights it, even with the flag somehow set; nor does a flagless rest,
    // a multi-selection, or entry mode.
    expect(beamOverHighlight(stateWith([note('a')]), { getNote: () => ({ beamOver: true }), getBeamRole: () => null })).toBe(false)
    expect(beamOverHighlight(stateWith([note('r')]), { getNote: () => ({ isRest: true }), getBeamRole: () => null })).toBe(false)
    expect(beamOverHighlight(stateWith([note('r'), note('s')]), over)).toBe(false)
    expect(beamOverHighlight(stateWith([note('r')], 'entry'), over)).toBe(false)
  })

  it('⭐ reports nothing for the OWNER of a fan — its beam is the ramp, not a mode', () => {
    const state = stateWith([note('f')])
    state.selectedBeam = 'single'   // whatever is armed, or was authored before the fan
    const fanned: BeamSource = { getNote: () => ({ fan: {} }), getBeamRole: () => 'begin' }
    expect(beamHighlight(state, fanned)).toBeNull()
    // …but the ROLE still reads, and it reads `begin`: the group starts there and is all inside it.
    expect(beamRoleHighlight(state, fanned)).toBe('begin')
    // The subdivide is dark too — a fan's beam lines are `fan.beams`, not a break in a group.
    expect(secondaryBreakHighlight(state, { getNote: () => ({ fan: {}, secondaryBreak: true }), getBeamRole: () => 'begin' })).toBe(false)
  })

  it('⭐ …except `continue` — the one beam key a fan takes, and it lights what was WRITTEN', () => {
    // docs/fan-beam-join-plan.md §1 (P0): the join to the group on the left.
    const state = stateWith([note('f')])
    const joined: BeamSource = { getNote: () => ({ fan: {}, beam: 'continue' }), getBeamRole: () => 'continue' }
    state.selectedBeam = 'single'   // the ARMED value is beside the point here…
    expect(beamHighlight(state, joined)).toBe('continue')
    expect(beamRoleHighlight(state, joined)).toBe('continue')

    // …and so it goes dark the moment the press UNJOINS, which writes `auto` — a value the armed
    // side never takes (there is no `auto` key), so an armed read would leave the key lit.
    state.selectedBeam = 'continue'
    expect(beamHighlight(state, { getNote: () => ({ fan: {} }), getBeamRole: () => 'begin' })).toBeNull()
  })

  it('a selected NOTE still reports both facts', () => {
    const state = stateWith([note('a')])
    state.selectedBeam = 'auto'
    const notes: BeamSource = { getNote: () => ({}), getBeamRole: () => 'begin' }
    expect(beamHighlight(state, notes)).toBe('auto')
    expect(beamRoleHighlight(state, notes)).toBe('begin')
  })
})

/**
 * The tremolo row is the one palette rule with THREE sources, because a tremolo is the only mark you
 * can arm, select on the score, AND read off a selected note. The order between them is the rule.
 */
describe('tremoloHighlight (the dev shell\'s Tremolo row)', () => {
  const carrying = (mark: TremoloMark | undefined): TremoloSource => ({ getNote: () => ({ tremolo: mark }) })

  it('reports the mark on the single selected note — "what does this note have on it"', () => {
    expect(tremoloHighlight(stateWith([note('a')]), carrying(3))).toBe(3)
    expect(tremoloHighlight(stateWith([note('a')]), carrying('penderecki'))).toBe('penderecki')
  })

  it('nothing for a selected note without one, and nothing with no selection', () => {
    expect(tremoloHighlight(stateWith([note('a')]), carrying(undefined))).toBeNull()
    expect(tremoloHighlight(stateWith([]), carrying(3))).toBeNull()
  })

  it('nothing when several notes are selected — no single mark can stand for the set', () => {
    expect(tremoloHighlight(stateWith([note('a'), note('b')]), carrying(3))).toBeNull()
  })

  it('⭐ the MARK selected on the score lights, even though clicking it cleared the note selection', () => {
    const state = stateWith([])
    state.selectedElement = { kind: 'tremolo', noteId: 'a' }
    expect(tremoloHighlight(state, carrying(4))).toBe(4)
  })

  it('⭐ NOTE ENTRY armed with a mark lights it — what the next click will WRITE', () => {
    const state = stateWith([note('a')], 'entry')
    state.selectedTremolo = 2
    expect(tremoloHighlight(state, carrying(5))).toBe(2)
  })

  it('…but only in entry mode: the armed mark persists into selection mode, where the SCORE answers', () => {
    const state = stateWith([note('a')])   // selection mode, one note selected
    state.selectedTremolo = 2              // still armed from the last writing session
    expect(tremoloHighlight(state, carrying(5))).toBe(5)
  })

  it('the ARMED mark wins over everything — that is the active gesture', () => {
    const state = stateWith([note('a')])
    state.selectedMarkingTool = { kind: 'tremolo', tremolo: 5 }
    expect(tremoloHighlight(state, carrying(2))).toBe(5)
  })

  it('⚠️ and ANOTHER tool darkens the row — no tremolo is in play while a clef waits to be placed', () => {
    const state = stateWith([note('a')])
    state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
    expect(tremoloHighlight(state, carrying(2))).toBeNull()
  })

  it('no engine, no answer (the mark is a fact about the score, read live)', () => {
    expect(tremoloHighlight(stateWith([note('a')]), null)).toBeNull()
  })
})

/**
 * The two-note tremolo is a SECOND AXIS beside the count, so it reports separately: the count says
 * how fast, the pair says the strokes go between two notes, and both are true at once.
 */
describe('tremoloPairHighlight (the pair button, beside the count)', () => {
  const paired = (on: boolean): TremoloSource => ({ getNote: () => ({ tremolo: 3, tremoloPair: on ? true : undefined }) })

  it('lights for a single selected note carrying a pair, and not for one without', () => {
    expect(tremoloPairHighlight(stateWith([note('a')]), paired(true))).toBe(true)
    expect(tremoloPairHighlight(stateWith([note('a')]), paired(false))).toBe(false)
  })

  it('⭐ lights BESIDE the count — both axes answer at once', () => {
    const state = stateWith([note('a')])
    expect(tremoloHighlight(state, paired(true))).toBe(3)
    expect(tremoloPairHighlight(state, paired(true))).toBe(true)
  })

  it('⭐ the MARK selected on the score lights it, like the count', () => {
    const state = stateWith([])
    state.selectedElement = { kind: 'tremolo', noteId: 'a' }
    expect(tremoloPairHighlight(state, paired(true))).toBe(true)
  })

  it('nothing with no selection, several notes, or no engine', () => {
    expect(tremoloPairHighlight(stateWith([]), paired(true))).toBe(false)
    expect(tremoloPairHighlight(stateWith([note('a'), note('b')]), paired(true))).toBe(false)
    expect(tremoloPairHighlight(stateWith([note('a')]), null)).toBe(false)
  })

  it('⚠️ an armed TOOL darkens it — and the pair has no armed form of its own to report', () => {
    const state = stateWith([note('a')])
    state.selectedMarkingTool = { kind: 'tremolo', tremolo: 5 }
    expect(tremoloPairHighlight(state, paired(true))).toBe(false)
  })
})
