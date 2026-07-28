/**
 * A TUPLET — the bracket and its number.
 *
 * ⚠️ NO chain entry, deliberately. A tuplet press is resolved by a PRE-STEP
 * (`MouseController.handleTupletMouseDown`), which runs BEFORE `selectedElement` is cleared,
 * because pressing a bracket is a gesture that may also start a drag and must keep the existing
 * selection intact through it. It is a kind here for the paint, and for the exhaustiveness that
 * makes a fifteenth kind fail to build.
 */
import type { ElementKindSpec } from './chain'

export const TUPLET_ELEMENT: ElementKindSpec = {
  kind: 'tuplet',
  highlight: h => h.applyTupletSelectionHighlight(),
}
