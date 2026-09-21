import { describe, it, expect } from 'vitest'
import { apply, isTranslation } from '@/engine/paint/Affine'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { SPINE_BLOCK_CLASS, drawSpineHeader, drawSpineStaff, type SpineNote } from './spineStaff'

/**
 * ⭐ A bent staff as a SCENE — so *"every note stands on the circle, turned to its tangent"* is
 * arithmetic in jsdom (`docs/plans/bent-staff-plan.md` A5).
 *
 * ⚠️ jsdom glyphs are 0 wide, so a head's centre is its left edge here: the assertions are about the
 * PLACEMENTS — which are exact — ⛔ never about where a glyph's ink landed.
 */

const quarter = (s: number): SpineNote => ({ step: 'B', alter: 0, octave: 4, duration: 'q', s })

const record = (draw: (ctx: SceneRecorder) => void) => {
  const recorder = new SceneRecorder()
  draw(recorder)
  return recorder.scene
}

describe('drawSpineStaff', () => {
  const CX = 400
  const CY = 400
  const R = 250
  const N = 8
  const spine = circleSpine(CX, CY, R)
  const notes = Array.from({ length: N }, (_, i) => quarter((spine.length * i) / N))
  const scene = record(ctx => drawSpineStaff(ctx, spine, notes))
  const blocks = sceneGroups(scene, SPINE_BLOCK_CLASS)

  it('draws one placed block per note, and each drew ink', () => {
    expect(blocks).toHaveLength(N)
    for (const block of blocks) expect(scenePrimitives(block).length).toBeGreaterThan(0)
  })

  it('⭐⭐ block i is TURNED by i/N of a full turn — a rotation, no scale, no skew', () => {
    blocks.forEach((block, i) => {
      const m = block.placement
      const angle = (2 * Math.PI * i) / N
      expect(m.a).toBeCloseTo(Math.cos(angle), 9)
      expect(m.b).toBeCloseTo(Math.sin(angle), 9)
      expect(m.c).toBeCloseTo(-Math.sin(angle), 9)
      expect(m.d).toBeCloseTo(Math.cos(angle), 9)
    })
  })

  it('⭐ every block keeps its upright distances: a placement never deforms', () => {
    for (const block of blocks) {
      const o = apply(block.placement, 0, 0)
      const p = apply(block.placement, 30, 40)
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(50, 9)
    }
  })

  it('draws the five lines FROM the spine — curves outside every block, on five concentric radii', () => {
    const lines = scene.children.filter(n => n.kind === 'path')
    expect(lines).toHaveLength(5)
    const radii = lines.map(line => {
      if (line.kind !== 'path') throw new Error('unreachable')
      const start = line.ops[0]
      if (start.op !== 'moveTo') throw new Error('a line starts with a moveTo')
      return Math.hypot(start.x - CX, start.y - CY)
    })
    // The top line IS the spine (less half its own ink); each next line is one space further IN.
    for (let i = 1; i < radii.length; i++) expect(radii[i - 1] - radii[i]).toBeCloseTo(10, 6)
    expect(radii[0]).toBeLessThanOrEqual(R)
    expect(radii[0]).toBeGreaterThan(R - 2)
  })

  it('⭐ on a STRAIGHT spine every block is placed by a pure translation — today’s staff, unchanged', () => {
    const straight = straightSpine(50, 100, 600)
    const flat = record(ctx => drawSpineStaff(ctx, straight, [quarter(100), quarter(300)]))
    for (const block of sceneGroups(flat, SPINE_BLOCK_CLASS)) expect(isTranslation(block.placement)).toBe(true)
  })
})

describe('drawSpineHeader — a clef and a meter are rigid blocks too', () => {
  const spine = circleSpine(400, 400, 250)
  const FOUR_FOUR = { numerator: 4, denominator: 4 }

  it('draws one placed block per sign, the meter only when asked for', () => {
    const both = record(ctx => { drawSpineHeader(ctx, spine, 0, { clef: 'treble', meter: FOUR_FOUR }) })
    expect(sceneGroups(both, SPINE_BLOCK_CLASS)).toHaveLength(2)
    const clefOnly = record(ctx => { drawSpineHeader(ctx, spine, 0, { clef: 'bass' }) })
    expect(sceneGroups(clefOnly, SPINE_BLOCK_CLASS)).toHaveLength(1)
  })

  it('⭐ answers where it ENDS, never before where it began — the next block starts from there', () => {
    let end = -1
    record(ctx => { end = drawSpineHeader(ctx, spine, 100, { clef: 'treble', meter: FOUR_FOUR }) })
    expect(end).toBeGreaterThanOrEqual(100)
  })

  it('a sign is turned, never deformed', () => {
    const scene = record(ctx => { drawSpineHeader(ctx, spine, spine.length / 4, { clef: 'treble' }) })
    const [clef] = sceneGroups(scene, SPINE_BLOCK_CLASS)
    const o = apply(clef.placement, 0, 0)
    const p = apply(clef.placement, 30, 40)
    expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(50, 9)
    expect(isTranslation(clef.placement)).toBe(false)
  })
})
