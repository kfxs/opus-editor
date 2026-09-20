import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { clearNoteRange, type ClearRangeDeps } from './clearOps'
import { setEngravingOverride } from './overrideOps'
import { restPositionKey, restShiftOverrideOf } from './engravingOverrides'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { staffIndexOfId } from './staffContent'
import type { Note, NoteDuration, RestShiftOverride } from '@/types/music'

/**
 * Subject: `./clearOps` — WHAT SILENCE A CLEARED REGION LEAVES BEHIND.
 *
 * The sentence the module is: **the region you selected is emptied, and the METER decides the rests
 * that fill it.** So the assertions below are all of the same shape — clear a span, read back the
 * rests — and each one pins a different half of that sentence:
 *
 *  - the meter decides (a cleared 4/4 half-bar is ONE half rest, not the six-and-a-half rests the
 *    slots' own lengths would have given);
 *  - only the REGION (a rest already standing outside the selection bounds the hole and is never
 *    swallowed into it — his clarification of 2026-08-31, and the reason this is not "regroup the
 *    bar");
 *  - a single note is a range of one, so the same rule answers it.
 *
 * The deps are a real `ScoreModel` — the fill and the removal are the model's own machinery, and
 * stubbing them would test nothing — with `deleteOne` spied, since it is the one the module must
 * be shown to REFUSE to use except for the exception kinds. The slur re-anchor is asked of real
 * slurs: it is `slurOps`' own function now, not a callback.
 */

interface Spy {
  deleteOne: string[]
}

function depsFor(model: ScoreModel, spy: Spy): ClearRangeDeps {
  return {
    removeSlot: id => model.deleteNote(id),
    deleteOne: id => { spy.deleteOne.push(id); return model.deleteNote(id) },
  }
}

function newSpy(): Spy {
  return { deleteOne: [] }
}

/** `duration@beat` for every rest in bar 1's lane (voice 0, staff 0 unless asked otherwise). */
function restsIn(model: ScoreModel, opts: { voice?: number; staff?: number } = {}): string[] {
  const score = model.getScore()
  return score.measures[0].slots
    .filter(s => s.type === 'rest')
    .filter(s => voiceOf(s) === (opts.voice ?? 0))
    .filter(s => staffIndexOfId(score, s.staffId) === (opts.staff ?? 0))
    .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
    .map(s => `${s.duration}${'.'.repeat(s.dots ?? 0)}@${fracToNumber(s.beat)}`)
}

/** Put a note in bar 1 and hand back its flat projection. */
function put(
  model: ScoreModel,
  beat: number,
  duration: NoteDuration,
  extra: { dots?: number; voice?: 0 | 1 | 2 | 3; staff?: number; step?: 'C' | 'D' | 'E' | 'G' } = {},
): Note {
  return model.addNote({
    step: extra.step ?? 'C', octave: 4, duration, measure: 1,
    beat: frac(Math.round(beat * 4), 4),
    ...(extra.dots !== undefined && { dots: extra.dots }),
    ...(extra.voice !== undefined && { voice: extra.voice }),
    ...(extra.staff !== undefined && { staff: extra.staff }),
  })!
}

describe('clearNoteRange — the meter decides the silence', () => {
  it('fills a cleared 4/4 half-bar with ONE half rest, not the slots\' own lengths', () => {
    // ⭐ HIS REPORT, 2026-08-31: four sixteenths and an eighth across beats 3–4 came back as five
    // separate rests, because Delete was a loop and each slot replaced itself.
    const model = new ScoreModel('Clear')
    put(model, 0, 'h')
    const doomed = [put(model, 2, '8'), put(model, 2.5, '8'), put(model, 3, 'q')]

    clearNoteRange(model.getScore(), doomed.map(n => n.id), depsFor(model, newSpy()))

    expect(restsIn(model)).toEqual(['h@2'])
  })

  it('refuses a rest that would straddle a stronger beat inside it', () => {
    // The other half of "meter-aware": clearing beats 2–3 is TWO quarter rests, because a half rest
    // may not cross the middle of a 4/4 bar. The span is the same length as the case above.
    const model = new ScoreModel('Clear')
    put(model, 0, 'q')
    const doomed = [put(model, 1, 'q'), put(model, 2, 'q')]
    put(model, 3, 'q')

    clearNoteRange(model.getScore(), doomed.map(n => n.id), depsFor(model, newSpy()))

    expect(restsIn(model)).toEqual(['q@1', 'q@2'])
  })

  it('leaves a rest OUTSIDE the selection alone — the region is cleared, not the bar regrouped', () => {
    // ⛔ His clarification: *"no extra rest condensed if there are other rests outside the
    // selection"*. The untouched quarter rest at beat 2 bounds the hole; clearing beat 3 gives a
    // second quarter rest beside it, NOT one half rest covering both.
    const model = new ScoreModel('Clear')
    put(model, 0, 'h')
    const spare = put(model, 2, 'q')
    model.convertToRest(spare.id) // a rest that was already there, and is not selected
    const doomed = put(model, 3, 'q')

    clearNoteRange(model.getScore(), [doomed.id], depsFor(model, newSpy()))

    expect(restsIn(model)).toEqual(['q@2', 'q@3'])
  })

  it('answers a SINGLE note the same way — a range of one', () => {
    // A dotted quarter on the "and of 2" spans the middle of the bar. Its own length would put a
    // dotted-quarter rest across that boundary; the meter splits it.
    const model = new ScoreModel('Clear')
    put(model, 0, 'q')
    put(model, 1, '8')
    const doomed = put(model, 1.5, 'q', { dots: 1 })
    put(model, 3, 'q')

    clearNoteRange(model.getScore(), [doomed.id], depsFor(model, newSpy()))

    expect(restsIn(model)).toEqual(['8@1.5', 'q@2'])
  })

  it('fills each STAFF and VOICE of the region in its own lane', () => {
    // The rectangle, not the anchor cell: a clear that crosses staves and voices owes each lane its
    // own meter-correct fill, and no lane may be given silence that belongs to another.
    const model = new ScoreModel('Clear')
    model.addStaffBelow(0)
    put(model, 0, 'h', { staff: 0 })
    put(model, 0, 'h', { staff: 1, voice: 1 })
    put(model, 0, 'h', { staff: 1 })
    const doomed = [
      put(model, 2, 'h', { staff: 0 }),
      put(model, 2, 'h', { staff: 1, voice: 1 }),
      put(model, 2, 'q', { staff: 1 }),
      put(model, 3, 'q', { staff: 1 }),
    ]

    clearNoteRange(model.getScore(), doomed.map(n => n.id), depsFor(model, newSpy()))

    expect(restsIn(model, { staff: 0 })).toEqual(['h@2'])
    expect(restsIn(model, { staff: 1 })).toEqual(['h@2'])
    expect(restsIn(model, { staff: 1, voice: 1 })).toEqual(['h@2'])
  })

  it('re-anchors a cleared head onto the rest that replaced it', () => {
    const model = new ScoreModel('Clear')
    const kept = put(model, 0, 'h')
    const doomed = [put(model, 2, 'q'), put(model, 3, 'q')]
    for (const head of doomed) model.addSlur({ startNoteId: kept.id, endNoteId: head.id })

    clearNoteRange(model.getScore(), doomed.map(n => n.id), depsFor(model, newSpy()))

    // BOTH slurs now end on the ONE half rest that covers the span their heads shared.
    const restId = model.getScore().measures[0].slots.find(s => s.type === 'rest')!.id
    expect(model.getSlurs().map(s => s.endNoteId)).toEqual([restId, restId])
  })
})

