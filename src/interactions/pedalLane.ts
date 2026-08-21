/**
 * ⭐⭐ **WHERE A PEDAL'S TWO SIGNS WERE DRAWN** — the addresses its press and its lift may stand on,
 * as pixels off the LAST RENDER, plus the addresses it holds right now.
 *
 * `./ottavaLane`'s twin, one lane over and written on the same day the bracket's was, for its stated
 * reason: the mouse already had this geometry inside `elements/pedalHandles.pedalDragTargetAt` and
 * the keyboard would otherwise have grown a second copy of it. ⛔ Two lists of *"where is a pedal
 * drawn"* are two answers that can disagree.
 *
 * ⚠️ **The lane is the pedal's STAFF, every voice** — `pedalOps.resizePedalBySlot`'s rule, and the
 * reason a pedal has no `voice` field at all: one damper, one foot. That is the same filter the
 * model's stepping ops apply, so no route can reach a position another route cannot.
 *
 * ## ⭐⭐ What is genuinely this family's own: THE LIFT IS A MOMENT, SO IT HAS NO NOTEHEAD
 *
 * An octave bracket's hook closes around a notehead and a trill's line ends at a duration, but a
 * pedal comes up at a POINT IN TIME (docs/pedal-plan.md §5.2) — and the two things that point can be
 * are exactly what {@link pedalLiftX} answers: the left edge of the first column at or after it, or,
 * when nothing in that bar is left, the bar's own `noteEndX` less {@link PEDAL_BARLINE_AIR}. Both are
 * `PedalRenderer.spanX`'s, mirrored here rather than shared because that function reads a live
 * `RenderPass` and this one reads the registry. ⚠️ **They must not drift**: the walk prices its gaps
 * where the ink LANDS (`./markBreakWrap`'s third rejected cut), so a lift priced at a note the
 * renderer does not draw it at would move the `✻` by the wrong distance at every crossing.
 *
 * ⭐ **Both ends read LEFT edges**, ⛔ never the bracket's left-then-right pair: `PedalRenderer` puts
 * the press and the lift on the same `noteLeftX`, and the `✻`'s right-alignment happens *at* that x
 * rather than moving it (`elements/pedalHandles`, which records that copying a neighbour's edge rule
 * blind is how the wedge's *"it jumps before x mouse reach the target"* was reproduced).
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import type { PedalLiftTarget, PedalSlotTarget, PedalStaffSlotTarget } from '../engine/models/pedalOps'
import { pedalSpan } from '../engine/models/pedalOps'
import { PEDAL_BARLINE_AIR } from '../engine/rendering/pedalStyle'
import { onsetXOf } from '../engine/layout/measureRestOnset'
import type { Pedal, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
import { keyStaffId } from '../engine/models/staffContent'
import { fracCompare } from '../utils/fraction'
import { lastMeasureNumber, systemInkAt, type SystemInk } from './markBreakWrap'
import { systemStopFor } from './markSystemJump'
import { pedalOffsetOverrideOf } from '../engine/models/engravingOverrides'

/** What reading the lane needs off the engine — a Pick, so a spec can stand up the reads without a
 *  renderer. `ottavaLane.OttavaLaneEngine`'s twin. */
export type PedalLaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** One onset of the lane as it was DRAWN: the column's left edge (which is where either sign
 *  stands), a y to tell systems apart, and the address. */
export interface PedalLaneOnset {
  left: number
  /**
   * ⚠️ The middle of the STAFF this onset was drawn on — ⛔ NOT the notehead's own centre, which is
   * the only thing the reader wants it for: `markSystemJump` asks which painted staff a candidate
   * belongs to, and a head on ledger lines can sit nearer the neighbouring staff's band than its
   * own. `dynamicLane`'s rule, one family on. Falls back to the ink's centre when that bar drew no
   * geometry.
   */
  y: number
  target: PedalSlotTarget
}

/** The same, on a staff that may not be the pedal's — what a VERTICAL drag chooses between, where a
 *  sideways walk only ever sees one staff's. */
export interface PedalStaffLaneOnset extends PedalLaneOnset {
  staff: number
  target: PedalStaffSlotTarget
}

/**
 * Every onset of `pedal`'s lane the last render drew, once each, in drawing order along the staff.
 *
 * ⚠️ A CHORD registers one entry per notehead at one onset, and a second interval displaces one of
 * them sideways — so entries sharing an address merge into a single onset keeping the LEFTMOST edge,
 * which is the edge the sign is drawn against.
 */
export function pedalLaneOnsets(engine: PedalLaneEngine, pedal: Pedal): PedalLaneOnset[] {
  const staff = staffIndexOf(engine.getScore(), pedal.staffId)
  return drawnOnsets(engine).filter(o => o.staff === staff)
}

