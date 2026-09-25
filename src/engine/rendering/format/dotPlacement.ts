/**
 * ⭐⭐ **HOW FAR AN AUGMENTATION DOT STANDS FROM ITS NOTEHEAD.**
 *
 * His report, off the page: *"the dot is too close to the notehead… for notes with flags looks ok
 * but not for notes with no flags"*, and separately *"in notes with ledger lines the dot seems odd
 * in the position"*. Both are the same number, and the split he spotted is exactly right.
 *
 * ## What we were drawing (measured, staff space = 10px, notehead 12px, dot 4px)
 *
 * | case | gap after the notehead |
 * |---|---|
 * | dotted quarter, no flag | **2px** |
 * | dotted eighth, stem DOWN (its flag is not in the way) | **2px** |
 * | dotted quarter on a ledger line | **2px** — and the ledger's tip ends 1px PAST the dot's left edge |
 * | dotted eighth, stem UP with a flag | 2px + the flag's width ≈ 7px |
 *
 * That 2px is a literal in VexFlow's `StaveNote.getModifierStartXY` (`x = glyphWidth + xShift + 2`),
 * and the only notes that escape it are the stem-up flagged ones the dot has to clear a flag on —
 * which is why those were the ones that looked right to him.
 *
 * ## The rule — ⭐⭐ **A TABLE SINCE 2026-09-14**, and the armed row is his
 *
 * ⭐ **Half a staff space, edge to edge — and the same gap twice.** One number settles both, and at
 * 10px per space it is **5px**. ⭐ That is the `house` row of **`engine/layout/dotGap`**, armed by
 * `__dots.gap(…)`; the eight sourced alternatives are there, and this file no longer holds a
 * constant at all. ⛔ Building the table moved no ink.
 *
 * 🚨 **THE CITATION WAS WRONG, corrected 2026-09-14 by `docs/research/accidental-dot-research.md`.** This
 * paragraph used to credit Gould with the half space *between the dots*. She does not say it: her
 * half space (p. 54) is the **notehead→dot** distance, and about the dots themselves she says only
 * *"close together and evenly spaced"*. ⭐ The number we ship has two real sources — **Ross p. 171**
 * for half a space between dots (his plate draws 0.35–0.53 sp) and **Gerou & Lusk p. 22** for the
 * equal-gaps principle — ⛔ but neither is the one that was named here.
 *
 * ⚠️ And the survey found that *equal* is nobody's drawing: **Gould's own plate measures 0.37 sp
 * after the notehead and 0.26 sp between the dots** — tighter, not equal — and the engines split
 * four ways (LilyPond 0.45/0.45, MuseScore 0.50/0.25, Verovio 0.30/0.35, VexFlow 0.20/0.10;
 * `docs/research/accidental-dot-engines.md`). ⭐ **The 0.5 stands — it is HIS call off the page** — and it is
 * now a house-style choice with its sources straight, ⛔ not a rule the books share.
 *
 * ⭐ It also settles the ledger case with nothing ledger-specific in it: a ledger line overhangs the
 * notehead by 3px, so a dot standing 5px off the head clears its tip by 2. That matters beyond
 * tidiness — a rule that READ the ledger lines would be clef-dependent, and this one may not be
 * (see the reservation below, and `ledgerAccidentalClearance` for the invariant).
 *
 * ## Why it takes two steps
 *
 * The dot's drawn x and the dot's reserved WIDTH are set in different places in VexFlow, so the fix
 * is in two places too:
 *
 *  - {@link reserveDotRoom} runs in `NoteBuilder`, on both the draw and the WIDTH path, and buys the
 *    room. Uniform per dot — never a function of the note's position — so bar width stays
 *    clef-independent. It also widens the dot-to-dot gap to the same half space, because
 *    `Dot.format` steps each dot along by `width + 1`.
 *  - {@link placeDots} runs after `formatter.format`, and moves the ink. It has to be after:
 *    `Dot.format` assigns each dot's `xShift` from scratch.
 *
 * ⭐ **Rests too, since 2026-09-25** (docs/plans/multiple-dots-plan.md P4b): a rest reads its OWN table,
 * `layout/restDotGap` (`gould` armed), through the same two steps. Until then it kept VexFlow's placement —
 * a scope choice of `642c82f` that cited MuseScore's `dotRestDistance`, which MuseScore 4 reads nowhere.
 */
