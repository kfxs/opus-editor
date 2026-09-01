/**
 * The stem's ink, in jsdom.
 *
 * ⛔ There is deliberately no spec here for how LONG a stem is: P3c took the ink and left the length
 * with VexFlow until `docs/stem-length-research.md` states a rule. A test asserting a length now
 * would be pinning VexFlow's answer as if it were ours.
 */
import { describe, it, expect } from 'vitest'
import { drawStem } from './stem'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, ScenePrimitive } from '@/engine/scene/Scene'

type ScenePath = Extract<ScenePrimitive, { kind: 'path' }>

function paths(scene: Scene): ScenePath[] {
  return scene.children.filter((c): c is ScenePath => c.kind === 'path')
}

describe('drawStem', () => {
  it('⭐ a stroked vertical line at one x, between the two y’s it was given', () => {
    const recorder = new SceneRecorder()
    drawStem(recorder, { x: 100, fromY: 160, toY: 90 }, 1.5)

    expect(paths(recorder.scene)).toEqual([{
      kind: 'path',
      painted: 'stroke',
      ops: [{ op: 'moveTo', x: 100, y: 160 }, { op: 'lineTo', x: 100, y: 90 }],
      style: { fill: undefined, stroke: undefined, lineWidth: 1.5, lineDash: undefined },
    }])
  })

  it('⭐ …and it is the same line either way up — the y’s carry the direction, not a flag', () => {
    const up = new SceneRecorder()
    const down = new SceneRecorder()
    drawStem(up, { x: 100, fromY: 160, toY: 90 }, 1.5)
    drawStem(down, { x: 100, fromY: 90, toY: 160 }, 1.5)
    expect(paths(up.scene)[0].ops[1]).toEqual({ op: 'lineTo', x: 100, y: 90 })
    expect(paths(down.scene)[0].ops[1]).toEqual({ op: 'lineTo', x: 100, y: 160 })
  })

  it('the thickness is the caller’s — ⛔ this module owns no constant', () => {
    const recorder = new SceneRecorder()
    drawStem(recorder, { x: 0, fromY: 0, toY: 10 }, 0.12)
    expect(paths(recorder.scene)[0].style.lineWidth).toBe(0.12)
  })

  it('⛔ opens no group — the group belongs to the stem OBJECT’s identity, not to the ink', () => {
    const recorder = new SceneRecorder()
    drawStem(recorder, { x: 0, fromY: 0, toY: 10 }, 1.5)
    // 🚨 The selection highlight finds a stem by its group id; a group opened here would give the
    // fan's two hand-drawn stems one they never had, changing ink the highlight recolours.
    expect(recorder.scene.children.every(c => c.kind !== 'group')).toBe(true)
  })
})
