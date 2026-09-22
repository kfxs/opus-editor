import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace } from '@/engine/models/graceOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import { keyboardCaretAt } from './keyboardCaret'

/** Bar 1: C (x 100) · E (x 200) with two graces before it (x 160, 176). */
function setup() {
  const model = new ScoreModel()
  const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  const e = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
  const score = model.getScore()
  const g1 = addGrace(score, e.id, 'before', { step: 'D', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
  const g2 = addGrace(score, e.id, 'before', { step: 'F', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
  const xs = new Map([[c.id, 100], [e.id, 200], [g1, 160], [g2, 176]])
  const engine = {
    getScore: () => score,
    getElementById: (id: string) => (xs.has(id) ? { bbox: { x: xs.get(id)!, y: 0, width: 8, height: 10 } } as ElementInfo : null),
  } as unknown as MusicEngine
  return { engine, c, e, g1, g2 }
}

describe('keyboardCaretAt', () => {
  it('after a note, the caret stands at the next beat\'s note', () => {
    const { engine, c } = setup()
    expect(keyboardCaretAt(engine, c.id, 0, 0)).toEqual({ x: 200, measure: 1 })
  })

  it('⭐ after a GRACE, at the next STEP — the next grace, then the main note (his rule, 2026-09-22)', () => {
    const { engine, g1, g2 } = setup()
    expect(keyboardCaretAt(engine, g1, 0, 0)).toEqual({ x: 176, measure: 1 })
    expect(keyboardCaretAt(engine, g2, 0, 0)).toEqual({ x: 200, measure: 1 })
  })
})
