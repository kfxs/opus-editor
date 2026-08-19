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
 * ## 🚨🚨 THE CURSOR RIDES THE MARK'S LINE, AND THE CANDIDATES ARE ON THE MUSIC
 *
 * His report, 2026-08-18: *"while dragging the dynamic to the left, if my cursor goes a little low
 * it jumps to the other system"*. The mark is drawn several staff-spaces BELOW its notes, so a hand
 * aligned with the mark is that much nearer the NEXT system's noteheads — they are **genuinely
 * closer**, so this is ⛔ not a tolerance that can be widened out of trouble.
 *
 * So the cursor is TRANSLATED into the music before anything is compared: subtract the measured gap
 * between the mark and the note it is currently drawn over, then **the y picks the SYSTEM and the x
 * picks the NOTE** — a row window, then `|dx|`. ⛔ Never one hypotenuse over both axes: that lets a
 * pitch difference inside a row (a note four ledger lines up) outvote a hundred pixels of x, which is
 * the same complaint one axis further in. The gap is MEASURED every frame, never a constant — see
 * {@link markToMusicOffset}. `pedalHandles` / `ottavaHandles` / `trillHandles` all do this; the
 * hairpin's drag still does not, and sits nearer the staff.
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
import type { Dynamic, Score } from '../../types/music'
import { staffOf, voiceOf } from '../../utils/lanes'
import { fracCompare } from '../../utils/fraction'

/** What finding a drag target needs off the engine — a Pick, so a test can stand up the four reads
 *  without a renderer. */
export type DragEngine = Pick<MusicEngine, 'getDynamicById' | 'getScore' | 'getElementRegistry' | 'getNote'>

/** A slot of the mark's lane as it was DRAWN: the centre of its ink, and the address it stands for. */
export interface DynamicLaneHead {
  x: number
  y: number
  target: DynamicSlotTarget
}

/** ⚠️ HORIZONTAL only, now that the row is chosen separately. The family's number. */
const DYNAMIC_DRAG_SNAP_PX = 150

/** How far off a system's noteheads the translated cursor may be and still be READING that system.
 *  `PEDAL_DRAG_ROW_PX`'s twin — a tolerance, not a boundary. */
const DYNAMIC_DRAG_ROW_PX = 80

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
  const heads = dynamicLaneHeads(engine, dynamic)

  // 🚨 Into the music first — see the header. An untranslated y reads the wrong system.
  const inMusic = y - markToMusicOffset(engine, dynamicId, dynamic.placement ?? 'below', heads)

  // ⭐ The y picks the SYSTEM…
  const row = heads.filter(h => Math.abs(inMusic - h.y) <= DYNAMIC_DRAG_ROW_PX)
  if (!row.length) return null

  // …and the x picks the NOTE, on its own axis.
  let best: DynamicSlotTarget | null = null
  let bestDistance = DYNAMIC_DRAG_SNAP_PX
  for (const head of row) {
    const d = Math.abs(x - head.x)
    if (d < bestDistance) { bestDistance = d; best = head.target }
  }
  return best
}

/**
 * ⭐ **EVERY SLOT OF THE MARK'S LANE, AS DRAWN** — one candidate per ONSET, at the centre of its ink.
 *
 * ⚠️ A chord registers one entry per notehead on one onset; they share an x, so the first one
 * answers for the slot — the mark is centred on the COLUMN, not on a particular head of it.
 *
 * ⭐ Shared with the keyboard's interpolating walk (`interactions/dynamicWalk`), which asks the same
 * question of one address rather than of the cursor: the two doors must agree about where a slot is
 * drawn, or a mark walked with the arrows and one dragged would sit on different x's.
 */
export function dynamicLaneHeads(engine: DragEngine, dynamic: Dynamic): DynamicLaneHead[] {
  const score = engine.getScore()
  const lane = { voice: dynamic.voice ?? 0, staff: staffIndexOf(score, dynamic.staffId) }
  const heads: DynamicLaneHead[] = []
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
  return heads
}

/**
 * ⭐⭐ **HOW FAR THE MARK IS DRAWN FROM ITS OWN MUSIC**, in pixels, positive when the mark is BELOW —
 * what {@link dynamicDragTargetAt} subtracts from the cursor's y so the hand can ride the glyph's
 * own line instead of hunting for the noteheads.
 *
 * ⭐ **MEASURED, every frame** — the drawn mark's y minus the y of the onset it is drawn over — ⛔
 * never a constant and never re-derived from the ladder, which already contains whatever the
 * families inside it claimed this frame (a hairpin, a trill, an expression word on the same line).
 *
 * ⚠️ The anchor is looked up by ADDRESS, not by proximity: the mark's own (measure, beat) is the one
 * head we know it sits over, and a mark nudged sideways would find the wrong neighbour otherwise.
 * The fallback for an anchor that is not on screen (culled, or the mark dragged past the cull
 * window) is the nearest head on the side the music must be on — the sign comes from `placement`,
 * and ⛔ looking the wrong way finds the neighbouring system and reports a gap of nothing, which is
 * the original bug by the back door.
 *
 * Returns 0 when the mark is not drawn or nothing lies on the expected side — the honest "I don't
 * know", which leaves the raw cursor y in play rather than inventing a shift.
 */
function markToMusicOffset(
  engine: DragEngine,
  dynamicId: string,
  placement: 'above' | 'below',
  heads: ReadonlyArray<DynamicLaneHead>,
): number {
  const mark = engine.getElementRegistry().getByType('dynamic').find(e => e.id === dynamicId)
  if (!mark) return 0
  const markY = mark.bbox.y + mark.bbox.height / 2

  const address = dynamicAddress(engine.getScore(), dynamicId)
  const anchor = address && heads.find(h =>
    h.target.measure === address.measure && fracCompare(h.target.beat, address.beat) === 0)
  if (anchor) return markY - anchor.y

  const markX = mark.bbox.x + mark.bbox.width / 2
  const musicIsAbove = placement === 'below'
  let found: { x: number; y: number } | null = null
  let nearest = Infinity
  for (const h of heads) {
    if (musicIsAbove ? h.y >= markY : h.y <= markY) continue
    const d = Math.hypot(markX - h.x, markY - h.y)
    if (d < nearest) { nearest = d; found = h }
  }
  return found ? markY - found.y : 0
}

/** Where a dynamic lives, by measure and beat — the address its own `beat` field is only half of,
 *  since the measure is the LIST it is stored in. Null when the id is no longer in the score. */
export function dynamicAddress(score: Score, dynamicId: string): DynamicSlotTarget | null {
  for (const measure of score.measures ?? []) {
    const dyn = measure.dynamics?.find(d => d.id === dynamicId)
    if (dyn) return { measure: measure.number, beat: dyn.beat }
  }
  return null
}

/** The staff INDEX a dynamic's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinHandles`' twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
