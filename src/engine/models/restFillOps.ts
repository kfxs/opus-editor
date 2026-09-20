/**
 * ⭐ **THE REST FILL — every voice of every staff sums to its bar.** {@link fillGapsWithRests} finds
 * the holes in a measure, per staff and per voice, and fills them with engraving-correct rests;
 * {@link pushRestSlot} is the one place a filler rest is minted. Score logic, moved off
 * `ScoreModel` (docs/code-shape-plan-2026-09-19.md, Phase 4.3b) — it was the callback every `*Deps`
 * bundle asked for (`RebarDeps`, `VoiceDeps`, `tupletOps.deleteTuplet`), and they import it now.
 *
 * ⚠️ Division of labour: WHICH rests span a gap is `utils/restFill`'s `fillRests` — meter-aware and
 * deliberately tuplet-UNAWARE. What is here is the part that knows the measure: the lanes (a staff,
 * then a voice, each an independent stream), and the tuplets — a gap that starts inside a tuplet's
 * span is the tuplet's own time (`tupletOps.refillTupletRemainder` fills it), and a gap that runs
 * into a later tuplet is trimmed at its start.
 *
 * ⛔ Not here: `ScoreModel.fillGapWithRests` (singular), the legacy float splitter — it goes through
 * `addRest`, i.e. note entry, and moves with that.
 */
