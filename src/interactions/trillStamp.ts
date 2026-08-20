import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { armedTool } from './EditorState'

/**
 * ⭐ THE TRILL STAMP'S CLICK — a click on a note trills that note.
 *
 * A module of its own, not another `stamp…AtClick` method on `MouseController`, per CLAUDE.md's
 * rule; the controller keeps one line in its dispatch chain, beside `stampSlurAtClick`.
 *
 * WHAT ONE CLICK MAKES. `createTrill([noteId])` — the engine's one-note resolution, the same trill
 * the palette row gives a single selected note. Nothing is invented here for the stamp, so the two
 * doors to a trill cannot drift apart.
 *
 * ⭐ **And one note is a COMPLETE trill**, which is where this parts company with the slur stamp
 * beside it. `createSlur([id])` has to reach forward to the next slot, because an arc needs two
 * ends; a trill on one note is finished, and how long it sounds comes from the ties. So a click
 * makes a plain `tr` with no wavy line, and a stamped trill can never be a length the user did not
 * ask for. To trill a passage, select it and press the palette row.
 *
 * IDEMPOTENT, like every stamp beside it: `createTrill` returns the existing ornament when the note
 * already carries one and adds nothing. A stamp only ever ADDS — removal is select-it + Delete.
 *
 * ⚠️ It IS a hit-test, like the slur's and for the same reason: a trill is a mark ON a note that
 * already exists, so the click must land on one. A near-miss is CONSUMED rather than passed on — a
 * stray note appearing under an armed ornament tool is worse than a click that does nothing.
 *
 * The tool stays armed — you place trills in runs, and placing one says nothing about being done.
 */
export function stampTrillAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  if (!armedTool(state, 'trill')) return false

  // ⭐ Nearest AND actually hit — one question, asked once (`ElementRegistry.noteOrRestAtBody`).
  const el = registry.noteOrRestAtBody(x, y)
  if (!el?.id) {
    dbg('· Trill stamp: click not on a note — no change')
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  // A REST carries no ornament: there is no trill without a note (docs/trill-plan.md §2). The
  // engine refuses one too (`trillOps.addTrill`), but saying so here keeps the log honest about why
  // the click did nothing — a silent decline costs round trips.
  if (!note || note.isRest) {
    dbg(`· Trill stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  // createTrill commits its own undo entry; runBatch keeps the stamp's shape identical to its
  // siblings (one click = one undo) and is what marks the model dirty for the repaint.
  let trillId: string | null = null
  engine.runBatch('Add trill', () => { trillId = engine.createTrill([noteId])?.id ?? null })
  if (!trillId) {
    // Refused — a fanned member (§2.2), or an id that no longer resolves. Quiet, like the slur's.
    dbg(`· Trill stamp: no valid anchor at note ${noteId} — no change`)
    return true
  }
  dbg(`✓ Trill stamped | note ${noteId} → trill ${trillId}`)
  render()
  return true
}
