/**
 * ⭐⭐ **AN AUGMENTATION DOT'S INK** (`docs/own-engraving-engine.md` P3 — the note's MODIFIERS,
 * 2026-09-14). The accidental's twin: see `./accidental` for why both were invisible to the ceiling.
 *
 * ## ⭐ What a dot IS, as ink
 *
 * > **One glyph, stamped at the point the note offers, RAISED INTO THE SPACE when its notehead sits
 * > on a line — half a staff space, and never anywhere else.**
 *
 * ⭐ The half space is the whole rule and it is old: a dot on a line would be swallowed by it, so a
 * dot belonging to a head ON a line is lifted into the space ABOVE (and a stacked chord may push one
 * down instead, so the shift is signed). ⛔ **WHICH way and by how much is `Dot.format`'s** — it
 * walks a chord's dots line by line, flipping the half space when two heads would land on one — and
 * it arrives here already decided, as `dotShiftY` in staff spaces.
 *
 * ## ⛔ What is NOT here, and it has an owner already
 *
 * **How far a dot stands from its notehead** is `rendering/dotPlacement` — his report (*"the dot is
 * too close to the notehead"*), answered with half a staff space edge to edge, bought in two places
 * because VexFlow sets the drawn x and the reserved width apart from each other. That module moves
 * the dot by `setXShift`; ⭐ this one draws whatever x it ended up with, which is why the shift is
 * folded into {@link AugmentationDotInk.x} by the caller rather than read again here.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

/** One augmentation dot, as the ink it makes. */
export interface AugmentationDotInk {
  /** The glyph's codepoint — `U+E1E7 augmentationDot`, handed over already chosen. */
  glyph: string
  /** The stamp's origin, shifts already folded in (`dotPlacement`'s gap lives in the caller's x). */
  x: number
  /** ⚠️ The BASELINE, after {@link dotBaselineY} has applied the half-space lift. */
  y: number
  font: GlyphFont
}

/**
 * ⭐ **THE RULE: a dot is lifted out of a staff line, by half a space.**
 *
 * `dotShiftY` is in STAFF SPACES and signed (+ down the page, − up), so this is the one line that
 * turns a decision made in spaces into a baseline in pixels. ⚠️ `staffSpace` is the stave's own
 * spacing rather than a constant — a SMALL staff draws a smaller lift, and reading a global here
 * would put the dot in the wrong place on exactly the staves that are hardest to look at
 * (`docs/staff-size-plan.md`'s standing trap).
 */
export function dotBaselineY(noteY: number, dotShiftY: number, staffSpace: number): number {
  return noteY + dotShiftY * staffSpace
}

/**
 * ⭐ Stamp one augmentation dot.
 *
 * ⛔ **Opens no group** — like the accidental, its `<text>` belongs inside the notehead group its
 * note opened, which is where the selection highlight looks for it.
 */
export function drawAugmentationDot(ctx: DrawContext, ink: AugmentationDotInk): void {
  stampGlyph(ctx, ink.glyph, ink.x, ink.y, ink.font)
}
