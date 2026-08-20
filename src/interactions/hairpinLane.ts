/**
 * ⭐⭐ **WHERE A HAIRPIN'S LANE WAS DRAWN** — the onsets one of its tips may sit on, as pixels off the
 * LAST RENDER, and the address the wedge's start holds right now.
 *
 * Extracted from `elements/hairpinHandles.hairpinDragTargetAt` on 2026-08-20, when the left square
 * asked for the interpolating walk (`./hairpinStartWalk`): the mouse had the geometry and the
 * keyboard would otherwise have grown a second copy of it. ⛔ Two lists of "where a slot is drawn"
 * are two answers that can disagree — `./dynamicLane` was split out of the dynamic's drag for
 * exactly this reason, and this is its twin one lane over.
 *
 * ⭐⭐ **THE BOUNDARIES, NOT THE NOTEHEADS.** Both of a wedge's tips are drawn at a note's LEFT EDGE
 * (`HairpinRenderer.spanX`: `startX` at the first covered note, `endX` at the first uncovered one),
 * so the positions a tip can occupy are the lane's onsets — ⛔ not the centres a dynamic walks
 * between, which put a jump half a notehead early (his report, 2026-08-17).
 *
 * ⚠️ **The lane is the wedge's STAFF, in every voice** — ⛔ not the voices it GOVERNS: a tip is drawn
 * at a COLUMN and a column belongs to the staff (`utils/dynamicScope.onSameStaff`, his call
 * 2026-08-19). That is the same filter the model's stepping ops apply, so no route can reach a slot
 * another route cannot.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { HairpinSlotTarget } from '../engine/models/hairpinOps'
import { hairpinSpan } from '../engine/models/hairpinOps'
import type { Hairpin, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
import { fracCompare } from '../utils/fraction'

/** What reading the lane needs off the engine — a Pick, so a test can stand up the reads without a
 *  renderer. `dynamicLane.LaneEngine`'s twin. */
export type HairpinLaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** One onset of the lane as it was DRAWN: the left edge a tip would be drawn against, that ink's
 *  right edge (what "cover this slot" reaches to), a y to tell systems apart, and the address. */
export interface HairpinLaneBoundary {
  x: number
  right: number
  y: number
  target: HairpinSlotTarget
}

/**
 * Every onset of `hairpin`'s lane the last render drew, once each, at its LEFT EDGE.
 *
 * A CHORD registers one entry per notehead on one onset, and two voices striking a beat are one
 * place a tip can sit — so both merge into a single boundary keeping the LEFTMOST edge, which is the
 * one the wedge is drawn against.
 */
export function hairpinLaneBoundaries(
  engine: HairpinLaneEngine,
  hairpin: Hairpin,
): HairpinLaneBoundary[] {
  const staff = staffIndexOf(engine.getScore(), hairpin.staffId)
  const boundaries: HairpinLaneBoundary[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    if (staffOf(note) !== staff) continue
    const target = { measure: note.measure, beat: note.beat }
    const seen = boundaries.find(b =>
      b.target.measure === target.measure && fracCompare(b.target.beat, target.beat) === 0)
    if (seen) {
      seen.x = Math.min(seen.x, el.bbox.x)
      seen.right = Math.max(seen.right, el.bbox.x + el.bbox.width)
      continue
    }
    boundaries.push({
      x: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: el.bbox.y + el.bbox.height / 2,
      target,
    })
  }
  return boundaries
}

/** Where one slot of the lane was drawn, or null when the last render drew nothing there. */
export function hairpinBoundaryX(
  engine: HairpinLaneEngine,
  hairpin: Hairpin,
  target: HairpinSlotTarget,
): number | null {
  const found = hairpinLaneBoundaries(engine, hairpin).find(b =>
    b.target.measure === target.measure && fracCompare(b.target.beat, target.beat) === 0)
  return found ? found.x : null
}

/**
 * ⭐⭐ **WHERE A TIP STANDING AT `at` IS DRAWN** — the far side of every gap the right square's walk
 * measures, for today's end address and for a candidate one alike.
 *
 * ⭐ The tip stands at the first UNCOVERED note's left edge, so ordinarily this is that onset's own
 * boundary — read from the same list as the stops, so the two ends of a gap cancel whatever the
 * boundary list is systematically off by.
 *
 * ⚠️ **A wedge ending on a BARLINE has no onset to read**: its end address is that bar's capacity
 * ({@link hairpinSpan}) and `HairpinRenderer.spanX` falls back to the bar's own `noteEndX`, so this
 * reads the same number off the staff's geometry. 🚨 That case is not a corner — it is where the
 * music of a LINE runs out, so it is exactly the address a tip walking off the end of a system
 * lands on (his report, 2026-08-20: *"it is never reaching the next system"*).
 *
 * Null when that bar was not drawn — the no-guessing rule.
 */
