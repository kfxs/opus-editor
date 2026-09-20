/**
 * ⭐⭐ **HOW THE EDITOR DRIVES A SPAN MARK** — the interactions half of the family's two tables
 * (`docs/span-mark-family-plan-2026-08-24.md` Phase 3, decision D2), the twin of
 * {@link SPAN_MARK_MODEL}.
 *
 * ⭐⭐ **WHY TWO TABLES AND NOT ONE.** A mark's ops live in `engine/models/`, its gestures here, and
 * `lint:boundary` forbids `engine/` from importing `interactions/`. So no single object can name both
 * halves: the score's vocabulary is in `engine/models/spanMarkModel.ts`, the editor's is here, and the
 * two are keyed by the same {@link SpanMarkKind}. This side may name `MusicEngine`, the `bus` and the
 * `ElementRegistry` freely; ⛔ the other side may name none of them.
 *
 * ⭐⭐ **IT IS TOTAL** (the plan's `[A4]`): a mapped type over `SpanMarkKind`, so widening that union
 * makes `tsc` refuse the build until the new kind has written its row. ⛔ Never an array, never a
 * `Partial<…>`, never an index signature — each silently accepts a kind that forgot to say what it
 * does, and the miss is invisible until it ships. ⭐ A member only some kinds have is an OPTIONAL
 * member on the spec, ⛔ never a hole in the table.
 *
 * ⭐⭐ **EVERY ROW IS WRITTEN AT ITS OWN KIND, WHICH IS WHY NOTHING HERE CASTS.** The row for `pedal`
 * calls `armedTool(state, 'pedal')` and `bus.pedalGeometry` by name, so the payload narrows on the
 * spot and each seam's own spelling — `PedalGeometryRequest`'s `y` where the bracket has `outward` —
 * is translated INSIDE the row that owns it. The drivers above then see one shape and no unions to
 * correlate.
 *
 * ⚠️ **This is a table of pure specs — DATA, not state** (`lint:singletons` reads SCREAMING_SNAKE as a
 * lookup table and camelCase as a singleton; the naming *is* the rule). Nothing here holds a mark, an
 * engine or a subscription: a row is a bundle of functions, and the drivers own every lifetime.
 *
 * The drivers that read it: `./spanMarkStamp` (one click), `./SpanMarkGeometryController` (the
 * Properties boxes), `./spanMarkKeys` (the arrows, `Ctrl+Backspace` and `Tab`).
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { SpanMarkEnd, SpanMarkKind, SpanMarkOffsetField } from '../engine/models/spanMarkModel'
import type { EditorState } from './EditorState'
import { reanchorArmedTrillEndpoint } from './trillReanchor'
import { armedTool } from './EditorState'
import { bus } from '@/bus'
import { cycleOttavaEndpoint } from './elements/ottavaHandles'
import { cycleTrillEndpoint } from './elements/trillHandles'
import { cyclePedalEndpoint } from './elements/pedalHandles'
import { walkOttavaBody, walkOttavaEndpoint } from './ottavaWalk'
import { walkPedalBody, walkPedalEndpoint } from './pedalWalk'
import { walkTrillBody, walkTrillEndpoint } from './trillWalk'

/**
 * One Properties-panel request, in the family's own words: put THIS number at THIS value.
 *
 * ⭐ **Absolute**, because that is what a typed box means; the driver turns it into the engine's
 * accumulating nudge, which is what keeps the panel behind the same PAGE LIMIT as the keyboard
 * (docs/engraving-overrides-plan.md §8).
 */
export interface SpanMarkGeometryTarget {
  /** The mark whose ink to move. */
  id: string
  /** Which of its three stored numbers (see {@link SpanMarkOffsetField}). */
  field: SpanMarkOffsetField
  /** The value the box wants that number to have, in staff-spaces, in the MODEL's own signing. */
  wanted: number
}

/** What one CLICK of an armed span-mark tool makes — the row answers only when its tool is armed. */
export interface SpanMarkStampAction {
  /** The undo entry's description ("Add pedal", "Add 8va"). */
  label: string
  /** Place the mark at one note. `null` when the model refuses the anchor. */
  create(engine: MusicEngine, noteId: string): { id: string } | null
}

