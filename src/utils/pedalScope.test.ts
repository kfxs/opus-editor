/**
 * {@link pedalScope} — the two questions a pedal's `staffId` is NOT the answer to.
 *
 * ⚠️ **What this spec pins is not the arithmetic — there is none today — it is the SEAM.** Both
 * functions currently return the attached staff, so every assertion below could be satisfied by
 * `pedal.staffId` inlined at each call site. The point is that they are *two named functions with
 * two callers*, so the day `Score.staffGroups` becomes an instrument the change lands in one file
 * and the two answers can diverge (docs/pedal-plan.md §3.2).
 *
 * ⛔ So the test that matters most here is the LAST one: neither function may normalise `undefined`
 * away, because absent-means-first-staff is the convention every caller will compare against.
 */
import { describe, it, expect } from 'vitest'
import type { Pedal } from '@/types/music'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addPedal } from '@/engine/models/pedalOps'
import { fracCreate as frac } from './fraction'
import { pedalStavesAt, pedalDrawStaff, pedalWindows, pedalWindowCovers } from './pedalScope'

const pedalOn = (staffId?: string): Pedal =>
  ({ id: 'p1', beat: frac(0, 1), length: frac(4, 1), ...(staffId !== undefined ? { staffId } : {}) })

describe('pedalScope', () => {
  it('sustains exactly the staff it is attached to — today, one instrument is one staff', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()

    expect(pedalStavesAt(score, pedalOn(lower))).toEqual([lower])
    expect(pedalStavesAt(score, pedalOn(lower))).toHaveLength(1)
  })

  it('is drawn under the staff it is attached to — §1 rule 1\'s stated limitation, not an accident', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()

    // On a two-staff score this is BETWEEN the staves rather than below the bottom one. It is
    // recorded here so the day it changes, this expectation changes with it.
    expect(pedalDrawStaff(score, pedalOn())).toBeUndefined()
    expect(pedalDrawStaff(score, pedalOn(lower))).toBe(lower)
  })

  it('⭐ does NOT resolve an absent staffId to the first staff\'s id — absence IS the first staff', () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const firstId = score.staves![0].id
    expect(firstId).toBeTruthy()

    // Resolving it would break the comparison every caller makes: a slot on the first staff carries
    // no `staffId` either, so both sides must meet as `undefined` (`utils/lanes`).
    expect(pedalStavesAt(score, pedalOn())).toEqual([undefined])
    expect(pedalStavesAt(score, pedalOn())).not.toEqual([firstId])
  })

  it('the two seams agree today, and are asked separately so they need not tomorrow', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()
    const pedal = pedalOn(lower)
    expect(pedalStavesAt(score, pedal)).toContain(pedalDrawStaff(score, pedal))
  })
})

/**
 * ⭐ The playback clock. What is asked here is the ARITHMETIC — the walk that turns a count of music
 * into an absolute onset — because the audible half (what the clamp then does with it) is
 * `engine/audio/playbackSchedule.pedal.test.ts`'s.
 */
describe('pedalWindows', () => {
  /** `n` empty 4/4 bars. */
  const bars = (n: number) => {
    const model = new ScoreModel()
    for (let i = 1; i < n; i++) model.addMeasure()
    return model
  }

  it('is empty for a score with no pedal — the whole of the un-pedalled path', () => {
    expect(pedalWindows(bars(3).getScore())).toEqual([])
  })

  it('⭐ puts a pedal on the ABSOLUTE clock, past the bars before it', () => {
    const model = bars(3)
    const score = model.getScore()
    addPedal(score, 3, { beat: frac(1, 1), length: frac(2, 1) })

    const [w] = pedalWindows(score)
    expect(w.from).toBe(9)  // 4 + 4 (two whole 4/4 bars) + beat 1
    expect(w.to).toBe(11)   // …and it holds two quarters of music
  })

  it('carries a pedal that runs past its own bar, with no clamping — the LIFT is `from + length`', () => {
    const model = bars(2)
    const score = model.getScore()
    addPedal(score, 1, { beat: frac(3, 1), length: frac(4, 1) })

    const [w] = pedalWindows(score)
    expect([w.from, w.to]).toEqual([3, 7])
  })

  it('reports every pedal, in bar order', () => {
    const model = bars(2)
    const score = model.getScore()
    addPedal(score, 2, { beat: frac(0, 1), length: frac(1, 1) })
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })

    expect(pedalWindows(score).map(w => w.from)).toEqual([0, 4])
  })

  it('⭐ RESOLVES the staff, so an absent id and the first staff\'s id are one window', () => {
    const model = bars(1)
    const lower = model.addStaffBelow(0)
    const score = model.getScore()
    const firstId = score.staves![0].id
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })              // absent → staff 0
    addPedal(score, 1, { beat: frac(1, 1), length: frac(1, 1), staffId: lower })

    const [upper, bottom] = pedalWindows(score)
    expect(upper.staves).toEqual([firstId])
    expect(bottom.staves).toEqual([lower])
  })
})

describe('pedalWindowCovers', () => {
  it('matches an absent staff id against the first staff\'s, both ways round', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()
    const firstId = score.staves![0].id
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })  // stored with NO staffId
    const [w] = pedalWindows(score)

    // The event side is absent too — which is how the first staff's notes are stored.
    expect(pedalWindowCovers(w, undefined, score)).toBe(true)
    expect(pedalWindowCovers(w, firstId, score)).toBe(true)
    expect(pedalWindowCovers(w, lower, score)).toBe(false)
  })
})
