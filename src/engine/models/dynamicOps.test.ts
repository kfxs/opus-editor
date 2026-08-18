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
import { moveDynamicBySlot } from './dynamicOps'
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
