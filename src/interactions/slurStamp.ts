import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { armedTool } from './EditorState'

/**
 * ⭐ THE SLUR STAMP'S CLICK — a click on a note slurs it to the next slot.
 *
 * A module of its own, not a thirteenth `stamp…AtClick` method on `MouseController`, per CLAUDE.md's
 * rule; the controller keeps one line in its dispatch chain, beside `stampFanAtClick`.
 *
 * WHAT ONE CLICK MAKES. `createSlur([noteId])` — the engine's ONE-note endpoint resolution, the same
 * span the `s` key gives a single selected note: from the clicked note to the next distinct slot in
 * its own voice and staff. Nothing is invented here for the stamp, so the two doors to a slur cannot
 * drift apart, and the arc that appears is the arc `s` would have made.
 *
 * IDEMPOTENT, like every stamp beside it: `createSlur` returns the existing arc when one already
 * spans that pair and adds nothing. A stamp only ever ADDS — removal is select-the-arc + Delete.
 *
 * ⚠️ It IS a hit-test, unlike the rest and feather stamps: a slur is a relation between notes that
 * already exist, so the click must land on one (the tie stamp's rule, and the same note-body test).
 * A near-miss is CONSUMED rather than passed on — a stray note appearing under an armed spanner is
 * worse than a click that does nothing.
 *
 * The tool stays armed — you place slurs in runs, and placing one says nothing about being finished.
 */
export function stampSlurAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  if (!armedTool(state, 'slur')) return false

  const el = registry.findClosestNoteOrRest(x, y)
  if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
    dbg('· Slur stamp: click not on a note — no change')
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  // A REST anchors nothing: a slur is a phrase mark between sounding notes, and the engine would
  // happily span from one (it resolves by slot, not by sound), so the refusal belongs here.
  if (!note || note.isRest) {
    dbg(`· Slur stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  // createSlur commits its own undo entry; runBatch keeps the stamp's shape identical to its
  // siblings (one click = one undo) and is what marks the model dirty for the repaint.
  let slurId: string | null = null
  engine.runBatch('Add slur', () => { slurId = engine.createSlur([noteId])?.id ?? null })
  if (!slurId) {
    // No next slot to reach — the last note of the score, or of its voice. Quiet, like the tie's.
    dbg(`· Slur stamp: no valid span from note ${noteId} — no change`)
    return true
  }
  dbg(`✓ Slur stamped | from note ${noteId} → slur ${slurId}`)
  render()
  return true
}