/**
 * ⭐⭐ **EVERY ONSET OF EVERY PAINTED STAFF** — the candidates a VERTICAL drag chooses between, his
 * ask 2026-08-21, the fourth family in three days to want it.
 *
 * ⛔ Nothing here widens the WALK. Sideways the pedal stays in its lane ({@link pedalLaneOnsets}),
 * because a lane is what "the next onset" is counted along; the vertical is the axis on which a
 * staff is a place, and `markSystemJump` was always choosing between painted staves — it simply
 * never had a candidate on any but the pedal's own.
 */
export function pedalStaffLaneOnsets(engine: PedalLaneEngine): PedalStaffLaneOnset[] {
  return drawnOnsets(engine)
}

/**
 * One onset per (staff, address) in the last render.
 *
 * ⚠️ The merge is keyed on the STAFF as well as the address — two staves striking beat 0 of bar 3 are
 * two places, and collapsing them would leave the lower one unreachable. It merges what it is meant
 * to: a chord's heads (and a displaced second) at one onset of one staff, keeping the LEFTMOST edge,
 * which is the edge a sign is drawn against.
 */
function drawnOnsets(engine: PedalLaneEngine): PedalStaffLaneOnset[] {
  const score = engine.getScore()
  const onsets: PedalStaffLaneOnset[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    // ⛔ No voice filter — one damper serves the staff.
    const staff = staffOf(note)
    const geometry = registry.getStaffGeometry?.(note.measure, staff)
    // ⭐⭐ A MEASURE REST IS DRAWN CENTRED, so its glyph is not where its time is
    // (`engine/layout/measureRestOnset`, and his *"the pedal … shrinks"* that found it). ⚠️ The rule
    // is asked HERE as well as in `PedalRenderer.spanX` because the two must agree: the walk prices
    // its gaps where the ink lands, and a lane that answered the glyph while the drawing answered the
    // bar would make every crossing jump.
    const left = onsetXOf(el.bbox.x, note.isMeasureRest, geometry?.noteStartX)
    const seen = onsets.find(o => o.staff === staff && sameAddress(o.target, { measure: note.measure, beat: note.beat }))
    if (seen) {
      seen.left = Math.min(seen.left, left)
      continue
    }
    const lines = geometry?.lineYPositions
    onsets.push({
      left,
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
 * ⭐ **WHERE THE `Ped.` STANDS when the press is at `at`** — the far side of every gap the START's
 * walk measures, for today's address and for a candidate one alike, read from the SAME list so the
 * two ends of a gap cancel whatever that list is systematically off by.
 *
 * Null when the last render drew nothing there — the no-guessing rule (`./markWalk`).
 */
export function pedalPressX(
  engine: PedalLaneEngine,
  pedal: Pedal,
  at: PedalSlotTarget,
): number | null {
  const onset = pedalLaneOnsets(engine, pedal).find(o => sameAddress(o.target, at))
  return onset ? onset.left : null
}

/**
 * ⭐⭐ **WHERE THE `✻` STANDS when the foot comes up at `lift`** — `PedalRenderer.spanX`'s rule,
 * mirrored off the registry (see this module's header for why it is mirrored and what that costs):
 *
 *  1. the LEFT edge of the first column of the lane in that bar at or after the lift's beat — a lift
 *     normally lands exactly on the next onset, which is the ordinary case;
 *  2. …or, when nothing in that bar begins at or after it, the bar's `noteEndX` less
 *     {@link PEDAL_BARLINE_AIR}. ⭐ That is Gould's rule 3 (*the release lands at or before the
 *     barline*) and it is where a bar-long pedal's release actually is, so the walk MUST price it
 *     there: the last press before a system break is spent on this stop.
 *
 * ⚠️ Case 2 is reached by ordinary means rather than by an exception — a lift beat with no column at
 * or after it is NORMAL (a whole note in this staff while the other voice carries the motion).
 *
 * Null when that bar was not drawn at all.
 */
export function pedalLiftX(
  engine: PedalLaneEngine,
  pedal: Pedal,
  lift: PedalLiftTarget,
): number | null {
  const inBar = pedalLaneOnsets(engine, pedal)
    .filter(o => o.target.measure === lift.measure && fracCompare(o.target.beat, lift.beat) >= 0)
    .sort((a, b) => fracCompare(a.target.beat, b.target.beat))
  if (inBar.length) return inBar[0].left

  const registry = engine.getElementRegistry()
  const staff = staffIndexOf(engine.getScore(), pedal.staffId)
  const geometry = registry.getStaffGeometry(lift.measure, staff)
  if (!geometry) return null
  return geometry.noteEndX - PEDAL_BARLINE_AIR * geometry.lineSpacing
}

/** The address the pedal goes DOWN at — the measure is half of it, so it comes from the span rather
 *  than off the `Pedal` object (which carries only its beat). Null for an id no longer in the score.
 *  ⚠️ The LIFT's address is `pedalOps.pedalLiftSlot`, and it is a moment rather than a slot. */
export function pedalPressAddress(score: Score, id: string): PedalSlotTarget | null {
  const span = pedalSpan(score, id)
  return span ? { measure: span.startMeasure, beat: span.startBeat } : null
}

/**
 * The pixels per staff-space at the DRAWN pedal — the divisor every pixel↔staff-space conversion
 * about it uses. ⛔ Never a constant: it may be on a SMALL staff, and a guessed size writes a re-base
 * of the wrong size, quietly (`ottavaLane.ottavaStaffSpacePx`'s rule).
 *
 * Null when the last render drew no sign of it.
 */
export function pedalStaffSpacePx(registry: ElementRegistry, pedalId: string): number | null {
  const drawn = registry.getByType('pedal').find(e => e.id === pedalId)
  if (!drawn || drawn.measure === undefined) return null
  return registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0)?.lineSpacing ?? null
}

/**
 * ⭐ **THE DRAWN EXTENT OF THE SYSTEM an address was drawn on** — the pedal's PORT into the shared
 * break wrap (`./markBreakWrap`), which owns the measuring and the naming ({@link systemInkAt}).
 * What is pedal-specific is only WHICH STAFF to ask about.
 *
 * @returns null when that bar was not drawn.
 */
export function pedalSystemInkLimit(
  engine: PedalLaneEngine,
  pedal: Pedal,
  at: { measure: number },
): SystemInk | null {
  const staff = staffIndexOf(engine.getScore(), pedal.staffId)
  return systemInkAt(engine.getElementRegistry(), staff, at.measure, lastMeasureNumber(engine.getScore()))
}

/** Two lane addresses naming the same onset. ⛔ Never `===` on the beat — it is a Fraction. */
function sameAddress(a: PedalSlotTarget, b: PedalSlotTarget): boolean {
  return a.measure === b.measure && fracCompare(a.beat, b.beat) === 0
}

/** The staff INDEX a pedal's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `ottavaLane`'s twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}

/**
 * ⭐⭐ **WHICH SYSTEM A DRAGGED PEDAL NOW BELONGS TO** — `./markSystemJump`'s rule, ported
 * (`ottavaLane.ottavaSystemSlotFor`'s twin, and the fifth family to use it).
 *
 * ⭐ The switch falls halfway between where the pedal sits and where it WOULD sit on the next staff,
 * measured with its own lift taken back out — ⛔ never at the pentagram, which is late and lopsided
 * (his call, 2026-08-19).
 *
 * ⭐ **A pedal is ALWAYS below its staff** (`PedalRenderer` §3), so `above` is a constant here where
 * the bracket has to ask its `shift` — and `liftPx` needs no conversion, the stored `y` being
 * screen-signed already.
 *
 * ⭐⭐ **The candidates are EVERY PAINTED STAFF's** (his ask, 2026-08-21) — the shared rule always
 * chose between painted staves and the other foot of a grand staff was in the running with no
 * candidate on it, which is why the pedal used to sail past it onto the next system. ⭐ A landing
 * therefore NAMES a staff, and `pedalOps.setPedalAtStaffSlot` writes it — which on this family is
 * more than placement: a pedal governs the staff it is filed under, so moving it moves what it damps.
 */
export function pedalSystemSlotFor(
  engine: PedalLaneEngine,
  pedal: Pedal,
  cursorX: number,
  /** Where the pedal's ink will be after this frame — its drawn y plus the frame's `dy`. */
  inkY: number,
  staffSpacePx: number,
): PedalStaffSlotTarget | null {
  const lane = pedalStaffLaneOnsets(engine)
  const staff = staffIndexOf(engine.getScore(), pedal.staffId)
  const here = pedalPressAddress(engine.getScore(), pedal.id)
  // ⚠️ The pedal's OWN onset, so on its own staff: `markSystemJump` measures its natural distance
  // from the staff it hangs off, and a same-address onset on the other staff would name the wrong one.
  const anchor = here && lane.find(o => o.staff === staff && sameAddress(o.target, here))

  return systemStopFor<PedalStaffSlotTarget>({
    bands: () => engine.getElementRegistry().staffBands(),
    candidates: () => lane.map(o => ({ x: o.left, y: o.y, stop: o.target })),
    anchor: () => (anchor ? { x: anchor.left, y: anchor.y } : null),
    inkY: () => pedalInkY(engine, pedal.id),
    liftPx: () => (pedalOffsetOverrideOf(engine.getScore(), pedal.id)?.y ?? 0) * staffSpacePx,
    // ⛔ Never asked: one side, permanently.
    above: () => false,
  }, cursorX, inkY)
}

/** The vertical centre of the pedal's own ink in the last render — its FIRST sign, which is the one
 *  its press (and so its anchor) lives on. Null when it drew none. */
export function pedalInkY(engine: PedalLaneEngine, pedalId: string): number | null {
  const piece = engine.getElementRegistry().getByType('pedal').find(e => e.id === pedalId)
  return piece ? piece.bbox.y + piece.bbox.height / 2 : null
}
