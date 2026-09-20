/**
 * SILENCING A SLOT — {@link convertSlotToRest}. convertToRest is NOT delete-then-refill: the rest
 * keeps the slot's OWN authored length. Delete leaves a gap and lets the meter-aware fill re-decide,
 * which is right for a hole and wrong for a silence that has a length. These cases pin where the two
 * would disagree, and what the rest of the score is owed afterwards (slurs, the voice collapse).
 * Through a real `ScoreModel`; the undo entry is the facade's and is not asked here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { FanMark } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { ScoreModel } from './ScoreModel'
import { convertSlotToRest, slotPitchIds, swapSlotForRest } from './convertToRestOps'
import { toggleTie } from './tieOps'

describe('convertSlotToRest', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
  })

  const slots = () => model.getScore().measures[0].slots
  const convert = (id: string) => model.getNote(convertSlotToRest(model, id)!)!

  it('gives a rest of the note\'s own duration, at its beat', () => {
    const n = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(2, 1) })
    const rest = convert(n.id)
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('h')
    expect(fracToNumber(rest.beat)).toBe(2)
    expect(model.getNote(n.id)).toBeFalsy() // the head is gone; the rest has a new id
  })

  it('keeps the DOTS — the fill would never invent a dotted rest in 4/4', () => {
    // A dotted quarter's silence is a dotted quarter rest. Deleting instead leaves [0,1.5) for
    // restFill, which in 4/4 answers with a quarter + an eighth (see the dotted-rests note): two
    // rests where the author wrote one length.
    const n = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })
    const rest = convert(n.id)
    expect(rest.duration).toBe('q')
    expect(rest.dots).toBe(1)
  })

  it('turns a whole CHORD into ONE rest — a rest cannot hold pitches', () => {
    const c = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = convert(c.id)
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('q')
    expect(model.getNote(e.id)).toBeFalsy() // the sibling head went with the slot
    const atBeat0 = slots().filter(s => fracToNumber(s.beat) === 0)
    expect(atBeat0).toHaveLength(1)
    expect(atBeat0[0].type).toBe('rest')
  })

  it('null — and nothing written — on a rest ("un-rest this" would have to invent a pitch) or a gone id', () => {
    const n = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const restId = convertSlotToRest(model, n.id)!
    const before = JSON.stringify(model.getScore())
    expect(convertSlotToRest(model, restId)).toBeNull()
    expect(convertSlotToRest(model, 'gone')).toBeNull()
    expect(JSON.stringify(model.getScore())).toBe(before)
  })

  it('keeps an ARRIVING tie, re-pointed at the rest (let-ring), and drops the LEAVING one', () => {
    // a —tie→ b, and b —tie→ c. Silencing b: a's arc survives onto the rest (the note rings into the
    // silence); b's own arc out to c dies, since a rest has nothing to carry.
    const [a, b, c] = [0, 1, 2].map(i =>
      model.addNote({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(i, 1) }))
    toggleTie(model, a.id)
    toggleTie(model, b.id)
    expect(model.getNote(a.id)!.tiedTo).toBe(b.id)

    const rest = convert(b.id)
    expect(model.getNote(a.id)!.tiedTo).toBe(rest.id) // survived, re-pointed
    expect(model.getNote(c.id)!.tiedFrom).toBeUndefined() // b's outgoing arc died with it
  })

  it('does not disturb the other staff\'s note at the same beat and voice', () => {
    // `chordNotesAt` is staff-scoped — two staves with a note at the same beat in voice 0 is
    // ordinary, and must not be mistaken for a chord.
    model.addStaffBelow(0)
    const top = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
    const bottom = model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    const rest = convert(top.id)
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('q')
    expect(model.getNote(bottom.id)!.isRest).toBeFalsy() // untouched
    expect(slotPitchIds(model, bottom)).toEqual([bottom.id])
  })

  it('⭐ a slur anchored to ANY head of the slot follows it onto the rest', () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const bTop = model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addSlur({ startNoteId: a.id, endNoteId: bTop.id }) // anchored to the head NOT named below

    const restId = convertSlotToRest(model, b.id)!

    expect(model.getSlurs()).toHaveLength(1)
    expect(model.getSlurs()[0]).toMatchObject({ startNoteId: a.id, endNoteId: restId })
  })

  it('⚠️ silencing the LAST note of voice 2 collapses it — the id still says it happened', () => {
    // The rest went with the lane, so there is no rest to hand back; the score changed all the
    // same, and the facade owes an undo entry. That is why the answer is an id.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    const v2 = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    const restId = convertSlotToRest(model, v2.id)

    expect(restId).toBeTruthy()
    expect(slots().filter(s => (s.voice ?? 0) === 1)).toHaveLength(0)
    expect(model.getNote(restId!)).toBeFalsy()
  })

  it('⛔ refuses a FANNED MEMBER — the silence belongs to the whole gesture', () => {
    // ⚠️ Pins the OUTCOME, not which line refuses: the model will not find a member either, so
    // taking the ops' own check out leaves this green. The check is what makes it a logged decision.
    const FAN: FanMark = { direction: 'accel', count: 4, beams: 3 }
    const owner = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(owner.id, FAN)
    const chord = slots().find(s => s.type === 'chord')!
    if (chord.type !== 'chord') throw new Error('expected a chord')
    const memberId = chord.fan!.members![0].pitches[0].id

    const before = JSON.stringify(model.getScore())
    expect(convertSlotToRest(model, memberId)).toBeNull()
    expect(JSON.stringify(model.getScore())).toBe(before)
  })
})

describe('swapSlotForRest — the same SLOT wearing a different type', () => {
  it('in place, at the same index, keeping everything that says WHERE and HOW LONG', () => {
    const model = new ScoreModel()
    model.addStaffBelow(0)
    const lowId = model.getScore().staves![1].id
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2, 1, 1)
    const first = model.addNote({ step: 'C', alter: 0, octave: 3, duration: '8', measure: 1, beat: frac(0, 1), voice: 1, staff: 1, tupletId: tuplet.id })
    model.refillTupletRemainder(1, tuplet, 1)
    const slots = model.getScore().measures[0].slots
    const index = slots.findIndex(s => s.type === 'chord')
    const was = slots[index]

    const rest = swapSlotForRest(model.getScore(), first.id)!

    expect(slots[index]).toBe(rest) // its seat in the bar's order is kept
    expect(rest).toMatchObject({ type: 'rest', duration: '8', voice: 1, staffId: lowId, tupletId: tuplet.id })
    expect(rest.beat).toEqual(was.beat)
    expect(rest.actualDuration).toEqual(was.actualDuration) // still a triplet eighth
    expect(rest.id).not.toBe(was.id)
  })

  it('null for a rest, an id that names nothing, and a fanned MEMBER (found only when asked for)', () => {
    const model = new ScoreModel()
    const owner = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(owner.id, { direction: 'accel', count: 4, beams: 3 })
    const chord = model.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (chord.type !== 'chord') throw new Error('expected a chord')
    const restId = model.getScore().measures[0].slots.find(s => s.type === 'rest')!.id

    expect(swapSlotForRest(model.getScore(), restId)).toBeNull()
    expect(swapSlotForRest(model.getScore(), 'gone')).toBeNull()
    expect(swapSlotForRest(model.getScore(), chord.fan!.members![0].pitches[0].id)).toBeNull()
  })
})
