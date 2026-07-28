import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { levelToGlyphString } from '@/utils/dynamics'
import { MusicEngine } from '../engine/MusicEngine'
import type { Rect } from '../engine/ViewportModel'
import { createEditorState, selectedOf, type EditorState } from './EditorState'
import { SelectionController } from './SelectionController'
import { itemKey } from './selection'
import { expandTieChains } from '../utils/beatMap'
import { fracCreate as frac, fracEq } from '@/utils/fraction'
import { getMeasureNotes, measureFanMemberNotes } from '@/utils/musicUtils'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'

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

  it('is additive: successive Shift-clicks only grow the selection (pivot moves to target)', () => {
    // click n1 → shift n3 → shift n0 accumulates the whole span, rather than re-flowing back
    // to n0..n1 from a stuck anchor.
    selection.selectNote(n1)            // {n1}, pivot n1
    selection.extendSelectionTo(n3)     // union n1..n3 = {n1,n2,n3}, pivot now n3
    selection.extendSelectionTo(n0)     // union n3..n0 = {n0,n1,n2,n3} — nothing dropped
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(n2), noteKey(n3)]))
  })

  it('does not shrink a range when Shift-clicking back inside it (additive)', () => {
    selection.selectNote(n0)
    selection.extendSelectionTo(n3)     // {n0,n1,n2,n3}, pivot n3
    selection.extendSelectionTo(n1)     // union n3..n1 = {n1,n2,n3} → still {n0,n1,n2,n3}
    expect(selectedIds()).toEqual(new Set([noteKey(n0), noteKey(n1), noteKey(n2), noteKey(n3)]))
  })

  it('falls back to plain select when there is no pivot', () => {
    expect(state.selectionPivotId).toBeNull()
    selection.extendSelectionTo(n1)
    expect(selectedIds()).toEqual(new Set([noteKey(n1)]))
    expect(state.selectedNoteId).toBe(n1)
  })

  /**
   * REGRESSION, and a COMPOSITION one: `notesInBox` and `expandTieChains` were each defensible
   * alone, and Shift-click on a fan was broken anyway. Ctrl-click could always pick a fanned member
   * (it just puts an id in a set), but the range path went through a beat map built from
   * `getMeasureNotes`, which deliberately omits members — so an anchored member resolved to no
   * endpoint at all and the empty-endpoint fallback CLEARED the selection. Pinned here as well as in
   * `beatMap.selection.test.ts` because the unit being right is not the same as the gesture working:
   * `expandTieChains` sits in between and would drop a member id if it ever stopped passing
   * unknown ids through.
   */
  it('extends a range onto a FANNED MEMBER instead of emptying the selection', () => {
    engine.setFan(n0, { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS })
    const score = engine.getScore()
    const members = measureFanMemberNotes(score.measures.find(m => m.number === 1)!, score).map(n => n.id)
    expect(members.length, 'fixture: the fan materialised no members').toBeGreaterThan(2)

    selection.selectNote(members[0])           // pivot = a member
    selection.extendSelectionTo(members[2])    // shift-click a later member

    const ids = selectedIds()
    expect(ids.size, 'the selection was emptied').toBeGreaterThan(0)
    for (const id of members.slice(0, 3)) expect(ids.has(noteKey(id))).toBe(true)
    expect(state.selectionPivotId).toBe(members[2])
  })

  it('pulls a dynamic inside the box into the selection (so it highlights)', () => {
    const dynKey = (id: string) => itemKey({ kind: 'dynamic', id })
    // A dynamic under beat 1 (inside the n0..n2 box) and one under beat 3 (outside it).
    const dIn = engine.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f'), voice: 0 })!.id
    const dOut = engine.addDynamic(1, { beat: frac(3, 1), text: levelToGlyphString('p'), voice: 0 })!.id

    selection.selectNote(n0)
    selection.extendSelectionTo(n2)      // box = beats 0..2

    expect(state.selectedItems.has(dynKey(dIn))).toBe(true)   // enclosed dynamic selected
    expect(state.selectedItems.has(dynKey(dOut))).toBe(false) // beat 3 is outside the box
    // The notes are still all there too.
    expect(selectedIds().has(noteKey(n1))).toBe(true)
  })

  it('pulls a fully-covered slur into the selection (so it highlights)', () => {
    const slurKey = (id: string) => itemKey({ kind: 'slur', id })
    // A slur n0..n1 (both ends inside a n0..n2 box) and a slur n2..n3 (only n2 inside it).
    const inSlur = engine.createSlur([n0, n1])!.id
    const straddle = engine.createSlur([n2, n3])!.id

    selection.selectNote(n0)
    selection.extendSelectionTo(n2)      // box = beats 0..2 (n0,n1,n2)

    expect(state.selectedItems.has(slurKey(inSlur))).toBe(true)     // both endpoints enclosed
    expect(state.selectedItems.has(slurKey(straddle))).toBe(false)  // n3 is outside the box
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

describe('SelectionController — articulation group multi-selection', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let noteA: string
  let noteB: string
  let noteC: string

  const artKey = (noteId: string) => itemKey({ kind: 'articulation', noteId, type: '' })

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})

    noteA = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    noteB = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    noteC = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
  })

  it('selectArticulation replaces the set with one group and sets the anchor', () => {
    selection.selectArticulation(noteA)
    expect([...state.selectedItems.keys()]).toEqual([artKey(noteA)])
    expect(selectedOf(state, 'articulation')?.noteId).toBe(noteA)
    expect(selectedOf(state, 'articulation')?.type).toBeNull()
    expect(state.selectedNoteId).toBeNull()

    selection.selectArticulation(noteB)
    expect([...state.selectedItems.keys()]).toEqual([artKey(noteB)])
    expect(selectedOf(state, 'articulation')?.noteId).toBe(noteB)
  })

  it('toggleArticulation adds groups and tracks the anchor; toggling off removes them', () => {
    selection.toggleArticulation(noteA)
    selection.toggleArticulation(noteB)
    expect([...state.selectedItems.keys()]).toEqual([artKey(noteA), artKey(noteB)])
    expect(selectedOf(state, 'articulation')?.noteId).toBe(noteB)

    selection.toggleArticulation(noteB)
    expect([...state.selectedItems.keys()]).toEqual([artKey(noteA)])
    expect(selectedOf(state, 'articulation')?.noteId).toBe(noteA)

    selection.toggleArticulation(noteA)
    expect(state.selectedItems.size).toBe(0)
    expect(selectedOf(state, 'articulation')).toBeNull()
  })

  it('toggling an articulation onto a note selection restarts as articulations-only', () => {
    selection.selectNote(noteA)
    selection.toggleArticulation(noteB)
    expect([...state.selectedItems.keys()]).toEqual([artKey(noteB)])
    expect(state.selectedNoteId).toBeNull()
    expect(selectedOf(state, 'articulation')?.noteId).toBe(noteB)
  })

  it('selectNote clears articulation groups and the articulation anchor', () => {
    selection.toggleArticulation(noteA)
    selection.toggleArticulation(noteB)
    selection.selectNote(noteC)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(noteC)])
    expect(selectedOf(state, 'articulation')).toBeNull()
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

