import type { TremoloMark } from '../types/music'
import { PaletteSelection } from './paletteSelection'

/**
 * The six single-note TREMOLO keys shared between the editor and the Keypad — 1–5 strokes and the
 * Penderecki sign, on the Beams/Tremolos page's `1 2 3 4 5 6` (Sibelius's own places).
 *
 * Single-valued like the accidental, and for the same reason: a note carries ONE tremolo, so the
 * keys are a radio and re-pressing the lit one removes it. Engine-read — the mark is a fact about
 * the score, not a reactive field — so `PaletteController.refreshTremoloSelection` pushes the
 * highlight, and `tremoloHighlight` (keypadSync) is the rule, shared with the dev toolbar's row.
 *
 * A press routes OUT through `pressTremolo`, the SAME four-way router the toolbar's buttons call:
 * edit the selected mark, apply across a selection, arm for note entry, or arm the stamp.
 */
export const tremoloSelection = new PaletteSelection<TremoloMark>()
