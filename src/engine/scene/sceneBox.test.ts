/**
 * ⭐⭐ **A BOX, AS ARITHMETIC** — P6a's own spec. Every assertion here previously needed a browser,
 * because the only rulers were VexFlow's object fields and the page's `getBBox()`.
 *
 * ⛔ **These do not prove the numbers are RIGHT about the page** — that is `e2e/sceneBox.e2e.ts`,
 * which renders in a browser and compares this box against what the SVG reports. These prove the
 * arithmetic: what unions, what is excluded, what a placement does, and — the part that matters most
 * — **what it refuses to answer**.
 */
import { describe, it, expect } from 'vitest'
import type { Scene, SceneNode } from './Scene'
import { IDENTITY, scaling, translation } from '@/engine/paint/Affine'
import { sceneInkBox, sceneInkBoxDetail, type SpacePxReader } from './sceneBox'

/** A dialect where one staff space is 10px at size 40 — the shape `rendering/sceneInk` supplies. */
const spacePx: SpacePxReader = font => (typeof font.size === 'number' ? font.size / 4 : null)

const NO_STYLE = { fill: undefined, stroke: undefined, lineWidth: undefined, lineDash: undefined }

const rect = (x: number, y: number, width: number, height: number): SceneNode =>
  ({ kind: 'rect', x, y, width, height, style: NO_STYLE })

const group = (children: SceneNode[], extra: Partial<{ placement: typeof IDENTITY; cls: string; discarded: boolean }> = {}): SceneNode =>
  ({ kind: 'group', placement: IDENTITY, tags: {}, children, ...extra })

const scene = (children: SceneNode[]): Scene => ({ children })

describe('a primitive', () => {
  it('⭐ a rect is its own box', () => {
    expect(sceneInkBox(rect(10, 20, 30, 40), spacePx)).toEqual({ x: 10, y: 20, width: 30, height: 40 })
  })

  it('⭐ a FILLED path is the bounds of its ops, with no pen margin', () => {
    const path: SceneNode = {
      kind: 'path', painted: 'fill', style: { ...NO_STYLE, lineWidth: 8 },
      ops: [{ op: 'moveTo', x: 0, y: 0 }, { op: 'lineTo', x: 10, y: 4 }, { op: 'closePath' }],
    }
    expect(sceneInkBox(path, spacePx)).toEqual({ x: 0, y: 0, width: 10, height: 4 })
  })

  it('⭐⭐ a STROKED path is wider than its geometry by half its pen — on every side', () => {
    const path: SceneNode = {
      kind: 'path', painted: 'stroke', style: { ...NO_STYLE, lineWidth: 4 },
      ops: [{ op: 'moveTo', x: 0, y: 0 }, { op: 'lineTo', x: 10, y: 0 }],
    }
    expect(sceneInkBox(path, spacePx)).toEqual({ x: -2, y: -2, width: 14, height: 4 })
  })

  it('⭐⭐ a CUBIC is bounded by where it actually REACHES — ⛔ not by its control hull', () => {
    // Controls at y=100, but a cubic only reaches 3/4 of the way to a symmetric control pair.
    const path: SceneNode = {
      kind: 'path', painted: 'fill', style: NO_STYLE,
      ops: [
        { op: 'moveTo', x: 0, y: 0 },
        { op: 'bezierCurveTo', cp1x: 25, cp1y: 100, cp2x: 75, cp2y: 100, x: 100, y: 0 },
      ],
    }
    const box = sceneInkBox(path, spacePx)!
    expect(box.height, 'the apex is 0.75 × the control height').toBeCloseTo(75, 6)
    // 🚨 The break-test for the claim: the hull would have said 100, and a box that says 100 where
    // the ink reaches 75 reserves a quarter-space of room nothing occupies.
    expect(box.height).not.toBeCloseTo(100, 1)
  })

  it('⭐ a glyph is its MEASURED ink, hung on the stamp’s baseline and scaled by the drawn size', () => {
    // `augmentationDot` is a small round dot; at size 40 one staff space is 10px.
    const text: SceneNode = {
      kind: 'text', text: '', x: 50, y: 60, font: { family: 'Bravura', size: 40 }, style: NO_STYLE,
    }
    const box = sceneInkBox(text, spacePx)!
    expect(box.width, 'a dot is well under a staff space wide').toBeGreaterThan(0)
    expect(box.width).toBeLessThan(10)
    expect(box.x, 'its ink starts at the stamp, give or take its own bearing').toBeCloseTo(50, 0)
    expect(box.y + box.height / 2, 'and straddles the baseline it was stamped on').toBeCloseTo(60, 0)
  })
})

