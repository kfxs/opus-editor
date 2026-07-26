import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord, FanMark } from '@/types/music'

/**
 * ⛔ WHAT A FANNED MEMBER REFUSES, and why each refusal is the notation talking
 * (docs/fanned-beam-pitches-plan.md §2 P3, §3).
 *
 * A member is a PITCH inside one event. The tie, the slur, the articulation, the duration and the
 * stem all belong to the SLOT — the whole gesture — so a command that attaches one of those stops
 * at the member rather than writing something no renderer will ever draw. The two halves are tested
 * together on purpose: the command reports nothing happened AND the model is untouched.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null), getByType: vi.fn(() => []),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('./rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

const FAN: FanMark = { direction: 'accel', count: 4, beams: 3 }

describe('a fanned member at the command layer', () => {
  let engine: MusicEngine
  let noteId: string
  let memberId: string

  const chord = (): Chord => {
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    return slot
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.setFan(noteId, FAN)
    memberId = chord().fan!.members![0][0].id
  })

  it('⭐ ACCEPTS a re-spelling — that is the whole of what P3 buys', () => {
    // The same call `ArrowUp`, `a`–`g` and the accidental stamp all make.
    engine.updateNote(memberId, { step: 'G', octave: 4, alter: 1 })
    expect(chord().fan!.members![0][0]).toMatchObject({ step: 'G', octave: 4, alter: 1 })
    expect(engine.getNote(memberId)).toMatchObject({ step: 'G', alter: 1, duration: 'h' })
  })

  it('⛔ a TIE — it is drawn from the slot, and TieRenderer looks its id up in slot.notes', () => {
    expect(engine.toggleTie(memberId)).toBeNull()
    expect(chord().fan!.members![0][0].tiedTo).toBeUndefined()
    expect(chord().notes[0].tiedTo).toBeUndefined()
  })

  it('⛔ an ARTICULATION — it marks the event, and the event is the group', () => {
    expect(engine.toggleArticulation(memberId, 'accent')).toBeNull()
    expect(chord().articulations ?? []).toEqual([])
  })

  it('⛔ a STEM FLIP — the stem is the GROUP’s, decided over every member', () => {
    expect(engine.flipStemDirection(memberId)).toBeNull()
    expect(chord().stemDirection).toBeUndefined()
  })

  it('⛔ CONVERT TO REST — there is no half-silent fan', () => {
    expect(engine.convertToRest(memberId)).toBeNull()
    expect(chord().type).toBe('chord')
  })

  it('⭐ a SLUR drops the member and slurs the rest of the selection', () => {
    // Not a refusal of the gesture: the other notes were selected too, and the slur is theirs.
    const other = engine.getScore().measures[0].slots.filter(s => s.type === 'chord')
    expect(other.length).toBeGreaterThan(1)
    const created = engine.createSlur([memberId, noteId])
    // Anchored to the real note, never to the member.
    if (created) {
      expect(created.startNoteId).not.toBe(memberId)
      expect(created.endNoteId).not.toBe(memberId)
    }
  })

  it('⛔ and none of the refusals leaves an undo entry behind', () => {
    const before = engine.exportJSON()
    engine.toggleTie(memberId)
    engine.toggleArticulation(memberId, 'staccato')
    engine.flipStemDirection(memberId)
    engine.convertToRest(memberId)
    expect(engine.exportJSON()).toBe(before)
  })

  it('a DURATION change on a member changes nothing — the slot owns the rhythm', () => {
    engine.updateNote(memberId, { duration: 'q' })
    expect(chord().duration).toBe('h')
    // …and the bar is still well-formed: nothing was rest-filled around a phantom edit.
    expect(engine.getScore().measures[0].slots.filter(s => s.type === 'chord')).toHaveLength(2)
  })
})

/**
 * The INTERACTION layer's half of P3 — what happens around a selected member. Both of these are
 * dead ends if nobody thinks about them: the flat note walk (`getMeasureNotes`) cannot see a
 * member, and two pieces of the selection machinery are built on it.
 */
describe('a selected fanned member in the selection machinery', () => {
  let engine: MusicEngine
  let noteId: string
  let memberId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.setFan(noteId, FAN)
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    memberId = slot.fan!.members![0][0].id
  })

  it('⭐ the engine can answer for it — the projection every widget reads', () => {
    // The Keypad, the Properties window and the palette sync all go through `getNote`.
    const note = engine.getNote(memberId)!
    expect(note.id).toBe(memberId)
    expect(note.measure).toBe(1)
    expect(note.duration).toBe('h') // the SLOT's rhythm — a member has none of its own
    expect(note.isRest).toBe(false)
  })

  it('⭐ it resolves to its SLOT for anything slot-shaped (the note offset, the spacing drag)', () => {
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(engine.slotIdForNote(memberId)).toBe(slot.id)
  })

  it('an accidental applied to it re-spells the MEMBER, not the note that was typed', () => {
    engine.setNoteAccidental(memberId, '#')
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    expect(slot.fan!.members![0][0].alter).toBe(1)
    expect(slot.notes[0].alter).toBe(0)
  })
})

