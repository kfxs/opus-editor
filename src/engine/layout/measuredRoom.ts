/**
 * ROOM, MEASURED OFF THE LAST RENDER — how far a column may still be pulled left, how far a fanned
 * member may close on the one behind it, and how many pixels of width a drawn bar can give back.
 * Extracted from {@link MusicEngine} (docs/refactor-plan-2026-07-27.md Phase 6b).
 *
 * All three ask the SAME kind of question and answer it the same way: not by predicting what the
 * formatter would do, but by reading what it DID out of the {@link ElementRegistry}, which registers
 * every drawn element post-draw. The gap between two columns depends on glyph widths, accidentals,
 * the line's stretch and the space already authored there — arithmetic cannot redo it.
 *
 * ⚠️ **The picture must be CURRENT, and enforcing that is the caller's job.** These functions read a
 * drawing; whether that drawing still matches the model is something only `MusicEngine` knows
 * (`modelDirty`). Measure a fresh value against an old picture and the floor slides down by one step
 * per press — the clamp then never bites and the column walks straight through its neighbour, which
 * is exactly what it exists to prevent. Every caller in `MusicEngine` guards on `modelDirty` first.
 *
 * ⚠️ **`null` means "I don't know", and the caller must decline rather than substitute a guess** — a
 * made-up floor silently becomes the rule.
 *
 * This is layout, not the model: it lives OUTSIDE the core fence (`engine/models/**`, `utils/**`),
 * because a measurement of a drawing is a derived view of the music and never the music itself
 * (docs/DESIGN-PRINCIPLES.md principle 3).
 */
import type { Fraction } from '@/types/music'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import { fracToNumber } from '@/utils/fraction'
import { staffOf } from '@/utils/lanes'
import { VEXFLOW_DEFAULT_STAFF_SPACE_PX } from '@/engine/models/engravingOverrides'
import { FAN_MIN_HEAD_GAP_RATIO } from '@/engine/rendering/FannedBeam'
import { LAYOUT_CONFIG } from '@/engine/rendering/layoutConfig'

/**
 * How much further LEFT this column may still be pulled before it closes on its left neighbour,
 * in staff-spaces (≥ 0) — the floor `setNoteSpacing` clamps against, and the reason that clamp
 * lives at the write site rather than at draw time.
 *
 * **Measured off the last render, not predicted.** The gap between two columns is the formatter's
 * answer, not arithmetic we can redo: it depends on glyph widths, accidentals, the line's stretch
 * and the space already authored here. So this reads the drawn positions back out of the
 * `ElementRegistry` — which registers post-draw — and asks what is actually there.
 *
 * The gap is the **minimum across staves**, because the column is system-wide: pulling it left
 * far enough to collide on any one staff is too far for all of them. Each staff is asked for its
 * own first column at or after the anchor beat — the same "tick, not slot" rule the renderer
 * uses, so a staff whose rhythm has no event exactly there still gets a vote.
 *
 * ⚠️ **A STALE render cannot answer either, and that is not a technicality.** The gap on screen
 * already includes whatever space is stored here, so the room and the stored value have to come
 * from the same moment — see the file header: the caller (`MusicEngine.noteSpacingRoom`) refuses on
 * a dirty model before it ever gets here. (Model-dirty only, deliberately — `isRenderStale` also
 * trips on scroll and zoom, and neither moves a note relative to its neighbour.)
 *
 * @returns null when the last render cannot answer (nothing drawn in that bar yet, no column at
 * or after the beat on any staff, or an edit not yet drawn). Null is "I don't know", and the
 * caller must decline rather than substitute a guess — a made-up floor silently becomes the rule.
 */
export function measuredShrinkRoom(registry: ElementRegistry, measureNumber: number, beat: Fraction): number | null {
  const target = fracToNumber(beat)
  const EPSILON = 1e-9

  const byStaff = new Map<number, { beat: number; x: number }[]>()
  for (const el of registry.getByMeasure(measureNumber)) {
    if ((el.type !== 'note' && el.type !== 'rest') || el.beat === undefined) continue
    const staff = staffOf(el)
    const list = byStaff.get(staff) ?? []
    const x = el.headX ?? el.bbox.x
    // Voices and chord tones share a column: keep its LEFTMOST ink, which is the column's edge.
    const seen = list.find(c => Math.abs(c.beat - el.beat!) < EPSILON)
    if (seen) seen.x = Math.min(seen.x, x)
    else list.push({ beat: el.beat, x })
    byStaff.set(staff, list)
  }

  let room: number | null = null
  for (const [staff, columns] of byStaff) {
    columns.sort((a, b) => a.beat - b.beat)
    const at = columns.findIndex(c => c.beat >= target - EPSILON)
    if (at < 0) continue // nothing at or after the anchor on this staff — it has no say
    const geometry = registry.getStaffGeometry(measureNumber, staff)
    // The left neighbour, or — for the bar's first column — where notes may start at all.
    const leftX = at > 0 ? columns[at - 1].x : geometry?.noteStartX
    if (leftX === undefined) continue
    const staffSpacePx = geometry?.lineSpacing ?? VEXFLOW_DEFAULT_STAFF_SPACE_PX
    const slack = (columns[at].x - leftX - LAYOUT_CONFIG.MIN_NOTE_SPACING) / staffSpacePx
    room = room === null ? Math.max(0, slack) : Math.min(room, Math.max(0, slack))
  }
  return room
}

