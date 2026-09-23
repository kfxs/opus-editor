// @vitest-environment jsdom
/**
 * ⭐ A TIE on a PARENTHESISED note runs OUTSIDE its brackets (Gould p. 610: the tie to the next bar leaves
 * after `)`, the incoming one ends at `(`) — `rendering/curves/TieRenderer` asking
 * `layout/headEnclosure.chordEnclosure`, the layout `rendering/EnclosurePass` stood the brackets with.
 * A feature test: it drives the tie, the brackets and the scene together.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setEnclosure } from '@/engine/models/enclosureOps'
import { toggleTie } from '@/engine/models/tieOps'
import { ScoreRenderer } from '../ScoreRenderer'
import { ENCLOSURE_GROUP } from '../EnclosurePass'
import { scenePrimitives, sceneGroups, type Scene } from '@/engine/scene/Scene'
import { fracCreate as frac } from '@/utils/fraction'

function render(model: ScoreModel): Scene {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

/** Every x the tie's ink passes through (its path points). */
function tieXs(scene: Scene): number[] {
  const tie = sceneGroups(scene, 'tie')[0]
  return scenePrimitives(tie).flatMap(p => (p.kind === 'path' ? p.ops.flatMap(o => ('x' in o ? [o.x] : [])) : []))
}

describe('a tie on a parenthesised note', () => {
  const build = (bracket: 'from' | 'to') => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'B', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    toggleTie(model, a.id)
    setEnclosure(model.getScore(), [bracket === 'from' ? a.id : b.id], 'round')
    return model
  }
  const stamps = (scene: Scene) =>
    sceneGroups(scene, ENCLOSURE_GROUP).flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))

  it('⭐ leaves from past the `)` of a bracketed first note', () => {
    const scene = render(build('from'))
    const [, rightParen] = stamps(scene)
    expect(Math.min(...tieXs(scene))).toBeGreaterThan(rightParen)
  })

  it('⭐ ends short of the `(` of a bracketed second note', () => {
    const scene = render(build('to'))
    const [leftParen] = stamps(scene)
    expect(Math.max(...tieXs(scene))).toBeLessThan(leftParen)
  })
})
