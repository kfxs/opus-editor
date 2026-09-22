/**
 * ⭐ **WHERE THE KEYBOARD CARET STANDS** — the blue line AFTER the selected note, where the next typed
 * letter lands (Sibelius's cursor). Extracted from `HighlightController.applyKeyboardCursor`, which
 * keeps the drawing.
 *
 * ⭐ **After a GRACE** (his rule, 2026-09-22: *"the grace stamp should behave similar to note stamp"*):
 * the caret stands at the next STEP's left edge — the next grace of the group, or its main note — the
 * steps the arrows walk (`walks/graceStops`). The letter typed there is the main note
 * (`KeyboardController.enterNoteAtCursorPosition`).
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import { navBeatMap } from '../../utils/beatMap'
import { graceHostId, locateStop, withGraceStops } from '../walks/graceStops'

/** @returns the caret's x and the bar it stands in, or null when there is nothing to stand after. */
export function keyboardCaretAt(
  engine: MusicEngine, selectedId: string, voice: number, staff: number,
): { x: number; measure: number } | null {
  const score = engine.getScore()
  const hostId = graceHostId(score, selectedId)
  // Cursor follows the active voice's stream ON the active staff (matches enterNoteAtCursorPosition).
  const { allFlat, beats } = navBeatMap(score, hostId ?? selectedId, voice, staff)
  const currentNote = allFlat.find(n => n.id === (hostId ?? selectedId))
  if (!currentNote) return null

  if (hostId) {
    const lane = withGraceStops(score, beats)
    const at = locateStop(score, lane, selectedId, { measure: currentNote.measureNumber, beat: currentNote.beat })
    const next = at === -1 ? undefined : lane.stops[at + 1]
    const info = next && engine.getElementById(next.id)
    return info ? { x: info.bbox.x, measure: next.measureNumber } : null
  }

  const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
  const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
  if (currentIndex === -1) return null

  const nextBeat = beats[currentIndex + 1]
  if (nextBeat) {
    const nextInfo = engine.getElementById(nextBeat.id)
    return nextInfo ? { x: nextInfo.bbox.x, measure: nextBeat.measureNumber } : null
  }
  const currentInfo = engine.getElementById(selectedId)
  return currentInfo ? { x: currentInfo.bbox.x + currentInfo.bbox.width, measure: currentNote.measureNumber } : null
}
