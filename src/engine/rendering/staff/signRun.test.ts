// @vitest-environment jsdom
/**
 * ⭐ **The placed sign run** (S4e) — every sign's x carried to where the placement puts the bar, its shift
 * and width its own. `./staveFrame.test.ts` is the frames' half of the same contract.
 */
import { describe, it, expect } from 'vitest'
import { EngravedStave } from '../engraved/EngravedStave'
import { placedSignRun, signRun } from './signRun'

describe('signRun — placedSignRun', () => {
  it('carries every x by what the placement moved the bar, and nothing else', () => {
    const stave = new EngravedStave(30, 40, 200).addClefSign('treble', 'default').addMeter({ numerator: 3, denominator: 4 })
    stave.getNoteStartX() // the walk: a sign has no x before it
    const own = signRun(stave)
    const placed = placedSignRun({ x: 30 + 55, y: 40 + 20, width: 200, scale: 1, stave })

    expect(placed.opening.map(s => s.kind)).toEqual(own.opening.map(s => s.kind))
    placed.opening.forEach((sign, i) => {
      expect(sign.x).toBe(own.opening[i].x + 55)
      expect(sign.xShift).toBe(own.opening[i].xShift)
      expect(sign.width).toBe(own.opening[i].width)
    })
    expect(placed.clef?.x).toBe(own.clef!.x + 55)
    expect(placed.meter?.x).toBe(own.meter!.x + 55)
    expect(placed.endBarlineX).toBe(own.endBarlineX! + 55)
  })

  it('a rebuilt bar answers the built run', () => {
    const stave = new EngravedStave(30, 40, 200).addClefSign('bass', 'default')
    stave.getNoteStartX()
    const placed = placedSignRun({ x: 30, y: 40, width: 200, scale: 1, stave })
    expect(placed.clef?.x).toBe(signRun(stave).clef!.x)
    expect(placed.meter).toBeUndefined()
  })
})
