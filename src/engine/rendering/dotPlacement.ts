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
 * ## The rule
 *
 * ⭐ **Half a staff space, edge to edge — and the same gap twice.** Gould gives half a space between
 * the dots of a double-dotted note (measured from the dot's EDGE, not its centre), and the standing
 * engraving principle is that *the notehead-to-first-dot distance equals the dot-to-dot distance*.
 * One number therefore settles both, and at 10px per space it is **5px**.
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
 * ⛔ **Not rests.** A dotted rest keeps VexFlow's placement: the dot follows a glyph of a quite
 * different shape, and the convention gives it a *smaller* distance than a note's (MuseScore keeps
 * `dotRestDistance` below `dotNoteDistance`). He reported notes; this changes notes.
 */
import { Dot, Stem, StaveNote } from 'vexflow'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** Gould's half a space, as a fraction of one — the gap after the notehead AND between two dots. */
export const DOT_GAP_SPACES = 0.5

/**
 * …in pixels. Pinned to the default staff space like every other engraving number here rather than
 * read per stave, so the room reserved on the width path (which has no stave) and the ink placed on
 * the draw path can never disagree. One place to change if the staff is ever scaled.
 */
export const DOT_GAP_PX = DOT_GAP_SPACES * STAFF_SPACE_PX

/** `Dot.format`'s own dot-to-dot gap — a literal `dotSpacing = 1` in VexFlow. */
export const VEXFLOW_DOT_SPACING = 1

/**
 * The extra width each dot reserves: what the half-space gap asks for beyond the 1px VexFlow
 * already leaves. It is spent twice over, which is the point — `Dot.format` steps the next dot along
 * by `width + dotSpacing` (so two dots end up half a space apart) and adds the total to the note's
 * `rightShift` (so the formatter buys the room the first dot's own shift will need).
 */
export const DOT_RESERVATION_PX = Math.max(0, DOT_GAP_PX - VEXFLOW_DOT_SPACING)

/**
 * Buy the room, in the builder. ⚠️ Call it AFTER the dots are attached — a modifier attached to a
 * note may re-measure itself from its glyph, and a width written first is silently lost (the same
 * trap `ledgerAccidentalClearance` documents for accidentals).
 */
export function reserveDotRoom(note: StaveNote): void {
  for (const dot of Dot.getDots(note)) dot.setWidth(dot.getWidth() + DOT_RESERVATION_PX)
}

/**
 * The gap VexFlow leaves by itself: the literal `2` in `StaveNote.getModifierStartXY`'s RIGHT case.
 *
 * ⚠️ Re-stated here rather than measured, because it CANNOT be measured in this window:
 * `getModifierStartXY` throws `NoYValues` until the note has been drawn (the same rule as
 * `getNoteHeadBeginX` — geometry is not real until the draw), and by then the dot is on the page.
 */
export const VEXFLOW_DOT_BASE_GAP = 2

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
export function dotShift(clearsFlag: boolean): number {
  return clearsFlag ? 0 : Math.max(0, DOT_GAP_PX - VEXFLOW_DOT_BASE_GAP)
}

/**
 * Move the ink, after the format. Every dot of a note moves by the SAME amount: `Dot.format` has
 * already spaced them relative to each other, and shifting them apart would undo that.
 */
export function placeDots(notes: StaveNote[]): void {
  for (const note of notes) {
    if (note.isRest()) continue
    const dots = Dot.getDots(note)
    if (!dots.length) continue
    const shift = dotShift(note.hasFlag() && note.getStemDirection() === Stem.UP)
    if (shift <= 0) continue
    for (const dot of dots) dot.setXShift(dot.getXShift() + shift)
  }
}
