/**
 * ⭐⭐ **THE TEMPO MARK JOINS THE LADDER** — the post-measure pass that moves every tempo mark off
 * VexFlow's fixed rung and onto the row its own music leaves free.
 *
 * P0b of docs/ottava-plan.md, and the last of the four outside-staff families to stop having a
 * private vertical rule. What it replaces is one line in `./TempoLayout`:
 * `const y = stave.getYForTopText(1)` — a CONSTANT (a baseline 2 staff spaces above the top line,
 * `topTextPosition` 1) that knows nothing about ledger lines, a dynamic above the staff, a trill, or
 * an 8va bracket. It survived this long because tempo marks usually sit at bar 1 beat 0 where little
 * rises above the staff; it could already collide, and under an ottava it always would.
 *
 * ## ⭐ Why a TRANSLATE and not a placement — the decision P0b turned on
 *
 * The mark stays where `drawTempoMarks` drew it, inside its measure's group, and this pass moves it
 * afterwards. The alternative — computing the y at draw time — puts a SYSTEM-scope fact into a
 * measure-scope answer, and `rendering/MeasureRedrawKey.ts` is what makes that expensive: a bar's
 * cached `<g>` is reused whenever its own shape key is unchanged, so a y that depends on a trill two
 * bars away would have to join that key, and every bar of a system would re-engrave whenever one
 * note moved. That arrangement was measured at **53% of all render time** and refused once already,
 * which is why `dynamicsLinePass` exists in exactly this shape. This is its twin.
 *
 * ⚠️ **So it runs over EVERY measure, drawn or reused** — and the reused ones are the point. A mark's
 * y is a fact about its system; the bar whose row changed is usually not the bar that was edited.
 * That is only safe because the write is IDEMPOTENT (see {@link placeTempoMark}): the contribution
 * is kept on the element and SET, never added, so a mark already on its row is left alone rather
 * than moved twice.
 *
 * ## What it reads
 *
 * Two bands, merged: the MUSIC's ink over the mark's stretch of bar (`layout/inkBand`), and whatever
 * the families placed before it have already claimed there (`layout/outsideStaffBand` — the trill and
 * the dynamics line, filed as they were placed). ⭐ That merge IS the ladder; there is no priority
 * table, and the order is the order the passes run in — which is why this one is wired in **after**
 * `renderTrills`, the last producer.
 *
 * ⛔ It does not look at pixels. See {@link tempoScope} for the one place that costs something.
 */
import type { Stave } from 'vexflow'
import type { Fraction, Measure, TempoMark } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand } from '@/engine/layout/inkBand'
import { bandOver, measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracAdd } from '@/utils/fraction'
import { TEMPO_LINE, TEMPO_MARK_INK } from './tempoStyle'
import { drawnTextOrigin, firstDrawnText } from './drawnText'
import { staffSpacesToPixels } from './staffSpace'
import type { RenderPass } from './RenderPass'

/** What the pass needs of a `MeasurePlacement` — declared structurally, the shape the dynamics and
 *  trill passes already use, so the renderer that calls this is not imported back by it. */
export interface TempoLinePlacement {
  /** This staff's own lane of the measure. `tempos` is system-level, so it is the same array on
   *  every staff's view — which is why only staff 0's placement is ever used. */
  view: Measure
  measureNumber: number
  staffIndex: number
  /** Which system it is on: the scope of one row. */
  line: number
  /** The measure's merged columns, shared by every staff of it. */
  system: { columns: Column[] }
  stave: Stave
  scale: number
}

/** The tempo line's own contribution to the group's transform, in local px. */
const LINE_ATTR = 'data-tempo-line'

/**
 * ⭐ **THE MARK'S STRETCH OF MUSIC: from its own beat to the END of its bar.**
 *
 * ⚠️ **Wider than a dynamic's scope, and the difference is deliberate.** A `p` is a glyph two spaces
 * wide, so `columnsUnder` — the one column it stands over — is honestly all it covers. A tempo mark
 * is a SENTENCE (`Allegro con brio (♩ = 132)`) and routinely runs over several beats of music, so
 * clearing only its own column would let a high note two beats along come up through the middle of
 * the words.
 *
 * ⛔ **The honest answer is the mark's measured WIDTH**, which is what LilyPond's skyline uses — and
 * it is not available where it would have to be: the width is a font measurement (0 in jsdom) and
 * turning it into a beat range needs the solved column x's and the staff's scale. So this is the
 * musical approximation, and it errs the safe way: clearing too much moves the outermost family
 * further out, which is never a collision, whereas clearing too little is the bug being fixed.
 *
 * ⚠️ It stops at the BARLINE. A mark whose text genuinely overhangs into the next bar reads that
 * bar's ink not at all — the first thing to fix if his eye finds a case.
 */
