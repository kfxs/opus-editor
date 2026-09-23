/**
 * ⭐ **The TREMOLO stamp's click**, in its own module (moved out of `MouseController` unchanged,
 * 2026-09-23, as every newer stamp already lives here — and to make the room the parenthesised note's
 * stamp needs under that hub's `lint:hubs` line ceiling).
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, type EditorState } from '../state/EditorState'

/**
 * Tremolo stamp tool: a click puts the armed tremolo on the note clicked. Mirrors the accidental
 * stamp (`MouseController.stampAccidentalAtClick`) — one `runBatch` = one undo, SINGLE-valued and IDEMPOTENT (a note
 * already carrying that mark is a no-op; a note carrying a DIFFERENT one is replaced, because a
 * note has one tremolo).
 *
 * ⚠️ THE ONE STAMP WITH TWO TARGETS: the notehead **or the stem**. Every other stamp takes the
 * head alone, because that is where its mark lands. A tremolo's strokes ride the STEM, so that is
 * where the pointer naturally goes — insisting on the head would mean aiming at one place to put
 * ink in another. The head test runs first and unchanged (a click there still resolves by nearest
 * note); {@link ElementRegistry.findStemAt} is the second chance, and it hits the stem's OWN
 * registered rect — a containment test, not a nearest-note one, because a click at the top of a
 * stem is a whole stem-length from its own notehead, which is exactly where "nearest" picks the
 * wrong note.
 *
 * A REST is refused: you cannot tremolo silence. The click is still consumed — the tool is armed,
 * so a near-miss must not fall through to note entry.
 *
 * No playability ceiling, and none is needed: past the unmeasured threshold nothing is scheduled
 * as a subdivision at all, so there is no absurd note value to guard against (docs/plans/tremolo-plan.md
 * §2). A ceiling would also be unenforceable — shortening the note afterwards recreates the same
 * combination with no stamp in sight.
 */
export function stampTremoloAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const tremolo = armedTool(state, 'tremolo')?.tremolo
  if (tremolo === undefined) return false

  const nearest = registry.findClosestNoteOrRest(x, y)
  const onHead = nearest && registry.hitsNoteOrRestBody(nearest, x, y)
  // A stem carries `noteId`, never `id` (a stem must never answer a lookup for its note).
  const noteId = onHead ? nearest.id : registry.findStemAt(x, y)?.noteId
  if (!noteId) {
    dbg(`· Tremolo stamp: click not on a notehead or stem — no change`)
    return true
  }
  const note = engine.getNote(noteId)
  if (!note || note.isRest) {
    dbg(`· Tremolo stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }
  if (note.tremolo === tremolo) {
    dbg(`· Tremolo stamp: note ${noteId} already has tremolo ${tremolo} — no change`)
    return true
  }
  engine.runBatch(`Set tremolo ${tremolo}`, () => engine.setTremolo(noteId, tremolo))
  dbg(`✓ Tremolo stamped | ${tremolo} on note ${noteId}`)
  render()
  return true
}
