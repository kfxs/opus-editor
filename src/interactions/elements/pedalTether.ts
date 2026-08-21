/**
 * ⭐⭐ **THE DASHED TETHER — which `✻` belongs to which `Ped.`** (his ask, 2026-08-21: *"i think we
 * should draw dots line when pedal is select between ped and ✻ so we know the ✻ who belongs to"*,
 * and then the look: *"instead of dotted line probably looks better discontinuing lines similar to
 * ottava, but just when is selected of course"*).
 *
 * ⭐ **The dash is the OCTAVE BRACKET'S OWN, with more air** ({@link tetherDashArray}): the same ink
 * length, so the two read as one family, and a wider gap at his eye — *"can we make in the pedal more
 * spaced, more air between the dashes?"* A bracket's dashes ARE the mark and want to read as a line;
 * this one is a hint under the music and wants to read as less than one.
 *
 * ⭐ **It is a SELECTION aid, ⛔ not engraving.** Nothing is added to the drawing: the line lives on
 * the highlight layer, appears only while that pedal is selected, and dies with the rest of the
 * highlight. Gould's dress for a sustain pedal is two signs with NOTHING between them, and this
 * editor does not get to disagree with the book — but a page with three pedals in a row is two
 * questions about pairing that the ink genuinely cannot answer, and answering them is the selection's
 * job (`project_barline_ink_and_hinting`'s rule: paint a hint, ⛔ never re-draw the mark).
 *
 * ⭐ **His own note on when it stops being needed**: *"in case of future pedal with hook this is not
 * necessary but in these case is important"* — a bracket-style pedal draws a real line between its
 * ends, so the pairing is in the ink and this hint would be a second line over the first. ⚠️ The day
 * that style arrives, this module's caller is what should stop being called; the geometry here would
 * still be right.
 *
 * ## What is pedal-specific, and why it is a module rather than a line in the highlight pass
 *
 * ⭐⭐ **THE GRAIN IS THE GLYPH** (`./pedalHandles`' rule, arriving again): a pedal registers one box
 * per drawn SIGN, so the tether is a gap between two ENTRIES rather than the inside of one fragment's
 * box. Every other span in the editor would draw this from a single entry's two ends.
 *
 * ⭐⭐ **ONE SEGMENT PER SYSTEM, and it falls out of the geometry rather than being asked for**: the
 * signs of one fragment share a baseline exactly (`PedalRenderer.registerGlyph` builds every box from
 * that baseline), so grouping by the box's own `y` groups by ROW. A pedal cut by a break has its
 * `Ped.` alone on one row and `(Ped.) … ✻` on the next, and the alone one draws no tether — ⛔ never a
 * line running off the edge of the system, and ⛔ never one joining two rows, which would be two
 * systems' x's on one ruler again.
 */
import type { ElementInfo } from '../../engine/ElementRegistry'
import { OTTAVA_DASH_LENGTH } from '../../engine/rendering/ottavaStyle'
import { systemInkAt } from '../markBreakWrap'

/** One drawn segment: from the left sign's right edge to the right sign's left edge, on the baseline
 *  they share. Empty when there is nothing to pair. */
export interface PedalTether {
  x1: number
  x2: number
  y: number
}

/**
 * ⭐ **THE AIR BETWEEN THE TETHER'S DASHES**, in staff spaces — his number, 2026-08-21, replacing the
 * bracket's own {@link OTTAVA_DASH_GAP} (0.4) after seeing them side by side.
 *
 * ⚠️ Its own constant rather than a second use of the bracket's, so the two can be tuned apart: they
 * are drawn for different reasons (that one is the MARK, this one is a hint about the mark) and a
 * change to either should not move the other.
 */
export const TETHER_DASH_GAP = 1.0

/**
 * ⭐ **THE DASH PATTERN, in pixels** — the octave bracket's ink length with {@link TETHER_DASH_GAP}'s
 * air, scaled by the staff the pedal is drawn on.
 *
 * ⚠️ **The constants are in staff SPACES and the conversion happens here**, `OttavaRenderer`'s rule
 * and for its reason: a SMALL staff's dashes must be the same dashes, not the same pixels.
 */
export function tetherDashArray(staffSpacePx: number): string {
  return `${OTTAVA_DASH_LENGTH * staffSpacePx} ${TETHER_DASH_GAP * staffSpacePx}`
}

