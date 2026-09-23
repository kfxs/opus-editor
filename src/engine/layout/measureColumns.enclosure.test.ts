import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setEnclosure } from '@/engine/models/enclosureOps'
import { addGrace } from '@/engine/models/graceOps'
import { measureColumns } from './measureColumns'
import { enclosureLayout } from './headEnclosure'
import { hostLeftReach } from './graceRoom'
import { hostRightReach } from './bracketedRoom'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * Subject: `./measureColumns` — a PARENTHESISED head's brackets are its chord's outermost ink on both
 * sides (parenthesised-note-plan P1): one `enclosure` box per pair, from the same layout the drawing reads.
 */
describe('measureColumns — a parenthesised head\'s room', () => {
  const build = () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    return { model, a }
  }

  it('⭐ one `enclosure` box, as wide as the layout says on each side', () => {
    const { model, a } = build()
    expect(measureColumns(model.getMeasure(1)!)[0].ink.some(b => b.kind === 'enclosure')).toBe(false)
    setEnclosure(model.getScore(), [a.id], 'round')
    const box = measureColumns(model.getMeasure(1)!)[0].ink.find(b => b.kind === 'enclosure')!
    const layout = enclosureLayout(model.getScore().measures[0].slots[0] as Chord, () => null, 'treble')!
    expect(box.left).toBeCloseTo(layout.left, 9)
    expect(box.right).toBeCloseTo(layout.right, 9)
  })

  it('⭐ a grace before a bracketed note clears the BRACKET, not the bare head', () => {
    const { model, a } = build()
    const host = (model.getScore().measures[0].slots[0] as Chord).notes
    const bare = hostLeftReach(host, () => null, 'treble')
    setEnclosure(model.getScore(), [a.id], 'round')
    expect(hostLeftReach(host, () => null, 'treble')).toBeGreaterThan(bare)
    addGrace(model.getScore(), a.id, 'before', { step: 'C', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })
    const grace = measureColumns(model.getMeasure(1)!)[0].ink.find(b => b.kind === 'grace')!
    const brackets = measureColumns(model.getMeasure(1)!)[0].ink.find(b => b.kind === 'enclosure')!
    expect(grace.left).toBeGreaterThan(brackets.left)
  })

  it('⭐ a bracketed grace AFTER a bracketed note starts past its `)`', () => {
    const { model, a } = build()
    const chord = model.getScore().measures[0].slots[0] as Chord
    const bare = hostRightReach(chord, 'treble').reach
    setEnclosure(model.getScore(), [a.id], 'round')
    expect(hostRightReach(chord, 'treble').reach).toBeCloseTo(enclosureLayout(chord, () => null, 'treble')!.right, 9)
    expect(hostRightReach(chord, 'treble').reach).toBeGreaterThan(bare)
  })
})
