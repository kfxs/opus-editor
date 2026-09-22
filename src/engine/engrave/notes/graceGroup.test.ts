import { describe, it, expect, afterEach } from 'vitest'
import { BEAM_SLASH_ADJUST_DEFAULT, GRACE_SLASH_DOWN, graceSlashDownOrigin, mirrorSegment, GRACE_SLASH, GRACE_SLASH_UNFLAGGED, graceBeamSlashRule, resetBeamSlashAdjustment, setBeamSlashAdjustment, graceSlash, graceSlashOnBeam, setGraceBeamSlashRule, type BeamSlashAt, type Segment, graceSlashGeneration, graceSlashUnflagged, resetUnflaggedSlash, setUnflaggedSlash, unflaggedSlashSettings } from './graceGroup'
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

describe('graceSlashOnBeam — ONE slash across a beamed group\'s first stem (P2c): the presets', () => {
  const SPACE = 10
  const K = 2 / 3
  const at: BeamSlashAt = { stemX: 100, stemWeight: 1.5, tipY: 50, headY: 85, slope: 0, headWidth: 11.8, space: SPACE, k: K }
  const length = (s: Segment) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
  /** A drawn preset's stroke — `musescore` and `lilypond` draw one. */
  const stroke = (a: BeamSlashAt, rule: 'musescore' | 'lilypond') => {
    const slash = graceSlashOnBeam(a, rule)
    if (slash?.kind !== 'stroke') throw new Error(`${rule} should draw a stroke`)
    return slash
  }
  const riseDeg = (s: Segment) => (Math.atan2(s.y1 - s.y2, s.x2 - s.x1) * 180) / Math.PI

  afterEach(() => resetBeamSlashAdjustment())
  /** MuseScore's own numbers, with his adjustment zeroed. */
  const pure = () => setBeamSlashAdjustment({ left: 0, down: 0, length: 1 })

  it('⭐ BRAVURA (armed, his): the FONT\'s own slash GLYPH, stamped by its box — left of the stem, below the tip', () => {
    expect(graceBeamSlashRule()).toBe('bravura')
    const slash = graceSlashOnBeam(at)!
    expect(slash).toEqual({
      kind: 'glyph', glyph: 'graceNoteSlashStemUp',
      x: 100 - BEAM_SLASH_ADJUST_DEFAULT.glyphLeft * SPACE,
      y: 50 + BEAM_SLASH_ADJUST_DEFAULT.glyphDown * SPACE,
    })
    // …and its box, from the default: it crosses the stem BELOW the tip and ends ABOVE the beam.
    const box = { width: 2.02, height: 1.604 }
    const crossing = BEAM_SLASH_ADJUST_DEFAULT.glyphDown - (BEAM_SLASH_ADJUST_DEFAULT.glyphLeft / box.width) * box.height
    expect(crossing).toBeGreaterThan(0)
    expect(BEAM_SLASH_ADJUST_DEFAULT.glyphDown - box.height).toBeLessThan(0)
    setBeamSlashAdjustment({ glyphDown: 1.0 })
    const higher = graceSlashOnBeam(at)!
    expect(higher.kind === 'glyph' && higher.y).toBeCloseTo(50 + 1.0 * SPACE, 9)
  })

  it('⭐ MUSESCORE, its own numbers: half a head left of the stem\'s right edge, 1.32 sp below the tip, 40°, 2 PAGE spaces', () => {
    pure()
    const { segment, thickness } = stroke(at, 'musescore')
    expect(segment.x1).toBeCloseTo(100 + 0.75 - 5.9, 9)
    expect(segment.y1).toBeCloseTo(50 + 2.0 * 0.66 * SPACE, 9)
    expect(riseDeg(segment)).toBeCloseTo(40, 9)
    expect(length(segment)).toBeCloseTo((2 * SPACE) / K, 9) // the staff's spatium — not scaled by the grace
    expect(thickness).toBeCloseTo(0.125 * SPACE, 9)
  })

  it('⭐ HIS EYE on it: the armed adjustment moves the start LEFT and DOWN (grace spaces) and scales the length', () => {
    pure()
    const plain = stroke(at, 'musescore').segment
    resetBeamSlashAdjustment()
    const moved = stroke(at, 'musescore').segment
    expect(plain.x1 - moved.x1).toBeCloseTo(BEAM_SLASH_ADJUST_DEFAULT.left * SPACE, 9)
    expect(moved.y1 - plain.y1).toBeCloseTo(BEAM_SLASH_ADJUST_DEFAULT.down * SPACE, 9)
    setBeamSlashAdjustment({ length: 0.5 })
    expect(length(stroke(at, 'musescore').segment)).toBeCloseTo(SPACE / K, 9)
    expect(setBeamSlashAdjustment({ length: 5 })).toBe(false)
  })

  it('MUSESCORE leans with HALF the beam\'s angle — and a rising beam makes it 1.1× longer', () => {
    pure()
    const rising = stroke({ ...at, slope: -0.2 }, 'musescore').segment
    expect(riseDeg(rising)).toBeCloseTo(40 + (Math.atan(0.2) * 180) / Math.PI / 2, 9)
    expect(length(rising)).toBeCloseTo((2 * SPACE * 1.1) / K, 9)
    const falling = stroke({ ...at, slope: 0.2 }, 'musescore').segment
    expect(length(falling)).toBeCloseTo((2 * SPACE) / K, 9)
  })

  it('LILYPOND: −0.5 → +1 page space of the stem, from 1 sp + 0.3 of the stem below the beam to 0.75 sp over it', () => {
    const { segment } = stroke(at, 'lilypond')
    expect(segment.x1).toBeCloseTo(100 - (0.5 * SPACE) / K, 9)
    expect(segment.x2).toBeCloseTo(100 + SPACE / K, 9)
    expect(segment.y1).toBeCloseTo(50 + SPACE / K + 0.3 * 35, 9)
    expect(segment.y2).toBeCloseTo(50 - (0.75 * SPACE) / K, 9)
  })

  it('NONE draws nothing (Verovio; LilyPond\'s default) — and an unknown preset is refused', () => {
    expect(graceSlashOnBeam(at, 'none')).toBeNull()
    expect(setGraceBeamSlashRule('vexflow' as never)).toBe(false)
    expect(graceBeamSlashRule()).toBe('bravura')
  })

  it('arming a preset re-engraves (the slash generation moves)', () => {
    const before = graceSlashGeneration()
    expect(setGraceBeamSlashRule('lilypond')).toBe(true)
    expect(graceSlashGeneration()).toBe(before + 1)
    setGraceBeamSlashRule('bravura')
  })
})

