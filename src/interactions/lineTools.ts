import type { LineToolKind } from '@/bus/lineSelection'
import { armedTool, type EditorState } from './EditorState'
import type { PaletteController } from './PaletteController'

/**
 * What a LINES row DOES, and whether it is lit — the one translation from the bus's vocabulary
 * (`bus/lineSelection`) to the palette methods that already exist.
 *
 * ⭐⭐ **One table, two doors.** The dev shell's *Lines:* palette and the Lines window both end up
 * here, so a press from either is the same act: with notes selected the mark is made, with nothing
 * selected the stamp is ARMED, and pressing the armed one again turns it off. That routing is
 * `PaletteController`'s and is not repeated here — this file only says WHICH method a row means.
 *
 * ⛔ Not a `switch` inside `keypadSync` and not a slice on the toolbar: this is the twelfth-case rule
 * (CLAUDE.md). The eighth line adds a kind in the bus, a row here, and a picture — and no existing
 * caller changes.
 */

/** Run the row. `PaletteController` decides what the press MEANS (apply / arm / disarm). */
export function pressLineTool(palette: PaletteController, kind: LineToolKind): void {
  switch (kind) {
    case 'slur':
      return palette.createSlur()
    case 'cresc':
      return palette.createCrescendo()
    case 'dim':
      return palette.createDiminuendo()
    case 'trill':
      return palette.createTrill()
    case '8va':
      return palette.createOttava(1)
    case '8vb':
      return palette.createOttava(-1)
    case 'pedal':
      return palette.createPedal()
  }
}

/**
 * Which line tool is ARMED, or null — the light on a palette button, and the row a re-opened dialog
 * should land on.
 *
 * ⚠️ Two of the model's tools answer with two DIFFERENT kinds each, and that asymmetry is the whole
 * reason this is a function rather than an `armedTool(state, kind)` call at each call site: an
 * armed ottava is `8va` or `8vb` by the SIGN of its shift, and an armed hairpin is `cresc` or `dim`
 * by its type. Asking "is the ottava armed" would light both octave rows at once.
 */
export function armedLineTool(state: EditorState): LineToolKind | null {
  const tool = state.selectedMarkingTool
  if (!tool) return null
  switch (tool.kind) {
    case 'slur':
      return 'slur'
    case 'trill':
      return 'trill'
    case 'pedal':
      return 'pedal'
    case 'hairpin':
      return tool.type === 'cresc' ? 'cresc' : 'dim'
    case 'ottava':
      return tool.shift > 0 ? '8va' : '8vb'
    default:
      // Every OTHER marking tool — a clef, a dynamic, the rest stamp. Not a line, so no row is lit.
      return null
  }
}

/** Is this row's own stamp live? ⛔ Never "is something armed" — see {@link armedLineTool}. */
export function isLineToolArmed(state: EditorState, kind: LineToolKind): boolean {
  return armedLineTool(state) === kind
}

/**
 * ⚠️ Kept for the one row that asks a narrower question than {@link armedLineTool} answers — and as
 * the compile-time reminder that `armedTool` is still the primitive underneath. Unused elsewhere on
 * purpose: prefer the two functions above, which are exhaustive over the FAMILY.
 */
export const armedSlurStamp = (state: EditorState): boolean => armedTool(state, 'slur') !== null
