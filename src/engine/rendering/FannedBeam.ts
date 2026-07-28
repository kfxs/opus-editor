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
import { clampFanSpread, rampRange, type FanMember } from '@/utils/fannedBeam'

/** One filled quad, as `fillBeamQuad` wants it: the TOP edge, thickness applied downward. */
export interface FanQuad {
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
}

/**
 * ⭐ The FAR EDGE of the beam stack at one x — the last ink the group has on the stem side, measured
 * out from the heads.
 *
 * A fanned group's beam is not one line: at the wide end it is `beams` of them, and each is a BAND
 * (`fillBeamQuad` fills from `y` to `y + thickness`). So a stem tip is nowhere near the outside of
 * the group — it is where the stem meets the INNERMOST line — and anything that has to clear the
 * beam has to clear this instead.
 *
 * Which is what an articulation on the stem side has to do. VexFlow places one against
 * `getStemExtents().topY`, so member 0 clears its own beam only because its stem was already
 * stretched to the ramp; a member handed nothing but its stem length puts its accent inside the
 * feathering, which is exactly what it looked like (*"the beam collides with that... the flip is
 * taking into account the stem length but not the beams"*).
 *
 * Returns null when the group has no beam to clear, so the caller can fall back to the stem tip.
 */
export function fanBeamFarEdge(beams: FanQuad[], x: number, stemDirection: number): number | null {
  let far: number | null = null
  for (const q of beams) {
    // A vertical (or degenerate) quad has no run to interpolate along; both ends are the same y.
    const span = q.endX - q.startX
    const t = span === 0 ? 0 : Math.min(1, Math.max(0, (x - q.startX) / span))
    const y = q.startY + t * (q.endY - q.startY)
    // The band, not the line — a beam is thick and the thickness is signed.
    for (const edge of [y, y + q.thickness]) {
      if (far === null) far = edge
      else far = stemDirection === 1 ? Math.min(far, edge) : Math.max(far, edge)
    }
  }
  return far
}

/**
 * One note of the PREFIX — the group the fan is JOINED to on its left
 * (docs/fan-beam-join-plan.md P1).
 *
 * ⚠️ Its position is FIXED by the formatter, not by the ramp: these notes were spaced by VexFlow
 * like any others, and all this pass does is aim their stems at the shared line. Rests carry no
 * stem and are not here — the line simply runs over them.
 */
