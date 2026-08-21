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
 * leaving the mark's own system. Its rule is which system the mark would look at home on, ⛔ not the
 * cursor's proximity to notes.
 *
 * ⭐ It also answers {@link markInkY} — where the mark itself was drawn — since that is the same
 * question about the same render.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { DynamicSlotTarget } from '../engine/models/dynamicOps'
import type { Dynamic, Score } from '../types/music'
import { staffOf } from '../utils/lanes'
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
  y: number
  target: DynamicSlotTarget
}

/**
 * Every slot of the mark's lane, as drawn — one candidate per ONSET, at the centre of its ink.
 *
 * ⚠️ A chord registers one entry per notehead on one onset; they share an x, so the first one
 * answers for the slot — a dynamic is centred on the COLUMN (`rendering/dynamicMarkAnchor.ts`), not
 * on a particular head of it.
 */
export function dynamicLaneHeads(engine: LaneEngine, dynamic: Dynamic): DynamicLaneHead[] {
  const score = engine.getScore()
  // ⭐⭐ The mark's STAFF, in every voice — ⛔ not what it governs (his call, 2026-08-19: *"walking
  // should work in general no matter the voice"*). Where a mark may stand is a question about
  // columns; which voices get louder is a different one, and `utils/dynamicScope.onSameStaff` says
  // why they must not be fused. The dedupe below collapses two voices striking one beat into the one
  // head they are — a drag aims at an ADDRESS, not at a notehead.
  const staff = staffIndexOf(score, dynamic.staffId)
  const heads: DynamicLaneHead[] = []
  const registry = engine.getElementRegistry()
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    if (staffOf(note) !== staff) continue
    const target = { measure: note.measure, beat: note.beat }
    if (heads.some(h => h.target.measure === target.measure && fracCompare(h.target.beat, target.beat) === 0)) continue
    heads.push({ x: el.bbox.x + el.bbox.width / 2, y: el.bbox.y + el.bbox.height / 2, target })
  }
  return heads
}

/**
 * ⭐⭐ **THE SLOT ON THE SYSTEM THE MARK NOW BELONGS TO** — the dynamic's PORT into the shared rule
 * (`./markSystemJump`, extracted 2026-08-19 when the tempo mark's drag wanted the same one). The
 * rule and its reasons live there; what is here is where a dynamic's candidates are, which side it
 * hangs on, and how its lift converts to pixels.
 */
export function systemSlotFor(
  engine: LaneEngine,
  dynamic: Dynamic,
  cursorX: number,
  /** Where the mark's ink will be after this frame — {@link markInkY} plus the frame's `dy`. */
  inkY: number,
  staffSpacePx: number,
): DynamicSlotTarget | null {
  const heads = dynamicLaneHeads(engine, dynamic)
  const address = dynamicAddress(engine.getScore(), dynamic.id)
  const anchor = address && heads.find(h =>
    h.target.measure === address.measure && fracCompare(h.target.beat, address.beat) === 0)

  return systemStopFor<DynamicSlotTarget>({
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
