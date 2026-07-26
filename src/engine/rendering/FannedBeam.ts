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
  /**
   * How much the REAL note's stem must GROW, in pixels, for member 0 to reach the beam line.
   *
   * Zero whenever the line passes through its natural tip — which is every fan whose members all
   * sit at one pitch, i.e. everything that was on the page before members had their own. It becomes
   * non-zero when a member far from member 0 pushes the whole line away to keep ITS stem long
   * enough; the line is a straight edge, so what moves for one moves for all.
   */
  stemLift: number
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
 * The steepest the beam line may run, as rise over run.
 *
 * **VexFlow's own number** (`Beam.renderOptions.maxSlope`), so a fan leans no harder than the
 * ordinary beams beside it — the reader should not be able to tell that this one was drawn by hand.
 * PROVISIONAL like everything else here, but this one at least has a house to match.
 */
export const FAN_MAX_BEAM_SLOPE = 0.25

/**
 * The shortest stem a member may keep, in staff SPACES, before the beam line is pushed away to give
 * it room. Measured from the head nearest the line — the same end VexFlow measures its own stems
 * from.
 *
 * ⚠️ It is not tidiness: without a floor, a member whose pitch sits far past the line's reach gets a
 * stem of zero length and then a NEGATIVE one, drawing a stem that passes through its own head and
 * out the other side. PROVISIONAL; the room the inward beam levels take is added on top by the
 * caller ({@link fanStemExtension}), because those lines eat into every member's stem, not just the
 * real note's.
 */
