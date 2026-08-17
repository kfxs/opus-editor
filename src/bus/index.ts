import { createAccidentalSelection } from './accidentalSelection'
import { createArticulationSelection } from './articulationSelection'
import { createArticulationStemAlignSelection } from './articulationStemAlignSelection'
import { createBeamOverSelection } from './beamOverSelection'
import { createBeamSelection } from './beamSelection'
import { createClefSelection } from './clefSelection'
import { createDotSelection } from './dotSelection'
import { createDurationSelection } from './durationSelection'
import { createFanEditSelection } from './fanEditSelection'
import { createTrillEditSelection } from './trillEditSelection'
import { createFanSelection } from './fanSelection'
import { createFanStampSelection } from './fanStampSelection'
import { createModeSelection } from './modeSelection'
import { createNoteOffsetSelection } from './noteOffsetSelection'
import { createRestSelection } from './restSelection'
import { createSelectionInspection } from './selectionInspection'
import { createSlurGeometrySelection } from './slurGeometrySelection'
import { createSoundSelection } from './soundSelection'
import { createSubdivideSelection } from './subdivideSelection'
import { createTieSelection } from './tieSelection'
import { createTimeSignatureSelection } from './timeSignatureSelection'
import { createTremoloPairSelection } from './tremoloPairSelection'
import { createTremoloSelection } from './tremoloSelection'
import { createTupletSelection } from './tupletSelection'
import { createVoiceSelection } from './voiceSelection'

/**
 * **The editor's UI bus** — the shared publish/subscribe seams between the controllers
 * (`interactions/`) and the panels that have no business seeing them (`windows/`).
 *
 * WHY IT IS A DIRECTORY OF ITS OWN. These stores lived in `interactions/` and were imported by name
 * from six window modules, while `interactions/shortcutWiring` imported the windows back: two
 * directories pointing at each other, which `docs/ARCHITECTURE.md`'s *"dependencies point inward and
 * downward"* does not describe. They were never interaction LOGIC — they are a noticeboard both
 * layers pin to. Filed as a leaf, both sides depend downward on it and neither on the other
 * (docs/refactor-plan-2026-07-27.md 3b).
 *
 * WHY IT IS ONE OBJECT. Each store used to be its own module-level singleton, imported by name —
 * `keypadPress.ts` named fourteen of them, `KeypadWidget.ts` fifteen. `docs/DESIGN-PRINCIPLES.md` §1
 * says nothing may assume there is exactly one editor, and boundary case 5 records that those
 * singletons are where that is not yet true, on the argument that undoing them is *"a contained
 * sweep because the list is known and short"*. Collapsing the exports is what keeps that true: the
 * day a second editor shares a page, {@link bus} goes and `createEditorBus()` is threaded through
 * `createEditorApp` instead — a change to about five files rather than twenty-six.
 *
 * ⚠️ The per-store MODULES stay, one per line below. Each carries the doc comment that explains its
 * own semantics — why a rest is `'rest'` and not a boolean, why the tremolo PAIR is a second axis
 * and never one of the count's values — and those explanations are the reason this bus is readable
 * at all. What collapsed is the twenty-one exports, not the twenty-one files.
 *
 * ⛔ NOT here: `windows/keypad/keypadPageSelection`. It is the same kind of store, but its value is a
 * `KeypadPageId` — vocabulary owned by the Keypad's own layout table — so putting it on the bus
 * would make the bus depend UPWARD on `windows/`, which is the one thing this directory exists to
 * prevent. It lives beside the layouts it names instead.
 */
