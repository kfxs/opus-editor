/**
 * {@link hairpinSpan} — turning `beat + length` into the two (measure, beat) addresses a wedge
 * actually covers.
 *
 * ⭐ **This is the price of having no foreign key, and this chapter is the receipt.** Nothing on a
 * `Hairpin` names the bar it ends in — which is what makes inserting and deleting measures free —
 * so the end is DERIVED from the bars that are actually there, every render. The consequences that
 * follow (a bar deleted from inside the span changes what the wedge covers; a span running off the
 * end is clamped) are the documented behaviour of that choice, so they are pinned here rather than
 * discovered later.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import {
  addHairpin, addHairpinOverNotes, getHairpinById, hairpinSpan, resizeHairpinBySlot,
  moveHairpinStartBySlot, setHairpinStartAtSlot, setHairpinEndAtSlot,
} from './hairpinOps'

describe('hairpinSpan', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    model.addMeasure()       // 2
    model.addMeasure()       // 3
    score = model.getScore()
  })

  const span = (id: string) => {
    const s = hairpinSpan(score, id)!
    return `${s.startMeasure}@${fracToNumber(s.startBeat)} → ${s.endMeasure}@${fracToNumber(s.endBeat)}`
  }

  it('stays in its own bar when the length fits', () => {
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1) })!.id
    expect(span(id)).toBe('1@1 → 1@3')
  })

  it('⭐ an end landing exactly on the barline belongs to THAT bar, not to beat 0 of the next', () => {
    // `<` instead of `<=` here would draw the wedge one whole bar too far, and it is the kind of
    // off-by-one that looks plausible on screen.
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(4, 1) })!.id
    expect(span(id)).toBe('1@0 → 1@4')
  })

  it('walks forward through the bars for a span that crosses barlines', () => {
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(2, 1), length: frac(5, 1) })!.id
    expect(span(id)).toBe('1@2 → 2@3') // 2 + 5 = 7 → bar 2, beat 3
  })

  it('crosses several bars', () => {
    const id = addHairpin(score, 1, { type: 'dim', beat: frac(0, 1), length: frac(9, 1) })!.id
    expect(span(id)).toBe('1@0 → 3@1')
  })

  it('⚠️ CLAMPS a span running past the end of the score to the last bar\'s end', () => {
    // The same defence `restoreBeatAnchors` gives an over-running offset. A wedge pointing past the
    // music is not drawable, and refusing to answer would make the renderer invent its own clamp.
    const id = addHairpin(score, 3, { type: 'cresc', beat: frac(0, 1), length: frac(99, 1) })!.id
    expect(span(id)).toBe('3@0 → 3@4')
  })

  it('measures in MUSIC, so a shorter bar ends the span sooner', () => {
    model.setTimeSignature(2, { numerator: 2, denominator: 4 }) // bar 2 now holds 2 quarters
    const id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(6, 1) })!.id
    expect(span(id)).toBe('1@0 → 2@2') // 4 of bar 1 + 2 of bar 2
  })

  it('returns null for an unknown id', () => {
    expect(hairpinSpan(score, 'ghost')).toBeNull()
  })
})

/**
 * {@link addHairpinOverNotes} + {@link resizeHairpinBySlot} — the two writes the UX makes.
 *
 * ⭐ Both are here rather than in `hairpinOps.test.ts` because both are about SPANS: how much music
 * lies between two addresses, and what "one slot further" means. The parent chapter is about
 * storage; this one is about the arithmetic over the bars.
 */