/**
 * ⭐ **THE GAPS INSIDE ONE ROW** — every pair of neighbouring signs the last render drew for
 * `pedalId`, in drawing order along each system, **plus the run to the line's edge where the pedal
 * carries on to the next one**.
 *
 * ⚠️ **Neighbours, ⛔ not "the first and the last"**: a resumed `(Ped.)` and its release are as much
 * a pair as the original press and its release, and on a row that holds three signs the tether
 * belongs in both gaps rather than spanning them.
 *
 * ⭐⭐ **A ROW THAT ENDS WITHOUT ITS RELEASE RUNS TO THE EDGE OF THE SYSTEM** — his ask, 2026-08-21,
 * with the screenshot: *"you are not showing the dashed line for the pedal in Ped. (not the
 * parenthesis) when crossing the system"*. ⛔ The first cut drew nothing there, on the grounds that a
 * line into the margin says nothing; but the pairing question is at its sharpest exactly THERE — a
 * `Ped.` with no `✻` after it is the one the eye cannot resolve — and the octave bracket next door
 * has run its dashes to the line's end all along. ⭐ Symmetric: a row that BEGINS with a release runs
 * back to the line's start.
 *
 * ⛔ Nothing is drawn for a gap that is not positive — two signs printing over each other have no gap
 * to show, and a backwards line would be a dash pointing the wrong way.
 */
export function pedalTethers(
  entries: readonly ElementInfo[],
  pedalId: string,
  /** ⭐ The system a POINT was drawn on — see {@link rowInkAt}. Omitted, the tether stops at the last
   *  sign of each row, which is what the caller gets when the picture cannot say. */
  registry?: TetherRegistry,
): PedalTether[] {
  const signs = entries.filter(el => el.id === pedalId && el.pedalSign)

  const rows = new Map<number, ElementInfo[]>()
  for (const sign of signs) {
    // ⭐ The box's own `y` IS the row: both signs of a fragment are built from one baseline, and no
    // two systems share one. ⛔ Not the measure number — a system holds several.
    const row = rows.get(sign.bbox.y)
    if (row) row.push(sign)
    else rows.set(sign.bbox.y, [sign])
  }

  const tethers: PedalTether[] = []
  for (const row of rows.values()) {
    const ordered = [...row].sort((a, b) => a.bbox.x - b.bbox.x)
    const y = ordered[0].bbox.y + ordered[0].bbox.height / 2
    for (let i = 0; i + 1 < ordered.length; i++) {
      const left = ordered[i]
      const right = ordered[i + 1]
      const x1 = left.bbox.x + left.bbox.width
      const x2 = right.bbox.x
      if (x2 <= x1) continue
      tethers.push({ x1, x2, y })
    }

    // ⭐⭐ THE ROW THAT CARRIES ON — see the header. The last sign of a row that is not the release
    // runs to the system's own last ink, and a row that opens with the release runs back from its
    // first ink.
    const room = registry ? rowInkAt(registry, ordered[0]) : null
    if (!room) continue
    const last = ordered[ordered.length - 1]
    if (last.pedalSign === 'down' && room.max > last.bbox.x + last.bbox.width) {
      tethers.push({ x1: last.bbox.x + last.bbox.width, x2: room.max, y })
    }
    const first = ordered[0]
    if (first.pedalSign === 'up' && room.min < first.bbox.x) {
      tethers.push({ x1: room.min, x2: first.bbox.x, y })
    }
  }
  return tethers
}

/** What finding a row needs of the last render — a Pick, so a spec can stand it up with a list. */
export interface TetherRegistry {
  allStaffGeometries(): ReadonlyArray<{
    measure: number
    staff: number
    lineYPositions: readonly number[]
    noteStartX: number
    noteEndX: number
  }>
  getStaffGeometry(measure: number, staff?: number): {
    lineYPositions: readonly number[]
    noteStartX: number
    noteEndX: number
  } | undefined
}

/**
 * ⭐⭐ **WHICH SYSTEM A SIGN WAS DRAWN UNDER, and how far its music runs** — found from the sign's own
 * y, ⛔ NEVER from its `measure`.
 *
 * 🚨 `PedalRenderer.registerGlyph` stamps every glyph of a pedal with the FIRST fragment's measure, so
 * a `(Ped.)` resumption on the third system still says *"measure 3"*. Measured in the browser,
 * 2026-08-21. ⭐ The y cannot lie the same way: a pedal is always drawn BELOW its staff, so the row is
 * the staff whose top line is the LAST one above the sign.
 *
 * The extent itself is `interactions/markBreakWrap`'s — the contiguous run of bars that share the
 * row — so this cannot re-acquire the cross-page bug that rule exists to fix.
 */
function rowInkAt(registry: TetherRegistry, sign: ElementInfo): { min: number; max: number } | null {
  const staff = sign.staff ?? 0
  let row: { measure: number; top: number } | null = null
  // ⭐ The same sweep answers {@link systemInkAt}'s ceiling: this caller holds no score, and the last
  // bar the render MEASURED is the honest bound on how far the run may be grown.
  let lastMeasure = 0
  for (const geometry of registry.allStaffGeometries()) {
    if (geometry.staff !== staff) continue
    if (geometry.measure > lastMeasure) lastMeasure = geometry.measure
    const top = geometry.lineYPositions[0]
    if (top >= sign.bbox.y) continue // the staff must be ABOVE the sign
    if (!row || top > row.top) row = { measure: geometry.measure, top }
  }
  return row ? systemInkAt(registry, staff, row.measure, lastMeasure) : null
}
