import type { EditorState, StateListener } from './EditorState'
import type { BeamMode, NoteDuration, TremoloMark } from '../types/music'
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
import { beamSelection } from './beamSelection'
import { subdivideSelection } from './subdivideSelection'
import { beamOverSelection } from './beamOverSelection'
import { tremoloSelection } from './tremoloSelection'
import { fanSelection } from './fanSelection'
import { tremoloPairSelection } from './tremoloPairSelection'
import { accidentalTypeToKey } from '../utils/pitchSpelling'
import { multipleNotesSelected } from './selection'

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
  // …and nothing for a selection that HAS NO BEAM ROLE. A rest is not beamed — you cannot beam
  // silence — so it has no beam to author and `setBeam` already refuses it; `auto` lit over a
  // selected rest would be the row answering a question the note never asked, and offering a control
  // that does nothing.
  //
  // ⭐ The same sentence covers a FANNED MEMBER (his report), which is why this asks for the role
  // rather than for `isRest`: the beam belongs to the SLOT — where the group starts and ends — and a
  // member is a pitch inside one event, so `updateNote` drops a beam written onto it. `getBeamRole`
  // already answers null for both, and for the same reason (neither is a slot of its own in the
  // grouper's run), so one read is the whole rule. ⚠️ It must be read here and not only from
  // `getNote`: this reports the ARMED value, which survives a press on a member and would light a
  // key that changed nothing.
  return selectionHasNoBeamRole(state, engine) ? null : state.selectedBeam
}

/**
 * The slice of the engine the two beam rules read. Structural on purpose: a test can stand one up in
 * a line, and the rule stays a pure function of (state, score-facts) rather than of a whole engine.
 */
export interface BeamSource {
  getNote(noteId: string): { isRest?: boolean; secondaryBreak?: boolean; beamOver?: boolean } | undefined
  getBeamRole(noteId: string): BeamRole | null
}

/**
 * Does the selected note carry a SECONDARY BEAM BREAK — the beam subdivided in front of it?
 *
 * Authored or not, with no default to report: unlike the beam mode there is no `auto` here, the flag
 * is either on the note or it is not, so the button is simply lit or dark. Selection mode only, and
 * never on a rest: the toggle is a selection edit with no armed entry-mode value (see
 * `PaletteController.toggleSecondaryBreak`), so in entry mode there is nothing it could be about.
 */
export function secondaryBreakHighlight(state: EditorState, engine: BeamSource | null): boolean {
  if (!engine || state.selectedTool !== 'selection') return false
  if (state.selectedMarkingTool || noNoteInSelection(state) || !state.selectedNoteId) return false
  const note = engine.getNote(state.selectedNoteId)
  return !!note && !note.isRest && !!note.secondaryBreak
}

/**
 * Does the selected REST carry `beamOver` — beam over it instead of breaking? The mirror of
 * {@link secondaryBreakHighlight}: lit or dark, no `auto` to report, single selection only, and the
 * inverse population — it lights only for a rest (the toggle applies to nothing else). Whether a beam
 * actually runs over it depends on its neighbours; the button reports the authored flag, like the
 * beam row's own "did anyone author this?" half.
 */
export function beamOverHighlight(state: EditorState, engine: BeamSource | null): boolean {
  if (!engine || state.selectedTool !== 'selection') return false
  if (state.selectedMarkingTool || noNoteInSelection(state) || !state.selectedNoteId) return false
  const note = engine.getNote(state.selectedNoteId)
  return !!note && !!note.isRest && !!note.beamOver
}

/**
 * Can the single selected thing be in a beam group at all? False for a REST, for a FANNED MEMBER and
 * for a stale id — the three things `getBeamRole` answers null about, because none of them is a slot
 * in the grouper's run. Every real note gets a role (`single` at least), so this is not "nobody
 * beamed it", it is "there is no beam here to talk about".
 *
 * With NO engine it answers false, so the rule degrades to the armed value: the dev shell's row is
 * built with a null source in tests, and reporting nothing there would hide the armed beam.
 *
 * Scoped to selection mode, like the rest check it replaces — in entry mode the row reports what is
 * ARMED, and the selection is not what it is about.
 */