describe('addHairpinOverNotes — creating a wedge over a note span', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  const span = (id: string) => {
    const s = hairpinSpan(score, id)!
    return `${s.startMeasure}@${fracToNumber(s.startBeat)} → ${s.endMeasure}@${fracToNumber(s.endBeat)}`
  }

  it('⭐ covers the last note\'s OWN LENGTH — Gould\'s "right-hand edge of the last note"', () => {
    // Beat 0 to beat 2, where the note at 2 is a quarter → the wedge must reach beat 3, not 2.
    // Stopping at the last note's ONSET would draw a wedge that ends before the note it covers.
    const h = addHairpinOverNotes(score, 'cresc',
      { measure: 1, beat: frac(0, 1) },
      { measure: 1, beat: frac(2, 1), length: frac(1, 1) })!
    expect(fracToNumber(h.length)).toBe(3)
    expect(span(h.id)).toBe('1@0 → 1@3')
  })

  it('a wedge over ONE whole note covers the bar, not the notehead', () => {
    const h = addHairpinOverNotes(score, 'dim',
      { measure: 1, beat: frac(0, 1) },
      { measure: 1, beat: frac(0, 1), length: frac(4, 1) })!
    expect(fracToNumber(h.length)).toBe(4)
  })

  it('crosses barlines by walking the bars\' capacities', () => {
    const h = addHairpinOverNotes(score, 'cresc',
      { measure: 1, beat: frac(2, 1) },
      { measure: 2, beat: frac(1, 1), length: frac(1, 1) })!
    expect(fracToNumber(h.length)).toBe(4) // 2 left in bar 1, then 2 into bar 2
    expect(span(h.id)).toBe('1@2 → 2@2')
  })

  it('is IDEMPOTENT — the same span twice adds one wedge', () => {
    const args = [
      { measure: 1, beat: frac(0, 1) },
      { measure: 1, beat: frac(1, 1), length: frac(1, 1) },
    ] as const
    const first = addHairpinOverNotes(score, 'cresc', args[0], args[1])!
    const again = addHairpinOverNotes(score, 'cresc', args[0], args[1])!
    expect(again.id).toBe(first.id)
    expect(score.measures[0].hairpins).toHaveLength(1)
  })

  it('…but a DIFFERENT type at the same address is its own wedge', () => {
    const start = { measure: 1, beat: frac(0, 1) }
    const end = { measure: 1, beat: frac(1, 1), length: frac(1, 1) }
    addHairpinOverNotes(score, 'cresc', start, end)
    addHairpinOverNotes(score, 'dim', start, end)
    expect(score.measures[0].hairpins).toHaveLength(2)
  })

  it('refuses a span that covers no music, or runs backwards', () => {
    expect(addHairpinOverNotes(score, 'cresc',
      { measure: 1, beat: frac(2, 1) },
      { measure: 1, beat: frac(2, 1), length: frac(0, 1) })).toBeNull()
    expect(addHairpinOverNotes(score, 'cresc',
      { measure: 2, beat: frac(0, 1) },
      { measure: 1, beat: frac(0, 1), length: frac(1, 1) })).toBeNull()
  })
})

describe('resizeHairpinBySlot — Ctrl+←/→ on the model', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    // Four quarters in bar 1, four in bar 2 — a lane with slots to step through.
    for (const m of [1, 2]) {
      for (const b of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: m, beat: frac(b, 1) } as never)
      }
    }
    score = model.getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!.id
  })

  const length = () => fracToNumber(getHairpinById(score, id)!.length)

  it('grows by one SLOT, so the end lands on a notehead', () => {
    expect(resizeHairpinBySlot(score, id, 1)).toBe(true)
    expect(length()).toBe(2)
    resizeHairpinBySlot(score, id, 1)
    expect(length()).toBe(3)
  })

  it('grows ACROSS a barline', () => {
    for (let i = 0; i < 4; i++) resizeHairpinBySlot(score, id, 1)
    expect(length()).toBe(5) // through the first note of bar 2
  })

  it('shrinks by dropping the last slot it covers', () => {
    resizeHairpinBySlot(score, id, 1)
    resizeHairpinBySlot(score, id, 1)
    expect(length()).toBe(3)
    expect(resizeHairpinBySlot(score, id, -1)).toBe(true)
    expect(length()).toBe(2)
  })

  it('⭐ DECLINES rather than deleting when it cannot shrink further', () => {
    // A one-slot wedge has nothing to give up. Refusing keeps `Ctrl+←` from destroying the thing
    // it is shortening — removal is Delete's job, and it must stay the only way.
    expect(length()).toBe(1)
    expect(resizeHairpinBySlot(score, id, -1)).toBe(false)
    expect(getHairpinById(score, id)).not.toBeNull()
    expect(length()).toBe(1)
  })

  it('declines when there is nothing further in the lane to reach', () => {
    for (let i = 0; i < 8; i++) resizeHairpinBySlot(score, id, 1)
    expect(length()).toBe(8) // the whole of both bars
    expect(resizeHairpinBySlot(score, id, 1)).toBe(false)
  })

  it('⭐⭐ steps through its STAFF — a wedge scoped to an EMPTY voice still resizes', () => {
    // His call, 2026-08-19: *"a dynamic voice 2 should be able to walk even if there are no elements
    // of voice 2 in the score… voice 2 just control the reproduction"*. Voice 1 has no notes here at
    // all, and the wedge must still reach the staff's next onset.
    const other = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1), voice: 1 })!.id
    expect(resizeHairpinBySlot(score, other, 1)).toBe(true)
    expect(fracToNumber(getHairpinById(score, other)!.length)).toBe(2)
  })

  it('declines for an unknown id', () => {
    expect(resizeHairpinBySlot(score, 'ghost', 1)).toBe(false)
  })

  // ⭐⭐ P3 of docs/dynamic-voice-scope-plan.md. An unscoped wedge's lane is EVERY voice of its
  // staff, so two voices can begin together — and "cover that onset" then has two answers. It has to
  // be the SHORTEST, because the wedge must reach the NEXT onset in the lane, not past it.
})

