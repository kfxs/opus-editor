import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addBracketed } from '@/engine/models/bracketedGraceOps'
import { measureColumns } from './measureColumns'
import { BRACKETED_ROWS, bracketedAfterLayout, hostRightReach } from './bracketedRoom'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./measureColumns` — a chord's bracketed graces AFTER it are its RIGHT ink (bracketed-grace-plan
 * P5): the layout's reach, plus the air it keeps from what follows.
 */
describe('measureColumns — the after side\'s room', () => {
  it('⭐ one box from its first bracket to its last, plus `afterToNext` — the same layout the drawing reads', () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const made = addBracketed(model.getScore(), a.id, 'after', { step: 'D', alter: 0, octave: 5 })!
    const box = measureColumns(model.getMeasure(1)!)[0].ink.find(b => b.kind === 'grace')!
    const f = model.getScore().measures[0].slots[0]
    const layout = bracketedAfterLayout([made], () => null, 'treble', hostRightReach(f.type === 'chord' ? f : ({} as never), 'treble'))
    expect(box.right).toBeCloseTo(layout.reach + BRACKETED_ROWS.afterToNext.value, 9)
    expect(-box.left).toBeCloseTo(layout.places[0].left, 9)
  })

  it('⭐ after a FLAGGED stem-up eighth it starts past the flag', () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'G', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    addBracketed(model.getScore(), a.id, 'after', { step: 'A', alter: 0, octave: 4 })
    const [first] = measureColumns(model.getMeasure(1)!)
    const flag = first.ink.find(b => b.kind === 'flag')!
    const box = first.ink.find(b => b.kind === 'grace')!
    expect(-box.left).toBeGreaterThan(flag.right)
  })
})
