/**
 * The flag's placement rule, in jsdom — ⭐ and the point of the spec is the SECOND describe: the
 * font reach is a NAMED INPUT now, so *"what happens when the font has not measured yet"* is a case
 * that can be written down instead of a bug that appears on someone's first render
 * (`docs/plans/own-engraving-engine.md` §3).
 */
import { describe, it, expect } from 'vitest'
import { flagPlacement, drawFlag } from './flag'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, SceneGroup, ScenePrimitive } from '@/engine/scene/Scene'

const STEM_WIDTH = 1.5

function texts(scene: Scene | SceneGroup): Extract<ScenePrimitive, { kind: 'text' }>[] {
  const out: Extract<ScenePrimitive, { kind: 'text' }>[] = []
  for (const child of scene.children) {
    if (child.kind === 'group') out.push(...texts(child))
    else if (child.kind === 'text') out.push(child)
  }
  return out
}

describe('flagPlacement — the glyph’s outer edge meets the stem tip', () => {
  it('⭐ an UP stem: the flag hangs DOWN from the tip, so its baseline is the reach BELOW it', () => {
    expect(flagPlacement({ x: 100, tipY: 40, up: true }, STEM_WIDTH, 8))
      .toEqual({ x: 99.25, baselineY: 48 })
  })

  it('⭐ a DOWN stem: it rises from the tip, so the baseline is the reach ABOVE it', () => {
    expect(flagPlacement({ x: 100, tipY: 160, up: false }, STEM_WIDTH, 8))
      .toEqual({ x: 99.25, baselineY: 152 })
  })

  it('the glyph starts at the stem’s LEFT EDGE, never its centre line', () => {
    // Half a stem back, both ways up — or an up-stem's flag is drawn half a stem into the stem.
    for (const up of [true, false]) {
      expect(flagPlacement({ x: 100, tipY: 40, up }, STEM_WIDTH, 0).x).toBe(100 - STEM_WIDTH / 2)
      expect(flagPlacement({ x: 100, tipY: 40, up }, 3, 0).x).toBe(98.5)
    }
  })

  it('⚠️ …and the two sides are MIRRORS — the same reach, the opposite way', () => {
    const up = flagPlacement({ x: 0, tipY: 0, up: true }, 0, 12)
    const down = flagPlacement({ x: 0, tipY: 0, up: false }, 0, 12)
    expect(up.baselineY).toBe(-down.baselineY)
  })

  describe('🚨 the FONT dependency, made visible', () => {
    it('⛔ an unmeasured font (reach 0) parks the baseline ON the tip — ⚠️ that IS jsdom', () => {
      // Not a defect: with no font there is no ink to reach. ⭐ The value of it being an argument is
      // that the case is stateable at all — inside `getTextMetrics()` it was invisible until a
      // browser rendered before the woff2 landed (`docs/plans/own-engraving-engine.md` §3).
      expect(flagPlacement({ x: 100, tipY: 40, up: true }, STEM_WIDTH, 0).baselineY).toBe(40)
    })

    it('⭐ …and the whole difference between two fonts is that ONE number', () => {
      const measured = flagPlacement({ x: 100, tipY: 40, up: true }, STEM_WIDTH, 8)
      const fallback = flagPlacement({ x: 100, tipY: 40, up: true }, STEM_WIDTH, 24)
      expect(fallback.baselineY - measured.baselineY, 'a fallback face drops the flag 16 px').toBe(16)
      expect(fallback.x, 'the x cannot move — it is arithmetic on the stem').toBe(measured.x)
    })
  })
})
describe('drawFlag — the ink', () => {
  const at = { x: 99.25, baselineY: 48 }
  const font = { family: 'Bravura,Academico', size: 30, weight: 'normal', style: 'normal' }
  /** SMuFL `flag8thUp` (U+E240) — the glyph VexFlow hands an unbeamed eighth with its stem up. */
  const FLAG_8TH_UP = '\uE240'

  it('⭐ one glyph, in the face it was handed, inside a `flag` group', () => {
    const recorder = new SceneRecorder()
    drawFlag(recorder, FLAG_8TH_UP, at, font)

    const group = recorder.scene.children[0]
    expect(group.kind === 'group' && group.cls, 'VexFlow drew a `flag` group, so we draw one').toBe('flag')
    expect(texts(recorder.scene)).toEqual([{
      kind: 'text', text: FLAG_8TH_UP, x: 99.25, y: 48, font, style: {},
    }])
  })

  it('⛔ a note with no flag draws nothing at all — not even a group', () => {
    const recorder = new SceneRecorder()
    drawFlag(recorder, '', at, font)
    expect(recorder.scene.children).toEqual([])
  })

  it('⚠️ the group closes after each glyph — an unbalanced pair swallows the render', () => {
    const recorder = new SceneRecorder()
    drawFlag(recorder, FLAG_8TH_UP, at, font)
    // A second call landing BESIDE the first, not nested inside it, is the whole proof.
    drawFlag(recorder, FLAG_8TH_UP, at, font)
    expect(recorder.scene.children).toHaveLength(2)
    expect(recorder.scene.children.every(c => c.kind === 'group')).toBe(true)
  })
})
