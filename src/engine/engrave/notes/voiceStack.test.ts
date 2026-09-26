/**
 * How the voices of one column make room for each other. ⚠️ Exactness against `StaveNote.format` was
 * proved once — per note on 20,000 random columns, and on the rendered page of 60 random multi-voice
 * scores (S9g, `docs/history/vexflow-removal-map.md` §5.2); pinned here is the rule, quirks included.
 */
import { describe, it, expect } from 'vitest'
import { type ColumnVoiceNote, VOICE_SIDE_STEP_PAD_PX, stackVoices } from './voiceStack'

const note = (over: Partial<ColumnVoiceNote> = {}): ColumnVoiceNote => ({
  bottomLine: 3, topLine: 3, isRest: false, restAscentPx: 0, restDescentPx: 0,
  stemDirection: 1, stemLengthPx: 35, voiceShiftPx: 10, drawn: true, hasStem: true, hasBeam: false,
  duration: 'q', bottomHeadCode: 'X', topHeadCode: 'X', firstKeyDots: 0, styleKey: '{}', voiceKey: 'a',
  ...over,
})
const at = (line: number, over: Partial<ColumnVoiceNote> = {}) => note({ bottomLine: line, topLine: line, ...over })
const rest = (line: number, over: Partial<ColumnVoiceNote> = {}) =>
  at(line, { isRest: true, hasStem: false, restAscentPx: 20, restDescentPx: 10, ...over })
const SIDE_STEP = 10 + VOICE_SIDE_STEP_PAD_PX

describe('stackVoices — two voices', () => {
  it('a note alone has nothing to make room for', () => {
    expect(stackVoices([note()], true)).toEqual({ steps: [], rightShift: 0 })
  })

  it('two rests of one duration draw ONCE', () => {
    expect(stackVoices([rest(3), rest(3)], true).steps).toEqual([{ kind: 'hide', note: 1 }])
  })

  it('a rest steps a line out of the way — up above, down below', () => {
    expect(stackVoices([rest(3), at(3)], true).steps).toEqual([{ kind: 'moveRest', note: 0, lines: 1 }])
    expect(stackVoices([at(4, { stemDirection: -1 }), rest(3, { stemDirection: -1 })], true).steps)
      .toEqual([{ kind: 'moveRest', note: 1, lines: -1 }])
  })

  it('⭐ two heads a SECOND apart stand side by side, and the column grows by the step', () => {
    const { steps, rightShift } = stackVoices([at(3.5), at(3, { stemDirection: -1 })], true)
    expect(steps).toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
    expect(rightShift).toBe(SIDE_STEP)
  })

  it('⭐ a unison of like heads SHARES one head — unless the unison row says no', () => {
    const pair = [at(3), at(3, { stemDirection: -1, voiceKey: 'b' })]
    expect(stackVoices(pair, true)).toEqual({ steps: [], rightShift: 0 })
    expect(stackVoices(pair, false).steps).toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
  })

  it('a unison of two voices stemmed the same way turns the lower stem down', () => {
    expect(stackVoices([at(3), at(3, { voiceKey: 'b' })], true).steps)
      .toEqual([{ kind: 'stem', note: 1, direction: -1 }])
  })

  it('⭐ stemless heads: the SHORTER note steps aside — by LENGTH, ⛔ no longer the codes as strings', () => {
    const stemless = { hasStem: false }
    // A quarter is longer than an eighth, so the LOWER (the eighth) moves; swap them and the upper does.
    expect(stackVoices([at(3, { ...stemless, duration: 'q' }), at(3, { ...stemless, duration: '8' })], true).steps)
      .toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
    expect(stackVoices([at(3, { ...stemless, duration: '8' }), at(3, { ...stemless, duration: 'q' })], true).steps)
      .toEqual([{ kind: 'xShift', note: 0, px: SIDE_STEP }])
  })

  it('⭐ a BREVE stays and the shorter note moves — as a whole note always did (other-durations P4)', () => {
    // As strings, the breve's '1/2' sorts before 'q' and 'w', so the BREVE would have moved.
    const breve = { hasStem: false, duration: '1/2' }
    expect(stackVoices([at(3, breve), at(3, { duration: 'q' })], true).steps)
      .toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
    expect(stackVoices([at(3, { duration: 'q' }), at(3, breve)], true).steps)
      .toEqual([{ kind: 'xShift', note: 0, px: SIDE_STEP }])
    // …and the whole note's answers are unchanged: the other note moves, two wholes move the lower.
    const whole = { hasStem: false, duration: 'w' }
    expect(stackVoices([at(3, whole), at(3, { duration: 'h' })], true).steps)
      .toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
    expect(stackVoices([at(3, whole), at(3, whole)], true).steps)
      .toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
  })

  it('⚠️ an upper voice stemmed down over a lower stemmed up becomes notes 1 and 0 — whichever drew', () => {
    // Notes 0 and 2 draw and would collide; the swap compares the UNDRAWN note 1 instead.
    const column = [at(3, { stemDirection: -1 }), at(10, { drawn: false }), at(3)]
    expect(stackVoices(column, true).steps).toEqual([])
  })
})

describe('stackVoices — three voices', () => {
  it('a middle rest with room between the others is CENTRED between them', () => {
    const rest1 = rest(3, { restAscentPx: 5, restDescentPx: 5 })
    const { steps } = stackVoices([at(4), rest1, at(1, { stemDirection: -1 })], true)
    // Halfway between the upper's reach (4) and the lower's (1) is 2.5: the rest moves 3 → 2.5.
    expect(steps).toEqual([{ kind: 'moveRest', note: 1, lines: -0.5 }])
  })

  it('⭐ a colliding middle voice steps aside, and the outer stems turn outward unless beamed', () => {
    const column = (lowerBeamed: boolean) =>
      [at(4), at(3.5), at(3, { stemDirection: -1, hasBeam: lowerBeamed })]
    const { steps, rightShift } = stackVoices(column(false), true)
    expect(steps).toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }, { kind: 'stem', note: 2, direction: -1 }])
    expect(rightShift).toBe(SIDE_STEP)
    expect(stackVoices(column(true), true).steps).toEqual([{ kind: 'xShift', note: 1, px: SIDE_STEP }])
  })

  it('three rests draw only the middle one', () => {
    expect(stackVoices([rest(3), rest(3), rest(3)], true).steps)
      .toEqual([{ kind: 'hide', note: 0 }, { kind: 'hide', note: 2 }])
  })
})
