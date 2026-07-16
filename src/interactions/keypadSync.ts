import type { EditorState, StateListener } from './EditorState'
import type { PaletteController } from './PaletteController'
import { modeSelection } from './modeSelection'
import { durationSelection } from './durationSelection'
import { accidentalSelection } from './accidentalSelection'
import { articulationSelection } from './articulationSelection'
import { dotSelection } from './dotSelection'
import { tieSelection } from './tieSelection'
import { accidentalTypeToKey } from '../utils/pitchSpelling'

/**
 * The highlight rule, in one place: a palette value is shown only when it means something —
 * in entry mode (the armed value), or in selection mode with a note selected (the note's,
 * kept in sync by SelectionController). Select a non-note or clear the canvas and there is no
 * note to reflect, so nothing lights up — in the Vue palette AND the Keypad. The Vue palette's
 * own button computeds call this too, so the rule is single-sourced.
 */
export function noNoteInSelection(state: EditorState): boolean {
  return state.selectedTool === 'selection' && !state.selectedNoteId
}

/**
 * The dot follows the same rule, from the reactive `selectedDots` count — except when the DOTS
 * themselves are selected on the score, which lights the key regardless: clicking a dot clears the
 * note selection (so `noNoteInSelection` is true) and never touches `selectedDots`, yet the key is
 * exactly what removes them. Mirrors how a selected accidental lights its own key.
 */
export function dotHighlight(state: EditorState): 'dot' | null {
  // The armed STAMP is the active gesture — light the key for it, as the armed articulation set
  // lights during its stamp. Ahead of the reads below, which see the (cleared) note selection.
  if (state.selectedDotTool) return 'dot'
  if (state.selectedDotNoteId) return 'dot'
  return noNoteInSelection(state) || state.selectedDots < 1 ? null : 'dot'
}

/**
 * Keep the Keypad's wired controls (select mode, duration, accidental, articulation, dot, tie) in
 * sync with editor state, and route their key presses back through the palette — with NO Vue in the
 * loop. This is the cord-cut: the read-sync used to flow through App.vue `watch`es (Vue owned the
 * "it changed"); now it flows through the state's own `subscribe`
 * (see docs/observable-editorstate-plan.md). The Select arrow is here too, since `toolMode` collapsed
 * into this seam — mode is just another key now.
 *
 * HIGHLIGHT (in): `sync()` recomputes all five lit states and pushes them to the two-channel
 * stores. It fires on EVERY state change — cheap, because every `setHighlight`/`refresh`
 * short-circuits on no-change — and satisfies the subscriber contract by construction: it is
 * idempotent, torn-state tolerant (a pure read), and never writes state.
 *
 * PRESS (out): a Keypad key routes through the palette's own setX/toggleX — the SAME method the
 * Vue button calls — so a retuned note / armed ghost / a toggle-off all happen identically. The
 * press channel fires only on a real Keypad press (never from the highlight mirror), so the
 * action never double-applies.
 *
 * Returns a dispose fn that unsubscribes everything.
 */
export function wireKeypadSync(
  state: EditorState,
  palette: PaletteController,
  subscribe: (fn: StateListener) => () => void,
): () => void {
  const sync = () => {
    // The Select arrow lights whenever the editor is in selection mode — from ANY source (toolbar,
    // Esc, mouse, or the arrow), because this runs on the state's own change-notification.
    modeSelection.setHighlight(state.selectedTool === 'selection' ? 'selection' : null)
    // The articulation stamp tool arms into entry mode, but it is a pure articulation gesture — no
    // note is being entered — so the note-entry keys (duration / accidental / dot) must NOT light;
    // only the armed articulation does (via refreshArticulationSelection below). Without this the
    // duration key would light the moment you arm the stamp, reading as "a note will be placed".
    const artStamping = state.selectedArticulationTools.length > 0
    const accStamping = state.selectedAccidentalTool !== null
    const tieStamping = state.selectedTieTool
    const dotStamping = state.selectedDotTool
    const stamping = artStamping || accStamping || tieStamping || dotStamping
    durationSelection.setHighlight(stamping || noNoteInSelection(state) ? null : state.selectedDuration)
    // While the accidental stamp is armed, light the ARMED accidental (it's the active gesture);
    // when a standalone accidental glyph is selected in the score, light THAT accidental (so it can
    // be changed/removed from the Keypad); otherwise fall back to the note-entry / selected-note
    // accidental — but never during an articulation or tie stamp (no accidental is in play then).
    accidentalSelection.setHighlight(
      accStamping ? state.selectedAccidentalTool
      : state.selectedAccidentalNoteId ? accidentalTypeToKey(state.selectedAccidentalType)
      : artStamping || tieStamping || dotStamping || noNoteInSelection(state) ? null
      : state.selectedAccidental
    )
    // NOT gated on `stamping`: the dot key is the one that lights during a DOT stamp (dotHighlight
    // reads the tool). The other stamps still darken it.
    dotSelection.setHighlight(artStamping || accStamping || tieStamping ? null : dotHighlight(state))
    // Engine-derived highlights (articulations are a SET, tie reads tiedTo): read live, not from a
    // reactive field, so they can't be mirrored — recompute and push on any change.
    palette.refreshArticulationSelection()
    palette.refreshTieSelection()
  }
  sync() // prime

  const stops = [
    subscribe(sync),
    modeSelection.onPress(() => palette.enterSelectionMode()),
    durationSelection.onPress((d) => palette.setDuration(d)),
    accidentalSelection.onPress((a) => palette.setAccidental(a)),
    dotSelection.onPress(() => palette.toggleDot()),
    articulationSelection.onPress((type) => {
      if (type === 'accent') palette.toggleAccent()
      else if (type === 'staccato') palette.toggleStaccato()
      else palette.toggleTenuto()
    }),
    tieSelection.onPress(() => palette.toggleTie()),
  ]
  return () => stops.forEach((stop) => stop())
}
