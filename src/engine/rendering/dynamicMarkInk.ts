/**
 * ⭐⭐ **HOW FAR A DYNAMIC MARK'S INK ACTUALLY REACHES — from the font, per letter.**
 *
 * The third `dynamicMark*` module, beside {@link dynamicMarkAnchor} (where a mark hangs) and
 * {@link dynamicMarkTransform} (how it is moved). This one answers a question the others assume:
 * *where does this particular mark's ink begin and end?*
 *
 * ⚠️⚠️ **Because `DYNAMIC_GLYPH_INK_ABOVE` is ONE FRACTION FOR EVERY LETTER, and the letters differ
 * by a lot.** `dynamicStyle.ts` states the mark's ink as `0.68 × the glyph size` — 2.04 staff spaces
 * — and says in its own comment that this is a first cut rather than a measurement. Bravura, now
 * that we have it as data (`engine/fonts`), says the real reaches are:
 *
 * | glyph | above its baseline | below |
 * |---|---|---|
 * | `dynamicForte` | 1.776 sp | 0.608 sp |
 * | `dynamicPiano` | 1.096 sp | 0.568 sp |
 * | `dynamicMezzo` | 1.096 sp | 0.040 sp |
 *
 * So the constant is ~0.26 sp too tall over an `f` and ~0.94 sp — **nine pixels** — too tall over a
 * `p`. HIS REPORT, 2026-08-17, of the selected mark's attachment line: *"for dynamic letters there is
 * too much air, so it is an empty space; somehow the anchor line should be measuring ink and not
 * bbox."* Nine pixels of nothing between the guide's end and the letter it points at.
 *
 * ⭐ **MuseScore does not have this problem, and reading why is what settled the shape of the fix**
 * (their C++, read 2026-08-17). `EngravingItem::dragAnchorLines` takes the element's `canvasPos()` —
 * the ORIGIN, not any corner (`engravingitem.cpp:2366`) — and their layout has already put that
 * origin on the ink: `xAdj = leftMargin - textBlock.boundingRect().left()` moves the block's ink-left
 * to x = 0 (`textlayout.cpp:221`), the vertical align is `BASELINE`, and a dynamic's bbox comes from
 * the SMuFL glyph SHAPE rather than a font line box (`textlayout.cpp:376-383`). They need no
 * anti-air trick because there is no air. We cannot renormalise our origin — VexFlow places the mark
 * — so we do the equivalent from the other side: keep the drawn origin and DERIVE the ink off the
 * font table.
 *
 * ⛔ **What this module does NOT do: change the mark's registry box.** That box is the hit-test, the
 * text-edit overlay's placement and the dynamics line's clearance all at once, and its top being a
 * shade generous is deliberate there — a row of marks reads as a row because they share ONE height
 * (`dynamicStyle.ts`'s own reasoning, and the reason the box is rebuilt rather than measured). ⭐ A
 * GUIDE is the opposite case: it points at one letter, and it must touch the ink of THAT letter.
 * ⏭️ If the box itself should ever become per-letter, this is the function it would call — but that
 * is an engraving change with a row of consequences, not a guide's business.
 *
 * ⭐ **Per LETTER, not per drawn glyph, and that is exact rather than approximate.** A mark is
 * stored as single-letter glyphs and may be DRAWN with precomposed ligatures (`ff` → one glyph, see
 * `utils/dynamics`) that the metrics table does not carry. It does not need to: a ligature is its
 * letters' shapes, so the tallest ink in `ff` is `f`'s, and in `mp` it is the taller of `m` and `p`.
 * Reading the letters (`glyphsToLetters`) is therefore both simpler and closer to the font — and it
 * is what MuseScore's own shape union amounts to.
 */
import { glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'
import { glyphsToLetters, splitDynamicRuns } from '@/utils/dynamics'

/**
 * The dynamics alphabet, letter → the SMuFL glyph the font measures.
 *
 * ⚠️ It mirrors `utils/dynamics`' `LETTER_TO_GLYPH` (which maps to CODEPOINTS, for drawing) rather
 * than importing it: this side needs NAMES, because that is what `engine/fonts` is keyed by, and a
 * codepoint→name step would be a second table anyway. ⛔ A letter missing here is not a zero — it is
 * simply not a dynamics letter, and {@link dynamicInkReachSpaces} answers `null` for a mark made
 * only of those.
 */
const LETTER_GLYPHS: Readonly<Record<string, GlyphName>> = {
  p: 'dynamicPiano',
  m: 'dynamicMezzo',
  f: 'dynamicForte',
  r: 'dynamicRinforzando',
  s: 'dynamicSforzando',
  z: 'dynamicZ',
  n: 'dynamicNiente',
}

/** How far a mark's ink reaches from its own baseline, in staff spaces. Both positive. */
export interface DynamicInkReach {
  /** The TALLEST letter's reach above the baseline. */
  above: number
  /** The DEEPEST letter's reach below it — `p` and `f` descend; `m` barely does. */
  below: number
}

/**
 * How far the ink of `text` reaches either side of the mark's baseline — or `null` when the mark
 * contains no dynamics letter at all.
 *
 * ⭐ `null` is a real answer, not a failure: an expression word (`dolce`) is prose in a serif face
 * the font table knows nothing about, so the only honest reply is "ask something else". The caller
 * keeps its own box for those — which is right for prose anyway, since a text box's top IS roughly
 * its cap height. That is exactly the case he said *"does not look bad"*.
 *
 * ⚠️ The MAX in each direction, because a mixed mark is as tall as its tallest letter and as deep as
 * its deepest: `mf` reaches `f`'s 1.776 above, not `m`'s 1.096. Taking the first letter's would put
 * a guide inside the ink of a taller neighbour.
 *
 * ⚠️⚠️ **Through `splitDynamicRuns`, and NOT by reading the string's letters.** A first version
 * mapped letters straight from `glyphsToLetters`, which leaves ASCII untouched — so the word
 * `sempre` measured as `s`, `m`, `p` and came back with a dynamics reach. ⭐ **A plain ASCII `p` is
 * not piano** (`utils/dynamics`' rule, the crux of the whole text-as-truth model): only characters
 * that ARE dynamics glyphs count, which is exactly what a `glyph` run is. Its own spec caught this.
 */
export function dynamicInkReachSpaces(text: string): DynamicInkReach | null {
  let reach: DynamicInkReach | null = null
  for (const run of splitDynamicRuns(text)) {
    if (!run.glyph) continue
    for (const letter of glyphsToLetters(run.text)) {
      const glyph = LETTER_GLYPHS[letter]
      if (!glyph) continue
      const { up, down } = glyphBox(glyph)
      reach = reach
        ? { above: Math.max(reach.above, up), below: Math.max(reach.below, down) }
        : { above: up, below: down }
    }
  }
  return reach
}
