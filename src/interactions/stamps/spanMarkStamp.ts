import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { SPAN_MARK_MODEL, type SpanMarkKind } from '../../engine/models/spanMarkModel'
import type { EditorState } from '../state/EditorState'
import { SPAN_MARK_TOOLS } from './spanMarkTools'

/**
 * ⭐⭐ **ONE CLICK OF AN ARMED SPAN-MARK TOOL** — the click that puts a pedalling, an octave line or a
 * trill on the note under the pointer. One driver for the family, reading
 * {@link SPAN_MARK_TOOLS}; ⛔ **not** a `stamp…AtClick` per kind, and ⛔ not another method on
 * `MouseController` (CLAUDE.md §Important Rules). The controller keeps ONE line in its dispatch
 * chain and a new kind writes a table row.
 *
 * Everything below was identical in the per-kind copies, which is why it is here rather than in any
 * of them:
 *
 * ⭐ **The mark is made by the ENGINE's own one-note resolution** — the same call the palette row
 * makes for a single selected note. Nothing is invented for the stamp, so the two doors to a mark
 * cannot drift apart.
 *
 * ⭐ **One note is a COMPLETE span**, this family's shape rather than the slur's: the mark covers the
 * note it lands on and stops where the next begins. ⚠️ It matters most where the mark is AUDIBLE — a
 * pedalling blurs, a bracket transposes — because a stamp that guessed a longer span would silently
 * change music nobody clicked on. To cover a passage, select it and press the palette row.
 *
 * ⚠️ **A REST cannot anchor one**: the gesture means *mark THESE notes*, and there is nothing to mark
 * at a rest. (A span may of course run THROUGH a rest — that is a length, not an anchor.) The model
 * refuses it too; saying so here keeps the log honest about why the click did nothing — ⭐ a silent
 * decline costs round trips.
 *
 * ⚠️ **It IS a hit-test**, because a span mark is placed on music that already exists. A near-miss is
 * CONSUMED rather than passed on: a stray note appearing under an armed line tool is worse than a
 * click that does nothing.
 *
 * ⭐ **The tool stays armed** — you place marks in runs, and placing one says nothing about being
 * done.
 *
 * ⭐ One click = one undo entry: the create saves its own, and `runBatch` is what makes the shape
 * identical across the family and marks the model dirty for the repaint.
 *
 * @returns true when the click BELONGED to this tool (whether or not it made a mark), so the caller
 *   stops its chain; false when this kind's tool is not the armed one.
 */
export function stampSpanMarkAtClick(
  kind: SpanMarkKind,
  state: EditorState,
  engine: MusicEngine,
  registry: ElementRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  const stamp = SPAN_MARK_TOOLS[kind].armedStamp(state)
  if (!stamp) return false

  const { noun } = SPAN_MARK_MODEL[kind]
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)

  // ⭐ Nearest AND actually hit — one question, asked once (`ElementRegistry.noteOrRestAtBody`).
  const el = registry.noteOrRestAtBody(x, y)
  if (!el?.id) {
    dbg(`· ${Noun} stamp: click not on a note — no change`)
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  if (!note || note.isRest) {
    dbg(`· ${Noun} stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
    return true
  }

  let markId: string | null = null
  engine.runBatch(stamp.label, () => {
    markId = stamp.create(engine, noteId)?.id ?? null
  })
  if (!markId) {
    dbg(`· ${Noun} stamp: no valid anchor at note ${noteId} — no change`)
    return true
  }
  dbg(`✓ ${Noun} stamped | note ${noteId} → ${noun} ${markId}`)
  render()
  return true
}
