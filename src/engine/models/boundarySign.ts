/**
 * **WHAT SIGN A BOUNDARY CARRIES** — the score's half of the barline sign: which of the family
 * stands between two bars, and whether it may carry wings. Both are read off the MODEL alone, which
 * is why they live in the core and `barlineOps` may use them.
 *
 * What the sign is MADE OF — its strokes, dots, extent and tips, in staff spaces from font metrics —
 * is `engine/layout/barlineSign`, which the score layer may not import (`lint:boundary`).
 */
import type { Measure } from '@/types/music'

/**
 * **What sign divides a boundary.** ⭐ Note what is NOT here: `none`, `double`, `heavy`, `dashed` —
 * the family's other members are one case each in this file the day they are asked for, and a value
 * with no drawing behind it would be a lie the compiler cannot catch (plan §0).
 *
 * ⭐ `repeatBoth` is not a stored value anywhere and never will be: it is the DRAWING of two model
 * facts, bar *N*'s `repeatEnd` plus bar *N+1*'s `repeatStart` (§3.2, §4.3). MEI had to invent
 * `rptboth` because one stored slot could not hold two statements; we combine at the pen instead.
 */
export type BarlineSignKind = 'plain' | 'invisible' | 'final' | 'repeatEnd' | 'repeatStart' | 'repeatBoth'

/**
 * **The sign at one boundary**, from the two bars that meet there. Either may be absent: `ends` is
 * undefined at a system's opening edge, `begins` at its closing one — and "absent" here means *not on
 * this system*, which is what makes the system condition local to this one function.
 *
 * ⭐ The order of these tests IS the family's precedence, and two rows of it are judgement calls:
 *
 *  - **`invisible` first, above everything** — it is not a sign but a statement about whatever sign
 *    would stand here, so it cannot lose to one. His call, 2026-08-26; the body says why.
 *  - a bar carrying BOTH a `final` style and a `repeatEnd` draws the **repeat**, because Gould's
 *    repeat *"uses the final double barline design together with repeat dots"* (p. 39) — the repeat
 *    is the final bar plus something, so it subsumes it rather than competing with it.
 */
export function signAtBoundary(ends: Measure | undefined, begins: Measure | undefined): BarlineSignKind | null {
  // ⭐⭐ **INVISIBLE WINS OVER EVERYTHING** — 🚨 his report, 2026-08-26: *"why can I not override a
  // repeat line with an invisible?"* He had a `|:` on this line, stamped invisible, and the picture
  // did not move: the style was stored, and the repeat below out-ranked it.
  //
  // ⭐ Right, and the fix is the precedence rather than the field. `invisible` is not a fourth sign
  // competing for the boundary — it is a statement that **this line is not engraved**, which is a
  // statement ABOUT whatever sign would otherwise stand there. Every engine models it that way
  // (MuseScore's barline `visible` flag is orthogonal to its type), and it is the hidden REST's rule
  // once more: what disappears is the INK, never the content. The repeat is still in the model, still
  // exported, still what a play order would read.
  //
  // ⚠️ The ROOM is deliberately NOT affected — `ownEndSignKind` still answers `repeatEnd` for a
  // hidden repeat, so hiding a line never re-spaces the music around it (that function's own rule:
  // reserving more than is drawn is always safe, the reverse never is).
  if (ends?.barline?.style === 'invisible') return 'invisible'

  const closes = ends?.repeatEnd !== undefined
  const opens = begins?.repeatStart !== undefined
  if (closes && opens) return 'repeatBoth'
  if (opens) return 'repeatStart'
  if (closes) return 'repeatEnd'
  if (ends?.barline?.style === 'final') return 'final'
  // A bar ends here, and nothing was said about it: the plain single line every boundary draws.
  // ⛔ Nothing when no bar ends here — a system's opening edge is the stave's own begin bar.
  return ends ? 'plain' : null
}

/**
 * Which signs have a THICK line — the score's statement of what `layout/barlineSign` draws. The
 * geometry answers the same question from the sign's parts (`hasThickLine`); the core cannot read
 * font metrics, so it says it as a table the compiler keeps total, and `barlineSign.test.ts` fails
 * if the two ever disagree.
 */
const HAS_THICK_LINE: Record<BarlineSignKind, boolean> = {
  plain: false,
  invisible: false,
  final: true,
  repeatEnd: true,
  repeatStart: true,
  repeatBoth: true,
}

/**
 * ⭐⭐ **CAN THIS SIGN CARRY WINGS?** — the flared tips at the top and bottom of its thick line.
 *
 * ⭐ **A sign with a HALF has a thick line; one without is a bare stroke.** So the answer is
 * {@link HAS_THICK_LINE}, which a spec holds to the drawn parts: `final`,
 * both repeats and the back-to-back form all qualify, while a `plain` line and an `invisible` one —
 * which are nothing but their divider — have nothing to flare.
 *
 * 🚨 **HIS RULE, 2026-08-26:** *"it should be only checkable when wings are allowed — this is for
 * open repeat, for end repeat and for final; other barlines do not allow wings."* ⚠️ Note the FINAL:
 * MuseScore wings the two repeats and the back-to-back form and never the final bar
 * (`repeatBarTips` is checked in three cases only). He asked for the final too, which is his call and
 * a defensible one — a final bar's thick line is the same stroke a repeat's is.
 */
export function wingsAllowed(kind: BarlineSignKind): boolean {
  return HAS_THICK_LINE[kind]
}