describe('SelectionController — navigateVoice (Alt+Shift+up/down voice hop)', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
  })

  it('jumps up to the note in the voice above and makes that voice active', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    const v2 = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!.id

    selection.selectNote(v2)
    selection.navigateVoice(1) // up
    expect(state.selectedNoteId).toBe(v1)
    expect(state.activeVoice).toBe(1) // model voice 0 → UI voice 1
  })

  it('jumps down to the note in the voice below', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    const v2 = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!.id

    selection.selectNote(v1)
    selection.navigateVoice(-1) // down
    expect(state.selectedNoteId).toBe(v2)
    expect(state.activeVoice).toBe(2)
  })

  it('does nothing pressing up from the top voice (no voice above)', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    selection.selectNote(v1)
    selection.navigateVoice(1) // up — nothing above
    expect(state.selectedNoteId).toBe(v1)
  })

  it('can land on a REST in the adjacent voice', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    // Voice 2 only has a note at beat 1, so beat 0 in voice 2 is a (gap-filled) rest.
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })

    const measure = engine.getScore().measures.find(m => m.number === 1)!
    const v2Rest = getMeasureNotes(measure).find(n => n.isRest && (n.voice ?? 0) === 1 && fracEq(n.beat, frac(0, 1)))!
    expect(v2Rest).toBeDefined()

    selection.selectNote(v1)
    selection.navigateVoice(-1) // down → voice 2's rest at this beat
    expect(state.selectedNoteId).toBe(v2Rest.id)
  })

  it('a manually shifted rest hops by its DRAWN position, not its default lane', () => {
    // Voice 1 note at C5 (above middle line); voice 2 has a rest at beat 0 (gap-filled). By
    // default that rest sits in its below-middle lane, so from the C5 note "down" lands on it
    // and "up" finds nothing. Shift the rest well ABOVE the C5 note (engraving client #5): now
    // the hop must follow the drawn geometry — "up" from C5 lands on the rest.
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })

    const measure = engine.getScore().measures.find(m => m.number === 1)!
    const v2Rest = getMeasureNotes(measure).find(n => n.isRest && (n.voice ?? 0) === 1 && fracEq(n.beat, frac(0, 1)))!

    // Default lane is below the C5 note: up finds nothing, down lands on the rest.
    selection.selectNote(v1)
    selection.navigateVoice(1)
    expect(state.selectedNoteId).toBe(v1) // nothing above

    // Shift the rest far above the C5 note (+5 diatonic steps clears it).
    expect(engine.nudgeRestShift(v2Rest.id, 5)).toBe(true)

    selection.selectNote(v1)
    selection.navigateVoice(1) // up — now the shifted rest sits above C5
    expect(state.selectedNoteId).toBe(v2Rest.id)
  })

  it('hops between voices at a UNISON (same pitch) — V1 is up, V2 is down', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    const v2 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!.id

    // From the lower voice, up lands on the upper voice (despite equal pitch)…
    selection.selectNote(v2)
    selection.navigateVoice(1)
    expect(state.selectedNoteId).toBe(v1)

    // …and from the upper voice, down lands on the lower voice.
    selection.selectNote(v1)
    selection.navigateVoice(-1)
    expect(state.selectedNoteId).toBe(v2)
  })
})

