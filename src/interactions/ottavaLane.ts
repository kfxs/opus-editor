/**
 * ⭐⭐ **WHERE AN OTTAVA'S LANE WAS DRAWN** — the onsets one of its two ends may stand on, as pixels
 * off the LAST RENDER, plus the addresses the bracket holds right now.
 *
 * Extracted from `elements/ottavaHandles.ottavaDragTargetAt` on 2026-08-21, when the two squares
 * asked for the interpolating walk (`./ottavaWalk`): the mouse had the geometry and the keyboard
 * would otherwise have grown a second copy of it. ⛔ Two lists of "where a slot is drawn" are two
 * answers that can disagree — `./hairpinLane` was split out of the wedge's drag for exactly this
 * reason, and this is its twin one lane over.
 *
 * ⭐⭐ **THE TWO ENDS READ DIFFERENT EDGES OF THE SAME ONSET.** `OttavaRenderer.spanX` puts the
 * numeral at the first covered notehead's LEFT edge and the hook at the last covered notehead's
 * RIGHT edge (Gould's rule 2 — ⛔ the opposite of the wedge, whose tips are both drawn on left
 * edges). So {@link ottavaEdgeX} takes the end as an argument: measuring both against one edge is
 * exactly the mistake that made the hairpin drag *"jump before x mouse reach the target"*.
 *
 * ⚠️ **The lane is the bracket's STAFF, every voice** — `ottavaOps.resizeOttavaBySlot`'s rule, and
 * the reason the ottava exists: an octave line has no voice, it displaces whatever the staff plays.
 * That is the same filter the model's stepping ops apply, so no route can reach a slot another route
 * cannot.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { OttavaSlotTarget } from '../engine/models/ottavaOps'
import { ottavaSpan } from '../engine/models/ottavaOps'
import type { Ottava, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
import { fracCompare } from '../utils/fraction'

/** What reading the lane needs off the engine — a Pick, so a spec can stand up the reads without a
 *  renderer. `hairpinLane.HairpinLaneEngine`'s twin. */
export type OttavaLaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** One onset of the lane as it was DRAWN: the left edge the numeral would stand at, the right edge
 *  the hook would close around, a y to tell systems apart, and the address. */
export interface OttavaLaneOnset {
  left: number
  right: number
  y: number
  target: OttavaSlotTarget
}

/**
 * Every onset of `ottava`'s lane the last render drew, once each.
 *
 * ⚠️ A CHORD registers one entry per notehead at one onset, and a second interval displaces one of
 * them sideways — so entries sharing an address merge into a single onset keeping the LEFTMOST and
 * the RIGHTMOST edge, which is the pair the bracket is actually drawn against.
 */
export function ottavaLaneOnsets(engine: OttavaLaneEngine, ottava: Ottava): OttavaLaneOnset[] {
  const staff = staffIndexOf(engine.getScore(), ottava.staffId)
  const onsets: OttavaLaneOnset[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    // ⛔ No voice filter — an octave line governs the whole staff.
    if (staffOf(note) !== staff) continue
    const target = { measure: note.measure, beat: note.beat }
    const seen = onsets.find(o => sameAddress(o.target, target))
    if (seen) {
      seen.left = Math.min(seen.left, el.bbox.x)
      seen.right = Math.max(seen.right, el.bbox.x + el.bbox.width)
      continue
    }
    onsets.push({
      left: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: el.bbox.y + el.bbox.height / 2,
      target,
    })
  }
  return onsets
}

/**
 * ⭐ **WHERE ONE END STANDING AT `at` IS DRAWN** — the far side of every gap the walk measures, for
 * today's address and for a candidate one alike, read from the SAME list so the two ends of a gap
 * cancel whatever that list is systematically off by.
 *
 * Null when the last render drew nothing there — the no-guessing rule (`./markWalk`).
 */
export function ottavaEdgeX(
  engine: OttavaLaneEngine,
  ottava: Ottava,
  at: OttavaSlotTarget,
  which: 'start' | 'end',
): number | null {
  const onset = ottavaLaneOnsets(engine, ottava).find(o => sameAddress(o.target, at))
  if (!onset) return null
  return which === 'start' ? onset.left : onset.right
}

/** The address the bracket BEGINS at — the measure is half of it, so it comes from the span rather
 *  than off the `Ottava` object (which carries only its beat). Null for an id no longer in the
 *  score. ⚠️ The END's address is a MODEL read (`ottavaOps.ottavaEndSlot`): the hook stands at the
 *  last COVERED notehead, which the span's exclusive end overshoots by that note's own length. */
export function ottavaStartAddress(score: Score, id: string): OttavaSlotTarget | null {
  const span = ottavaSpan(score, id)
  return span ? { measure: span.startMeasure, beat: span.startBeat } : null
}

/**
 * The pixels per staff-space at the DRAWN bracket — the divisor every pixel↔staff-space conversion
 * about it uses. ⛔ Never a constant: the bracket may be on a SMALL staff, and a guessed size writes
 * a re-base of the wrong size, quietly (`hairpinHandles.hairpinStaffSpacePx`'s rule).
 *
 * Null when the last render drew no fragment of it.
 */
export function ottavaStaffSpacePx(registry: ElementRegistry, ottavaId: string): number | null {
  const drawn = registry.getByType('ottava').find(e => e.id === ottavaId)
  if (!drawn || drawn.measure === undefined) return null
  return registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0)?.lineSpacing ?? null
}

/**
 * ⭐ **THE DRAWN EXTENT OF THE SYSTEM an address was drawn on** — its line's first `noteStartX` and
 * last `noteEndX`, in pixels, plus the `top` that NAMES the row. `hairpinLane`'s twin, and the
 * bracket's PORT into the shared break wrap (`./markBreakWrap`).
 *
 * ⭐ `top` is the staff's own top line: every bar of one system shares it and bars on other systems
 * do not, so a caller can ask *"are these two addresses on one ruler?"* without comparing x's — a
 * question x's cannot answer (a later line's x may be larger, smaller or equal).
 *
 * @returns null when that bar was not drawn.
 */
export function ottavaSystemInkLimit(
  engine: OttavaLaneEngine,
  ottava: Ottava,
  at: OttavaSlotTarget,
): { min: number; max: number; top: number } | null {
  const registry = engine.getElementRegistry()
  const staff = staffIndexOf(engine.getScore(), ottava.staffId)
  const home = registry.getStaffGeometry(at.measure, staff)
  if (!home) return null

  let min = home.noteStartX
  let max = home.noteEndX
  for (const measure of engine.getScore().measures ?? []) {
    const geometry = registry.getStaffGeometry(measure.number, staff)
    if (!geometry || geometry.lineYPositions[0] !== home.lineYPositions[0]) continue
    min = Math.min(min, geometry.noteStartX)
    max = Math.max(max, geometry.noteEndX)
  }
  return { min, max, top: home.lineYPositions[0] }
}

/** Two lane addresses naming the same onset. ⛔ Never `===` on the beat — it is a Fraction. */
function sameAddress(a: OttavaSlotTarget, b: OttavaSlotTarget): boolean {
  return a.measure === b.measure && fracCompare(a.beat, b.beat) === 0
}

/** The staff INDEX an ottava's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinLane`'s twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
