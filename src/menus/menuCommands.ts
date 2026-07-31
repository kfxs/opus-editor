/**
 * What a menu module ASKS THE APP FOR — the two shapes every real menu's actions are made of.
 *
 * A menu row is never just a callback. It is a callback plus the questions the row must answer while
 * it is being painted: *am I on?* and *is there anything to do this to?* Those are readings of editor
 * state, and a framework-agnostic menu cannot take them itself — so they arrive together, as one
 * object per command, filled in by App.ts (see `menuActions`).
 *
 * Kept here rather than in whichever menu happened to need one first: `viewMenu` defined `MenuToggle`
 * and then `playMenu` and `staffMenu` imported it from there, which quietly made the View menu the
 * home of everyone's vocabulary.
 *
 * ⚠️ Both readers are called as the ROW IS PAINTED, never stored. A menu does not outlive the action
 * that changes their answers.
 */

/** A row that reports and flips one boolean — Linear view, Pages, the Keypad's visibility. */
export interface MenuToggle {
  isOn: () => boolean
  toggle: () => void
  /** Greyed when this is false. Absent = always available. */
  enabled?: () => boolean
}

/** A row that DOES something once — Add Staff Above, Insert Measure Before. */
export interface MenuCommand {
  run: () => void
  /** Greyed when this is false. Absent = always available. */
  enabled?: () => boolean
}