/**
 * ⭐⭐ **THE LANE OF A WEDGE THAT GOVERNS EVERY VOICE** — P3 of docs/dynamic-voice-scope-plan.md.
 *
 * Its own fixture, and the insertion order is the point: the LONG voice is typed first, so it is the
 * first entry `measure.slots` offers at the shared onset. "Take the first" and "take the shortest"
 * disagree here, which is the only arrangement in which this rule can be seen at all.
 */
describe('resizeHairpinBySlot — where two voices strike one onset', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    // Voice 1 FIRST: a half note at beat 2, so it precedes voice 0's quarter there.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 } as never)
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(b, 1), voice: 0 } as never)
    }
    score = model.getScore()
  })

  const lengthOf = (id: string) => fracToNumber(getHairpinById(score, id)!.length)

  it('⭐ an unscoped wedge covers that onset by the SHORTER slot — the next onset, not past it', () => {
    // Growing through beat 2 must reach 3, where the lane still has a note. Reading the half note's
    // length instead would jump the wedge to 4, clean over music it claims to cover.
    const wide = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
    expect(resizeHairpinBySlot(score, wide, 1)).toBe(true)
    expect(lengthOf(wide)).toBe(3)
  })

  it('…and a wedge NARROWED to the long voice reads the SAME shortest length', () => {
    // ⭐ The lane is the staff's, so the scope changes nothing here either — both wedges reach the
    // next onset. What the voice decides is who gets louder, and nothing about the extent.
    const scoped = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1), voice: 1 })!.id
    expect(resizeHairpinBySlot(score, scoped, 1)).toBe(true)
    expect(lengthOf(scoped)).toBe(3)
  })
})

/**
 * ⭐⭐ THE SPAN IS THE SELECTION'S — his report, 2026-08-12.
 *
 * Selecting one whole-note E and pressing `H` drew a wedge running to the far edge of the F after
 * it: *"what is expected for me is that it end when the F starts."* The plan had sketched
 * "this note → the end of the NEXT slot" (§11.4) and the first build took it literally.
 *
 * This chapter is the rule that replaced it, pinned at the arithmetic layer where both doors — the
 * key and the stamp — pass through. It is what a hairpin MEANS: the wedge is the approach, and the
 * note you arrive on is where the new level is reached, not part of the climb.
 */
