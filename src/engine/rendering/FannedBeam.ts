/**
 * A fanned (feathered) beam's GEOMETRY — where the members' stems go and where the beam lines run,
 * as pure arithmetic. Numbers in, numbers out: no VexFlow, no DOM. The renderer reads the real
 * note's geometry, calls this, and fills the quads (docs/fanned-beams-plan.md §3, P1).
 *
 * VexFlow cannot draw this: `Beam.drawBeamLines` steps every level by a constant `beamWidth * 1.5`
 * on ONE shared slope, and how many lines there are comes from the note's written duration. A fan is
 * the opposite of both — the line count changes ALONG the group, which is the whole notation. The
 * precedent for drawing beam lines ourselves is the cross-system overhang (`drawCrossBarSideBeam`)
 * and the two-note tremolo's stroke stack.
 */
import type { FanMember } from '@/utils/fannedBeam'

/** One filled quad, as `fillBeamQuad` wants it: the TOP edge, thickness applied downward. */
export interface FanQuad {
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
}

/** Where one member of the group is drawn. */
export interface FanStem {
  /** Left edge of the notehead. */
  headX: number
  /** The stem's x — the notehead's stem side, the same offset the real note uses. */
  stemX: number
  /** The stem runs from here (the notehead end) to the beam line. */
  baseY: number
  tipY: number
}

export interface FanGeometry {
  /** Every member, INCLUDING index 0 — the renderer draws the ones it did not already draw. */
  stems: FanStem[]
  /** The beam lines, narrow end to wide end. */
  beams: FanQuad[]
}

/**
 * The closest two fanned noteheads may come, as a multiple of the notehead's own width.
 *
 * ⚠️ PROVISIONAL like every other number in this feature (docs/fanned-beams-plan.md §1), and the one
 * to turn if a dense fan still reads crowded — or if it now reads too airy. A ratio rather than a
 * pixel count so it follows the staff size, and above 1 so two heads always have daylight between
 * them rather than merely not overlapping.
 */
export const FAN_MIN_HEAD_GAP_RATIO = 1.25

/**
 * How much stem the beam levels need past the primary line, in pixels — the room the lines that fan
 * INWARD (toward the noteheads) take up, so the innermost one still clears the heads.
 *
 * The same arithmetic VexFlow's own multi-beam stems use: each extra level is one `beamWidth × 1.5`
 * step. Not a chosen number — it is the step, counted.
 */
export function fanStemExtension(beams: number, beamWidth: number): number {
  return Math.max(0, Math.round(beams) - 1) * beamWidth * 1.5
}

/**
 * The whole picture, from the real note's geometry and the expander's members.
 *
 * ⭐ **The beam line is FLAT and sits at the stem tips**, exactly where a `Beam` would put it, and
 * the extra levels step INWARD from it (`beamWidth × 1.5`, VexFlow's own step, signed by the stem
 * direction). Flat because in P1 every member is the slot's own pitch, so there is no slope to
 * follow — the day members get their own pitches (docs/fanned-beams-plan.md §4) is the day this
 * grows a slope, and it is the only line here that would change.
 *
 * ⭐ **The lines converge at the SLOW end and are fully feathered at the FAST one** — Gould's
 * sentence, drawn: an `accel` fans open to the right, a `rit` to the left. Every secondary line
 * therefore runs from the primary's narrow-end point to its own level at the wide end, which is what
 * makes them read as one fan rather than as a stack of beams that happens to be ragged.
 *
 * `startFraction` places each member along the span. It is a PROPORTION of the group's time, so the
 * noteheads crowd toward the fast end all by themselves — the drawing says the same thing the
 * playback does because both read the same expander.
 *
 * Returns empty geometry when the span has collapsed or a single member is all there is: a fan with
 * no room is not a narrower fan, it is nothing to draw.
 */