/** What the editor can do to one kind of span mark. */
export interface SpanMarkToolSpec {
  /**
   * ⭐ THE STAMP — `null` unless THIS kind's tool is the armed one, so `./spanMarkStamp` can ask the
   * table rather than the state and a kind that is not armed costs one property read.
   *
   * ⚠️ It reads the armed tool ITSELF rather than being handed one: the payload differs per kind
   * (the bracket's `shift`), and reading it inside the row is what keeps that difference typed.
   */
  armedStamp(state: EditorState): SpanMarkStampAction | null

  /** ⭐ THE PROPERTIES SEAM — subscribe, translating this kind's request shape into the family's.
   *  Returns the unsubscribe, like every bus store. */
  onGeometrySet(fn: (target: SpanMarkGeometryTarget) => void): () => void

  /** Move ONE end's ink, accumulating, undo entry and page limit included. */
  nudgeEnd(engine: MusicEngine, id: string, which: SpanMarkEnd, dx: number, dy: number): boolean

  /** Move the WHOLE mark's ink — both ends by the same delta. */
  nudgeWhole(engine: MusicEngine, id: string, dx: number, dy: number): boolean

  /** ⭐ Walk ONE end through the music: the ink moves, and hands the anchor along at each stop
   *  (`./markDrive`). The horizontal arrows' road. */
  walkEnd(engine: MusicEngine, id: string, which: SpanMarkEnd, dx: number): boolean

  /** ⭐ Walk the WHOLE mark through the music, length unchanged. */
  walkWhole(engine: MusicEngine, id: string, dx: number): boolean

  /** Drop ONE end's nudges. DECLINEs when it carries none, so the key falls through. */
  resetEnd(engine: MusicEngine, id: string, which: SpanMarkEnd): boolean

  /** Drop every nudge the mark carries. DECLINEs when it carries none. */
  resetWhole(engine: MusicEngine, id: string): boolean
  /**
   * Record the ONE undo entry a key RUN owes — a held arrow previews each repeat and settles once
   * (`./keyRun`), and these are what the settle calls: for an armed square, and for the whole mark.
   * ⚠️ A trill's whole-mark run commits through its START: the ornament has one drag commit, which
   * takes the end that was held.
   */
  commitEnd(engine: MusicEngine, which: SpanMarkEnd): void
  commitWhole(engine: MusicEngine): void
  /**
   * `Ctrl+Shift+←/→` on an ARMED square: move that end through the MUSIC by one stop — a MODEL
   * write, and audible (which notes are displaced, how long they ring, which are trilled). The far
   * end holds: the model writes `beat` and `length` together, and a start that crosses a barline
   * re-files the mark under the bar it now starts in, same object and same id, or the selection
   * driving the gesture would evaporate mid-press. It DECLINES rather than leave the mark holding
   * no music.
   *
   * ⚠️ What a STOP is differs by row: a bracket and a pedal walk the whole STAFF's slots — neither
   * has a voice, and a step that skipped the other voice's onsets would displace (or ring) notes
   * the key never passed — while a trill's anchors are NOTES, so it walks its lane a note at a time.
   */
  reanchor(engine: MusicEngine, state: EditorState, id: string, which: SpanMarkEnd, direction: 1 | -1): boolean

  /** `Tab` / `Shift+Tab`: arm the next drawn square. DECLINEs when this kind is not the selected one
   *  or its squares are not drawn — the caller CHAINS on a false. */
  cycleEnd(state: EditorState, registry: ElementRegistry, step: 1 | -1): boolean

  /**
   * ⭐⭐ **WHICH WAY IS UP, FOR THIS MARK, RIGHT NOW** — `1` when the stored vertical agrees with the
   * screen, `-1` when a screen-up `↑` has to arrive as a POSITIVE number.
   *
   * It is where {@link SpanMarkModelSpec.vertical}'s spelling becomes arithmetic, and it needs the
   * engine because an `outward` mark's side is DERIVED (a bracket's `shift`, an ornament's
   * placement) — the sign can differ between two marks of one kind.
   */
  verticalSign(engine: MusicEngine, id: string): 1 | -1
}