function selectionHasNoBeamRole(state: EditorState, engine: BeamSource | null): boolean {
  if (!engine || state.selectedTool !== 'selection' || !state.selectedNoteId) return false
  return engine.getBeamRole(state.selectedNoteId) === null
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
 * Which tremolo mark the palette lights, or null for none — the ARMED one, the SELECTED one, or the
 * one on the selected note.
 *
 * The four sources in that order, and the order is the rule (the accidental's, which is the closest
 * sibling — it is the other single-valued mark you can arm for entry, arm as a stamp, and select):
 *   1. a marking tool is armed → the armed tremolo if it IS the tremolo stamp, else null. Under a
 *      clef tool no tremolo is in play, and the row must not claim one is.
 *   2. NOTE ENTRY is armed with a mark, AND we are in entry mode → that one. What the next click
 *      will WRITE outranks what the selection happens to hold, exactly as the armed stamp does
 *      (§10). The mode gate matters because the armed mark PERSISTS across a trip into selection
 *      mode: while you are selecting, the row should answer about the score, not about the writing
 *      session you will come back to.
 *   3. the MARK itself is selected on the score → that note's mark. Clicking the strokes clears the
 *      note selection, so without this the row would go dark on exactly the click that selected it.
 *   4. otherwise the single selected note's own mark — "what does this note have on it", which is
 *      what makes the row an answer and not just an arming state.
 *
 * The score-derived halves are live-read from the engine rather than mirrored into state, like the
 * articulation / tie / beam-role highlights: the mark is a fact about the score, and a stamp, a
 * Delete or an undo all change it without going near the palette.
 */
export function tremoloHighlight(state: EditorState, engine: TremoloSource | null): TremoloMark | null {
  const armed = state.selectedMarkingTool
  if (armed) return armed.kind === 'tremolo' ? armed.tremolo : null
  if (state.selectedTremolo !== null && state.selectedTool === 'entry') return state.selectedTremolo
  if (!engine) return null
  if (state.selectedTremoloNoteId) return engine.getNote(state.selectedTremoloNoteId)?.tremolo ?? null
  if (noNoteInSelection(state) || !state.selectedNoteId) return null
  return engine.getNote(state.selectedNoteId)?.tremolo ?? null
}

/** The slice of the engine {@link tremoloHighlight} reads — structural, like {@link BeamSource}. */
export interface TremoloSource {
  getNote(noteId: string): { tremolo?: TremoloMark; tremoloPair?: true } | undefined
}


/**
 * Whether the TWO-NOTE tremolo button is lit — a SECOND AXIS, reported separately.
 *
 * {@link tremoloHighlight} answers with a `TremoloMark`, and the pair is not one of those: the count
 * says how fast, the pair says the strokes go between two notes. Both are true at once, so the count
 * lights as it always did and this lights beside it (docs/two-note-tremolo-plan.md §4).
 *
 * Only the two SCORE-derived sources of the four above, and deliberately: the pair has no armed
 * stamp and no note-entry form — the mark applies to notes that already exist, which is the standing
 * deferral. So there is nothing to report from an arming state, and it never lights for one.
 *
 * ⚠️ The raw flag, not `pairIsValid`. This says "the mark you would take off is a pair", which is
 * exactly what a stale flag still is to the button — pressing it clears the flag. What is DRAWN is
 * the renderer's question and it asks the predicate.
 */
export function tremoloPairHighlight(state: EditorState, engine: TremoloSource | null): boolean {
  if (state.selectedMarkingTool || !engine) return false
  if (state.selectedTremoloNoteId) return engine.getNote(state.selectedTremoloNoteId)?.tremoloPair === true
  if (noNoteInSelection(state) || !state.selectedNoteId) return false
  return engine.getNote(state.selectedNoteId)?.tremoloPair === true
}

/**
 * Which way the selected note's FANNED beam runs, or null when it has none — what lights the
 * `accel.` / `rit.` pair (docs/fanned-beams-plan.md §3, P2).
 *
 * ⭐ **Read from the selection, never pushed.** The fan is a fact about the score, so a Delete, an
 * undo or a paste changes it without going near the palette — the same live read the articulation,
 * tie, beam-role and two-note-tremolo highlights make.
 *
 * Only the score-derived source, like {@link tremoloPairHighlight} and for the same reason: a fan
 * applies to notes that already exist, so there is no arming state to report and it never lights for
 * one. It reports the DIRECTION rather than a boolean because the two buttons are one axis — a note
 * cannot be accelerating and slowing at once, so lighting `rit.` must dark `accel.`
 */
export function fanHighlight(state: EditorState, engine: FanSource | null): 'accel' | 'rit' | null {
  if (state.selectedMarkingTool || !engine) return null
  if (noNoteInSelection(state) || !state.selectedNoteId) return null
  return engine.getNote(state.selectedNoteId)?.fan?.direction ?? null
}

/** The slice of the engine {@link fanHighlight} reads — structural, like {@link TremoloSource}. */
export interface FanSource {
  getNote(noteId: string): { fan?: { direction: 'accel' | 'rit' } } | undefined
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
  /** The engine, for the MODEL half of the sync — see the two-source note on the return below. */
  getEngine: () => { onModelChange(fn: () => void): () => void } | null = () => null,
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
    // The beam cluster on page 2, all engine-read too: the beam MODE lights the authored beam and the
    // role it engraves (a set), the subdivide reads `secondaryBreak`, the beam-rest reads `beamOver`.
    palette.refreshBeamSelection()
    palette.refreshSubdivideSelection()
    palette.refreshBeamOverSelection()
    // The tremolo cluster on page 2, engine-read like the rest: the six marks are a radio (a note
    // carries one), the pair is a SECOND AXIS that lights beside the count.
    palette.refreshTremoloSelection()
    palette.refreshTremoloPairSelection()
    // …and the two feathered-beam keys beside them, engine-read for the same reason.
    palette.refreshFanSelection()
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
    // The beam cluster — the SAME palette methods the dev toolbar's Beam row calls, so a press from the
    // pad, the numpad, or the toolbar all arm/toggle identically.
    beamSelection.onPress((mode) => palette.setBeam(mode)),
    subdivideSelection.onPress(() => palette.toggleSecondaryBreak()),
    beamOverSelection.onPress(() => palette.toggleBeamOver()),
    // The tremolo cluster — `pressTremolo` is the SAME four-way router the dev toolbar's row calls
    // (edit the selected mark / apply across a selection / arm for entry / arm the stamp), and
    // `pressTremoloPair` the same button the toolbar's seventh key is.
    tremoloSelection.onPress((mark) => palette.pressTremolo(mark)),
    tremoloPairSelection.onPress(() => palette.pressTremoloPair()),
    // The feathered beams — `pressFan` is the SAME method the dev toolbar's `accel.`/`rit.` buttons
    // call, so a press from the pad, the numpad or the toolbar is one action.
    fanSelection.onPress((direction) => palette.pressFan(direction)),
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

  /**
   * ⚠️ TWO SOURCES. Almost every light on this pad is ENGINE-READ — the articulations, the tie, the
   * rest, the whole beam cluster, and now the tremolos — and reading the engine is useless if nothing
   * says READ AGAIN. A key that shows what the selected note CARRIES goes stale two ways: the
   * selection moves to another note (**state**, the subscribe above), or the SAME note is edited
   * under it (**model**). The second writes the score and no top-level state field, so the observable
   * Proxy never emits: change a selected note's tremolo and the pad kept lighting the old mark.
   *
   * `MusicEngine.onModelChange` is that second signal — the shape `wireSelectionInspection` and the
   * dev toolbar already use. LAZILY attached, because App.ts creates the engine after this is wired.
   */
  let stopModel: (() => void) | null = null
  const attachModel = () => {
    if (stopModel) return
    stopModel = getEngine()?.onModelChange(sync) ?? null
  }
  attachModel()
  stops.push(subscribe(attachModel))

  return () => {
    stops.forEach((stop) => stop())
    stopModel?.()
  }
}
