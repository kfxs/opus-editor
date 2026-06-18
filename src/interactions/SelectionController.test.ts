import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import type { Rect } from '../engine/ViewportModel'
import { createEditorState, type EditorState } from './EditorState'
import { SelectionController } from './SelectionController'
import { itemKey } from './selection'
import { expandTieChains } from '../utils/beatMap'
import { fracCreate as frac } from '@/utils/fraction'

// Stub VexFlowRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio).
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn()
    setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

const noteKey = (id: string) => itemKey({ kind: 'note', id })

describe('SelectionController — multi-selection', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let noteA: string
  let noteB: string
  let noteC: string

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})

    noteA = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    noteB = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    noteC = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
  })

  it('selectNote replaces the set and sets the anchor', () => {
    selection.selectNote(noteA)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(noteA)])
    expect(state.selectedNoteId).toBe(noteA)

    selection.selectNote(noteB)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(noteB)])
    expect(state.selectedNoteId).toBe(noteB)
  })

  it('selectNote(null) clears the set and the anchor', () => {
    selection.selectNote(noteA)
    selection.selectNote(null)
    expect(state.selectedItems.size).toBe(0)
    expect(state.selectedNoteId).toBeNull()
  })

  it('toggleNote adds a note and makes it the anchor', () => {
    selection.selectNote(noteA)
    selection.toggleNote(noteB)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(noteA), noteKey(noteB)])
    expect(state.selectedNoteId).toBe(noteB)
  })

  it('toggleNote removes an already-selected note', () => {
    selection.selectNote(noteA)
    selection.toggleNote(noteB)
    selection.toggleNote(noteB)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(noteA)])
    expect(state.selectedNoteId).toBe(noteA)
  })

  it('removing the anchor recomputes it to the remaining last note', () => {
    selection.selectNote(noteA)
    selection.toggleNote(noteB) // anchor = B
    selection.toggleNote(noteB) // remove anchor → anchor falls back to A
    expect(state.selectedNoteId).toBe(noteA)
  })

  it('removing the last note leaves an empty set and null anchor', () => {
    selection.selectNote(noteA)
    selection.toggleNote(noteA)
    expect(state.selectedItems.size).toBe(0)
    expect(state.selectedNoteId).toBeNull()
  })

  it('adjustPitch moves EVERY selected note one diatonic step', () => {
    selection.selectNote(noteA)        // C4
    selection.toggleNote(noteC)        // + G4 (B4 left out)
    selection.adjustPitch(1)

    expect(engine.getNote(noteA)!.step).toBe('D')
    expect(engine.getNote(noteC)!.step).toBe('A')
    expect(engine.getNote(noteB)!.step).toBe('E') // untouched
  })

  it('adjustOctave moves EVERY selected note one octave', () => {
    selection.selectNote(noteA)        // C4
    selection.toggleNote(noteB)        // + E4
    selection.adjustOctave(1)

    expect(engine.getNote(noteA)!.octave).toBe(5)
    expect(engine.getNote(noteB)!.octave).toBe(5)
    expect(engine.getNote(noteC)!.octave).toBe(4) // untouched
  })
})

