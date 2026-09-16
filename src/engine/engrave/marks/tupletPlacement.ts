/**
 * ⭐⭐ **HOW FAR OUT A TUPLET'S BRACKET AND NUMERAL STAND** — S8 of `docs/vexflow-removal-map.md`
 * (`Tuplet.getYPosition`).
 *
 * ## ⭐ What the rule IS
 *
 * > **Outside everything, on one side.** The mark clears the staff, every stem tip and notehead in
 * > the group, and any text already stacked between them — whichever is furthest out wins — and a
 * > tuplet nested inside another steps out again.
 *
 * ⚠️ It is a MAXIMUM, ⛔ not a sum: the mark is pushed out by the note that reaches furthest and is
 * unmoved by the rest. That is why every row below is a *clearance*, and why the whole thing is one
 * `Math.min` (above) or `Math.max` (below) over the group.
 *
 * ## ⭐ The numbers are ROWS, and their alternatives are already sourced
 *
 * `docs/tremolo-tuplet-research.md` **U4** is the preset table for {@link TUPLET_AIR}, U5 for the
 * bracket's horizontal overhang and U6 for its legs (both of which live in the drawing, not here).
 * That document states its own rule — *"every number that runs today stays the default"* — so this
 * port keeps VexFlow's values exactly and **moves no pixel**.
 *
 * ⚠️ **Gould disagrees with two of them, and it is written down rather than acted on**: she places
 * the bracket much closer (*"the bracket ends and the edge of a numeral may intersect a stave-line"*,
 * p. 199, with the line only ≈0.5 outside the staff against our 1.5), and every source puts the
 * bracket flush with the noteheads where we overhang by 0.5. ⛔ Both are HIS calls and neither is
 * this port's business (rule 13 — a number never blocks a step).
 *
 * ## ⛔ What is NOT here
 *
 * - **Which side the tuplet goes on.** `location` arrives decided.
 * - **The bracket's own drawing** — its ends, its legs, the gap it leaves for the numeral. That is
 *   `rendering/ScoreTuplet.draw`, which has two deliberate differences from VexFlow's and documents them.
 * - **How many tuplets are nested.** Counting the stack is a question about the note graph;
 *   {@link TupletPlacement.nestedDepth} arrives counted.
 */
import type { StaffFrame } from '../staff/staffFrame'
import { staffLineY } from '../staff/staffFrame'

/**
 * ⭐ **The air the mark keeps from each thing it has to clear, in staff spaces.** Taken from
 * `tuplet.js:132-165`; alternatives in `docs/tremolo-tuplet-research.md` U4.
 *
 * ⚠️ `staffAbove` and `staffBelow` are **not equal**, and that asymmetry is VexFlow's rather than a
 * rule anyone states. ⛔ Not tidied into one number: doing so would move the mark on every tuplet that
 * sits below a staff, which is a picture change and not a port.
 */
export const TUPLET_AIR = {
  /** Above: clear of the staff's TOP line. */
  staffAbove: 1.5,
  /** Below: clear of the staff's bottom line — or of the lowest line any modifier text has claimed. */
  staffBelow: 2,
  /** Clear of a stem's TIP, on either side. */
  stemTip: 1,
  /** Clear of a NOTEHEAD — the end of the stem the note is written on. */
  notehead: 2,
  /** Above: clear of text already stacked over the note (an articulation, an annotation). */
  modifierText: 2,
} as const

/**
 * How far a nested tuplet steps out past the one containing it, in staff spaces. Taken from
 * `Tuplet.NESTING_OFFSET` = 15 (`tuplet.js:19`).
 */
export const TUPLET_NESTING_STEP = 1.5

/** The mark stands above its notes (`1`) or below them (`-1`) — VexFlow's `LOCATION_TOP`/`BOTTOM`. */
export type TupletSide = 1 | -1

/** What one note of the group contributes to how far out the mark must stand. */
export interface TupletNoteReach {
  /**
   * Whether this note pushes the mark at all — VexFlow asks `hasStem() || isRest()`, so a whole note
   * (no stem, but a `Stem` object with extents) and a rest both count.
   */
  reaches: boolean
  /** `1` up, `-1` down. */
  stemDirection: number
  /** The stem's free end. @see `engrave/notes/stemLength` */
  stemTipY: number
  /** The stem's own head — ⚠️ a notehead CENTRE, which is why {@link TUPLET_AIR.notehead} is the larger air. */
  stemBaseY: number
  /**
   * How many lines of text are already stacked over (or under) this note. 0 = none.
   * ⚠️ Above and below read DIFFERENT counters of the modifier context — see {@link tupletMarkY}.
   */
  textLines: number
  /**
   * Where text above this note would start, at its own {@link textLines} — the note's answer, because
   * only it knows its stem. Read only when `textLines > 0`, and only above.
   */
  textTopY: number
}

export interface TupletPlacement {
  side: TupletSide
  /** The staff the group stands on. */
  frame: StaffFrame
  notes: readonly TupletNoteReach[]
  /** How many tuplets on this side this group sits inside — 0 for an unnested one. */
  nestedDepth: number
  /** The hand's own nudge, in px, outward-signed by VexFlow's convention (added as-is). */
  yOffset: number
  /**
   * Below only: the lowest staff line any note's text has claimed, at least the bottom line (4).
   * ⚠️ VexFlow computes it as `max(4, textLine + 1)` over the group — a LINE number, ⛔ not a y.
   */
  lowestTextLine: number
}

/**
 * ⭐ **The y the bracket's line sits at** (and the numeral's baseline is measured from).
 *
 * ⚠️ **Above and below are not mirror images**, and the difference is VexFlow's, transcribed:
 * - *above* starts from the staff's top line and is then pushed up by stems, noteheads **and** each
 *   note's own text row (`textTopY`), which only counts when that note also has a stem or is a rest;
 * - *below* starts from the lowest line any note's text has claimed — modifier text enters as a LINE
 *   NUMBER there, not as a y — and is then pushed down by stems and noteheads only.
 *
 * ⛔ Not symmetrised. The two branches genuinely disagree about how text is measured, and making them
 * agree would move the mark on real scores.
 */
export function tupletMarkY(placement: TupletPlacement): number {
  const { side, frame, notes, nestedDepth, yOffset } = placement
  const space = frame.spacePx
  const nested = nestedDepth * TUPLET_NESTING_STEP * space * -side

  let y = side === 1
    ? staffLineY(frame, 0) - TUPLET_AIR.staffAbove * space
    : staffLineY(frame, placement.lowestTextLine) + TUPLET_AIR.staffBelow * space

  for (const note of notes) {
    if (!note.reaches) continue
    const up = note.stemDirection === 1
    if (side === 1) {
      // Above: a stem pointing UP offers its tip, one pointing DOWN offers its top notehead.
      const reach = up
        ? note.stemTipY - TUPLET_AIR.stemTip * space
        : note.stemBaseY - TUPLET_AIR.notehead * space
      y = Math.min(reach, y)
      if (note.textLines > 0) {
        y = Math.min(note.textTopY - TUPLET_AIR.modifierText * space, y)
      }
    } else {
      // Below: a stem pointing UP offers its bottom notehead, one pointing DOWN offers its tip.
      const reach = up
        ? note.stemBaseY + TUPLET_AIR.notehead * space
        : note.stemTipY + TUPLET_AIR.stemTip * space
      y = Math.max(reach, y)
    }
  }

  return y + nested + yOffset
}
