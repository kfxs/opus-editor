// @vitest-environment jsdom
/**
 * ⭐⭐ **P4c, MEASURED — Gould p. 157's ⅜ pair, rendered** (`docs/research/beam-hook-research.md` §3–§4).
 *
 * Her two bars carry the SAME three note-values and she draws them with OPPOSITE fractional beams,
 * because the semiquaver completes the second quaver in one and starts it in the other. 🚨 Before
 * P4c we drew the stub LEFT in both, and the reason was structural rather than a bad branch:
 * `lookupBeamDirection(duration, prevTick, tick, nextTick, noteIndex)` has **no beat and no metre in
 * its signature**, so the two bars are literally indistinguishable to it.
 *
 * ⭐ This is a scene-adjacent assertion of the kind `ScoreRenderer.scene.test.ts` opened up: the
 * beam's quads have been OUR ink since P4a, so their x's are real numbers in jsdom. ⛔ Note it reads
 * the FILLED paths only — `fillBeamQuad` ends in `fill()` while a stem strokes — which is the same
 * honest discrimination `FanPass.test.ts` uses.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteDuration, TimeSignature } from '@/types/music'

const xsOf = (p: Element): number[] =>
  [...(p.getAttribute('d') ?? '').matchAll(/[ML]\s*(-?[\d.]+)/g)].map(m => Number(m[1]))

interface Slot { duration: NoteDuration, dots?: number, beat: [number, number] }

/** Render one bar of one voice and report where the beam's ink landed. */
function beamInk(timeSignature: TimeSignature, slots: Slot[], override?: (m: ScoreModel, ids: string[]) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1600, 400)

  const model = new ScoreModel()
  model.getMeasure(1)!.timeSignature = timeSignature
  const ids: string[] = []
  for (const slot of slots) {
    const note = model.addNote({
      step: 'C', octave: 5, duration: slot.duration, dots: slot.dots,
      measure: 1, beat: frac(...slot.beat),
    })
    if (note) ids.push(note.id)
  }
  override?.(model, ids)
  renderer.renderScore(model.getScore())

  const stems = [...container.querySelectorAll('g.stem path')]
    .map(xsOf).filter(v => v.length).map(v => Math.min(...v))
  const quads = [...container.querySelectorAll('g.beam path')]
    .filter(p => p.getAttribute('stroke') === 'none')
    .map(xsOf).filter(v => v.length)
    .map(v => ({ lo: Math.min(...v), hi: Math.max(...v) }))
  return { stems, quads }
}

/**
 * Which way the group's one fractional beam lies. A stub is the short quad; it points LEFT when its
 * RIGHT end is the one sitting on a stem, and RIGHT when its LEFT end is.
 */
function stubSide(ink: ReturnType<typeof beamInk>): 'left' | 'right' {
  const primary = ink.quads.reduce((a, b) => (b.hi - b.lo > a.hi - a.lo ? b : a))
  const stubs = ink.quads.filter(q => q !== primary)
  expect(stubs, 'exactly one fractional beam in this fixture').toHaveLength(1)
  const stub = stubs[0]
  const near = (x: number) => Math.min(...ink.stems.map(s => Math.abs(s - x)))
  return near(stub.hi) < near(stub.lo) ? 'left' : 'right'
}

const THREE_EIGHT: TimeSignature = { numerator: 3, denominator: 8 }

describe('⭐⭐ Gould p. 157 — a fractional beam points at the beat it belongs to', () => {
  it('⅜ `♪. ♬ ♪` — the semiquaver COMPLETES the second quaver, so its beam points LEFT', () => {
    const ink = beamInk(THREE_EIGHT, [
      { duration: '8', dots: 1, beat: [0, 1] },
      { duration: '16', beat: [3, 4] },
      { duration: '8', beat: [1, 1] },
    ])
    expect(stubSide(ink)).toBe('left')
  })

  it('🚨 ⅜ `♪ ♬ ♪.` — the semiquaver STARTS the second quaver, so its beam points RIGHT', () => {
    const ink = beamInk(THREE_EIGHT, [
      { duration: '8', beat: [0, 1] },
      { duration: '16', beat: [1, 2] },
      { duration: '8', dots: 1, beat: [3, 4] },
    ])
    // ⛔ This is the assertion that failed before P4c: we drew LEFT here, as in the bar above.
    expect(stubSide(ink)).toBe('right')
  })

  it('⭐ and the two bars genuinely DIFFER — the pair is the point, not either half', () => {
    const first = stubSide(beamInk(THREE_EIGHT, [
      { duration: '8', dots: 1, beat: [0, 1] },
      { duration: '16', beat: [3, 4] },
      { duration: '8', beat: [1, 1] },
    ]))
    const second = stubSide(beamInk(THREE_EIGHT, [
      { duration: '8', beat: [0, 1] },
      { duration: '16', beat: [1, 2] },
      { duration: '8', dots: 1, beat: [3, 4] },
    ]))
    expect(first).not.toBe(second)
  })
})

describe('⚠️ what P4c did NOT change', () => {
  /**
   * Her crotchet-beat figure `♪. ♬ ♪. ♬`: each semiquaver completes its own beat, so both stubs
   * point left — which is what VexFlow already drew. ⭐ Kept as a spec because "the rule agrees with
   * the incumbent here" is exactly the claim a later reader should be able to check.
   */
  it('the crotchet-beat figure still draws both fractional beams LEFT', () => {
    const ink = beamInk({ numerator: 2, denominator: 4 }, [
      { duration: '8', dots: 1, beat: [0, 1] },
      { duration: '16', beat: [3, 4] },
      { duration: '8', dots: 1, beat: [1, 1] },
      { duration: '16', beat: [7, 4] },
    ])
    // Two separate beam groups of two, one per crotchet: a primary and a stub each.
    expect(ink.quads).toHaveLength(4)
    const stubs = ink.quads.filter(q => q.hi - q.lo < 20)
    expect(stubs).toHaveLength(2)
    for (const stub of stubs) {
      const near = (x: number) => Math.min(...ink.stems.map(s => Math.abs(s - x)))
      expect(near(stub.hi)).toBeLessThan(near(stub.lo)) // right end on the stem ⇒ points left
    }
  })
})

describe("⭐⭐ the USER's own choice beats the metric rule (his ask, 2026-09-01)", () => {
  const BAR_1: Slot[] = [
    { duration: '8', dots: 1, beat: [0, 1] },
    { duration: '16', beat: [3, 4] },
    { duration: '8', beat: [1, 1] },
  ]

  it('overriding the auto-LEFT bar to `right` flips the drawn stub', () => {
    expect(stubSide(beamInk(THREE_EIGHT, BAR_1))).toBe('left') // …and auto still says left
    const forced = beamInk(THREE_EIGHT, BAR_1, (m, ids) => m.setFractionalBeamSide(ids[1], 'right'))
    expect(stubSide(forced)).toBe('right')
  })

  it('⭐ clearing it with `null` RESTORES the metric default — ⛔ it does not freeze the picture', () => {
    const cleared = beamInk(THREE_EIGHT, BAR_1, (m, ids) => {
      m.setFractionalBeamSide(ids[1], 'right')
      m.setFractionalBeamSide(ids[1], null)
    })
    expect(stubSide(cleared)).toBe('left')
  })

  it('an override AGREEING with the rule changes nothing', () => {
    const same = beamInk(THREE_EIGHT, BAR_1, (m, ids) => m.setFractionalBeamSide(ids[1], 'left'))
    expect(stubSide(same)).toBe('left')
  })
})
