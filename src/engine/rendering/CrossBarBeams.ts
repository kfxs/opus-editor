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
 * ## A run is bounded by the system break — and by anything unpainted
 *
 * One `Beam` cannot span two lines, so a bar that opens a system starts a new run: the boundary
 * before it is never even considered, and the notes each side fall back to their ordinary in-bar
 * groups with their flags intact. Same for a bar tier 2 is not painting — an undrawn bar has no
 * `StaveNote`s to beam to, and a placeholder that never gets its beam draws a note with no flag
 * *and no stem*. (Under culling this second case does not arise: a join pins both its bars as span
 * anchors, and a span crossing the window forces its anchors to be drawn. The split is what makes
 * that a fact rather than an assumption.)
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
}

/** One beam group that leaves its bar. */
export interface CrossBarJoin {
  staffIndex: number
  voice: number
  /** The measure numbers it touches, ascending — the bars it pins as span anchors. */
  measures: number[]
  /** Every member, in engraved order. */
  members: CrossBarJoinMember[]
  /** ONE direction for the whole group, resolved across all its bars. */
  stemDirection: number
  /** Group-local indices for `Beam.breakSecondaryAt`. */
  secondaryBreaks: number[]
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

        const join: CrossBarJoin = {
          staffIndex: run[0].staffIndex,
          voice,
          measures: barsTouched.map(i => run[i].measureNumber),
          members: group.map((ref, i) => ({
            measureNumber: run[ref.bar].measureNumber,
            slotId: unionSlots[i].id,
            lookupId: lookupIdOf(unionSlots[i]),
          })),
          stemDirection,
          secondaryBreaks: secondaryBreakIndices(unionSlots),
        }
        joins.push(join)

        for (const barIndex of barsTouched) {
          laneOf(run[barIndex], voice).crossing.push({
            slots: group.filter(ref => ref.bar === barIndex).map(ref => ref.slot),
            stemDirection,
          })
          const key = `${run[barIndex].measureNumber}:${run[barIndex].staffIndex}`
          const list = descriptors.get(key) ?? []
          list.push(`v${voice}/${stemDirection}/${join.members.map(m => m.slotId).join(',')}`)
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
 * One staff's bars, cut into the stretches a beam may cross: same staff, same system line, all
 * painted. Everything else is a wall, and a bar behind a wall is a run of its own — it still needs
 * its in-bar groups computed.
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
      if (previous && (previous.line !== bar.line || !previous.drawn || !bar.drawn)) flush()
      current.push(bar)
    }
    flush()
  }

  return runs
}
