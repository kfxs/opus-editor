// @vitest-environment jsdom
/**
 * Subject: `./FanPass` — a CUE fan is drawn at its size (cue-size-plan, cue fans): its members' heads at the
 * cue face, its feathered beam at ¾ the thickness, closer together — read off the SCENE. Bar 1 is the same fan
 * at full size, the control.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups, scenePrimitives, type Scene } from '@/engine/scene/Scene'
import { setCue } from '../../models/cueOps'
import { fracCreate as frac } from '@/utils/fraction'

function render(): Scene {
  const model = new ScoreModel()
  model.addMeasure()
  for (const bar of [1, 2]) {
    const n = model.addNote({ step: 'E', alter: 0, octave: 5, duration: 'h', measure: bar, beat: frac(0, 1) })
    model.setFan(n.id, { direction: 'accel', count: 6, beams: 3 })
    if (bar === 2) setCue(model.getScore(), [n.id], true)
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

/** Per fan: its member heads' font sizes and x's, and its beam quads' thicknesses at the left end. */
function fans(scene: Scene) {
  return sceneGroups(scene, 'fan').map(g => {
    const heads = sceneGroups(g, 'fanhead').flatMap(m => scenePrimitives(m))
      .flatMap(p => (p.kind === 'text' && (p.text.codePointAt(0) ?? 0) >= 0xe0a0 && (p.text.codePointAt(0) ?? 0) <= 0xe0ff ? [p] : []))
    const quads = scenePrimitives(g).flatMap(p => (p.kind === 'path' && p.painted !== 'stroke' && p.ops.length >= 4 ? [p] : []))
    const thickness = quads.map(q => {
      const pts = q.kind === 'path' ? q.ops.filter(o => o.op !== 'closePath') as { x: number; y: number }[] : []
      return Math.abs(pts[1].y - pts[0].y)
    })
    return { sizes: heads.map(t => Number(t.kind === 'text' ? t.font.size : NaN)), xs: heads.map(t => (t.kind === 'text' ? t.x : NaN)), thickness }
  })
}

describe('FanPass — a cue fan', () => {
  const [full, cue] = fans(render())

  it('⭐ its members’ heads at the cue face (¾); the full fan’s at 30', () => {
    expect(full.sizes.length).toBe(5)
    expect(full.sizes.every(s => s === 30)).toBe(true)
    expect(cue.sizes.every(s => s === 22.5)).toBe(true)
  })

  it('⭐ its feathered beam is ¾ as thick (C7: a fan is one slot — all cue or not at all)', () => {
    expect(Math.max(...cue.thickness)).toBeCloseTo(Math.max(...full.thickness) * 0.75, 6)
  })

  it('⭐ closed up: its members stand closer (C8)', () => {
    const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
    expect(span(cue.xs)).toBeLessThan(span(full.xs))
  })
})
