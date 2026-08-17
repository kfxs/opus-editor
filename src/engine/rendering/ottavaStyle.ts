/**
 * Styling constants for the OTTAVA — the numeral and its dashed bracket (docs/ottava-plan.md §1, P3).
 *
 * `./trillStyle`'s twin, and deliberately the same shape: the family's two clearance numbers, the
 * glyph size, and how far the sign's ink reaches from its own baseline. Everything vertical that is
 * not a measurement of the MUSIC is here, so the renderer holds no numbers of its own.
 *
 * ⚠️ **Codepoints written out, never `Glyphs.xxx`.** VexFlow's `Glyphs` object is CJS-only and
 * resolves to `undefined` in the browser build — a bug that shows as a blank score rather than as an
 * error (`reference_vexflow_glyphs_esm_vs_cjs`). The values below were read out of the table VexFlow
 * itself ships (`build/esm/src/glyphs.js`), so they are the font's own, not remembered.
 */
import type { Clearance, MarkInk } from '@/engine/layout/inkBand'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { DYNAMIC_TEXT_FONT } from './dynamicStyle'

/**
 * ⭐⭐ **The numeral, keyed by the SIGNED shift — HIS CALL, 2026-08-13: `8va` and `8ba`.**
 *
 * > *"unicode for ottava alta should be `\uE511`"* … *"for bassa should be `\uE513`"*
 *
 * SMuFL `ottavaAlta` (E511) and `ottavaBassaBa` (E513) — the **alta/bassa** forms, not the bare
 * numeral. ⛔ This overrules Gould, deliberately and on the record: *Behind Bars* pp. 28–34 argues
 * the suffix is redundant because the side of the staff and the hook already say the direction, and
 * the first build drew her bare `8` (E510) for both. He wants the suffix. Sibelius and MuseScore
 * default the same way, so this is also the familiar reading rather than the scholarly one.
 * ⭐ Note `8ba` is still one of Gould's OWN four forms (E510–E513 are her four, in her order) — what
 * was rejected is the bare numeral, not the vocabulary. ⛔ Not `8vb` (E51C), which is the one form
 * her list excludes.
 *
 * ⭐⭐ **SIGNED, and that is the change his decision forces.** The first version keyed on `|shift|`
 * because a bare `8` reads the same either way and the SIDE carried the direction. `8va` and `8ba`
 * are different glyphs, so the sign is now part of the lookup — the picture says the direction twice
 * (in the glyph and in the side), which is exactly the redundancy Gould was arguing against and he
 * has asked for.
 *
 * ⚠️ **The ±2 / ±3 rows are an EXTRAPOLATION from his two picks, not his call**, and they are
 * unreachable today (the palette has only `8va` / `8vb` rows). They follow the same FORM he chose —
 * the alta suffix and the compact bassa: `15ma`/`15mb`, `22ma`/`22mb`. One row each to change.
 *
 * ⭐ Keyed by a NUMBER, never by a printed string: Gould warns specifically about the French `16`
 * for two octaves, and a score storing `'15ma'` as text would have two ways to say one thing.
 */
export const OTTAVA_NUMERAL_GLYPHS: Readonly<Record<-3 | -2 | -1 | 1 | 2 | 3, string>> = {
  1: '\uE511',   // ottavaAlta — "8va"          ⭐ his call
  '-1': '\uE513', // ottavaBassaBa — "8ba"       ⭐ his call
  2: '\uE515',   // quindicesimaAlta — "15ma"   ⚠️ extrapolated
  '-2': '\uE51D', // quindicesimaBassaMb — "15mb" ⚠️ extrapolated
  3: '\uE518',   // ventiduesimaAlta — "22ma"   ⚠️ extrapolated
  '-3': '\uE51E', // ventiduesimaBassaMb — "22mb" ⚠️ extrapolated
}

/**
 * ⭐⭐ **The parentheses around a CONTINUATION numeral — ITALIC TEXT, his call 2026-08-13.**
 *
 * > *"lets try the parenthesis of the continuation in italic to see how it looks."*
 *
 * ⚠️⚠️ **Italic FORCED the glyphs to change, and that trade is the whole note here.** The first
 * build used SMuFL's own `octaveParensLeft`/`Right` (U+E51A/E51B) — dedicated glyphs, drawn to the
 * octave numerals' height and weight, aligned by construction. But `font-style: italic` on a MUSIC
 * font does nothing: the family owns no italic face and the browser will not synthesise one. That is
 * not a guess — it is `trillStyle`'s recorded lesson, from his report *"no italic"* when the trill's
 * `(tr)` came out bolt upright. So italic parens must be TEXT, in a family with a true italic face.
 *
 * ⭐ **The argument FOR his call**: SMuFL's octave numerals are themselves italic by design, so an
 * upright bracket sits against `8va` at a visibly wrong slant — the same reason the trill's parens
 * are italic.
 * ⚠️ **The argument against, stated so the trade is revertible rather than forgotten**: E51A/E51B
 * align with the numerals *by construction*, and these do not — {@link OTTAVA_PAREN_SCALE} and
 * {@link OTTAVA_PAREN_RAISE} are now doing by hand what the font did for free. ⏭️ Reverting is
 * three constants: `'\uE51A'` / `'\uE51B'`, drawn through the same `glyph()` path as the numeral.
 */
