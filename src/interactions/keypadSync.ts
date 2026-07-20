import type { EditorState, StateListener } from './EditorState'
import type { NoteDuration } from '../types/music'
import { armedToolUsesLength } from './EditorState'
import type { PaletteController } from './PaletteController'
import { modeSelection } from './modeSelection'
import { durationSelection } from './durationSelection'
import { accidentalSelection } from './accidentalSelection'
import { articulationSelection } from './articulationSelection'
import { dotSelection } from './dotSelection'
import { tieSelection } from './tieSelection'
import { restSelection } from './restSelection'
import { clefSelection } from './clefSelection'
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
 * Which duration key lights, or null for none.
 *
 * ANY marking tool arms into entry mode but enters NO NOTE, so the note-entry keys must not light
 * while one is live — otherwise the Keypad says "a quarter note is about to be entered" while what
 * is really armed is a clef. This used to test a list of the four STAMP kinds, which let the clef /
 * time signature / dynamic / tempo tools light them; the list encoded no real distinction — every
 * marking tool has this property — so there is no list any more.
 *
 * …every tool but one. A REST is a duration, so under the rest stamp the duration keys are part of
 * the armed rest, not a claim about a note that isn't coming: they light, and they retune it. That
 * is a property asked of every kind by `MARKING_TOOL_USES_ARMED_LENGTH`, not an exception list.
 *
 * A function, not an inline expression in {@link wireKeypadSync}, for {@link dotHighlight}'s reason:
 * it is the RULE, and the Vue palette's surviving duration computed reads it too.
 */
export function durationHighlight(state: EditorState): NoteDuration | null {
  if (state.selectedMarkingTool) return armedToolUsesLength(state) ? state.selectedDuration : null
  return noNoteInSelection(state) ? null : state.selectedDuration
}

/**
 * The dot follows the same rule, from the reactive `selectedDots` count — except when the DOTS
 * themselves are selected on the score, which lights the key regardless: clicking a dot clears the
 * note selection (so `noNoteInSelection` is true) and never touches `selectedDots`, yet the key is
 * exactly what removes them. Mirrors how a selected accidental lights its own key.
 */
export function dotHighlight(state: EditorState): 'dot' | null {
  // A marking tool is armed → the ARMED GESTURE is the only thing the Keypad shows. The dot stamp
  // lights its own key; every other tool darkens it, because no dot is in play while a clef is
  // waiting to be placed. Ahead of the reads below, which would see the (cleared) note selection.
  //
  // This gate belongs HERE, not at the caller: `dotHighlight` is the RULE, and the Vue palette's own
  // button computeds read it too — gating it in keypadSync.sync() alone would light the Vue dot
  // button under an armed clef while the Keypad's stayed dark.
  //
  // EXCEPT under a tool that uses the armed length: the armed REST is dotted or it is not, and the
  // key is what says which — so it reports `selectedDots`, exactly as in note entry.
  const armed = state.selectedMarkingTool
  if (armedToolUsesLength(state)) return state.selectedDots < 1 ? null : 'dot'
  if (armed) return armed.kind === 'dot' ? 'dot' : null
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
    // No gate needed at the call site: durationHighlight owns the whole rule, armed tool included.
    const armed = state.selectedMarkingTool
    durationSelection.setHighlight(durationHighlight(state))
    // While the accidental stamp is armed, light the ARMED sign (it's the active gesture); when a
    // standalone accidental glyph is selected in the score, light THAT one (so it can be
    // changed/removed from the Keypad); otherwise fall back to the note-entry / selected-note
    // accidental — but never under another tool, where no accidental is in play.
    accidentalSelection.setHighlight(
      armed?.kind === 'accidental' ? armed.sign
      : state.selectedAccidentalNoteId ? accidentalTypeToKey(state.selectedAccidentalType)
      : armed || noNoteInSelection(state) ? null
      : state.selectedAccidental
    )
    // The Clef window lights the clef that is ARMED, and nothing otherwise: unlike a duration,
    // a clef is never "the selected note's" — it belongs to a measure, not a note.
    clefSelection.setHighlight(armed?.kind === 'clef' ? armed.clef : null)
    // No gate needed: dotHighlight owns the whole rule, armed tool included.
    dotSelection.setHighlight(dotHighlight(state))
    // Engine-derived highlights (articulations are a SET, tie reads tiedTo, rest reads isRest): read
    // live, not from a reactive field, so they can't be mirrored — recompute and push on any change.
    palette.refreshArticulationSelection()
    palette.refreshTieSelection()
    palette.refreshRestSelection()
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
    restSelection.onPress(() => palette.pressRest()),
    // armClef, not setClef: the Clef window's OK confirms a choice, it does not toggle a button.
    clefSelection.onPress((c) => palette.armClef(c)),
  ]
  return () => stops.forEach((stop) => stop())
}
