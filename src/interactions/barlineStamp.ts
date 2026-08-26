/**
 * ⭐⭐ **THE BARLINE PALETTE'S PRESS** — which LINE a sign means, and what pressing it does.
 *
 * P4 of docs/barline-types-plan.md, and the module CLAUDE.md's rule asks for: the score edit is in
 * the core (`engine/models/barlineOps`), the *gesture* is here, and `PaletteController` /
 * `MouseController` each keep one line.
 *
 * ## ⭐⭐ HIS RULE, and it is one rule in three places
 *
 * > *"isn't it on a palette? same behaviour of any palette: if nothing selected stamp, if a barline
 * > is selected apply to barline, if a whole measure is selected apply in relationship with the
 * > semantic: an endbar is always on the right, an open is on the left side of the measure"*
 *
 * So a sign is not placed at a *line* the user picks — it is placed on a **MEASURE, on the sign's own
 * SIDE of it** ({@link BARLINE_SIGNS}), and that single sentence answers all three gestures:
 *
 * | what is selected | where the sign lands |
 * |---|---|
 * | nothing | the tool ARMS; the clicked BAR gets it (right side / left side) |
 * | a barline (`ends measure N`) | the same line, read as a side: right → bar *N*, left → bar *N+1* |
 * | a measure range | right → its LAST bar, left → its FIRST bar |
 *
 * ⭐ Which is also why this is not the `selectedMeasureTarget` the meter uses (PaletteController): a
 * meter is a POINT event and always takes the lowest bar of a span, while a barline is a BOUNDARY and
 * takes the end of the span the sign belongs to.
 *
 * ⭐ And it is what makes an initial `|:` reachable — the sign the user asked to be able to place at
 * the very beginning (plan §8 P2). It is bar 1's LEFT side, so clicking in bar 1 with the open repeat
 * armed places it; no boundary before bar 1 has to be selectable, and none is.
 *
 * ## ⛔ Nothing here reads the neighbour, and nothing here draws
 *
 * ONE OWNER PER LINE (`barlineOps`' header): a right-side sign is stored on the bar it ENDS, a
 * left-side one on the bar it OPENS. The *picture* at a boundary is `signAtBoundary`'s question, and
 * the two bars that meet there are its business, not this module's.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { PlacedBarlineSign } from '../engine/layout/barlineSign'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'

/**
 * The three signs the palette can place — ⭐ **the ENGINE's type**, re-exported so the editor's side
 * of this feature has one import. Not a second list of the same three strings: `plain` and
 * `repeatBoth` are derived at a boundary and placed by nobody, and a rename over there must fail to
 * compile here rather than leave the palette speaking a dialect of the drawing's vocabulary.
 */
export type BarlineSign = PlacedBarlineSign

interface BarlineSignSpec {
  /**
   * ⭐ **WHICH SIDE of a measure this sign stands on** — the whole gesture, in one field. `right` is
   * the line that ENDS the bar, `left` the line that OPENS it, which is exactly where the model
   * stores each of them (ONE OWNER PER LINE).
   */
  side: 'left' | 'right'
  /** What the log calls it. */
  label: string
  /** Place it on that bar. @returns whether the score changed (the engine records the undo entry). */
  place(engine: MusicEngine, measureNumber: number): boolean
}

/**
 * What each sign is, as a table the compiler keeps TOTAL (`npm run lint:tables`) — the
 * `SPAN_MARK_TOOLS` / `ELEMENT_SPECS` idiom. A fourth sign (the thin double `||`, the family's next
 * member) is a ROW here and a case nowhere: the three gestures above read `side`, and `place` is the
 * one line that knows which model field the sign lives in.
 *
 * ⚠️ `final` is a barline STYLE and the two repeats are not (plan §3.2, corroborated by MNX + SMuFL +
 * three engines) — which is why `place` is per-row rather than one `setBarlineType(sign)`.
 */