/**
 * ⭐ The same question for a gap INSIDE a fan (§7): how far left may this MEMBER be pulled before
 * its head closes on the one behind it, in staff-spaces.
 *
 * {@link measuredShrinkRoom} cannot answer it, and not by oversight: a member is registered under
 * the SLOT's beat (so `pixelXToBeat` keeps the group on one column), so that walk dedups the whole
 * fan into a single anchor and would measure the gap before the group instead of the gap before
 * the head. The heads are drawn ink, so the honest measurement is the drawn ink: two registry
 * entries, both head CENTRES, and the floor the geometry itself refuses to cross
 * ({@link FAN_MIN_HEAD_GAP_RATIO} × the notehead's own measured width).
 *
 * ⚠️ Same staleness rule as its sibling, and the same caller enforces it — a fresh number against an
 * old picture slides the floor down one step per press, and the clamp then never bites.
 *
 * @returns null when the last render cannot answer (either head undrawn, or an edit not yet drawn).
 */
export function fanMemberShrinkRoom(
  registry: ElementRegistry,
  measureNumber: number,
  noteId: string,
  /** The member's own id and the id of the one BEHIND it — resolved by the caller, which is the
   *  side that has the model. */
  behindId: string,
): number | null {
  const here = registry.getById(noteId)
  const prev = registry.getById(behindId)
  if (!here || !prev) return null
  const x = here.headX ?? here.bbox.x + here.bbox.width / 2
  const prevX = prev.headX ?? prev.bbox.x + prev.bbox.width / 2

  const geometry = registry.getStaffGeometry(measureNumber, staffOf(here))
  const staffSpacePx = geometry?.lineSpacing ?? VEXFLOW_DEFAULT_STAFF_SPACE_PX
  const minGap = here.bbox.width * FAN_MIN_HEAD_GAP_RATIO
  return Math.max(0, (x - prevX - minGap) / staffSpacePx)
}

/**
 * How many pixels of width the **drawn** bar can give back before its music is tighter than the
 * engraver's own floor — `MIN_NOTE_SPACING` (18px) per column, the same rule
 * `noteSpaceForLane` applies when it decides how wide a bar needs to be, but measured on the
 * picture instead of predicted.
 *
 * Measured, and not stated as "never below its own intrinsic width", because that absolute is
 * wrong and measurably so: on a compressed line every bar is *already* under its intrinsic width
 * (a `compressionRatio` below 1 is ordinary), so an absolute floor would refuse every shrink on
 * exactly the crowded lines where a shrink is most wanted.
 *
 * The **minimum across staves** — the bar is system-wide, so the tightest staff decides for all
 * of them. Columns, not slots: two voices sounding at one beat share a column.
 *
 * @returns null when the last render cannot answer (nothing drawn in that bar, or no geometry).
 */
export function measuredBarShrinkPx(registry: ElementRegistry, measureNumber: number): number | null {
  const columnsByStaff = new Map<number, Set<number>>()
  for (const el of registry.getByMeasure(measureNumber)) {
    if ((el.type !== 'note' && el.type !== 'rest') || el.beat === undefined) continue
    const staff = staffOf(el)
    const columns = columnsByStaff.get(staff) ?? new Set<number>()
    columns.add(Math.round(el.beat * 1e6))
    columnsByStaff.set(staff, columns)
  }
  if (columnsByStaff.size === 0) return null

  let slack: number | null = null
  for (const [staff, columns] of columnsByStaff) {
    const geometry = registry.getStaffGeometry(measureNumber, staff)
    if (!geometry) return null
    const drawn = geometry.noteEndX - geometry.noteStartX
    const floor = columns.size * LAYOUT_CONFIG.MIN_NOTE_SPACING
    const mine = Math.max(0, drawn - floor)
    slack = slack === null ? mine : Math.min(slack, mine)
  }
  return slack
}
