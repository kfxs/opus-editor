// @vitest-environment jsdom
/**
 * ⭐⭐ **A BAR'S NOTE AREA MAY NOT BEGIN OUTSIDE THE BAR** — the tier-1 geometry invariant that two
 * files already cite by this filename, and which until 2026-09-01 **did not exist**.
 *
 * `spacingPadding.ts` and `ScoreRenderer.ts` both point here:
 *
 * > *"a lead-in under 1.2 spaces can only be drawn by pushing the note-start LEFT OF THE BARLINE, and
 * > then the bar's clickable area begins outside the bar (`tier1Geometry.test.ts` pins that it may
 * > not)"*
 * > *"a note area that begins outside its own bar is a bug (`tier1Geometry.test.ts`)"*
 *
 * 🚨 **Found while investigating header decision F**, whose whole argument rests on that constraint —
 * so the reasoning was leaning on a guard nobody had written. ⭐ A comment citing a spec that is not
 * there is the rot that teaches readers to stop trusting comments
 * (`reference_a_false_warning_teaches_readers_to_skip`).
 *
 * A **feature test**, in `__tests__/`, because it names no single module: the claim spans
 * `layout/spacingPadding`'s pair table, `ScoreRenderer.applyLeadIn`'s clamp and VexFlow's own
 * `Stave.padding` (`docs/test-layout-plan.md`'s rule for a test that drives several modules).
 */
import { describe, it, expect } from 'vitest'
import { NOTE_AREA_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { pairPadding } from '@/engine/layout/spacingPadding'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'

/** The note-area padding, in staff spaces — added to every note inside `getAbsoluteX`, ⛔ no setter
 *  (the inherited `Stave.padding`, `engrave/inheritedDefaults`). */
const STAVE_PADDING_SPACES = NOTE_AREA_PADDING_PX / STAFF_SPACE_PX

/** Render a mixed score and report each bar's box against where its notes may start. */
function bars(opts: { key?: boolean; smallStaff?: boolean } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(700, 900)

  const model = new ScoreModel()
  for (let i = 1; i < 12; i++) model.addMeasure()
  for (let b = 1; b <= 12; b++) {
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: b, beat: frac(0, 1) })
  }
  if (opts.key) {
    model.setKeyAt(1, { alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major' })
  }
  if (opts.smallStaff) {
    // ⭐ A second staff drawn at 0.7 — the case `applyLeadIn` divides its lead-in by, and therefore
    //   the one where a clamp could bite on one staff and not its neighbour.
    const added = model.addStaffBelow(0)
    model.setStaffSize(added, 0.7)
  }
  renderer.renderScore(model.getScore())

  const bounds = (renderer as unknown as {
    measureBounds: Map<number, { measureX: number; noteStartX: number; noteEndX: number }>
  }).measureBounds
  return [...bounds.entries()].map(([number, b]) => ({ number, ...b }))
}

describe('⭐⭐ the note area begins INSIDE its own bar', () => {
  it('the fixture really produced bars', () => {
    // ⛔ The break-test: an empty map would let every assertion below pass vacuously.
    expect(bars().length).toBeGreaterThan(4)
  })

  for (const [label, opts] of [
    ['a plain score', {}],
    ['with a key signature', { key: true }],
    ['with a small staff', { smallStaff: true }],
  ] as const) {
    it(`⭐ no bar starts its notes left of its own barline — ${label}`, () => {
      for (const bar of bars(opts)) {
        expect(bar.noteStartX, `bar ${bar.number} (${label})`).toBeGreaterThanOrEqual(bar.measureX)
        // …and the area is a real one, not a degenerate zero-width box.
        expect(bar.noteEndX, `bar ${bar.number} (${label})`).toBeGreaterThan(bar.noteStartX)
      }
    })
  }
})

describe('🚨 …and the CLAMP that guarantees it never has to bite', () => {
  /**
   * ⭐⭐ **The claim the comments actually make.** `applyLeadIn` ends in
   * `setNoteStartX(Math.max(staveX, staveX + leadIn − Stave.padding))`, and the clamp is described as
   * insurance rather than machinery: *"the pair table is chosen so this clamp does not bite — it is
   * here so that a future row which forgets the constraint fails visibly narrow rather than silently
   * wrong."*
   *
   * ⇒ that is only true while the barline's LEADING pair padding is at least VexFlow's own padding.
   * This is the assertion that fails the moment somebody lowers that row toward the treatises' 1.0 —
   * which is exactly what header decision F wanted and could not have (`header-spacing-research.md`
   * §8 F).
   */
  it('⭐ the barline\'s lead-in row is not below VexFlow\'s `Stave.padding`', () => {
    expect(pairPadding('barline', 'note')).toBeGreaterThanOrEqual(STAVE_PADDING_SPACES)
    expect(pairPadding('barline', 'rest')).toBeGreaterThanOrEqual(STAVE_PADDING_SPACES)
  })

  it('⚠️ …and that floor really is 1.2 spaces, so the row above is not comparing to zero', () => {
    // ⛔ If VexFlow ever exposed a setter, or the metric changed, this is where it surfaces — the
    //    whole of decision F's "blocked" verdict rests on this number being both real and fixed.
    expect(STAVE_PADDING_SPACES).toBeCloseTo(1.2, 6)
  })

  it('⭐ a bar with NO header clears the barline by the pair table\'s own number', () => {
    // The bars that draw no header spend `pairPadding('barline', …)` and nothing else, so their
    // lead-in IS that row — the model and the drawing saying the same thing, which is the property
    // `spacingPadding.ts` says is worth having.
    const rows = bars()
    const leftmost = Math.min(...rows.map(b => b.measureX))
    const inner = rows.filter(b => Math.abs(b.measureX - leftmost) > 0.001)
    expect(inner.length).toBeGreaterThan(0)
    for (const bar of inner) {
      const leadIn = (bar.noteStartX - bar.measureX) / STAFF_SPACE_PX
      expect(leadIn, `bar ${bar.number}`).toBeCloseTo(pairPadding('barline', 'note'), 6)
    }
  })
})
