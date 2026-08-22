/**
 * ⭐⭐ **A GESTURE DRAWS ONLY THE FAMILY THAT IS MOVING** — docs/render-performance-plan.md §12.5a,
 * his own proposal: *"why do we have to render the whole score? Why not just render that element?"*
 *
 * ## Why this exists, in one measured number
 *
 * A mark drag re-derived the WHOLE SCORE on every mouse frame to move one glyph. The census
 * (§12.7) found no hotspot to attack: eight whole-score regions, the largest 20%, and
 * `measuresRedrawn` reporting **0%** the whole time — the music never changed, so not one bar was
 * re-engraved, and the ~11 ms went entirely on re-deriving what was already on screen. ⛔ Optimising
 * the biggest region caps out at a fifth. The only thing that removes all eight is not running them.
 *
 * ## Why a FAMILY and not one mark
 *
 * The obvious shape — "redraw the dragged ottava" — would need a filter parameter on every family's
 * renderer, which is CLAUDE.md's "a slice too thin to be logic is still a slice" six times over. A
 * family redraws whole instead, and needs **no change to any renderer**: a score carries one or two
 * ottavas, so drawing all of them costs what drawing one would.
 *
 * ## 🚨 What makes this hard, and it is not the drawing
 *
 * `renderScore` is a **sequential accumulation**, so re-running one pass in the middle of it is not
 * idempotent by default. A preview is therefore a take-down and a redraw, never a redraw:
 *
 *  1. **the family's `<g>`s come out of the DOM**, or every frame leaves another copy behind;
 *  2. **its rows come out of the element registry** (`removeByType`, which exists for this shape of
 *     problem), or every frame leaves another hit-box and a click lands on a stale one;
 *  3. **then it is drawn again**, from placements the base render already worked out.
 *
 * ⭐ **The LADDER needs no rewind, and this was worth checking rather than assuming.** The first
 * version of this module carefully restored `occupiedBands` to a captured high-water mark, on the
 * reasoning that a family re-drawn would claim its rung twice. It would not: the claim is filed by
 * `planOttavaBands`, which a preview never calls, and `OttavaRenderer` says so in as many words —
 * *"⛔ `drawOttava` must not push a second one; two claims for one fragment drift everything outside
 * it."* ⛔ The rewind was removed once a break-test showed no spec could fail without it. Dead
 * defensive code in a file like this is not free: it teaches the next reader that the hazard is real.
 *
 * ⚠️ **What IS true is that a preview does not restack the ladder** — a pedal that ought to move out
 * of a rising bracket's way will not, because its pass does not run. That is precisely the
 * approximation §12.5 signed off on, and why the drop must still do a full render.
 *
 * ⛔ **The cheap picture must never be left standing.** Every gesture that begins a preview owes a
 * real `renderScore()` on release; `commitPreviewed` is where that rule already lives.
 */
import type { Score } from '@/types/music'
import type { ElementType } from '@/engine/ElementRegistry'
// ⚠️ TYPE-ONLY, and it must stay that way: `VexFlowRenderer` imports this module, so a value import
// here would close a runtime cycle. A type import is erased entirely.
import type { MeasurePlacement } from './VexFlowRenderer'
import type { RenderPass } from './RenderPass'
import { planOttavaBands, renderOttavas } from './OttavaRenderer'
import { renderPedals } from './PedalRenderer'
import { planTrillBands, renderTrills } from './TrillRenderer'
import { renderHairpins } from './HairpinRenderer'
import { renderSlurs } from './SlurRenderer'
import { planDynamicsLines } from './dynamicsLinePlan'
import { MARK_INK } from './dynamicsLinePass'
import { applyTempoNudges } from './tempoNudgePass'
import { dbg } from '@/utils/debug'
import { fracToNumber } from '@/utils/fraction'
import { placeTempoMarksOnLine } from './tempoLinePass'

