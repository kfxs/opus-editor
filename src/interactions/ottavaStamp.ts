import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { armedTool } from './EditorState'

/**
 * ⭐ THE OTTAVA STAMP'S CLICK — a click on a note puts an octave line over that note.
 *
 * A module of its own, not another `stamp…AtClick` method on `MouseController`, per CLAUDE.md's
 * rule; the controller keeps one line in its dispatch chain, beside `stampTrillAtClick`.
 *
 * WHAT ONE CLICK MAKES. `createOttava([noteId], shift)` — the engine's one-note resolution, the same
 * line the palette row gives a single selected note. Nothing is invented here for the stamp, so the
 * two doors to an octave line cannot drift apart.
 *
 * ⭐ **One note is a COMPLETE octave line**, the trill's shape rather than the slur's: the span
 * covers that note and stops where the next begins, so a stamped line can never displace music the
 * user did not point at. To raise a passage, select it and press the palette row. ⚠️ And the reason
 * that matters more here than for a wedge: an ottava CHANGES WHAT NOTES SOUND, so a stamp that
 * guessed a longer span would silently transpose music nobody clicked on.
 *
 * IDEMPOTENT in the way this family can be: `addOttava` upserts per (beat, staff), so a second press
 * on the same note replaces rather than stacks — and replacing an identical line changes nothing.
 * ⭐ Which also means pressing the `8vb` row on a note already carrying an 8va REPLACES it, rather
 * than leaving two contradictory signs on one beat. That is the model's rule surfacing as a gesture,
 * not a special case here.
 *
 * ⚠️ It IS a hit-test, like the trill's and for the same reason: an octave line is placed over music
 * that already exists, so the click must land on a note. A near-miss is CONSUMED rather than passed
 * on — a stray note appearing under an armed line tool is worse than a click that does nothing.
 *
 * The tool stays armed — you place lines in runs, and placing one says nothing about being done.
 */
export function stampOttavaAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  const tool = armedTool(state, 'ottava')
  if (!tool) return false

  const el = registry.findClosestNoteOrRest(x, y)
  if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
    dbg('· Ottava stamp: click not on a note — no change')
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  // A REST cannot anchor one: an octave line displaces SOUNDING music, and there is nothing to
  // displace at a rest. `createOttava` refuses it too; saying so here keeps the log honest about
  // why the click did nothing — a silent decline costs round trips.
  if (!note || note.isRest) {
    dbg(`· Ottava stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  // createOttava saves its own undo entry; runBatch keeps the stamp's shape identical to its
  // siblings (one click = one undo) and is what marks the model dirty for the repaint.
  let ottavaId: string | null = null
  engine.runBatch(`Add ${tool.shift > 0 ? '8va' : '8vb'}`, () => {
    ottavaId = engine.createOttava([noteId], tool.shift)?.id ?? null
  })
  if (!ottavaId) {
    dbg(`· Ottava stamp: no valid anchor at note ${noteId} — no change`)
    return true
  }
  dbg(`✓ Ottava stamped | note ${noteId} → ottava ${ottavaId} (shift ${tool.shift})`)
  render()
  return true
}