describe('SelectionController — navigateChord is voice-scoped', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
  })

  it('stays within the selected note\'s voice, ignoring the other voice at the same beat', () => {
    // Voice 1 chord C5+E5; voice 2 chord G3+B3, all at beat 0.
    const v1lo = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    engine.addChordNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })
    engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    engine.addChordNote({ step: 'B', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    // From the bottom of voice 1's chord, up → top of voice 1 (E5), NOT into voice 2.
    selection.selectNote(v1lo)
    selection.navigateChord(1)
    const landed = engine.getNote(state.selectedNoteId!)!
    expect(landed.step).toBe('E')
    expect(landed.octave).toBe(5)
    expect(landed.voice ?? 0).toBe(0)

    // Already at the top of its voice's chord — another up is a clamp no-op (no jump to v2).
    const top = state.selectedNoteId
    selection.navigateChord(1)
    expect(state.selectedNoteId).toBe(top)
  })

  /**
   * ⭐ Inside a FAN, the chord is the MEMBER (docs/fanned-beam-pitches-plan.md §2 P3).
   *
   * The ordinary path resolves the chord positionally — every note at this beat, in this voice —
   * which inside a fan hands back the SLOT's pitches. The selected member is not among them, so
   * `currentIndex` is -1 and Alt+↑/↓ silently does nothing (his report). The same rule that makes
   * `Shift`+letter stack onto the member: a member is a chord in its own right.
   */
  it('⭐ walks the MEMBER\'s own pitches, not the slot\'s', () => {
    const noteId = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.addChordNote({ step: 'G', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) }) // the SLOT's second pitch
    engine.setFan(noteId, { direction: 'accel', count: 3, beams: 3 })

    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    const member = slot.fan!.members![0]
    const low = member.pitches[0].id
    const high = engine.addFanMemberPitch(low, { step: 'E', alter: 0, octave: 4 })!.id

    // Up from the member's lower pitch lands on the member's OWN upper pitch — never the slot's G5.
    selection.selectNote(low)
    selection.navigateChord(1)
    expect(state.selectedNoteId).toBe(high)

    // …and down comes back, clamping at the member's own bottom.
    selection.navigateChord(-1)
    expect(state.selectedNoteId).toBe(low)
    selection.navigateChord(-1)
    expect(state.selectedNoteId).toBe(low)
  })
})

