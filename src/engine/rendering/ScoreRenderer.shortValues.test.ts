// @vitest-environment jsdom
/**
 * ⭐ docs/plans/other-durations-plan.md P3 — the 64th, 128th, 256th and 512th DRAWN: the font's own flag
 * for each flag count, one beam line per flag, and the font's own rest. Counted in the SCENE (what was
 * drawn, as values), so it runs in jsdom — ⛔ no position is asserted: a glyph measures 0 here.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { scenePrimitives, sceneGroups } from '@/engine/scene/Scene'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import type { GlyphName } from '@/engine/fonts/fontMetrics'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteDuration } from '@/types/music'

function renderModel(model: ScoreModel) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

type Scene = ReturnType<typeof renderModel>

/** Every glyph drawn inside a group of this class, as its codepoint. */
function glyphsIn(scene: Scene, cls: string): number[] {
  return sceneGroups(scene, cls)
    .flatMap(g => g.children)
    .flatMap(c => (c.kind === 'text' ? [c.text.codePointAt(0) ?? 0] : []))
}

/** Every filled quad inside a `beam` group — one per beam LINE. */
function beamLines(scene: Scene): number {
  return sceneGroups(scene, 'beam')
    .flatMap(g => g.children)
    .filter(c => c.kind === 'path' && c.painted === 'fill').length
}

const code = (name: GlyphName) => GLYPH_CODEPOINTS[name]

const SHORT: ReadonlyArray<{ d: NoteDuration; flags: number; up: GlyphName; rest: GlyphName; perQuarter: number }> = [
  { d: '64', flags: 4, up: 'flag64thUp', rest: 'rest64th', perQuarter: 16 },
  { d: '128', flags: 5, up: 'flag128thUp', rest: 'rest128th', perQuarter: 32 },
  { d: '256', flags: 6, up: 'flag256thUp', rest: 'rest256th', perQuarter: 64 },
  { d: '512', flags: 7, up: 'flag512thUp', rest: 'rest512th', perQuarter: 128 },
]

describe('⭐ P3 — the short values, drawn', () => {
  for (const { d, flags, up, rest, perQuarter } of SHORT) {
    it(`a lone ${d}th draws the font's OWN ${flags}-flag glyph (${up}), ⛔ not stacked eighth flags`, () => {
      const model = new ScoreModel()
      model.addNote({ step: 'C', octave: 5, duration: d, measure: 1, beat: frac(0, 1) })
      const drawn = glyphsIn(renderModel(model), 'flag')
      expect(drawn, 'one flag glyph').toHaveLength(1)
      // C5 stands above the middle line, so its stem is DOWN — the down cut is the one after the up.
      expect([code(up), code(up.replace('Up', 'Down') as GlyphName)]).toContain(drawn[0])
    })

    it(`two beamed ${d}ths draw ${flags} beam lines — one per flag, and no flags`, () => {
      const model = new ScoreModel()
      model.addNote({ step: 'C', octave: 4, duration: d, measure: 1, beat: frac(0, 1) })
      model.addNote({ step: 'D', octave: 4, duration: d, measure: 1, beat: frac(1, perQuarter) })
      const scene = renderModel(model)
      expect(beamLines(scene)).toBe(flags)
      expect(glyphsIn(scene, 'flag'), 'a beam replaces the flags').toEqual([])
    })

    it(`the rest after a ${d}th is the font's own ${rest}`, () => {
      const model = new ScoreModel()
      model.addNote({ step: 'C', octave: 5, duration: d, measure: 1, beat: frac(0, 1) })
      const texts = scenePrimitives(renderModel(model)).flatMap(p => (p.kind === 'text' ? [p.text.codePointAt(0)] : []))
      expect(texts, 'the fill starts with a rest of the same value').toContain(code(rest))
    })
  }

  it('🚨 the break-test — an EIGHTH still draws one line and a 32nd three, as before', () => {
    for (const [d, perQuarter, lines] of [['8', 2, 1], ['32', 8, 3]] as const) {
      const model = new ScoreModel()
      model.addNote({ step: 'C', octave: 4, duration: d, measure: 1, beat: frac(0, 1) })
      model.addNote({ step: 'D', octave: 4, duration: d, measure: 1, beat: frac(1, perQuarter) })
      expect(beamLines(renderModel(model)), d).toBe(lines)
    }
  })
})
