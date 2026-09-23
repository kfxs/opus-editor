import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace, isGraceNote } from '@/engine/models/graceOps'
import { isBracketedGrace } from '@/engine/models/bracketedGraceOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import { GRACE_CLICK, graceTargetAt } from './graceTarget'

/**
 * ⭐ P2a — the grace click reads x as a COLUMN (his rule: *"it should behave like note entry"*). Bar 1:
 * C at beat 0 (head at x 100), E at beat 1 (head at 200) with three graces drawn before it at
 * 150–158, 166–174, 182–190. A staff space is 10 px.
 */
function setup() {
  const model = new ScoreModel()
  const c = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
  const e = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
  const score = model.getScore()
  const g = (step: 'D' | 'F' | 'G') =>
    addGrace(score, e.id, 'before', { step, alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!.pitches[0].id
  const graces = [g('D'), g('F'), g('G')]
  const head = (id: string, left: number): ElementInfo =>
    ({ type: 'note', id, measure: 1, staff: 0, headX: left + 4, bbox: { x: left, y: 0, width: 8, height: 10 } }) as ElementInfo
  const entries = [head(c.id, 96), head(e.id, 196), head(graces[0], 150), head(graces[1], 166), head(graces[2], 182)]
  const registry = {
    getByType: (type: string) => entries.filter(el => el.type === type),
    getStaffGeometry: () => ({ lineSpacing: 10 }),
  } as unknown as ElementRegistry
  const engine = {
    getScore: () => score, isGraceNote: (id: string) => isGraceNote(score, id),
    bracketed: { isBracketed: (id: string) => isBracketedGrace(score, id) },
  } as unknown as MusicEngine
  const at = (x: number) => graceTargetAt(engine, registry, 1, 0, x)
  return { c, e, graces, at }
}

describe('graceTargetAt — where a grace click lands', () => {
  it('⭐ x in a grace\'s COLUMN → a chord with THAT grace', () => {
    const { e, graces, at } = setup()
    expect(at(154)).toMatchObject({ host: { id: e.id }, chordWith: graces[0] })
    expect(at(186)).toMatchObject({ chordWith: graces[2] })
  })

  it('⭐ x in a GAP → a new grace THERE: first, between, last', () => {
    const { at } = setup()
    expect(at(145)).toMatchObject({ index: 0 })
    expect(at(145)?.chordWith).toBeUndefined()
    expect(at(162)).toMatchObject({ index: 1 })
    expect(at(178)).toMatchObject({ index: 2 })
    expect(at(193)).toMatchObject({ index: 3 })
  })

  it('🚨 left of a long group\'s first grace, the click is the GROUP\'s — not the nearer previous note', () => {
    const { e, at } = setup()
    const x = 150 - GRACE_CLICK.groupReach * 10 + 1 // 136: 36 px from C, 64 from E
    expect(at(x)).toMatchObject({ host: { id: e.id }, index: 0 })
  })

  it('outside every group, the nearest note', () => {
    const { c, at } = setup()
    expect(at(110)).toEqual(expect.objectContaining({ host: expect.objectContaining({ id: c.id }), index: 0 }))
    expect(at(40)).toBeNull() // 56 px from C: beyond the reach
  })
})
