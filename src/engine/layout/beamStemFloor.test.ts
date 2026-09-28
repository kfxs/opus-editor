/** Subject: `./beamStemFloor` — a pushed beam never takes a stem under its floor (seen in Chromium, 2026-09-28). */
import { describe, expect, it } from 'vitest'
import type { ElementInfo } from '@/engine/ElementRegistry'
import { BEAMED_STEM_MIN_SPACES, beamBodyDragFloor, beamEndDragFloor, beamGroupStems, beamNudgeKeepsStems, beamStandsAbove } from './beamStemFloor'

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

describe('beamEndDragFloor — one end dragged (his ask, 2026-09-28: the angle)', () => {
  it('⭐ the tightest stem decides, each weighted by how far along the beam it stands', () => {
    // Stems at x 100 / 120 / 140, lengths 4 / 3 / 5 spaces. Dragging the END (x 140): t = 0, ½, 1.
    const stems = [stem(100, 55, 40), stem(120, 55, 30), stem(140, 55, 50)]
    const lines = [line(55, 99, 42)]
    // Middle: (2.5 − 3) / ½ = −1;  end: (2.5 − 5) / 1 = −2.5  ⇒ the middle binds at −1.
    expect(beamEndDragFloor(lines, stems, SP, 'end')).toBeCloseTo(-1, 6)
    // Dragging the START (x 100): t = 1, ½, 0 ⇒ start (2.5−4)/1 = −1.5, middle −1 ⇒ −1.
    expect(beamEndDragFloor(lines, stems, SP, 'start')).toBeCloseTo(-1, 6)
  })

  it('never positive — a stem already under the floor forbids shortening, it does not force lengthening', () => {
    const stems = [stem(100, 55, 20), stem(140, 55, 20)]
    expect(beamEndDragFloor([line(55, 99, 42)], stems, SP, 'end')).toBe(0)
  })
})

describe('beamBodyDragFloor — the whole beam dragged (his ask, 2026-09-28)', () => {
  it('the SHORTEST stem decides; never positive', () => {
    const lines = [line(55, 99, 42)]
    expect(beamBodyDragFloor(lines, [stem(100, 55, 40), stem(140, 55, 30)], SP)).toBeCloseTo(-0.5, 6)
    expect(beamBodyDragFloor(lines, [stem(100, 55, 20)], SP)).toBe(0)
  })
})
