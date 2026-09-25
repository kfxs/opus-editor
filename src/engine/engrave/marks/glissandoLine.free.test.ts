/**
 * {@link glissandoFreeStroke} — a glissando with ONE free end, drawn against a virtual point
 * (docs/plans/glissando-plan.md P3). SP = 10 px; the note's head centre at y 50, its ink 94…106.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  GLISSANDO_FREE_END_RULES, armedGlissandoFreeEnd, glissandoFreeStroke, resetGlissandoFreeEndRule, setGlissandoFreeEndRule,
} from './glissandoLine'

const SP = 10
const note = { y: 50, inkRightX: 106, inkLeftX: 94, centreX: 100 }

afterEach(() => resetGlissandoFreeEndRule())

describe('glissandoFreeStroke', () => {
  it('ships Gould\'s free end — 3.8 sp across × 1.3 sp, 0.6 sp clear of what follows (p. 411 (c), measured)', () => {
    expect(armedGlissandoFreeEnd()).toMatchObject({ across: 3.8, rise: 1.3, clearance: 0.6 })
  })

  it('AFTER, falling: leaves the note to the right and ends BELOW it', () => {
    const s = glissandoFreeStroke('after', note, 'down', SP)!
    expect(s.x1).toBeGreaterThan(106)
    expect(s.x2).toBeGreaterThan(s.x1)
    expect(s.y2).toBeGreaterThan(s.y1)
  })

  it('AFTER, rising (a doit): ends ABOVE', () => {
    const s = glissandoFreeStroke('after', note, 'up', SP)!
    expect(s.y2).toBeLessThan(s.y1)
  })

  it('BEFORE, rising (a scoop): comes from below-left INTO the note', () => {
    const s = glissandoFreeStroke('before', note, 'up', SP)!
    expect(s.x2).toBeLessThan(94)
    expect(s.x1).toBeLessThan(s.x2)
    expect(s.y1).toBeGreaterThan(s.y2)
  })

  it('BEFORE, falling (a plop): comes from ABOVE', () => {
    const s = glissandoFreeStroke('before', note, 'down', SP)!
    expect(s.y1).toBeLessThan(s.y2)
  })

  it('an AFTER end is clamped short of the system\'s barline', () => {
    const s = glissandoFreeStroke('after', note, 'down', SP, undefined, 130)!
    expect(s.x2).toBeLessThanOrEqual(130)
  })

  it('the row sets its size: MuseScore\'s chord line is shorter than Gould\'s', () => {
    const gould = glissandoFreeStroke('after', note, 'down', SP)!
    setGlissandoFreeEndRule('musescore')
    const ms = glissandoFreeStroke('after', note, 'down', SP)!
    expect(ms.x2 - ms.x1).toBeLessThan(gould.x2 - gould.x1)
    expect(GLISSANDO_FREE_END_RULES.musescore.across).toBe(1.2)
  })
})
