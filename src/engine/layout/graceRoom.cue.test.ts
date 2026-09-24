import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace } from '@/engine/models/graceOps'
import { setCue } from '@/engine/models/cueOps'
import { graceGroupScale, graceLayout, graceScale, withGraceGroupScale } from './graceRoom'
import { resetCueSize, setGraceCueSize } from './cueSize'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * Subject: `./graceRoom` — a CUE grace group's size (cue-size-plan C4, P4a): the cue-grace preset when EVERY
 * grace is cue, else the grace size; laid out at it; and the SCOPE that hands it to every helper.
 */
describe('graceRoom — cue graces', () => {
  afterEach(() => resetCueSize())

  /** A host with two graces before it; `cue` says which are cue. */
  const build = (cue: [boolean, boolean]) => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const graces = [0, 1].map(() => addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!)
    setCue(model.getScore(), graces.filter((_, i) => cue[i]).map(g => g.pitches[0].id), true)
    return (model.getScore().measures[0].slots.find(s => s.type === 'chord') as Chord).graceBefore!
  }

  it('⭐ an ALL-cue group is the cue-grace size — `multiply`: 2/3 × ¾ = ½', () => {
    expect(graceGroupScale(build([true, true]))).toBeCloseTo(0.5, 10)
  })

  it('⛔ a MIXED group keeps the grace size (one size per group, as a beam)', () => {
    expect(graceGroupScale(build([true, false]))).toBeCloseTo(2 / 3, 10)
    expect(graceGroupScale(build([false, false]))).toBeCloseTo(2 / 3, 10)
  })

  it('⭐ the preset reaches it: `graceWins` draws a cue grace at the grace size', () => {
    setGraceCueSize('graceWins')
    expect(graceGroupScale(build([true, true]))).toBeCloseTo(2 / 3, 10)
  })

  it('⭐ the layout is at the group’s size: each head ¾ as wide as a plain grace’s', () => {
    const plain = graceLayout(build([false, false]), () => null, 'treble', 0)
    const cue = graceLayout(build([true, true]), () => null, 'treble', 0)
    expect(cue.places[0].headWidth / plain.places[0].headWidth).toBeCloseTo(0.75, 10)
    expect(cue.reach).toBeLessThan(plain.reach)
  })

  it('⭐ the SCOPE: `graceScale()` answers the group’s size inside, the armed size after — nested too', () => {
    const cue = build([true, true])
    const plain = build([false, false])
    expect(graceScale()).toBeCloseTo(2 / 3, 10)
    withGraceGroupScale(cue, () => {
      expect(graceScale()).toBeCloseTo(0.5, 10)
      withGraceGroupScale(plain, () => expect(graceScale()).toBeCloseTo(2 / 3, 10))
      expect(graceScale()).toBeCloseTo(0.5, 10)
    })
    expect(graceScale()).toBeCloseTo(2 / 3, 10)
    expect(() => withGraceGroupScale(cue, () => { throw new Error('x') })).toThrow()
    expect(graceScale(), 'restored after a throw').toBeCloseTo(2 / 3, 10)
  })
})