export function fannedBeamGeometry(opts: {
  members: FanMember[]
  direction: 'accel' | 'rit'
  /** Beam lines at the WIDE end. The narrow end is always 1. */
  beams: number
  /** The real note's notehead left edge — member 0 is already drawn there. */
  headX: number
  /** The x the LAST member's notehead may reach (the next note's ink, or the barline). */
  spanEndX: number
  /** `stemX - headX` on the real note: which side of the head the stem is on, and how far. */
  stemOffset: number
  /**
   * The closest two member noteheads may ever come, in pixels — MEASURED by the caller from the
   * notehead itself, so it follows the staff size instead of pinning a number that is wrong the day
   * the scale changes.
   */
  minHeadGap: number
  /** Where the stems meet the noteheads (the real note's `getStemExtents().baseY`). */
  baseY: number
  /** The stem tips — the primary beam line's y. */
  tipY: number
  /** +1 stems up, −1 stems down. */
  stemDirection: number
  beamWidth: number
}): FanGeometry {
  const {
    members, direction, beams, headX, spanEndX, stemOffset, minHeadGap, baseY, tipY, stemDirection,
    beamWidth,
  } = opts
  const empty: FanGeometry = { stems: [], beams: [] }
  if (members.length < 2) return empty

  // The span the HEADS may occupy: the last one must still fit before whatever comes next, so the
  // room its own glyph takes is not part of the ramp.
  const usable = spanEndX - headX - minHeadGap
  if (usable <= 0) return empty

  /**
   * ⭐ PROPORTIONAL, WITH A FLOOR. Each gap is the member's own share of the span — that is what
   * makes the picture say what the sound does — but never closer than {@link minHeadGap}, because
   * two noteheads on top of each other say nothing at all. A `rit.` is the case that needs it: a
   * rallentando OPENS with its fastest notes, so its first gaps are its tightest.
   *
   * The floor should rarely bite: `fanColumns` asks the bar for exactly the width this layout wants
   * (the tightest gap × the whole ramp). It bites when the bar could not give it — a fan sharing a
   * crowded bar, or one clamped by `MAX_MEASURE_WIDTH` — and then the group compresses evenly
   * instead of piling up at one end.
   */
  const gaps: number[] = []
  for (let k = 0; k + 1 < members.length; k++) {
    gaps.push(Math.max(minHeadGap, (members[k + 1].startFraction - members[k].startFraction) * usable))
  }
  // Even the floored layout can outgrow the room the bar gave. Scaling every gap by the shortfall
  // keeps the group inside its span and lands it evenly short rather than letting the last members
  // walk into the next note — the least-bad answer to "there was not enough room", and the only one
  // that never draws outside the slot it belongs to.
  const wanted = gaps.reduce((a, b) => a + b, 0)
  const scale = wanted > usable ? usable / wanted : 1

  const stems: FanStem[] = []
  let x = headX
  for (let k = 0; k < members.length; k++) {
    if (k > 0) x += gaps[k - 1] * scale
    stems.push({ headX: x, stemX: x + stemOffset, baseY, tipY })
  }

  // Signed, so a quad drawn from its top edge downward marches the right way for either stem
  // direction — the same expression `drawCrossBarSideBeam` builds from `Beam`.
  const thickness = beamWidth * stemDirection
  const startX = stems[0].stemX
  const endX = stems[stems.length - 1].stemX
  // ⚠️ Both ends carry HALF a stem's width past the outer stems in VexFlow's own beams (it ends a
  // beam line at `getStemX() - Stem.WIDTH / 2`); the caller passes stem x's that already match its
  // notes, so the line simply spans them and the rounded stem ends do the rest.
  const wideAtEnd = direction === 'accel'

  const lines: FanQuad[] = []
  for (let k = 0; k < Math.max(1, Math.round(beams)); k++) {
    const offset = k * thickness * 1.5
    lines.push({
      startX,
      // The convergence point: at the NARROW end every line sits on the primary. Only the wide end
      // spreads. k = 0 is the primary itself and is flat by construction.
      startY: tipY + (wideAtEnd ? 0 : offset),
      endX,
      endY: tipY + (wideAtEnd ? offset : 0),
      thickness,
    })
  }
  return { stems, beams: lines }
}
