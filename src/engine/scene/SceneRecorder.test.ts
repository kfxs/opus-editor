import { describe, it, expect } from 'vitest'
import { IDENTITY, scaling, translation } from '@/engine/paint/Affine'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { DrawGroup, OpenedGroup } from '@/engine/paint/DrawGroup'
import { SceneRecorder } from './SceneRecorder'
import { sceneGroups, scenePrimitives, walkScene } from './Scene'
import type { SceneGroup } from './Scene'

/**
 * ⭐ **No jsdom** — deliberately, and it is the headline: a recorder needs no page, which is what
 * makes the scene a unit-testable artefact at all (`docs/own-engraving-engine.md` §7.2).
 */

/** A DrawGroup that just remembers what it was told — the "real painter" half of a tee. */
function fakeGroup(log: string[], name: string): DrawGroup {
  return {
    setPlacement: () => log.push(`${name}.setPlacement`),
    inkBox: () => ({ x: 0, y: 0, width: 11, height: 22 }),
    discard: () => log.push(`${name}.discard`),
    tag: (k, v) => log.push(`${name}.tag:${k}=${v}`),
    tagLast: (k, v) => log.push(`${name}.tagLast:${k}=${v}`),
    node: () => `node:${name}`,
  }
}

/** A DrawContext that records nothing but the call names — stands in for the SVG painter. */
function fakePainter(log: string[]): { ctx: DrawContext; wrap: (o: OpenedGroup) => DrawGroup | null } {
  const ctx = {
    beginPath: () => log.push('beginPath'),
    moveTo: () => log.push('moveTo'),
    lineTo: () => log.push('lineTo'),
    bezierCurveTo: () => log.push('bezierCurveTo'),
    closePath: () => log.push('closePath'),
    stroke: () => log.push('stroke'),
    fill: () => log.push('fill'),
    fillRect: () => log.push('fillRect'),
    setFont: () => log.push('setFont'),
    fillText: () => log.push('fillText'),
    setFillStyle: () => log.push('setFillStyle'),
    setStrokeStyle: () => log.push('setStrokeStyle'),
    setLineWidth: () => log.push('setLineWidth'),
    setLineDash: () => log.push('setLineDash'),
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    scale: () => log.push('scale'),
    openGroup: (cls?: string) => { log.push(`openGroup:${cls}`); return { raw: cls } },
    closeGroup: () => log.push('closeGroup'),
    pointerRect: () => log.push('pointerRect'),
  } satisfies DrawContext
  return { ctx, wrap: (o) => fakeGroup(log, (o as { raw?: string }).raw ?? '?') }
}

describe('recording primitives', () => {
  it('⭐ a fillRect becomes a rect with the style it was drawn under', () => {
    const r = new SceneRecorder()
    r.setFillStyle('red')
    r.fillRect(1, 2, 3, 4)
    expect(scenePrimitives(r.scene)).toEqual([
      { kind: 'rect', x: 1, y: 2, width: 3, height: 4, style: { fill: 'red', stroke: undefined, lineWidth: undefined, lineDash: undefined } },
    ])
  })

  it('⭐ the style is a SNAPSHOT — a later change does not rewrite an earlier primitive', () => {
    const r = new SceneRecorder()
    r.setFillStyle('red')
    r.fillRect(0, 0, 1, 1)
    r.setFillStyle('blue')
    r.fillRect(2, 2, 1, 1)
    const [first, second] = scenePrimitives(r.scene)
    expect(first.kind === 'rect' && first.style.fill).toBe('red')
    expect(second.kind === 'rect' && second.style.fill).toBe('blue')
  })

  it('⭐ a path collects its ops and remembers how it was painted', () => {
    const r = new SceneRecorder()
    r.beginPath(); r.moveTo(0, 0); r.lineTo(10, 0); r.closePath(); r.stroke()
    const [p] = scenePrimitives(r.scene)
    expect(p.kind).toBe('path')
    expect(p.kind === 'path' && p.ops).toEqual([
      { op: 'moveTo', x: 0, y: 0 }, { op: 'lineTo', x: 10, y: 0 }, { op: 'closePath' },
    ])
    expect(p.kind === 'path' && p.painted).toBe('stroke')
  })

  // ⚠️ `renderCurve` strokes AND fills the same path, and the selection highlight has to override
  // both — so this must be ONE primitive that knows it was painted twice, not two.
  it('⭐⭐ a path stroked THEN filled is one primitive marked `both`', () => {
    const r = new SceneRecorder()
    r.beginPath(); r.moveTo(0, 0); r.lineTo(5, 5); r.stroke(); r.fill()
    const prims = scenePrimitives(r.scene)
    expect(prims).toHaveLength(1)
    expect(prims[0].kind === 'path' && prims[0].painted).toBe('both')
  })

  it('⭐ text carries the FONT that was set for it, in one shape whichever way it was given', () => {
    const r = new SceneRecorder()
    r.setFont({ family: 'Bravura', size: 30, weight: 'normal', style: 'normal' })
    r.fillText('', 7, 8)
    const [t] = scenePrimitives(r.scene)
    expect(t).toEqual({
      kind: 'text', text: '', x: 7, y: 8,
      font: { family: 'Bravura', size: 30, weight: 'normal', style: 'normal' },
      style: { fill: undefined, stroke: undefined, lineWidth: undefined, lineDash: undefined },
    })
  })

  it('a pointerRect is recorded and is NOT ink', () => {
    const r = new SceneRecorder()
    r.pointerRect(1, 1, 2, 2)
    expect(scenePrimitives(r.scene)[0].kind).toBe('pointerRect')
  })
})

