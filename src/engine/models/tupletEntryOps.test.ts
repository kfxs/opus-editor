/**
 * MAKING A TUPLET OUT OF AN ENTRY — {@link buildTupletWithFirstNote}, {@link applyTupletToNote},
 * the guard they share ({@link tupletFitsBar}), and entering INTO a tuplet: the keyboard's
 * {@link clampToTupletRemainder} and the mouse's {@link landInTuplet}. Through a real `ScoreModel`.
 *
 * The fit chapter came from `NoteEntryCoordinator.test.ts` with the module (code-shape plan, Phase
 * 4.2d). ⚠️ That spec's other tuplet chapters stay there: they drive the coordinator's own public
 * entry (`createTupletAtBeat` + `addNoteAtBeat` together), which is still its API.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { durationToFraction } from '@/utils/durations'
import { applyTupletToNote, buildTupletWithFirstNote, clampToTupletRemainder, landInTuplet, tupletFitsBar } from './tupletEntryOps'

const C5 = { step: 'C', alter: 0, octave: 5 } as const

describe('a tuplet must fit the bar', () => {
  let scoreModel: ScoreModel

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
  })

  const barBeats = (measure: number) =>
    scoreModel.getMeasure(measure)!.slots.reduce(
      (acc, sl) => acc + fracToNumber(sl.actualDuration ?? durationToFraction(sl.duration, sl.dots ?? 0)), 0)

  it('REFUSES a triplet of halves at beat 2 of 4/4 — it needs 4 beats and 2 remain (reported)', () => {
    // Reported bar: A3 q@0, rest q@1, then a triplet of halves toggled onto the rest at beat 2. Its
    // span runs to beat 6 and the bar summed to SIX beats in 4/4.
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(2, 1), isRest: true })
    expect(applyTupletToNote(scoreModel, rest.id, 3, 2)).toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets ?? []).toHaveLength(0)
  })

  it('leaves the bar exactly full when it refuses', () => {
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(2, 1), isRest: true })
    applyTupletToNote(scoreModel, rest.id, 3, 2)
    scoreModel.repairAllMeasureGaps() // throws under Vitest if the bar is malformed
    expect(barBeats(1)).toBe(4)
  })

  it('ALLOWS a triplet of quarters at beat 2 of 4/4 — 2 beats, and 2 remain', () => {
    const rest = scoreModel.addNote({ duration: 'q', measure: 1, beat: frac(2, 1), isRest: true })
    const result = applyTupletToNote(scoreModel, rest.id, 3, 2)
    expect(result).not.toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets).toHaveLength(1)
  })

  it('ALLOWS a triplet of halves at beat 0 — the whole bar is exactly its span', () => {
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(0, 1), isRest: true })
    expect(applyTupletToNote(scoreModel, rest.id, 3, 2)).not.toBeNull()
  })
})

describe('tupletFitsBar', () => {
  it('the SPAN is what counts, and ending exactly on the barline fits', () => {
    const model = new ScoreModel('T') // 4/4
    expect(tupletFitsBar(model, 1, frac(2, 1), frac(2, 1))).toBe(true)
    expect(tupletFitsBar(model, 1, frac(2, 1), frac(4, 1))).toBe(false)
    expect(tupletFitsBar(model, 9, frac(0, 1), frac(1, 1))).toBe(false) // no such bar
  })
})

describe('buildTupletWithFirstNote', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('T') })

  it('makes the group, places the first note in it, and fills the rest of its span', () => {
    const built = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)!
    expect(built.firstNote).toMatchObject({ step: 'C', tupletId: built.tuplet.id })
    const members = model.getNotesInTuplet(built.tuplet.id)
    expect(members.filter(n => !n.isRest)).toHaveLength(1)
    expect(members.some(n => n.isRest)).toBe(true)
    model.repairAllMeasureGaps() // the bar is exactly full
  })

  it('a note already standing at the start becomes a CHORD with the new one', () => {
    const was = model.addNote({ step: 'A', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    const built = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)!
    const heads = model.getNotesInTuplet(built.tuplet.id).filter(n => !n.isRest).map(n => n.step).sort()
    expect(heads).toEqual(['A', 'C'])
    expect(model.getNote(was.id)).toBeFalsy() // re-added: the old head's id is gone
  })

  it('null — and nothing written — when it overlaps a same-voice tuplet or does not fit', () => {
    buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)
    const before = JSON.stringify(model.getScore())
    expect(buildTupletWithFirstNote(model, 1, 0.5, '8', C5, 3, 2)).toBeNull() // overlaps
    expect(buildTupletWithFirstNote(model, 1, 2, 'h', C5, 3, 2)).toBeNull()   // 4 beats from beat 2
    expect(JSON.stringify(model.getScore())).toBe(before)
  })

  it('another VOICE may hold its own tuplet over the same beats', () => {
    buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)
    expect(buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2, 1)).not.toBeNull()
  })
})

describe('applyTupletToNote', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('T') })

  it('the note becomes the group\'s first member, in its own voice and staff', () => {
    const note = model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), voice: 1 })
    const { tuplet, note: first } = applyTupletToNote(model, note.id)!
    expect(first).toMatchObject({ step: 'E', tupletId: tuplet.id, voice: 1 })
    expect(fracToNumber(first.beat)).toBe(0)
  })

  it('a REST gives an empty group — its filler rest is what comes back', () => {
    const rest = model.addNote({ duration: 'q', measure: 1, beat: frac(0, 1), isRest: true })
    const { tuplet, note } = applyTupletToNote(model, rest.id)!
    expect(note).toMatchObject({ isRest: true, tupletId: tuplet.id })
  })

  it('null for a note already in a tuplet, or an id that names nothing', () => {
    const built = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)!
    expect(applyTupletToNote(model, built.firstNote.id)).toBeNull()
    expect(applyTupletToNote(model, 'gone')).toBeNull()
  })
})

describe('entering INTO a tuplet', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('T') })

  const params = (duration: 'q' | '8' | 'h', beatNum: number, beatDen = 1) =>
    ({ ...C5, duration, measure: 1, beat: frac(beatNum, beatDen) })

  it('the KEYBOARD clamps the written length to what the group has left', () => {
    const { tuplet } = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)! // eighth triplet, beats 0–1
    expect(clampToTupletRemainder(params('8', 1, 3), tuplet)).toMatchObject({ duration: '8' }) // fits: unchanged
    expect(clampToTupletRemainder(params('h', 1, 3), tuplet)).toMatchObject({ duration: 'q', dots: 0 })
    expect(clampToTupletRemainder(params('h', 2, 3), tuplet)).toMatchObject({ duration: '8', dots: 0 })
  })

  it('the MOUSE lands the note at the FILL POINTER — the end of the last real note', () => {
    const { tuplet } = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)!
    const landing = landInTuplet(model, 1, tuplet, '8')!
    expect(landing.tupletId).toBe(tuplet.id)
    expect(landing.beat).toEqual(frac(1, 3))
  })

  it('…null when what is left cannot hold it', () => {
    const { tuplet, firstNote } = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)!
    model.addNote({ ...C5, duration: '8', measure: 1, beat: frac(1, 3), tupletId: tuplet.id, actualDuration: firstNote.actualDuration })
    expect(landInTuplet(model, 1, tuplet, 'q')).toBeNull() // 1/3 left, a quarter sounds 2/3
  })

  it('⚠️ a note LARGER than the whole group deletes the tuplet and lands at its start, plain', () => {
    const { tuplet } = buildTupletWithFirstNote(model, 1, 0, '8', C5, 3, 2)! // spans ONE beat
    const landing = landInTuplet(model, 1, tuplet, 'h')!
    expect(landing.tupletId).toBeUndefined()
    expect(landing.beat).toEqual(tuplet.startBeat)
    expect(model.getMeasure(1)!.tuplets ?? []).toHaveLength(0)
  })
})
