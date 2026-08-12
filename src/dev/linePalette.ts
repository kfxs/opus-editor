import type { EditorState } from '../interactions/EditorState'
import { armedTool } from '../interactions/EditorState'
import type { PaletteController } from '../interactions/PaletteController'

/**
 * The **Lines** palette of the dev shell — the family of spanners drawn BETWEEN notes rather than
 * on one: the slur today, and (when they exist) the hairpin, the octave line, the glissando, the
 * pedal line.
 *
 * It is a TABLE, not a row of buttons written out: adding the next line adds a ROW here, not a
 * slice of `devToolbar` (CLAUDE.md — "a slice too thin to be logic is still a slice"). Every row
 * runs a `PaletteController` method that ALREADY EXISTS and is already reachable another way — the
 * slur's is the `s` key — so this palette reimplements nothing and deleting it deletes labels.
 *
 * `isEnabled` is the row's own answer to "can it be pressed right now", asked again on every state
 * change by the toolbar's syncers. It must agree with what the palette method would do: a button
 * that looks pressable and silently does nothing is worse than one that says so (the same lesson
 * the `Small` button learned).
 */
export interface LineTool {
  /** Button face. */
  label: string
  /** Tooltip — say what the line is AND what has to be selected first. */
  title: string
  isEnabled(state: EditorState): boolean
  /** Lit when the row's STAMP is armed — the button is then the tool's on-screen switch, and a
   *  re-press turns it off (the press method's own rule). */
  isArmed(state: EditorState): boolean
  press(palette: PaletteController): void
}

export const LINE_TOOLS: readonly LineTool[] = [
  {
    label: 'Slur',
    title: 'Phrasing slur (key `s`). With notes selected it slurs them; with nothing selected it '
      + 'ARMS the slur stamp — the blue pointer — and a click on a note slurs it to the next slot. '
      + 'Press again to disarm. Create-only: to remove one, click the arc and press Delete; `x` '
      + 'flips its side.',
    // ALWAYS pressable, because the press always means something: apply, or arm. (The Lines palette
    // predates the stamp by one commit — it used to grey out with no selection, which was right
    // while "with nothing selected" meant nothing at all.)
    isEnabled: () => true,
    isArmed: (state) => armedTool(state, 'slur') !== null,
    press: (palette) => palette.createSlur(),
  },
]
