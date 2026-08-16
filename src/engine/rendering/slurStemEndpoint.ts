/**
 * ⭐⭐ **WHERE A SLUR ATTACHES AT EACH END** — the notehead, the stem end, or a point part-way up
 * the stem when the two stems disagree (Gould p. 111; docs/slur-plan.md §12 Phase 1).
 *
 * > p. 111: *"When outer notes have opposite stem directions, move the slur at the stem end towards
 * > the noteheads **so it does not tilt contrary to the direction of the pitches**."*
 *
 * ⭐⭐ **THE FAULT THIS EXISTS FOR, measured on drawn ink (2026-08-15).** A rising step `A4 → B4`
 * across the middle line has mixed stems, so the slur goes above, attached at A4's **stem tip** and
 * B4's **notehead** — and **descended 3.0 staff spaces while the melody rose**. A rising tenth
 * `C4 → E5` rose only 1.0 sp. Those are Gedan p. 17's two labelled faults — [b] the slur contradicts
 * the melodic line, [c] it stays horizontal under a moving one — reachable through ordinary music.
 *
 * ⭐ **The arc math was never at fault.** `slurArchCps` lifts the arch vertically above the line
 * between the endpoints, so the curve always follows the interval **between whatever it attaches
 * to**. A slur that contradicts its melody is therefore always an ATTACHMENT fault, and this is the
 * only module that decides attachment (§11.12: this replaced a proposal to clamp `dy` three ways —
 * better sourced, and smaller).
 *
 * ⭐ **The rule, and what it amounts to.** MuseScore's, whose own comment cites this page
 * (`slurtielayout.cpp:683–721`): the stem-side endpoint **slides along its stem by half the vertical
 * distance between the two anchored noteheads**, clamped at the stem end plus
 * {@link CURVE}.slurStemOvershoot. Its effect is easier to hold in the head than its statement —
 * **the slur tilts at HALF the melodic interval**, following the pitches without matching their
 * steepness. On the two faults above: `A4 → B4` now rises 0.25 sp instead of descending 3.0, and the
 * tenth rises 2.25 sp instead of 1.0.
 *
 * ⛔ **Only when the stems OPPOSE.** That is Gould's condition, and with a fixed slur side exactly
 * one end can be on the stem side when they do. When both stems agree, a stem-side end attaches at
 * the stem END as before: the line between two stem tips already parallels the line between the two
 * noteheads, so there is nothing to correct.
 *
 * ⚠️ **A note that draws no stem attaches at its notehead**, whatever side the slur is on — there is
 * no stem to climb. `NoteBuilder` still gives a whole note a stem *direction* (which is what places
 * the slur, `./slurDirection`), so this is the one place that must ask for the TIP rather than the
 * direction and take its absence as an answer.
 *
 * ⭐ **Numbers in, numbers out — including a FANNED MEMBER's.** A member has no `StaveNote`; the fan
 * renderer records its head and the point where its stem meets the beam, and those two numbers mean
 * exactly what a real note's do. So the rule reaches it for free, which is the reason this module
 * takes coordinates rather than notes (docs/slur-plan.md §12.0 #7).
 */
import { CURVE_PX } from './curveStyle'

/**
 * One end of a slur, as DRAWN: the anchored notehead's y, the far end of its stem if it has one, and
 * which way that stem points (`1` up / `-1` down — VexFlow's sign, post-beaming). Pixels, y growing
 * downward, in the staff's own space.
 */
export interface SlurAttachment {
  /**
   * ⭐ **Every notehead in the chord**, not just the one the slur is anchored to (§12 Phase 7).
   * WHICH of them the arc springs from depends on the side it ends up on, and that is decided after
   * the ends are resolved — so the choice belongs here, with the other attachment rules.
   */
  headYs: readonly number[]
  /** The stem's far end (`getStemExtents().topY` — the TIP for either direction). Absent = no stem. */
  stemTipY?: number
  stemDirection: number
  /**
   * Half the notehead's drawn width, in px — the distance from the x the caller anchors to (the
   * head's **centre**, §12 Phase 2) out to the edge where a stem stands. The dodge is stated from
   * the STEM, so it needs to know where the stem is relative to the anchor.
   */
  headHalfWidth: number
}

/**
 * ⭐ **The chord note the arc attaches to: the TOP for a slur above, the BOTTOM for one below.**
 *
 * All three engines agree (§11.2b) — and in LilyPond it changes `musical_dy_` itself, i.e. the
 * slur's own idea of the melodic interval. Ours used the head the user happened to anchor to
 * (`ys[noteIndex]`), so a slur from a chord's middle note sprang from inside the chord and the arc
 * crossed the notes above it. A single note has one candidate and this is a no-op.
 */
function headOn(a: SlurAttachment, direction: number): number {
  return direction === -1 ? Math.min(...a.headYs) : Math.max(...a.headYs)
}

/** Is the slur on the same side as this note's stem? `direction` is −1 above / +1 below. */
function onStemSide(a: SlurAttachment, direction: number): boolean {
  return (direction === -1) === (a.stemDirection === 1)
}

/** Where one end of the arc springs from: its anchor `y` (before the arc's LIFT) and a sideways
 *  `dx` that clears the stem it sits beside — 0 when there is no stem in the way. */
