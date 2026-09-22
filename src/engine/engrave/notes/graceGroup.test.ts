import { describe, it, expect, afterEach } from 'vitest'
import { GRACE_SLASH, GRACE_SLASH_UNFLAGGED, graceSlash, graceSlashGeneration, graceSlashUnflagged, resetUnflaggedSlash, setUnflaggedSlash, unflaggedSlashSettings } from './graceGroup'
import { anchor } from '@/engine/fonts/fontMetrics'

describe('graceSlash — where the font says the slash goes', () => {
  it('⭐ on an 8th flag, the line IS the font\'s two anchors (y up in the font, down on the page)', () => {
    const sw = anchor('flag8thUp', 'graceNoteSlashSW')!
    const ne = anchor('flag8thUp', 'graceNoteSlashNE')!
    const s = graceSlash({ x: 100, y: 50 }, 'flag8thUp', 10)
    expect(s).toEqual({ x1: 100 + sw[0] * 10, y1: 50 - sw[1] * 10, x2: 100 + ne[0] * 10, y2: 50 - ne[1] * 10 })
    expect(s.x2).toBeGreaterThan(s.x1)
    expect(s.y2, 'lower left to upper right').toBeLessThan(s.y1)
  })

  it('where the flag has no anchors (a 16th) — or there is no flag — the rows give the same shape', () => {
    expect(anchor('flag16thUp', 'graceNoteSlashSW')).toBeNull()
    const rows = { x1: GRACE_SLASH.southWest.value[0] * 10, y1: -GRACE_SLASH.southWest.value[1] * 10, x2: GRACE_SLASH.northEast.value[0] * 10, y2: -GRACE_SLASH.northEast.value[1] * 10 }
    expect(graceSlash({ x: 0, y: 0 }, 'flag16thUp', 10)).toEqual(rows)
    expect(graceSlash({ x: 0, y: 0 }, null, 10)).toEqual(rows)
  })
})

describe('graceSlashUnflagged — a quarter or half: its own length, the 8th\'s angle and depth, centred on the stem', () => {
  afterEach(() => resetUnflaggedSlash())
  const len = (g: { x1: number; y1: number; x2: number; y2: number }) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1)

  it('is the armed length, centred on the stem, crossing it the armed depth below the tip, rising', () => {
    const s = graceSlashUnflagged(100, 20, 10)
    expect(len(s)).toBeCloseTo(GRACE_SLASH_UNFLAGGED.length.value * 10, 9)
    expect((s.x1 + s.x2) / 2).toBeCloseTo(100, 9)
    expect((s.y1 + s.y2) / 2).toBeCloseTo(20 + GRACE_SLASH_UNFLAGGED.crossBelowTip.value * 10, 9)
    expect(s.y2).toBeLessThan(s.y1)
  })

  it('⭐ the knob — `__grace.slash({…})` — re-arms it, refuses nonsense, and bumps the re-engrave key', () => {
    const before = graceSlashGeneration()
    expect(setUnflaggedSlash({ length: 1.4 })).toBe(true)
    expect(len(graceSlashUnflagged(0, 0, 10))).toBeCloseTo(14, 9)
    expect(graceSlashGeneration()).toBe(before + 1)
    expect(setUnflaggedSlash({ angle: 120 })).toBe(false)
    expect(unflaggedSlashSettings().length).toBe(1.4)
    resetUnflaggedSlash()
    expect(unflaggedSlashSettings().length).toBe(GRACE_SLASH_UNFLAGGED.length.value)
  })
})
