/**
 * {@link dynamicOps} — **moving a dynamic through the music**, the model write behind
 * `Ctrl+Shift+←/→` with the mark selected.
 *
 * ⭐ The claims here are the three the step can silently get wrong: it walks the mark's OWN LANE
 * (not the bar, not the score), a step over a barline RE-FILES the mark under the bar it lands in
 * with the same id, and the step DROPS the mark's SIDEWAYS nudge — which was tuned against the note
 * it is leaving (`slurOps.setSlurEndpoint`'s rule) — while KEEPING its lift, which was not.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./dynamicOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score, DynamicOffsetOverride } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { flipDynamicPlacement, moveDynamicBySlot, nextDynamicSlot, setDynamicAtSlot, setDynamicAtSlotKeepingOffset, setDynamicAtStaffSlot, setDynamicVoiceScope } from './dynamicOps'
import { setEngravingOverride } from './overrideOps'
import { dynamicOffsetOverrideOf } from './engravingOverrides'
import { levelToGlyphString } from '@/utils/dynamics'

describe('moveDynamicBySlot — the mark walks its lane', () => {
  let model: ScoreModel
  let score: Score
  let id: string

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    for (const m of [1, 2]) {
      for (const b of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: m, beat: frac(b, 1) } as never)
      }
    }
    score = model.getScore()
    id = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f') })!.id
  })

  /** Where the mark is now, as `measure@beat` — the pair every case below asserts. */
  const at = (dynamicId: string) => {
    for (const measure of score.measures) {
      const dyn = measure.dynamics?.find(d => d.id === dynamicId)
      if (dyn) return `${measure.number}@${fracToNumber(dyn.beat)}`
    }
    return 'gone'
  }

  it('⭐ steps ON to the next slot of its lane, and BACK to the previous one', () => {
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('1@3')
    expect(moveDynamicBySlot(score, id, -1)).toBe(true)
    expect(moveDynamicBySlot(score, id, -1)).toBe(true)
    expect(at(id)).toBe('1@1')
  })

  it('⭐ a step across the BARLINE re-files the mark under the bar it lands in', () => {
    // The list a dynamic lives in IS "the dynamics that happen here", so crossing the line is a
    // move between two measures' lists — not a beat that quietly runs past the bar's capacity.
    moveDynamicBySlot(score, id, 1) // 1@3, the bar's last slot
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('2@0')
    expect(score.measures[0].dynamics?.some(d => d.id === id)).toBeFalsy()
    // …and the bar it left drops the list entirely once it empties, the `removeDynamic` rule.
    expect(score.measures[0].dynamics).toBeUndefined()
  })

  it('⚠️ keeps the SAME id across that move — the selection is holding it', () => {
    moveDynamicBySlot(score, id, 1)
    moveDynamicBySlot(score, id, 1)
    expect(model.getDynamicById(id)).not.toBeNull()
    expect(at(id)).toBe('2@0')
  })

  /** A hand-nudged offset, as the arrow keys would have written it. */
  const offset = (x: number, y: number): DynamicOffsetOverride => ({ kind: 'dynamicOffset', x, y })

  it('⭐⭐ CLEARS the SIDEWAYS nudge and KEEPS the lift — two axes, two answers', () => {
    // His call, 2026-08-19. The x said "a little to the left of THAT note" and is stale the moment
    // the mark is on another one; the y said "this far off the dynamics line", which every note on
    // that line answers the same way — wiping it dropped a lift the user set on purpose.
    setEngravingOverride(score, id, offset(1.5, -2))
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(dynamicOffsetOverrideOf(score, id)).toEqual({ kind: 'dynamicOffset', x: 0, y: -2 })
  })

  it('⚠️ …and drops the override entirely when the lift was the only thing in it', () => {
    // ⛔ An absent override and a `{0,0}` one must not both be reachable — the JSON would then have
    // two spellings of "not nudged".
    setEngravingOverride(score, id, offset(1.5, 0))
    moveDynamicBySlot(score, id, 1)
    expect(dynamicOffsetOverrideOf(score, id)).toBeUndefined()
  })

  it('⛔ …and clears only the MOVED mark\'s — a neighbour keeps its own', () => {
    const other = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!.id
    setEngravingOverride(score, id, offset(1, 0))
    setEngravingOverride(score, other, offset(2, 0))
    moveDynamicBySlot(score, id, 1)
    expect(dynamicOffsetOverrideOf(score, other)?.x).toBe(2)
  })

  it('⛔ DECLINES at either end of the lane, touching nothing', () => {
    const first = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!.id
    expect(moveDynamicBySlot(score, first, -1)).toBe(false)
    expect(at(first)).toBe('1@0')

    const last = model.addDynamic(2, { beat: frac(3, 1), text: levelToGlyphString('p') })!.id
    expect(moveDynamicBySlot(score, last, 1)).toBe(false)
    expect(at(last)).toBe('2@3')
  })

  it('⛔ DECLINES for an id no longer in the score', () => {
    expect(moveDynamicBySlot(score, 'nope', 1)).toBe(false)
  })

  it('⭐⭐ walks the STAFF, in any voice — a slot in another voice IS a step it can take', () => {
    // Voice 1 has a note at beat 2.5, and 2.5 is simply the next place on this staff to stand.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('1@2.5')
  })

  it('⭐⭐ …and a mark NARROWED to a voice walks exactly the same slots', () => {
    // His call, 2026-08-19: *"a dynamic voice 2 should be able to walk even if there are no elements
    // of voice 2 in the score… voice 2 just control the reproduction"*. The scope says who gets
    // louder; it must not decide where the mark may stand.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
    const scoped = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('p'), voice: 0 })!.id
    expect(moveDynamicBySlot(score, scoped, 1)).toBe(true)
    expect(at(scoped)).toBe('1@2.5')
  })

  it('⭐⭐ …and a mark scoped to a voice with NO NOTES AT ALL still walks the staff', () => {
    // Voice 4 is empty in this score. The mark is inaudible until something is typed into it — and
    // it must still be movable, or it could never be positioned for the music it is waiting for.
    const empty = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('p'), voice: 3 })!.id
    expect(moveDynamicBySlot(score, empty, 1)).toBe(true)
    expect(at(empty)).toBe('1@3')
    expect(moveDynamicBySlot(score, empty, -1)).toBe(true)
    expect(at(empty)).toBe('1@2')
  })

  it('⚠️ one stop per ADDRESS — two voices striking a beat do not make the key press twice', () => {
    // Both voices have something at beat 3 now; the unscoped mark must still land there in ONE step
    // and leave in one, or `Ctrl+Shift+→` reads as a broken key.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 } as never)
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('1@3')
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('2@0')
  })

  it('…and a voice-2 mark sees the voice-2 slots too — they are on the same staff', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 } as never)
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 } as never)
    const inner = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p'), voice: 1 })!.id
    expect(moveDynamicBySlot(score, inner, 1)).toBe(true)
    expect(at(inner)).toBe('1@1') // ⭐ voice 0's slot, and it is a place like any other
  })

  it('leaves the owning measure\'s list sorted by beat', () => {
    model.addDynamic(2, { beat: frac(2, 1), text: levelToGlyphString('p') })
    moveDynamicBySlot(score, id, 1) // 1@3
    moveDynamicBySlot(score, id, 1) // 2@0, in front of the one already there
    expect(score.measures[1].dynamics?.map(d => fracToNumber(d.beat))).toEqual([0, 2])
  })
})