export interface SlurEndpointPlacement {
  y: number
  dx: number
}

/**
 * ⭐⭐ **THE SIDEWAYS CLEARANCE — an endpoint that lands beside a stem goes PAST it, not on it.**
 *
 * His report the first time Gould's float drew (2026-08-16): *"maybe the problem is simply that the
 * slur is touching the stem"*. It was. Our x is the note's tie edge, which for an up stem is exactly
 * where the stem is drawn, so the arc left from the middle of the stem.
 *
 * **Both halves are read from source (§12.1):**
 * - **WHEN** — LilyPond's test: only if the endpoint's y falls **inside the stem's own y extent**,
 *   widened by a quarter space (`slur-scoring.cc:746–752`). An endpoint above the stem's tip has
 *   nothing to clear, so the stem-END attachment (agreeing stems) is deliberately left alone.
 * - **WHICH END** — MuseScore's two conditions (`:672–681` vs `:807–815`): the start dodges only for
 *   an **up** stem, the end only for a **down** one. That is not a special case, it is where the
 *   stem is: a slur's start attaches at the head's RIGHT edge, where an up stem stands, and its end
 *   at the LEFT edge, where a down stem hangs. In the other two combinations the head's own width
 *   already separates the tip from the stem.
 * - **HOW FAR** — {@link CURVE}.slurStemDodge, and the direction is always *inward*, toward the
 *   other end: the tip goes on the far side of the stem, so the arc passes over it cleanly.
 */
function stemDodge(a: SlurAttachment, direction: number, endpointY: number, end: 'from' | 'to'): number {
  if (!onStemSide(a, direction) || a.stemTipY === undefined) return 0
  // The stem's own y band, widened a quarter space (LilyPond's `stem_y.widen(0.25 * staff_space)`).
  const head = headOn(a, direction)
  const near = Math.min(head, a.stemTipY) - CURVE_PX.slurStemNearBand
  const far = Math.max(head, a.stemTipY) + CURVE_PX.slurStemNearBand
  if (endpointY < near || endpointY > far) return 0
  const stemOnThisSide = end === 'from' ? a.stemDirection === 1 : a.stemDirection === -1
  if (!stemOnThisSide) return 0
  // Out to the edge the stem stands on, then clear of the stem — so the number IS the clearance,
  // whatever the anchor x happens to be (MuseScore states its `hw1 + 0.35` from the head's origin
  // for the same reason).
  const past = a.headHalfWidth + CURVE_PX.slurStemDodge
  return end === 'from' ? past : -past
}

/**
 * Where both ends of a slur on `direction` (−1 above / +1 below) attach — the y before the arc's own
 * LIFT, plus any sideways clearance.
 *
 * Each end independently: **notehead side → the notehead**; **stem side → the stem end**, or, when
 * the two stems oppose, a point part-way up that stem such that the slur tilts at half the melodic
 * interval (see the file note). Returns `headY` for anything it cannot improve on, so a caller can
 * use the result unconditionally. `lift` is the gap the caller will add along `direction` — passed
 * in rather than imported, because the dodge has to test the endpoint the reader will actually see.
 */
export function slurAttachments(
  from: SlurAttachment,
  to: SlurAttachment,
  direction: number,
  lift: number,
): { from: SlurEndpointPlacement; to: SlurEndpointPlacement } {
  const { fromY, toY } = slurAttachmentYs(from, to, direction)
  return {
    from: { y: fromY, dx: stemDodge(from, direction, fromY + lift * direction, 'from') },
    to: { y: toY, dx: stemDodge(to, direction, toY + lift * direction, 'to') },
  }
}

/**
 * The two endpoint Ys for a slur on `direction` (−1 above / +1 below), before the arc's own LIFT.
 *
 * Each end independently: **notehead side → the notehead**; **stem side → the stem end**, or, when
 * the two stems oppose, a point part-way up that stem such that the slur tilts at half the melodic
 * interval (see the file note). Exported for its own spec; the renderer wants
 * {@link slurAttachments}, which adds the sideways half.
 */
export function slurAttachmentYs(
  from: SlurAttachment,
  to: SlurAttachment,
  direction: number,
): { fromY: number; toY: number } {
  const stemmed = (d: number) => d === 1 || d === -1
  const opposed = stemmed(from.stemDirection) && stemmed(to.stemDirection)
    && from.stemDirection !== to.stemDirection
  // The tilt the slid endpoint aims for: half the distance between the two NOTEHEADS, which is the
  // melodic interval as drawn (the arc is what the reader compares against the pitches).
  const halfInterval = Math.abs(headOn(to, direction) - headOn(from, direction)) / 2

  const attach = (a: SlurAttachment): number => {
    const headY = headOn(a, direction)
    if (!onStemSide(a, direction)) return headY
    if (a.stemTipY === undefined) return headY
    if (!opposed) return a.stemTipY
    // Slide from the notehead toward the slur's side, but never further than the stem reaches plus
    // one space — a long leap would otherwise launch the arc off the end of a stem it left behind.
    const reach = Math.abs(a.stemTipY - headY) + CURVE_PX.slurStemOvershoot
    return headY + Math.min(halfInterval, reach) * direction
  }

  return { fromY: attach(from), toY: attach(to) }
}