describe('a wedge covers exactly the music selected', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  it('⭐ ONE whole note → the wedge ends where the NEXT note begins, not past it', () => {
    // Bar 1 holds a whole note; bar 2 holds the next. The wedge must be 4 beats — bar 1 — and stop
    // exactly on the barline, which is where the note in bar 2 starts.
    const h = addHairpinOverNotes(score, 'cresc',
      { measure: 1, beat: frac(0, 1) },
      { measure: 1, beat: frac(0, 1), length: frac(4, 1) })!
    expect(fracToNumber(h.length)).toBe(4)
    const s = hairpinSpan(score, h.id)!
    expect(s.endMeasure).toBe(1)
    expect(fracToNumber(s.endBeat)).toBe(4) // the bar's end === the next note's onset
  })

  it('ONE quarter → one quarter of music, however short that reads', () => {
    // ⛔ NOT widened to reach the next note. A short wedge is narrowed by the ANGLE CAP
    // (`rendering/hairpinShape.ts`), never lengthened over music nobody selected.
    const h = addHairpinOverNotes(score, 'dim',
      { measure: 1, beat: frac(1, 1) },
      { measure: 1, beat: frac(1, 1), length: frac(1, 1) })!
    expect(fracToNumber(h.length)).toBe(1)
  })
})

/**
 * ⭐⭐ {@link moveHairpinStartBySlot} — `Ctrl+Shift+←/→` with the wedge's LEFT square armed.
 *
 * ⭐ **The claim under test is the one that looks impossible from the model's shape**: a `Hairpin`
 * stores a start and an AMOUNT, so "move the start and leave the end alone" has no field to hold the
 * end still — and it holds anyway, because the op writes `beat` and `length` together
 * (`length' = end − start'`). Every case here asserts the END, not just the start; asserting the
 * start alone would pass for an op that dragged the whole wedge, which is the bug this shape invites.
 */
describe('moveHairpinStartBySlot — the start moves, the end does not', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    for (const m of [1, 2]) {
      for (const b of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: m, beat: frac(b, 1) } as never)
      }
    }
    score = model.getScore()
    // Bar 1 beat 2 → bar 1 beat 4 (the barline).
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(2, 1), length: frac(2, 1) })!.id
  })

  const span = (hairpinId: string) => {
    const s = hairpinSpan(score, hairpinId)!
    return `${s.startMeasure}@${fracToNumber(s.startBeat)} → ${s.endMeasure}@${fracToNumber(s.endBeat)}`
  }

  it('⭐ reaches BACK a slot and grows at the front — the end is untouched', () => {
    expect(moveHairpinStartBySlot(score, id, -1)).toBe(true)
    expect(span(id)).toBe('1@1 → 1@4')
    expect(fracToNumber(getHairpinById(score, id)!.length)).toBe(3)
  })

  it('⭐ steps IN a slot and shrinks from the front — the end is untouched again', () => {
    expect(moveHairpinStartBySlot(score, id, 1)).toBe(true)
    expect(span(id)).toBe('1@3 → 1@4')
    expect(fracToNumber(getHairpinById(score, id)!.length)).toBe(1)
  })

  it('⭐ a start reaching back across a BARLINE re-files the wedge under the bar it now begins in', () => {
    // The list a hairpin lives in IS "the wedges that start here", so crossing the line is a move
    // between two measures' lists — not a beat that quietly goes negative.
    const late = addHairpin(score, 2, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
    expect(moveHairpinStartBySlot(score, late, -1)).toBe(true)
    expect(span(late)).toBe('1@3 → 2@2')
    expect(score.measures[0].hairpins?.some(h => h.id === late)).toBe(true)
    // …and the bar it left drops the list entirely once it empties, the `removeHairpin` rule.
    expect(score.measures[1].hairpins).toBeUndefined()
  })

  it('⚠️ keeps the SAME id across that move — the selection is holding it', () => {
    const late = addHairpin(score, 2, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
    moveHairpinStartBySlot(score, late, -1)
    expect(getHairpinById(score, late)).not.toBeNull()
  })

  it('⛔ DECLINES rather than collapsing the wedge onto its own end', () => {
    moveHairpinStartBySlot(score, id, 1)          // now one slot long, 1@3 → 1@4
    expect(moveHairpinStartBySlot(score, id, 1)).toBe(false)
    expect(span(id)).toBe('1@3 → 1@4')
  })

  it('⛔ DECLINES when there is no earlier slot in its lane to reach back to', () => {
    const first = addHairpin(score, 1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1) })!.id
    expect(moveHairpinStartBySlot(score, first, -1)).toBe(false)
    expect(span(first)).toBe('1@0 → 1@1')
  })

  it('walks the STAFF — it reaches back to another voice\u2019s slot', () => {
    // Voice 1 has a note at beat 1.5, and 1.5 is simply the nearest place behind the wedge's start.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(3, 2), voice: 1 } as never)
    expect(moveHairpinStartBySlot(score, id, -1)).toBe(true)
    expect(span(id)).toBe('1@1.5 → 1@4')
  })

  it('…and a wedge NARROWED to a voice reaches the SAME slot — scope is not position', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(3, 2), voice: 1 } as never)
    const scoped = addHairpin(score, 1, { type: 'cresc', beat: frac(2, 1), length: frac(2, 1), voice: 0 })!.id
    expect(moveHairpinStartBySlot(score, scoped, -1)).toBe(true)
    expect(span(scoped)).toBe('1@1.5 → 1@4')
  })
})

