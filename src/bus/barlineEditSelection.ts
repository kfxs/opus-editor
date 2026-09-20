import { RequestChannel } from './requestChannel'
import type { BarlineSignKind } from '@/engine/models/boundarySign'

/**
 * The seam the Properties **barline chooser** publishes through (his ask, 2026-08-26: *"what about
 * the properties when I selected a barline? I was expecting to change the type there"*, then
 * *"since we can just select one barline, there should be an option for close+open case"*).
 *
 * The twin of {@link ./hairpinEditSelection} and {@link ./trillEditSelection}: **command-only**, so
 * the window writes *"this line should be an end repeat"* and {@link BarlineEditController} — the one
 * place that holds the engine — applies it. No mirror channel: the control reads its CURRENT value
 * from `selectionInspection`, which it already subscribes to, so the window stays a dumb publisher
 * that cannot reach the score.
 *
 * ## ⭐⭐ IT NAMES A LINE, NOT A BAR — and that is the whole design
 *
 * Every other barline write in this editor takes a MEASURE, because that is where the model stores
 * each statement (ONE OWNER PER LINE: a style and an end repeat belong to the bar the line ends, an
 * open repeat to the bar it opens). ⭐ But a user looking at a barline sees a LINE, and the
 * back-to-back `:||:` is two statements on two bars that no selection of one side can reach. So this
 * seam carries the boundary, and `barlineOps.setBoundarySign` writes both of its owners as one
 * undoable edit.
 *
 * ⛔ **A CONTENT edit, not a drawing one.** A repeat changes what the player is told to do — the
 * geometry compartment is for the bar-width and barline-gap nudges, which have their own gestures.
 */
export interface BarlineEditRequest {
  /**
   * The bar whose ENDING line is being changed — ⭐ or **null for the score's opening edge**, where
   * nothing ends and the only statement sayable is the `|:` opening bar 1.
   *
   * ⚠️ Null rather than `0`: bar numbers are 1-based and a zeroth bar does not exist, so a sentinel
   * number would be a measure the rest of the engine would try to look up. It is the same shape
   * `signAtBoundary` already has, whose `ends` is undefined at that edge.
   */
  endsMeasure: number | null
  /** What should stand on that line, when the SIGN is what changed. ⚠️ `BarlineSignKind`, ⛔ not a
   *  copy of the union: the ENGINE owns the vocabulary and the editor translates into it
   *  (`engine/rendering/ghosts/ghostTypes.ts`'s rule). Absent = leave the sign alone. */
  sign?: BarlineSignKind
  /**
   * ⭐ Whether the sign is drawn with WINGS — the flared tips at the top and bottom of its thick
   * line. Absent = leave them alone.
   *
   * ⚠️ **A PARTIAL request**, like the hairpin's and the trill's, and this is the field that earns
   * it: the panel has two controls on one selection — a dropdown that says what the sign IS and a
   * checkbox that says how it is drawn — and each publishes only what it changed. A request carrying
   * both would make re-picking a sign silently re-assert a checkbox the user did not touch.
   */
  winged?: boolean
}

/** BarlineEditController handles it — the one place that holds the engine. */
export const createBarlineEditSelection = () => new RequestChannel<BarlineEditRequest>()