/**
 * ⭐⭐ {@link setDynamicAtSlot} — landing the mark on an address rather than counting one along,
 * and its KEEPING-OFFSET twin, which the interpolating walk crosses with.
 *
 * ⭐ The claims here are the ones an arbitrary address can break that a step cannot: one that is not
 * a slot of the mark's lane (or not in the music at all) has to be REFUSED rather than stored, and
 * one the mark is already on must answer false — a caller that repainted on a true would repaint on
 * a gesture that has not moved.
 */
describe('setDynamicAtSlot — landing the mark by address', () => {
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
    id = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f') })!.id
  })

  const at = (dynamicId: string) => {
    for (const measure of score.measures) {
      const dyn = measure.dynamics?.find(d => d.id === dynamicId)
      if (dyn) return `${measure.number}@${fracToNumber(dyn.beat)}`
    }
    return 'gone'
  }

  it('⭐ lands the mark on any slot of its lane, however far — a drag is not a step', () => {
    expect(setDynamicAtSlot(score, id, { measure: 2, beat: frac(3, 1) })).toBe(true)
    expect(at(id)).toBe('2@3')
  })

  it('⭐⭐ CLEARS the sideways nudge here, and keeps the lift', () => {
    const nudged: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 1.5, y: -2 }
    setEngravingOverride(score, id, nudged)
    setDynamicAtSlot(score, id, { measure: 1, beat: frac(3, 1) })
    expect(dynamicOffsetOverrideOf(score, id)).toEqual({ kind: 'dynamicOffset', x: 0, y: -2 })
  })

  it('⛔ REFUSES an address that is not a slot of its lane — the cursor can invent one', () => {
    expect(setDynamicAtSlot(score, id, { measure: 1, beat: frac(5, 2) })).toBe(false)   // mid-slot
    expect(setDynamicAtSlot(score, id, { measure: 99, beat: frac(0, 1) })).toBe(false)  // no such bar
    expect(at(id)).toBe('1@2')
  })

  it('⛔ …and refuses the address it is already on — a drag repaints on a true', () => {
    expect(setDynamicAtSlot(score, id, { measure: 1, beat: frac(2, 1) })).toBe(false)
  })

  it('⭐ accepts another voice’s slot — the drag reaches everything the walk does', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
    const scoped = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('p'), voice: 0 })!.id
    expect(setDynamicAtSlot(score, scoped, { measure: 1, beat: frac(5, 2) })).toBe(true)
    expect(at(scoped)).toBe('1@2.5')
  })

  it('⛔ …but still refuses a beat NO voice of the staff has a slot on', () => {
    expect(setDynamicAtSlot(score, id, { measure: 1, beat: frac(5, 2) })).toBe(false)
    expect(at(id)).toBe('1@2')
  })

  it('⭐⭐ …and its KEEPING-OFFSET twin does everything but the clear — the invisible crossing', () => {
    // The one line the interpolating walk (`interactions/dynamicWalk`) needed of its own: it hands
    // the anchor one gap forward and takes that same gap back out of the offset, so wiping the
    // offset in between would make the one press in ten that crosses jump the mark.
    const nudged: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 1.5, y: -2 }
    setEngravingOverride(score, id, nudged)
    expect(setDynamicAtSlotKeepingOffset(score, id, { measure: 1, beat: frac(3, 1) })).toBe(true)
    expect(at(id)).toBe('1@3')
    expect(dynamicOffsetOverrideOf(score, id)).toEqual(nudged)
  })

  it('⛔ …and it refuses everything the clearing one refuses', () => {
    expect(setDynamicAtSlotKeepingOffset(score, id, { measure: 1, beat: frac(5, 2) })).toBe(false)
    expect(setDynamicAtSlotKeepingOffset(score, id, { measure: 1, beat: frac(2, 1) })).toBe(false)
  })
})

