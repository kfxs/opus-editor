/**
 * ⭐ **WHAT THE HAND HAS ADJUSTED ON THE SPINE** — the Spine Properties knobs, as ONE bundle the spacing and the
 * drawing take (`docs/plans/bent-staff-plan.md` §9): a bar's stretch (`./spineBarStretch`) and a column's space
 * (`./spineColumnSpace`). A new knob is a new field here and a module of its own, ⛔ not a new parameter.
 *
 * ⚠️ The SESSION's — held by the panel, ⛔ not in the score (plan §9.3 C, undecided). ⛔ No DOM.
 */
import type { SpineBarStretches } from './spineBarStretch'
import type { SpineColumnSpaces } from './spineColumnSpace'

export interface SpineAdjustments {
  barStretch?: SpineBarStretches
  columnSpace?: SpineColumnSpaces
}
