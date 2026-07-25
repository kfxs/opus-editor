/**
 * **Cross-barline beams** — which beam groups leave their bar, and what that costs the bars they
 * leave (docs/cross-barline-beaming-plan.md).
 *
 * The grouping itself is pure and lives in `utils/beaming` (`computeCrossBarBeamGroups`). This
 * module is the *layout-aware* half: it slices the score into the runs a beam may actually cross,
 * asks for their groups, and splits the answer into the two things the renderer needs —
 *
 *  - {@link LaneBeamPlan}, per (measure, staff, voice): the groups wholly inside that bar (built and
 *    drawn by the bar itself, exactly as before) and the slots belonging to a group that *leaves*
 *    it (which get a placeholder beam instead, so they draw with no flag and no stem);
 *  - {@link CrossBarJoin}, one per crossing group: everything the post-measure pass needs to build
 *    the one real `Beam` over both bars' `StaveNote`s.
 *
 * ## A run crosses the system break; a `CrossBarJoin` splits at it
 *
 * One `Beam` cannot span two lines, but a beam *group* can — real engraving hangs a half-beam over
 * the barline at the end of a line and resumes it on the next. So the run walk stays open across a
 * system break (the planner is drawn-blind there), and {@link computeSides} partitions each crossing
 * group into one drawable fragment per line. See {@link splitIntoRuns} for why the break is not a
 * wall but an unpainted bar still is — within a line.
 *
 * ## Why the whole lane, and not just the pair
 *
 * A bar's groups cannot be computed in isolation once its barline is open: a `continue` on the first
 * note of bar N+1 is an *orphan* when that bar is read alone (it starts a forced group that runs to
 * the end of the bar) and a *join* when it is read after bar N. So the in-bar groups come from the
 * same run walk as the crossing ones — one computation, one answer.
 */

import type { ChordRest, Clef, Measure } from '@/types/music'
import { computeCrossBarBeamGroups, secondaryBreakIndices, type BeamBar } from '@/utils/beaming'
import { fracCompare } from '@/utils/fraction'
import { getMeterInfo } from '@/utils/meter'

/** One bar of one staff, as the planner needs to see it. */
export interface CrossBarBar {
  measureNumber: number
  staffIndex: number
  /** The system line it landed on — a run of bars is bounded by the system break. */
  line: number
  /** Is tier 2 painting it this pass? An unpainted bar has no `StaveNote`s to beam to. */
  drawn: boolean
  /** This staff's own lane of the measure (`staffMeasureView`). */
  view: Measure
  /** The clef in force at the bar's start — the stem-direction rule reads pitches against it. */
  clef: Clef
}

/** One member of a crossing group: `lookupId` is the key it has in `staveNoteMap`. */
export interface CrossBarJoinMember {
  measureNumber: number
  slotId: string
  lookupId: string
  /** How many beam lines this note carries (𝅘𝅥𝅮=1, 𝅘𝅥𝅯=2, 𝅘𝅥𝅰=3) — a lone side draws its own count. */
  beamCount: number
}

/**
 * One system's worth of a join — the members that landed on a single line, drawn as an independent
 * half-group with an open end where the beam runs off toward the break
 * (docs/cross-barline-beaming-plan.md).
 *
 * A join wholly on one line has exactly one side, open at neither end — which is every join *today*,
 * because `splitIntoRuns` still walls the run at a system break. The machinery is built ahead of that
 * wall coming down so the drawer can already speak in sides.
 */
export interface CrossBarSide {
  /** This side's members, in engraved order — a contiguous slice of the join's `members`. */
  members: CrossBarJoinMember[]
  /** The measure numbers this side touches, ascending. */
  measures: number[]
  /** This side continues to a previous side across a system break (a fragment opens on its left). */
  openLeft: boolean
  /** This side continues to a next side across a system break (a fragment opens on its right). */
  openRight: boolean
  /** Side-local indices for `Beam.breakSecondaryAt`, re-based from the whole-group indices. */
  secondaryBreaks: number[]
  /**
   * How many beam lines run THROUGH the open end — the count common to both sides at that split
   * point, so neither side alone decides it. `null` when the end is not open.
   */
  crossingLeft: number | null
  crossingRight: number | null
  /** Every one of this side's own bars is painted this pass — a side draws iff this holds (P3). */
  drawable: boolean
}

/**
 * One beam group that leaves its bar.
 *
 * The group's members, the bars it touches and its secondary breaks are **not** here — they live on
 * {@link CrossBarSide}, one side per system line, so nothing keeps two descriptions of one group. A
 * same-line join (every join today) is just a join with a single side. Only `stemDirection` stays a
 * whole-group fact, because a beam group genuinely has one direction.
 */
export interface CrossBarJoin {
  staffIndex: number
  voice: number
  /** ONE direction for the whole group, resolved across all its bars. */
  stemDirection: number
  /**
   * The group partitioned per system line. Exactly one side until the wall comes down (P3); the
   * planner is drawn-blind across a line break, so a side's own `drawable` — not the run — decides
   * whether it renders.
   */
  sides: CrossBarSide[]
}

