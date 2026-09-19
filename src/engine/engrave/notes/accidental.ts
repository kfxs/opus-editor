/**
 * ⭐⭐ **AN ACCIDENTAL'S INK** (`docs/own-engraving-engine.md` P3 — the note's MODIFIERS, 2026-09-14).
 *
 * ## ⭐ What an accidental IS, as ink
 *
 * > **One glyph, hanging to the LEFT of the note it alters: its ink's right edge meets the point the
 * > note offers, and it grows leftward from there.**
 *
 * That sentence is the whole module, and it is the only thing about an accidental that is ours.
 * ⛔ **Which COLUMN it stands in is not here** — a chord's accidentals are packed into columns by
 * `./accidentalStack` (VexFlow's `Accidental.format`, transcribed in S9d), and a fan's members by
 * our own `rendering/chordAccidentalColumns` (Gould's rule, its own packing). ⭐ Same split as the clef's in P5b: **the INK moves, the
 * PLACEMENT stays**, and the seam is that the caller hands over a point it already knows.
 *
 * ## 🚨 Why this was the last glyph on an ordinary score, and why nothing had noticed
 *
 * `lint:paint` counts `vexContext` — and a modifier never mentions it: it takes its context from
 * `voice.draw(ctx)` by way of `StaveNote.drawModifiers`. So the accidental was VexFlow ink that the
 * ceiling could not see and the SCENE did not hold, through every one of P3, P4, P5 and U1.
 * ⭐ It was found by CENSUS — rendering a bar with a sharp and a dotted eighth through `recordScene`
 * and diffing the page against the scene, which left exactly two glyphs: `U+E262 accidentalSharp`
 * and `U+E1E7 augmentationDot`. ⇒ **a ceiling nobody re-measured reads as coverage.**
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

/** One accidental, as the ink it makes — ⛔ no `Accidental`, no note, no key signature. */
export interface AccidentalInk {
  /** The glyph's codepoint(s), already chosen — ⛔ never derived here from a step or an alter. */
  glyph: string
  /** The stamp's origin. ⚠️ Shifts already folded in; see {@link accidentalOriginX} for the x rule. */
  x: number
  /** ⚠️ The BASELINE — the y of the notehead this accidental belongs to (see {@link stampGlyph}). */
  y: number
  font: GlyphFont
  /** The drawn sign's own id, so the group it opens can be found again — see {@link drawAccidental}. */
  id?: string
}

/**
 * ⭐ **THE RULE: an accidental hangs LEFT.** Its ink ends where the note says its modifiers start, so
 * the glyph's origin is that point set back by the glyph's own width.
 *
 * ⚠️ `modifierStartX` is what the NOTE offers (VexFlow's `getModifierStartXY`, which this repo
 * monkeypatches — `docs/own-engraving-engine.md` §2.4 calls that patch *"the shape of the whole
 * problem"*), so this function decides nothing about the gap; it converts a right edge into an
 * origin, which is the one arithmetic step that belongs to the accidental itself.
 *
 * ⛔ In jsdom `width` is 0 for every glyph (no fonts), so the origin collapses onto the start point.
 * That is the standing limit and ⛔ not a bug here: an INK EXTENT needs a browser
 * (`reference: jsdom cannot measure glyphs`).
 */
export function accidentalOriginX(modifierStartX: number, width: number): number {
  return modifierStartX - width
}

/**
 * ⭐ Stamp one accidental, **in a group of its own**.
 *
 * ⚠️ **The group is OURS, ⛔ not VexFlow's** — `Accidental.draw` opened none, and its `<text>`
 * landed loose in the notehead group its note had opened. ⭐ It is here because *a sign that can be
 * SELECTED must be findable in the scene*: `__bbox.ink()` draws one box per group, so without it a
 * note's box silently swallowed its accidental and the sign itself had no box at all — his report,
 * 2026-09-14 (`docs/own-engraving-engine.md` §5 P6).
 *
 * ⚠️ It is a DOM change and the only one this family has made: an extra `<g class="accidental">`
 * INSIDE the notehead group, in the same place in draw order. ⭐ Every highlight selector that reaches
 * these glyphs is a DESCENDANT search (`group.querySelectorAll('text')`, and the articulation's
 * `'text, path'` walk whose index 0 is still the head) ⇒ document order and every index are
 * unchanged. ⚠️ The face is unaffected too: `SVGContext.fillText` writes the font onto the `<text>`
 * whenever it differs from the enclosing group's.
 *
 * ⭐ The class is the REGISTRY's kind name (`'accidental'`), ⛔ not VexFlow's category — P6b has to
 * match a scene group to the hit box the editor already files for the same sign.
 */
export function drawAccidental(ctx: DrawContext, ink: AccidentalInk): void {
  ctx.openGroup('accidental', ink.id)
  try {
    stampGlyph(ctx, ink.glyph, ink.x, ink.y, ink.font)
  } finally {
    // ⚠️ In a `finally`, like every other `openGroup` in this engine: an unbalanced pair swallows
    // the rest of the page's ink into a group that never closes.
    ctx.closeGroup()
  }
}