export const OTTAVA_PAREN_LEFT = '('
export const OTTAVA_PAREN_RIGHT = ')'

/** The serif stack the parens are set in — the one face in play with a TRUE italic. Shared with the
 *  trill's, so the two families' brackets cannot drift apart. */
export const OTTAVA_PAREN_FONT = DYNAMIC_TEXT_FONT

/**
 * Paren size as a fraction of {@link OTTAVA_GLYPH_SIZE} — a fraction, not its own px value, so the
 * two cannot drift when the numeral is retuned.
 *
 * ⚠️ **Taste, and starting from the trill's 0.52** — which was itself tuned against his eye alone
 * (0.85 *"definitely too big"*, 0.62 *"still a tiny big"*). ⚠️ But `8va` is a WIDER mark than a `tr`,
 * so this may want to come up; it is the first number to try if the brackets look mean.
 */
export const OTTAVA_PAREN_SCALE = 0.52

/**
 * How far the parens are RAISED off the numeral's baseline, as a fraction of their own size.
 *
 * ⚠️ It cannot be zero: a text paren DESCENDS below its baseline and the octave numerals do not, so
 * sharing a baseline hangs the brackets below the sign. ⚠️ Taste, from the trill's 0.22 — and this
 * is the number the switch away from E51A/E51B put in play, since those needed no raise at all.
 */
export const OTTAVA_PAREN_RAISE = 0.22

/** px, at full staff size — the trill's 26, because the two are the same weight of mark and are read
 *  at the same distance. ⚠️ Gould gives the numeral's height in stave spaces and that page is one of
 *  the three the plan flags as unread (§1, "owed to the book"); this is a first cut, not her number. */
export const OTTAVA_GLYPH_SIZE = 26

/*
 * Tight vertical ink extent of the numeral, from its own text baseline, in px.
 *
 * ⚠️ **First-cut proportions, not a measurement** — a glyph measures 0×0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a number computed at load would be a number agreeing
 * with itself. The honest measurement belongs to the browser suite. Like `ornamentTrill`, the octave
 * numerals sit essentially ON the baseline with nothing descending, which is why BELOW is so small.
 */
const OTTAVA_GLYPH_INK_ABOVE = OTTAVA_GLYPH_SIZE * 0.62 // baseline → glyph top
const OTTAVA_GLYPH_INK_BELOW = OTTAVA_GLYPH_SIZE * 0.04 // baseline → glyph bottom

/**
 * How far the numeral's ink reaches either side of its baseline, in STAFF SPACES.
 *
 * ⭐ In the staff's own spaces, which is why no staff size appears here or in the renderer: the
 * numeral is drawn inside the staff's `scale(k)` group at a fixed px size, so a small staff's glyph
 * is the same number of ITS spaces as a full-size one's. `trillStyle`'s arrangement verbatim.
 */
export const OTTAVA_MARK_INK: MarkInk = {
  above: OTTAVA_GLYPH_INK_ABOVE / STAFF_SPACE_PX,
  below: OTTAVA_GLYPH_INK_BELOW / STAFF_SPACE_PX,
}