describe('SelectionController — setSelectedNote keeps the highlight set in sync', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
  })

  it('replaces selectedItems (not just the anchor) so navigation/highlight agree', () => {
    // Chord E4 + E5 in voice 0 (entering the upper note via the keyboard path).
    const lo = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    const hi = engine.addChordNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 }).id

    selection.selectNote(lo)         // lower note selected (and highlighted)
    selection.setSelectedNote(hi)    // entry lands the NEW top note

    // The multi-select set (what the highlight reads) must now hold the top note,
    // not the stale lower one — otherwise Alt+Up is a no-op (already "at the top").
    expect(state.selectedNoteId).toBe(hi)
    expect([...state.selectedItems.keys()]).toEqual([noteKey(hi)])

    // Down then back up must traverse cleanly from the very first press.
    selection.navigateChord(-1)
    expect(state.selectedNoteId).toBe(lo)
    selection.navigateChord(1)
    expect(state.selectedNoteId).toBe(hi)
  })
})

describe('SelectionController — a note selection replaces the element selection', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let noteA: string
  let noteB: string

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})
    noteA = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    noteB = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
  })

  // The four hand-maintained clear-lists had already diverged: `clearScalarSubSelections` named
  // seventeen fields and missed the dynamic, the tempo mark and the tuplet, so replacing the
  // selection with notes left whichever of those was picked still selected — and still highlighted,
  // and still what Delete would act on. One field cannot diverge from itself.
  it('selectNote clears a selected dynamic', () => {
    state.selectedElement = { kind: 'dynamic', id: 'dyn-1' }
    selection.selectNote(noteA)
    expect(state.selectedElement).toBeNull()
  })

  it('selectNotes clears a selected dynamic', () => {
    state.selectedElement = { kind: 'dynamic', id: 'dyn-1' }
    selection.selectNotes([noteA, noteB])
    expect(state.selectedElement).toBeNull()
  })

  it('selectNotes clears a selected tempo mark', () => {
    state.selectedElement = { kind: 'tempo', id: 'tempo-1' }
    selection.selectNotes([noteA])
    expect(state.selectedElement).toBeNull()
  })

  it('selectNotes clears a selected tuplet', () => {
    state.selectedElement = { kind: 'tuplet', id: 'tuplet-1' }
    selection.selectNotes([noteA])
    expect(state.selectedElement).toBeNull()
  })

  it('selectMeasureContents clears a selected dynamic', () => {
    state.selectedElement = { kind: 'dynamic', id: 'dyn-1' }
    selection.selectMeasureContents([noteA, noteB])
    expect(state.selectedElement).toBeNull()
  })

  it('extendSelectionTo clears a selected dynamic', () => {
    selection.selectNote(noteA)
    state.selectedElement = { kind: 'dynamic', id: 'dyn-1' }
    selection.extendSelectionTo(noteB)
    expect(state.selectedElement).toBeNull()
  })
})

describe('SelectionController — the palette reflects the selected note', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let plain: string
  let beamed: string

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    state.selectedTool = 'selection'
    selection = new SelectionController(() => engine, state, () => {}, () => {})

    plain = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })!.id
    beamed = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2) })!.id
    engine.updateNote(beamed, { beam: 'begin' })
  })

  it('shows the selected note\'s beam, not a stale auto', () => {
    // The bug: selecting a note reset selectedBeam to 'auto' (clearElementSelection) and nothing
    // put the note's own value back, so the Beam row said "auto" about a note you had beamed.
    selection.selectNote(beamed)
    expect(state.selectedBeam).toBe('begin')
  })

  it('reads auto back for a note with no explicit beam', () => {
    // 'auto' is stored as ABSENT, so this is the `?? 'auto'` half of the read.
    selection.selectNote(beamed)
    selection.selectNote(plain)
    expect(state.selectedBeam).toBe('auto')
  })

  it('still syncs the duration and dots beside it', () => {
    selection.selectNote(plain)
    expect(state.selectedDuration).toBe('8')
    expect(state.selectedDots).toBe(0)
  })
})
