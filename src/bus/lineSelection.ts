import { PaletteSelection } from './paletteSelection'

/**
 * The LINES family as a shared vocabulary — the marks that run ALONG the music: the slur, the two
 * hairpins, the trill, the two octave lines and the pedal.
 *
 * ⭐⭐ **The vocabulary lives HERE so the two doors cannot disagree.** There are two ways to reach
 * this family — the dev shell's *Lines:* palette (`dev/linePalette`) and the Lines window
 * (`windows/lines`) — and neither may import the other's side of the app. A window cannot see a
 * `PaletteController`, and `interactions/` must not know a dialog exists. So the KIND is declared on
 * the bus, the window presses one, and `interactions/lineTools` is the single place that says what
 * pressing it does. Same shape as `engine/rendering/ghostTypes` one layer down: the side that cannot
 * import declares the words, and the side that can translates them.
 *
 * ⚠️ A kind is NOT a model type. `'8va'` and `'8vb'` are two rows of one `ottava` tool (the signed
 * shift is the model's), and `'cresc'`/`'dim'` are two rows of one hairpin. The split is the USER's
 * — two buttons, two pictures, two independent lights — and it stops at `lineTools`.
 */
export type LineToolKind = 'slur' | 'cresc' | 'dim' | 'trill' | '8va' | '8vb' | 'pedal'

/**
 * The family IN ORDER — the curve, the two hairpins, then the signs that carry a line behind them.
 *
 * ⭐ Exported so a UI can be built by mapping it rather than by listing the rows again: the Lines
 * window's picture list is this array, and adding an eighth line adds it in ONE place. (The dev
 * palette keeps its own literal table because each of its rows carries a label and a tooltip that
 * only make sense written out.)
 */
export const LINE_TOOL_KINDS: readonly LineToolKind[] = [
  'slur',
  'cresc',
  'dim',
  'trill',
  '8va',
  '8vb',
  'pedal',
]

/**
 * Two channels, {@link PaletteSelection}'s own: HIGHLIGHT mirrors which line tool is armed (so a
 * dialog opens on it instead of on a stale first row), PRESS is the user choosing one and always
 * fires — pressing the armed tool again means "turn it off", which the palette method decides.
 */
export const createLineSelection = () => new PaletteSelection<LineToolKind>()
