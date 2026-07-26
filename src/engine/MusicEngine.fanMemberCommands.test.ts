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

  /**
   * ⭐ A SLUR *is* allowed on a member — the one place this reverses the plan (§3 refused ties and
   * slurs together). That was right for the tie: it is a pitch-to-pitch CONTINUATION, and a member
   * has no length of its own to continue into. A slur is not an attachment to the event's rhythm,
   * it is a SPAN between two points, and member 2 → member 5 is a span (his ask).
   */
  it('⭐ a SLUR anchors to the member — a span, not an attachment', () => {
    const slot = chord()
    const second = slot.fan!.members![1][0].id
    const created = engine.createSlur([memberId, second])
    expect(created).not.toBeNull()
    expect(created!.startNoteId).toBe(memberId)
    expect(created!.endNoteId).toBe(second)
  })

  it('⭐ the slur runs FORWARD however the two members were clicked', () => {
    // ⚠️ Every member reports the SLOT's beat, so `compareByPosition` calls them simultaneous and
    // the sort keeps the CLICK order. Select the later member first and the slur is built backwards
    // — drawn from the right head to the left one — and only sometimes, which is the worst kind.
    const slot = chord()
    const first = slot.fan!.members![0][0].id
    const third = slot.fan!.members![2][0].id
    const created = engine.createSlur([third, first])
    expect(created).not.toBeNull()
    expect(created!.startNoteId).toBe(first)
    expect(created!.endNoteId).toBe(third)
  })

  it('⭐ and it SURVIVES — the dangling-slur sweep knows where members live', () => {
    // The defensive pass rebuilds the id set from the score; leave members out of it and every
    // slur inside a fan is dropped the next time any edit runs it.
    const second = chord().fan!.members![1][0].id
    const created = engine.createSlur([memberId, second])!
    engine.updateNote(memberId, { step: 'D', octave: 4 }) // any edit at all
    expect(engine.getSlurs().some(sl => sl.id === created.id)).toBe(true)
  })

  it('⭐ `s` on the note you TYPED slurs to member 1 — it IS member 0', () => {
    // Not "the whole event": once you are working member by member, the thing after the first note
    // is the second member. Slurring a fan to something outside it means selecting BOTH ends.
    const created = engine.createSlur([noteId])
    expect(created).not.toBeNull()
    expect(created!.startNoteId).toBe(noteId)
    expect(created!.endNoteId).toBe(chord().fan!.members![0][0].id)
  })

  it('⭐ `s` on ONE member slurs to the NEXT member, not out of the group', () => {
    const created = engine.createSlur([memberId])
    expect(created).not.toBeNull()
    expect(created!.startNoteId).toBe(memberId)
    expect(created!.endNoteId).toBe(chord().fan!.members![1][0].id)
  })

  it('from the LAST member it slurs out of the fan, to the next slot', () => {
    engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    const last = chord().fan!.members![chord().fan!.members!.length - 1][0].id
    const created = engine.createSlur([last])
    expect(created).not.toBeNull()
    expect(engine.getNote(created!.endNoteId)?.step).toBe('G')
  })

  it('⛔ and none of the refusals leaves an undo entry behind', () => {
    const before = engine.exportJSON()
    engine.toggleTie(memberId)
    engine.toggleArticulation(memberId, 'staccato')
    engine.flipStemDirection(memberId)
    engine.convertToRest(memberId)
    expect(engine.exportJSON()).toBe(before)
  })

  it('⭐ a member does NOT report the fan — only the owner does', () => {
    // The mark is what the member lives inside, not something it wears. Reported on a member it
    // lights the Keypad's `accel.` and opens the Properties fan row on a note `setFan` will refuse.
    expect(engine.getNote(memberId)?.fan).toBeUndefined()
    expect(engine.getNote(noteId)?.fan).toMatchObject({ direction: 'accel', count: 4 })
    // …and the rest of the slot's rhythm still comes through, which is the whole point of the split.
    expect(engine.getNote(memberId)).toMatchObject({ duration: 'h', measure: 1 })
  })

  it('a DURATION change on a member changes nothing — the slot owns the rhythm', () => {
    engine.updateNote(memberId, { duration: 'q' })
    expect(chord().duration).toBe('h')
    // …and the bar is still well-formed: nothing was rest-filled around a phantom edit.
    expect(engine.getScore().measures[0].slots.filter(s => s.type === 'chord')).toHaveLength(2)
  })

  /**
   * ⭐ DELETE TAKES THE MEMBER OUT OF THE FAN (his ask) — the one edit on this list that used to be
   * refused and is now a real one. The group is one shorter, and `fan.count` is what says so.
   */
  describe('Delete on a member', () => {
    it('removes it and brings the count down', () => {
      expect(engine.deleteNote(memberId)).toBe(true)
      expect(chord().fan!.count).toBe(FAN.count - 1)
      expect(chord().fan!.members).toHaveLength(FAN.count - 2)
    })

    it('⚠️ leaves the BAR alone — a member is not a slot leaving it', () => {
      // The trap: a member reports the SLOT's beat, so the "single note becomes a rest" branch
      // would drop a rest onto an event that is still there.
      const before = engine.getScore().measures[0].slots.length
      engine.deleteNote(memberId)
      expect(engine.getScore().measures[0].slots).toHaveLength(before)
      expect(engine.getScore().measures[0].slots.every(s => s.type === 'chord')).toBe(true)
      expect(chord().notes.map(p => p.step)).toEqual(['C']) // the note you typed, untouched
    })

    it('takes the FAN itself when the last member goes — a group of one is not a fan', () => {
      for (let i = 0; i < FAN.count - 1; i++) {
        const members = chord().fan?.members
        if (!members?.length) break
        engine.deleteNote(members[0][0].id)
      }
      expect(chord().fan).toBeUndefined()
      expect(chord().notes).toHaveLength(1)
    })

    it('is ONE undo entry, and Ctrl+Z puts the member back', () => {
      engine.deleteNote(memberId)
      expect(engine.undo()).toBe(true)
      expect(chord().fan!.count).toBe(FAN.count)
      expect(chord().fan!.members).toHaveLength(FAN.count - 1)
    })

    it('drops a slur anchored to the member it removed', () => {
      const second = chord().fan!.members![1][0].id
      const created = engine.createSlur([memberId, second])!
      expect(engine.getSlurs().some(s => s.id === created.id)).toBe(true)
      engine.deleteNote(memberId)
      expect(engine.getSlurs().some(s => s.id === created.id)).toBe(false)
    })

    it('but one pitch of a MEMBER CHORD is just that pitch — the member stays', () => {
      engine.addFanMemberPitch(memberId, { step: 'G', alter: 0, octave: 4 })
      const added = engine.fanMemberPitches(memberId)!.find(p => p.step === 'G')!
      expect(engine.deleteNote(added.id)).toBe(true)
      expect(chord().fan!.count).toBe(FAN.count)
      expect(chord().fan!.members![0].map(p => p.step)).toEqual(['C'])
    })

    it('the note you TYPED is not a member — deleting it deletes the EVENT, fan and all', () => {
      expect(engine.deleteNote(noteId)).toBe(true)
      const slots = engine.getScore().measures[0].slots
      expect(slots.some(s => s.type === 'chord' && s.fan)).toBe(false)
      expect(slots.some(s => s.type === 'rest')).toBe(true) // …replaced by its rest, as always
    })
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

  /**
   * ⭐ …and the horizontal offset is NOT one of those things (docs/note-offset-plan.md §"Inside a
   * FAN"). Reported from use: nudge a member and the note that was typed moved instead, because the
   * offset resolved to the slot — the third time a member has answered for its owner.
   */
  it('⭐ nudging it moves the MEMBER, not the note that was typed', () => {
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(engine.nudgeNoteOffset(memberId, 1)).toBe(true)
    expect(engine.getNoteOffset(memberId)).toBe(1)
    // The owner is untouched, and says so through the same reader the Properties input uses.
    expect(engine.getNoteOffset(noteId)).toBe(0)
    expect(engine.getScore().engravingOverrides?.[slot.id]).toBeUndefined()

    expect(engine.resetNoteOffset(memberId)).toBe(true)
    expect(engine.getNoteOffset(memberId)).toBe(0)
    // Nothing to reset twice — the key that DECLINES keeps the shortcut free (§C).
    expect(engine.resetNoteOffset(memberId)).toBe(false)
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
    // Deleting one of two leaves the member standing; the LAST one takes the member with it.
    expect(engine.deleteNote(added.id)).toBe(true)
    expect(slot().fan!.members![1].map(p => p.step)).toEqual(['C'])
  })

  it('refuses on an ordinary note — the slot has its own door', () => {
    expect(engine.addFanMemberPitch(noteId, { step: 'E', alter: 0, octave: 4 })).toBeNull()
  })
})

