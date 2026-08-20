import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { armedTool } from './EditorState'

/**
 * ⭐ THE PEDAL STAMP'S CLICK — a click on a note puts a sustain pedal under it, held through that
 * note.
 *
 * A module of its own, not another `stamp…AtClick` method on `MouseController`, per CLAUDE.md's
 * rule; the controller keeps one line in its dispatch chain, beside `stampOttavaAtClick`.
 *
 * WHAT ONE CLICK MAKES. `createPedal([noteId])` — the engine's one-note resolution, the same pedal
 * the palette row gives a single selected note. Nothing is invented here for the stamp, so the two
 * doors to a pedal cannot drift apart.
 *
 * ⭐ **One note is a COMPLETE pedal**, the ottava's and trill's shape rather than the slur's: the
 * damper goes down at that note and comes up where the next begins, so a stamped pedal can never
 * hold music the user did not point at. To hold a passage, select it and press the palette row.
 * ⚠️ And it matters here for the ottava's reason one step further: a pedal CHANGES WHAT IS HEARD
 * (docs/pedal-plan.md §9), so a stamp that guessed a longer span would silently blur music nobody
 * clicked on.
 *
 * ⭐⭐ **A second click LIFTS the first pedal** rather than stacking on it — `createPedal` goes
 * through `addPedalOverNotes`, whose truncation rule is the pianist's own gesture: press again and
 * the foot came up first (docs/pedal-plan.md §3.3). So stamping along a run of notes leaves a chain
 * of abutting pedals, which is exactly what a re-take looks like in this dress: `✻ Ped.` side by
 * side, as the old editions print it.
 *
 * ⚠️ It IS a hit-test, like the ottava's and for the same reason: a pedal is placed under music that
 * already exists, so the click must land on a note. A near-miss is CONSUMED rather than passed on —
 * a stray note appearing under an armed line tool is worse than a click that does nothing.
 *
 * The tool stays armed — you place pedals in runs, and placing one says nothing about being done.
 */
export function stampPedalAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  if (!armedTool(state, 'pedal')) return false

  // ⭐ Nearest AND actually hit — one question, asked once (`ElementRegistry.noteOrRestAtBody`).
  const el = registry.noteOrRestAtBody(x, y)
  if (!el?.id) {
    dbg('· Pedal stamp: click not on a note — no change')
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  // A REST cannot anchor one: the gesture means *hold THESE notes*, and there is nothing to hold at
  // a rest. (A pedal may of course be held THROUGH a rest — that is a length, not an anchor, and it
  // is what `Ctrl+→` reaches.) `createPedal` refuses it too; saying so here keeps the log honest
  // about why the click did nothing — a silent decline costs round trips.
  if (!note || note.isRest) {
    dbg(`· Pedal stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  // createPedal saves its own undo entry; runBatch keeps the stamp's shape identical to its siblings
  // (one click = one undo) and is what marks the model dirty for the repaint.
  let pedalId: string | null = null
  engine.runBatch('Add pedal', () => {
    pedalId = engine.createPedal([noteId])?.id ?? null
  })
  if (!pedalId) {
    dbg(`· Pedal stamp: no valid anchor at note ${noteId} — no change`)
    return true
  }
  dbg(`✓ Pedal stamped | note ${noteId} → pedal ${pedalId}`)
  render()
  return true
}
