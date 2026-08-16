import { describe, it, expect } from 'vitest'
import { slurAttachmentYs, slurAttachments, type SlurAttachment } from './slurStemEndpoint'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ **Gould p. 111's rule, on the two faults it was written for.**
 *
 * ⚠️ **Headless is the right home for THIS half** — and the plan said otherwise until §12.0 #1. What
 * jsdom cannot do is MEASURE a glyph, so it cannot tell us where a stem tip landed; here the tips
 * are handed in as numbers, and what is under test is the arithmetic that turns them into two
 * endpoints. The other half — that VexFlow really does resolve these stems this way, and that the
 * drawn arc really does tilt with the melody — is `e2e/slur.e2e.ts`, and it has to be.
 *
 * Coordinates below are pixels with y growing DOWN, one staff space = 10 px, laid out so each case
 * reads as music: a step is 5 px, a tenth is 45 px, a stem is 35 px.
 */
const SP = STAFF_SPACE_PX
const STEM = 3.5 * SP
/** Half a Bravura notehead, the distance from the anchor (its CENTRE) out to the stem's edge. */
const HALF_HEAD = 0.59 * SP

/** A note with an up stem (tip above the head) — low notes, in treble. */
const up = (headY: number): SlurAttachment =>
  ({ headY, stemTipY: headY - STEM, stemDirection: 1, headHalfWidth: HALF_HEAD })
/** A note with a down stem (tip below the head) — high notes. */
const down = (headY: number): SlurAttachment =>
  ({ headY, stemTipY: headY + STEM, stemDirection: -1, headHalfWidth: HALF_HEAD })

const ABOVE = -1
const BELOW = 1

describe('slurAttachmentYs — opposite stems, the slid endpoint', () => {
  it('⭐⭐ a rising STEP no longer descends 3 staff spaces', () => {
    // A4 → B4 across the middle line: A4 stem up, B4 stem down, so the slur goes ABOVE and A4 is
    // the end on the stem side. The old attachment put it at the stem tip, 30 px above B4's head.
    const a4 = up(105), b4 = down(100)   // A4 sits half a space BELOW B4
    const { fromY, toY } = slurAttachmentYs(a4, b4, ABOVE)

    expect(fromY).toBeCloseTo(105 - 2.5, 6)  // 0.25 sp above its own notehead
    expect(toY).toBe(100)                    // the notehead side is untouched
    expect(fromY - toY, 'the slur RISES with the melody').toBeGreaterThan(0)
    expect(fromY - toY).toBeCloseTo(2.5, 6)  // …by half the interval
    // The fault, stated as the test that would have failed: the stem tip is 30 px above B4's head.
    expect(a4.stemTipY! - toY).toBeCloseTo(-30, 6)
  })

  it('⭐ a rising TENTH rises 2.25 sp, not 1', () => {
    const c4 = up(150), e5 = down(105)       // 4.5 sp apart
    const { fromY, toY } = slurAttachmentYs(c4, e5, ABOVE)

    expect(fromY).toBeCloseTo(150 - 22.5, 6)
    expect(fromY - toY).toBeCloseTo(22.5, 6) // was 10 px, attaching at the tip
  })

  it('a DESCENDING step tilts down, by half the interval', () => {
    // The mirror of the first case: the slur used to RISE 3 sp under a falling melody.
    const b4 = down(100), a4 = up(105)
    const { fromY, toY } = slurAttachmentYs(b4, a4, ABOVE)

    expect(fromY).toBe(100)
    expect(toY).toBeCloseTo(105 - 2.5, 6)
    expect(toY - fromY, 'the slur DESCENDS with the melody').toBeGreaterThan(0)
  })

  it('slides the BELOW-side end down its own stem, the same way', () => {
    // Slur below with opposite stems: the stem-side end is the one whose stem points DOWN.
    const high = down(100), low = up(140)
    const { fromY, toY } = slurAttachmentYs(high, low, BELOW)

    expect(fromY).toBeCloseTo(100 + 20, 6)   // half of the 40 px interval, below its head
    expect(toY).toBe(140)
  })

  it('never travels further than the stem reaches plus one space', () => {
    // A leap of 10 sp wants 5 sp of travel; the stem reaches 3.5 and may be overshot by 1.
    const low = up(200), high = down(100)
    const { fromY } = slurAttachmentYs(low, high, ABOVE)

    expect(fromY).toBeCloseTo(200 - (STEM + SP), 6)
  })
})

