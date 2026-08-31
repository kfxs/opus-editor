/**
 * ⭐⭐ **A CURVE MAY TUCK INTO AN ACCIDENTAL'S NOTCH** — Verovio's one accidental-specific rule, and
 * the answer to his report of 2026-08-31: *"the slur here is very ugly, i supose cause the accidental
 * is like an obstacle"*.
 *
 * ## 🚨 What a rectangle costs, measured in his own bar
 *
 * Two eighths a third apart, slurred below, the second carrying a sharp. The obstacle scan clears
 * the note's ink BOX, and a sharp's box hangs a full space under its notehead — so the arch was
 * lifted **12.4 / 15.7 px on a 6.6 px arch** and the slur ballooned a whole staff space below the
 * staff. ⭐ The control run — the same bar with a natural G — lifts **0**.
 *
 * ⭐⭐ And his second pair proved it is the GLYPH and nothing else: `B4 → G♯4` and `A4 → F♭4`, same
 * interval, same beam, same span to within a pixel, *"two thirds with accidental two diferent
 * shapes"*. The sharp's box reaches 8.5 px below its notehead and lifts 12–16 px; the flat's reaches
 * 2.5 px and lifts 1. A flat is nearly all ABOVE its line; a sharp is symmetric about it.
 *
 * ## ⭐ What the three engines do (researched at source, 2026-08-31)
 *
 * All three treat an accidental as an obstacle a slur must clear — including the accidental of the
 * note the slur ENDS on. ⛔ So "exempt the endpoint note" is nobody's rule and is not what this does.
 * But all three are LENIENT with accidentals specifically, each in its own currency:
 *
 * | | leniency |
 * |---|---|
 * | **Verovio** | the SMuFL **cut-out**: `FloatingCurvePositioner::CalcDirectionalLeftRightAdjustment` (`floatingobject.cpp:836`) — *for slurs and phrases only, and only against an `ACCID`* — replaces the box edge with `BoundingBox::GetCutOutBottom/Top` |
 * | MuseScore | 0.1 sp of clearance for an accidental against 0.4 sp for a notehead |
 * | LilyPond | `accidental-collision` **3**, against `extra-object-collision-penalty` 50 — it will accept a small overlap rather than distort the curve |
 *
 * ⭐ **Verovio's is the one that transfers**, because it is shaped like the glyph rather than like a
 * tuning constant: a sharp has a notch at its lower-left, a flat has none to speak of, and the rule
 * says so by reading the font. We already hold those anchors ({@link anchor}, `bravuraMetrics`), so
 * this is arithmetic on data we have — ⛔ not a number invented to make one bar look better.
 *
 * ⚠️ **It never eats into the rest of the note.** The trim is bounded by the note's ink WITHOUT its
 * accidentals: a slur still clears every notehead, stem, flag and dot in full.
 *
 * ## ⛔⛔ AND IT IS **NOT** AN ENGRAVING-TREATISE RULE — searched, 2026-08-31
 *
 * The library on disk was read for it (`reference/README.md`'s manifest: Gould full text + scans,
 * Ross, Gerou & Lusk, Stone) and the honest verdict is **UNDOCUMENTED**. ⛔ So this cites Verovio,
 * ⛔ never a book. Worse than silent, the two sentences that DO exist prescribe a different remedy:
 *
 * - **Gould p. 130** (in the GRACE-NOTE chapter): *"A slur should always be placed **above** the
 *   notes when it would otherwise collide with the accidentals of a measured value"* — she moves the
 *   slur to the other SIDE.
 * - **Gould p. 71**, for ties: *"Curve a tie away from an added note with an accidental, so that the
 *   two do not collide"*.
 * - ⭐ And her one measured plate goes the other way from a notch: on p. 71 at 1200 dpi the tie
 *   clears the sharp's **bounding rectangle** entirely, passing under it with 0.19 sp of air.
 *
 * ⚠️ There is precedent for the disagreement: `reference/README.md` already records the SMuFL
 * cut-out licence colliding with Gould at p. 92 (*"Do not overlap the flats"* in a key signature,
 * which MuseScore tucks). ⭐ The one number any treatise gives in this frame is **Gould p. 110**: a
 * slur end *"may be placed as close as half a stave-space from the CENTRE of noteheads"* — a
 * centre-relative datum, exactly like the cut-out's.
 *
 * ⏭️ So the SIDE FLIP is the documented answer and we do not do it: our slur side is decided by the
 * stems (`./slurDirection`) and an accidental has no vote. If his eye ever prefers Gould's remedy,
 * that is where it would go — ⛔ not here.
 */
import type { Stave } from 'vexflow'
import { anchor, glyphBox, accidentalGlyph } from '@/engine/fonts/fontMetrics'
import type { GlyphName } from '@/engine/fonts/fontMetrics'
import { noteInkBox, type BoxedNote, type NoteInkRect } from './noteInkBox'
import { staffSpacesToPixels } from './staffSpace'

/** VexFlow's category for the modifiers this module is about. */
const ACCIDENTAL_CATEGORY = new Set(['Accidental'])

