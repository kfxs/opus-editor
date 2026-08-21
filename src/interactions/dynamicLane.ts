/**
 * ⭐ **WHERE A DYNAMIC'S LANE WAS DRAWN** — every slot the mark can sit on, and which one it sits on
 * now, read off the last render.
 *
 * The one geometry question the two doors of "move this mark through the music" both ask: the
 * keyboard's interpolating walk (`./dynamicWalk`) measures the gap to the next slot with it, and the
 * mouse drag runs through that same walk. ⛔ Two answers to "where is this slot drawn" would mean a
 * mark walked with the arrows and one dragged sitting on different x's.
 *
 * ⚠️ Candidates are the mark's OWN LANE — its voice, on its staff — the filter the model's stepping
 * op applies (`dynamicOps`), so nothing here can reach music the keyboard could not walk to. The
 * model refuses anything else anyway; this keeps the two from disagreeing about which slot is which.
 *
 * ⭐ Rests are slots like any other. A `p` at the top of a bar that begins with a rest is ordinary.
 *
 * 🚨 **It was once a cursor→note picker** (`dynamicDragTargetAt`, with a measured mark-to-music y
 * translation, a row window and a 150 px snap), because the drag re-anchored the mark outright on
 * every frame. The drag now carries INK — the anchor comes along when the ink arrives — so there is
 * no cursor to translate and no nearest-note to find: the delta is a pixel count. The same
 * translation is still live in `elements/pedalHandles` / `ottavaHandles` / `trillHandles`, whose
 * drags do still pick a target from the cursor.
 *
 * ⭐⭐ What survived of it is {@link systemSlotFor}, and only for the one move the walk cannot make:
 * leaving the mark's own STAFF — the staff below it in a grand staff, or the one on the system
 * below. Its rule is which staff the mark would look at home on, ⛔ not the cursor's proximity to
 * notes.
 *
 * ⭐ It also answers {@link markInkY} — where the mark itself was drawn — since that is the same
 * question about the same render.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { DynamicSlotTarget, DynamicStaffSlotTarget } from '../engine/models/dynamicOps'
import type { Dynamic, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
import { keyStaffId } from '../engine/models/staffContent'
import { fracCompare } from '../utils/fraction'
import { dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { systemStopFor } from './markSystemJump'
import { lastMeasureNumber, systemInkAt, type SystemInk } from './markBreakWrap'

/** What reading the lane needs off the engine — a Pick, so a test can stand up the three reads
 *  without a renderer. */
export type LaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** A slot of the mark's lane as it was DRAWN: the centre of its ink, and the address it stands for. */
export interface DynamicLaneHead {
  x: number
  /**
   * ⚠️ The middle of the STAFF this slot was drawn on — ⛔ NOT the notehead's own centre, which is
   * the only thing the reader wants it for: `markSystemJump` asks which painted staff a candidate
   * belongs to, and a head on ledger lines can sit nearer the neighbouring staff's band than its
   * own. Harmless while every candidate came from one staff; a wrong answer the moment they do not
   * (2026-08-21). Falls back to the ink's centre when that bar drew no geometry.
   */
  y: number
  target: DynamicSlotTarget
}

/** The same, on a staff that may not be the mark's — what a VERTICAL drag chooses between, where a
 *  sideways walk only ever sees one staff's. */
export interface DynamicStaffLaneHead extends DynamicLaneHead {
  staff: number
  target: DynamicStaffSlotTarget
}

/**
 * Every slot of the mark's lane, as drawn — one candidate per ONSET, at the centre of its ink.
 *
 * ⚠️ A chord registers one entry per notehead on one onset; they share an x, so the first one
 * answers for the slot — a dynamic is centred on the COLUMN (`rendering/dynamicMarkAnchor.ts`), not
 * on a particular head of it.
 */
export function dynamicLaneHeads(engine: LaneEngine, dynamic: Dynamic): DynamicLaneHead[] {
  // ⭐⭐ The mark's STAFF, in every voice — ⛔ not what it governs (his call, 2026-08-19: *"walking
  // should work in general no matter the voice"*). Where a mark may stand is a question about
  // columns; which voices get louder is a different one, and `utils/dynamicScope.onSameStaff` says
  // why they must not be fused.
  const staff = staffIndexOf(engine.getScore(), dynamic.staffId)
  return drawnHeads(engine).filter(h => h.staff === staff)
}

/**
 * ⭐⭐ **EVERY SLOT OF EVERY PAINTED STAFF** — the candidates a VERTICAL drag chooses between, his
 * report 2026-08-21: on a grand staff a dragged dynamic *"just land in the next system"*, because
 * the only places it could land were on its own staff and the staff below held none of them.
 *
 * ⛔ Nothing here widens the WALK. Sideways the mark stays in its lane ({@link dynamicLaneHeads}),
 * because a lane is what "the next slot" is counted along; the vertical is the axis on which a staff
 * is a place, and `markSystemJump` was always choosing between painted staves — it simply never had
 * a candidate on any but the mark's own.
 */
