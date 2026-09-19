/**
 * The arrows on a selected TEMPO MARK — the dynamic's twin (`./dynamicKeys`), and the twin is the
 * point: the two marks differ in what they hang off, not in how a hand moves them.
 *
 * 🚨 **Its stored `dy` is OUTWARD (+up) — the one offset in the compartment that is**
 * (`TempoOffsetOverride`): a tempo mark is always above the staff, so a number about it means *how
 * far from the staff*. A KEY is a screen direction, and the `keys` column speaks screen (+y down),
 * so THIS is where the sign turns: `↑` arrives negative and is written as a positive outward.
 *
 * ⭐⭐ **The HORIZONTAL goes through the INTERPOLATING WALK** (`../tempoWalk`): the same ink nudge,
 * except that reaching the next ONSET takes the anchor along with it — the dynamic's gesture on the
 * words, sharing its arithmetic (`../markWalk`) and differing only in where the stops are: a tempo
 * has no lane, it governs the clock.
 */
import { walkTempo } from '../tempoWalk'
import type { KeysOf } from './keys'

export const TEMPO_KEYS: KeysOf<'tempo'> = {
  nudge({ engine, afterMarkPress }, { id }, dx, dy) {
    const moved = dy === 0 && dx !== 0 ? walkTempo(engine, id, dx) : engine.nudgeTempoOffset(id, dx, -dy)
    if (moved) afterMarkPress('tempo', id, dx, dy, () => engine.commitTempoDrag())
    return moved
  },

  /** DECLINEs when the mark was never nudged, so the key falls through. */
  reset({ engine, render }, { id }) {
    const was = engine.resetTempoOffset(id)
    if (was) render()
    return was
  },
}
