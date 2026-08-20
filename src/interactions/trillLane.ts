/**
 * ⭐⭐ **WHERE A TRILL'S TWO SQUARES ARE DRAWN, PER CANDIDATE ANCHOR** — the geometry the
 * interpolating walk (`./trillWalk`) measures its gaps with, kept out of the walk itself because it
 * is a question about the LAST RENDER rather than about the gesture.
 *
 * `./hairpinLane`'s place in its family, and extracted for its reason: three routes (the keys, the
 * drag, and one day the Properties panel) must agree about where an end WOULD be if it hung off
 * another note, or a crossing that is meant to be invisible moves the ink.
 *
 * ## ⭐⭐ THE TWO ENDS MEASURE AGAINST DIFFERENT X'S — and the END's is not its own notehead
 *
 * `TrillRenderer.spanX` puts the sign on the start note's LEFT EDGE and stops the wavy line at the
 * left edge of the **next SLOT after the trill** — the end of a DURATION, not a notehead. So the
 * distance the drawn ink travels when the END re-anchors from one note to the next is the distance
 * between *their successors*, which is a different number wherever the spacing is uneven: over
 * `x = 0, 100, 300` an end moving from the first note to the second moves the line by 200 while the
 * two noteheads are 100 apart. ⛔ Measuring note-to-note there (the slur's rule, right for a slur
 * because ITS endpoint is drawn ON the head) would make every crossing jump by the difference.
 *
 * ⭐ **RESTS ARE IN THE LANE**, though they can never be an anchor: the line stops at the next slot
 * whatever it is, so a rest is a legitimate *successor* even while it is refused as a stop
 * (`./trillReanchor`). The two lists come from one beat map, filtered differently.
 *
 * ⚠️ **Centres, not left edges** — `headX` is the notehead's own centre and is the one horizontal a
 * note registers that an accidental cannot move (`bbox.x` is the container's, so a sharp shifts it
 * by its own width). Every x here is read the same way, so the constant half-head cancels out of
 * every difference; what does not cancel is a half-head DIFFERENCE between two successors of
 * unequal width, which is a fraction of a staff-space and below the ¼-space step of a press.
 */
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction, Note } from '../types/music'
import { buildBeatMap, type FlatNote } from '../utils/beatMap'
import { fracEq } from '../utils/fraction'
import { staffOf, voiceOf } from '../utils/lanes'

/** What the lane needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TrillLaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry'>

/**
 * ⭐ **THE TRILL'S LANE — every SLOT of it, in musical order, rests included.**
 *
 * The START note's own voice and staff, with no fallback: a trill that silently jumped voices would
 * be a wrong trill, not a recovered one (`./trillReanchor`'s rule, and the slur's before it).
 */
export function trillLane(engine: TrillLaneEngine, start: Note): FlatNote[] {
  return buildBeatMap(engine.getScore(), voiceOf(start), staffOf(start)).beats
}

/**
 * Where a slot sits in the lane, ⚠️ located by POSITION rather than by id: a chord's representative
 * in the beat map is its LOWEST note, so an anchor on any other member would not be found by id at
 * all. Returns -1 when nothing in the lane stands there.
 */
export function trillLaneIndexAt(
  lane: readonly FlatNote[],
  measure: number,
  beat: Fraction,
): number {
  return lane.findIndex(n => n.measureNumber === measure && fracEq(n.beat, beat))
}

/**
 * ⭐⭐ **WHERE THIS SQUARE'S INK WOULD BE if `lane[index]` were its anchor** — the whole point of the
 * module. Null when the last render drew nothing there (a culled bar, a lane off screen); the walk
 * then declines to cross rather than guessing, which is this family's standing rule.
 *
 *  - the START is drawn ON its note;
 *  - the END is drawn at the NEXT SLOT — and at the last slot of the lane there is none, so its own
 *    right-hand side stands in. ⚠️ The renderer falls back to the BAR's end there, which is further
 *    right; the two disagree only on the very last note of the lane, and only about a step that has
 *    nowhere further to go.
 */
export function trillSquareBaseX(
  registry: ElementRegistry,
  lane: readonly FlatNote[],
  which: 'start' | 'end',
  index: number,
): number | null {
  const here = lane[index]
  if (!here) return null
  if (which === 'start') return drawnCentreX(registry, here.id)
  const next = lane[index + 1]
  return next ? drawnCentreX(registry, next.id) : drawnRightX(registry, here.id)
}

/**
 * ⭐ **PIXELS PER STAFF-SPACE where this ornament was DRAWN** — ⛔ never a constant: the offset is
 * stored in staff-spaces, so a guessed scale writes a re-base of the wrong size, quietly, and only
 * on a staff that is not the default one (a small staff beside a normal one is a ratio).
 *
 * ⭐ Read off the STAFF the trill was registered on rather than off a field of its own entry: the
 * registry already scales a small staff's geometry (`scaleStaffGeometry`), so `lineSpacing` there is
 * the drawn distance, while a length parked on an element would have to be scaled by hand.
 */
export function trillStaffSpacePx(registry: ElementRegistry, trillId: string): number | null {
  const drawn = registry.getByType('trill').find(el => el.id === trillId)
  if (!drawn || drawn.measure === undefined) return null
  return registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0)?.lineSpacing ?? null
}

/** A drawn slot's horizontal centre — the notehead's own (`headX`) where it has one, else the ink
 *  box's. ⚠️ A rest registers under `'rest'` and a note under `'note'`, so both are consulted. */
function drawnCentreX(registry: ElementRegistry, id: string): number | null {
  const el = drawnSlot(registry, id)
  return el ? (el.headX ?? el.bbox.x + el.bbox.width / 2) : null
}

/** A drawn slot's right-hand side — what stands in for the successor at the end of the lane. */
function drawnRightX(registry: ElementRegistry, id: string): number | null {
  const el = drawnSlot(registry, id)
  return el ? el.bbox.x + el.bbox.width : null
}

function drawnSlot(registry: ElementRegistry, id: string) {
  return registry.getByType('note').find(el => el.id === id)
    ?? registry.getByType('rest').find(el => el.id === id)
}
