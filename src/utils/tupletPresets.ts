/**
 * The tuplets that get a button and a key — N, and the M that goes with it.
 *
 * ONE table, because it answers the same question in three places: the palette's row of buttons, the
 * `Ctrl+`N shortcuts, and (one day) whatever replaces the palette. A preset row and a keymap that
 * each named their own ratios would be two tables that disagree the first time one is edited — and
 * "5 is 5:4 here but 5:3 over there" is exactly the kind of disagreement nobody notices until it is
 * engraved.
 *
 * **Each preset states its own M.** There is no `defaultNotesOccupied(n)` here on purpose: M is not a
 * function of N — a quintuplet is 5:4 in simple meter and 5:3 in 6/8, because the normal side comes
 * from what is being divided. The day M is derived, it is derived from the METER, in one place, and
 * half of this table merges.
 *
 * Two families sit in this list:
 *
 * - **2:3, 4:3, 8:6** — the compound-meter tuplets. The duplet, quadruplet and octuplet are to 6/8
 *   what the triplet is to 4/4: an even number of notes borrowed from a beat that divides in three.
 *   8 could not follow the rule below even if it wanted to — it is already a power of two, so in
 *   simple meter there is nothing for it to borrow from ("8 in the time of 4" is just notes of half
 *   the value), and it needs a ternary span to be a tuplet at all.
 * - **3:2, 5:4, 6:4, 7:4, 9:8** — the simple-meter ones, where M is the largest power of two below N:
 *   the tuplet borrows from the ordinary binary subdivision, and 8 is the nearest one under 9.
 *
 * 1 is deliberately absent, and could not work: one note in the time of two IS a note of double the
 * value, so there is nothing being squeezed — which the entry rule refuses (`N >= 2`).
 */
export interface TupletPreset {
  /** N — how many notes are played. */
  n: number
  /** M — how many they replace, counted in the same note value. */
  m: number
}

export const TUPLET_PRESETS: readonly TupletPreset[] = [
  { n: 2, m: 3 },
  { n: 3, m: 2 },
  { n: 4, m: 3 },
  { n: 5, m: 4 },
  { n: 6, m: 4 },
  { n: 7, m: 4 },
  { n: 8, m: 6 },
  { n: 9, m: 8 },
]

/** The action name a preset's key fires — `Ctrl+5` → `armTuplet5`. Spelled by ONE function so the
 *  keymap and the handler table cannot drift apart by a character. */
export function tupletPresetAction(preset: TupletPreset): string {
  return `armTuplet${preset.n}`
}
