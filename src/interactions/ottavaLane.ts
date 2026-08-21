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
import type { OttavaSlotTarget, OttavaStaffSlotTarget } from '../engine/models/ottavaOps'
import { ottavaSpan } from '../engine/models/ottavaOps'
import type { Ottava, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
import { keyStaffId } from '../engine/models/staffContent'
import { fracCompare } from '../utils/fraction'
import { ottavaOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { systemStopFor } from './markSystemJump'
import { lastMeasureNumber, systemInkAt, type SystemInk } from './markBreakWrap'

/** What reading the lane needs off the engine — a Pick, so a spec can stand up the reads without a
 *  renderer. `hairpinLane.HairpinLaneEngine`'s twin. */
export type OttavaLaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** One onset of the lane as it was DRAWN: the left edge the numeral would stand at, the right edge
 *  the hook would close around, a y to tell systems apart, and the address. */
export interface OttavaLaneOnset {
  left: number
  right: number
  /**
   * ⚠️ The middle of the STAFF this onset was drawn on — ⛔ NOT the notehead's own centre, which is
   * the only thing the reader wants it for: `markSystemJump` asks which painted staff a candidate
   * belongs to, and a head on ledger lines can sit nearer the neighbouring staff's band than its
   * own. `dynamicLane`'s rule, the fifth family on. Falls back to the ink's centre when that bar
   * drew no geometry.
   */
  y: number
  target: OttavaSlotTarget
}

/** The same, on a staff that may not be the bracket's — what a VERTICAL drag chooses between, where
 *  a sideways walk only ever sees one staff's. */
export interface OttavaStaffLaneOnset extends OttavaLaneOnset {
  staff: number
  target: OttavaStaffSlotTarget
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
  return drawnOnsets(engine).filter(o => o.staff === staff)
}

/**
 * ⭐⭐ **EVERY ONSET OF EVERY PAINTED STAFF** — the candidates a VERTICAL drag chooses between, his
 * ask 2026-08-21 and the LAST of the five families to get it.
 *
 * ⛔ Nothing here widens the WALK. Sideways the bracket stays in its lane
 * ({@link ottavaLaneOnsets}), because a lane is what "the next onset" is counted along; the vertical
 * is the axis on which a staff is a place, and `markSystemJump` was always choosing between painted
 * staves — it simply never had a candidate on any but the bracket's own.
 */
export function ottavaStaffLaneOnsets(engine: OttavaLaneEngine): OttavaStaffLaneOnset[] {
  return drawnOnsets(engine)
}

/**
 * One onset per (staff, address) in the last render.
 *
 * ⚠️ The merge is keyed on the STAFF as well as the address — two staves striking beat 0 of bar 3 are
 * two places, and collapsing them would leave the lower one unreachable. It merges what it is meant
 * to: a chord's heads (and a displaced second) at one onset of one staff, keeping the LEFTMOST and
 * the RIGHTMOST edge, which is the pair the bracket is drawn against.
 */
function drawnOnsets(engine: OttavaLaneEngine): OttavaStaffLaneOnset[] {
  const score = engine.getScore()
  const onsets: OttavaStaffLaneOnset[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    // ⛔ No voice filter — an octave line governs the whole staff.
    const staff = staffOf(note)
    const seen = onsets.find(o => o.staff === staff
      && sameAddress(o.target, { measure: note.measure, beat: note.beat }))
    if (seen) {
      seen.left = Math.min(seen.left, el.bbox.x)
      seen.right = Math.max(seen.right, el.bbox.x + el.bbox.width)
      continue
    }
    const lines = registry.getStaffGeometry?.(note.measure, staff)?.lineYPositions
    onsets.push({
      left: el.bbox.x,
      right: el.bbox.x + el.bbox.width,
      y: lines ? (lines[0] + lines[lines.length - 1]) / 2 : el.bbox.y + el.bbox.height / 2,
      staff,
      // ⚠️ The WRITE convention, resolved here and not in the model: the first staff is stored
      // ABSENT (`MusicEngine.staffIdForIndex`).
      target: { measure: note.measure, beat: note.beat, staffId: keyStaffId(score, staff) },
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
 * ⭐ **THE DRAWN EXTENT OF THE SYSTEM an address was drawn on** — the bracket's PORT into the shared
 * break wrap (`./markBreakWrap`), which owns the measuring and the naming ({@link systemInkAt}).
 * What is ottava-specific is only WHICH STAFF to ask about.
 *
 * @returns null when that bar was not drawn.
 */
export function ottavaSystemInkLimit(
  engine: OttavaLaneEngine,
  ottava: Ottava,
  at: { measure: number },
): SystemInk | null {
  const staff = staffIndexOf(engine.getScore(), ottava.staffId)
  return systemInkAt(engine.getElementRegistry(), staff, at.measure, lastMeasureNumber(engine.getScore()))
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

/**
 * ⭐⭐ **THE SLOT ON THE SYSTEM THE BRACKET NOW BELONGS TO** — the ottava's PORT into the shared rule
 * (`./markSystemJump`, the dynamic's, the tempo mark's and the wedge's). His ask, 2026-08-21: *"in
 * this case we also have to take into account the y, that means that we can jump system
 * vertically"*.
 *
 * The rule and its reasons live in that module — the switch falls halfway between where the bracket
 * sits and where it would sit on the other staff, measured from its NATURAL distance with its own
 * lift taken back out. What is here is only what is ottava-specific:
 *
 * ⭐⭐ **The candidates are EVERY PAINTED STAFF's, not the bracket's own lane** (his ask, 2026-08-21,
 * the last of the five). The shared rule always chose between painted staves, so the other hand of a
 * grand staff was in the running and simply had no candidate on it — which is why the bracket used to
 * sail past the left hand onto the next system. ⚠️ A landing therefore NAMES a staff, and
 * `ottavaOps.setOttavaAtStaffSlot` writes it — AUDIBLY: an octave line transposes the staff it is
 * filed under, so moving it moves which notes sound an octave away.
 *
 * ⚠️⚠️ **THE LIFT IS STORED OUTWARD, so it is converted here** — `markSystemJump` wants it SCREEN-signed
 * (+down) to take it back out, and an 8va's `outward` counts UP. ⛔ The tempo mark is the only other
 * family that has to do this, and for the same reason.
 *
 * ⭐ **The side comes from the SHIFT, never from the pixels** — an 8va hangs above its staff and an
 * 8vb below, and that is what tells the rule which edge to measure from.
 */
export function ottavaSystemSlotFor(
  engine: OttavaLaneEngine,
  ottava: Ottava,
  cursorX: number,
  /** Where the bracket's ink will be after this frame — its drawn y plus the frame's `dy`. */
  inkY: number,
  staffSpacePx: number,
): OttavaStaffSlotTarget | null {
  const lane = ottavaStaffLaneOnsets(engine)
  const staff = staffIndexOf(engine.getScore(), ottava.staffId)
  const here = ottavaStartAddress(engine.getScore(), ottava.id)
  // ⚠️ The bracket's OWN onset, so on its own staff: `markSystemJump` measures its natural distance
  // from the staff it hangs off, and a same-address onset on the other staff would name the wrong one.
  const anchor = here && lane.find(o => o.staff === staff && sameAddress(o.target, here))
  const above = ottava.shift > 0

  return systemStopFor<OttavaStaffSlotTarget>({
    bands: () => engine.getElementRegistry().staffBands(),
    candidates: () => lane.map(o => ({ x: o.left, y: o.y, stop: o.target })),
    anchor: () => (anchor ? { x: anchor.left, y: anchor.y } : null),
    inkY: () => ottavaInkY(engine, ottava.id),
    // ⚠️ OUTWARD → SCREEN: further out is UP for an 8va, DOWN for an 8vb.
    liftPx: () => {
      const outward = ottavaOffsetOverrideOf(engine.getScore(), ottava.id)?.outward ?? 0
      return (above ? -outward : outward) * staffSpacePx
    },
    above: () => above,
  }, cursorX, inkY)
}

/** The vertical centre of the bracket's own ink in the last render — its FIRST fragment, which is the
 *  one its beginning (and so its anchor) lives on. Null when it drew none. */
export function ottavaInkY(engine: OttavaLaneEngine, ottavaId: string): number | null {
  const piece = engine.getElementRegistry().getByType('ottava').find(e => e.id === ottavaId)
  return piece ? piece.bbox.y + piece.bbox.height / 2 : null
}