function tempoScope(view: Measure, mark: TempoMark): { from: Fraction; to: Fraction } {
  return { from: mark.beat, to: measureCapacityFrac(view) }
}

/**
 * Put every tempo mark of every system onto its row.
 *
 * Pure no-op without a DOM (the marks have no `<text>` to read a baseline from), like every other
 * pass that repositions rendered SVG.
 */
export function placeTempoMarksOnLine(
  pass: RenderPass,
  placements: readonly TempoLinePlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  const svg = pass.context?.svg as SVGSVGElement | undefined
  if (!svg) return

  const starts = measureStartOffsets(pass.score)

  for (const placement of placements) {
    // A mark governs the CLOCK, not a staff, so it is engraved once per system above the top staff —
    // `drawTempoMarks`' own rule, and this must agree with it or a grand staff moves a mark that was
    // never drawn (and leaves the drawn one on the fixed rung).
    if (placement.staffIndex !== 0) continue
    const tempos = placement.view.tempos
    if (!tempos?.length) continue

    const measureStart = starts.get(placement.measureNumber)
    if (measureStart === undefined) continue

    pass.elementRegistry.withScale(placement.scale, () => {
      for (const mark of tempos) {
        if (mark.id === pass.suppressedTempoId) continue // drawn by the text overlay instead
        if (!mark.text) continue // nothing printed (a mark that only sounds)

        // Scoped to THIS render's root, not `document`: ids repeat across a torn-down SVG, and a
        // document-wide lookup answers with the first in tree order
        // (`reference_vexflow_getsvgelement_is_document_wide`).
        const el = svg.querySelector(`#vf-${mark.id}`) as SVGGraphicsElement | null
        // ⭐ Read off the `<text>`'s own baseline, not its bbox — the runs are laid left to right at
        //   one baseline, and the bbox of `Allegro` and of `Allegro (♩ = 120)` differ while the
        //   baseline does not. It is also the quantity the row is stated in.
        //   ⚠️ Through `./drawnText`, never off the attribute: a missing `y` means ZERO, not "not
        //   drawn" (see that module — it was a live bug in the dynamics pass next door).
        const origin = drawnTextOrigin(firstDrawnText(el))
        if (!el || !origin) continue
        const drawn = origin.y

        const { from, to } = tempoScope(placement.view, mark)
        const music = staffInkBand(
          columnsBetween(placement.system.columns, from, to), staffIds[0], staffIds[0])
        // ⭐ …and what the inner families already took there. THIS is the ladder.
        const taken = bandOver(
          pass.occupiedBands, placement.line, staffIds[0], 'above',
          fracAdd(measureStart, from), fracAdd(measureStart, to), staffIds[0])

        const baseline = clearanceBaseline(
          mergeInkBands(music, taken), 'above', TEMPO_MARK_INK, TEMPO_LINE)

        // ⚠️ Both sides in the STAVE's own coordinates, which is what makes this correct for a
        //    measure that merely MOVED: its stave and its ink keep the coordinates they were drawn
        //    at, and the group's transform carries them to the new place together.
        const target = placement.stave.getYForLine(0) + staffSpacesToPixels(baseline, placement.stave)
        placeTempoMark(pass, mark.id, el, target - drawn)
      }
    })
  }
}

/**
 * Move one mark onto its row, and move its registry box by the CHANGE.
 *
 * ⭐ **SET, never add** — `dynamicMarkTransform`'s rule, for its reason. This pass runs over measures
 * nobody re-engraved, whose group still carries the last render's transform; prepend or accumulate
 * there and the mark walks up the page one row's worth per keystroke, with the hit-box walking with
 * it. Keeping the contribution on the ELEMENT is what survives a render the node took no part in.
 *
 * The tempo mark has exactly ONE contribution (unlike a dynamic's three), so the stored component
 * and the written transform are the same number.
 */
export function placeTempoMark(
  pass: RenderPass,
  id: string,
  el: SVGGraphicsElement,
  line: number,
): void {
  const was = Number(el.getAttribute(LINE_ATTR))
  const previous = Number.isFinite(was) ? was : 0
  el.setAttribute(LINE_ATTR, `${line}`)
  el.setAttribute('transform', `translate(0, ${line})`)
  pass.elementRegistry.shiftById(id, 0, line - previous)
}