/**
 * ⭐ THE SPACING ADDRESS of a fanned member (docs/note-spacing-plan.md §7).
 *
 * `getNote` projects a member with the SLOT's beat, which is why nudging one member's spacing moved
 * the whole fan: every member handed the spacing keys the group's own column. `spacingColumnOf` is
 * the fix and the only new address in the feature — an exact rational inside the slot, which
 * `spacingPositionKey` has always been able to hold.
 */
describe('MusicEngine.spacingColumnOf', () => {
  let engine: MusicEngine
  let noteId: string

  const fanOf = (): FanMark => {
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    return slot.fan!
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // A half note fanned into 4: the members sound at 0, and then at the ramp's own rationals.
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.setFan(noteId, { direction: 'accel', count: 4, beams: 3 })
  })

  it('an ordinary note answers its own column', () => {
    const plain = engine.getScore().measures[0].slots.find(s => s.type === 'chord' && !s.fan)!
    if (plain.type !== 'chord') throw new Error('expected a chord')
    expect(engine.spacingColumnOf(plain.notes[0].id)).toEqual({ measure: 1, beat: frac(2, 1), memberIndex: 0 })
  })

  it('⭐ member 0 IS the slot — its column is the fan’s own, and nothing about it changes', () => {
    expect(engine.spacingColumnOf(noteId)).toEqual({ measure: 1, beat: frac(0, 1), memberIndex: 0 })
  })

  it('⭐ every later member answers its OWN beat, in order and inside the slot', () => {
    const members = fanOf().members!
    let previous = 0
    for (let k = 0; k < members.length; k++) {
      const column = engine.spacingColumnOf(members[k][0].id)!
      expect(column.memberIndex).toBe(k + 1)
      const beat = column.beat.num / column.beat.den
      expect(beat).toBeGreaterThan(previous)
      expect(beat).toBeLessThan(2) // the slot is a half note: the group never leaves it
      previous = beat
    }
  })

  it('two pitches of ONE member share one address — a member is a chord, and a chord is a column', () => {
    const member = fanOf().members![0]
    engine.addFanMemberPitch(member[0].id, { step: 'E', alter: 0, octave: 4 })
    const stacked = fanOf().members![0]
    expect(stacked).toHaveLength(2)
    expect(engine.spacingColumnOf(stacked[1].id)).toEqual(engine.spacingColumnOf(stacked[0].id))
  })

  it('an unknown id has no address at all — the caller declines rather than guesses', () => {
    expect(engine.spacingColumnOf('nope')).toBeNull()
  })
})