export interface EditorBus {
  /** The armed note duration — the Keypad's 1–6 keys. */
  duration: ReturnType<typeof createDurationSelection>
  /** The armed accidental — ♮ ♯ ♭. Re-pressing the lit one takes it off. */
  accidental: ReturnType<typeof createAccidentalSelection>
  /** Accent / staccato / tenuto — a SET, since a note can wear all three. */
  articulation: ReturnType<typeof createArticulationSelection>
  /** Properties' "align to stem" checkbox. Command-only. */
  articulationStemAlign: ReturnType<typeof createArticulationStemAlignSelection>
  /** The beam MODE keys — a set, because authored beam and engraved role can differ. */
  beam: ReturnType<typeof createBeamSelection>
  /** The beam-over-a-rest flag. */
  beamOver: ReturnType<typeof createBeamOverSelection>
  /** The armed clef, plus the cautionary decision that travels with it. */
  clef: ReturnType<typeof createClefSelection>
  /** The dot key. */
  dot: ReturnType<typeof createDotSelection>
  /** Properties' fan inputs (count / beams / ramp range / spread). Command-only. */
  fanEdit: ReturnType<typeof createFanEditSelection>
  trillEdit: ReturnType<typeof createTrillEditSelection>
  /** The two feathered-beam keys, `accel.` and `rit.` — a radio, not a pair of toggles. */
  fan: ReturnType<typeof createFanSelection>
  /** The feather the Feathered Beam window asked for, as the sentence the dialog was told. Press-only.
   *  A second fan channel and not a value of {@link EditorBus.fan}: that one MARKS notes that exist,
   *  this one ARMS a stamp for notes that do not. */
  fanStamp: ReturnType<typeof createFanStampSelection>
  /** Selection mode as a Keypad key (the Select arrow). */
  mode: ReturnType<typeof createModeSelection>
  /** Properties' horizontal note-offset input. Command-only. */
  noteOffset: ReturnType<typeof createNoteOffsetSelection>
  /** Properties' slur-handle inputs (each end's offset, each arc control point). Command-only. */
  slurGeometry: ReturnType<typeof createSlurGeometrySelection>
  /** Whether what is selected IS A REST — the other half of the duration keys' statement. */
  rest: ReturnType<typeof createRestSelection>
  /** The score's playback sound (a GM program). Dev picker + Play ▸ Score Sound. TEMPORARY. */
  sound: ReturnType<typeof createSoundSelection>
  /** The subdivide key (secondary beam break). */
  subdivide: ReturnType<typeof createSubdivideSelection>
  /** The tie key. */
  tie: ReturnType<typeof createTieSelection>
  /** The armed meter, with its cautionary and pickup decisions. Press-only. */
  timeSignature: ReturnType<typeof createTimeSignatureSelection>
  /** The single-note tremolo keys — 1–5 strokes and the Penderecki sign. */
  tremolo: ReturnType<typeof createTremoloSelection>
  /** The TWO-NOTE tremolo key. A second axis beside {@link EditorBus.tremolo}, never one of its values. */
  tremoloPair: ReturnType<typeof createTremoloPairSelection>
  /** The tuplet the Tuplet window asked for, as the sentence the user typed. Press-only. */
  tuplet: ReturnType<typeof createTupletSelection>
  /** The active entry voice, 1–4. Never null — there is always one. */
  voice: ReturnType<typeof createVoiceSelection>
  /**
   * The current selection RESOLVED TO OBJECTS, for anything that wants to show it (the Properties
   * window). One channel only — a panel that displays the selection has nothing to press back.
   * Module: `selectionInspection.ts`.
   */
  inspection: ReturnType<typeof createSelectionInspection>
}

/** A complete, independent set of bus seams. One call per editor. */
export function createEditorBus(): EditorBus {
  return {
    duration: createDurationSelection(),
    accidental: createAccidentalSelection(),
    articulation: createArticulationSelection(),
    articulationStemAlign: createArticulationStemAlignSelection(),
    beam: createBeamSelection(),
    beamOver: createBeamOverSelection(),
    clef: createClefSelection(),
    dot: createDotSelection(),
    fanEdit: createFanEditSelection(),
    trillEdit: createTrillEditSelection(),
    fan: createFanSelection(),
    fanStamp: createFanStampSelection(),
    mode: createModeSelection(),
    noteOffset: createNoteOffsetSelection(),
    slurGeometry: createSlurGeometrySelection(),
    rest: createRestSelection(),
    sound: createSoundSelection(),
    subdivide: createSubdivideSelection(),
    tie: createTieSelection(),
    timeSignature: createTimeSignatureSelection(),
    tremolo: createTremoloSelection(),
    tremoloPair: createTremoloPairSelection(),
    tuplet: createTupletSelection(),
    voice: createVoiceSelection(),
    inspection: createSelectionInspection(),
  }
}

/**
 * The app's single bus.
 *
 * If two editors ever share a page this export goes, and `createEditorBus()` is threaded through
 * `createEditorApp` instead — ONE seam to change, which is the whole point of the collapse above.
 * Until then, one editor, one bus, and nothing behaves differently for it.
 */
export const bus = createEditorBus()

export type { ArmedClef } from './clefSelection'
export type { ArmedTimeSignature } from './timeSignatureSelection'
export type { ArmedTuplet } from './tupletSelection'
export type { ArmedFanStamp, FanStampContext } from './fanStampSelection'
export type { FanEditRequest } from './fanEditSelection'
export type { TrillEditRequest } from './trillEditSelection'
export type { NoteOffsetRequest } from './noteOffsetSelection'
export type { SlurGeometryRequest, SlurGeometryTarget } from './slurGeometrySelection'
export type { ArticulationStemAlignRequest } from './articulationStemAlignSelection'
