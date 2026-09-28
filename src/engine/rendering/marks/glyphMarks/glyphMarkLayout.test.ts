// @vitest-environment jsdom
/**
 * {@link drawGlyphMarks} — the user's symbols drawn, through a real render
 * read back as a SCENE (docs/plans/symbol-plan.md P1). ⚠️ Where a glyph was STAMPED and which codepoint:
 * yes. How wide its ink came out: no — jsdom has no font.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../../models/ScoreModel'
import { ScoreRenderer } from '../../ScoreRenderer'
import { addGlyphMark } from '../../../models/glyphMarkOps'
import { scenePrimitives, sceneGroups, type SceneGroup } from '@/engine/scene/Scene'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'
import { fracCreate as frac } from '@/utils/fraction'

function renderWith(add: (model: ScoreModel) => void) {
  const model = new ScoreModel()
  model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
  add(model)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return { scene, container }
}

const textOf = (g: SceneGroup) => {
  const prims = scenePrimitives(g).filter(p => p.kind === 'text')
  expect(prims).toHaveLength(1)
  return prims[0] as Extract<ReturnType<typeof scenePrimitives>[number], { kind: 'text' }>
}

describe('drawGlyphMarks', () => {
  it('stamps the glyph in its own group, carrying the mark id', () => {
    let id = ''
    const { scene } = renderWith(m => { id = addGlyphMark(m.getScore(), 1, { glyph: 'pictGlsp', beat: frac(0, 1) })!.id })
    const groups = sceneGroups(scene, 'glyphMark')
    expect(groups.map(g => g.id)).toEqual([id])
    expect(textOf(groups[0]).text).toBe('')
  })

  it('centres each glyph on its note: two glyphs on one note share a centre, the next note’s is right of it', () => {
    const { scene } = renderWith(m => {
      const s = m.getScore()
      addGlyphMark(s, 1, { glyph: 'pictGlsp', beat: frac(0, 1) })
      addGlyphMark(s, 1, { glyph: 'fermataAbove', beat: frac(0, 1) })
      addGlyphMark(s, 1, { glyph: 'fermataAbove', beat: frac(1, 1) })
    })
    const [a, b, c] = sceneGroups(scene, 'glyphMark').map(g => textOf(g))
    const centre = (t: { x: number }, glyph: string) => t.x + smuflGlyph(glyph)!.centerX * 10
    expect(centre(a, 'pictGlsp')).toBeCloseTo(centre(b, 'fermataAbove'))
    expect(centre(c, 'fermataAbove')).toBeGreaterThan(centre(b, 'fermataAbove') + 10)
  })

  it('draws nothing for a glyph name it does not know', () => {
    const { scene } = renderWith(m => { m.getScore().measures[0].glyphMarks = [{ id: 'x', glyph: 'notAGlyph', beat: frac(0, 1) }] })
    expect(sceneGroups(scene, 'glyphMark')).toEqual([])
  })
})