describe('slurAttachmentYs — the cases it must leave alone', () => {
  it('attaches at the stem END when both stems agree', () => {
    // Two stem-up notes with the slur forced above (a flip, or the multi-voice rule): both ends are
    // on the stem side, the stems do not oppose, so nothing slides. Gould's condition is not met —
    // and the line between two tips already parallels the line between the two heads.
    const a = up(120), b = up(100)
    const { fromY, toY } = slurAttachmentYs(a, b, ABOVE)

    expect(fromY).toBe(a.stemTipY)
    expect(toY).toBe(b.stemTipY)
  })

  it('attaches at the noteheads when the slur is on the notehead side', () => {
    const a = up(120), b = up(100)
    const { fromY, toY } = slurAttachmentYs(a, b, BELOW)

    expect(fromY).toBe(120)
    expect(toY).toBe(100)
  })

  it('falls back to the notehead for a note that draws no stem', () => {
    // A whole note: `NoteBuilder` still gives it a stem DIRECTION (which is what placed the slur),
    // but there is no tip to climb, so the head is the attachment.
    const whole: SlurAttachment = { headY: 105, stemDirection: 1, headHalfWidth: HALF_HEAD }
    const { fromY, toY } = slurAttachmentYs(whole, down(100), ABOVE)

    expect(fromY).toBe(105)
    expect(toY).toBe(100)
  })

  it('leaves a UNISON flat — half of nothing is nothing', () => {
    const { fromY, toY } = slurAttachmentYs(up(100), down(100), ABOVE)
    expect(fromY).toBe(100)
    expect(toY).toBe(100)
  })
})

describe('slurAttachments — the sideways clearance (§12.1)', () => {
  const LIFT = 1.0 * SP

  it('⭐⭐ steps the START past an up stem it would otherwise leave from the middle of', () => {
    // His report: the arc left from ON the stem. LilyPond 0.3 sp, MuseScore 0.35 — we take 0.35.
    // ⭐ The dx is measured from the ANCHOR, which is the head's CENTRE (§12 Phase 2): out to the
    // edge the stem stands on, then 0.35 sp clear of it.
    const { from, to } = slurAttachments(up(105), down(100), ABOVE, LIFT)
    expect(from.dx).toBeCloseTo(HALF_HEAD + 0.35 * SP, 6)
    expect(to.dx, 'the notehead-side end has no stem in its way').toBe(0)
  })

  it('steps the END past a DOWN stem, the mirror case', () => {
    // Slur BELOW ending on a down-stem note: the stem hangs where the arc lands, so it steps LEFT.
    const { from, to } = slurAttachments(up(100), down(140), BELOW, LIFT)
    expect(to.dx).toBeCloseTo(-(HALF_HEAD + 0.35 * SP), 6)
    expect(from.dx).toBe(0)
  })

  it('⛔ …and a DOWN stem at the START is not in the way at all', () => {
    // ⭐ The asymmetry is geometry, not a special case: the arc STARTS at the head's right edge,
    // where an UP stem stands, and ENDS at its left edge, where a DOWN stem hangs. A down stem at
    // the start is a whole notehead away from the tip. MuseScore's two conditions say exactly this
    // (`sc->up() && item->up()` vs `!ec->up() && !item->up()`).
    const { from } = slurAttachments(down(100), up(140), BELOW, LIFT)
    expect(from.dx).toBe(0)
  })

  it('⛔ leaves an endpoint ABOVE the stem tip alone — there is nothing to clear', () => {
    // Two agreeing up stems with the slur above: the attachment is the stem END, and the arc's lift
    // carries it past the tip. LilyPond only dodges when the endpoint falls INSIDE the stem's band.
    const { from, to } = slurAttachments(up(120), up(100), ABOVE, LIFT)
    expect(from.dx).toBe(0)
    expect(to.dx).toBe(0)
  })

  it('⛔ leaves a stemless note alone, and still reports its y', () => {
    const whole: SlurAttachment = { headY: 105, stemDirection: 1, headHalfWidth: HALF_HEAD }
    const { from } = slurAttachments(whole, down(100), ABOVE, LIFT)
    expect(from.dx).toBe(0)
    expect(from.y).toBe(105)
  })

  it('carries the same Ys as the y-only rule — the two halves are independent', () => {
    const a = up(105), b = down(100)
    const ys = slurAttachmentYs(a, b, ABOVE)
    const both = slurAttachments(a, b, ABOVE, LIFT)
    expect(both.from.y).toBe(ys.fromY)
    expect(both.to.y).toBe(ys.toY)
  })
})