describe('SelectionController — Shift range select', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let n0: string, n1: string, n2: string, n3: string

  const selectedIds = () => new Set(state.selectedItems.keys())

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})

    // Fill measure 1 (4/4): a note on each of beats 0..3.
    n0 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    n1 = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    n2 = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
    n3 = engine.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id
  })

  it('selects the inclusive range from the pivot to the target', () => {
    selection.selectNote(n0)            // pivot = n0
    selection.extendSelectionTo(n2)
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(n2)])) // n3 excluded
  })

  it('is direction-agnostic (target before pivot)', () => {
    selection.selectNote(n2)            // pivot = n2
    selection.extendSelectionTo(n0)
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(n2)]))
  })

  it('includes a rest that falls inside the range', () => {
    engine.deleteNote(n1)               // beat 1 becomes a rest
    const restId = engine.getScore().measures.find(m => m.number === 1)!
      .slots.find(s => s.type === 'rest')!.id
    selection.selectNote(n0)
    selection.extendSelectionTo(n2)
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(restId), noteKey(n2)]))
  })

  it('includes the WHOLE chord at an in-range beat', () => {
    const chordMate = engine.addChordNote({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) }).id
    selection.selectNote(n0)
    selection.extendSelectionTo(n2)
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(chordMate), noteKey(n2)]))
  })

  it('unions the range onto the existing (Ctrl-built) selection', () => {
    selection.selectNote(n0)            // {n0}, pivot n0
    selection.toggleNote(n3)            // {n0, n3}, pivot n3, base {n0,n3}
    selection.extendSelectionTo(n1)     // range n3..n1 = {n1,n2,n3} ∪ base
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(n2), noteKey(n3)]))
  })

  it('re-flows the range from the same pivot while keeping the base', () => {
    selection.selectNote(n0)
    selection.toggleNote(n3)            // base {n0,n3}, pivot n3
    selection.extendSelectionTo(n1)     // {n0,n1,n2,n3}
    selection.extendSelectionTo(n2)     // re-flow: range n3..n2 = {n2,n3} ∪ base {n0,n3}
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n2), noteKey(n3)])) // n1 dropped
  })

  it('falls back to plain select when there is no pivot', () => {
    expect(state.selectionPivotId).toBeNull()
    selection.extendSelectionTo(n1)
    expect(selectedIds()).toEqual(new Set([noteKey(n1)]))
    expect(state.selectedNoteId).toBe(n1)
  })
})

describe('Shift range + ties (multi-selection only)', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let c1: string, c2: string, d: string

  const selectedIds = () => new Set(state.selectedItems.keys())

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})

    // Two same-pitch C4 quarters tied together (one held note), then D4, E4.
    c1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    c2 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    engine.toggleTie(c1) // c1 —tie→ c2
  })

  it('expandTieChains pulls in the whole tie chain from any member', () => {
    expect(new Set(expandTieChains(engine.getScore(), [c1]))).toEqual(new Set([c1, c2]))
    expect(new Set(expandTieChains(engine.getScore(), [c2]))).toEqual(new Set([c1, c2]))
    expect(expandTieChains(engine.getScore(), [d])).toEqual([d]) // untied note unchanged
  })

  it('Shift-range grabs the whole held note even if it ends mid-tie', () => {
    selection.selectNote(c1)          // pivot = c1
    selection.extendSelectionTo(c1)   // range is just beat 0 …
    expect(selectedIds()).toEqual(new Set([noteKey(c1), noteKey(c2)])) // … but c2 joins (same held note)
  })

  it('Ctrl-click stays literal — it does NOT pull in the tied partner', () => {
    selection.selectNote(d)           // {d}
    selection.toggleNote(c1)          // Ctrl-click only the first tied note
    expect(selectedIds()).toEqual(new Set([noteKey(d), noteKey(c1)])) // c2 NOT added
  })

  it('single click stays literal — only the clicked note', () => {
    selection.selectNote(c1)
    expect(selectedIds()).toEqual(new Set([noteKey(c1)])) // c2 NOT added
  })
})

describe('SelectionController — scroll-into-view forwarding', () => {
  let engine: MusicEngine
  let state: EditorState
  let ensureVisible: Mock<(rect: Rect) => void>
  let selection: SelectionController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    ensureVisible = vi.fn<(rect: Rect) => void>()
    selection = new SelectionController(() => engine, state, ensureVisible, () => {})
  })

  it('forwards the selected element bbox to ensureVisible', () => {
    const bbox = { x: 120, y: 300, width: 12, height: 40 }
    state.selectedNoteId = 'note-1'
    vi.spyOn(engine, 'getElementById').mockReturnValue({ bbox } as ReturnType<MusicEngine['getElementById']>)

    selection.scrollSelectedNoteIntoView()

    expect(ensureVisible).toHaveBeenCalledTimes(1)
    expect(ensureVisible).toHaveBeenCalledWith(bbox)
  })

  it('does nothing when there is no selection', () => {
    state.selectedNoteId = null
    selection.scrollSelectedNoteIntoView()
    expect(ensureVisible).not.toHaveBeenCalled()
  })

  it('does nothing when the element is not found', () => {
    state.selectedNoteId = 'missing'
    vi.spyOn(engine, 'getElementById').mockReturnValue(null)
    selection.scrollSelectedNoteIntoView()
    expect(ensureVisible).not.toHaveBeenCalled()
  })
})
