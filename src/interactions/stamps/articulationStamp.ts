/**
 * The ARTICULATION stamp's click — extracted from `MouseController` into the `stamps/` shape
 * (`hairpinStamp`), so the controller keeps one dispatch line per tool.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, type EditorState } from '../state/EditorState'

/**
 * Articulation stamp tool: add the armed articulation(s) to the note clicked. Only a real note
 * counts — a rest, empty staff space, or any other element is a no-op (but still consumes the
 * click, since the tool is armed). Uses the same note-body hit-test as selection-mode clicks
 * ({@link ElementRegistry.hitsNoteOrRestBody}), so clicking near-but-not-on a note does nothing.
 * Only the armed articulations the note LACKS are added (adding one it already has is meaningless);
 * the additions land as ONE undo entry via runBatch. Returns true whenever the stamp tool is armed
 * (the click is ours either way).
 */
export function stampArticulationAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const types = armedTool(state, 'articulation')?.types
  if (!types?.length) return false

  const el = registry.findClosestNoteOrRest(x, y)
  if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
    dbg(`· Articulation stamp: click not on a note — no change`)
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  if (!note || note.isRest) {
    dbg(`· Articulation stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }
  const missing = types.filter(t => !note.articulations?.includes(t))
  if (missing.length === 0) {
    dbg(`· Articulation stamp: note ${noteId} already has ${types.join('+')} — no change`)
    return true
  }
  engine.runBatch(`Add ${missing.join('+')}`, () => {
    for (const t of missing) engine.toggleArticulation(noteId, t) // each adds (note lacks it)
  })
  dbg(`✓ Articulation stamped | ${missing.join('+')} on note ${noteId}`)
  render()
  return true
}
