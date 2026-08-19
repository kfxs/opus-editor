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
import { staffOf, voiceOf } from '../utils/lanes'
import { fracCompare } from '../utils/fraction'
import { dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'

/** What reading the lane needs off the engine — a Pick, so a test can stand up the three reads
 *  without a renderer. */
export type LaneEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** A painted staff's five lines, top to bottom — `ElementRegistry.staffBands()`' shape. */
type StaffBand = { top: number; bottom: number }

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
 * ⭐⭐ **THE SLOT ON THE SYSTEM THE MARK NOW BELONGS TO** — the one move a dragged dynamic cannot make
 * as a continuous walk (his report, 2026-08-19: *"it does not catch other system"*).
 *
 * ⭐ **Two rules, because there are two questions.** WITHIN a system, where the mark sits is
 * continuous — ink, with the anchor handed along at each notehead (`./dynamicWalk`). BETWEEN systems
 * there is nothing continuous to travel through: two systems' x's are not one ruler, so the walk
 * refuses to cross a break and always will. Coming down onto the staff below is therefore a JUMP.
 *
 * ## ⭐⭐ The limit is WHERE THIS MARK WOULD LOOK AT HOME — ⛔ not the staff's five lines
 *
 * His call, 2026-08-19, having tried it: *"crossing the stave is not a good limit… a more organic
 * limit vertically"*. Crossing the pentagram is both late (the mark has to be dragged right onto the
 * next staff before it belongs to it) and lopsided (a dynamic hangs BELOW its staff, so the staff
 * above it is much further away than the one below).
 *
 * So: measure, off the last render, the mark's **natural** distance from its own staff — its drawn
 * ink with its own lift taken back out. That same distance from any other staff is where this mark
 * *would* be drawn if it belonged to that system. The mark belongs to the nearest of those, and the
 * switch therefore falls exactly halfway between "where it sits here" and "where it would sit
 * there".
 *
 * ⭐ Nothing in it is a constant: the natural gap is measured every frame (it contains whatever the
 * ladder granted this mark — a hairpin, a trill, an expression word on the same line), and the
 * staves are the painted ones. ⭐ It mirrors itself for an `above` mark by measuring from the staff's
 * TOP line instead of its bottom, so the whole rule is one sentence in either direction.
 *
 * ⭐ It also needs no travel history, unlike a crossing test: a frame taller than a whole system is
 * judged by where it ENDED, so a fast hand cannot fly over a staff.
 *
 * ⚠️ Answers null while the mark still belongs where it is (that is the walk's business), when the
 * mark was not drawn (nothing to measure), and when the system it now belongs to carries no music in
 * the mark's lane — there would be nothing to anchor to.
 */
export function systemSlotFor(
  engine: LaneEngine,
  dynamic: Dynamic,
  cursorX: number,
  /** Where the mark's ink will be after this frame — {@link markInkY} plus the frame's `dy`. */
  inkY: number,
  staffSpacePx: number,
): DynamicSlotTarget | null {
  const bands = engine.getElementRegistry().staffBands()
  if (bands.length < 2) return null

  const heads = dynamicLaneHeads(engine, dynamic)
  if (!heads.length) return null

  const drawn = markInkY(engine, dynamic.id)
  if (drawn === null) return null

  // The mark's own staff is the one its ANCHOR stands on — ⛔ not the one its ink is nearest, which
  // is the whole point of a mark that has been carried away from home.
  const address = dynamicAddress(engine.getScore(), dynamic.id)
  const anchor = address && heads.find(h =>
    h.target.measure === address.measure && fracCompare(h.target.beat, address.beat) === 0)
  if (!anchor) return null
  const home = nearestBand(bands, anchor.y)

  // Where the ENGRAVER put this mark, and how far that is from the edge of its own staff.
  const above = (dynamic.placement ?? 'below') === 'above'
  const lift = (dynamicOffsetOverrideOf(engine.getScore(), dynamic.id)?.y ?? 0) * staffSpacePx
  const naturalGap = (drawn - lift) - edgeOf(home, above)

  const target = bands.reduce((a, b) =>
    Math.abs(inkY - (edgeOf(b, above) + naturalGap)) < Math.abs(inkY - (edgeOf(a, above) + naturalGap)) ? b : a)
  if (target === home) return null

  // …and the x picks the slot within that system, on its own axis. ⛔ Never one hypotenuse over both
  // axes: a pitch difference inside a system would then outvote a hundred pixels of x.
  let best: DynamicSlotTarget | null = null
  let bestDistance = Infinity
  for (const head of heads) {
    if (nearestBand(bands, head.y) !== target) continue
    const d = Math.abs(cursorX - head.x)
    if (d < bestDistance) { bestDistance = d; best = head.target }
  }
  return best
}

/** The staff line a mark of this placement hangs off: the TOP for one above, the BOTTOM for one
 *  below. What makes the rule read the same in both directions. */
function edgeOf(band: StaffBand, above: boolean): number {
  return above ? band.top : band.bottom
}

/** Which painted staff a y belongs to — the one whose five lines it is inside, or nearest to (a
 *  notehead on ledger lines is outside its own staff, and still that staff's). */
function nearestBand(bands: StaffBand[], y: number): StaffBand {
  return bands.reduce((a, b) => (bandDistance(b, y) < bandDistance(a, y) ? b : a))
}

/** 0 inside the band, else the gap to its nearer edge. `ElementRegistry.staffIndexAtY`'s arithmetic. */
function bandDistance(band: StaffBand, y: number): number {
  return y < band.top ? band.top - y : y > band.bottom ? y - band.bottom : 0
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

/** The staff INDEX a dynamic's `staffId` names (absent = the first staff), so a drawn element's own
 *  `staff` can be compared against it. `hairpinHandles`' twin. */
function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}
