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

import type { ChordRest, NoteDuration } from '@/types/music'
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

  const flush = () => {
    if (current.length >= 2) groups.push(current)
    current = []
    currentBeatGroup = null
    isForced = false
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
      // Bridge across a beat boundary — override normal grouping rules.
      if (current.length > 0) {
        current.push(i)
      } else {
        // Orphaned continue (no preceding group) — start one.
        current = [i]
        isForced = true
      }
      currentBeatGroup = getBeatGroup(slot.beat, meter)
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
      if (currentBeatGroup === null || beatGroup === currentBeatGroup) {
        current.push(i)
        currentBeatGroup = beatGroup
      } else {
        flush()
        current = [i]
        currentBeatGroup = beatGroup
      }
    }
  }

  flush()
  return groups
}
