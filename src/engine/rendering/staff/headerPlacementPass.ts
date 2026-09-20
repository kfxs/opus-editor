/**
 * ⭐⭐ **WHERE EACH SIGN OF THE HEADER STANDS — P5b's second half, and the pair P5 is NAMED after.**
 *
 * > *"`headerInk.ts` already MEASURES what a clef and a meter cost; `Stave` still PLACES them."*
 *
 * P5b took the header's INK one glyph at a time (the clef 2026-09-02, the meter 09-12, the opening
 * barline 09-13). This is the other set of numbers: the **x** of each of those signs. It replaces
 * `clefIndentPass`, which nudged the clef by a DIFFERENCE from where VexFlow had left it.
 *
 * ## ⭐ THE RULE — each sign is placed from the INK of what precedes it
 *
 * | sign | its ink begins | source |
 * |---|---|---|
 * | the **CLEF** that opens a line | {@link CLEF_INDENT} **0.7 sp** inside the staff's left edge | Gould p. 6 (*"indented into the stave by one stave-space or a little less"*, drawn 0.67–0.74), Ross p. 144 (*"½ to 1 space"*), Gerou & Lusk (0.62–0.70); LilyPond 0.80, MuseScore 0.75 |
 * | the **KEY SIGNATURE** | `CLEF_TO_KEY_INK` past the clef's ink | already ours — `KeySignaturePass.firstSignX` |
 * | the **METER**, after a key signature | `KEY_TO_METER_INK` past the signature's ink | already ours |
 * | the **METER**, after a clef | {@link armedClefMeterInk} past the clef's ink | ours since `8849d2e` — ⚠️ it reached the page as VexFlow's `customPadding` until this pass, and now it is a PLACEMENT like its twin |
 * | the **METER**, after nothing but the BARLINE | `armedBarlineMeterInk` past the barline's ink | ⭐ the books state this one — Stone p. 46, armed at **1.0** (`layout/barlineMeterGap`) |
 *
 * ⭐⭐ **"PLACED, not shifted", and it is the whole point of the step.** A shift is an opinion about
 * somebody else's number: it says *"wherever `Stave.format()` left this, add 0.2"*, so the drawn
 * position is VexFlow's 0.5 — its own opening barline's width, which nobody chose — plus a
 * correction. ⇒ two numbers describing one distance, which is precisely the pair this phase exists
 * to close. Placing states the distance once, from the boundary, and ⛔ nothing of VexFlow's is left
 * inside the answer.
 *
 * ⚠️ **A clef's ORIGIN is not its ink**, so the origin is set back by the glyph's left side bearing
 * (`gClef` and `cClef` 0, `fClef` **0.02 sp**) — the same correction `placeMeterAfterKeySignature`
 * has always made for a digit's −0.08. ⭐ It is what makes *"the ink begins at 0.7"* true rather than
 * true-to-within-a-bearing: a bass clef moves 0.2 px left, and is the only thing in the score that
 * moves.
 *
 * ## ⛔ What this does NOT place, and why each is left
 *
 * | ⛔ still just the WALK's position (`engrave/staff/signWalk`, ours since S4b1) | why |
 * |---|---|
 * | a **MID-LINE clef change** | it sits at VexFlow's 0.5 sp — *its own barline's width*. ⏳ **UNCHOSEN**, and choosing it is a rule about a clef after a barline (Gould p. 42–43 allows *"a stave-space… on either side of a barline"*), which belongs to the CLEF REVIEW and is HIS. ⛔ A migration may not decide it |
 * | ~~a **MID-LINE meter change** with no clef~~ | ✅ **taken 2026-09-13** — the books state this one (Stone p. 46, *"one staff-line space after the barline"*), armed at 1.0 in `layout/barlineMeterGap` |
 * | the opening **BARLINE** | it stands ON the boundary; there is nothing to place it from |
 *
 * ⭐ **So ONE case is left, and it is not really this module's**: a mid-line CLEF change. The books
 * are unanimous that a clef change belongs **BEFORE** the barline (Gould p. 8, *"the clef always goes
 * before the barline"*; Ross p. 167 and Gerou & Lusk p. 51 forbid the other arrangement outright), and
 * two of the three engines place it there. ⇒ its 0.5 is not a gap to tune but a SIDE to change, which
 * is a model widening and HIS — `docs/how-it-works/clef.md` §0.1a.
 *
 * ## 🚨 THE SEQUENCE IS LOAD-BEARING (three wrong attempts, all caught by the BROWSER suite)
 *
 * This must run **after** `applyLeadIn` has forced `Stave.format()` (a modifier has no `x` before
 * that) and **before** `spreadHeaderToSystem` (which divides every BEGIN modifier's offset from the
 * stave by the staff's scale — a page distance added afterwards would live in a scaled space and a
 * small staff's header would land 1/k too far right). ⛔ And the sign's `signX`, ⛔ never its `signShift`:
 * only `signX` is what that pass converts. ⭐ A hand nudge (`clefOffsetPass`) is a `signShift` applied later still,
 * so the two compose rather than fight.
 */
