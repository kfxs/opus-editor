/**
 * A duration token parsed as VexFlow's `Note.parseNoteStruct` parsed it (S12j-d3). ⚠️ That it agrees with
 * VexFlow's own parse was checked once, token by token — every duration and alias, 0–3 dots written or
 * given, every type letter, custom key types (`docs/history/vexflow-removal-map.md` S12j-d3); pinned here is what
 * the module promises.
 */
import { describe, it, expect } from 'vitest'
import { TICK_RESOLUTION } from '@/engine/layout/tickCount'
import { parseNoteDuration } from './noteDuration'

describe('parseNoteDuration', () => {
  it('reads the letters as their numbers: a quarter is a quarter of TICK_RESOLUTION', () => {
    expect(parseNoteDuration('q')).toMatchObject({ duration: 'q', dots: 0, type: 'n', ticks: TICK_RESOLUTION / 4 })
    expect(parseNoteDuration('w')!.ticks).toBe(TICK_RESOLUTION)
    expect(parseNoteDuration('h')!.ticks).toBe(TICK_RESOLUTION / 2)
    expect(parseNoteDuration('1/2')!.ticks).toBe(TICK_RESOLUTION * 2)
  })

  it('⭐ adds half of what it last added for each dot — written or given, a given count wins', () => {
    expect(parseNoteDuration('qd')!.ticks).toBe(TICK_RESOLUTION * 3 / 8)
    expect(parseNoteDuration('q', [], 2)!.ticks).toBe(TICK_RESOLUTION * 7 / 16)
    expect(parseNoteDuration('qdd', [], 1)).toMatchObject({ dots: 1, ticks: TICK_RESOLUTION * 3 / 8 })
  })

  it('reads the type letter — a rest is `r` — and each key may name its own', () => {
    expect(parseNoteDuration('8r')!.type).toBe('r')
    expect(parseNoteDuration('8', ['c/4', 'e/4/x'])!.customTypes).toEqual(['n', 'x'])
  })

  it('⛔ throws on a duration it has no length for, answers nothing for an empty token', () => {
    expect(() => parseNoteDuration('3')).toThrow(/not valid/)
    expect(parseNoteDuration('')).toBeUndefined()
  })
})
