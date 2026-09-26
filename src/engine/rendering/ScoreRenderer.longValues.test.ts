// @vitest-environment jsdom
/**
 * ⭐ docs/plans/other-durations-plan.md P4 — the BREVE and the LONGA drawn, counted in the SCENE (jsdom-safe:
 * glyph identities and counts, ⛔ no position — a glyph measures 0 here; `e2e/longValues.e2e.ts` measures).
 */
import { afterEach, describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { scenePrimitives, sceneGroups } from '@/engine/scene/Scene'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { resetLongHeads, setLongHead } from '@/engine/fonts/longHeads'
import { resetBarRestStyle, setBarRestStyle } from '@/engine/layout/barRestStyle'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteDuration, PitchStep, TimeSignature } from '@/types/music'

afterEach(() => { resetLongHeads(); resetBarRestStyle() })

function renderModel(model: ScoreModel) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

/** One bar of `ts` holding one note of `duration` (or nothing), rendered. */
function bar(ts: TimeSignature, duration?: NoteDuration, step: PitchStep = 'E', octave = 4) {
  const model = new ScoreModel()
  model.setTimeSignature(1, ts)
  if (duration) model.addNote({ step, octave, duration, measure: 1, beat: frac(0, 1) })
  return renderModel(model)
}

type Scene = ReturnType<typeof renderModel>
const codes = (scene: Scene): number[] =>
  scenePrimitives(scene).flatMap(p => (p.kind === 'text' ? [p.text.codePointAt(0) ?? 0] : []))
const stems = (scene: Scene): number => sceneGroups(scene, 'stem').flatMap(g => g.children).filter(c => c.kind === 'path').length

describe('⭐ P4 — the breve', () => {
  it('draws the ROUND double-whole head by default, and NO stem', () => {
    const scene = bar({ numerator: 4, denominator: 2 }, 'breve')
    expect(codes(scene)).toContain(GLYPH_CODEPOINTS.noteheadDoubleWhole)
    expect(codes(scene)).not.toContain(GLYPH_CODEPOINTS.noteheadBlack)
    expect(stems(scene), 'a breve has no stem').toBe(0)
  })

  it('draws the SQUARE head when the row says so', () => {
    setLongHead('breve', 'square')
    expect(codes(bar({ numerator: 4, denominator: 2 }, 'breve'))).toContain(GLYPH_CODEPOINTS.noteheadDoubleWholeSquare)
  })
})

describe('⭐ P4 — the longa', () => {
  it('draws the SQUARE head by default, and ONE stem', () => {
    const scene = bar({ numerator: 8, denominator: 2 }, 'longa')
    expect(codes(scene)).toContain(GLYPH_CODEPOINTS.noteheadDoubleWholeSquare)
    expect(stems(scene), 'the stem is what tells a longa from a breve').toBe(1)
  })
})

describe('⭐ P4 — the whole-bar rest follows the bar-rest style', () => {
  it('an empty 4/2 bar draws a BREVE rest; an empty 4/4 bar still a whole rest', () => {
    expect(codes(bar({ numerator: 4, denominator: 2 }))).toContain(GLYPH_CODEPOINTS.restDoubleWhole)
    const plain = codes(bar({ numerator: 4, denominator: 4 }))
    expect(plain).toContain(GLYPH_CODEPOINTS.restWhole)
    expect(plain).not.toContain(GLYPH_CODEPOINTS.restDoubleWhole)
  })

  it('…a whole rest in 4/2 under `whole`, and a LONGA rest in 4/1 under `lilypond`', () => {
    setBarRestStyle('whole')
    expect(codes(bar({ numerator: 4, denominator: 2 }))).toContain(GLYPH_CODEPOINTS.restWhole)
    setBarRestStyle('lilypond')
    expect(codes(bar({ numerator: 4, denominator: 1 }))).toContain(GLYPH_CODEPOINTS.restLonga)
  })
})