export const BARLINE_SIGNS: Record<BarlineSign, BarlineSignSpec> = {
  final: {
    side: 'right',
    label: 'final barline',
    place: (engine, measureNumber) => engine.setBarlineStyle(measureNumber, 'final'),
  },
  repeatEnd: {
    side: 'right',
    label: 'end repeat',
    place: (engine, measureNumber) => engine.setRepeatEnd(measureNumber, true),
  },
  repeatStart: {
    side: 'left',
    label: 'open repeat',
    place: (engine, measureNumber) => engine.setRepeatStart(measureNumber, true),
  },
}

/**
 * The bar `sign` should land on given what is selected, or **null when nothing names one** — which is
 * the palette's signal to ARM instead (the "if nothing selected, stamp" half of the rule).
 *
 * Selection mode only, like every other apply-to-the-selection path: in entry mode a selected note is
 * the keyboard CARET, not a selection, and a press there means "arm the stamp".
 *
 * ⚠️ A NOTE selection deliberately does NOT name a bar. It would be easy to read the note's measure
 * and act on it, but that is a rule nobody stated: his three cases are a barline, a measure, or
 * nothing. A press with notes selected therefore arms — the ordinary stamp bargain, which drops the
 * selection and previews what the next click makes.
 */
export function barlineTargetFromSelection(state: EditorState, sign: BarlineSign): number | null {
  if (state.selectedTool !== 'selection') return null
  const { side } = BARLINE_SIGNS[sign]

  // A selected barline IS a boundary (`{ kind: 'barline', measure: N }` = the line that ends bar N),
  // so the side rule reads it directly: that same line OPENS bar N+1.
  const line = selectedOf(state, 'barline')
  if (line) return side === 'left' ? line.measure + 1 : line.measure

  // EITHER box counts (the double Ctrl+Shift+click one and the single plain-click one) — both name
  // bars out loud, and a barline does not care what was selected INSIDE them.
  const range = selectedOf(state, 'measureRange')
  if (range) {
    return side === 'left' ? Math.min(range.anchor, range.focus) : Math.max(range.anchor, range.focus)
  }
  return null
}

/**
 * Place `sign` on `measureNumber` and say so. The ONE write, shared by all three gestures, so a
 * click and a press on a selection cannot drift apart.
 *
 * @returns whether the score changed — false for a bar that is not there (the line that ends the LAST
 *          bar opens nothing, so an open repeat asked for there is refused by `barlineOps`) and for a
 *          sign that is already on that bar.
 */
export function applyBarlineSign(engine: MusicEngine, sign: BarlineSign, measureNumber: number): boolean {
  const { label, side } = BARLINE_SIGNS[sign]
  const changed = BARLINE_SIGNS[sign].place(engine, measureNumber)
  dbg(changed
    ? `✓ Barline placed | ${label} on the ${side} of measure ${measureNumber}`
    : `· Barline unchanged | ${label} on the ${side} of measure ${measureNumber} — already there, or no such bar`)
  return changed
}

/**
 * ⭐ **THE ARMED TOOL'S CLICK — the clicked BAR gets the sign on its own side.**
 *
 * `MouseController` keeps one row in its dispatch chain, like every stamp beside it. The click's
 * MEASURE is all that is read: a barline stamp asks no question of the y (the sign is system-wide,
 * plan §2) and none of the x beyond which bar it fell in — the side rule places it.
 *
 * ⛔ Deliberately NOT "the nearest boundary". That would make a click near a barline mean a different
 * bar from a click in the middle of the same bar, which is a second rule to learn and disagrees with
 * the measure-selection gesture that shares this table.
 *
 * The tool stays armed — you place these in runs (a final at the end of each section).
 */
export function stampBarlineAtClick(
  state: EditorState,
  engine: MusicEngine,
  measureNumber: number,
  render: () => void,
): boolean {
  const tool = state.selectedMarkingTool
  if (tool?.kind !== 'barline') return false

  applyBarlineSign(engine, tool.sign, measureNumber)
  // Repaint even when nothing changed: the click consumed a placement, and the ghostless tool has
  // nothing else to show for it.
  render()
  return true
}
