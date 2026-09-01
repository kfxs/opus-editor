/**
 * ⭐ **THE BARLINE STAMP'S GHOST** — the armed sign itself, following the cursor.
 *
 * Its own module rather than another function in {@link GhostRenderer}, per CLAUDE.md's rule: the
 * table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside {@link PedalGhost} /
 * {@link OttavaGhost} / {@link TrillGhost}.
 *
 * ⭐⭐ **HIS CALL, 2026-08-26** — *"where is the ghost? i see you are using the blue cursor, but we
 * need ghosts for every case using the glyph"*. P4 shipped ghostless on the argument that a barline
 * stands on a BOUNDARY and never at the pointer, so there is no position for a preview to occupy.
 * That is the argument the pedal's ghost already overturned, in the same words, and it answers the
 * wrong question: WHERE the sign lands is the renderer's business after the click; what the cursor
 * has to say is **WHAT** the click makes — and three palette buttons that arm identically behind one
 * blue caret is exactly the case a ghost helps most (the `8va`/`8vb` lesson).
 *
 * ## ⭐⭐ THE PRECOMPOSED GLYPH — a ghost is drawn by the FONT, and the engraved sign is not
 *
 * His second question, and it corrected the first build: *"why do you have to draw the whole ghost,
 * isn't it easy to use the bravura glyphs for ghost?"* It is, and here it is also RIGHT.
 *
 * The pass draws these signs as **strokes plus the dot glyph** for a reason that does not reach the
 * cursor: `barlineFinal`'s box is exactly 4 staff spaces tall — a five-line staff and nothing else —
 * while an engraved barline has to span whatever staff it is drawn on (a cue staff, a 1-line
 * percussion staff, a 4-line tablature). That is why 3 of 3 engines stroke the lines
 * (docs/barline-types-plan.md §8 P2). ⭐ **A ghost has no such staff.** It is a sign for the user, on
 * the nominal five-line staff at the score's own size, which is the one case the precomposed glyph is
 * correct by construction — so the font draws it, in one `<text>` node, and the family's shared
 * recolouring ({@link drawSignGhost}) reaches all of it.
 *
 * ⚠️ **That last point is not cosmetic — it is the bug he saw.** Strokes drawn with `ctx.fillRect`
 * are `<rect>`s, which the sweep does not paint: *"why the only thing is blue in the ghost is the
 * dots?"* — the dots were the only part of the sign that was a glyph.
 *
 * ⛔ So the ghost may be a hair off the engraved sign (the font's own thin/thick and separation, not
 * ours). That is the right trade for a preview, and ⛔ it is NOT licence to stamp these glyphs in
 * `BarlineRenderer`, where the staff is real and the four-space box would be a lie.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawGlyph } from './glyphPainter'
import type { PlacedBarlineSign } from '@/engine/layout/barlineSign'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { drawSignGhost } from './ghostCursor'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const BARLINE_GHOST_GROUP_CLASS = 'vf-ghost-barline'

/**
 * The precomposed SMuFL glyph for each placeable sign, as a table the compiler keeps TOTAL.
 *
 * ⚠️ Written as escapes, like `REPEAT_DOT_GLYPH` and `pedalStyle`'s: a private-use character is
 * invisible in every editor and diff, so the source has to say which one it is. `repeatLeft` is the
 * one that OPENS a repeat (`|:`) and `repeatRight` the one that closes it (`:|`) — the names read
 * backwards from our field names, which is exactly why they are written down here once.
 */
const SIGN_GLYPHS: Record<PlacedBarlineSign, string> = {
  // ⭐ The ERASER's ghost, and it is a real glyph rather than "no ghost": arming it must look like
  // arming the other three, or the one button that changes the score by REMOVING something would be
  // the one button with no preview (his ask, 2026-08-26).
  plain: '\uE030',        // barlineSingle — the ordinary line
  // ⭐ The SAME glyph as `plain`, and his own call: *"the invisible ghost I guess will be like the
  // normal ghost, so is simple"*. It is the right one — an invisible barline IS an ordinary line
  // that is not engraved, so the cursor showing an ordinary line is showing exactly what lands.
  // ⛔ Not a greyed variant: the ghost's colour is the family's (`drawSignGhost`), and a second
  // colour rule here would say "this preview is hidden" rather than "this is what you are placing".
  invisible: '\uE030',    // barlineSingle again — see above
  final: '\uE032',        // barlineFinal — thin + thick
  repeatStart: '\uE040',  // repeatLeft  — |:
  repeatEnd: '\uE041',    // repeatRight — :|
}

/**
 * Draw the armed sign at the cursor. Returns false when nothing measurable was drawn — see
 * {@link drawSignGhost}, which owns that answer for the family.
 *
 * ⚠️ At x = 0, like every sign ghost: `drawSignGhost` measures what was drawn and translates it into
 * the standard ghost position, so a drawer that parked itself would be parking twice.
 *
 * The size is the one `BarlineRenderer.drawRepeatDot` uses: a SMuFL em is 4 staff spaces and VexFlow
 * reads a bare font size as POINTS at 4/3 px each (`./drawnFontSize`), so `3 × space` draws a glyph
 * whose 4-space box is exactly one staff tall.
 */
export function drawBarlineGhost(
  ctx: DrawContext, cursorX: number, cursorY: number, sign: PlacedBarlineSign,
): boolean {
  return drawSignGhost(ctx, 'ghost-barline', cursorX, cursorY, () => {
    drawGlyph(ctx, 'BarlineGhost.sign', SIGN_GLYPHS[sign], 0, cursorY, 3 * STAFF_SPACE_PX)
  })
}
