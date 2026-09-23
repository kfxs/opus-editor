// @vitest-environment jsdom
/**
 * ⭐ PARENTHESISED NOTES, drawn — through the SCENE (`ScoreRenderer.recordScene`), so where the brackets
 * stand against their head is arithmetic in jsdom. `docs/plans/parenthesised-note-plan.md` P1.
 *
 * ⚠️ Positions come from the metric TABLES (`fonts/bravuraMetrics`), not a measured glyph — the scene
 * records where a glyph is STAMPED, which is exactly what the layout decided.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { setEnclosure } from '../models/enclosureOps'
import { ScoreRenderer } from './ScoreRenderer'
import { ENCLOSURE_GROUP } from './EnclosurePass'
import { sceneGroups, type Scene } from '@/engine/scene/Scene'
import { ENCLOSURE_GLYPHS, enclosureLayout } from '@/engine/layout/headEnclosure'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

function render(model: ScoreModel): Scene {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

const char = (name: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[name])
const textsOf = (scene: Scene, group: string) =>
  sceneGroups(scene, group).flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c] : [])))

describe('EnclosurePass', () => {
  const build = () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    return { model, a, b }
  }

  it('draws nothing when no head wears brackets', () => {
    expect(sceneGroups(render(build().model), ENCLOSURE_GROUP)).toHaveLength(0)
  })

  it('⭐ one group per bracketed chord, holding the round pair', () => {
    const { model, a } = build()
    setEnclosure(model.getScore(), [a.id], 'round')
    const scene = render(model)
    expect(sceneGroups(scene, ENCLOSURE_GROUP)).toHaveLength(1)
    expect(textsOf(scene, ENCLOSURE_GROUP).map(t => t.text)).toEqual([
      char(ENCLOSURE_GLYPHS.round.left), char(ENCLOSURE_GLYPHS.round.right),
    ])
  })

  it('⭐⭐ the pair stands where the layout says, either side of the head, on the head\'s line', () => {
    const { model, a } = build()
    setEnclosure(model.getScore(), [a.id], 'round')
    const scene = render(model)
    const [left, right] = textsOf(scene, ENCLOSURE_GROUP)
    const layout = enclosureLayout(model.getScore().measures[0].slots[0] as Chord, () => null, 'treble')!
    const [pair] = layout.pairs
    // The gap between the two stamps is the layout's, in pixels — independent of where the bar begins.
    expect(right.x - left.x).toBeCloseTo((pair.rightParenX - pair.leftParenX) * STAFF_SPACE_PX, 6)
    expect(left.y).toBe(right.y)
  })

  // The ink is a FLOOR under the duration's space, so two quarters never feel it — sixteenths do.
  it('⭐ in a DENSE bar the bracketed note\'s column is WIDER — the room was reserved', () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'B', octave: 4, duration: '16', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', octave: 5, duration: '16', measure: 1, beat: frac(1, 4) })
    const headXs = (scene: Scene) =>
      sceneGroups(scene, 'notehead').flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))
    const [bare1, bare2] = headXs(render(model))
    setEnclosure(model.getScore(), [a.id], 'round')
    const [enc1, enc2] = headXs(render(model))
    expect(enc2 - enc1).toBeGreaterThan(bare2 - bare1)
  })
})