/** What one (measure, staff, voice) lane does about beams. Indices are into {@link laneSlots}. */
export interface LaneBeamPlan {
  /** Groups wholly inside this bar — built and drawn by the bar, as they always were. */
  inBar: number[][]
  /** Slots belonging to a group that leaves this bar, with that group's shared stem direction. */
  crossing: { slots: number[]; stemDirection: number }[]
}

export interface CrossBarBeamPlan {
  joins: CrossBarJoin[]
  lanes: Map<string, LaneBeamPlan>
  /**
   * This (measure, staff)'s contribution to its shape key: *which of my slots are flagless, and at
   * which stem direction*. Empty when nothing crosses.
   *
   * Not the neighbour's fingerprint. All the joined bar's `<g>` holds is notes with no flag at a
   * direction its neighbour helped decide — the beam itself lives outside every measure group and
   * is rebuilt from scratch every render, so its geometry needs no key at all.
   */
  descriptorFor(measureNumber: number, staffIndex: number): string
}

/** How the renderer's per-voice slot arrays are built — the order every index here refers to. */
export function laneSlots(view: Measure, voice: number): ChordRest[] {
  return [...view.slots]
    .sort((a, b) => fracCompare(a.beat, b.beat))
    .filter(s => (s.voice ?? 0) === voice)
}

export function laneKey(measureNumber: number, staffIndex: number, voice: number): string {
  return `${measureNumber}:${staffIndex}:v${voice}`
}

/** The `staveNoteMap` key for a slot: a chord is keyed by its pitches, a rest by its own id. */
function lookupIdOf(slot: ChordRest): string {
  return slot.type === 'chord' ? slot.notes[0]?.id ?? slot.id : slot.id
}

/** How many beam lines a note carries: 𝅘𝅥𝅮=1, 𝅘𝅥𝅯=2, 𝅘𝅥𝅰=3. Dots do not change it, rests never reach here. */
function beamCountOf(slot: ChordRest): number {
  if (slot.type !== 'chord') return 1
  return slot.duration === '32' ? 3 : slot.duration === '16' ? 2 : 1
}

/**
 * Partition a join's members into per-system SIDES — split at every index where the line changes
 * (docs/cross-barline-beaming-plan.md). Members on one line become one side; a break between
 * two lines opens the side before it on its right and the side after it on its left.
 *
 * `secondaryBreaks` (group-local indices) stay whole-group and are handed in rather than recomputed
 * per side, because a side alone cannot know them — they are re-based here to each side's own start.
 * The crossing count at a split (the lines common to both sides) is read off each member's own
 * `beamCount`: a secondary break at the split leaves only the primary crossing; otherwise every level
 * the two notes either side of it share crosses.
 */
export function computeSides(
  members: CrossBarJoinMember[],
  lines: number[],
  drawn: boolean[],
  secondaryBreaks: number[],
): CrossBarSide[] {
  const broken = new Set(secondaryBreaks)
  // Lines running through the boundary AFTER member g (between g and g+1).
  const crossingAfter = (g: number): number =>
    broken.has(g) ? 1 : Math.min(members[g].beamCount, members[g + 1].beamCount)

  const sides: CrossBarSide[] = []
  let start = 0
  for (let i = 1; i <= members.length; i++) {
    if (i < members.length && lines[i] === lines[i - 1]) continue
    const end = i // this side spans members [start, end)
    const openLeft = start > 0
    const openRight = end < members.length
    sides.push({
      members: members.slice(start, end),
      measures: [...new Set(members.slice(start, end).map(m => m.measureNumber))].sort((a, b) => a - b),
      openLeft,
      openRight,
      // A break at `end - 1` straddles the split (it IS the crossing), so it stops at `end - 2`.
      secondaryBreaks: secondaryBreaks.filter(g => g >= start && g <= end - 2).map(g => g - start),
      crossingLeft: openLeft ? crossingAfter(start - 1) : null,
      crossingRight: openRight ? crossingAfter(end - 1) : null,
      drawable: drawn.slice(start, end).every(Boolean),
    })
    start = end
  }
  return sides
}

/**
 * Plan every staff's beams for one render.
 *
 * `bars` is every (measure, staff) of the score in measure order — `VexFlowRenderer`'s tier-1
 * plans. `stemDirectionFor` resolves one group's shared direction; it is a callback because the
 * rule (explicit override, then the multi-voice lane, then the pitch furthest from the middle line)
 * needs the clef, and clefs are the renderer's business.
 */
