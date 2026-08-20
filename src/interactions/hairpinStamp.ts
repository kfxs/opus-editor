import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'

/**
 * ⭐ THE HAIRPIN STAMP'S CLICK — a click on a note opens a wedge over that note.
 *
 * A module of its own beside `slurStamp`, per CLAUDE.md's rule; `MouseController` keeps one line in
 * its dispatch chain.
 *
 * WHAT ONE CLICK MAKES. `createHairpin`'s one-note resolution — the same span `H` gives a single
 * selected note: **the clicked note and nothing more**, so the wedge ends where the next note
 * begins. Nothing is invented here, so the three doors to a hairpin (the key, the palette row, the
 * stamp) cannot drift apart.
 *
 * ⛔ **Not "through the next slot"**, which the plan sketched and the first build did: it drew a
 * wedge over music the user had not pointed at (his report, 2026-08-12 — *"it should end when the F
 * starts"*). A wedge over one short note IS short; the answer to that is the angle cap in
 * `rendering/hairpinShape.ts`, and `Ctrl+→` for when more was meant.
 *
 * IDEMPOTENT, like every stamp beside it: an identical wedge already at that address is returned
 * rather than duplicated. A stamp only ever ADDS — removal is select-the-wedge + Delete.
 *
 * ⚠️ It IS a hit-test, like the slur's and unlike the rest stamp's: a hairpin is placed over notes
 * that already exist, so the click must land on one. A near-miss is CONSUMED rather than passed on
 * — a stray note appearing under an armed spanner is worse than a click that does nothing.
 *
 * The tool stays armed — you place hairpins in runs.
 */
export function stampHairpinAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  const tool = state.selectedMarkingTool
  if (tool?.kind !== 'hairpin') return false

  // ⭐ Nearest AND actually hit — one question, asked once (`ElementRegistry.noteOrRestAtBody`).
  const el = registry.noteOrRestAtBody(x, y)
  if (!el?.id) {
    dbg('· Hairpin stamp: click not on a note — no change')
    return true
  }
  const note = engine.getNote(el.id)
  // A REST anchors nothing: a hairpin says the SOUNDING music is changing, and `createHairpin`
  // refuses a rest for that reason — checked here too so the message says which door declined.
  if (!note || note.isRest) {
    dbg(`· Hairpin stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  // createHairpin saves its own undo entry; runBatch keeps the stamp's shape identical to its
  // siblings (one click = one undo) and is what marks the model dirty for the repaint.
  let hairpinId: string | null = null
  engine.runBatch(`Add ${tool.type === 'cresc' ? 'crescendo' : 'diminuendo'}`, () => {
    hairpinId = engine.createHairpin([el.id!], tool.type)?.id ?? null
  })
  if (!hairpinId) {
    // No next slot to reach — the last note of the score, or of its voice. Quiet, like the slur's.
    dbg(`· Hairpin stamp: no valid span from note ${el.id} — no change`)
    return true
  }
  dbg(`✓ Hairpin stamped | ${tool.type} from note ${el.id} → ${hairpinId}`)
  render()
  return true
}
