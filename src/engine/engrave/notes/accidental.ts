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
 * `Accidental.format` (and the ORDER by our own `chordAccidentalColumns`, which took Gould's rule and
 * wrote its own packing), and porting that packing would drag 1,813 LOC of VexFlow infrastructure
 * for no engraving opinion of ours. ⭐ Same split as the clef's in P5b: **the INK moves, the
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
 * ⭐ Stamp one accidental.
 *
 * ⛔ **Opens no group**, because VexFlow's never did: an accidental's `<text>` lands directly inside
 * the notehead group its note opened, which is where `HighlightController` finds it (it recolours a
 * selected note's accidental by filling every `<text>` in that group). Opening one here would be a
 * DOM change, and this step moves no pixel.
 */
export function drawAccidental(ctx: DrawContext, ink: AccidentalInk): void {
  stampGlyph(ctx, ink.glyph, ink.x, ink.y, ink.font)
}
