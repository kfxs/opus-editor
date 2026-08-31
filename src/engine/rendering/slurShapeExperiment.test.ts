/**
 * {@link slurShapeExperiment} — ⚠️ HIS EXPERIMENT (2026-08-31): the three engines' height laws,
 * armable from the console while his eye judges them.
 *
 * ⭐ The claim that matters most is the FIRST one: armed at its default, this file changes nothing.
 * An experiment that quietly moves the picture before anyone touches it is not an experiment.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  resetSlurShape, setSlurHeightLaw, setSlurIndentFraction, slurIndentFraction,
  slurLawHeightSpaces, slurShapeGeneration, slurShapeSettings,
} from './slurShapeExperiment'
import { lilypondArchHeightSpaces } from './slurArchHeight'

afterEach(() => resetSlurShape())

describe('the armed law', () => {
  it('⭐⭐ defaults to what shipped — LilyPond’s law, to the last decimal', () => {
    for (const span of [2.4, 4, 10.8, 18, 25.2]) {
      expect(slurLawHeightSpaces(span)).toBeCloseTo(lilypondArchHeightSpaces(span), 12)
    }
    expect(slurIndentFraction(), 'and VexFlow’s own control spacing').toBe(0.25)
  })

  it('⭐ the three reproduce the published comparison table (apex = 0.75 × control)', () => {
    // `slurArchHeight`'s header table, at a two-eighths span. ⭐ That they agree is what says the
    // laws were transcribed from source rather than remembered.
    const apex = (law: 'lilypond' | 'verovio' | 'musescore') => {
      setSlurHeightLaw(law)
      return +(slurLawHeightSpaces(2.4) * 0.75).toFixed(2)
    }
    expect(apex('lilypond')).toBe(0.42)
    expect(apex('verovio')).toBe(0.45)
    expect(apex('musescore')).toBe(0.58)
  })

  it('🚨 Verovio’s FLOOR is the half worth looking at — no slur is shallower than 0.6 sp', () => {
    setSlurHeightLaw('verovio')
    expect(slurLawHeightSpaces(0.5), 'a hair of a span still gets the floor').toBe(0.6)
    expect(slurLawHeightSpaces(2.4), 'and his two-eighths bar is under it: 2.4/5 = 0.48').toBe(0.6)
    expect(slurLawHeightSpaces(100), '…with a ceiling at 1.5').toBe(1.5)
  })

  it('⭐ MuseScore’s is the deepest at the short end — the direction his hand asked twice for', () => {
    setSlurHeightLaw('musescore')
    expect(slurLawHeightSpaces(2.4)).toBeGreaterThan(lilypondArchHeightSpaces(2.4) * 1.3)
  })

  it('⛔ refuses a name it does not have, and keeps what was armed', () => {
    setSlurHeightLaw('musescore')
    expect(setSlurHeightLaw('sibelius' as never)).toBe(false)
    expect(slurShapeSettings().law).toBe('musescore')
  })
})

describe('the indent, and the render key', () => {
  it('⛔ refuses only what LOOPS — past 0.5 the two controls swap sides', () => {
    // ⚠️ 0.5 itself is ALLOWED: his `__slur.indent(0.5)` was refused by the first cut, and the two
    //    controls landing on one point is a drawable extreme a knob built for an eye must not hide.
    expect(setSlurIndentFraction(0.5)).toBe(true)
    expect(setSlurIndentFraction(0.51)).toBe(false)
    expect(setSlurIndentFraction(0)).toBe(false)
    expect(setSlurIndentFraction(0.167)).toBe(true)
    expect(slurIndentFraction()).toBe(0.167)
  })

  it('🚨🚨 every accepted write bumps the GENERATION — or the console call draws nothing', () => {
    // `reference_only_a_stale_render_runs`: a law is a picture change with no model change, so it
    // reaches the page only through `VexFlowRenderer.viewStateKey`.
    const before = slurShapeGeneration()
    setSlurHeightLaw('verovio')
    expect(slurShapeGeneration()).toBeGreaterThan(before)
    const armed = slurShapeGeneration()
    expect(setSlurIndentFraction(9), 'a REFUSED write bumps nothing').toBe(false)
    expect(slurShapeGeneration()).toBe(armed)
    resetSlurShape()
    expect(slurShapeGeneration()).toBeGreaterThan(armed)
  })
})