/**
 * Everything a preview needs off the LAST FULL RENDER — none of which the gesture changes.
 *
 * ⭐ That invariance is the licence for the whole feature: a mark's offset takes no horizontal space,
 * so the columns, the casting-off, every bar's `<g>` and therefore every `MeasurePlacement` are
 * bit-identical from frame to frame. ⚠️ Anything that WOULD move them — a note edit, a width drag —
 * must not use a preview; those gestures redraw for real and the census says so (`redrawn %` is 9–13%
 * on them, and 0% on every mark gesture).
 */
export interface RenderSnapshot {
  score: Score
  pass: RenderPass
  placements: readonly MeasurePlacement[]
  staffIds: readonly (string | undefined)[]
  /**
   * The world each family's pass was ENTERED with — its rewind point. Restored before a preview, so
   * the pass runs against the same state it did the first time.
   */
  before: Record<MarkPreviewKind, PassEntry>
}

/**
 * What a family's pass found when `renderScore` called it: the append-only collections' lengths, and
 * the drawing context's ambient state.
 *
 * ⭐ `bands` is load-bearing and break-tested: `drawPedal` files the pedal's ladder claim during the
 * DRAW, where its siblings file theirs during their PLAN, which a preview never calls. Delete the
 * rewind and the pedal is pushed outside its own previous claim once per frame, walking down the page
 * under a held mouse.
 *
 * ⚠️ `curves` is the same hazard and is NOT currently observable — `renderSlurs` demonstrably appends
 * to `drawnCurves`, but the only reader is `planTrillBands`, which a preview never runs, so the
 * duplicates change no picture today. ⛔ It is kept, unlike the ottava rewind this module used to
 * carry, and the distinction is the point: that one guarded a hazard that did not exist (the claim
 * was filed by a pass a preview never calls), this one guards a real append that is merely unread. A
 * rewind of a collection that is genuinely appended to is one line of a mechanism already required.
 *
 * 🚨🚨 **And the CONTEXT state is load-bearing for all of them.** VexFlow's `SVGContext` is stateful:
 * a pass inherits the stroke width, font and style the previous pass left behind, and none of them
 * sets everything it relies on. Re-running one pass out of order therefore draws the right shape with
 * the wrong ink — measured as `stroke-width="1.6"` where the render had produced `1.3`, on a bracket
 * nothing had changed. ⛔ It is not enough to rewind the collections.
 *
 * ⚠️⚠️ **The two are captured at DIFFERENT MOMENTS, and that is not tidiness.** A family's PLAN and its
 * DRAW are far apart in `renderScore` — every plan runs before every draw. The collections must rewind
 * to the plan's moment, because that is where the ladder claim is filed; the context must be restored
 * to the DRAW's moment, because that is the ink the drawing inherited. Capture both at one point and
 * one of them is wrong: taking the context from plan-time redrew the ottava in the trill's ink.
 */
export interface PassEntry {
  /** At the family's PLAN — where the ladder claim is filed. */
  bands: number
  curves: number
  /** At the family's DRAW. Shallow copies: `SVGContext` mutates these plain objects in place. */
  state: Record<string, unknown>
  attributes: Record<string, unknown>
}

/**
 * The families a gesture may preview — ⭐ one ROW each in {@link MARK_PREVIEW_FAMILIES}, per
 * CLAUDE.md, never a `case`.
 *
 * 🚨🚨 **A FAMILY RE-PLANS, IT DOES NOT REUSE A PLAN — and that cost a round of broken gestures.**
 * The first version handed each renderer the plan captured with the base render. He tried it: *"for
 * ottava and pedal it is working good, but for hairpin and trill it is breaking things"* — the wedge
 * vanished the instant a drag carried it across staves and stayed gone until the drop.
 *
 * ⭐ **The difference is one `??`, and it is proven rather than argued.** Both families look their
 * baseline up in a plan keyed by *(mark, line)*, and a drag onto another staff invalidates that key.
 * The ottava recovers — `bands.get(...) ?? baselineFor(...)` (`OttavaRenderer.ts:517`) — and the
 * hairpin gives up: `if (baseline === undefined) continue` (`HairpinRenderer.ts:584`). One computes,
 * the other skips, and the skipped mark is a hole on screen for the rest of the gesture.
 *
 * ⛔ So a captured plan is not a shortcut, it is a stale answer to *"where does this mark go?"* —
 * which is precisely the question a drag is changing. Each row below re-runs its own plan and then
 * draws, which is still two passes instead of the render's eight.
 *
 * ⚠️ Tempo, dynamics and expression are a different shape again — their ink is drawn *inside the
 * measure group* (`tempoLinePass.ts`: *"the mark stays where `drawTempoMarks` drew it, inside its
 * measure's group, and this pass moves it afterwards"*), which is why the census shows 0.8–1.7% of
 * bars re-engraved on their drags where every family here shows **0%**.
 */
