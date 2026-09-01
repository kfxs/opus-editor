/**
 * ⭐ **THE GROUPING-SIGN STAMP'S GHOST** — the armed brace or bracket, following the cursor.
 *
 * Its own module rather than another function in {@link GhostRenderer}, per CLAUDE.md's rule: the
 * table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside {@link BarlineGhost} /
 * {@link KeySignatureGhost} / {@link OttavaGhost}.
 *
 * ## ⭐⭐ WHY IT COULD BE BUILT AFTER ALL
 *
 * P5 recorded it as blocked: *"a grouping sign's preview needs the STAFF SPAN the click will make,
 * which is a shape no ghost has."* ⛔ That was the wrong objection, and it is the barline's objection
 * verbatim — answered there and again here. **The ARMED click applies to ONE staff**
 * (`groupStamp.stampGroupAtClick` takes `staffIndexAtY`), so there is no span to know; and even if
 * there were, ⭐ *the cursor says **WHAT** the click makes, not where the engraver puts it*.
 *
 * ## ⭐⭐ THE PRECOMPOSED GLYPH, and here it is not merely convenient — it is REQUIRED
 *
 * 🚨 {@link drawSignGhost} recolours **`text, path`** — a GLYPH's shapes. A `fillRect` is a `<rect>`
 * and **the sweep does not paint it**, which is the bug he reported of the barline ghost: *"why the
 * only thing is blue in the ghost is the dots?"* ⛔ So the ghost may NOT be built the way the sign is
 * engraved — our bracket is a rod (`fillRect`) plus two tip glyphs, and its rod would ghost BLACK.
 *
 * ⭐ Both signs have a precomposed glyph in the font we ship, verified in `Bravura.otf`:
 * **`bracket` U+E002** (1.876 × 6.556 sp — rod and both serifs in one) and **`brace` U+E000**
 * (0.320 × 3.988). One `<text>` node each, so the family's recolouring reaches all of it.
 *
 * ⛔ **And that is NOT licence to stamp these in `systemStart`**, where the sign spans real staves at
 * a real height: `bracket`'s box is a fixed 6.556 sp and a brace must stretch. The ghost is a sign
 * for the USER at the nominal size — the one case a precomposed glyph is correct by construction.
 * (`BarlineGhost` makes the same trade for the same reason, in the same words.)
 *
 * ⭐ Both signs are drawn at ONE STAFF's height, and the brace at the DEPTH it is engraved at — see
 * {@link GHOST_HEIGHT_SPACES} and {@link drawGroupSignGhost}, each carrying the report that set it.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { scalingAbout } from '@/engine/paint/Affine'
import { drawGroupOf } from './svgDrawGroup'
import { drawGlyph } from './glyphPainter'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { drawSignGhost } from './ghostCursor'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { BRACE_DEPTH_SPACES } from '@/engine/layout/systemStartColumn'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given. */
export const GROUP_SIGN_GHOST_GROUP_CLASS = 'vf-ghost-groupsign'

/**
 * The precomposed glyph for each sign that can be ARMED, and how to size it.
 *
 * ⚠️ Written as escapes, like `BarlineGhost`'s `SIGN_GLYPHS`: a private-use character is invisible in
 * every editor and diff, so the source has to say which one it is.
 *
 * ⛔ **No `subBracket` row, and that is not an oversight** — SMuFL has no glyph for it, and it cannot
 * be armed: no palette button (his call, 2026-08-29) and the console APPLIES rather than arms.
 * `interactions/toolGhost` returns no ghost for it, so this table is never asked.
 */
const SIGN_GLYPHS = {
  // ⭐ `braceLarge`, ⛔ NOT plain `brace` — the ghost shows the glyph we ENGRAVE (P4b chose this
  //    variant by measuring all five against Gould's plate), so the preview is the sign, not a
  //    different drawing that happens to be the family's default.
  brace: '\uF401',
  // The precomposed bracket: rod and both serifs in ONE glyph. ⛔ We do not engrave this — the drawn
  // sign is a rod plus two tips so it can span any staff height — but a ghost has a fixed height, and
  // a `fillRect` rod would ghost BLACK (see the header).
  bracket: '\uE002',
} as const

/** Which metrics row each ghost glyph is measured from. */
const SIGN_BOXES = { brace: 'braceLarge', bracket: 'bracket' } as const

/**
 * ⭐⭐ **HOW TALL A GHOST SIGN IS — ONE STAFF, whichever sign it is.** 🚨 His report, 2026-08-29:
 * *"try to make the bracket glyph the same size as the brace."* At one font size the precomposed
 * bracket is **6.556 sp** tall against the brace's **3.988** — 64% taller, so the two previews did
 * not read as the same family. Both are now scaled to this height.
 *
 * ⭐ 4 staff spaces is not arbitrary: it is ONE STAFF, and the armed click applies to exactly one
 * staff (`groupStamp.stampGroupAtClick`). So the ghost is the size of what the click makes.
 */
const GHOST_HEIGHT_SPACES = 4

export type GhostableGroupSymbol = keyof typeof SIGN_GLYPHS

/**
 * ⭐⭐ **THE BRACE GHOST IS DRAWN AT THE DEPTH WE ENGRAVE, ⛔ not at the glyph's natural width.**
 *
 * 🚨 His second report, 2026-08-29: *"the brace is not thick enough."* Dead right, and it was the
 * ghost misrepresenting the sign: the ENGRAVED brace is stretched to a constant
 * {@link BRACE_DEPTH_SPACES} of 0.89 sp (P4b — Gould p. 331, measured), while the ghost stamped the
 * glyph unscaled at **0.268 sp**, over three times thinner. ⇒ the brace ghost takes the same
 * NON-UNIFORM scale the drawing does; ⭐ the bracket keeps a UNIFORM one, because its drawn shape is
 * never distorted.
 */
export function drawGroupSignGhost(
  ctx: DrawContext, cursorX: number, cursorY: number, symbol: GhostableGroupSymbol,
): boolean {
  const box = glyphBox(SIGN_BOXES[symbol])
  const inkHeight = box.up + box.down
  const sy = GHOST_HEIGHT_SPACES / inkHeight
  // ⭐ The brace is stretched in x to the depth it is ENGRAVED at; the bracket scales uniformly.
  const sx = symbol === 'brace' ? BRACE_DEPTH_SPACES / (box.right - box.left) : sy

  return drawSignGhost(ctx, 'ghost-groupsign', cursorX, cursorY, () => {
    const group = drawGroupOf(ctx.openGroup('groupsign-scale'))
    try {
      // Scaled about the cursor, so the sign hangs where the pointer is whatever its own box says.
      group?.setPlacement(scalingAbout(sx, sy, 0, cursorY))
      drawGlyph(ctx, 'GroupSignGhost.sign', SIGN_GLYPHS[symbol], 0,
        cursorY + (inkHeight / 2 - box.down) * STAFF_SPACE_PX, 3 * STAFF_SPACE_PX)
    } finally {
      ctx.closeGroup()
    }
  })
}