/**
 * ⭐ {@link nextDynamicSlot} — where the step above WOULD land, without landing it.
 *
 * The claim is that it is the same candidate rule, asked as a question: the interpolating walk reads
 * it to measure how far the next stop is drawn before deciding whether a press re-anchors, and two
 * rules would mean the arrows and `Ctrl+Shift`+arrow landing the mark on different notes.
 */
describe('nextDynamicSlot — the stop one step away', () => {
  let model: ScoreModel
  let score: Score
  let id: string

  beforeEach(() => {
    model = new ScoreModel()
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(b, 1) } as never)
    }
    score = model.getScore()
    id = model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f') })!.id
  })

  it('⭐ names the stop the step would take, and moves NOTHING', () => {
    expect(nextDynamicSlot(score, id, 1)).toEqual({ measure: 1, beat: frac(3, 1) })
    expect(nextDynamicSlot(score, id, -1)).toEqual({ measure: 1, beat: frac(1, 1) })
    expect(score.measures[0].dynamics?.[0].beat).toEqual(frac(2, 1))
  })

  it('⛔ null at the end of the lane, and for an id no longer in the score', () => {
    const last = model.addDynamic(1, { beat: frac(3, 1), text: levelToGlyphString('p') })!.id
    expect(nextDynamicSlot(score, last, 1)).toBeNull()
    expect(nextDynamicSlot(score, 'nope', 1)).toBeNull()
  })
})