export type MarkPreviewKind = 'ottava' | 'pedal' | 'trill' | 'hairpin' | 'slur' | 'tempo'

interface MarkPreviewFamily {
  /**
   * ⭐ What a REDRAWN family owns and must take down first — its registry rows and its drawn `<g>`s,
   * by mark id. ⛔ **Absent for a MOVED family**, and that is not an omission: a tempo mark's ink is
   * drawn *inside its measure's group* and repositioned afterwards by an idempotent transform
   * (`./tempoMarkTransform`), so there is no group of its own to remove and its registry box is
   * MOVED by the writer rather than re-added. Take it down and nothing puts it back.
   */
  redrawn?: {
    registryType: ElementType
    groups(pass: RenderPass): Map<string, SVGGElement>
  }
  /**
   * Re-PLAN and re-draw (or re-place) the whole family, exactly as `renderScore` does.
   * ⛔ No filter, and ⛔ no captured plan: see the header for what each of those cost.
   */
  draw(snapshot: RenderSnapshot): void
  /**
   * ⛔ **Proof this frame actually placed the mark the gesture named** — the refusal below turns on
   * it. A redrawn family asks its own group map; a moved one asks the registry, because the box is
   * the only thing it writes.
   */
  placed(pass: RenderPass, markId: string): boolean
}

