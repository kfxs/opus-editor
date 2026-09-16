/**
 * ⭐⭐ **HOW FAR A STEM RUNS — where its tip is, where its base is, and how long the stroke is.**
 * S6e of `docs/vexflow-removal-map.md` (`Stem.getExtents` / `Stem.getHeight` / `Stem.HEIGHT`).
 *
 * ## ⭐ This is the answer to the `⛔` at the top of `./stem`
 *
 * P3c took the stem's INK and said, in its own header, that the LENGTH was *"still VexFlow's, and it
 * is the next piece of work rather than an oversight"* — because `own-engraving-engine.md` §6.1 listed
 * stem length among the places *"where we currently have no opinion"*, and **a re-implementation
 * without an opinion is strictly worse than a dependency**.
 *
 * ⭐ **The opinion arrived.** `docs/stem-length-research.md` found all four treatises stating the same
 * rule in the same words, and — ⭐ the happy part — the number the editor has always drawn with is
 * already that rule: `Tables.STEM_HEIGHT` = 35 px = **3½ staff spaces**, which is Gould p. 14, Ross
 * p. 83, Stone p. 47 and Gerou & Lusk p. 137, four for four. ⇒ this module is a port with sources
 * behind it, ⛔ not an invention, and no pixel moves.
 *
 * ## ⭐ What a stem's reach IS
 *
 * > **From the head the stem stands on, {@link STEM_LENGTH_PX} away, plus whatever the note has been
 * > told to add.**
 *
 * Two questions, and they are not the same one:
 *
 * | | from | to | who asks |
 * |---|---|---|---|
 * | {@link stemExtents} | the OUTER head (the base) | the tip | every reader of where the stem ENDS — slurs, ties, trills, ottavas, tuplet brackets, the tremolo |
 * | {@link stemLineHeight} | the head the stroke starts at | the tip | the INK alone (`./stem`) |
 *
 * 🚨 **They measure from opposite heads, and that is deliberate.** A chord's stem is drawn from the
 * head at its BASE, but its length is counted from the head at its TIP end — so on a chord the two
 * differ by the chord's own span (`yBottom − yTop`), which is exactly the term
 * {@link stemLineHeight} adds and {@link stemExtents} does not.
 *
 * ## ⛔ What is NOT here
 *
 * - **How much EXTENSION a note asks for** — a flag's overhang, a beamed note's, and the ramp that
 *   makes a stem reach the middle stave-line (the research's rule 2). That is the NOTE's question
 *   (`StemmableNote.getStemExtension`), it reads a measured flag height and a per-duration table, and
 *   it is still VexFlow's. It arrives as `extension` below, ⛔ and this module does not second-guess it.
 * - **The ATTACHMENT point** — where on the notehead the stem meets it. Open in the research (§4) and
 *   `notes/noteGeometry` owns the x half of it already.
 * - **The stemlet**, the beamed rest's stub: it is a render-time adjustment on the ink, kept in `./stem`'s
 *   caller where VexFlow had it.
 */
import { STEM_LENGTH_PX } from '@/engine/engrave/inheritedDefaults'

/** ⭐ Stem directions, as the drawing library numbers them. */
const UP = 1

/** What a stem has to work with: the heads it spans, which way it points, and what it was told to add. */
export interface StemSpan {
  /** The y of the note's HIGHEST head (smallest y). */
  yTop: number
  /** The y of the note's LOWEST head (largest y). */
  yBottom: number
  /** `1` up, `-1` down. */
  stemDirection: number
  /**
   * What the note asked to be added to the default length — a flag taller than the stem, a beamed
   * note's own table value, or the reach to the middle line. ⛔ Decided by the note, not here.
   */
  extension: number
}

/** The default length a stem runs, before any {@link StemSpan.extension}. */
export function stemReach(extension: number): number {
  return STEM_LENGTH_PX + extension
}

/**
 * ⭐ **Where the stem's two ends are** — the tip, and the head it stands on.
 *
 * ⚠️ **`baseY` is the OUTER head and `tipY` the free end**, whichever way the stem points: for a stem
 * down the tip is BELOW the base, so `tipY > baseY`. ⛔ Neither name means "smaller y" — VexFlow calls
 * the tip `topY` for historical reasons and `rendering/noteRuler` renames it to `stemTipY` at the seam,
 * which is the name every reader in this editor actually uses.
 */
export function stemExtents(span: StemSpan): { tipY: number; baseY: number } {
  const up = span.stemDirection === UP
  const inner = up ? Math.min(span.yTop, span.yBottom) : Math.max(span.yTop, span.yBottom)
  const outer = up ? Math.max(span.yTop, span.yBottom) : Math.min(span.yTop, span.yBottom)
  return { tipY: inner + stemReach(span.extension) * -span.stemDirection, baseY: outer }
}

/**
 * ⭐ **How long the STROKE is** — signed by the direction, so one subtraction draws it either way up.
 *
 * ⚠️ It spans the chord as well as the reach (`yBottom − yTop`), because the ink starts at the head at
 * the stem's BASE while the reach is counted from the head at its tip end. On a single note the two
 * heads are one and the term is zero.
 *
 * @param yOffset how far the stroke starts SHORT of the head it stands on — the drawing library's
 *   `stemUpYOffset` / `stemDownYOffset`, 0 for every note this editor draws and non-zero only for a
 *   note whose head is replaced (tablature). ⛔ Not ours to set, and not dropped either.
 */
export function stemLineHeight(span: StemSpan, yOffset: number = 0): number {
  const unsigned = span.yBottom - span.yTop + (stemReach(span.extension) - yOffset)
  return unsigned * span.stemDirection
}
