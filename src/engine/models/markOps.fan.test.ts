import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import type { Chord, FanMark } from '@/types/music'

/**
 * The FAN MODEL — one field on the slot (docs/fanned-beams-plan.md §0), and the refusals that ARE
 * the notation: you cannot accelerate silence, a ramp inside a tuplet's ratio is a second
 * normalization of one span, and a slot cannot carry two answers to "how many attacks?".
 *
 * Nothing here is about how the fan is DRAWN — jsdom cannot measure glyphs, so a geometry assertion
 * would pass vacuously (reference_jsdom_cannot_measure_glyphs).
 *
 * ⚠️ Subject: {@link markOps.setFan}, since 2026-07-28 (modularity plan Phase 3) — this file was
 * `ScoreModel.fan.test.ts`. Its LAST chapter is the exception: the fan MEMBER accessors
 * (`addFanMemberPitch`, `fanMemberPitches`) stayed on `ScoreModel`, so those assertions are on the
 * model. Left together deliberately: one file answers "what is a fan in the model?".
 */
describe('setFan (model)', () => {
  let model: ScoreModel
  const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (measure: number, beat: number): Chord => {
    const slot = model.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  /** One blanca filling half of bar 1 — the note the feature is designed around. */
  const blanca = () => model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })

  it('marks the slot, and leaves the duration and the beat alone', () => {
    const note = blanca()
    expect(model.setFan(note.id, FAN)).not.toBeNull()
    const chord = chordAt(1, 0)
    expect(chord.fan).toMatchObject(FAN)
    // The whole point: the model still holds ONE half note where the user typed one.
    expect(chord.duration).toBe('h')
    expect(fracToNumber(chord.beat)).toBe(0)
    expect(chord.notes).toHaveLength(1)
  })

  it('removing it puts the note back exactly as typed', () => {
    const note = blanca()
    model.setFan(note.id, FAN)
    expect(model.setFan(note.id, null)).not.toBeNull()
    expect('fan' in chordAt(1, 0)).toBe(false)
    expect(chordAt(1, 0).duration).toBe('h')
  })

  it('reports null when there is nothing to remove — not an edit, so not an undo entry', () => {
    const note = blanca()
    expect(model.setFan(note.id, null)).toBeNull()
  })

  it('refuses a REST — you cannot accelerate silence', () => {
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    expect(model.setFan(rest.id, FAN)).toBeNull()
  })

  it('refuses a TUPLET member — a ramp inside a ratio is a second normalization', () => {
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    const a = model.addNote({
      step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id,
    })
    expect(chordAt(1, 0).tupletId).toBe(tuplet.id)
    expect(model.setFan(a.id, FAN)).toBeNull()
    expect('fan' in chordAt(1, 0)).toBe(false)
  })

  it('refuses an id that is not a note at all', () => {
    expect(model.setFan('no-such-id', FAN)).toBeNull()
  })
})

describe('setFan — one slot, ONE expansion', () => {
  let model: ScoreModel
  const FAN: FanMark = { direction: 'rit', count: 4, beams: 2 }

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (beat: number): Chord => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  const twoQuarters = () => ({
    a: model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }),
    b: model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) }),
  })

  it('a fan takes the tremolo off', () => {
    const { a } = twoQuarters()
    model.setTremolo(a.id, 3)
    model.setFan(a.id, FAN)
    expect(chordAt(0).fan).toMatchObject(FAN)
    expect('tremolo' in chordAt(0)).toBe(false)
  })

  it('a fan takes a two-note PAIR off, style and all', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    model.setTremoloPairStyle(a.id, 'joined')
    model.setFan(a.id, FAN)
    expect(chordAt(0).fan).toMatchObject(FAN)
    expect('tremoloPair' in chordAt(0)).toBe(false)
    expect('tremoloPairStyle' in chordAt(0)).toBe(false)
    expect('tremolo' in chordAt(0)).toBe(false)
  })

  it('and the other way round — setting a tremolo takes the fan off', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremolo(a.id, 3)
    expect('fan' in chordAt(0)).toBe(false)
    expect(chordAt(0).tremolo).toBe(3)
  })

  it('pairing takes the fan off too', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremoloPair(a.id, true)
    expect('fan' in chordAt(0)).toBe(false)
    expect(chordAt(0).tremoloPair).toBe(true)
  })

  it('REMOVING a tremolo says nothing about the fan — the rule is the SET, not the delete', () => {
    const { a } = twoQuarters()
    model.setFan(a.id, FAN)
    model.setTremolo(a.id, null)
    expect(chordAt(0).fan).toMatchObject(FAN)
  })
})