describe('⛔ what it refuses to answer', () => {
  const unmeasured: SceneNode = {
    kind: 'text', text: 'Allegro', x: 0, y: 0, font: { family: 'Academico', size: 40 }, style: NO_STYLE,
  }

  it('🚨🚨 a glyph we have not measured makes the whole box NULL — ⛔ never a smaller rectangle', () => {
    expect(sceneInkBox(scene([rect(0, 0, 10, 10), unmeasured]), spacePx)).toBeNull()
  })

  it('⭐ …and the detail says WHAT it could not measure, so a caller can act rather than guess', () => {
    const detail = sceneInkBoxDetail(scene([rect(0, 0, 10, 10), unmeasured]), spacePx)
    expect(detail.unmeasured).toEqual(['Allegro'])
    expect(detail.box, 'a box over the REST of it — ⚠️ and this is the value that must not be believed')
      .toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('🚨 a size in a dialect the reader does not speak is UNMEASURED, ⛔ not assumed', () => {
    const em: SceneNode = {
      kind: 'text', text: '', x: 0, y: 0, font: { family: 'Bravura', size: '2em' }, style: NO_STYLE,
    }
    expect(sceneInkBoxDetail(em, spacePx).unmeasured).toEqual([''])
  })
})

describe('a group', () => {
  it('⭐ unions its children', () => {
    const box = sceneInkBox(group([rect(0, 0, 10, 10), rect(20, 5, 10, 10)]), spacePx)
    expect(box).toEqual({ x: 0, y: 0, width: 30, height: 15 })
  })

  it('⭐⭐ carries a PLACEMENT, and the children are measured inside it', () => {
    const inner = [rect(0, 0, 10, 10)]
    expect(sceneInkBox(group(inner, { placement: translation(100, 50) }), spacePx))
      .toEqual({ x: 100, y: 50, width: 10, height: 10 })
    expect(sceneInkBox(group(inner, { placement: scaling(0.7) }), spacePx))
      .toEqual({ x: 0, y: 0, width: 7, height: 7 })
  })

  it('⭐⭐ THE CALLER CHOOSES WHAT COUNTS — the one thing VexFlow’s box cannot do', () => {
    // The reason `rendering/noteInkBox` had to exist: `StaveNote.getBoundingBox()` unions every
    // modifier hanging off the note, so a head's "box" spans its accidentals and dots.
    const head = group([rect(0, 0, 10, 10)], { cls: 'notehead' })
    const accidental = group([rect(-20, 0, 8, 10)], { cls: 'accidental' })
    const note = group([head, accidental])
    expect(sceneInkBox(note, spacePx), 'everything').toEqual({ x: -20, y: 0, width: 30, height: 10 })
    expect(sceneInkBox(note, spacePx, n => n.kind !== 'group' || n.cls !== 'accidental'), 'heads only')
      .toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('⛔ a POINTER RECT is not ink — a hit surface must not become the ink box', () => {
    const withTarget = group([rect(0, 0, 10, 10), { kind: 'pointerRect', x: -50, y: -50, width: 200, height: 200 }])
    expect(sceneInkBox(withTarget, spacePx)).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('⛔ a DISCARDED group drew and was thrown away, so it is not ink either', () => {
    const ghost = group([rect(100, 100, 10, 10)], { discarded: true })
    expect(sceneInkBox(group([rect(0, 0, 10, 10), ghost]), spacePx)).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('⭐ an empty group has NO box — ⛔ not a zero-sized one at the origin', () => {
    expect(sceneInkBox(group([]), spacePx)).toBeNull()
  })
})