/**
 * ⭐⭐ {@link setDynamicVoiceScope} — WHICH VOICES THE MARK GOVERNS (P4 of
 * docs/dynamic-voice-scope-plan.md). The one claim that matters: `'all'` **removes** the field, so
 * the model has one spelling of "governs everything" and the JSON round trip cannot invent a second.
 */
describe('setDynamicVoiceScope', () => {
  let model: ScoreModel
  let score: Score
  let id: string

  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    id = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f') })!.id
  })

  const mark = () => score.measures[0].dynamics!.find(d => d.id === id)!

  it('narrows an unscoped mark to a voice', () => {
    expect(setDynamicVoiceScope(score, id, 2)).toBe(true)
    expect(mark().voice).toBe(2)
  })

  it('⭐ …and `all` DELETES the field rather than storing an undefined', () => {
    setDynamicVoiceScope(score, id, 2)
    expect(setDynamicVoiceScope(score, id, 'all')).toBe(true)
    expect('voice' in mark()).toBe(false)
    // …and the JSON has no trace of it either — one spelling, not two.
    expect(JSON.parse(model.toJSON()).measures[0].dynamics[0]).not.toHaveProperty('voice')
  })

  it('⛔ declines when the scope is already what is asked — a caller must not repaint on it', () => {
    expect(setDynamicVoiceScope(score, id, 'all')).toBe(false) // it starts unscoped
    setDynamicVoiceScope(score, id, 1)
    expect(setDynamicVoiceScope(score, id, 1)).toBe(false)
  })

  it('⛔ declines for an id no longer in the score', () => {
    expect(setDynamicVoiceScope(score, 'ghost', 0)).toBe(false)
  })
})

/**
 * ⭐⭐ {@link setDynamicAtStaffSlot} — **the mark lands on ANOTHER STAFF**, his report 2026-08-21:
 * dragging a dynamic down a grand staff sailed past the left hand onto the next system, because a
 * staff was not a place a mark could be put.
 *
 * The claims are what a staff change costs and what it must not: the landing slot is looked for on
 * the TARGET staff, the first staff is stored ABSENT whichever spelling arrives, the VOICE SCOPE
 * survives (scope is not position — `utils/dynamicScope`), and a frame that changes nothing is
 * refused so a drag does not repaint on every mouse move.
 */