/**
 * THE MEMBERS (docs/fanned-beam-pitches-plan.md §1) — the one thing inside a fan that is stored,
 * because a pitch cannot be derived. `setFan` is the only door: it runs every mark through
 * `normalizeFan`, which owns the `members.length === count - 1` off-by-one.
 */
describe('setFan — the members', () => {
  let model: ScoreModel
  const fan = (count: number, beams = 3): FanMark => ({ direction: 'accel', count, beams })

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (beat: number): Chord => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }
  const members = () => chordAt(0).fan!.members!
  const blanca = () => model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })

  it('⭐ member 0 IS the slot\'s own chord — the list holds the OTHER count-1', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    expect(members()).toHaveLength(5)
    expect(chordAt(0).notes).toHaveLength(1)
    expect(chordAt(0).notes[0].id).toBe(note.id) // never copied into the list
  })

  it('materialises every member as the note that was typed — pitches, not ids', () => {
    const note = blanca()
    model.setFan(note.id, fan(4))
    expect(members().map(m => m.pitches.map(p => `${p.step}${p.octave}`).join())).toEqual(['C4', 'C4', 'C4'])
    const ids = members().flatMap(m => m.pitches).map(p => p.id)
    expect(new Set([...ids, note.id]).size).toBe(ids.length + 1) // every one its own note
  })

  it('a CHORD fans as a chord — each member gets all of its pitches', () => {
    const note = blanca()
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) }) // joins the chord
    model.setFan(note.id, fan(3))
    expect(members()).toHaveLength(2)
    expect(members().every(m => m.pitches.length === 2)).toBe(true)
  })

  it('a count of 1 is a fan with no other members, not a broken list', () => {
    const note = blanca()
    model.setFan(note.id, fan(1))
    expect(members()).toEqual([])
  })

  it('growing copies the LAST member — a rising line continues rising', () => {
    const note = blanca()
    model.setFan(note.id, fan(3))
    members()[1].pitches[0].step = 'G' // the line has been edited up to G4
    model.setFan(note.id, { ...chordAt(0).fan!, count: 5 })
    expect(members().map(m => m.pitches[0].step)).toEqual(['C', 'G', 'G', 'G'])
  })

  it('shrinking drops from the END, and the survivors keep their ids', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    const kept = members().slice(0, 2).map(m => m.pitches[0].id)
    model.setFan(note.id, { ...chordAt(0).fan!, count: 3 })
    expect(members()).toHaveLength(2)
    expect(members().map(m => m.pitches[0].id)).toEqual(kept)
  })

  it('a clamped count still gets the members it says it has', () => {
    const note = blanca()
    model.setFan(note.id, fan(9999))
    expect(members()).toHaveLength(chordAt(0).fan!.count - 1)
  })

  it('⭐ removing the fan leaves exactly the note that was typed', () => {
    const note = blanca()
    model.setFan(note.id, fan(6))
    model.setFan(note.id, null)
    expect(chordAt(0).notes).toHaveLength(1)
    expect(chordAt(0).notes[0].id).toBe(note.id)
    expect(chordAt(0).duration).toBe('h')
  })
})

/**
 * ⭐ P3 — A MEMBER IS A NOTE YOU CAN EDIT (docs/fanned-beam-pitches-plan.md §2 P3).
 *
 * The rule underneath all of it: `findSlot` finds a member only when ASKED, so a mutator that has
 * not thought about fans refuses instead of writing a half-edit nobody can see.
 */