import type { EngravedNote } from '../engraved/EngravedNote'
import { dotsOn } from '../engraved/EngravedDot'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { armedDotGap } from '@/engine/layout/dotGap'
import { armedRestDotGap } from '@/engine/layout/restDotGap'
import { armedDotFlag, flagPushedFirstDot } from '@/engine/layout/dotFlag'
import type { NoteDuration } from '@/types/music'
import { MODIFIER_RIGHT_GAP_PX, VEXFLOW_DOT_SPACING } from '@/engine/engrave/inheritedDefaults'

/** A stem pointing up — VexFlow's `Stem.UP`. */
const STEM_UP = 1

/**
 * ⭐⭐ **THE TWO GAPS ARE A TABLE NOW** — `engine/layout/dotGap`, armed by `__dots.gap(…)`
 * (2026-09-14). ⛔ The armed default is what this file already drew, so the table moved no ink.
 *
 * ⚠️ **Read through a function, ⛔ never captured in a module constant.** A `const` computed at
 * import time would freeze whichever row was armed when the module first loaded, and the console
 * would then report a change the drawing had never seen — the same trap the spacing law and the
 * header ladder each carry a warning about.
 */
function dotGapSpaces(gaps: { head: number } = armedDotGap()): number {
  return gaps.head
}

/** The two gaps a note's dots take — a REST's from its own table (`layout/restDotGap`, P4b). */
function gapsOf(note: EngravedNote): { head: number; dot: number } {
  return note.isRest() ? armedRestDotGap() : armedDotGap()
}

/** …in pixels. Pinned to the score's staff space rather than read per stave, so the room reserved on
 *  the width path (which has no stave) and the ink placed on the draw path can never disagree.
 *
 *  ⭐ A staff can be drawn SMALL and this needs no change: the ink is drawn inside that staff's own
 *  `<g transform="scale(k)">`, so it shrinks with everything else. ⛔ Multiplying by the staff's size
 *  here would scale it twice (docs/plans/staff-size-plan.md §1). */
function dotGapPx(gaps: { head: number } = armedDotGap()): number {
  return dotGapSpaces(gaps) * STAFF_SPACE_PX
}

/** The DOT→DOT gap in pixels — ⚠️ a different number from {@link dotGapPx} in five of the eight
 *  sourced rows, and the whole reason the table has two columns. */
function dotToDotPx(gaps: { dot: number } = armedDotGap()): number {
  return gaps.dot * STAFF_SPACE_PX
}

/** `Dot.format`'s own dot-to-dot gap — re-exported from `engrave/inheritedDefaults`, where it lives. */
export { VEXFLOW_DOT_SPACING }

/**
 * The extra width each dot reserves: what the **DOT→DOT** gap asks for beyond the 1px VexFlow
 * already leaves. It is spent twice over, which is the point — `Dot.format` steps the next dot along
 * by `width + dotSpacing` (so two dots end up the armed gap apart) and adds the total to the note's
 * `rightShift` (so the formatter buys the room the first dot's own shift will need).
 *
 * ⭐ It reads the `dot` column and {@link dotShift} reads the `head` one — which used to be the same
 * number and is not in five of the eight rows (`layout/dotGap`).
 */
export function dotReservationPx(gaps: { dot: number } = armedDotGap()): number {
  return Math.max(0, dotToDotPx(gaps) - VEXFLOW_DOT_SPACING)
}

/**
 * Buy the room, in the builder. ⚠️ Call it AFTER the dots are attached — a modifier attached to a
 * note may re-measure itself from its glyph, and a width written first is silently lost (the same
 * trap `ledgerAccidentalClearance` documents for accidentals).
 */