describe('setDynamicAtStaffSlot — a staff is a place too', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  let lower: string

  beforeEach(() => {
    model = new ScoreModel()
    lower = model.addStaffBelow(0)
    score = model.getScore()
    // Beats 0 and 1 on the TOP staff; beat 0 only on the lower one, plus its rest fill.
    for (const b of [0, 1]) {
      model.addNote({ step: 'C', octave: 5, alter: 0, duration: 'q', measure: 1, beat: frac(b, 1) } as never)
    }
    model.addNote({ step: 'C', octave: 3, alter: 0, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 } as never)
    id = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f') })!.id
  })

  const mark = () => score.measures[0].dynamics!.find(d => d.id === id)!

  it('⭐⭐ hands the mark to the other staff, at the SAME address', () => {
    expect(setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })).toBe(true)
    expect(mark().staffId).toBe(lower)
    expect(fracToNumber(mark().beat)).toBe(0)
  })

  it('⭐ …and back, storing the FIRST staff as an ABSENT id — one spelling, not two', () => {
    setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })
    // The caller may name staff 0 either way; the model keeps the write convention regardless.
    expect(setDynamicAtStaffSlot(score, id, {
      measure: 1, beat: frac(0, 1), staffId: score.staves![0].id,
    })).toBe(true)
    expect('staffId' in mark()).toBe(false)
    expect(JSON.parse(model.toJSON()).measures[0].dynamics[0]).not.toHaveProperty('staffId')
  })

  it('⭐⭐ the VOICE SCOPE survives the move — scope is not position', () => {
    setDynamicVoiceScope(score, id, 2)
    setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })
    expect(mark().voice).toBe(2)
  })

  it('⭐ the landing slot is looked for on the TARGET staff, not the one it is leaving', () => {
    // Beat 1 exists on the top staff and NOT on the lower one (a half note covers the bar there).
    expect(setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(1, 1), staffId: lower })).toBe(false)
    expect('staffId' in mark()).toBe(false)
  })

  it('⭐ it is a re-anchor, so the SIDEWAYS nudge goes and the lift stays', () => {
    setEngravingOverride(score, id, { kind: 'dynamicOffset', x: 1.5, y: -2 } as DynamicOffsetOverride)
    setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: lower })
    expect(dynamicOffsetOverrideOf(score, id)).toMatchObject({ x: 0, y: -2 })
  })

  it('⛔ declines when neither the staff nor the address would change — a drag frame asks this', () => {
    expect(setDynamicAtStaffSlot(score, id, { measure: 1, beat: frac(0, 1), staffId: undefined })).toBe(false)
  })

  it('⛔ declines for an id no longer in the score', () => {
    expect(setDynamicAtStaffSlot(score, 'ghost', { measure: 1, beat: frac(0, 1), staffId: lower })).toBe(false)
  })
})

/**
 * ⭐⭐ THE OTHER LANE — his ask, 2026-08-22, the wedge's key one family over. A level and an
 * expression WORD are the same object, so one op moves either.
 */
describe('flipDynamicPlacement — above the staff ⇄ below it', () => {
  let score: Score
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
  })

  const add = (text: string) => model.addDynamic(1, { text, beat: frac(0, 1) })!.id

  it('⭐⭐ flips the side, and absent means below', () => {
    const id = add('p')
    expect(flipDynamicPlacement(score, id), 'the first flip goes up').toBe('above')
    expect(flipDynamicPlacement(score, id)).toBe('below')
    expect(flipDynamicPlacement(score, 'ghost')).toBeNull()
  })

  it('⭐ an expression WORD is the same object, and moves the same way', () => {
    const id = add('dolce')
    expect(flipDynamicPlacement(score, id)).toBe('above')
    expect(model.getDynamics(1)[0].text, '⛔ and the word is untouched').toBe('dolce')
  })

  it('⭐ …dropping the VERTICAL nudge and keeping the horizontal', () => {
    // ⚠️ The wedge's rule, and the drag's before it: a `y` measured below the staff means nothing
    //    above it, while an `x` is how far along its own beat the mark stands.
    const id = add('p')
    const offset: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 2, y: -3 }
    setEngravingOverride(score, id, offset)

    flipDynamicPlacement(score, id)

    expect(dynamicOffsetOverrideOf(score, id)).toMatchObject({ x: 2, y: 0 })
  })

  it('⛔ leaves the VOICE SCOPE alone — which voices it governs is loudness, not place', () => {
    const id = add('p')
    setDynamicVoiceScope(score, id, 1)
    flipDynamicPlacement(score, id)
    expect(model.getDynamics(1)[0].voice).toBe(1)
  })
})