export interface FanPrefixNote {
  /** The note's own `getStemX()`, so the line lands where its stem already is. */
  stemX: number
  /** Its notehead y's — a chord contributes all of them. */
  headYs: number[]
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
  /**
   * Where each PREFIX note's stem tip must land — one entry per {@link FanPrefixNote}, in order.
   * Empty for an unjoined fan. The renderer re-aims the note's OWN `Stem` object at it; it never
   * draws a line of its own, because a stem drawn any other way could never be selected.
   */
  prefixStems: { stemX: number; tipY: number }[]
  /** The beam lines, narrow end to wide end. */
  beams: FanQuad[]
  /**
   * How many lines stand at each END of the GROUP — the narrow end of the ramp is always 1, its wide
   * end is `beams`, and an end the wedge does not reach at all is 1 (the primary, alone). What a
   * neighbouring fan has to meet (docs/fan-beam-join-plan.md P2): the lines that cross the gap
   * between two fans are the ones BOTH sides have.
   */
  startLevels: number
  endLevels: number
  /** The joined line's height — flat, so one number. What the next fan in a chain must share. */
  lineY: number
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
 *
 * ⚠️ **`spread` belongs here as much as it belongs to the wedge** ({@link FanMark.spread}): the room
 * asked for is the room the lines actually take, so a wedge pulled twice as far open needs twice the
 * stem or its innermost line is drawn straight through the noteheads. Absent = 1 = the ordinary gap,
 * which is what a PREFIX's levels always pass — its beams are ordinary beams.
 */
export function fanStemExtension(beams: number, beamWidth: number, spread = 1): number {
  return Math.max(0, Math.round(beams) - 1) * beamWidth * 1.5 * Math.max(1, spread)
}

/** Everything one fan's geometry is computed from — named so the renderer can build it once and
 *  spend it twice: P2 runs the whole joined group through this to reconcile ONE line height. */
export interface FanGeometryOptions {
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
  /**
   * ⭐ Which members the WEDGE covers — {@link FanMark.rampFrom}/{@link FanMark.rampTo}, passed
   * RAW and clamped here against `members.length` (docs/fan-ramp-range-plan.md §3). Absent on either
   * side means that end of the group, which is every fan drawn before the range existed.
   *
   * Only the extra levels move. The primary still runs the whole group — every member is beamed —
   * so a note outside the mark carries exactly one line, which is what the base speed its
   * {@link FanMember.quarters} already reports looks like on the page.
   *
   * ⚠️ Raw, not resolved by the caller, because `stems[rampTo]` running off the end of the array is
   * the one way this crashes. `rampRange` (utils/fannedBeam) owns the clamp for both callers.
   */
  rampFrom?: number
  rampTo?: number
  /**
   * ⭐ How far apart the wide end's lines stand, as a multiple of the ordinary beam gap — absent = 1,
   * the gap VexFlow's own stacked beams use, which is also the floor. See {@link FanMark.spread}.
   *
   * ⚠️ The fan's, and NOT the prefix's: {@link prefixBeams}' levels are ordinary beams and keep the
   * ordinary gap. Only the wedge opens.
   */
  spread?: number
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
  /**
   * ⭐ The user-authored leading space, in PIXELS, before each member — 0 (or absent) where the
   * engraver's own ramp stands (docs/note-spacing-plan.md §7). Index k is the space before member k;
   * entry 0 is ignored, because the space before member 0 is the space before the fan's own COLUMN
   * and the tick-context shift has already spent it.
   *
   * ⚠️ Its width is already IN `spanEndX`: a member beat lies between the fan's tick context and the
   * next one, so `applyLeadingSpaces` moved the following note (and the bar grew for it). What this
   * decides is only WHERE inside the span it lands — without it the extra would be smeared across
   * the whole ramp instead of opening the one gap that was authored.
   */
  memberSpaces?: number[]
  /**
   * ⭐ The user-authored horizontal OFFSET of each member, in PIXELS (+right) — 0 (or absent) where
   * the member stands on its own column (docs/note-offset-plan.md §"Inside a FAN"). Index k is
   * member k's own offset, **entry 0 included**: the fan's owner is one note of the group, not a
   * handle the group hangs from.
   *
   * ⚠️ **THE OPPOSITE ARITHMETIC FROM {@link memberSpaces}, and mixing them up is the whole trap.** A
   * space is WIDTH — its px are already inside `spanEndX`, so it comes off the top and the ramp
   * shares what is left. An offset has NO width: it never touches `usable`, so every head that was
   * not offset stays exactly where the un-offset ramp put it. *"If I offset something, things that
   * are not the offset note should never move"* — his rule, and this is where it is kept.
   *
   * ⚠️ **Entry 0 is SUBTRACTED, not added.** `headX` is the owner's DRAWN head, and `StaveNote`'s
   * `xShift` is already in it, so the ramp is built from `headX - memberOffsets[0]` (the natural
   * column) and member 0 lands back on `headX`. Add it a second time and the fan's own note moves
   * twice.
   */
  memberOffsets?: number[]
  /**
   * The notes of the group the fan is JOINED to on its LEFT, in order — empty (or absent) for a fan
   * that stands alone. Their presence is what makes the line horizontal and what extends the primary
   * beam back to the first of them.
   */
  prefix?: FanPrefixNote[]
  /**
   * How many beam LINES the prefix's own durations ask for — the MINIMUM across it, so a mixed
   * prefix draws the lines they all agree on. Levels past the first run from the prefix's first stem
   * to the fan's owner and stop there, which is what a partial beam looks like anywhere else.
   */
  prefixBeams?: number
  /**
   * This fan is part of a JOINED group even though nothing ordinary precedes it — the FIRST fan of a
   * chain (P2). A prefix already implies it; this says so where there is none.
   */
  joined?: boolean
  /**
   * The joined group's line, ALREADY RECONCILED across every fan in it (P2) — given, so this fan
   * neither anchors nor floors it. A beam is one straight edge, so two fans on one beam cannot each
   * decide their own height; the caller runs this once per fan without it, takes the OUTERMOST answer
   * and hands it back.
   */
  lineY?: number
  /** The stem tip the real note is ALREADY drawn with — the line's anchor. */
  tipY: number
  /** The shortest stem any member may keep, in pixels, measured from its head nearest the line. */
  minStemLength: number
  /** +1 stems up, −1 stems down. */
  stemDirection: number
  beamWidth: number
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
 * ⭐ **The wedge may cover only PART of the group** ({@link FanGeometryOptions.rampFrom}, and
 * docs/fan-ramp-range-plan.md). The primary is untouched by that — every member is beamed — so the
 * whole of the change is which two stems the extra levels span, and the members outside them are
 * left carrying one line at the base speed their own {@link FanMember.quarters} already reports.
 * Picture and playback are still the same function; they are simply flat over part of their range.
 *
 * `startFraction` places each member along the span. It is a PROPORTION of the group's time, so the
 * noteheads crowd toward the fast end all by themselves — the drawing says the same thing the
 * playback does because both read the same expander.
 *
 * ## Joined to the group on its left
 *
 * ⭐ **The joined line is HORIZONTAL** (his call, docs/fan-beam-join-plan.md P1 — the cheapest of
 * three answers). Flat means there is no angle to argue about: the line sits at the height the
 * outermost note in the WHOLE group asks for and every stem stretches to meet it, which is precisely
 * the floor pass below ("largest ask wins, the whole line moves") with the slope forced to zero. It
 * is ordinary engraving besides — a beam goes horizontal when its notes do not move consistently one
 * way.
 *
 * ⚠️ **The thing to look at by eye:** a fan ALONE leans, because its members have their own pitches,
 * so joining one visibly straightens its own beam. If that reads as a snap rather than as a beam,
 * the recorded alternative is to slope the line over the whole group (first prefix stem to last
 * member, VexFlow's own rule) — at the cost of the anchor, since the line would then pass through
 * neither the prefix's natural tip nor member 0's.
 *
 * ⚠️ …and the second: the floor is `minStemLength`, not a natural stem. A PREFIX note further from
 * the line than member 0 pushes the line only far enough to keep itself that much stem, so the
 * outermost note of a joined group can end up on a shorter stem than an ordinary beam would give it.
 *
 * Returns empty geometry when the span has collapsed or a single member is all there is: a fan with
 * no room is not a narrower fan, it is nothing to draw.
 */
export function fannedBeamGeometry(opts: FanGeometryOptions): FanGeometry {
  const {
    members, memberHeadYs, direction, beams, headX, spanEndX, stemOffset, minHeadGap,
    accidentalRoom, memberSpaces, memberOffsets, tipY, minStemLength, stemDirection, beamWidth,
  } = opts
  const prefix = opts.prefix ?? []
  const joined = prefix.length > 0 || !!opts.joined
  const empty: FanGeometry = {
    stems: [], prefixStems: [], beams: [], stemLift: 0, startLevels: 0, endLevels: 0, lineY: 0,
  }
  if (members.length < 2 || memberHeadYs.length < members.length) return empty

  // ⭐ THE RAMP IS BUILT FROM THE NATURAL COLUMN, not from where the owner was nudged to: `headX` is
  // the DRAWN head and `StaveNote.setXShift` is already in it, so an owner offset would otherwise
  // start the whole ramp somewhere else — and, against a fixed `spanEndX`, squeeze five heads nobody
  // touched. Taking it back out here is the entirety of "an offset moves the note you offset and
  // nothing else"; member 0 gets it added back at its own index below.
  const offsets = memberOffsets ?? []
  const base = headX - (offsets[0] ?? 0)

  // The span the HEADS may occupy: the last one must still fit before whatever comes next, so the
  // room its own glyph takes is not part of the ramp. ⚠️ Measured from `base`, so NO offset ever
  // changes it — an offset has no width.
  const usable = spanEndX - base - minHeadGap
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
  /**
   * ⭐ AUTHORED SPACE COMES OFF THE TOP, and the ramp shares what is left — §3's justification rule
   * at ramp scale ("justify the intrinsic part, hand the user space back whole"). Its width is
   * already inside `usable` (see {@link FanGeometryOptions.memberSpaces}), so leaving it in the
   * proportional share would spread one member's nudge across every gap in the group and move the
   * five heads nobody touched.
   *
   * The floor is applied to the FINAL gap, after the authored amount is added: a member pulled left
   * is the user's assertion right up to the point where two heads would occupy one place, and there
   * it stops — the same floor, the same reason.
   */
  const authored = memberSpaces ?? []
  let authoredTotal = 0
  for (let k = 1; k < members.length; k++) authoredTotal += authored[k] ?? 0
  const rampUsable = Math.max(0, usable - authoredTotal)

  const gaps: number[] = []
  for (let k = 0; k + 1 < members.length; k++) {
    // The floor grows by whatever sign the NEXT head wears, since an accidental hangs to its left
    // and would otherwise land on this head.
    const floor = minHeadGap + (accidentalRoom?.[k + 1] ?? 0)
    const share = (members[k + 1].startFraction - members[k].startFraction) * rampUsable
    gaps.push(Math.max(floor, share + (authored[k + 1] ?? 0)))
  }
  // Even the floored layout can outgrow the room the bar gave. Scaling every gap by the shortfall
  // keeps the group inside its span and lands it evenly short rather than letting the last members
  // walk into the next note — the least-bad answer to "there was not enough room", and the only one
  // that never draws outside the slot it belongs to.
  const wanted = gaps.reduce((a, b) => a + b, 0)
  const scale = wanted > usable ? usable / wanted : 1

  // ⚠️ The offset is added to the head's PLACE, never to the running total: `x` walks the ramp
  // un-nudged, so one member's offset cannot push the ones after it along. That is the difference
  // between an offset and a space, in one line.
  const xs: number[] = []
  let x = base
  for (let k = 0; k < members.length; k++) {
    if (k > 0) x += gaps[k - 1] * scale
    xs.push(x + (offsets[k] ?? 0))
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
  // ⭐ FLAT once the fan is joined — see the header. The lean is a fact about the members' own
  // pitches; a joined group is one beam over notes that do not move consistently one way, so the
  // line stops arguing and the floor below decides its height on its own.
  const slope = joined ? 0 : Math.max(-FAN_MAX_BEAM_SLOPE, Math.min(FAN_MAX_BEAM_SLOPE, rawSlope))
  const lineY = (px: number) => idealTip[0] + slope * (px - sx[0])

  // ⭐ The floor, applied to the WHOLE line. For each member, how far the line would have to move
  // (away from the heads) to leave it `minStemLength` of stem; the largest of those wins, and a
  // member that already has room asks for nothing. Signed by the stem direction, so `shift` is
  // negative for stems up (the line rises) and positive for stems down.
  let shift = 0
  const ask = (headYs: number[], px: number) => {
    const wanted = inner(headYs) - stemDirection * minStemLength
    const need = wanted - lineY(px)
    if (up ? need < shift : need > shift) shift = need
  }
  for (let k = 0; k < members.length; k++) ask(memberHeadYs[k], sx[k])
  // The PREFIX asks with exactly the same voice — it is the same beam, and "the outermost note in
  // the group" does not care which half of the group it came from.
  for (const p of prefix) ask(p.headYs, p.stemX)

  // A line handed down by the group overrides anchor, slope and floor alike: it was computed from
  // this same arithmetic run over every fan on the beam, so it already satisfies all three.
  const lineAt = opts.lineY !== undefined ? () => opts.lineY as number : (px: number) => lineY(px) + shift
  const stems: FanStem[] = xs.map((px, k) => ({
    headX: px,
    stemX: sx[k],
    baseY: outer(memberHeadYs[k]),
    tipY: lineAt(sx[k]),
  }))
  const prefixStems = prefix.map(p => ({ stemX: p.stemX, tipY: lineAt(p.stemX) }))

  // Signed, so a quad drawn from its top edge downward marches the right way for either stem
  // direction — the same expression `drawCrossBarSideBeam` builds from `Beam`.
  const thickness = beamWidth * stemDirection
  // Where the RAMP starts (member 0's stem) and where the whole LINE starts — the same x for a fan
  // standing alone, the first prefix stem once it is joined.
  const rampStartX = stems[0].stemX
  // ⚠️ The PREFIX, not `joined` — the first fan of a chain (P2) is joined and has none, and the gap
  // back to the fan behind it belongs to {@link fanJoinQuads}, not to this ramp's own primary.
  const lineStartX = prefix.length ? prefix[0].stemX : rampStartX
  const endX = stems[stems.length - 1].stemX
  // ⚠️ Both ends carry HALF a stem's width past the outer stems in VexFlow's own beams (it ends a
  // beam line at `getStemX() - Stem.WIDTH / 2`); the caller passes stem x's that already match its
  // notes, so the line simply spans them and the rounded stem ends do the rest.
  const wideAtEnd = direction === 'accel'

  // ⭐ WHERE THE WEDGE STARTS AND ENDS. The whole group when nothing was asked for, which is the
  // only reason every fan drawn before this reads out identically.
  const { from: rampFrom, to: rampTo } = rampRange(stems.length, opts.rampFrom, opts.rampTo)
  const rampFromX = stems[rampFrom].stemX
  const rampToX = stems[rampTo].stemX

  const levels = Math.max(1, Math.round(beams))
  // ⭐ THE WEDGE'S OWN GAP. `× 1.5` is VexFlow's step for stacked beams — the tightest lines can sit
  // without overlapping — so a spread of 1 is both the default and the floor, and anything above it
  // is air the engraver asked for. The narrow end does not move: every line still converges on the
  // primary there, and only the wide end knows this number.
  const step = thickness * 1.5 * clampFanSpread(opts.spread ?? 1)
  const lines: FanQuad[] = []
  for (let k = 0; k < levels; k++) {
    const offset = k * step
    // ⭐ The PRIMARY is one straight edge over the WHOLE group — every member is beamed, and it
    // reaches back over the prefix besides. Only the EXTRA levels are the wedge, and they span the
    // range: outside it a member keeps this one line, which is the base speed, drawn.
    const sX = k === 0 ? lineStartX : rampFromX
    const eX = k === 0 ? endX : rampToX
    lines.push({
      // The convergence point: at the NARROW end every line sits on the primary. Only the wide end
      // spreads. k = 0 IS the primary — it carries the slope and nothing else.
      startX: sX,
      startY: lineAt(sX) + (wideAtEnd ? 0 : offset),
      endX: eX,
      // ⚠️ `lineAt`, not the last stem's cached tip: an inset `rampTo` ends the wedge at a stem that
      // is not the group's last, and on an unjoined fan the line slopes between them.
      endY: lineAt(eX) + (wideAtEnd ? offset : 0),
      thickness,
    })
  }
  // The PREFIX's own extra levels — a 16th group joined to a fan keeps its second beam, and it stops
  // at the owner's stem because that is where the prefix stops. A `rit.` therefore shows a thickness
  // change there (1 line in, `fan.beams` out); an `accel.` meeting eighths is the clean case.
  //
  // ⚠️ `1.5`, NOT `step`: these are ordinary beams that happen to lead into a fan, and an ordinary
  // beam group's lines sit at the ordinary gap however far the wedge beside them is pulled open.
  for (let k = 1; k < Math.max(0, Math.round(opts.prefixBeams ?? 0)); k++) {
    const offset = k * thickness * 1.5
    lines.push({
      startX: lineStartX,
      startY: lineAt(lineStartX) + offset,
      endX: rampStartX,
      endY: lineAt(rampStartX) + offset,
      thickness,
    })
  }
  return {
    stems,
    prefixStems,
    beams: lines,
    // How far the REAL note's stem must grow to reach the line. Measured from the tip VexFlow gave
    // it rather than from `shift`, because a line handed down by the group did not come from `shift`
    // at all. Never negative: the reconciliation keeps the shared line at or beyond every owner's
    // own tip, and the stem could not be shortened even if it did not.
    stemLift: Math.max(0, stemDirection * (tipY - lineAt(sx[0]))),
    // The ramp is fully feathered at the FAST end and converged at the slow one, so which end
    // carries `beams` is the direction, exactly as the quads above read it.
    //
    // ⚠️ **An INSET end carries ONE line whichever way the fan runs**, and this is the trap the
    // range sets: these two numbers are not about the wedge, they are what a NEIGHBOUR meets across
    // a join, and what stands at the group's own edge once the wedge stops short is the primary
    // alone. `fanJoinQuads` takes the min of the two sides and needs no idea any of this happened.
    startLevels: rampFrom > 0 ? 1 : (wideAtEnd ? 1 : levels),
    endLevels: rampTo < stems.length - 1 ? 1 : (wideAtEnd ? levels : 1),
    lineY: lineAt(rampStartX),
  }
}

/**
 * The lines that CROSS the gap between two fans on one beam (docs/fan-beam-join-plan.md P2) — from
 * the left fan's last member's stem to the right fan's owner's stem.
 *
 * ⭐ **The lines both sides have**: `min(left.endLevels, right.startLevels)`. A level that only one
 * of them carries simply stops at its own stem, which is what a partial beam looks like anywhere
 * else — the same answer P1 already gives a 16th prefix meeting a one-beam fan. So an `accel.`
 * running into a `rit.` joins thickly, and every other pairing joins on the one line they share.
 *
 * Flat, because a joined line is (P1): both ends sit on `lineY`.
 */
export function fanJoinQuads(opts: {
  left: FanGeometry
  right: FanGeometry
  /** Where the right fan's owner's stem is — the left end of its own ramp. */
  toX: number
  /** Signed by the stem direction, as everywhere else here. */
  thickness: number
  /**
   * ⭐ The RIGHT fan's {@link FanMark.spread} — whose gap the crossing lines have to match, because
   * they are drawn from its own `lineY` and land on its stems.
   *
   * ⚠️ Two joined fans with DIFFERENT spreads therefore show a step where they meet: a crossing line
   * leaves the left fan at one height and arrives at the right fan's at another. That is the same
   * class of edge P1 already accepts at a prefix (1 line in, `fan.beams` out) and the fix is the same
   * — match them — but it is real, and it is the thing to look at by eye first.
   */
  spread?: number
}): FanQuad[] {
  const { left, right, toX, thickness } = opts
  if (!left.stems.length) return []
  const fromX = left.stems[left.stems.length - 1].stemX
  const step = thickness * 1.5 * clampFanSpread(opts.spread ?? 1)
  const quads: FanQuad[] = []
  for (let k = 0; k < Math.min(left.endLevels, right.startLevels); k++) {
    const y = right.lineY + k * step
    quads.push({ startX: fromX, startY: y, endX: toX, endY: y, thickness })
  }
  return quads
}
