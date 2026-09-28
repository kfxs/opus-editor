/** Subject: `./beamHitInk` — a beam's LINES filed as `'beamGroup'` ink, anchored on its first note (2026-09-28). */
import { describe, expect, it } from 'vitest'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { ChordRest } from '@/types/music'
import type { EngravedBeam } from '../engraved/EngravedBeam'
import type { EngravedNote } from '../engraved/EngravedNote'
import { beamAnchorId, beamLineBand, registerBeamHitInk } from './beamHitInk'

const chord = (id: string, pitches: [string, string, number][]): ChordRest => ({
  type: 'chord', id, duration: '8', beat: { num: 0, den: 1 }, measure: 1,
  notes: pitches.map(([pid, step, octave]) => ({ id: pid, step, alter: 0, octave })),
} as unknown as ChordRest)
const rest = (id: string): ChordRest => ({ type: 'rest', id, duration: '8', beat: { num: 0, den: 1 }, measure: 1 } as unknown as ChordRest)

describe('beamAnchorId', () => {
  it('a chord is anchored on its LOWEST pitch (the stem\'s anchor), whatever order it was written in; a rest has none', () => {
    expect(beamAnchorId(chord('s', [['hi', 'G', 5], ['lo', 'C', 4], ['mid', 'E', 4]]))).toBe('lo')
    expect(beamAnchorId(rest('r1'))).toBeUndefined()
  })
})

describe('beamLineBand', () => {
  it('the top edge, then that edge moved by the SIGNED thickness — a stem-down beam\'s band grows upward', () => {
    const line = { startX: 10, startY: 50, endX: 40, endY: 44 }
    expect(beamLineBand(line, 5)).toEqual([{ x: 10, y: 50 }, { x: 40, y: 44 }, { x: 40, y: 49 }, { x: 10, y: 55 }])
    expect(beamLineBand(line, -5)[3]).toEqual({ x: 10, y: 45 })
  })
})

describe('registerBeamHitInk', () => {
  it('⭐ files ONE entry per drawn line — its band and the group\'s anchor, its first NOTE (a beamed rest passed over)', () => {
    const notes = [{}, {}, {}] as unknown as EngravedNote[]
    const slots = [rest('r0'), chord('c1', [['p1', 'C', 4]]), chord('c2', [['p2', 'D', 4]])]
    const beam = {
      id: 'beam7', notes: [notes[0], notes[1], notes[2]],
      drawnLines: () => ({ thickness: 5, lines: [
        { startX: 10, startY: 50, endX: 40, endY: 44 },
        { startX: 10, startY: 57.5, endX: 40, endY: 51.5 },
      ] }),
    } as unknown as EngravedBeam
    const registry = new ElementRegistry()
    registerBeamHitInk(registry, [beam], slots, notes, 3, 1)
    const entries = registry.getByType('beamGroup')
    expect(entries).toHaveLength(2)
    for (const entry of entries) expect(entry).toMatchObject({ noteId: 'p1', measure: 3, staff: 1 })
    // ⛔ No drawn id: `beam7` is a render counter, and a translated bar's registry must equal a fresh one's.
    for (const entry of entries) expect(entry.id).toBeUndefined()
    expect(entries[0].points).toEqual(beamLineBand({ startX: 10, startY: 50, endX: 40, endY: 44 }, 5))
    expect(entries[0].bbox).toEqual({ x: 10, y: 44, width: 30, height: 11 })
  })

  it('a beam of rests alone, or one whose notes are not in the bar\'s arrays, files nothing', () => {
    const rests = [{}, {}] as unknown as EngravedNote[]
    const restBeam = { id: 'r', notes: rests, drawnLines: () => ({ thickness: 5, lines: [{ startX: 0, startY: 0, endX: 9, endY: 0 }] }) } as unknown as EngravedBeam
    const restRegistry = new ElementRegistry()
    registerBeamHitInk(restRegistry, [restBeam], [rest('a'), rest('b')], rests, 1, 0)
    expect(restRegistry.getByType('beamGroup')).toEqual([])

    const beam = { id: 'b', notes: [{}], drawnLines: () => ({ thickness: 5, lines: [{ startX: 0, startY: 0, endX: 9, endY: 0 }] }) } as unknown as EngravedBeam
    const registry = new ElementRegistry()
    registerBeamHitInk(registry, [beam], [], [], 1, 0)
    expect(registry.getByType('beamGroup')).toEqual([])
  })
})