/**
 * ⭐ The octave line's two clearance numbers.
 *
 * ⭐⭐ **Its RUNG is not these numbers — it is the pass order**, and that distinction is the ladder.
 * The ottava is drawn after the dynamics line and the trill and reads what they claimed
 * (`layout/outsideStaffBand`), so it clears them whatever their floors are. That follows LilyPond's
 * `outside-staff-priority` (OttavaBracket **400** against DynamicLineSpanner 250 and TrillSpanner 50).
 * ⛔ There is no priority table and there must never be one.
 *
 * 🚨🚨 **The SECOND source once cited here has been WITHDRAWN (2026-08-17).** This comment used to add
 * "and Gould, who says octave lines sit *outside all other notations*" — that sentence is real (p. 29)
 * but it is her general *don't collide with anything* rule, not a ranking. Her ranking against
 * DYNAMICS is p. 101–102 and puts the octave bracket **INSIDE** them, with a drawn correct/incorrect
 * pair whose "incorrect" half is what we draw today. So the two sources disagree and this follows
 * LilyPond alone. ⏭️ Changing it is an open decision, not a tidy-up — see docs/ottava-plan.md §1 rule
 * 5 and §5, which carry the pages, the measurements and why the fix is not a one-line pass move.
 *
 * ⚠️ So `minFromStaff` is only the FLOOR for a bar where nothing else is beside the staff — it is not
 * what orders the ottava against a dynamic. It is set between the TRILL's 1.0 and the DYNAMICS' 2.1
 * so that even on an empty system the families come out in their proper order, which is a
 * belt-and-braces reading of the ladder rather than the mechanism.
 *
 * **It was 2.5 until 2026-08-17**, chosen to sit between the dynamics' 2.1 and the tempo's 3.0 while
 * the bracket was OUTSIDE the dynamics. 1.5 puts it between the trill's 1.0 and the dynamics' 2.1,
 * which is where the rung now is.
 *
 * ⚠️⚠️ **BUT IT IS NOT LOAD-BEARING, and the honest record matters more than the tidy story.** I
 * predicted this constant would go silently backwards when the rung moved, and BREAK-TESTED IT: with
 * 2.5 restored, the below-staff order still comes out right, in both the bare-floors case and the
 * lopsided one. The reason is that the dynamics now READ this bracket's claim — so wherever its floor
 * puts it, they go outside it. The floor stopped deciding the ORDER on the day it stopped needing to.
 * ⭐ So this is a number about how close a bracket sits to bare music, and nothing else. Taste, and
 * OWED TO HIS EYE, as 2.5 was before it.
 *
 * ⚠️ Gould's p. 102 engraving, measured, puts the bracket's line 4.0 sp from the staff and the
 * dynamic's ink at ≈5.5 — but that is with music between them, so it prices the PADDING, not this.
 *
 * ⚠️ **Taste, and owed to his eye** — the trill's 0.5/1.0 were too, and were tuned by looking.
 */
export const OTTAVA_LINE: Clearance = {
  padding: 0.5,
  minFromStaff: 1.5,
}

/** Gap between the numeral and the start of the dashed line, in staff spaces — the trill's
 *  `TRILL_SIGN_GAP`, for the same reason: the line reads as leaving the sign rather than touching it. */
export const OTTAVA_NUMERAL_GAP = 0.3

/**
 * ⭐⭐ **How high the dashed line runs above the numeral's baseline — PER SIDE**, in staff spaces.
 *
 * ⚠️⚠️ **Two of his reports converged on this, and the second corrected the first.** It began
 * mirrored (`baseline + raise` under the staff): *"for ottava bassa is too low"* — the line was
 * under its own numeral, which is a real bug, since a glyph grows the same way from its baseline on
 * either side (`markBand` says so). Un-mirroring made both sides identical, and then: *"now the line
 * for ottava bassa is too up."* ⭐ **Measured, the two ARE identical** — 8.06 px above the baseline,
 * 0.442 of the ink box, on both — so the second report is not a mirroring bug. It is that an 8vb
 * wants a DIFFERENT attachment, not the same one.
 *
 * ⭐ **And that is what engraving does.** The bracket closes toward the staff: an 8va's hook turns
 * DOWN, so its horizontal runs along the TOP of the numeral; an 8vb's hook turns UP, so its
 * horizontal runs along the numeral's FOOT. A line at mid-height under the staff has the hook
 * rising out of the middle of the glyph, which is what "too up" is describing.
 *
 * ⚠️ Both numbers are taste and both are his. `ABOVE` is a fraction of the glyph's own ink so the
 * two cannot drift when {@link OTTAVA_GLYPH_SIZE} is retuned; `BELOW` is 0 — the baseline itself,
 * which is where `8ba`'s foot sits.
 */
export const OTTAVA_LINE_RAISE_ABOVE = OTTAVA_MARK_INK.above * 0.5
export const OTTAVA_LINE_RAISE_BELOW = 0

/**
 * The dash pattern, in staff spaces: ink, then gap.
 *
 * ⚠️ In SPACES and converted at the draw site, not in px — a small staff's dashes must be the same
 * number of ITS spaces or a reduced staff gets a visibly coarser line (the bug class
 * `project_staff_size_plan` calls "visual coords in a scaled scope").
 */
export const OTTAVA_DASH_LENGTH = 0.5
export const OTTAVA_DASH_GAP = 0.4

