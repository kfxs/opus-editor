import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace, setGraceBeam } from './graceOps'
import { beamRoleOf } from './beamRoleOps'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./beamRoleOps` — a note's beam ROLE, and ⭐ a GRACE's within its group (his report, 2026-09-23:
 * the beam keys must answer for a grace as for a note).
 */
describe('beamRoleOf', () => {
  const setup = () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const graces = (['G', 'A', 'B'] as const).map(step =>
      addGrace(score, note.id, 'before', { step, alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!)
    return { model, score, note, ids: graces.map(g => g.pitches[0].id) }
  }

  it('⭐ a grace\'s role in its group\'s beam: begin, continue, end', () => {
    const { score, ids } = setup()
    expect(ids.map(id => beamRoleOf(score, id))).toEqual(['begin', 'continue', 'end'])
  })

  it('…and it follows the AUTHORED beam: a `single` in the middle leaves two singles and itself', () => {
    const { score, ids } = setup()
    setGraceBeam(score, ids[1], 'single')
    expect(ids.map(id => beamRoleOf(score, id))).toEqual(['single', 'single', 'single'])
    setGraceBeam(score, ids[1], 'auto')
    expect(ids.map(id => beamRoleOf(score, id))).toEqual(['begin', 'continue', 'end'])
  })

  it('a note keeps its lane\'s answer; a rest and an unknown id have none', () => {
    const { model, score, note } = setup()
    expect(beamRoleOf(score, note.id)).toBe('single')
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    expect(beamRoleOf(score, rest.id)).toBeNull()
    expect(beamRoleOf(score, 'nobody')).toBeNull()
  })
})
