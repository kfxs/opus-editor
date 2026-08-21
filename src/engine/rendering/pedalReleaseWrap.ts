/**
 * ⭐⭐ **A RELEASE PUSHED PAST THE END OF ITS LINE IS DRAWN ON THE NEXT ONE** — his ask, 2026-08-21,
 * looking at a `✻` hanging in the right margin: *"the `✻` should go to the other system"*, and then
 * the choice between the two ways to do it: *"lets try a"* — **the DRAWING cuts, the model is
 * untouched.**
 *
 * ## What actually put the glyph there
 *
 * A pedal whose lift falls where its staff has no note — normal, and common since the whole pedal
 * learned to walk (`interactions/pedalWalk.walkPedalBody`) — has its release priced at the bar's
 * `noteEndX`, which is Gould's rule 3 as drawn: *the release lands at or before the barline*. When
 * that bar is the LAST on its line, the `✻` is already sitting on the line's last ink; the hand's own
 * `endX` nudge then pushes it into the margin, where nothing catches it. ⛔ The walk's cross-system
 * WRAP (`interactions/markBreakWrap`) cannot: the body's stops are the PRESS's, so it asks the
 * question for the sign at the other end.
 *
 * ## The rule
 *
 * **Ink, not address.** The lift stays exactly where it is in the model — same beat, same length, the
 * same notes ringing — and only the PICTURE moves: the pedal is cut at the break like any other
 * spanning pedal, so the next system opens with a `(Ped.)` resumption carrying the `✻`. ⭐ That is
 * what makes this safe on a gesture whose whole promise is *"the body moves as one"*: a drawing that
 * cuts cannot change how much music is held.
 *
 * ⭐ **The overshoot travels**, so pushing further right walks the `✻` further into the new line
 * rather than parking it at the margin — the wedge's `WRAP_STUB_SS` reasoning without needing a
 * number: how far past the old line's end the hand pushed IS how far into the new one it lands.
 *
 * ⚠️⚠️ **IT ANSWERS IN DRAWN INK, and the caller must then NOT add the nudge again.** The first
 * version handed back the AUTOMATIC x so the drawing's own `+ nudge` would land it — arithmetically
 * identical at the glyph, and WRONG one step earlier: `cutIntoPieces` judges a fragment by that same
 * x, and a release whose automatic position was well inside the old line comes back left of the new
 * line's start. The fragment is then dropped, or kept a hair wide and squeezed by the pair's floors
 * into a `(Ped.)✻` smudge — 🚨 his report the minute it shipped: *"the pedal of the upper staff
 * behaves normal while walking but the pedal of the down staff shrinks"*, the difference between the
 * two being only how far inside its line each release already sat. ⭐ One x, in one space, all the way
 * to the glyph.
 */
import { lineLeftEdgeX, lineRightEdgeX, type SystemEdgeLookup } from './systemEdges'

/** Where the release should be drawn: which line, and the x on it — ⚠️ **INK**, the hand's nudge
 *  already inside it ({@link wrapReleaseOntoNextLine}). */
export interface WrappedRelease {
  line: number
  endX: number
}

/**
 * Does this release run off the end of `line`, and where does it re-appear?
 *
 * @param line the line the release would be drawn on today (the LAST line the pedal reaches).
 * @param drawnEndX the release's x **with** the hand's `endX` nudge in it — the ink actually on the
 *   page, which is both what decides and what travels.
 * @param scale how big this staff is drawn — the edges come from `measureBounds` (SVG space) and
 *   everything here is in the staff's own space, `planSlurSegments`' conversion and for its reason.
 * @param lineIsPainted did the last render put this pedal's staff on that line? ⛔ Never wrap onto a
 *   line the picture cannot say anything about — the walk's own no-guessing rule.
 * @returns null when it stays put, which is the ordinary answer; otherwise the line and the DRAWN x
 *   on it — ⛔ the caller must not add the nudge to it a second time.
 */
export function wrapReleaseOntoNextLine(
  pass: SystemEdgeLookup,
  line: number,
  drawnEndX: number,
  scale: number,
  lineIsPainted: (line: number) => boolean,
): WrappedRelease | null {
  const rightEdge = lineRightEdgeX(pass, line)
  if (rightEdge === undefined || drawnEndX <= rightEdge / scale) return null

  const next = line + 1
  if (!lineIsPainted(next)) return null
  const leftEdge = lineLeftEdgeX(pass, next)
  if (leftEdge === undefined) return null

  // ⭐ The overshoot, carried across: what the hand pushed past the old line's end is how far into the
  // new one the sign lands — so pushing further right walks it further in, and it can never land
  // before the line's first ink (the wrap only fires once `drawnEndX` is past the edge).
  return { line: next, endX: leftEdge / scale + (drawnEndX - rightEdge / scale) }
}