describe('save / restore — ⭐ here they mean what they say', () => {
  it('restores the style that was saved', () => {
    const r = new SceneRecorder()
    r.setFillStyle('red')
    r.save()
    r.setFillStyle('blue')
    r.fillRect(0, 0, 1, 1)
    r.restore()
    r.fillRect(1, 1, 1, 1)
    const [inner, outer] = scenePrimitives(r.scene)
    expect(inner.kind === 'rect' && inner.style.fill).toBe('blue')
    expect(outer.kind === 'rect' && outer.style.fill, 'the saved style came back').toBe('red')
  })

  it('⛔ an unbalanced restore does not throw — it resets to a clean state', () => {
    const r = new SceneRecorder()
    expect(() => r.restore()).not.toThrow()
  })
})

describe('groups', () => {
  it('⭐ nest, and a primitive lands in the innermost open one', () => {
    const r = new SceneRecorder()
    r.openGroup('outer')
    r.fillRect(0, 0, 1, 1)
    r.openGroup('inner')
    r.fillRect(2, 2, 1, 1)
    r.closeGroup()
    r.closeGroup()
    r.fillRect(9, 9, 1, 1)

    const outer = sceneGroups(r.scene, 'outer')[0]
    const inner = sceneGroups(r.scene, 'inner')[0]
    expect(outer.children.filter(c => c.kind === 'rect')).toHaveLength(1)
    expect(inner.children.filter(c => c.kind === 'rect')).toHaveLength(1)
    expect(r.scene.children.filter(c => c.kind === 'rect'), 'the last one is at the top').toHaveLength(1)
  })

  it('⭐⭐ a placement is stored as an AFFINE — rule 8, not a string and not an x/y', () => {
    const r = new SceneRecorder()
    const g = r.openGroup('scaled') as DrawGroup
    g.setPlacement(scaling(0.7))
    r.closeGroup()
    expect(sceneGroups(r.scene, 'scaled')[0].placement).toEqual(scaling(0.7))
  })

  it('a fresh group is placed by IDENTITY', () => {
    const r = new SceneRecorder()
    r.openGroup('plain'); r.closeGroup()
    expect(sceneGroups(r.scene, 'plain')[0].placement).toEqual(IDENTITY)
  })

  it('⭐ `tag` marks the group and `tagLast` marks the primitive just drawn', () => {
    const r = new SceneRecorder()
    const g = r.openGroup('bar') as DrawGroup
    g.tag('data-no-hint', '1')
    r.fillRect(0, 0, 1, 1)
    g.tagLast('data-half', 'end')
    r.fillRect(5, 0, 1, 1)
    g.tagLast('data-half', 'start')
    r.closeGroup()

    const bar = sceneGroups(r.scene, 'bar')[0]
    expect(bar.tags).toEqual({ 'data-no-hint': '1' })
    const halves = bar.children.map(c => (c as { tags?: Record<string, string> }).tags?.['data-half'])
    expect(halves, 'each stroke says which half it is').toEqual(['end', 'start'])
  })

  it('⛔ discard MARKS rather than deletes — “drew and was thrown away” ≠ “never drew”', () => {
    const r = new SceneRecorder()
    const g = r.openGroup('ghost') as DrawGroup
    r.fillRect(0, 0, 1, 1)
    r.closeGroup()
    g.discard()
    const ghost = sceneGroups(r.scene, 'ghost')[0]
    expect(ghost.discarded).toBe(true)
    expect(ghost.children, 'what it drew is still on record').toHaveLength(1)
  })

  it('⛔ an unbalanced closeGroup never pops the root', () => {
    const r = new SceneRecorder()
    r.closeGroup(); r.closeGroup()
    r.fillRect(0, 0, 1, 1)
    expect(scenePrimitives(r.scene)).toHaveLength(1)
  })

  it('⭐ ctx.scale becomes a placed wrapper group — ⛔ it is not folded into coordinates', () => {
    const r = new SceneRecorder()
    r.scale(2, 3)
    r.fillRect(1, 1, 1, 1)
    const wrapper = [...walkScene(r.scene)].find(n => n.kind === 'group') as SceneGroup
    expect(wrapper.placement).toEqual(scaling(2, 3))
    expect(wrapper.children.filter(c => c.kind === 'rect'), 'the ink is INSIDE it').toHaveLength(1)
  })

  it('standalone, inkBox is null — ⛔ a recorder never guesses a box', () => {
    const r = new SceneRecorder()
    const g = r.openGroup('x') as DrawGroup
    expect(g.inkBox()).toBeNull()
  })
})