import type { Fraction, Measure, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { slotLength, writtenLength } from '@/utils/durations'
import { fracAdd, fracCompare, fracCreate, fracGt, fracGte, fracLt, fracLte, fracToNumber } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { getMeterInfo } from '@/utils/meter'
import { tupletSpan } from '@/utils/musicUtils'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { v4 as uuidv4 } from 'uuid'
import { matchesStaff } from './staffContent'

/**
 * Materialise a {@link RestSlot} produced by `fillRests` into a measure slot.
 * Measure rests store the true bar length as `actualDuration` (the `duration`
 * stays `'w'`); the voice is only recorded when non-default.
 */
export function pushRestSlot(measure: Measure, rest: RestSlot, voice: number, staffId?: string): void {
  const slot: Rest = {
    id: uuidv4(),
    type: 'rest',
    duration: rest.duration,
    measure: measure.number,
    beat: rest.beat,
    actualDuration: rest.isMeasureRest ? measureCapacityFrac(measure) : writtenLength(rest),
  }
  if (rest.dots) slot.dots = rest.dots
  if (rest.isMeasureRest) slot.isMeasureRest = true
  if (voice !== 0) slot.voice = voice as 0 | 1 | 2 | 3
  // Multi-staff: filler rests belong to the staff whose gap they fill. The first staff
  // uses an absent staffId (the N=1 convention), so single-staff output is unchanged.
  if (staffId !== undefined) slot.staffId = staffId
  measure.slots.push(slot)
}

/**
 * Fill gaps in a measure with engraving-correct rests, per voice.
 *
 * Each voice (defaulting to 0) is an independent rhythmic stream that must sum
 * to the bar length, so gaps are found and filled per voice. Within a voice,
 * tuplet spans are skipped and gaps are trimmed at tuplet boundaries — that
 * tuplet-awareness stays here; the meter-aware decomposition is delegated to
 * the tuplet-unaware {@link fillRests}.
 */
export function fillGapsWithRests(score: Score, measure: Measure): void {
  const meter = getMeterInfo(measure.timeSignature)
  const barEnd = measureCapacityFrac(measure)
  const tuplets = measure.tuplets || []

  // Partition by STAFF before voice (multi-staff): each staff is an independent
  // rest-fill lane, exactly like each voice — a note on staff 2 must not suppress the
  // rest-fill of staff 1's own stream. `match` selects the lane's slots; `stamp` is put
  // on its filler rests. The first staff stamps `undefined` (the absent-staffId = staff 0
  // convention), so a single-staff score is byte-identical to the pre-multi-staff model.
  const staves = score.staves ?? []
  const staffLanes: Array<{ match: string | undefined; stamp: string | undefined }> =
    staves.length > 0
      ? staves.map((s, i) => ({ match: s.id, stamp: i === 0 ? undefined : s.id }))
      : [{ match: undefined, stamp: undefined }]

  // The measure header is logged lazily — only once, and only if some lane/voice
  // actually has a gap to fill. A bar with nothing to do stays silent.
  let headerLogged = false
  const logHeaderOnce = () => {
    if (headerLogged) return
    headerLogged = true
    dbg(`[Model.fillGaps] m${measure.number} barLen=${fracToNumber(barEnd).toFixed(3)} TS=${measure.timeSignature.numerator}/${measure.timeSignature.denominator} staves=${staffLanes.length}`)
  }

  for (let laneIndex = 0; laneIndex < staffLanes.length; laneIndex++) {
    const lane = staffLanes[laneIndex]
    const laneSlots = measure.slots.filter(slot => matchesStaff(slot.staffId, lane.match, score))
    const laneTuplets = tuplets.filter(tuplet => matchesStaff(tuplet.staffId, lane.match, score))

    // Distinct voices present in THIS staff (always include voice 0 so an empty bar fills).
    const voices = new Set<number>([0])
    for (const slot of laneSlots) voices.add(voiceOf(slot))

    for (const voice of voices) {
      const voiceSlots = laneSlots
        .filter(slot => voiceOf(slot) === voice)
        .sort((a, b) => fracCompare(a.beat, b.beat))

      // Only this staff+voice's tuplets may govern its gaps. A tuplet's voice is
      // derived from its member slots (a tuplet is a single-voice run), so a
      // voice-0 triplet must not block the rest-fill of an empty voice-1 bar.
      const voiceTuplets = laneTuplets.filter(tuplet => {
        const slot = laneSlots.find(s => s.tupletId === tuplet.id)
        return (slot?.voice ?? 0) === voice
      })

      // Find gaps in this voice's stream.
      const gaps: Array<{ start: Fraction; end: Fraction }> = []
      let currentBeat: Fraction = fracCreate(0, 1)
      for (const slot of voiceSlots) {
        if (fracLt(currentBeat, slot.beat)) {
          gaps.push({ start: currentBeat, end: slot.beat })
        }
        const slotDurFrac = slotLength(slot)
        currentBeat = fracAdd(slot.beat, slotDurFrac)
      }
      if (fracLt(currentBeat, barEnd)) {
        gaps.push({ start: currentBeat, end: barEnd })
      }

      // Skip gaps that start inside a tuplet's span (the tuplet owns that time).
      const filteredGaps = gaps.filter(gap => {
        for (const tuplet of voiceTuplets) {
          const tupletEndFrac = fracAdd(
            tuplet.startBeat,
            tupletSpan(tuplet),
          )
          if (fracGte(gap.start, tuplet.startBeat) && fracLt(gap.start, tupletEndFrac)) {
            return false
          }
        }
        return true
      })

      // Only log a voice that actually has gaps — "gaps=none" lines are pure noise.
      if (filteredGaps.length) {
        logHeaderOnce()
        const gapStr = filteredGaps.map(g => `[${fracToNumber(g.start).toFixed(3)}→${fracToNumber(g.end).toFixed(3)}]`).join(' ')
        dbg(`[Model.fillGaps]   staff${laneIndex} v${voice}: ${voiceSlots.length} existing slot(s), gaps=${gapStr}`)
      }

      for (const gap of filteredGaps) {
        let adjustedEnd = gap.end
        // Trim a gap that runs into a later tuplet so fillRests never spans one.
        for (const tuplet of voiceTuplets) {
          if (fracGt(tuplet.startBeat, gap.start) && fracLt(tuplet.startBeat, adjustedEnd)) {
            adjustedEnd = tuplet.startBeat
          }
        }
        if (fracLte(adjustedEnd, gap.start)) continue

        for (const rest of fillRests(gap.start, adjustedEnd, meter)) {
          pushRestSlot(measure, rest, voice, lane.stamp)
          const dots = rest.dots ? '.'.repeat(rest.dots) : ''
          dbg(`[Model.fillGaps]     fill staff${laneIndex} v${voice} REST ${rest.duration}${dots} @b${fracToNumber(rest.beat).toFixed(3)}${rest.isMeasureRest ? ' [measure-rest]' : ''}`)
        }
      }
    }
  }
}