describe('a fanned member as an editable pitch', () => {
  let model: ScoreModel
  const FAN: FanMark = { direction: 'accel', count: 4, beams: 3 }

  beforeEach(() => { model = new ScoreModel('Fanned beams') })

  const chordAt = (beat: number): Chord => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }
  /** A fanned blanca at bar 1 beat 0; returns the typed note and its members. */
  function fanned() {
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    return { note, members: chordAt(0).fan!.members! }
  }

  it('knows one when it sees one', () => {
    const { note, members } = fanned()
    expect(model.isFanMember(members[0].pitches[0].id)).toBe(true)
    expect(model.isFanMember(note.id)).toBe(false)
    expect(model.isFanMember('no-such-id')).toBe(false)
  })

  it('⭐ getNote answers for it — its own pitch, the SLOT’s rhythm', () => {
    const { members } = fanned()
    members[1].pitches[0].step = 'G'
    const got = model.getNote(members[1].pitches[0].id)!
    expect(got.step).toBe('G')
    expect(got.duration).toBe('h')        // one event: the member has no length of its own
    expect(fracToNumber(got.beat)).toBe(0)
    expect(got.isRest).toBe(false)
  })

  it('⭐ updateNote re-spells it — which is what makes the arrows and a–g work', () => {
    const { members } = fanned()
    const id = members[0].pitches[0].id
    model.updateNote(id, { step: 'E', octave: 5, alter: 1 })
    expect(chordAt(0).fan!.members![0].pitches[0]).toMatchObject({ step: 'E', octave: 5, alter: 1 })
    // …and the note that was typed is untouched.
    expect(chordAt(0).notes[0]).toMatchObject({ step: 'C', octave: 4 })
  })

  it('⛔ but updateNote writes NOTHING else onto it — the rhythm is the slot’s', () => {
    const { members } = fanned()
    const id = members[0].pitches[0].id
    model.updateNote(id, { duration: 'q', dots: 1, tiedTo: 'somewhere', beam: 'begin' })
    expect(chordAt(0).duration).toBe('h')
    expect(chordAt(0).dots).toBeUndefined()
    expect(chordAt(0).beam).toBeUndefined()
    expect(members[0].pitches[0].tiedTo).toBeUndefined() // a tie stored here would never be drawn
  })

  it('resolves to its SLOT for anything slot-shaped', () => {
    const { members } = fanned()
    expect(model.slotIdForNote(members[0].pitches[0].id)).toBe(chordAt(0).id)
    expect(model.getNotePitch(members[0].pitches[0].id)?.id).toBe(members[0].pitches[0].id)
  })

  /**
   * ⭐ …but the horizontal OFFSET is not slot-shaped: a member has a head and a stem of its own and
   * can be moved off its column like anything else (docs/note-offset-plan.md §"Inside a FAN").
   */
  describe('offsetTargetOf — the key its own offset is stored at', () => {
    it('⭐ a member answers with ITS key, the note that was typed with the slot', () => {
      const { note, members } = fanned()
      expect(model.offsetTargetOf(note.id)).toEqual({ key: chordAt(0).id, memberIndex: 0 })
      expect(model.offsetTargetOf(members[0].pitches[0].id)).toEqual({ key: members[0].pitches[0].id, memberIndex: 1 })
      expect(model.offsetTargetOf(members[2].pitches[0].id)).toEqual({ key: members[2].pitches[0].id, memberIndex: 3 })
      expect(model.offsetTargetOf('no-such-id')).toBeUndefined()
    })

    it('⭐ so nudging one member leaves the owner — and every other member — where it was', () => {
      const { note, members } = fanned()
      model.nudgeNoteOffset(model.offsetTargetOf(members[1].pitches[0].id)!.key, 1.5)
      const overrides = model.getScore().engravingOverrides ?? {}
      expect(overrides[members[1].pitches[0].id]).toEqual([{ kind: 'noteOffset', x: 1.5 }])
      expect(overrides[chordAt(0).id]).toBeUndefined()
      expect(overrides[note.id]).toBeUndefined()
      expect(overrides[members[0].pitches[0].id]).toBeUndefined()
    })

    it('a member’s pitches share ONE offset — the whole member moves, not one notehead', () => {
      const { members } = fanned()
      const stacked = model.addFanMemberPitch(members[0].pitches[0].id, { step: 'E', alter: 0, octave: 4 })!
      expect(model.offsetTargetOf(stacked.id)).toEqual(model.offsetTargetOf(members[0].pitches[0].id))
    })

    /**
     * ⭐ THE SWEEP (P3). An id-keyed entry whose element dies is stranded — it can never mis-apply
     * (a new member is minted with a new id), but it stays in the JSON forever. A member dies in
     * four places, and only ONE of them is `deleteNote`.
     */
    describe('an offset dies with the member it belongs to', () => {
      const offsets = () => Object.keys(model.getScore().engravingOverrides ?? {})

      /** A fan with every member offset, so the sweep has something to miss. `keys` is captured up
       *  front: `fan.members` is the live list, and the edits under test splice it. */
      function allOffset() {
        const f = fanned()
        const keys = f.members.map(m => m.pitches[0].id)
        for (const key of keys) model.nudgeNoteOffset(model.offsetTargetOf(key)!.key, 1)
        expect(offsets()).toHaveLength(3)
        return { ...f, keys }
      }

      it('Delete on the member takes it', () => {
        const { keys } = allOffset()
        model.deleteNote(keys[1])
        expect(offsets()).toEqual([keys[0], keys[2]])
      })

      it('⭐ …and so does LOWERING the count, which never goes near deleteNote', () => {
        const { note, keys } = allOffset()
        model.setFan(note.id, { ...chordAt(0).fan!, count: 2 }) // 4 → 2: members 2 and 3 are gone
        expect(offsets()).toEqual([keys[0]])
      })

      it('removing the fan takes all of them — the members went with the mark', () => {
        const { note } = allOffset()
        model.setFan(note.id, null)
        expect(offsets()).toEqual([])
      })

      it('deleting the note that was typed takes the whole group with it', () => {
        const { note } = allOffset()
        model.deleteNote(note.id) // the slot goes, and the fan it wore
        expect(offsets()).toEqual([])
      })
    })

    it('⭐ deleting the pitch the key is MADE of carries the offset to the next one', () => {
      const { members } = fanned()
      const first = members[0].pitches[0].id
      const stacked = model.addFanMemberPitch(first, { step: 'E', alter: 0, octave: 4 })!
      model.nudgeNoteOffset(model.offsetTargetOf(first)!.key, -2)

      expect(model.deleteNote(first)).toBe(true)
      // The pitch is gone; the assertion about where the member sits is not, and it is readable
      // through the id that is left.
      const overrides = model.getScore().engravingOverrides ?? {}
      expect(overrides[first]).toBeUndefined()
      expect(model.offsetTargetOf(stacked.id)).toEqual({ key: stacked.id, memberIndex: 1 })
      expect(overrides[stacked.id]).toEqual([{ kind: 'noteOffset', x: -2 }])
    })
  })

  it('⭐ deleting its LAST pitch takes the MEMBER with it — the group is one shorter', () => {
    const { members } = fanned()
    const second = members[1].pitches[0].id
    expect(model.deleteNote(members[0].pitches[0].id)).toBe(true)
    expect(chordAt(0).fan!.count).toBe(3)
    // The count and the list stay in step (members.length === count - 1), and the members that
    // survive keep their ids — a selection or a slur on a LATER member must not move.
    expect(chordAt(0).fan!.members).toHaveLength(2)
    expect(chordAt(0).fan!.members![0].pitches[0].id).toBe(second)
  })

  it('…and the LAST member takes the fan itself — a group of one is not a fan', () => {
    const { members } = fanned()
    for (const m of [...members]) model.deleteNote(m.pitches[0].id)
    expect(chordAt(0).fan).toBeUndefined()
    expect(chordAt(0).notes).toHaveLength(1) // the note you typed is still there
  })

  it('deleting ONE pitch of a member that has several removes that pitch', () => {
    const { members } = fanned()
    members[0].pitches.push({ id: 'extra', step: 'E', alter: 0, octave: 4 })
    expect(model.deleteNote('extra')).toBe(true)
    expect(chordAt(0).fan!.members![0].pitches.map(p => p.step)).toEqual(['C'])
  })

  it('⛔ every SLOT-shaped mutator refuses it, by not finding it at all', () => {
    const { members } = fanned()
    const id = members[0].pitches[0].id
    expect(model.setTremolo(id, 3)).toBeNull()
    expect(model.setFan(id, { direction: 'rit', count: 3, beams: 2 })).toBeNull()
    expect(model.setTremoloPair(id, true)).toBeNull()
    expect(model.convertToRest(id)).toBeNull()
    expect(model.moveNoteToVoice(id, 1)).toBe(false)
    expect(model.setTieDirection(id, 1)).toBe(false)
    // …and the fan is exactly as it was.
    expect(chordAt(0).fan).toMatchObject(FAN)
    expect('tremolo' in chordAt(0)).toBe(false)
  })
})