export function planCrossBarBeams(
  bars: CrossBarBar[],
  stemDirectionFor: (
    unionSlots: ChordRest[],
    first: { bar: CrossBarBar; slot: ChordRest },
    forced: number | undefined,
  ) => number,
): CrossBarBeamPlan {
  const joins: CrossBarJoin[] = []
  const lanes = new Map<string, LaneBeamPlan>()
  const descriptors = new Map<string, string[]>()

  const laneOf = (bar: CrossBarBar, voice: number): LaneBeamPlan => {
    const key = laneKey(bar.measureNumber, bar.staffIndex, voice)
    let lane = lanes.get(key)
    if (!lane) lanes.set(key, (lane = { inBar: [], crossing: [] }))
    return lane
  }

  for (const run of splitIntoRuns(bars)) {
    const voices = [...new Set(run.flatMap(b => b.view.slots.map(s => s.voice ?? 0)))].sort((a, b) => a - b)

    for (const voice of voices) {
      const slotsPerBar = run.map(b => laneSlots(b.view, voice))
      // The multi-voice lane forces a stem side (odd voices up, even down) — a fact about the BAR,
      // so a group joining a two-voice bar to a one-voice bar takes it from the bar that has it.
      // Voice parity is the same in both, so two forced bars can never disagree.
      const forcedPerBar = run.map(b =>
        new Set(b.view.slots.map(s => s.voice ?? 0)).size > 1 ? (voice % 2 === 0 ? 1 : -1) : undefined)
      const beamBars: BeamBar[] = run.map((b, i) => ({
        slots: slotsPerBar[i],
        meter: getMeterInfo(b.view.timeSignature),
      }))

      for (const group of computeCrossBarBeamGroups(beamBars)) {
        const barsTouched = [...new Set(group.map(ref => ref.bar))]

        if (barsTouched.length === 1) {
          laneOf(run[barsTouched[0]], voice).inBar.push(group.map(ref => ref.slot))
          continue
        }

        const unionSlots = group.map(ref => slotsPerBar[ref.bar][ref.slot])
        const first = { bar: run[group[0].bar], slot: unionSlots[0] }
        const forced = forcedPerBar.find((f, i) => f !== undefined && barsTouched.includes(i))
        const stemDirection = stemDirectionFor(unionSlots, first, forced)

        const members: CrossBarJoinMember[] = group.map((ref, i) => ({
          measureNumber: run[ref.bar].measureNumber,
          slotId: unionSlots[i].id,
          lookupId: lookupIdOf(unionSlots[i]),
          beamCount: beamCountOf(unionSlots[i]),
        }))
        const secondaryBreaks = secondaryBreakIndices(unionSlots)

        const join: CrossBarJoin = {
          staffIndex: run[0].staffIndex,
          voice,
          stemDirection,
          sides: computeSides(
            members,
            group.map(ref => run[ref.bar].line),
            group.map(ref => run[ref.bar].drawn),
            secondaryBreaks,
          ),
        }
        joins.push(join)

        for (const barIndex of barsTouched) {
          laneOf(run[barIndex], voice).crossing.push({
            slots: group.filter(ref => ref.bar === barIndex).map(ref => ref.slot),
            stemDirection,
          })
          const key = `${run[barIndex].measureNumber}:${run[barIndex].staffIndex}`
          const list = descriptors.get(key) ?? []
          list.push(`v${voice}/${stemDirection}/${members.map(m => m.slotId).join(',')}`)
          descriptors.set(key, list)
        }
      }
    }
  }

  return {
    joins,
    lanes,
    descriptorFor: (measureNumber, staffIndex) =>
      (descriptors.get(`${measureNumber}:${staffIndex}`) ?? []).sort().join(';'),
  }
}

/**
 * One staff's bars, cut into the stretches a beam group may run over.
 *
 * ## The system break is NOT a wall — the planner is drawn-blind across it
 *
 * A `Beam` cannot span two lines, but the *plan* must: the stem direction and the crossing count are
 * whole-group facts, and side A needs them whether or not side B is on screen. So the run stays open
 * across a line break, and `computeSides` partitions the group into one fragment per line
 * (docs/cross-barline-beaming-plan.md). Keeping it open costs nothing — nothing is drawn from
 * the run directly; a side's own `drawable` decides that, and the join it forms is therefore the same
 * whether or not the next system is culled, which is what keeps the shape-key descriptor scroll-stable.
 *
 * ## An unpainted bar IS a wall — but only WITHIN a line
 *
 * A real `Beam` needs both bars' `StaveNote`s, so inside a side an undrawn bar still walls the run: a
 * placeholder whose beam never arrives would draw a note with no flag *and* no stem. Across a line
 * break the same undrawn bar is harmless — it just becomes an undrawn side that skips itself.
 */
function splitIntoRuns(bars: CrossBarBar[]): CrossBarBar[][] {
  const runs: CrossBarBar[][] = []
  let current: CrossBarBar[] = []

  const flush = () => {
    if (current.length) runs.push(current)
    current = []
  }

  // Measure-major input (`layoutTier1`), so one staff's bars are interleaved with the others' —
  // gather each staff's own sequence first, keeping score order within it.
  const byStaff = new Map<number, CrossBarBar[]>()
  for (const bar of bars) {
    const list = byStaff.get(bar.staffIndex) ?? []
    list.push(bar)
    byStaff.set(bar.staffIndex, list)
  }

  for (const staffBars of byStaff.values()) {
    for (const bar of staffBars) {
      const previous = current[current.length - 1]
      // The `!drawn` wall fires only on a same-line boundary; a line break never flushes.
      const sameLine = previous && previous.line === bar.line
      if (sameLine && (!previous.drawn || !bar.drawn)) flush()
      current.push(bar)
    }
    flush()
  }

  return runs
}
