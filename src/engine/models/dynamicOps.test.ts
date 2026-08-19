/**
 * {@link dynamicOps} — **moving a dynamic through the music**, the model write behind
 * `Ctrl+Shift+←/→` with the mark selected.
 *
 * ⭐ The claims here are the three the step can silently get wrong: it walks the mark's OWN LANE
 * (not the bar, not the score), a step over a barline RE-FILES the mark under the bar it lands in
 * with the same id, and the step DROPS the mark's hand-nudged offset — which was tuned against the
 * note it is leaving (`slurOps.setSlurEndpoint`'s rule).
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./dynamicOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score, DynamicOffsetOverride } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { moveDynamicBySlot, nextDynamicSlot, setDynamicAtSlot, setDynamicAtSlotKeepingOffset } from './dynamicOps'
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

  it('⭐⭐ CLEARS the mark\'s own nudge — the offset answered the note it is leaving', () => {
    setEngravingOverride(score, id, offset(1.5, -2))
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
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

  it('⭐ walks its OWN LANE — a slot in another voice is not a step it can take', () => {
    // Voice 1 has a note at beat 2.5; the voice-0 mark must step over it to beat 3.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
    expect(moveDynamicBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('1@3')
  })

  it('…and a mark IN that voice walks the voice-1 slots instead', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 } as never)
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 } as never)
    const inner = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p'), voice: 1 })!.id
    expect(moveDynamicBySlot(score, inner, 1)).toBe(true)
    expect(at(inner)).toBe('1@2') // ⛔ not 1@1, which is only a stop for voice 0
  })

  it('leaves the owning measure\'s list sorted by beat', () => {
    model.addDynamic(2, { beat: frac(2, 1), text: levelToGlyphString('p') })
    moveDynamicBySlot(score, id, 1) // 1@3
    moveDynamicBySlot(score, id, 1) // 2@0, in front of the one already there
    expect(score.measures[1].dynamics?.map(d => fracToNumber(d.beat))).toEqual([0, 2])
  })
})

/**
 * ⭐⭐ {@link setDynamicAtSlot} — the write BOTH doors run through: the keyboard's step, and the
 * mouse drag, which finds a slot from the cursor instead of counting one along.
 *
 * ⭐ The claims here are the ones a drag can break that a step cannot: an address the cursor
 * invented (off the lane, or off the music entirely) has to be REFUSED rather than stored, and a
 * frame that lands on the mark's current address must answer false — a drag repaints on a true, so a
 * yes for "nothing changed" is a repaint per mouse move.
 */
describe('setDynamicAtSlot — the drag\'s write', () => {
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

  it('⭐⭐ CLEARS the nudge here, so the drag cannot keep an offset the keyboard drops', () => {
    const nudged: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 1.5, y: -2 }
    setEngravingOverride(score, id, nudged)
    setDynamicAtSlot(score, id, { measure: 1, beat: frac(3, 1) })
    expect(dynamicOffsetOverrideOf(score, id)).toBeUndefined()
  })

  it('⛔ REFUSES an address that is not a slot of its lane — the cursor can invent one', () => {
    expect(setDynamicAtSlot(score, id, { measure: 1, beat: frac(5, 2) })).toBe(false)   // mid-slot
    expect(setDynamicAtSlot(score, id, { measure: 99, beat: frac(0, 1) })).toBe(false)  // no such bar
    expect(at(id)).toBe('1@2')
  })

  it('⛔ …and refuses the address it is already on — a drag repaints on a true', () => {
    expect(setDynamicAtSlot(score, id, { measure: 1, beat: frac(2, 1) })).toBe(false)
  })

  it('⛔ refuses a slot in ANOTHER VOICE, so the drag cannot reach what the walk cannot', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
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
