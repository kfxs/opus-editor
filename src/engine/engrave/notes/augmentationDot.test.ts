/**
 * ⭐ The augmentation dot's ink — the half-space lift that keeps it out of a staff line, and the
 * stamp. ⛔ The lift's SIGN is decided upstream (`Dot.format`); this module applies it.
 */
import { describe, it, expect } from 'vitest'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { scenePrimitives } from '@/engine/scene/Scene'
import { dotBaselineY, drawAugmentationDot } from './augmentationDot'

describe('dotBaselineY', () => {
  it('⭐ a dot whose head sits IN a space is not moved at all', () => {
    expect(dotBaselineY(40, 0, 10)).toBe(40)
  })

  it('⭐⭐ a head ON a line lifts its dot half a space UP the page — the rule in one line', () => {
    // `Dot.format` writes -0.5 for a head on a line (y grows downward, so up is negative).
    expect(dotBaselineY(40, -0.5, 10)).toBe(35)
  })

  it('⭐ …and the flip is the same arithmetic with the other sign — ⛔ never a second branch', () => {
    expect(dotBaselineY(40, 0.5, 10)).toBe(45)
  })

  it('⭐⭐ the lift is in STAFF SPACES, so a SMALL staff lifts less — ⛔ never a pixel constant', () => {
    expect(dotBaselineY(40, -0.5, 10)).toBe(35)
    expect(dotBaselineY(40, -0.5, 6)).toBe(37)
  })
})

describe('drawAugmentationDot', () => {
  it('⭐ stamps ONE glyph, in a group of its OWN kind, carrying the dot’s id', () => {
    // ⭐⭐ **A group of its own, as of 2026-09-14** — his report: a sign that can be SELECTED must be
    // findable in the scene, or `__bbox.ink()` has no box to draw for it and the notehead's box
    // silently swallows it. ⚠️ VexFlow opened none; this is the family's one DOM change.
    const r = new SceneRecorder()
    drawAugmentationDot(r, { glyph: '', x: 55, y: 35, font: { family: 'Bravura', size: 30 }, id: 'auto7' })
    const prims = scenePrimitives(r.scene)
    expect(prims).toHaveLength(1)
    expect(prims[0].kind === 'text' && [prims[0].text, prims[0].x, prims[0].y]).toEqual(['', 55, 35])
    const [group] = r.scene.children
    // ⚠️ The REGISTRY's kind name, ⛔ not VexFlow's category: P6b has to match this group to the
    // hit box the editor already files for the same dot.
    expect(group.kind === 'group' && [group.cls, group.id]).toEqual(['dot', 'auto7'])
  })
})