export const FAN_MIN_STEM_SPACES = 2

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
 * ⭐ **The beam line RUNS FROM MEMBER 0'S OWN STEM TIP**, at the slope the last member asks for, and
 * the extra levels step INWARD from it (`beamWidth × 1.5`, VexFlow's own step, signed by the stem
 * direction). It was flat while every member was the slot's own pitch; now that they have their own
 * (docs/fanned-beam-pitches-plan.md §2) it leans, and this is the only line here that changed.
 *
 * ⭐ **Anchored at member 0, never at the middle.** The real note's stem is drawn by VexFlow, so the
 * one place the line and the page cannot argue is the tip it already has. Everything else is
 * expressed as a lean away from it, plus a {@link FanGeometry.stemLift} the caller feeds back into
 * that stem — which is why a fan whose members all share one pitch comes out EXACTLY as it did
 * before they could differ: slope zero, lift zero, the flat line at the stem tips.
 *
 * ⚠️ **Two guards, and they are the notation, not tidiness.** The slope is clamped to
 * {@link FAN_MAX_BEAM_SLOPE} so a wide leap does not stand the beam on end; and every member keeps
 * at least `minStemLength` of stem, which is what stops a member far from the line from growing a
 * stem that inverts through its own notehead. When the floor bites, the WHOLE line moves — a beam
 * is one straight edge, so it cannot bend for one member.
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
  /**
   * Each member's notehead y's, member 0 first — one entry per member, one number per head it
   * carries. The caller resolves them from the pitches and the stave, because that is the one
   * conversion this module refuses to know about.
   */
  memberHeadYs: number[][]
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
  /**
   * Extra room, per member, that its ACCIDENTAL needs to the LEFT of its head — 0 where it carries
   * no sign. The width pass cannot see this (it counts head columns and cannot measure glyphs), so
   * the sign buys its room out of the group's own span rather than out of the bar's.
   */
  accidentalRoom?: number[]
  /** The stem tip the real note is ALREADY drawn with — the line's anchor. */
  tipY: number
  /** The shortest stem any member may keep, in pixels, measured from its head nearest the line. */
  minStemLength: number
  /** +1 stems up, −1 stems down. */
  stemDirection: number
  beamWidth: number
}): FanGeometry {
  const {
    members, memberHeadYs, direction, beams, headX, spanEndX, stemOffset, minHeadGap,
    accidentalRoom, tipY, minStemLength, stemDirection, beamWidth,
  } = opts
  const empty: FanGeometry = { stems: [], beams: [], stemLift: 0 }
  if (members.length < 2 || memberHeadYs.length < members.length) return empty

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
    // The floor grows by whatever sign the NEXT head wears, since an accidental hangs to its left
    // and would otherwise land on this head.
    const floor = minHeadGap + (accidentalRoom?.[k + 1] ?? 0)
    gaps.push(Math.max(floor, (members[k + 1].startFraction - members[k].startFraction) * usable))
  }
  // Even the floored layout can outgrow the room the bar gave. Scaling every gap by the shortfall
  // keeps the group inside its span and lands it evenly short rather than letting the last members
  // walk into the next note — the least-bad answer to "there was not enough room", and the only one
  // that never draws outside the slot it belongs to.
  const wanted = gaps.reduce((a, b) => a + b, 0)
  const scale = wanted > usable ? usable / wanted : 1

  const xs: number[] = []
  let x = headX
  for (let k = 0; k < members.length; k++) {
    if (k > 0) x += gaps[k - 1] * scale
    xs.push(x)
  }

  // Up = +1, so the tip is the SMALLER y and the outer (base) head the larger; down mirrors it.
  const up = stemDirection > 0
  const outer = (ys: number[]) => (up ? Math.max(...ys) : Math.min(...ys))
  const inner = (ys: number[]) => (up ? Math.min(...ys) : Math.max(...ys))

  // The stem length the real note is wearing, measured from the head the tip is reckoned against —
  // VexFlow's own rule (`Stem.getExtents`: the tip hangs off the INNERmost head). Every member
  // borrows it, so a group of equal pitches reproduces the note's own stem exactly.
  const stemHeight = Math.abs(tipY - inner(memberHeadYs[0]))
  const idealTip = memberHeadYs.map(ys => inner(ys) - stemDirection * stemHeight)

  // ⚠️ Along the STEMS, not the heads: the line meets each member at its stem, so anchoring it at
  // member 0's headX would leave its own tip off the line by `stemOffset × slope` — and the real
  // note's stem, which is drawn by VexFlow and cannot be re-aimed sideways, is the one thing here
  // that has to land exactly.
  const sx = xs.map(px => px + stemOffset)
  const runX = sx[sx.length - 1] - sx[0]
  const rawSlope = runX > 0 ? (idealTip[idealTip.length - 1] - idealTip[0]) / runX : 0
  const slope = Math.max(-FAN_MAX_BEAM_SLOPE, Math.min(FAN_MAX_BEAM_SLOPE, rawSlope))
  const lineY = (px: number) => idealTip[0] + slope * (px - sx[0])

  // ⭐ The floor, applied to the WHOLE line. For each member, how far the line would have to move
  // (away from the heads) to leave it `minStemLength` of stem; the largest of those wins, and a
  // member that already has room asks for nothing. Signed by the stem direction, so `shift` is
  // negative for stems up (the line rises) and positive for stems down.
  let shift = 0
  for (let k = 0; k < members.length; k++) {
    const wanted = inner(memberHeadYs[k]) - stemDirection * minStemLength
    const need = wanted - lineY(sx[k])
    if (up ? need < shift : need > shift) shift = need
  }

  const stems: FanStem[] = xs.map((px, k) => ({
    headX: px,
    stemX: sx[k],
    baseY: outer(memberHeadYs[k]),
    tipY: lineY(sx[k]) + shift,
  }))

  // Signed, so a quad drawn from its top edge downward marches the right way for either stem
  // direction — the same expression `drawCrossBarSideBeam` builds from `Beam`.
  const thickness = beamWidth * stemDirection
  const startX = stems[0].stemX
  const endX = stems[stems.length - 1].stemX
  const startY = stems[0].tipY
  const endY = stems[stems.length - 1].tipY
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
      // spreads. k = 0 IS the primary — it carries the slope and nothing else.
      startY: startY + (wideAtEnd ? 0 : offset),
      endX,
      endY: endY + (wideAtEnd ? offset : 0),
      thickness,
    })
  }
  return { stems, beams: lines, stemLift: Math.abs(shift) }
}
