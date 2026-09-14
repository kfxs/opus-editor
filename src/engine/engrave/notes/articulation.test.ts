/**
 * ⭐ The articulation's ink — the stamp, and the boundary.
 *
 * ⚠️ There is no placement arithmetic to assert here and that is the STEP's statement, not a gap in
 * the spec: an articulation's side, its distance from the staff and its snap onto a line or into a
 * space are all still `Articulation.draw`'s (see the module header). What this file pins is that the
 * ink goes where it was told and opens nothing of its own.
 */
import { describe, it, expect } from 'vitest'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { scenePrimitives } from '@/engine/scene/Scene'
import { drawArticulation } from './articulation'

/** `articAccentAbove` — ⚠️ a different character from `articAccentBelow` (U+E4A1): the SIDE is in
 *  the glyph, chosen by `Articulation.setPosition`, and never by anything here. */
const ACCENT_ABOVE = ''

describe('drawArticulation', () => {
  it('⭐ stamps ONE glyph at the point it was handed, in the face it was handed', () => {
    const r = new SceneRecorder()
    drawArticulation(r, { glyph: ACCENT_ABOVE, x: 120, y: 55, font: { family: 'Bravura', size: 30 } })
    expect(scenePrimitives(r.scene)).toEqual([
      {
        kind: 'text', text: ACCENT_ABOVE, x: 120, y: 55,
        font: { family: 'Bravura', size: 30 },
        style: { fill: undefined, stroke: undefined, lineWidth: undefined, lineDash: undefined },
      },
    ])
  })

  it('⭐ opens a group of its OWN kind, carrying the mark’s id', () => {
    // ⭐⭐ **A group of its own, as of 2026-09-14** — his report: a sign that can be SELECTED must be
    // findable in the scene, or `__bbox.ink()` has no box to draw for it and the notehead's box
    // silently swallows it. ⚠️ VexFlow opened none; this is the family's one DOM change.
    const r = new SceneRecorder()
    drawArticulation(r, { glyph: ACCENT_ABOVE, x: 0, y: 0, font: undefined, id: 'auto9' })
    const [group] = r.scene.children
    expect(group.kind === 'group' && [group.cls, group.id]).toEqual(['articulation', 'auto9'])
    expect(group.kind === 'group' && scenePrimitives(group)).toHaveLength(1)
  })

  it('🚨 the break-test — an empty glyph draws NOTHING, so a missing code cannot leave a blank mark', () => {
    const r = new SceneRecorder()
    drawArticulation(r, { glyph: '', x: 10, y: 10, font: undefined })
    expect(scenePrimitives(r.scene)).toHaveLength(0)
  })
})
