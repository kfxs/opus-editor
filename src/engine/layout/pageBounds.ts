/**
 * ⭐⭐ **THE EDGE OF THE PAPER — how far a hand-nudged object may be pushed** (his report,
 * 2026-08-17: *"all the objects that we offset, when in wrapped mode, can go out of the page… when
 * we have boundaries there must be a limit"*).
 *
 * ## ⭐⭐ The limit REFUSES THE WRITE. It does not clamp the drawing.
 *
 * His second message is the whole design, and it is the half that is easy to get wrong:
 *
 * > *"in the limit it is not just a boundary — the offset value should not rise or decrease
 * > otherwise, we have the problem that if we go so far we are out of the boundaries and have to go
 * > back till the boundary number until the change makes effect."*
 *
 * Clamp only where the ink is drawn and the STORED offset keeps growing behind it: his own ottava log
 * ran to −45 spaces while the numeral stood still, and coming back would then need forty presses
 * before anything moved. A limit you can walk past invisibly is a dead zone, not a limit. So the
 * refusal happens at the nudge, and the value never accumulates past the edge in the first place.
 *
 * ## ⭐⭐ The rule: a nudge may never INCREASE how far the ink hangs off its sheet
 *
 * One sentence, and it does both jobs. Ink inside the sheet hangs off by nothing, so any step that
 * would take it out increases the overhang and is refused — the object simply cannot leave the paper.
 * Ink that a REFLOW has already left hanging off can still be moved back, because coming home reduces
 * the overhang; only pushing it further out is refused. There is no separate "already out" case and no
 * dead zone in either direction.
 *
 * 🚨 **It had to become a FORWARD test, and his second report is why.** The first version compared
 * only the ink's current position against the edge, which is enough for a keypress (a step is small,
 * so it stops within one of the edge) — but the Properties panel writes a TYPED value, and the
 * controller turns it into `next − current`. One such delta can be arbitrarily large: *"the offset
 * limit should also be true of properties… I now test with note offset and I see we can go out of the
 * page."* A backwards-looking test waves that through, because the ink was still on the sheet when it
 * was asked. Predicting is safe here for one specific reason — what is drawn is `automatic + offset`,
 * so a delta in the OFFSET moves the ink by exactly that delta. ⛔ Nothing else about placement is
 * re-derived; the automatic half stays the renderer's alone.
 *
 * ⚠️ **The predicted box is judged against the sheet the ink is on NOW**, never against the sheet it
 * would land on. Otherwise a big enough jump would sail across the gap and be "inside" the next page.
 *
 * ⚠️ Deltas arrive in **pixels**. Callers hold staff-spaces (or, for a rest, whole staff STEPS), and
 * converting at the row is what lets one rule serve clients that count in different units.
 *
 * ## ⛔ No paper, no limit
 *
 * `SurfaceMetrics.heightPx === null` IS "this is not paper" (see `./surface`), which is the sketching
 * canvas and the linear view. His call: *"probably not for the linear view, but when we have
 * boundaries there must be a limit."* There is nothing to be outside of, so nothing is refused —
 * and that falls out of the surface model rather than needing a view-mode flag.
 */
import type { SurfaceMetrics } from './surface'
import { PAGE_FLOW, PAGE_GAP_PX } from '../rendering/PagePass'

/** A sheet's own rectangle in the drawing's coordinates. */
export interface PageBox {
  left: number
  right: number
  top: number
  bottom: number
}

/** The ink of one drawn thing — the registry's box, or any rectangle in the same space. */
export interface InkBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The sheet a point falls on, as a box — or **null when the surface is not paper**, which is the
 * answer "there is no boundary here" (canvas, linear view).
 *
 * ⭐ It inverts `pageOriginPx`, and reads `PAGE_FLOW` from the same module rather than assuming the
 * spread runs sideways: that constant is *the one place the spread's axis is applied*, and a second
 * copy of the axis here would be a rule that silently disagrees the day the sheets stack.
 *
 * ⚠️ A point in the GAP between two sheets belongs to the sheet before it — it is off the paper, so
 * every edge test then reports it as out, which is exactly right.
 */
export function pageBoxAt(surface: SurfaceMetrics, x: number, y: number): PageBox | null {
  const height = surface.heightPx
  if (height === null) return null

  const along = PAGE_FLOW === 'horizontal' ? x : y
  const pitch = (PAGE_FLOW === 'horizontal' ? surface.widthPx : height) + PAGE_GAP_PX
  const page = Math.max(0, Math.floor(along / pitch))
  const originX = PAGE_FLOW === 'horizontal' ? page * pitch : 0
  const originY = PAGE_FLOW === 'horizontal' ? 0 : page * pitch
  return {
    left: originX,
    right: originX + surface.widthPx,
    top: originY,
    bottom: originY + height,
  }
}

/** How far ink hangs off each edge of its sheet — 0 on an edge it is inside of. */
export interface Overhang {
  left: number
  right: number
  top: number
  bottom: number
}

/** {@link Overhang} for one box on one sheet. */
export function overhangOf(box: PageBox, ink: InkBox): Overhang {
  return {
    left: Math.max(0, box.left - ink.x),
    right: Math.max(0, ink.x + ink.width - box.right),
    top: Math.max(0, box.top - ink.y),
    bottom: Math.max(0, ink.y + ink.height - box.bottom),
  }
}

/** Sub-pixel slack, so a step that mathematically holds the overhang exactly is not refused by a
 *  floating-point crumb. */
const EPS = 0.001

/**
 * ⭐⭐ **Would this step push the ink further off its sheet than it already is?** — the whole of the
 * limit, and the question every offset write asks first.
 *
 * `dx`/`dy` are **pixels**, and screen-down is +y. The ink is moved by them and the two overhangs are
 * compared: growing on ANY edge refuses the step.
 *
 * ⚠️ **Every edge is judged, not just the one the step points at.** A diagonal that comes back on x
 * while leaving the sheet on y is still leaving the sheet, and storing "the part that fits" would
 * write a value the user never asked for.
 */
export function stepLeavesPage(box: PageBox, ink: InkBox, dx: number, dy: number): boolean {
  const now = overhangOf(box, ink)
  const next = overhangOf(box, { ...ink, x: ink.x + dx, y: ink.y + dy })
  return next.left > now.left + EPS || next.right > now.right + EPS
    || next.top > now.top + EPS || next.bottom > now.bottom + EPS
}

/**
 * The two above, together: **may this step be written?** `false` refuses it. `dx`/`dy` in PIXELS.
 *
 * ⭐ Every drawn piece is judged against ITS OWN sheet, because a span cut across a page break has
 * fragments on two of them and one sheet's edges say nothing about the other's. Any piece the step
 * would push further off blocks it, since the offset they share is one number.
 *
 * ⚠️ An element with NO drawn ink (off-screen, or a render that has not happened) is ALLOWED. There
 * is nothing to measure, and refusing on no evidence would make an object unmovable for a reason the
 * user cannot see.
 */
export function nudgeFitsOnPage(
  surface: SurfaceMetrics,
  drawn: readonly InkBox[],
  dx: number,
  dy: number,
): boolean {
  for (const ink of drawn) {
    const box = pageBoxAt(surface, ink.x, ink.y)
    if (!box) return true // not paper — no boundary to be outside of
    if (stepLeavesPage(box, ink, dx, dy)) return false
  }
  return true
}