/**
 * 🚨 THE EDIT HAS TO BE COMMITTED, not just written (his report: "if I edit with the keyboard I
 * cannot see the edit unless I enter a new note").
 *
 * `MusicEngine.runBatch` counts undo REQUESTS, and `saveUndoState` is the only thing that both
 * counts one and marks the model dirty. A mutator that writes without asking to be saved therefore
 * lands in the data, mints no undo entry, and makes its caller conclude nothing happened — so
 * `adjustPitch` skips the repaint and the member moves everywhere except on the page.
 */
describe('a member edit is a real edit', () => {
  let engine: MusicEngine
  let memberId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    const noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.setFan(noteId, FAN)
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    memberId = slot.fan!.members![0][0].id
  })

  it('⭐ REPORTS the change — which is what tells the caller to repaint', () => {
    // The exact shape `SelectionController.adjustPitch` uses: false here means no render.
    const changed = engine.runBatch('Transpose 1 note(s)', () => {
      engine.updateNote(memberId, { step: 'D', octave: 4 })
    })
    expect(changed).toBe(true)
  })

  it('⭐ and it can be UNDONE, like any other note edit', () => {
    engine.runBatch('Transpose', () => { engine.updateNote(memberId, { step: 'B', octave: 5 }) })
    expect(engine.getNote(memberId)!.step).toBe('B')
    expect(engine.undo()).toBe(true)
    expect(engine.getNote(memberId)!.step).toBe('C')
  })
})

/**
 * ⭐ Shift+letter stacks a pitch onto the MEMBER (docs/fanned-beam-pitches-plan.md §1 — the plan's
 * own list of what a member accepts). A member is a chord in its own right; resolving the chord
 * positionally, as the ordinary path does, put the new note on the group's FIRST head.
 */
describe('a chord note on a fanned member', () => {
  let engine: MusicEngine
  let noteId: string
  let memberId: string

  const slot = (): Chord => {
    const s = engine.getScore().measures[0].slots.find(x => x.type === 'chord')!
    if (s.type !== 'chord') throw new Error('expected a chord')
    return s
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.setFan(noteId, FAN)
    memberId = slot().fan!.members![1][0].id // the SECOND member, so a slot-wide add is obvious
  })

  it('⭐ lands on the member, not on the note that was typed', () => {
    const added = engine.addFanMemberPitch(memberId, { step: 'E', alter: 0, octave: 4 })
    expect(added).not.toBeNull()
    expect(slot().fan!.members![1].map(p => p.step)).toEqual(['C', 'E'])
    expect(slot().notes.map(p => p.step)).toEqual(['C'])  // the typed note is untouched
    expect(slot().fan!.members![0]).toHaveLength(1)       // and so is every other member
  })

  it('reports the member’s own pitches — what "already stacked here" means inside a fan', () => {
    engine.addFanMemberPitch(memberId, { step: 'G', alter: 0, octave: 4 })
    const pitches = engine.fanMemberPitches(memberId)!
    expect(pitches.map(p => p.step)).toEqual(['C', 'G'])
    // …and null for an ordinary note, which is what sends the caller down the ordinary path.
    expect(engine.fanMemberPitches(noteId)).toBeNull()
  })

  it('is undoable, and the added pitch can be deleted again', () => {
    const added = engine.addFanMemberPitch(memberId, { step: 'E', alter: 0, octave: 4 })!
    expect(engine.undo()).toBe(true)
    expect(slot().fan!.members![1]).toHaveLength(1)
    expect(engine.redo()).toBe(true)
    expect(slot().fan!.members![1]).toHaveLength(2)
    // Deleting one of two is allowed; the LAST one is refused (the group's size is fan.count).
    expect(engine.deleteNote(added.id)).toBe(true)
    expect(slot().fan!.members![1].map(p => p.step)).toEqual(['C'])
  })

  it('refuses on an ordinary note — the slot has its own door', () => {
    expect(engine.addFanMemberPitch(noteId, { step: 'E', alter: 0, octave: 4 })).toBeNull()
  })
})
