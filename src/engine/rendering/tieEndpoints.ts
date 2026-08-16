/**
 * ⭐⭐ **WHERE A TIE ATTACHES** — the tie's twin of `./slurStemEndpoint`, and the last of its
 * placement decisions to come back from VexFlow (docs/slur-plan.md §13.3, his call 2026-08-16).
 *
 * ⭐ **The x, and why it moved.** We used VexFlow's `getTieRightX()` / `getTieLeftX()` — the head's
 * outer edges, plus whatever modifiers hang off the note — so a tie spanned the GAP between two
 * noteheads and touched neither. The three engines all place it over the heads instead, and they
 * disagree only about how far in:
 *
 * | | the tie's x |
 * |---|---|
 * | MuseScore | the head's **optical centre** — the mean of Bravura's `cutOutNW`/`NE` anchors, 0.1 sp inward |
 * | LilyPond | a skyline of the chord, resolving to **¾ across** the head (`0.25·L + 0.75·R`) |
 * | **Verovio** | the head's **centre ± 0.25 sp** — `startPoint.x += r1 + unit/2`, `endPoint.x -= r2 + unit/2` (`src/tie.cpp:381, 391`) |
 * | Gould p. 62 | *"the tie starts and finishes at the **centre of the notehead**"*, aligning with its edge only when it must come closer |
 *
 * **His call: Verovio's**, and it is the one that reads as a decision rather than a default — a
 * quarter space in from the centre, the same number at both ends. 🚨 Note that §13.3 recorded this
 * as *"the outer edge, 0.25 sp **outward**"*, which is a misreading of the same lines: the code
 * moves **inward from the centre**. Reading it again is what caught that.
 *
 * ⏭️ **Not taken:** Verovio's stem-side variant for a short tie (from the head's outer edge + 0.25
 * sp when the stem is on the tie's side, `:88–98`), and its `tieMinLength` spacing rod (§13.7).
 *
 * ✅ **The y is unchanged and settled** (§13.3): 0.70 sp from the head's CENTRE, which is 0.20 sp
 * clear of its edge — MuseScore's `yOffset` exactly, and Gould's *"should almost touch each
 * notehead"*. ⛔ Do not "fix" it. It lives here so that both of a tie's coordinates are decided in
 * one place, the way the slur's are.
 */
import { CURVE_PX } from './curveStyle'

/** One end of a tie, as the numbers this module needs — the drawn notehead, in px. */
export interface TieHead {
  /** The notehead's own extent (`getNoteHeadBeginX/EndX`), NOT the tie edges. */
  leftX: number
  rightX: number
  /** The notehead's centre y. */
  headY: number
}

/** Where the arc springs from (`from`) or lands (`to`): a quarter space in from the head's centre,
 *  toward the other end. */
export function tieEndpointX(head: TieHead, end: 'from' | 'to'): number {
  const centre = (head.leftX + head.rightX) / 2
  return end === 'from'
    ? centre + CURVE_PX.tieEndpointInset
    : centre - CURVE_PX.tieEndpointInset
}

/** The flat y both endpoints share: lifted off the notehead's centre, on the side the tie bows. */
export function tieEndpointY(headY: number, direction: number): number {
  return headY + CURVE_PX.tieLift * direction
}