export function reserveDotRoom(note: EngravedNote): void {
  const extra = dotReservationPx(gapsOf(note))
  for (const dot of dotsOn(note)) dot.setWidth(dot.getWidth() + extra)
}

/**
 * The gap a dot already gets before this rule adds any: where a RIGHT modifier starts past the head
 * (`engrave/notes/modifierStart`, S5a). ⭐ Read from that row rather than re-stated — it used to be a
 * second copy of VexFlow's literal `2`, from the days when the note's own answer could not be asked in
 * this window (`getModifierStartXY` throws `NoYValues` until the note has been drawn).
 */
export const VEXFLOW_DOT_BASE_GAP = MODIFIER_RIGHT_GAP_PX

/**
 * How much further out a dot has to stand. `clearsFlag` is the one case VexFlow already handles —
 * a stem-up note of a flagged duration, whose dot it pushes past the flag's width — and there the
 * answer is nothing: the gap is already wider than half a space, and this rule only ever OPENS a
 * gap, never closes one.
 *
 * ⏭️ Known and left alone: VexFlow applies that flag shift by DURATION, so a *beamed* eighth gets
 * it too and its dot stands ~7px out with no flag to clear. Wider than the rule wants, narrower
 * than a fault — and pulling it in would move ink he did not report.
 */
export function dotShift(clearsFlag: boolean, gaps: { head: number } = armedDotGap()): number {
  return clearsFlag ? 0 : Math.max(0, dotGapPx(gaps) - VEXFLOW_DOT_BASE_GAP)
}

/**
 * ⭐ How far a stem-up FLAGGED note's dots must move past where they start with no flag in the way — the
 * armed `layout/dotFlag` row (P4c), in px; 0 when the flag does not push them.
 *
 * `vexflow`: the flag's drawn width, as `forceFlagRight` added it. Any other row: the rule's first-dot
 * position (staff spaces past the head's anchor) less where the dot starts now (the head's measured width
 * and VexFlow's 2 px) — asked with the dot's HEIGHT and the stem's LENGTH off the drawn note, so `level` is
 * answered about THIS note.
 */
export function flagPushPx(note: EngravedNote): number {
  if (note.isRest() || !note.hasFlag() || note.getStemDirection() !== STEM_UP) return 0
  if ('vexflow' in armedDotFlag()) return note.getFlagWidthPx()
  // ⚠️ Asked of the note's KEYS, ⛔ not its ys: this runs before the note stands on its stave. A line is
  //    one staff space; the stem-up chord's TOP key is the one its flag meets, and the stem runs to it from
  //    the BOTTOM key (`getStemLength` is measured from there).
  const lines = note.getKeyProps().map(row => row.line)
  const top = lines.indexOf(Math.max(...lines))
  const dot = dotsOn(note).find(d => d.getIndex() === top)
  const geometry = {
    dotY: dot ? dot.getShiftY() : 0,
    stemLength: note.getStemLength() / STAFF_SPACE_PX - (Math.max(...lines) - Math.min(...lines)),
  }
  const pushed = flagPushedFirstDot(note.getDuration() as NoteDuration, geometry)
  if (pushed === null) return 0
  return pushed * STAFF_SPACE_PX - (note.getGlyphWidth() + VEXFLOW_DOT_BASE_GAP)
}

/**
 * Move the ink, after the format. Every dot of a note moves by the SAME amount: `Dot.format` has
 * already spaced them relative to each other, and shifting them apart would undo that. The move is the
 * LATER of the head gap's and the flag's (P4c).
 */
export function placeDots(notes: EngravedNote[]): void {
  for (const note of notes) {
    const dots = dotsOn(note)
    if (!dots.length) continue
    const shift = Math.max(dotShift(false, gapsOf(note)), flagPushPx(note))
    if (shift <= 0) continue
    for (const dot of dots) dot.setXShift(dot.getXShift() + shift)
  }
}
