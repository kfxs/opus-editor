/**
 * Pure beam-grouping logic.
 *
 * Decides which consecutive notes are beamed together, driven by the meter's
 * metric hierarchy ({@link MeterInfo}) plus any explicit per-note {@link BeamMode}
 * overrides. The renderer (`VexFlowRenderer`) maps the returned slot-index groups
 * onto its VexFlow `StaveNote`s; nothing here depends on VexFlow or the DOM, so
 * the grouping is unit-testable in isolation.
 *
 * Default grouping follows the meter's primary beat groups ("show each beat"):
 * 4/4 beams per quarter, 6/8 → 3+3 eighths, 9/8 → 3+3+3, 7/8 → 2+2+3, etc.
 * Beaming never depends on clef — a beam group may span a mid-measure clef
 * change (see docs/note-selection-hit-detection.md companion decision).
 *
 * Pure: depends only on `fraction.ts`, the metric structure, and the types.
 */

import type { BeamMode, ChordRest, NoteDuration } from '@/types/music'
import { type Fraction, fracCreate, fracAdd, fracLt, fracSub, fracToNumber } from '@/utils/fraction'
import type { MeterInfo } from '@/utils/meter'

/** A duration is beamable iff it is an eighth note or shorter. */
export function isBeamableDuration(duration: NoteDuration): boolean {
  return duration === '8' || duration === '16' || duration === '32'
}

/**
 * Return which primary beat-group a note at `beat` (quarter-note units) falls
 * into, per the meter's metric hierarchy. Beams break between groups.
 *
 * The bar is partitioned by the cumulative starts of `meter.groups`; a beat is
 * in group `i` when `groupStart[i] ≤ beat < groupStart[i+1]`. Notes past the bar
 * end (over-full bars rendered crowded under SOFT) get a distinct index per
 * overflow quarter so they aren't merged into the final in-bar group.
 */
export function getBeatGroup(beat: Fraction, meter: MeterInfo): number {
  let start = fracCreate(0, 1)
  for (let i = 0; i < meter.groups.length; i++) {
    const next = fracAdd(start, meter.groups[i])
    if (fracLt(beat, next)) return i
    start = next
  }
  // beat ≥ barQuarters (start now equals the bar end): one index per overflow quarter.
  return meter.groups.length + Math.floor(fracToNumber(fracSub(beat, start)))
}

/**
 * Partition `slots` (sorted by beat) into beam groups, returning the slot
 * indices in each group. Only groups of ≥ 2 beamable notes are returned;
 * everything else (rests, quarters-and-longer, lone eighths) is left unbeamed.
 *
 * Rules:
 *   - Rests and non-beamable durations break the current group.
 *   - Explicit {@link BeamMode} on a slot overrides the default grouping:
 *     `'single'` forces no beam; `'begin'`/`'continue'`/`'end'` build a manual
 *     group that ignores beat boundaries (lets a beam bridge across them).
 *   - Otherwise notes beam together while they share a {@link getBeatGroup}.
 */
