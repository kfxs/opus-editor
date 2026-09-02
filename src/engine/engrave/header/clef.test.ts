/**
 * Subject: `./clef` — the clef's ink and its one placement rule (P5b).
 *
 * ⭐ The rule under test is deliberately small: *the anchor line's y IS the glyph's baseline*. What
 * the spec is really pinning is the two things around it — that the y is a BASELINE rather than a
 * top or a centre (the mistake `CenteredTremolo`'s header is the cautionary tale for), and that the
 * `clef` GROUP and its id survive, because `clefIndentPass.test.ts` finds a drawn clef by
 * `g.vf-clef text` and `ElementRegistry` resolves its hit box by that id.
 */
import { describe, it, expect } from 'vitest'
import { clefPlacement, drawClef } from './clef'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, SceneGroup, ScenePrimitive } from '@/engine/scene/Scene'

/** SMuFL `gClef` (U+E050) — what VexFlow hands a treble stave. */
const G_CLEF = ''
const FONT = { family: 'Bravura,Academico', size: 38, weight: 'normal', style: 'normal' }

function texts(scene: Scene | SceneGroup): Extract<ScenePrimitive, { kind: 'text' }>[] {
  const out: Extract<ScenePrimitive, { kind: 'text' }>[] = []
  for (const child of scene.children) {
    if (child.kind === 'group') out.push(...texts(child))
    else if (child.kind === 'text') out.push(child)
  }
  return out
}

describe('clefPlacement — a clef stands ON the line it names', () => {
  it('⭐ the anchor line’s y IS the baseline — ⛔ not a top, ⛔ not a centre', () => {
    expect(clefPlacement({ x: 12, lineY: 80 })).toEqual({ x: 12, baselineY: 80 })
  })

  it('⭐⭐ …so the SAME clef on two staves differs by exactly the stave offset, and nothing else', () => {
    const upper = clefPlacement({ x: 12, lineY: 80 })
    const lower = clefPlacement({ x: 12, lineY: 200 })
    expect(lower.baselineY - upper.baselineY).toBe(120)
    expect(lower.x, 'the x is the header’s, and a staff below does not move it').toBe(upper.x)
  })

  it('⚠️ the anchor is what the CALLER resolved — this adds no nudge of its own', () => {
    // 🚨 The whole guard of this spec: a fudge factor added here would be an engraving rule invented
    // ahead of `docs/clef-research.md`. A treble clef's ink reaching far above the staff is the
    // FONT's business — the glyph's origin is cut to sit on its anchor line.
    for (const lineY of [-40, 0, 0.5, 137.25, 1e4]) {
      expect(clefPlacement({ x: 0, lineY }).baselineY).toBe(lineY)
    }
  })
})

describe('drawClef — the ink', () => {
  const at = clefPlacement({ x: 12, lineY: 80 })

  it('⭐ one glyph, in the face it was handed, inside a `clef` group that keeps its id', () => {
    const recorder = new SceneRecorder()
    drawClef(recorder, G_CLEF, at, FONT, 'vf-auto-1234')

    const group = recorder.scene.children[0]
    expect(group.kind === 'group' && group.cls, 'VexFlow drew a `vf-clef` group, so we draw one').toBe('clef')
    // 🚨 The id is not decoration — see the module header.
    expect(group.kind === 'group' && group.id).toBe('vf-auto-1234')
    expect(texts(recorder.scene)).toEqual([{
      kind: 'text', text: G_CLEF, x: 12, y: 80, font: FONT, style: {},
    }])
  })

  it('⛔ an empty glyph draws nothing at all — not even a group', () => {
    const recorder = new SceneRecorder()
    drawClef(recorder, '', at, FONT)
    expect(recorder.scene.children).toEqual([])
  })

  it('⚠️ the group closes after each clef — an unbalanced pair swallows the render', () => {
    const recorder = new SceneRecorder()
    drawClef(recorder, G_CLEF, at, FONT)
    drawClef(recorder, G_CLEF, at, FONT)
    // Two SIBLINGS, ⛔ not one nested inside the other.
    expect(recorder.scene.children).toHaveLength(2)
    expect(recorder.scene.children.every(c => c.kind === 'group')).toBe(true)
  })
})