/**
 * ⭐ {@link setHairpinStartAtSlot} / {@link setHairpinEndAtSlot} — the DRAG's two writes, where the
 * cursor has already chosen a slot and the op only has to land the wedge on it.
 *
 * ⚠️ The pair that matters is the reckoning: the START goes to the slot's ONSET, the END to its RIGHT
 * EDGE. Same address, two different beats, and getting the end wrong leaves the wedge stopping one
 * note short of what you pointed at — which looks like a rendering bug and is not one.
 */
describe('setHairpinStartAtSlot / setHairpinEndAtSlot — landing on a dragged-to slot', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    for (const m of [1, 2]) {
      for (const b of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: m, beat: frac(b, 1) } as never)
      }
    }
    score = model.getScore()
    id = addHairpin(score, 1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1) })!.id // 1@1 → 1@3
  })

  const span = () => {
    const s = hairpinSpan(score, id)!
    return `${s.startMeasure}@${fracToNumber(s.startBeat)} → ${s.endMeasure}@${fracToNumber(s.endBeat)}`
  }

  it('⭐ the END lands on the slot\'s RIGHT EDGE — the note you dragged onto is COVERED', () => {
    // Gould's "finish at the right-hand edge of the last note". Aiming at the onset would stop the
    // wedge one note short of the cursor, every time.
    expect(setHairpinEndAtSlot(score, id, { measure: 2, beat: frac(1, 1) })).toBe(true)
    expect(span()).toBe('1@1 → 2@2')
  })

  it('⭐ the START lands on the slot\'s ONSET, and the end does not move', () => {
    expect(setHairpinStartAtSlot(score, id, { measure: 1, beat: frac(0, 1) })).toBe(true)
    expect(span()).toBe('1@0 → 1@3')
  })

  it('drags the end BACK as readily as forward — one op, either direction', () => {
    setHairpinEndAtSlot(score, id, { measure: 2, beat: frac(3, 1) })
    expect(setHairpinEndAtSlot(score, id, { measure: 1, beat: frac(1, 1) })).toBe(true)
    expect(span()).toBe('1@1 → 1@2')
  })

  it('⛔ declines a target that would leave the wedge covering no music', () => {
    // Dragging the START onto the slot the wedge already ends on.
    expect(setHairpinStartAtSlot(score, id, { measure: 1, beat: frac(3, 1) })).toBe(false)
    expect(span()).toBe('1@1 → 1@3')
  })

  it('⛔ declines an address that is not a slot of this wedge\'s LANE', () => {
    // Between two quarters: a place the keyboard could not reach either, so the drag may not.
    expect(setHairpinEndAtSlot(score, id, { measure: 1, beat: frac(3, 2) })).toBe(false)
    // …and a bar that does not exist.
    expect(setHairpinStartAtSlot(score, id, { measure: 9, beat: frac(0, 1) })).toBe(false)
    expect(span()).toBe('1@1 → 1@3')
  })
})