export const SPAN_MARK_TOOLS: { [K in SpanMarkKind]: SpanMarkToolSpec } = {
  pedal: {
    // ⭐ `createPedal([noteId])` — the engine's one-note resolution, the same pedal the palette row
    // gives a single selected note, so the two doors to a pedal cannot drift apart.
    //
    // ⭐⭐ **A SECOND CLICK LIFTS THE FIRST PEDAL** rather than stacking on it — `createPedal` goes
    // through `addPedalOverNotes`, whose truncation rule is the pianist's own gesture: press again
    // and the foot came up first (docs/pedal-plan.md §3.3). So stamping along a run of notes leaves a
    // chain of abutting pedals, which is exactly what a re-take looks like in this dress: `✻ Ped.`
    // side by side, as the old editions print it. ⚠️ That is the pedal's answer to a repeated click;
    // the bracket UPSERTS per (beat, staff) instead, which is why the rule lives in the row rather
    // than in the driver.
    armedStamp: (state) => armedTool(state, 'pedal')
      ? { label: 'Add pedal', create: (engine, noteId) => engine.pedal.createPedal([noteId]) }
      : null,

    // ⭐ The seam carries `PedalOffsetOverride`'s own spelling — two horizontals and ONE screen-signed
    // vertical, asked for without a sign named because a pedal and its release share a baseline
    // (Gould p. 333). Translating it here is what lets the driver hold one shape.
    onGeometrySet: (fn) => bus.pedalGeometry.onSet(req => fn(
      'y' in req
        ? { id: req.pedalId, field: 'vertical', wanted: req.y }
        : { id: req.pedalId, field: req.which, wanted: req.x },
    )),

    nudgeEnd: (engine, id, which, dx, dy) => engine.pedal.nudgePedalEndpoint(id, which, dx, dy),
    nudgeWhole: (engine, id, dx, dy) => engine.pedal.nudgePedal(id, dx, dy),
    walkEnd: (engine, id, which, dx) => walkPedalEndpoint(engine, id, which, dx),
    walkWhole: (engine, id, dx) => walkPedalBody(engine, id, dx),
    resetEnd: (engine, id, which) => engine.pedal.resetPedalEndpointOffset(id, which),
    resetWhole: (engine, id) => engine.pedal.resetPedalOffset(id),
    commitEnd: (engine, which) => engine.pedal.commitPedalDrag(which),
    commitWhole: engine => engine.pedal.commitPedalOffsetDrag(),
    reanchor: (engine, _state, id, which, direction) =>
      which === 'end' ? engine.pedal.resizePedalBySlot(id, direction) : engine.pedal.movePedalStartBySlot(id, direction),
    cycleEnd: (state, registry, step) => cyclePedalEndpoint(state, registry, step),

    // ⛔ No conversion, ever: a pedal has one side permanently, so `+ down` means the same thing
    // everywhere it can be drawn and the keyboard's number passes straight through.
    verticalSign: () => 1,
  },

  ottava: {
    // ⭐ `createOttava([noteId], shift)` — the engine's one-note resolution, and the SHIFT comes off
    // the armed tool, which is the whole of what this row has that the pedal's does not.
    //
    // ⭐⭐ **A SECOND CLICK REPLACES rather than stacking**: `addOttava` upserts per (beat, staff), so
    // pressing the `8vb` row on a note already carrying an 8va REPLACES it rather than leaving two
    // contradictory signs on one beat. ⚠️ The pedal's answer to a repeated click is the opposite
    // (a re-take, one pedalling after another), which is why this belongs in the row.
    armedStamp: (state) => {
      const tool = armedTool(state, 'ottava')
      return tool
        ? {
          label: `Add ${tool.shift > 0 ? '8va' : '8vb'}`,
          create: (engine, noteId) => engine.ottava.createOttava([noteId], tool.shift),
        }
        : null
    },

    // ⭐ The seam carries `OttavaOffsetOverride`'s spelling — two horizontals and ONE `outward`,
    // asked for without an end named because a bracket's two ends sit on one straight rule.
    onGeometrySet: (fn) => bus.ottavaGeometry.onSet(req => fn(
      'outward' in req
        ? { id: req.ottavaId, field: 'vertical', wanted: req.outward }
        : { id: req.ottavaId, field: req.which, wanted: req.x },
    )),

    nudgeEnd: (engine, id, which, dx, outward) => engine.ottava.nudgeOttavaEndpoint(id, which, dx, outward),
    nudgeWhole: (engine, id, dx, outward) => engine.ottava.nudgeOttava(id, dx, outward),
    walkEnd: (engine, id, which, dx) => walkOttavaEndpoint(engine, id, which, dx),
    walkWhole: (engine, id, dx) => walkOttavaBody(engine, id, dx),
    resetEnd: (engine, id, which) => engine.ottava.resetOttavaEndpointOffset(id, which),
    resetWhole: (engine, id) => engine.ottava.resetOttavaOffset(id),
    commitEnd: (engine, which) => engine.ottava.commitOttavaDrag(which),
    commitWhole: engine => engine.ottava.commitOttavaOffsetDrag(),
    reanchor: (engine, _state, id, which, direction) =>
      which === 'end' ? engine.ottava.resizeOttavaBySlot(id, direction) : engine.ottava.moveOttavaStartBySlot(id, direction),
    cycleEnd: (state, registry, step) => cycleOttavaEndpoint(state, registry, step),

    // ⭐⭐ THE ONE ROW THAT FLIPS. Screen-up arrives as a NEGATIVE `dy`, and above the staff "up" IS
    // "further out" — so an 8va negates and an 8vb does not. ⚠️ It asks the MODEL for the side rather
    // than remembering it: `x` flips a bracket (`toggleOttavaDirection`), so two marks of this one
    // kind can want opposite signs at the same moment.
    verticalSign: (engine, id) => ((engine.getOttavaById(id)?.shift ?? 1) > 0 ? -1 : 1),
  },

  trill: {
    // ⭐ `createTrill([noteId])` — one note is a complete ornament, and the extension (whether a
    // wavy line follows the sign at all) is the model's own answer, ⛔ never the stamp's.
    armedStamp: (state) => armedTool(state, 'trill')
      ? { label: 'Add trill', create: (engine, noteId) => engine.createTrill([noteId]) }
      : null,

    onGeometrySet: (fn) => bus.trillGeometry.onSet(req => fn(
      'outward' in req
        ? { id: req.trillId, field: 'vertical', wanted: req.outward }
        : { id: req.trillId, field: req.which, wanted: req.x },
    )),

    nudgeEnd: (engine, id, which, dx, outward) => engine.nudgeTrillEndpoint(id, which, dx, outward),
    nudgeWhole: (engine, id, dx, outward) => engine.nudgeTrill(id, dx, outward),
    // ⚠️ The one walk with a case of its own inside it: a BARE `tr` has no line to walk along, so
    // `walkTrillEndpoint` crosses the sign itself rather than looking for stops that do not exist.
    // ⭐ That stays in `./trillWalk` where the ornament's own rules live — the row POINTS at it.
    walkEnd: (engine, id, which, dx) => walkTrillEndpoint(engine, id, which, dx),
    walkWhole: (engine, id, dx) => walkTrillBody(engine, id, dx),
    resetEnd: (engine, id, which) => engine.resetTrillEndpointOffset(id, which),
    resetWhole: (engine, id) => engine.resetTrillOffset(id),
    commitEnd: (engine, which) => engine.commitTrillDrag(which),
    commitWhole: engine => engine.commitTrillDrag('start'),
    // One module answers for both squares: the walk is one lane either way (`./trillReanchor`).
    reanchor: (engine, state, _id, _which, direction) => reanchorArmedTrillEndpoint(state, engine, direction),
    cycleEnd: (state, registry, step) => cycleTrillEndpoint(state, registry, step),

    // ⭐ The bracket's flip, read off `placement` rather than `shift` — an ornament changes sides too.
    verticalSign: (engine, id) => ((engine.getTrillById(id)?.placement ?? 'above') === 'above' ? -1 : 1),
  },
}