export function hairpinTipX(
  engine: HairpinLaneEngine,
  hairpin: Hairpin,
  at: HairpinSlotTarget,
): number | null {
  const onset = hairpinLaneBoundaries(engine, hairpin).find(b => compareAddress(b.target, at) === 0)
  if (onset) return onset.x
  const staff = staffIndexOf(engine.getScore(), hairpin.staffId)
  return engine.getElementRegistry().getStaffGeometry(at.measure, staff)?.noteEndX ?? null
}

/**
 * ⭐⭐ **HOW FAR THE INK MAY GO ON THIS SYSTEM** — the drawn music's left and right edges on the
 * SYSTEM the given address was drawn on, in pixels.
 *
 * Two callers, both from his 2026-08-20 reports: the folded gap across a break is measured to this
 * line's end and from that line's start (`interactions/hairpinWalk`), and where there is nothing to
 * extend onto at all, it is the LIMIT that stops the arrow pushing the drawing into the margin with
 * the music standing still.
 *
 * ⭐ The row is identified by the staff's own TOP LINE y — returned as `top`: every bar of one system
 * shares it, and bars on other systems do not. ⛔ No band arithmetic and no constant — the "read the last render" rule
 * the rest of this module follows.
 *
 * @returns null when that bar was not drawn.
 */
export function hairpinSystemInkLimit(
  engine: HairpinLaneEngine,
  hairpin: Hairpin,
  at: HairpinSlotTarget,
): { min: number; max: number; top: number } | null {
  const registry = engine.getElementRegistry()
  const staff = staffIndexOf(engine.getScore(), hairpin.staffId)
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
  // ⭐ `top` NAMES the system — every bar of one line shares its staff's top line, and no two lines
  // do. It is what lets a caller ask "are these two addresses on the same ruler?" without comparing
  // x's, which is a question x's cannot answer (a later line's x may be larger, smaller or equal).
  return { min, max, top: home.lineYPositions[0] }
}

/**
 * The x one of the wedge's tips is DRAWN at right now — ink, so it carries that end's nudge. The
 * fragments come out in drawing order, so the first holds the beginning and the last holds the end
 * (`elements/hairpinHandles`, which reads the same four points to place the squares).
 */
export function hairpinInkX(
  engine: HairpinLaneEngine,
  hairpinId: string,
  which: 'start' | 'end',
): number | null {
  const pieces = engine.getElementRegistry().getByType('hairpin')
    .filter(e => e.id === hairpinId && (e.points?.length ?? 0) >= 4)
  const points = (which === 'start' ? pieces[0] : pieces[pieces.length - 1])?.points
  return points ? points[which === 'start' ? 0 : 1].x : null
}

/** Where the wedge ENDS, as an address — ⚠️ its beat MAY EQUAL its bar's capacity, a wedge finishing
 *  on the barline ({@link hairpinSpan}). Null for an id no longer in the score. */
export function hairpinEndAddress(score: Score, id: string): HairpinSlotTarget | null {
  const span = hairpinSpan(score, id)
  return span ? { measure: span.endMeasure, beat: span.endBeat } : null
}

/** The score's reading order over two addresses — ⛔ not a timeline: nothing here needs to know how
 *  long a bar is, only which of two points comes first. (`dynamicOps` makes the same argument.) */
function compareAddress(a: HairpinSlotTarget, b: HairpinSlotTarget): number {
  return a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat)
}

/** The address the wedge BEGINS at — the measure is half of it, so it comes from the span rather
 *  than off the `Hairpin` object (which carries only its beat). Null for an id no longer in the
 *  score. */
export function hairpinStartAddress(score: Score, id: string): HairpinSlotTarget | null {
  const span = hairpinSpan(score, id)
  return span ? { measure: span.startMeasure, beat: span.startBeat } : null
}

/** The staff INDEX a hairpin's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `dynamicLane`'s twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