/**
 * ⭐⭐ **How far LEFT of the first note a CONTINUATION numeral sits**, in staff spaces.
 *
 * > **His report, 2026-08-13, with a screenshot:** *"the parenthesis for continuation looks good,
 * > but the x position of the continuation is more to the right than i expected… basically it should
 * > be more to the left."*
 *
 * ⚠️ **The cause: `planSlurSegments`' left edge is `noteStartX`** — where NOTES may begin, i.e. after
 * the clef, key and meter. For a slur that is exactly right (an arc resumes where the music does),
 * and the ottava inherited it, which put `(8va)` directly over the first notehead. A resumed numeral
 * is not part of the music though — it is a REMINDER, read before the first note rather than with
 * it, so it belongs in the space the clef sits in.
 *
 * ⭐ Stated as a shift from `noteStartX` rather than as "the stave's x", so it cannot land ON the
 * clef: it is clamped at the bar's own left edge (`measureX`) at the draw site, and tuning it is one
 * number. ⚠️ Taste — his eye picks the value.
 *
 * ⏭️ The TRILL's `(tr)` has the same defect and this does not fix it: `trillStyle`'s comment claims
 * its parenthesised label sits "at the system's left edge" and it too is really at `noteStartX`.
 * Worth carrying over once he has a number he likes here.
 */
export const OTTAVA_CONTINUATION_INSET = 2.0

/**
 * ⭐⭐ **AIR BEFORE THE HOOK — the bracket runs a little PAST the notehead it ends on, so the hook
 * comes down clear of it rather than hard against it.**
 *
 * > **His call, 2026-08-13:** *"we should add air after the end of the note so the end is not
 * > strictly but we have a little more room"* — *"im talking about the hook."*
 *
 * ⭐ **The hook is what makes flush wrong.** The dashed line could stop exactly at the notehead and
 * look fine; the hook cannot, because it is a vertical stroke turning DOWN toward the staff at that
 * same x — landing it on the note's far edge puts a line beside the notehead it is meant to enclose.
 * The bracket has to finish *around* its last note, not *on* it.
 *
 * ⚠️ **It is the TRILL's `TRILL_END_INSET` inverted, and the inversion is the point.** A trill's
 * line stops SHORT of what it runs up to, because it would otherwise read as running INTO the next
 * note — clearance from a NEIGHBOUR. This is room around the bracket's OWN end.
 *
 * ⭐ It softens §1 rule 2 rather than breaking it: Gould's rule is that the line ends at the last
 * NOTE and not at the end of its duration — the thing it rules out is running on to the barline —
 * and half a space of air is still "at the last note". ⛔ What must never come back is reading the
 * span to the slot's end, which is the neighbours' rule and is the case rule 2 exists to refuse.
 *
 * ⚠️ Applied to the SPAN's end BEFORE it is cut into pieces, so a fragment ending at a SYSTEM BREAK
 * never gets it — that end is the margin, and there is nothing there to leave room around.
 * `TrillRenderer` makes the same arrangement for the same reason.
 *
 * ⚠️ Taste, starting at the trill's own half-space by eye.
 */
export const OTTAVA_END_AIR = 0.5

/**
 * ⭐⭐ **The shortest horizontal a CLOSED bracket may have**, in staff spaces — and it exists because
 * the honest geometry can produce a bracket with no line at all.
 *
 * A continuation fragment carrying `(8)` is three glyphs wide; the music it covers on that system
 * may be a single notehead, which is narrower. Gould's rule 2 then puts the line's end LEFT of where
 * the numeral finishes, and the bracket would draw a numeral, no horizontal, and — under rule 3,
 * which forbids a hook with no line above it — no hook either. The reader is left with a `(8)` and
 * nothing saying where the displacement stops, which is the one thing a continuation must say.
 *
 * ⭐ So a fragment carrying the span's END is never shorter than this past its numeral. ⚠️ It is the
 * ONE place the drawing knowingly overruns rule 2, by at most a space, and only where obeying it
 * exactly would leave the statement unclosed. A non-final fragment needs nothing of the sort: it
 * runs to the system's margin and is meant to look unfinished.
 */
export const OTTAVA_MIN_LINE = 1.0

/**
 * ⭐ **The closing HOOK's length**, in staff spaces — it turns down toward the staff for an 8va and
 * up for an 8vb, which is half of what tells the reader the direction (§1 rule 4).
 *
 * ⭐⭐ **§1 rule 3: a hook NEVER dangles.** Every hook belongs to a squared-off bracket, so the
 * renderer draws one only on the fragment carrying the span's true end and only when that fragment
 * actually has a horizontal line. A hook alone at a system break would claim the line stopped there.
 */
export const OTTAVA_HOOK = 0.8