describe('clearNoteRange — the hand-positioning goes with the content', () => {
  it('🚨 the refilled rest does NOT inherit the shift authored for what was cleared', () => {
    // His report, 2026-08-31: the Prelude lifts every bass-staff rest by hand, the lift is filed
    // under a POSITION, and the clear refilled that position — so the new half rest drew six steps
    // high, wearing a nudge authored for a 16th rest that had a half note above it.
    const model = new ScoreModel('Clear')
    const staffId = model.addStaffBelow(0)
    put(model, 0, 'h', { staff: 1 })
    const doomed = put(model, 2, 'h', { staff: 1 })
    const measureId = model.getMeasure(1)!.id
    const key = restPositionKey(measureId, 0, frac(2, 1), staffId)
    setEngravingOverride(model.getScore(), key, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    clearNoteRange(model.getScore(), [doomed.id], depsFor(model, newSpy()))

    expect(restsIn(model, { staff: 1 })).toEqual(['h@2']) // the fill happened…
    expect(restShiftOverrideOf(model.getScore(), key)).toBeUndefined() // …at its DEFAULT position
  })

  it('⛔ and leaves the shift on a rest the clear never reached', () => {
    const model = new ScoreModel('Clear')
    const staffId = model.addStaffBelow(0)
    const spare = put(model, 0, 'h', { staff: 1 })
    model.convertToRest(spare.id) // a lifted rest at beat 0, outside the selection
    const doomed = put(model, 2, 'h', { staff: 1 })
    const measureId = model.getMeasure(1)!.id
    const kept = restPositionKey(measureId, 0, frac(0, 1), staffId)
    setEngravingOverride(model.getScore(), kept, { kind: 'restShift', steps: 6 } as RestShiftOverride)

    clearNoteRange(model.getScore(), [doomed.id], depsFor(model, newSpy()))

    expect(restShiftOverrideOf(model.getScore(), kept)?.steps).toBe(6)
  })
})

describe('clearNoteRange — what is NOT a hole', () => {
  it('sends one head of a partly-selected chord to the ordinary single delete', () => {
    // The slot survives with its other head, so no time is freed and there is nothing to fill.
    const model = new ScoreModel('Clear')
    put(model, 0, 'h')
    const low = put(model, 2, 'h', { step: 'C' })
    model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    const spy = newSpy()

    clearNoteRange(model.getScore(), [low.id], depsFor(model, spy))

    expect(spy.deleteOne).toEqual([low.id])
    expect(restsIn(model)).toEqual([]) // the chord is still there, one head lighter
  })

  it('sends a TUPLET member to the ordinary single delete', () => {
    // `fillRests` is tuplet-unaware by design and the gap-filler skips a tuplet's span, so the
    // group must refill its own remainder — today's path, unchanged.
    const model = new ScoreModel('Clear')
    put(model, 0, 'h')
    const tuplet = model.createTuplet(1, frac(2, 1), 'q', 3, 2) // a quarter triplet over beats 3–4
    const member = model.addNote({
      step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1),
      tupletId: tuplet.id, actualDuration: frac(2, 3),
    })
    const spy = newSpy()

    clearNoteRange(model.getScore(), [member.id], depsFor(model, spy))

    expect(spy.deleteOne).toEqual([member.id])
  })
})
