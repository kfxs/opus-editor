/**
 * ⭐⭐ **THE CURVE'S INK, AS ARITHMETIC** — U1's dividend: a slur's and a tie's arc used to be
 * VexFlow's `Curve` painting itself, so *"where does the arch go"* needed a browser. It is a jsdom
 * assertion now.
 *
 * ⛔ These are assertions about the SHAPE THE NUMBERS MAKE, never about drawn ink extents — the
 * standing jsdom limit (no fonts, no layout) is untouched by owning a path.
 */
import { describe, it, expect } from 'vitest'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { scenePrimitives } from '@/engine/scene/Scene'
import type { CurveArc } from './curveInk'
import { curveArcPoints, curveControlPoints, drawCurveArcInk } from './curveInk'

/** A flat arc 100 px wide, bowing DOWN (+1) with a 10 px control height at both ends. */
const FLAT: CurveArc = {
  p0: { x: 0, y: 50 },
  p1: { x: 100, y: 50 },
  cps: [{ x: 0, y: 10 }, { x: 0, y: 10 }],
  direction: 1,
}

function record(arc: CurveArc, fillGap = 4): SceneRecorder {
  const r = new SceneRecorder()
  drawCurveArcInk(r as DrawContext, arc, fillGap)
  return r
}

describe('curveControlPoints', () => {
  it('⭐ spaces the controls a quarter of the span in from each end', () => {
    const { c0, c1 } = curveControlPoints(FLAT)
    expect(c0.x).toBe(25)
    expect(c1.x).toBe(75)
  })

  it('⭐ bows by the delta, SIGNED by the direction — the same shape flips about its ends', () => {
    expect(curveControlPoints(FLAT).c0.y).toBe(60)
    expect(curveControlPoints({ ...FLAT, direction: -1 }).c0.y).toBe(40)
  })

  it('⭐ a wider curve carries its controls proportionally further in, ⛔ not by a constant', () => {
    const wide = curveControlPoints({ ...FLAT, p1: { x: 400, y: 50 } })
    expect(wide.c0.x).toBe(100)
    expect(wide.c1.x).toBe(300)
  })
})

describe('the drawn arc', () => {
  it('⭐⭐ is TWO paths — a stroke-only outline and a fill-only body', () => {
    const prims = scenePrimitives(record(FLAT).scene)
    expect(prims.map(p => p.kind === 'path' && p.painted)).toEqual(['stroke', 'fill'])
  })

  it('⭐⭐ strokes the OPEN figure and fills the CLOSED one — the order is the ink', () => {
    const [outline, body] = scenePrimitives(record(FLAT).scene)
    // Out along the near edge, back along the bowed one: move + two cubics.
    expect(outline.kind === 'path' && outline.ops.map(o => o.op))
      .toEqual(['moveTo', 'bezierCurveTo', 'bezierCurveTo'])
    // The same figure, shut. ⚠️ If this ever reads as ONE op the recorder has gone back to
    // clearing its path on every paint, and the body's geometry is a lie.
    expect(body.kind === 'path' && body.ops.map(o => o.op))
      .toEqual(['moveTo', 'bezierCurveTo', 'bezierCurveTo', 'closePath'])
  })

  it('⭐ both passes share the endpoints EXACTLY, which is why the tips pinch to a point', () => {
    const [outline] = scenePrimitives(record(FLAT).scene)
    if (outline.kind !== 'path') throw new Error('not a path')
    const [, out, back] = outline.ops
    if (out.op !== 'bezierCurveTo' || back.op !== 'bezierCurveTo') throw new Error('not cubics')
    expect({ x: out.x, y: out.y }).toEqual(FLAT.p1)
    expect({ x: back.x, y: back.y }).toEqual(FLAT.p0)
  })

  it('⭐⭐ the return pass is the forward one bowed out by the FILL GAP, and that is the belly', () => {
    const [outline] = scenePrimitives(record(FLAT, 4).scene)
    if (outline.kind !== 'path') throw new Error('not a path')
    const [, out, back] = outline.ops
    if (out.op !== 'bezierCurveTo' || back.op !== 'bezierCurveTo') throw new Error('not cubics')
    // ⚠️ The return runs BACKWARD, so its first control is the forward pass's LAST, gapped.
    expect(back.cp1y - out.cp2y).toBe(4)
    expect(back.cp2y - out.cp1y).toBe(4)
  })

  it('⭐ bowing UP gaps the other way — one sign, ⛔ not a branch', () => {
    const [outline] = scenePrimitives(record({ ...FLAT, direction: -1 }, 4).scene)
    if (outline.kind !== 'path') throw new Error('not a path')
    const [, out, back] = outline.ops
    if (out.op !== 'bezierCurveTo' || back.op !== 'bezierCurveTo') throw new Error('not cubics')
    expect(back.cp1y - out.cp2y).toBe(-4)
  })
})

describe('the sampled arc', () => {
  it('⭐ starts and ends ON the endpoints', () => {
    const { points } = curveArcPoints(FLAT)
    expect(points).toHaveLength(17)
    expect(points[0]).toEqual(FLAT.p0)
    expect(points[16]).toEqual(FLAT.p1)
  })

  it('⭐⭐ arches by 0.75 of the control height — the apex a caller can predict', () => {
    const { points } = curveArcPoints(FLAT)
    const apex = Math.max(...points.map(p => p.y))
    // 50 + 0.75 × 10, the constant `TieRenderer` authors its bow against (`APEX_OF_BOW`).
    expect(apex).toBeCloseTo(57.5, 6)
  })

  it('⭐⭐ SAMPLES THE PATH THAT WAS DRAWN: its controls are the ink\'s own', () => {
    const { c0, c1 } = curveArcPoints(FLAT)
    const [outline] = scenePrimitives(record(FLAT).scene)
    if (outline.kind !== 'path') throw new Error('not a path')
    const out = outline.ops[1]
    if (out.op !== 'bezierCurveTo') throw new Error('not a cubic')
    // ⛔ The hit geometry and the drawn arc cannot drift: one owner, `curveControlPoints`.
    expect([out.cp1x, out.cp1y, out.cp2x, out.cp2y]).toEqual([c0.x, c0.y, c1.x, c1.y])
  })
})