describe('⭐⭐ teeing onto a real painter', () => {
  it('forwards every primitive as well as recording it', () => {
    const log: string[] = []
    const { ctx, wrap } = fakePainter(log)
    const r = new SceneRecorder(ctx, wrap)
    r.setFillStyle('red')
    r.fillRect(0, 0, 1, 1)
    r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.stroke()
    expect(log).toEqual(['setFillStyle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke'])
    expect(scenePrimitives(r.scene)).toHaveLength(2)
  })

  // 🚨 THE BUG THIS FILE CAUGHT. The first tee could not wrap what the painter returned, so every
  // placement, tag and discard was recorded and NEVER PAINTED — silently, on every recorded render.
  it('🚨🚨 forwards GROUP operations too — placement, tags and discard reach the real page', () => {
    const log: string[] = []
    const { ctx, wrap } = fakePainter(log)
    const r = new SceneRecorder(ctx, wrap)
    const g = r.openGroup('bar') as DrawGroup
    g.setPlacement(translation(3, 4))
    g.tag('data-no-hint', '1')
    g.tagLast('data-half', 'end')
    g.discard()
    r.closeGroup()
    expect(log).toEqual([
      'openGroup:bar', 'bar.setPlacement', 'bar.tag:data-no-hint=1', 'bar.tagLast:data-half=end',
      'bar.discard', 'closeGroup',
    ])
    // …and it is still recorded.
    expect(sceneGroups(r.scene, 'bar')[0].placement).toEqual(translation(3, 4))
  })

  // 🚨 THE SECOND BUG. Six highlight maps store what `node()` answers and the editor recolours it
  // later; handing them a SceneGroup would fill those maps with objects no highlight can paint.
  it('🚨🚨 `node()` answers the REAL painter’s node while teeing, ⛔ not the scene group', () => {
    const log: string[] = []
    const { ctx, wrap } = fakePainter(log)
    const r = new SceneRecorder(ctx, wrap)
    const g = r.openGroup('slur') as DrawGroup
    expect(g.node()).toBe('node:slur')
  })

  it('…and answers its own scene group when there is no painter to defer to', () => {
    const r = new SceneRecorder()
    const g = r.openGroup('slur') as DrawGroup
    expect((g.node() as SceneGroup).cls).toBe('slur')
  })

  it('⭐ inkBox comes from the real painter — the recorder cannot measure ink', () => {
    const log: string[] = []
    const { ctx, wrap } = fakePainter(log)
    const r = new SceneRecorder(ctx, wrap)
    const g = r.openGroup('ghost') as DrawGroup
    expect(g.inkBox()).toEqual({ x: 0, y: 0, width: 11, height: 22 })
  })
})
