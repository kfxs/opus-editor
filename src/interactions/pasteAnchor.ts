/**
 * ⭐⭐ **WHERE A PASTE LANDS — the SELECTION, read as a POSITION.** His ask, 2026-08-19: *"if there
 * is something selected we anchor to it (in case of note rest, for example) or to the nearest point
 * (for example if a barline is selected), and if nothing is selected on ctrl+v we show the blue
 * cursor so the user click and we get the coordinates to paste"*.
 *
 * Three answers, in that order:
 *
 *  1. **NOTES selected** → the earliest one's own slot, exactly (`clipboard.earliestSelectedPosition`
 *     — the note clipboard's rule, reused rather than restated). A note IS a position: voice and
 *     staff travel with it, so a mark pasted here governs the stream you pointed at.
 *  2. **ONE ELEMENT selected** → the NEAREST anchorable point to it, which is what
 *     {@link anchorOfElement} answers per kind. Most kinds already carry a position (a dynamic's
 *     `{measure, beat}`, a clef's, a tuplet's start) or hang off a note that does; the two that
 *     carry only a BAR — the barline and the meter — resolve to a downbeat.
 *  3. **NOTHING selected** → `null`, and the caller arms click-to-place. ⭐ Null is a
 *     REFUSAL, never a guessed bar-1 downbeat: a paste that silently lands somewhere is the
 *     guessing-fallback bug, and the armed caret is the honest way to ask.
 *
 * ⛔ **The MODEL answers, not the render.** Every branch reads the score, so the anchor is the same
 * in a headless spec as on screen; nothing here measures ink, and a culled bar anchors as well as a
 * drawn one. (The one place geometry legitimately decides is the armed CLICK — `MouseController`
 * resolves the clicked slot, which is a question about pixels.)
 *
 * ⚠️ **Total over {@link SelectedElement}** — an eighteenth kind fails to BUILD until it says where
 * a paste beside it goes, the guarantee `assertNeverElement` gives everywhere else in this family.
 */
import type { Fraction, Measure, Score } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { assertNeverElement, type EditorState, type SelectedElement } from './EditorState'
import { earliestSelectedPosition } from './clipboard'
import { selectedNoteIds } from './selection'
import { staffIndexOfId } from '../engine/models/staffContent'
import { fracCreate, fracCompare, fracToNumber } from '../utils/fraction'
import { staffOf, voiceOf } from '../utils/lanes'

/**
 * A place a paste can land: a slot-boundary beat in a bar, plus whatever LANE the selection was
 * able to name. `staff`/`voice` are optional because half the selectable kinds genuinely name
 * neither (a barline is system-wide, a tempo mark has no voice) — absent means *the pasted thing
 * keeps its own*, which is the only honest default.
 */
export interface PasteAnchor {
  measure: number
  beat: Fraction
  /** 0-based staff index when the selection names one; absent = the pasted thing's own. */
  staff?: number
  /** 0-based voice when the selection names one; absent = the pasted thing's own.
   *  ⛔ **Not a dynamic's SCOPE.** It describes what was SELECTED, and `pasteElement` deliberately
   *  does not consult it for the dynamics family: an absent `Dynamic.voice` means *all voices of
   *  the staff*, so letting the anchor fill it in would narrow every pasted staff-wide mark
   *  (docs/dynamic-voice-scope-plan.md). The day a kind needs the selection's voice, this is it. */
  voice?: number
}

/** What the anchor needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type PasteAnchorEngine = Pick<MusicEngine, 'getScore' | 'getNote'>

/** The paste anchor the current selection implies, or null when nothing is selected. */
export function pasteAnchorFor(engine: PasteAnchorEngine, state: EditorState): PasteAnchor | null {
  const noteIds = selectedNoteIds(state.selectedItems.values())
  if (noteIds.length > 0) {
    const at = earliestSelectedPosition(engine.getScore(), noteIds)
    if (at) return at
  }
  return anchorOfElement(engine, state.selectedElement)
}