describe('stems DOWN (P6) — the slash is the MIRROR (the font, Gould, MuseScore; ⚠️ G&L and Ross say it always rises)', () => {
  const SPACE = 10
  const at: BeamSlashAt = { stemX: 100, stemWeight: 1.5, tipY: 90, headY: 55, slope: 0, headWidth: 11.8, space: SPACE, k: 2 / 3, stemDirection: -1 }
  afterEach(() => resetBeamSlashAdjustment())

  it('a down FLAG\'s slash glyph stands at its NW anchor — Bravura\'s flag8thDown values where a face has none', () => {
    const o = graceSlashDownOrigin({ x: 0, y: 0 }, null, SPACE)
    const [nx, ny] = GRACE_SLASH_DOWN.northWest.value
    expect(o).toEqual({ x: nx * SPACE, y: -ny * SPACE })
  })

  it('⭐ BRAVURA on a down beam: E565, its upper-left corner ABOVE the tip by the same glyphDown', () => {
    expect(graceSlashOnBeam(at)).toEqual({
      kind: 'glyph', glyph: 'graceNoteSlashStemDown',
      x: 100 - BEAM_SLASH_ADJUST_DEFAULT.glyphLeft * SPACE,
      y: 90 - BEAM_SLASH_ADJUST_DEFAULT.glyphDown * SPACE,
    })
  })

  it('MUSESCORE and LILYPOND on a down beam: the stem-up stroke reflected about the tip', () => {
    for (const rule of ['musescore', 'lilypond'] as const) {
      const down = graceSlashOnBeam(at, rule)!
      const up = graceSlashOnBeam({ ...at, stemDirection: 1, headY: 2 * at.tipY - at.headY }, rule)!
      if (down.kind !== 'stroke' || up.kind !== 'stroke') throw new Error('strokes')
      expect(down.segment).toEqual(mirrorSegment(up.segment, at.tipY))
    }
  })
})
