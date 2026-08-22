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
export type MarkPreviewKind = 'ottava' | 'pedal' | 'trill' | 'hairpin' | 'slur'

interface MarkPreviewFamily {
  /** The registry rows this family owns, taken down before it is drawn again. */
  registryType: ElementType
  /** Its drawn `<g>`s, by mark id — the pass keeps this map for us. */
  groups(pass: RenderPass): Map<string, SVGGElement>
  /**
   * Re-PLAN and re-draw the whole family, exactly as `renderScore` does.
   * ⛔ No filter, and ⛔ no captured plan: see the header for what each of those cost.
   */
  draw(snapshot: RenderSnapshot): void
}

export const MARK_PREVIEW_FAMILIES: Record<MarkPreviewKind, MarkPreviewFamily> = {
  ottava: {
    registryType: 'ottava',
    groups: pass => pass.ottavaGroupMap,
    draw: ({ pass, score, placements, staffIds }) =>
      renderOttavas(pass, score, placements, staffIds,
        planOttavaBands(pass, score, placements, staffIds)),
  },
  pedal: {
    // ⭐ No plan of its own: `renderPedals` works its baseline out at draw time, which is why this
    //   family never had the bug the header describes.
    registryType: 'pedal',
    groups: pass => pass.pedalGroupMap,
    draw: ({ pass, score, placements, staffIds }) =>
      renderPedals(pass, score, placements, staffIds),
  },
  trill: {
    registryType: 'trill',
    groups: pass => pass.trillGroupMap,
    draw: ({ pass, score, placements, staffIds }) =>
      renderTrills(pass, score, placements, staffIds,
        planTrillBands(pass, score, placements, staffIds)),
  },
  hairpin: {
    // ⚠️ Its plan is the DYNAMICS line's — a wedge is a member of that family and asks it for the
    //    same baseline the letters get (`dynamicsLinePlan`).
    registryType: 'hairpin',
    groups: pass => pass.hairpinGroupMap,
    draw: ({ pass, score, placements, staffIds }) =>
      renderHairpins(pass, score, placements,
        planDynamicsLines(score, placements, staffIds, MARK_INK, pass.occupiedBands)),
  },
  slur: {
    // ⭐ No plan either: a curve is solved from its own anchors.
    registryType: 'slur',
    groups: pass => pass.slurGroupMap,
    draw: ({ pass, score }) => renderSlurs(pass, score),
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
  const groups = family.groups(pass)
  for (const group of groups.values()) group.remove()
  groups.clear()
  pass.elementRegistry.removeByType(family.registryType)

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
  return markId === undefined || groups.has(markId)
}