import type { EngravedStave } from '../engraved/EngravedStave'
import type { Clef, KeySignature } from '@/types/music'
import { CLEF_INDENT } from '@/engine/layout/headerInk'
import { KEY_TO_METER_INK } from '@/engine/layout/keySignatureLayout'
import { armedClefMeterInk } from '@/engine/layout/clefMeterGap'
import { armedBarlineMeterInk } from '@/engine/layout/barlineMeterGap'
import { clefOriginX } from '@/engine/engrave/header/clef'
import { meterOriginX } from '@/engine/engrave/header/meter'
import { clefGlyph, glyphBox } from '@/engine/fonts/fontMetrics'
import { keySignatureInkRight } from './KeySignaturePass'
import { THIN_BARLINE_PX } from './barlineInk'
import { barFrame, staveFrame } from './staveFrame'
import { signRun } from './signRun'

/**
 * Place every header sign this bar draws that we have a rule for.
 *
 * ⛔ Silent about everything else: a bar with no clef and no meter, a mid-line change, the cautionary
 * signs at the END — all keep the positions the stave's walk gave them (`engrave/staff/signWalk`).
 */
export function placeHeaderRun(
  stave: EngravedStave,
  isFirstInLine: boolean,
  clef: Clef,
  key: KeySignature | undefined,
): void {
  if (isFirstInLine) placeOpeningClef(stave, clef)
  placeMeter(stave, clef, key)
}

/**
 * ⭐ **The clef that opens a line, at its engraved indentation** — and the rest of the header run
 * moves with it.
 *
 * ⚠️ **The whole run, ⛔ except the barline it is measured FROM.** A key signature is drawn by
 * `KeySignaturePass` from this clef's own ink, so it follows without being touched; the meter is
 * re-placed a line later anyway. What the shared move protects is any BEGIN modifier we have no rule
 * for yet — it keeps its distance from the clef instead of being left behind, which is the behaviour
 * `clefIndentPass` had and the reason it moved more than the clef.
 */
function placeOpeningClef(stave: EngravedStave, clef: Clef): void {
  const { opening } = stave.signs()
  const clefSign = opening.find(sign => sign.signKind === 'clef')
  if (!clefSign) return
  const space = staveFrame(stave).spacePx
  const target = clefOriginX(barFrame(stave).x, CLEF_INDENT, glyphBox(clefGlyph(clef)).left, space)
  const dx = target - clefSign.signX
  if (dx === 0) return
  for (const other of opening) {
    if (other.signKind === 'barline') continue
    other.signX += dx
  }
}