/** The nearest anchorable point to ONE selected element — the per-kind half of the rule above. */
export function anchorOfElement(engine: PasteAnchorEngine, element: SelectedElement | null): PasteAnchor | null {
  if (!element) return null
  const score = engine.getScore()
  switch (element.kind) {
    // A movable clef sits ON a slot boundary already; the number it stores is re-exacted from the
    // model, since a float beat loses tuplet precision (`MouseController.resolveSlotBeat`'s rule).
    case 'clef':
      return withLane(slotAnchorNear(score, element.measure, element.beat), element.staff, undefined)
    // The meter belongs to the whole bar — its downbeat is the only point it names.
    case 'timeSignature':
      return downbeatOf(score, element.measure)
    case 'barline':
      return afterBarline(score, element.measure)
    // A box marks bars; the paste goes at its FIRST one's downbeat, on the box's staff.
    case 'measureRange':
      return withLane(downbeatOf(score, Math.min(element.anchor, element.focus)), element.staff, undefined)
    // The five measure-owned marks all store their own `{measure, beat}` — that IS the anchor.
    case 'dynamic':
    case 'tempo':
    case 'hairpin':
    case 'ottava':
    case 'pedal':
      return markAnchor(score, element.id)
    case 'tuplet':
      return tupletAnchor(score, element.id)
    // The two note-anchored SPANS: each resolves through the note its start hangs off.
    case 'slur':
      return noteAnchor(engine, score.slurs?.find(s => s.id === element.id)?.startNoteId)
    case 'trill':
      return noteAnchor(engine, score.trills?.find(t => t.id === element.id)?.startNoteId)
    case 'tie':
      return noteAnchor(engine, element.fromNoteId)
    // The five sub-elements of a note ARE that note, positionally.
    case 'articulation':
    case 'accidental':
    case 'dot':
    case 'stem':
    case 'tremolo':
      return noteAnchor(engine, element.noteId)
    default:
      return assertNeverElement(element)
  }
}

/** Stamp a lane onto an anchor that resolved without one. */
function withLane(at: PasteAnchor | null, staff: number | undefined, voice: number | undefined): PasteAnchor | null {
  return at ? { ...at, ...(staff !== undefined ? { staff } : {}), ...(voice !== undefined ? { voice } : {}) } : null
}

function measureOf(score: Score, number: number): Measure | undefined {
  return score.measures.find(m => m.number === number)
}

/** The bar's first slot boundary — its own first slot's beat, which is 0 in any rest-filled bar. */
function downbeatOf(score: Score, measureNumber: number): PasteAnchor | null {
  const measure = measureOf(score, measureNumber)
  if (!measure) return null
  const first = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))[0]
  return { measure: measure.number, beat: first?.beat ?? fracCreate(0, 1) }
}

/**
 * A barline ENDS its bar, so the nearest point music can hang off is the NEXT bar's downbeat — ⛔
 * never the barline itself, which is not a position anything is anchored to (the tempo mark's own
 * rule, Gould p.183). At the end of the score there is no next bar, so it falls back to the last
 * slot of the bar the line closes.
 */
function afterBarline(score: Score, measureNumber: number): PasteAnchor | null {
  const next = downbeatOf(score, measureNumber + 1)
  if (next) return next
  const measure = measureOf(score, measureNumber)
  if (!measure) return null
  const last = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat)).pop()
  return last ? { measure: measure.number, beat: last.beat } : downbeatOf(score, measureNumber)
}

/** The model-exact slot beat nearest a float beat in `measureNumber`. */
function slotAnchorNear(score: Score, measureNumber: number, beat: number): PasteAnchor | null {
  const measure = measureOf(score, measureNumber)
  if (!measure) return null
  let best: Fraction | null = null
  let bestDist = Infinity
  for (const slot of measure.slots) {
    const dist = Math.abs(fracToNumber(slot.beat) - beat)
    if (dist < bestDist) { bestDist = dist; best = slot.beat }
  }
  return { measure: measure.number, beat: best ?? fracCreate(0, 1) }
}

/** One row per measure-owned mark family: they differ only in which array they live in. */
function markAnchor(score: Score, id: string): PasteAnchor | null {
  for (const measure of score.measures) {
    const marks: { id: string; beat: Fraction; voice?: number; staffId?: string }[] = [
      ...(measure.dynamics ?? []),
      ...(measure.tempos ?? []),
      ...(measure.hairpins ?? []),
      ...(measure.ottavas ?? []),
      ...(measure.pedals ?? []),
    ]
    const mark = marks.find(m => m.id === id)
    if (mark) {
      return {
        measure: measure.number,
        beat: mark.beat,
        ...(mark.staffId !== undefined ? { staff: staffIndexOfId(score, mark.staffId) } : {}),
        ...(mark.voice !== undefined ? { voice: mark.voice } : {}),
      }
    }
  }
  return null
}

function tupletAnchor(score: Score, id: string): PasteAnchor | null {
  for (const measure of score.measures) {
    const tuplet = measure.tuplets.find(t => t.id === id)
    if (tuplet) {
      return {
        measure: measure.number,
        beat: tuplet.startBeat,
        ...(tuplet.staffId !== undefined ? { staff: staffIndexOfId(score, tuplet.staffId) } : {}),
      }
    }
  }
  return null
}

/** A note IS a position — the exact slot, with the lane it sounds in. */
function noteAnchor(engine: PasteAnchorEngine, noteId: string | undefined): PasteAnchor | null {
  const note = noteId ? engine.getNote(noteId) : undefined
  return note ? { measure: note.measure, beat: note.beat, staff: staffOf(note), voice: voiceOf(note) } : null
}