export const MARK_PREVIEW_FAMILIES: Record<MarkPreviewKind, MarkPreviewFamily> = {
  ottava: {
    redrawn: { registryType: 'ottava', groups: pass => pass.ottavaGroupMap },
    placed: (pass, id) => pass.ottavaGroupMap.has(id),
    draw: ({ pass, score, placements, staffIds }) =>
      renderOttavas(pass, score, placements, staffIds,
        planOttavaBands(pass, score, placements, staffIds)),
  },
  pedal: {
    // ⭐ No plan of its own: `renderPedals` works its baseline out at draw time, which is why this
    //   family never had the bug the header describes.
    redrawn: { registryType: 'pedal', groups: pass => pass.pedalGroupMap },
    placed: (pass, id) => pass.pedalGroupMap.has(id),
    draw: ({ pass, score, placements, staffIds }) =>
      renderPedals(pass, score, placements, staffIds),
  },
  trill: {
    redrawn: { registryType: 'trill', groups: pass => pass.trillGroupMap },
    placed: (pass, id) => pass.trillGroupMap.has(id),
    draw: ({ pass, score, placements, staffIds }) =>
      renderTrills(pass, score, placements, staffIds,
        planTrillBands(pass, score, placements, staffIds)),
  },
  hairpin: {
    // ⚠️ Its plan is the DYNAMICS line's — a wedge is a member of that family and asks it for the
    //    same baseline the letters get (`dynamicsLinePlan`).
    redrawn: { registryType: 'hairpin', groups: pass => pass.hairpinGroupMap },
    placed: (pass, id) => pass.hairpinGroupMap.has(id),
    draw: ({ pass, score, placements, staffIds }) =>
      renderHairpins(pass, score, placements,
        planDynamicsLines(score, placements, staffIds, MARK_INK, pass.occupiedBands)),
  },
  slur: {
    // ⭐ No plan either: a curve is solved from its own anchors.
    redrawn: { registryType: 'slur', groups: pass => pass.slurGroupMap },
    placed: (pass, id) => pass.slurGroupMap.has(id),
    draw: ({ pass, score }) => renderSlurs(pass, score),
  },
  /**
   * ⭐⭐ **THE ONE FAMILY THAT IS MOVED RATHER THAN REDRAWN**, and the row is the whole difference.
   *
   * A tempo mark's glyph is drawn *inside its measure's group* by `TempoLayout.drawTempoMarks`, and
   * two later passes reposition it through one idempotent composed transform
   * (`./tempoMarkTransform`: the components live on the element, every write recomposes). So there
   * is no `<g>` of its own to take down and no registry row to remove — the box is MOVED by the
   * writer, and removing it would leave nothing to move.
   *
   * ⭐ Both passes below are the same calls `renderScore` makes, in the same order, and both are
   * idempotent by construction — `tempoLinePass` already runs over every measure *drawn or reused*
   * on every render, which is that property stated as a requirement.
   *
   * ⚠️ **The NUDGE pass is the one a preview cannot do without.** Its only other writer is inside the
   * bar draw, which a preview skips, so without it the mark would follow the hand down the ladder and
   * refuse to follow it sideways (`./tempoNudgePass`).
   */
  tempo: {
    // 🚨🚨 **IS THE GLYPH IN THE BAR THE MARK NOW BELONGS TO?** — and for this family that is the
    //    whole question, not a formality.
    //
    // His report, 2026-08-22: *"while dragging tempo refuses to move and after mouse release it
    // lands in the cursor"*. A tempo drag's horizontal is a RE-ANCHOR, not an offset — his trace is
    // `[Tempo] walked onto its next stop` on every frame, with the latch dropping the offset back to
    // ~0 each time. The mark's glyph is drawn INSIDE its bar's `<g class="vf-measure">`, so a mark
    // that has walked into the next bar cannot be taken there by a transform: the two passes below
    // would move it by an offset of nothing and leave it in the bar it came from. It sat still for
    // the whole gesture and jumped on the drop, which is the full render finally drawing it where it
    // belongs.
    //
    // ⭐ So a bar change REFUSES and the caller renders for real — the bar genuinely has to be
    // re-engraved, which is what `MeasureRedrawKey` folding the mark's overrides into its shape key
    // is FOR. Only a pure offset frame takes the cheap path.
    //
    // ⚠️ The ELEMENT, ⛔ not a registry row: `drawTempoMarks` registers the mark's box inside the
    //    `try` that `getBBox` throws out of before layout, so the row is a browser-only artifact and
    //    vouching on it would refuse every frame in a spec.
    placed: (pass, id) => {
      const svg = pass.context?.svg as SVGSVGElement | undefined
      const el = svg?.querySelector(`#vf-${id}`)
      if (!el) {
        dbg(`[Preview] tempo ${id}: no glyph in this render's SVG — the frame cannot move it`)
        return false
      }
      // 🚨🚨 **THE ANCHOR, ⛔ NOT THE BAR** — his report, 2026-08-22: *"while dragging the tempo gets
      //    stuck at certain points and doesn't offset smoothly"*, with a trace of the ink jumping
      //    ~39 px BACKWARDS on every `[Tempo] walked onto its next stop`.
      //
      // The first cut of this row asked whether the glyph was still inside the bar the mark belongs
      // to, which every crossing WITHIN a bar passes. But a crossing re-anchors, and the glyph's own
      // `x` was measured from the OLD anchor when its bar was drawn (`TempoLayout.drawTempoMarks`,
      // which now stamps the address it used). The identity the walk relies on is
      // `drawn = base(anchor) + offset`, and the crossing pair moves BOTH halves — while a preview
      // can only rewrite the offset. So the frame wrote offset 0 against a base still sitting at the
      // previous onset, and the mark snapped back there: a sawtooth, once per stop.
      //
      // ⭐ The bar test was not too strict but too LOOSE. What a preview may move is a mark whose
      //   anchor has not changed; anything else is a re-engraving, which is exactly what
      //   `MeasureRedrawKey` folding the mark's overrides into its bar's shape key is for.
      const drawnFor = el.getAttribute('data-tempo-anchor')
      const measure = pass.score.measures.find(m => m.tempos?.some(t => t.id === id))
      const mark = measure?.tempos?.find(t => t.id === id)
      const belongsTo = measure && mark ? `${measure.number}:${fracToNumber(mark.beat)}` : null
      const agreed = drawnFor !== null && belongsTo !== null && drawnFor === belongsTo
      if (!agreed) {
        dbg(`[Preview] tempo ${id}: drawn for anchor ${drawnFor ?? '—'} but now anchored at`
          + ` ${belongsTo ?? '—'} — its glyph's x was measured from the old one, so this frame owes`
          + ` a real render`)
      }
      return agreed
    },
    draw: ({ pass, placements, staffIds }) => {
      applyTempoNudges(pass, placements)
      placeTempoMarksOnLine(pass, placements, staffIds)
    },
  },
}