/**
 * ⭐⭐ **The meter, at a stated distance past the ink of whatever precedes it** — the key signature if
 * this bar draws one, otherwise the clef.
 *
 * 🚨 **Those two used to be engraved two different ways, and the seam was invisible.** With a key
 * signature the meter was PLACED from ink at a number we chose (`placeMeterAfterKeySignature`, which
 * this absorbs); without one it was WALKED there — `x += clef.getWidth()` off a runtime `measureText`
 * — and the gap arrived as `TimeSignature.customPadding`, which `EngravedStave` had been computing
 * from {@link armedClefMeterInk} since `8849d2e`. ⭐ Same number, two mechanisms; now one.
 *
 * ⚠️ **And the mechanism mattered, not just the tidiness**: a padding is added to whatever the walk
 * had accumulated, so the clef's drawn width — a font measurement taken at render time — was still
 * deciding where the meter stood. ⛔ Placing from `glyphBox` means the header's x's no longer depend
 * on `measureText` at all, which is what lets them be asserted in jsdom.
 *
 * ⛔ Declines when nothing it has a rule for precedes the meter — a mid-line meter change with no
 * clef keeps the walk's position. See the module header's table.
 */
function placeMeter(stave: EngravedStave, clef: Clef, key: KeySignature | undefined): void {
  const meterSign = stave.signs().opening.find(sign => sign.signKind === 'meter')
  if (!meterSign) return
  const origin = meterOrigin(stave, clef, key, staveFrame(stave).spacePx)
  if (origin === undefined) return
  meterSign.signX = origin
}

/**
 * The meter's ORIGIN, from whichever sign precedes it — or `undefined` when that is nothing this
 * pass has a rule for.
 *
 * ⭐ The gap is keyed on the PAIR, like every other distance in this engine: `KEY_TO_METER_INK`
 * (LilyPond's `KeySignature.space-alist`) after a signature, {@link armedClefMeterInk} (his `stone`,
 * 1.0 sp) after a clef.
 *
 * ✅✅ **THE TWO ARMS ARE ONE RULE AGAIN (2026-09-13), and the detour is the part worth keeping.**
 * They briefly converted ink→origin with OPPOSITE signs, each "verified" by its own browser spec.
 * Both specs were wrong the same way: `getBoundingClientRect` rounds an ink box outward by up to a
 * device pixel per side, so a white gap reads **~0.2 sp too small** — more than the 0.16 the two
 * signs differ by ([[reference_the_browser_ink_reader_inflates_every_box]]). ⇒ 🚨 **the instrument
 * confirmed whichever form was tried last.** Calibrated against glyphs of known width, `+ left` is
 * right — and it is what all three engines compute (`docs/research/ink-anchors-and-side-bearings.md`).
 * ⭐ So there is one conversion, {@link meterOriginX}, and the arms differ only in **what precedes
 * the meter** and **which gap belongs to that pair** — which is all they ever should have.
 */
function meterOrigin(
  stave: EngravedStave, clef: Clef, key: KeySignature | undefined, space: number,
): number | undefined {
  const bearing = glyphBox('timeSig4').left
  if (key && key.alterations.length > 0) {
    return meterOriginX(keySignatureInkRight(stave, clef, key) + KEY_TO_METER_INK * space, bearing, space)
  }
  const clefSign = signRun(stave).clef
  // ⭐ Nothing in front of it but the boundary ⇒ a MID-LINE meter change, and the books give that
  //   pair its own number (`layout/barlineMeterGap` — Stone p. 46, armed at 1.0 by his call).
  //   ⚠️ The anchor is the barline's INK RIGHT, ⛔ not the boundary: the line grows RIGHTWARD from
  //   the boundary (`engrave/staff/openingBarline`'s rule 2), so its ink ends a thickness later.
  if (!clefSign) {
    return meterOriginX(
      barFrame(stave).x + THIN_BARLINE_PX + armedBarlineMeterInk() * space, bearing, space)
  }
  // ⚠️ The clef's ink from the FONT, ⛔ not its modifier box: the box is a `measureText`, and a
  // placement built on one cannot be checked without a browser. ⭐ `firstSignX` already reads the
  // clef this way to place the key signature, so this is the same measurement, not a second opinion.
  // 🚨 `getX()` alone is never the answer — a hand offset lives in `getXShift()`
  // (`reference: a clef's getX is its unshifted origin`).
  const inkRight = clefSign.x + clefSign.xShift
    + glyphBox(clefGlyph(clef)).right * space
  return meterOriginX(inkRight + armedClefMeterInk() * space, bearing, space)
}
