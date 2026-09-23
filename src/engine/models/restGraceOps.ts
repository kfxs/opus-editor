/**
 * ⭐ **GRACES ON RESTS** — D7 REVERSED (his call, 2026-09-22): *"attach the grace to the rest and when
 * the rest is changed for a note reattach the grace"*. The user enters the grace FIRST, on an empty
 * bar, and the note after it (`docs/plans/grace-notes-plan.md` D7).
 *
 * Two rules, both his:
 *
 * 1. **A grace names a BEAT, so it cannot hang on a whole-bar rest** — *"grace in empty measure makes
 *    no sense"*. Stamping one on a measure rest first turns that rest into a ONE-BEAT rest at the
 *    clicked beat, the rest of the bar refilled by the meter as everywhere else ({@link beatRestAt}).
 * ⭐ Both hold for a rest's BRACKETED graces too (B10 reversed, his report 2026-09-23 —
 *    `docs/plans/bracketed-grace-plan.md`): they ride the same hand-over.
 * 2. **When a slot takes the rest's place at the same beat, the group MOVES onto it** — a note (the
 *    point of it all) or another rest (the rest-fill's churn). {@link takeRestGraces} +
 *    {@link rehomeRestGraces}, called by `slotPlacementOps.evictRestsOverlapping` beside the tie it
 *    already migrates. ⚠️ Where NOTHING starts at that beat any more (a note entered earlier now
 *    covers it), the group is DROPPED and logged: it belonged to a moment that no longer begins
 *    anything — a default, his to change.
 */
import type { BracketedGrace, Fraction, GraceGroup, Measure, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { fracAdd, fracCompare, fracCreate, fracDiv, fracMul, fracToNumber } from '@/utils/fraction'
import { getMeterInfo } from '@/utils/meter'
import { decomposeSpan } from '@/utils/restFill'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { writtenLength } from '@/utils/durations'
import { findSlot } from './slotLookup'
import { fillGapsWithRests } from './restFillOps'

/**
 * ⭐ Rule 1 — the rest a grace stamped at `beat` hangs on. A MEASURE rest is replaced by a one-beat rest
 * at the beat the click falls in (the meter's felt beat: a quarter in 4/4, a dotted quarter in 6/8),
 * and the bar is refilled around it; any other rest is returned as it is.
 * @returns the rest to hang the grace on, or undefined when `restId` is not a rest.
 */
export function beatRestAt(score: Score, restId: string, beat: Fraction): Rest | undefined {
  const found = findSlot(score, restId)
  if (found?.type !== 'rest') return undefined
  const rest = found.rest
  if (!rest.isMeasureRest) return rest
  const measure = score.measures.find(m => m.number === rest.measure)
  if (!measure) return rest

  const meter = getMeterInfo(measure.timeSignature)
  const capacity = measureCapacityFrac(measure)
  const index = Math.max(0, Math.floor(fracToNumber(fracDiv(beat, meter.beatUnit))))
  let start = fracMul(meter.beatUnit, fracCreate(index, 1))
  if (fracCompare(start, capacity) >= 0) start = fracCreate(0, 1)
  let end = fracAdd(start, meter.beatUnit)
  if (fracCompare(end, capacity) > 0) end = capacity
  const [segment] = decomposeSpan(start, end, meter)
  if (!segment) return rest

  const beatRest: Rest = {
    id: rest.id, // ⭐ the SAME id: the stamp named it, and the selection may be holding it
    type: 'rest',
    beat: start,
    duration: segment.duration,
    measure: rest.measure,
    actualDuration: writtenLength(segment),
  }
  if (segment.dots) beatRest.dots = segment.dots
  if (rest.voice) beatRest.voice = rest.voice
  if (rest.staffId !== undefined) beatRest.staffId = rest.staffId
  measure.slots = measure.slots.filter(s => s !== rest)
  measure.slots.push(beatRest)
  fillGapsWithRests(score, measure)
  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  dbg(`[restGraceOps.beatRestAt] m${measure.number}: measure rest → ${segment.duration}${'.'.repeat(segment.dots)} rest at b${fracToNumber(start).toFixed(3)} (the grace's beat)`)
  return beatRest
}

/** A rest's grace group — and its BRACKETED graces (B10 reversed) — taken off it while the rest
 *  leaves, with the address they belonged to. */
export interface OrphanGraces {
  beat: Fraction
  voice: number
  staffId: string | undefined
  group?: GraceGroup
  bracketed?: BracketedGrace[]
}

/** Take the graces (and bracketed graces) off rests that are about to leave the bar. */
export function takeRestGraces(rests: readonly Rest[]): OrphanGraces[] {
  const out: OrphanGraces[] = []
  for (const rest of rests) {
    if (!rest.graceBefore && !rest.bracketedBefore) continue
    out.push({
      beat: rest.beat, voice: voiceOf(rest), staffId: rest.staffId,
      ...(rest.graceBefore && { group: rest.graceBefore }),
      ...(rest.bracketedBefore && { bracketed: rest.bracketedBefore }),
    })
    delete rest.graceBefore
    delete rest.bracketedBefore
  }
  return out
}

/**
 * ⭐ Rule 2 — hang each orphaned group on the slot that now STARTS at its beat, in its voice and staff:
 * a chord (the note that replaced the rest) or a rest. A slot with a group of its own keeps it (one
 * group per side); a beat nothing starts at any more drops the group, logged.
 */
export function rehomeRestGraces(measure: Measure, orphans: readonly OrphanGraces[]): void {
  for (const orphan of orphans) {
    const home = measure.slots.find(s =>
      fracCompare(s.beat, orphan.beat) === 0 && voiceOf(s) === orphan.voice && s.staffId === orphan.staffId)
    const at = `m${measure.number} b${fracToNumber(orphan.beat).toFixed(3)}`
    if (orphan.group) {
      if (home && !home.graceBefore) {
        home.graceBefore = orphan.group
        dbg(`[restGraceOps.rehome] ${at}: the grace moves onto the ${home.type}`)
      } else {
        dbg(`[restGraceOps.rehome] ⚠️ ${at}: ${home ? 'the slot there has its own grace' : 'nothing starts at that beat any more'} — the grace is DROPPED`)
      }
    }
    // ⭐ …and the BRACKETED graces by the same rule (B10 reversed, bracketed-grace-plan).
    if (orphan.bracketed) {
      if (home && !home.bracketedBefore) {
        home.bracketedBefore = orphan.bracketed
        dbg(`[restGraceOps.rehome] ${at}: the bracketed grace(s) move onto the ${home.type}`)
      } else {
        dbg(`[restGraceOps.rehome] ⚠️ ${at}: ${home ? 'the slot there has its own' : 'nothing starts at that beat any more'} — the bracketed grace(s) are DROPPED`)
      }
    }
  }
}
