import type { EditorState, StateListener } from './EditorState'
import type { BeamMode, NoteDuration } from '../types/music'
import { armedToolUsesLength } from './EditorState'
import type { BeamRole } from '../utils/beaming'
import type { PaletteController } from './PaletteController'
import { modeSelection } from './modeSelection'
import { durationSelection } from './durationSelection'
import { accidentalSelection } from './accidentalSelection'
import { articulationSelection } from './articulationSelection'
import { dotSelection } from './dotSelection'
import { tieSelection } from './tieSelection'
import { restSelection } from './restSelection'
import { voiceSelection } from './voiceSelection'
import { clefSelection } from './clefSelection'
import { timeSignatureSelection } from './timeSignatureSelection'
import { tupletSelection } from './tupletSelection'
import { accidentalTypeToKey } from '../utils/pitchSpelling'
import { multipleNotesSelected } from './selection'
import { keypadProbe } from '../windows/keypad/keypadProbe'

/**
 * The highlight rule, in one place: a palette value is shown only when it means something —
 * in entry mode (the armed value), or in selection mode with a SINGLE note selected (the note's,
 * kept in sync by SelectionController). Select a non-note or clear the canvas and there is no
 * note to reflect; select MORE THAN ONE note and no single value can stand for the set — so nothing
 * lights up in either case, on the dev toolbar AND the Keypad (the toolbar's own button syncers call
 * this too, so the rule is single-sourced).
 */
export function noNoteInSelection(state: EditorState): boolean {
  if (state.selectedTool !== 'selection') return false
  return !state.selectedNoteId || multipleNotesSelected(state.selectedItems.values())
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
 * it is the RULE, and the dev toolbar's duration buttons read it too.
 */
export function durationHighlight(state: EditorState): NoteDuration | null {
  if (state.selectedMarkingTool) return armedToolUsesLength(state) ? state.selectedDuration : null
  return noNoteInSelection(state) ? null : state.selectedDuration
}

/**
 * The beam follows the duration's rule, and for the duration's reason — with one difference worth
 * naming: `BeamMode` has no "none". Every note is beamed somehow, so `'auto'` is a real answer and
 * one of the five buttons is always lit… which means that with NOTHING selected the row would sit
 * there claiming the non-existent selection is auto-beamed. Hence the null: nothing to say, nothing
 * lit. (Also null under any marking tool — one arms into entry mode but enters no note, so there is
 * nothing about to be beamed.)
 */
export function beamHighlight(state: EditorState, engine: BeamSource | null): BeamMode | null {
  if (state.selectedMarkingTool) return null
  if (noNoteInSelection(state)) return null
  // …and nothing for a REST. A rest is not beamed — you cannot beam silence — so it has no beam to
  // author and `setBeam` already refuses it. `auto` lit over a selected rest would be the row
  // answering a question the note never asked, and offering a control that does nothing.
  return selectionIsRest(state, engine) ? null : state.selectedBeam
}

/**
 * The slice of the engine the two beam rules read. Structural on purpose: a test can stand one up in
 * a line, and the rule stays a pure function of (state, score-facts) rather than of a whole engine.
 */
export interface BeamSource {
  getNote(noteId: string): { isRest?: boolean } | undefined
  getBeamRole(noteId: string): BeamRole | null
}

/**
 * Is the single selected thing a rest? Narrower than `PaletteController.selectionIsRest`, which also
 * answers true for the armed rest STAMP — a tool, not a selection. Every caller here has already
 * returned null under a marking tool, so this asks only about the score.
 */
function selectionIsRest(state: EditorState, engine: BeamSource | null): boolean {
  if (!engine || state.selectedTool !== 'selection' || !state.selectedNoteId) return false
  return !!engine.getNote(state.selectedNoteId)?.isRest
}

/**
 * The OTHER beam fact: the role the selected note actually ends up in — begin / continue / end /
 * single — read live from the engine's grouping.
 *
 * {@link beamHighlight} alone is not quality information. Eight auto eighths beamed 2+2+2+2 report
 * `auto` on every one of them, so the row says "nobody authored this" and stays silent about the
 * engraving — while the first note of each pair begins a beam and the second ends it. Both facts
 * are shown at once because they are independent, and where they disagree (an orphaned `end` that
 * engraves as `single`) the disagreement is the point.
 *
 * Selection mode with one note only: in entry mode `beamHighlight` reports the ARMED beam, the beam
 * of a note that does not exist yet, and there is no role to pair it with. Live-read rather than
 * mirrored into state, like the articulation / tie / rest highlights: it is a property of the score,
 * and every neighbouring edit can change it.
 */
export function beamRoleHighlight(state: EditorState, engine: BeamSource | null): BeamRole | null {
  if (!engine || state.selectedTool !== 'selection') return null
  if (state.selectedMarkingTool || noNoteInSelection(state) || !state.selectedNoteId) return null
  // No rest check needed here: the model answers null for a rest, because a rest HAS no role.
  return engine.getBeamRole(state.selectedNoteId)
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
  // This gate belongs HERE, not at the caller: `dotHighlight` is the RULE, and the dev toolbar reads
  // it too — gating it in keypadSync.sync() alone would light the toolbar's dot button under an
  // armed clef while the Keypad's stayed dark.
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
 * toolbar button calls — so a retuned note / armed ghost / a toggle-off all happen identically. The
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
    // The voice key follows the SAME single-selection rule as the others: light the active voice when
    // it means something — entry mode (the voice you're writing into) or a single selected note (its
    // voice) — and NOTHING when nothing, or more than one note, is selected (no single voice to show).
    voiceSelection.setHighlight(noNoteInSelection(state) ? null : state.activeVoice)
    // Engine-derived highlights (articulations are a SET, tie reads tiedTo, rest reads isRest): read
    // live, not from a reactive field, so they can't be mirrored — recompute and push on any change.
    palette.refreshArticulationSelection()
    palette.refreshTieSelection()
    palette.refreshRestSelection()
  }
  sync() // prime

  const stops = [
    subscribe(sync),
    // 🚧 TEMPORARY, with the unwired-key probe light (windows/keypad/keypadProbe): ANY editor state
    // change puts it out — Esc, a click on nothing, an arrow-key move, entering a note. A press of an
    // unwired key writes no state at all, which is exactly what makes this the right signal: the light
    // survives until something actually happens, and then it stops claiming to be current. Goes when
    // page 2 is wired and its keys light from the editor like every other key.
    subscribe(() => keypadProbe.clear()),
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
    // Same path as Alt+1..4 / the toolbar: arm the voice for entry, or move the selection into it.
    voiceSelection.onPress((v) => palette.setActiveVoice(v)),
    // armClef, not setClef: the Clef window's OK confirms a choice, it does not toggle a button.
    clefSelection.onPress((a) => palette.armClef(a.clef, a.cautionary)),
    timeSignatureSelection.onPress((a) => palette.armTimeSignature(a.timeSignature, a.cautionary, a.pickup)),
    // The window sends the SENTENCE ("3 ♪ in the time of 1 ♩"); the controller turns it into a shape,
    // exactly as the palette's own boxes do. It can still refuse — the window has already checked,
    // but the check is the controller's, not a promise the caller gets to make.
    tupletSelection.onPress((a) =>
      palette.armTupletInTimeOf(a.numNotes, a.unit, a.normalCount, a.normalUnit, a.unitDots, a.normalDots, a.format),
    ),
  ]
  return () => stops.forEach((stop) => stop())
}