export function dynamicStaffLaneHeads(engine: LaneEngine): DynamicStaffLaneHead[] {
  return drawnHeads(engine)
}

/**
 * One head per (staff, onset) in the last render, in registry order.
 *
 * ⚠️ The dedupe is keyed on the STAFF as well as the address — two staves striking beat 0 of bar 3
 * are two places, and collapsing them would leave the lower one unreachable. It collapses what it
 * is meant to: two voices (or the heads of a chord) on one onset of one staff, which are the one
 * place they look — a drag aims at an ADDRESS, not at a notehead.
 */
function drawnHeads(engine: LaneEngine): DynamicStaffLaneHead[] {
  const score = engine.getScore()
  const heads: DynamicStaffLaneHead[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    const staff = staffOf(note)
    if (heads.some(h => h.staff === staff && h.target.measure === note.measure
      && fracCompare(h.target.beat, note.beat) === 0)) continue
    const lines = registry.getStaffGeometry(note.measure, staff)?.lineYPositions
    heads.push({
      x: el.bbox.x + el.bbox.width / 2,
      y: lines ? (lines[0] + lines[4]) / 2 : el.bbox.y + el.bbox.height / 2,
      staff,
      // ⚠️ The WRITE convention, resolved here and not in the model: the first staff is stored
      // ABSENT (`MusicEngine.staffIdForIndex`), so a landing on staff 0 spells itself the same way
      // every other writer of a `staffId` spells it.
      target: { measure: note.measure, beat: note.beat, staffId: keyStaffId(score, staff) },
    })
  }
  return heads
}

/**
 * ⭐⭐ **THE SLOT ON THE STAFF THE MARK NOW BELONGS TO** — the dynamic's PORT into the shared rule
 * (`./markSystemJump`, extracted 2026-08-19 when the tempo mark's drag wanted the same one). The
 * rule and its reasons live there; what is here is where a dynamic's candidates are, which side it
 * hangs on, and how its lift converts to pixels.
 *
 * ⭐⭐ **A STAFF, not a system** (his report, 2026-08-21) — the shared rule always chose between
 * PAINTED STAVES, so the other hand of a grand staff was already in the running and simply had no
 * candidate on it. Handing it {@link dynamicStaffLaneHeads} instead of the mark's own lane is the
 * whole of the change; the mark then lands under the left hand where it used to sail past it onto
 * the system below.
 */
export function systemSlotFor(
  engine: LaneEngine,
  dynamic: Dynamic,
  cursorX: number,
  /** Where the mark's ink will be after this frame — {@link markInkY} plus the frame's `dy`. */
  inkY: number,
  staffSpacePx: number,
): DynamicStaffSlotTarget | null {
  const heads = dynamicStaffLaneHeads(engine)
  const staff = staffIndexOf(engine.getScore(), dynamic.staffId)
  const address = dynamicAddress(engine.getScore(), dynamic.id)
  // ⚠️ The mark's OWN head, so on its own staff: `markSystemJump` measures the mark's natural
  // distance from the staff it hangs off, and a same-address head on the other staff would name the
  // wrong one.
  const anchor = address && heads.find(h => h.staff === staff
    && h.target.measure === address.measure && fracCompare(h.target.beat, address.beat) === 0)

  return systemStopFor<DynamicStaffSlotTarget>({
    bands: () => engine.getElementRegistry().staffBands(),
    candidates: () => heads.map(h => ({ x: h.x, y: h.y, stop: h.target })),
    anchor: () => anchor ?? null,
    inkY: () => markInkY(engine, dynamic.id),
    // ⚠️ A dynamic's stored `y` is already SCREEN-signed (+down), unlike the tempo mark's.
    liftPx: () => (dynamicOffsetOverrideOf(engine.getScore(), dynamic.id)?.y ?? 0) * staffSpacePx,
    above: () => (dynamic.placement ?? 'below') === 'above',
  }, cursorX, inkY)
}

/** The vertical centre of the mark's own ink in the last render, or null if it drew none (culled,
 *  or no render yet). What a drag measures its crossing with. */
export function markInkY(engine: LaneEngine, dynamicId: string): number | null {
  const mark = engine.getElementRegistry().getByType('dynamic').find(e => e.id === dynamicId)
  return mark ? mark.bbox.y + mark.bbox.height / 2 : null
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

/**
 * ⭐ **THE DRAWN EXTENT OF THE SYSTEM an address was drawn on** — the dynamic's PORT into the shared
 * break wrap (`./markBreakWrap`), which owns the measuring and the naming ({@link systemInkAt}).
 * What is dynamic-specific is only WHICH STAFF to ask about: the mark's own.
 *
 * @returns null when that bar was not drawn.
 */
export function dynamicSystemInkLimit(
  engine: LaneEngine,
  dynamic: Dynamic,
  at: { measure: number },
): SystemInk | null {
  const staff = staffIndexOf(engine.getScore(), dynamic.staffId)
  return systemInkAt(engine.getElementRegistry(), staff, at.measure, lastMeasureNumber(engine.getScore()))
}

/** The staff INDEX a dynamic's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinHandles`' twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