export function computeBeamGroups(slots: ChordRest[], meter: MeterInfo): number[][] {
  const groups: number[][] = []
  let current: number[] = []
  let currentBeatGroup: number | null = null
  let isForced = false // true when group was started by an explicit 'begin'/'continue'
  /**
   * Set by `'continue'`: the NEXT note joins this group whatever beat it falls in.
   *
   * A note marked `continue` has a beam coming in and a beam going out — that is what the word
   * means, and what MusicXML means by it. Without this flag `continue` only removed the break
   * BEHIND the note, so it appeared to work on the first note of a group (whose boundary is behind
   * it) and did nothing at all on the last note of a group (whose boundary is in front). Same mark,
   * same bar, two different outcomes decided by where the note happened to sit.
   */
  let bridgeNext = false

  const flush = () => {
    if (current.length >= 2) groups.push(current)
    current = []
    currentBeatGroup = null
    isForced = false
    bridgeNext = false
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]

    // Rests always break beams (can't beam silence).
    if (slot.type === 'rest') { flush(); continue }

    // Non-beamable durations (quarter and above) always break beams.
    if (!isBeamableDuration(slot.duration)) { flush(); continue }

    const beam = slot.beam // BeamMode | undefined

    if (beam === 'single') {
      // Force no beam — flush current group, skip this note.
      flush()
      continue
    }

    if (beam === 'begin') {
      // Start a new explicit group (flush any current one first).
      flush()
      current = [i]
      currentBeatGroup = getBeatGroup(slot.beat, meter)
      isForced = true
      continue
    }

    if (beam === 'continue') {
      // Bridge across a beat boundary — override normal grouping rules. BOTH sides: joining the run
      // behind is the `current.push` below, and the break in front is removed by `bridgeNext`.
      if (current.length > 0) {
        current.push(i)
      } else {
        // Orphaned continue (no preceding group) — start one.
        current = [i]
        isForced = true
      }
      currentBeatGroup = getBeatGroup(slot.beat, meter)
      bridgeNext = true
      continue
    }

    if (beam === 'end') {
      // Close the current group after adding this note.
      if (current.length > 0) {
        current.push(i)
      } else {
        // Orphaned end — emit a single-note group (dropped by flush's min-2 check).
        current = [i]
      }
      flush()
      continue
    }

    // beam === undefined/'auto' — use standard beat-boundary logic.
    if (isForced) {
      // Inside a forced group (between begin and a future end) — add without boundary check.
      current.push(i)
      currentBeatGroup = getBeatGroup(slot.beat, meter)
    } else {
      const beatGroup = getBeatGroup(slot.beat, meter)
      // `bridgeNext` spends itself here: the note right after a `continue` joins across the boundary,
      // and then normal grouping resumes from ITS beat group — so marking one note continue bridges
      // exactly one boundary, not every boundary to the end of the bar.
      if (currentBeatGroup === null || beatGroup === currentBeatGroup || bridgeNext) {
        current.push(i)
        currentBeatGroup = beatGroup
      } else {
        flush()
        current = [i]
        currentBeatGroup = beatGroup
      }
      bridgeNext = false
    }
  }

  flush()
  return groups
}

/**
 * Translate the slots of ONE beam group into the indices VexFlow's `Beam.breakSecondaryAt` wants.
 *
 * Two conventions meet here, which is the whole reason this is a named function and not an inline
 * `.map`. Ours: the `secondaryBreak` flag sits on the note that STARTS the new group — the break is
 * in front of it, the reading `begin` already has. VexFlow's: the index it is given is the note the
 * secondary beam ENDS AFTER. So a break in front of `i` is a break at `i - 1`.
 *
 * A flag on the group's first note has nothing in front of it to break, and is dropped.
 */
export function secondaryBreakIndices(groupSlots: ChordRest[]): number[] {
  const indices: number[] = []
  for (let i = 1; i < groupSlots.length; i++) {
    const slot = groupSlots[i]
    if (slot.type === 'chord' && slot.secondaryBreak) indices.push(i - 1)
  }
  return indices
}

/**
 * Where a note ACTUALLY sits in its beam, once {@link computeBeamGroups} has run.
 *
 * The four values are `BeamMode` minus `'auto'` — deliberately. `auto` is not a role a note can be
 * in; it is the absence of an authored choice, and every note, authored or not, ends up in exactly
 * one of these four.
 */
export type BeamRole = Exclude<BeamMode, 'auto'>

/**
 * The beam role of slot `index` — first of its group → `'begin'`, last → `'end'`, anywhere between
 * → `'continue'`, in no group at all → `'single'`.
 *
 * This is the OTHER half of what a beam palette has to say. The stored `beam` answers "did anyone
 * author this?" (`auto` = nobody did), which on four auto eighths beamed 2+2 tells you nothing about
 * the engraving — both notes report `auto` while one begins a beam and the other ends it. This
 * answers "what is it?", and the two can disagree: an orphaned `end` with nothing behind it is
 * authored `end` and engraved `single`, which is how you find out a mark did nothing.
 *
 * `slots` must be the run the renderer beams — ONE voice of ONE staff, sorted by beat — or the
 * indices refer to a grouping that was never engraved.
 */
export function beamRoleAt(slots: ChordRest[], meter: MeterInfo, index: number): BeamRole {
  for (const group of computeBeamGroups(slots, meter)) {
    const at = group.indexOf(index)
    if (at === -1) continue
    if (at === 0) return 'begin'
    return at === group.length - 1 ? 'end' : 'continue'
  }
  return 'single'
}
