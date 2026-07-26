import { describe, it, expect } from 'vitest'
import { createEditorState } from './EditorState'
import { selectedElements } from './selectionSnapshot'
import type { MusicEngine } from '../engine/MusicEngine'
import { fracCreate as frac } from '../utils/fraction'

/**
 * The snapshot turns EditorState's dozen `selected*` locators into the objects behind them — the
 * question the Properties window asks, and the one the editable panel will ask later.
 *
 * The engine is a stub: what is under test is the READING of state, not the engine's lookups.
 */
const engineStub = (notes: Record<string, unknown> = {}): MusicEngine =>
  ({
    getNote: (id: string) => notes[id],
    offsetTargetOf: (id: string) => ({ key: id, memberIndex: 0 }),
    getDynamicById: () => null,
    getTempoMarkById: () => null,
    getSlurById: () => null,
    getScore: () => ({ measures: [] }),
  }) as unknown as MusicEngine

describe('selectedElements', () => {
  it('reports nothing when nothing is selected', () => {
    expect(selectedElements(createEditorState(), engineStub())).toEqual([])
  })

  it('reports nothing when there is no engine — a selection with nothing to resolve it against', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    expect(selectedElements(state, null)).toEqual([])
  })

  it('tells a rest from a note, which the dump alone does not', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    const [element] = selectedElements(state, engineStub({ n1: { id: 'n1', isRest: true } }))
    expect(element.kind).toBe('rest')
  })

  // A stale selection is exactly what this window exists to make visible, so an id that no longer
  // resolves must SHOW as missing rather than vanish into an empty panel.
  it('reports an unresolvable id instead of dropping it', () => {
    const state = createEditorState()
    state.selectedNoteId = 'gone'
    const [element] = selectedElements(state, engineStub())
    expect(element.data).toEqual({ id: 'gone', missing: true })
  })

  it('carries the note an articulation hangs on, since an articulation has no object of its own', () => {
    const state = createEditorState()
    state.selectedArticulationNoteId = 'n1'
    state.selectedArticulationType = 'accent'
    const [element] = selectedElements(state, engineStub({ n1: { id: 'n1' } }))
    expect(element).toEqual({
      kind: 'articulation',
      data: { noteId: 'n1', type: 'accent', note: { id: 'n1' } },
    })
  })

  it('reports every selected thing, not just the first — the editor sets these independently', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    state.selectedTimeSignatureMeasure = 3
    const kinds = selectedElements(state, engineStub({ n1: { id: 'n1' } })).map((e) => e.kind)
    expect(kinds).toEqual(['note', 'timeSignature'])
  })
})

/**
 * The overrides compartment is keyed by element id — EXCEPT for rests, which are position-keyed
 * because they have no durable id. Reading ids alone would show no overrides on exactly the
 * elements that most often carry one (rest shift, rest hide both live there), and it would fail
 * SILENTLY: an empty section looks identical to "this element has none".
 */
describe('selectedElements — engraving overrides', () => {
  const scoreWith = (overrides: Record<string, { kind: string }[]>) => ({
    measures: [{ number: 1, id: 'm1' }],
    staves: undefined,
    engravingOverrides: overrides,
  })

  const engineWith = (
    note: Record<string, unknown>,
    overrides: Record<string, { kind: string }[]>,
    keyOf: (id: string) => string = (id) => id,
  ) =>
    ({
      getNote: () => note,
      offsetTargetOf: (id: string) => ({ key: keyOf(id), memberIndex: 0 }),
      getDynamicById: () => null,
      getTempoMarkById: () => null,
      getSlurById: () => null,
      getScore: () => scoreWith(overrides),
    }) as unknown as MusicEngine

  // A note's offset (client #12) is keyed by its SLOT, not its pitch id — a chord moves as a unit —
  // so the snapshot asks the engine for the key the nudge itself writes (`offsetTargetOf`, which
  // answers a fanned MEMBER with its own key) before looking up the compartment.
  it('finds a note override by its offset key, not its pitch id', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    const engine = engineWith({ id: 'n1', measure: 1 }, { s1: [{ kind: 'noteOffset' }] }, () => 's1')
    expect(selectedElements(state, engine)[0].overrides).toEqual([{ kind: 'noteOffset' }])
  })

  it('finds a REST override by its position key, not its id', () => {
    const state = createEditorState()
    state.selectedNoteId = 'r1'
    const rest = { id: 'r1', isRest: true, measure: 1, beat: frac(1, 2), voice: 0 }
    // Keyed by where the rest SITS. Under an id-only lookup this comes back undefined.
    const engine = engineWith(rest, { 'm1:v0:b1/2': [{ kind: 'restShift' }] })
    expect(selectedElements(state, engine)[0].overrides).toEqual([{ kind: 'restShift' }])
  })

  // ⭐ …and a rest answers to BOTH schemes at once: its shift and its hide are position-keyed
  // (a rest has no durable id), its horizontal offset is keyed by the slot — which a rest IS.
  // Reading either key alone hides the other, and hides it SILENTLY.
  it('⭐ a rest reports its position-keyed shift AND its slot-keyed offset', () => {
    const state = createEditorState()
    state.selectedNoteId = 'r1'
    const rest = { id: 'r1', isRest: true, measure: 1, beat: frac(1, 2), voice: 0 }
    const engine = engineWith(rest, {
      r1: [{ kind: 'noteOffset' }],
      'm1:v0:b1/2': [{ kind: 'restShift' }],
    })
    expect(selectedElements(state, engine)[0].overrides).toEqual([
      { kind: 'noteOffset' }, { kind: 'restShift' },
    ])
  })

  // ⭐⭐ The member trap (docs/note-offset-plan.md): a fanned member's offset is keyed by the member
  // itself, so a panel that resolved it to the containing slot would show the OWNER's number while
  // the keyboard nudge wrote the member's — a surface must report what the model will accept.
  it('⭐⭐ a fanned MEMBER reports its own offset, not the fan owner’s', () => {
    const state = createEditorState()
    state.selectedNoteId = 'member1'
    const engine = engineWith(
      { id: 'member1', measure: 1 },
      { slot1: [{ kind: 'noteOffset' }], member1: [{ kind: 'noteOffset' }] },
      (id) => id, // the engine answers a member with its OWN key
    )
    const [element] = selectedElements(state, engine)
    expect(element.overrides).toEqual([{ kind: 'noteOffset' }])
    expect(engine.offsetTargetOf('member1')?.key).toBe('member1')
  })

  // Each KIND has to be wired to its own key: the positional ones (clef, time signature) answer to
  // neither an element id nor a rest position key, so they silently reported nothing until asked.
  it('finds a time signature override under the cautionary key', () => {
    const state = createEditorState()
    state.selectedTimeSignatureMeasure = 1
    const engine = engineWith({}, { 'caution:m1': [{ kind: 'cautionary' }] })
    expect(selectedElements(state, engine)[0].overrides).toEqual([{ kind: 'cautionary' }])
  })

  it('omits the field entirely when the element has none', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    expect(selectedElements(state, engineWith({ id: 'n1', measure: 1 }, {}))[0].overrides).toBeUndefined()
  })
})
