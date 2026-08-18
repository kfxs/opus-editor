/**
 * ⭐⭐ **WHICH NOTE A DRAGGED DYNAMIC IS OVER** — the mouse twin of `Ctrl+Shift+←/→`, and the whole
 * of what a dynamic drag has to decide (his ask, 2026-08-18).
 *
 * The mark itself is the handle: a dynamic is a point, so unlike the four span families it has no
 * squares to grab and nothing to arm. Press it, drag, and it walks the same lane the arrows walk.
 *
 * ## ⭐⭐ It snaps to NOTEHEAD CENTRES — ⛔ not to the left edges the hairpin uses
 *
 * The two gestures look identical and take opposite answers, because the two marks are DRAWN against
 * different features. A wedge's tip is drawn at a note's LEFT EDGE (`HairpinRenderer.spanX`), so its
 * drag snaps to boundaries — snapping it to centres put the jump half a notehead early, his report
 * of 2026-08-17. A dynamic is drawn **centred on the notehead** (`rendering/dynamicMarkAnchor.ts`:
 * Gould, and LilyPond's `self-alignment-X = CENTER`), so the position it can occupy IS the head's
 * centre, and the cursor should choose the head it is nearest.
 *
 * ⚠️ **The distance is measured in BOTH axes**, though only x carries the answer within a system.
 * The y term is what stops a drag on system 2 snapping to a note at a similar x on system 1 —
 * 🚨 cross-system x's are not one ruler. The radius is generous because the cursor is never near a
 * notehead's y: the mark rides the dynamics line, several staff-spaces below the staff it belongs to.
 *
 * ⚠️ Candidates are the mark's OWN LANE (its voice, its staff), the filter the model's stepping op
 * applies — so a drag cannot land the mark anywhere the keyboard could not walk it. The model
 * refuses anything else anyway (`dynamicOps.setDynamicAtSlot`); this keeps the two from disagreeing
 * about which slot the cursor picked.
 *
 * ⭐ Rests are candidates. A `p` at the top of a bar that begins with a rest is ordinary, and the
 * keyboard's walk stops there too.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { DynamicSlotTarget } from '../../engine/models/dynamicOps'
import type { Score } from '../../types/music'
import { staffOf, voiceOf } from '../../utils/lanes'
import { fracCompare } from '../../utils/fraction'

/** What finding a drag target needs off the engine — a Pick, so a test can stand up the four reads
 *  without a renderer. */
type DragEngine = Pick<MusicEngine, 'getDynamicById' | 'getScore' | 'getElementRegistry' | 'getNote'>

/** ⚠️ Generous on purpose: the cursor rides the dynamics line, several staff-spaces below the
 *  noteheads it is choosing between. `HAIRPIN_DRAG_SNAP_PX`'s value and its reason. */
const DYNAMIC_DRAG_SNAP_PX = 150

/**
 * The lane slot the cursor is over, or null when nothing in the mark's lane is near enough.
 *
 * @returns the slot's (measure, beat) address — `dynamicOps.setDynamicAtSlot`'s target.
 */
export function dynamicDragTargetAt(
  engine: DragEngine,
  dynamicId: string,
  x: number,
  y: number,
): DynamicSlotTarget | null {
  const dynamic = engine.getDynamicById(dynamicId)
  if (!dynamic) return null
  const score = engine.getScore()
  const lane = { voice: dynamic.voice ?? 0, staff: staffIndexOf(score, dynamic.staffId) }

  // One candidate per ONSET, at the centre of its ink. ⚠️ A chord registers one entry per notehead
  // on one onset; they share an x, so the first one answers for the slot — the mark is centred on
  // the column, not on a particular head of it.
  const heads: Array<{ x: number; y: number; target: DynamicSlotTarget }> = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    if (voiceOf(note) !== lane.voice || staffOf(note) !== lane.staff) continue
    const target = { measure: note.measure, beat: note.beat }
    if (heads.some(h => h.target.measure === target.measure && fracCompare(h.target.beat, target.beat) === 0)) continue
    heads.push({ x: el.bbox.x + el.bbox.width / 2, y: el.bbox.y + el.bbox.height / 2, target })
  }

  let best: DynamicSlotTarget | null = null
  let bestDistance = DYNAMIC_DRAG_SNAP_PX
  for (const head of heads) {
    const d = Math.hypot(x - head.x, y - head.y)
    if (d < bestDistance) { bestDistance = d; best = head.target }
  }
  return best
}

/** The staff INDEX a dynamic's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinHandles`' twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