/**
 * Redraw one family against a finished render, in place of a whole new one.
 *
 * ⛔ **Returns false rather than leaving a hole, and the caller must then render for real.** Two ways
 * that happens, and the second is the one a user reports as a bug:
 *
 *  - there is no finished render to draw against yet;
 *  - 🚨🚨 **the dragged mark did not come out the other side.** Every family but the pedal and the slur
 *    draws from a PLAN captured with the render — `dynamicsPlan`, `trillBands`, `ottavaBands` — and
 *    those are keyed by *(mark, line)*. The instant a drag carries the mark onto **another staff or
 *    another system** the captured plan has no entry for where it now is, and the renderer's own
 *    `if (baseline === undefined) continue` skips it. The wedge vanishes and stays vanished until
 *    the drop renders for real. His report, 2026-08-22: *"when crossing staves it disappears and I
 *    don't see it anymore till I release click."*
 *
 * ⭐ The check is the mark's OWN drawn group rather than a per-family "did you jump?" flag, because it
 * catches the symptom instead of one cause: any future reason a preview cannot place the thing being
 * dragged ends in a real render rather than a hole. ⚠️ It costs a full render on the crossing frame
 * only — the rhythm §12.1 already describes, where a crossing press pays more than an ink press.
 */
export function previewMarkFamily(
  kind: MarkPreviewKind,
  snapshot: RenderSnapshot | null,
  /** The mark the gesture is moving. Omit only where there is no one mark to vouch for. */
  markId?: string,
): boolean {
  if (!snapshot) return false

  const family = MARK_PREVIEW_FAMILIES[kind]
  const { pass } = snapshot

  // The old ink, out of the DOM and out of the hit-test — both, or the frame leaves a copy behind.
  // ⛔ Only for a family that REDRAWS. A moved one (`tempo`) owns neither, and taking its registry
  //    box down would leave the transform writer nothing to move.
  if (family.redrawn) {
    const groups = family.redrawn.groups(pass)
    for (const group of groups.values()) group.remove()
    groups.clear()
    pass.elementRegistry.removeByType(family.redrawn.registryType)
  }

  // The world this pass was entered with, back the way it was — collections AND ambient ink.
  const before = snapshot.before[kind]
  pass.occupiedBands.length = Math.min(before.bands, pass.occupiedBands.length)
  pass.drawnCurves.length = Math.min(before.curves, pass.drawnCurves.length)
  const context = pass.context as unknown as { state: unknown; attributes: unknown }
  context.state = { ...before.state }
  context.attributes = { ...before.attributes }

  // …and draw it again, from placements that have not moved.
  family.draw(snapshot)

  // ⛔ Did the thing being dragged actually land? If not, this frame is a real render's job.
  return markId === undefined || family.placed(pass, markId)
}
