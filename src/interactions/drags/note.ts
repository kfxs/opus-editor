/**
 * The note/rest drag — **one press, two gestures, decided from the movement.** Vertical wins →
 * re-pitch. Horizontal wins → NOTE SPACING (docs/plans/note-spacing-plan.md §5), which is why a REST arms
 * this too: it has no pitch to drag, but it occupies a column exactly as a note does.
 *
 * ⭐ **The decision reads the SHAPE of the movement, ⛔ not its age.** Nothing happens until the
 * cursor leaves a small dead zone, so a click cannot nudge anything — and the gate is a DISTANCE
 * because a time gate can only answer "has the user committed to dragging", never "to what": under
 * one, a horizontal drag that wandered a staff step re-pitched the note on the first frame past
 * the threshold, in whichever direction the cursor happened to be.
 *
 * ⭐ **Once decided, the axis is FIXED for the rest of the press.** Re-deciding per frame would let
 * a curved drag re-pitch a note it had already started spacing — and both are real writes to the
 * score, not previews you can take back by moving the mouse elsewhere.
 *
 * ## The spacing half
 *
 * A space belongs to a COLUMN — a (measure, beat) — never to the grabbed note; for a fanned member
 * it is the member's own gap, not its group's (`MusicEngine.spacingColumnOf`, because the flat note
 * carries the SLOT's beat). The column follows the cursor and everything right of it slides along;
 * frames preview, the drop records one undo entry.
 *
 * - The leftward FLOOR is measured once, against the picture the user grabbed
 *   (`noteSpacingRoom`). Re-measuring per frame would judge the gesture against a score that is
 *   moving because of the gesture. ⛔ `null` = the last render cannot answer, and then the spacing
 *   half never arms: the column is not moved by a made-up amount.
 * - The scale is the grabbed note's OWN staff's line spacing, measured at the press. No zoom
 *   division: the coordinates are already layout px, the zoom transform undone.
 *
 * ## The pitch half
 *
 * The cursor gives a diatonic position — a LETTER — and its alteration is whatever is in force
 * there: the bar's running accidental, else the KEY (`entryAlteration`, the rule click entry and
 * the arrow keys read). Without it, dragging a note in G major lands an F♮ wearing a natural nobody
 * asked for. ⚠️ Each change of pitch is written through `updateNote` as it happens — its own undo
 * entry — so the drop has nothing left to record for this half.
 *
 * ⚠️ The note is read through the ENGINE (`getNote`), ⛔ not a walk of a measure's notes: that walk
 * reads `slot.notes` and is blind to a FANNED MEMBER, which would leave the drag silently doing
 * nothing on exactly the notes that were made draggable.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { Fraction, Note } from '../../types/music'
import { dbg } from '../../utils/debug'
import { staffOf } from '../../utils/lanes'
import { measureCapacityQuarters } from '../../utils/measureCapacity'
import { spellingToMidi } from '../../utils/pitchSpelling'
import type { EditorState } from '../EditorState'
import { entryAlteration } from '../../engine/models/entryAlteration'
import { DRAG_DISTANCE_THRESHOLD_PX, type DragHost, type Gesture } from './gesture'

/** What the horizontal half needs, captured at the press. */
interface SpacingGrab {
  measure: number
  beat: Fraction
  /** The space already authored there — the delta rides on top of it. */
  baseline: number
  /** The leftward floor. */
  minSpace: number
  staffSpacePx: number
}

function grabSpacing(engine: MusicEngine, note: Note | undefined): SpacingGrab | null {
  if (!note) return null
  const column = engine.spacingColumnOf(note.id)
  if (!column) return null
  const room = engine.noteSpacingRoom(column.measure, column.beat, note.id)
  if (room === null) return null
  const baseline = engine.getNoteSpacing(column.measure, column.beat)
  return {
    measure: column.measure,
    beat: column.beat,
    baseline,
    minSpace: baseline - room,
    staffSpacePx: engine.getElementRegistry().getStaffGeometry(note.measure, staffOf(note))?.lineSpacing ?? 10,
  }
}

/**
 * @param state The grabbed note is the SELECTED one — the press selected it — and is read from the
 *   selection on every frame, so a selection that goes away mid-press leaves the move to the
 *   controller.
 */
export function beginNoteDrag(
  host: DragHost, state: EditorState, engine: MusicEngine, noteId: string, x: number, y: number,
): Gesture {
  const grabbed = engine.getNote(noteId)
  /** A rest has nothing to re-pitch; its vertical drag is owned and does nothing. */
  const pitched = !!grabbed?.step
  const spacing = grabSpacing(engine, grabbed)
  let axis: 'undecided' | 'pitch' | 'spacing' = 'undecided'
  let spacingChanged = false

  const dragSpacing = (eng: MusicEngine, mx: number): void => {
    if (!spacing) return
    const dx = (mx - x) / spacing.staffSpacePx
    if (eng.previewNoteSpacing(spacing.measure, spacing.beat, spacing.baseline + dx, spacing.minSpace)) {
      spacingChanged = true
      host.render.renderScore()
    }
  }

  const dragPitch = (eng: MusicEngine, id: string, mx: number, my: number): void => {
    const note = eng.getNote(id)
    if (!note || note.isRest) return
    const measure = eng.getScore().measures.find(m => m.number === note.measure)
    if (!measure) return
    const position = eng.pixelToPosition({ x: mx, y: my }, measureCapacityQuarters(measure))
    const { step, octave } = position.spelling
    const alter = entryAlteration(
      eng.getScore(), { measure: note.measure, beat: note.beat, staff: note.staff }, step, octave)
    const cursorMidi = spellingToMidi(step, alter, octave)
    const noteMidi = spellingToMidi(note.step!, note.alter!, note.octave!)
    if (cursorMidi === noteMidi) return
    dbg(`Drag pitch change | midi:${noteMidi} -> ${cursorMidi}`)
    eng.updateNote(id, { step, alter, octave })
    host.render.renderScore()
  }

  return {
    kind: 'note',

    move(eng, mx, my) {
      const id = state.selectedNoteId
      if (!id) return false
      if (axis === 'undecided') {
        const dx = mx - x
        const dy = my - y
        if (Math.hypot(dx, dy) < DRAG_DISTANCE_THRESHOLD_PX) return true // dead zone: still a click
        axis = Math.abs(dx) > Math.abs(dy) ? 'spacing' : 'pitch'
        dbg(`Note drag axis | ${axis} (dx:${dx.toFixed(1)} dy:${dy.toFixed(1)})`)
      }
      if (axis === 'spacing') dragSpacing(eng, mx)
      else if (pitched) dragPitch(eng, id, mx, my)
      return true
    },

    end() {
      const eng = host.getEngine()
      if (axis === 'spacing' && spacingChanged && eng && spacing) {
        eng.commitNoteSpacing()
        dbg(`Note spacing set | bar ${spacing.measure} beat ${spacing.beat.num}/${spacing.beat.den}`
          + ` → ${eng.getNoteSpacing(spacing.measure, spacing.beat)} ss`)
      }
      host.release()
    },
  }
}
