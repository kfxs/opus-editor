/** Subject: `./beamStemFloor` — a pushed beam never takes a stem under its floor (seen in Chromium, 2026-09-28). */
import { describe, expect, it } from 'vitest'
import type { ElementInfo } from '@/engine/ElementRegistry'
import { BEAMED_STEM_MIN_SPACES, beamGroupStems, beamNudgeKeepsStems, beamStandsAbove } from './beamStemFloor'

const SP = 10
const line = (y: number, x = 100, width = 40): ElementInfo => ({ type: 'beamGroup', measure: 1, staff: 0, bbox: { x, y, width, height: 5 } })
const stem = (x: number, y: number, height: number, measure = 1): ElementInfo => ({ type: 'stem', measure, staff: 0, bbox: { x, y, width: 1.5, height } })

describe('beamStemFloor', () => {
  it('the group\'s stems are the ones under the beam\'s run, in its bar and staff', () => {
    const stems = [stem(101, 55, 35), stem(139, 55, 35), stem(200, 55, 35), stem(120, 55, 35, 2)]
    expect(beamGroupStems([line(55)], stems)).toEqual(stems.slice(0, 2))
  })

  it('which side the beam stands on', () => {
    expect(beamStandsAbove([line(55)], [stem(101, 55, 35)])).toBe(true)
    expect(beamStandsAbove([line(88)], [stem(101, 55, 35)])).toBe(false)
  })

  it(`⭐ a step toward the heads is refused past ${BEAMED_STEM_MIN_SPACES} spaces of shortest stem; away is never refused`, () => {
    const stems = [stem(101, 55, 35), stem(139, 55, 30)] // shortest 3 spaces, beam above: + (down) shortens
    expect(beamNudgeKeepsStems([line(55)], stems, SP, 0.5)).toBe(true)
    expect(beamNudgeKeepsStems([line(55)], stems, SP, 0.75)).toBe(false)
    expect(beamNudgeKeepsStems([line(55)], stems, SP, -5)).toBe(true)
    // Stems down: the beam below, so − (up) is toward the heads.
    const down = [stem(101, 60, 30)]
    expect(beamNudgeKeepsStems([line(88)], down, SP, -0.75)).toBe(false)
    expect(beamNudgeKeepsStems([line(88)], down, SP, 5)).toBe(true)
  })
})