/** What this needs of a drawn accidental: which sign it is. ⚠️ The DRAWN one — whether a note prints
 *  an accidental at all is the running-accidental rule's answer, not the model's `alter`. */
interface AccidentalLike {
  getCategory?(): string
  type?: string
}

/**
 * ⭐⭐ **HOW FAR A CURVE MAY TUCK INTO ONE ACCIDENTAL, in staff spaces** — the distance between the
 * glyph's bounding box on the curve's side and its cut-out corner there.
 *
 * ⭐ Read from the font both times, so a font change moves it: `glyphBox(g).down` is the ink's reach
 * below the origin, and `cutOutSW/SE` is where the glyph stops having ink in that corner. Measured
 * for Bravura: a **sharp** may be entered **0.50 sp** from below (box 1.392, notch 0.896 — Verovio's
 * own *"−0.9 instead of −1.392"*), a **flat** only **0.22 sp** (0.700 / 0.476), a **natural** 0.51.
 *
 * ⚠️ **The DEEPER of the two notches on that side wins**, which is Verovio's reading of its three
 * rectangles (`BoundingBox::GetCutOutBottom` takes the second extreme, and for a sharp that is the
 * SW corner's 0.896 rather than the SE corner's 0.596). It is the permissive choice of the two; if
 * his eye finds a slur grazing a sharp, ⭐ THIS is the line to make conservative — take the shallower
 * notch and nothing else changes.
 *
 * @param sign VexFlow's accidental code — `#`, `b`, `n`, `##`, `bb`.
 * @param direction −1 for a curve above the note, +1 for one below.
 * @returns 0 for a glyph the font gives no cut-out on that side (⛔ never a guessed one), and for a
 *   sign we do not measure.
 */
export function accidentalTuckSpaces(sign: string, direction: number): number {
  const glyph = accidentalGlyph(sign)
  if (!glyph) return 0
  const box = glyphBox(glyph)
  // The font's y is UP; a curve BELOW the note is looking at the glyph's lower corners.
  const corners: readonly string[] = direction === 1 ? ['cutOutSW', 'cutOutSE'] : ['cutOutNW', 'cutOutNE']
  const reach = direction === 1 ? box.down : box.up
  let deepest = 0
  for (const corner of corners) {
    const point = anchor(glyph as GlyphName, corner)
    if (!point) continue
    deepest = Math.max(deepest, Math.abs(point[1]))
  }
  // ⛔ Not negative: a cut-out further out than the ink would be a font error, not a licence.
  return deepest === 0 ? 0 : Math.max(0, reach - deepest)
}

/**
 * ⭐⭐ **THE BOX A CURVE HAS TO CLEAR AROUND ONE NOTE** — its ink ({@link noteInkBox}), with the
 * facing edge pulled back into the accidental's notch when it is the accidental that set it.
 *
 * ⚠️ Bounded twice, and both bounds matter: the edge never moves past the note's ink WITHOUT its
 * accidentals (so a notehead, stem, flag or dot is still cleared in full), and the trim is only ever
 * the tuck the FONT allows for the sign that is actually drawn.
 *
 * @param direction −1 above the note, +1 below — which edge the curve is looking at.
 * @returns null exactly when {@link noteInkBox} does: a note VexFlow cannot answer for is not an
 *   obstacle, ⛔ rather than a box at the origin.
 */
export function curveObstacleBox(
  note: BoxedNote,
  direction: number,
  stave: Stave | undefined,
): NoteInkRect | null {
  const full = noteInkBox(note)
  if (!full || !stave) return full
  const bare = noteInkBox(note, ACCIDENTAL_CATEGORY)
  if (!bare) return full

  const tuckSpaces = drawnAccidentalTuck(note, direction)
  if (tuckSpaces <= 0) return full
  const tuck = staffSpacesToPixels(tuckSpaces, stave)

  if (direction === 1) {
    // Below: the edge is the box's bottom, and it may rise by the tuck — but no higher than the
    // bottom of everything that is not an accidental.
    const bottom = Math.max(bare.y + bare.height, full.y + full.height - tuck)
    return { ...full, height: bottom - full.y }
  }
  // Above: the edge is the top, and it may drop by the tuck, no lower than the rest of the ink.
  const top = Math.min(bare.y, full.y + tuck)
  return { x: full.x, y: top, width: full.width, height: full.y + full.height - top }
}

/**
 * The tuck the note's own drawn accidentals allow on that side — the SMALLEST of them, so a chord
 * carrying a sharp and a flat is judged by the one that yields least.
 *
 * ⚠️ Asked of the DRAWN modifiers rather than of the model's `alter`: whether a note prints an
 * accidental at all is the running-accidental rule's answer, and a courtesy or a forced one is ink
 * the curve has to clear like any other.
 */
function drawnAccidentalTuck(note: BoxedNote, direction: number): number {
  const accidentals = (note.getModifiers?.() ?? [])
    .filter((m): m is AccidentalLike => (m as AccidentalLike).getCategory?.() === 'Accidental')
  if (!accidentals.length) return 0
  let least = Infinity
  for (const accidental of accidentals) {
    least = Math.min(least, accidentalTuckSpaces(accidental.type ?? '', direction))
  }
  return least === Infinity ? 0 : least
}
