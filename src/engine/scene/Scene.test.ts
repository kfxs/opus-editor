import { describe, it, expect } from 'vitest'
import { IDENTITY } from '@/engine/paint/Affine'
import { scenePrimitives, sceneGroups, walkScene } from './Scene'
import type { Scene, SceneGroup, ScenePrimitive } from './Scene'

/** A group with the given children — the shape a recorder builds. */
function group(cls: string, children: (ScenePrimitive | SceneGroup)[]): SceneGroup {
  return { kind: 'group', cls, placement: IDENTITY, tags: {}, children }
}

const rect = (x: number): ScenePrimitive =>
  ({ kind: 'rect', x, y: 0, width: 1, height: 1, style: {} })

/**
 * ⭐ The readers a scene assertion is written with. Small, but they are the whole ergonomics of
 * *"geometry is a unit test"* — a spec that had to walk the tree by hand would not get written.
 */
const scene: Scene = {
  children: [
    rect(1),
    group('bar', [rect(2), group('inner', [rect(3)])]),
    group('bar', [rect(4)]),
  ],
}

describe('walkScene', () => {
  it('⭐ is depth-first, PARENTS BEFORE CHILDREN, in draw order', () => {
    const seen = [...walkScene(scene)].map(n => n.kind === 'group' ? `g:${n.cls}` : `${n.kind}:${(n as { x: number }).x}`)
    expect(seen).toEqual(['rect:1', 'g:bar', 'rect:2', 'g:inner', 'rect:3', 'g:bar', 'rect:4'])
  })

  it('walks a GROUP as happily as a whole scene — the same shape', () => {
    const bar = sceneGroups(scene, 'bar')[0]
    expect([...walkScene(bar)]).toHaveLength(3)
  })
})

describe('scenePrimitives', () => {
  it('⭐ flattens to the ink alone, in draw order, groups dropped', () => {
    expect(scenePrimitives(scene).map(p => (p as { x: number }).x)).toEqual([1, 2, 3, 4])
  })

  it('is empty for an empty scene — ⛔ the answer a vacuous assertion would hide', () => {
    expect(scenePrimitives({ children: [] })).toEqual([])
  })
})

describe('sceneGroups', () => {
  it('⭐ finds EVERY group with that class, however deep', () => {
    expect(sceneGroups(scene, 'bar')).toHaveLength(2)
    expect(sceneGroups(scene, 'inner')).toHaveLength(1)
  })
})
