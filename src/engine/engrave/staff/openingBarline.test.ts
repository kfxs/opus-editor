/**
 * Subject: `./openingBarline` — the line that opens a stave, as ink (P5b).
 *
 * ⭐ **Three of these assertions moved here from `rendering/barlineInk.test.ts` with the code they
 * describe** (*"a spec moves with its module"*): the ink grows RIGHTWARD from `x`, it is measured in
 * staff spaces so a small staff's own `<g>` scales it, and the group it lands in is the one every
 * other reader of a barline looks for. What did NOT move is the pass they used to be about —
 * `inkBarlines` widened a rect VexFlow had already drawn, and there is no longer a rect to widen.
 */
import { describe, it, expect } from 'vitest'
import {
  drawOpeningBarline, openingBarlineInk, stampOpeningBarline, type OpeningBarlineInk,
} from './openingBarline'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, SceneGroup, ScenePrimitive } from '@/engine/scene/Scene'

/** A treble stave whose top line is y = 40 and bottom line y = 80, at the boundary x = 100. */
const INK = openingBarlineInk(100, 40, 81, 1.6)

function rects(scene: Scene | SceneGroup): Extract<ScenePrimitive, { kind: 'rect' }>[] {
  const out: Extract<ScenePrimitive, { kind: 'rect' }>[] = []
  for (const child of scene.children) {
    if (child.kind === 'group') out.push(...rects(child))
    else if (child.kind === 'rect') out.push(child)
  }
  return out
}

describe('openingBarlineInk — the ink is stated, not derived', () => {
  it('is the four numbers it was handed', () => {
    expect(INK).toEqual<OpeningBarlineInk>({ x: 100, topY: 40, bottomY: 81, thickness: 1.6 })
  })

  it('⚠️ the THICKNESS is an argument — ⛔ this module owns no weight of its own', () => {
    // The owner is the thin-line family (`rendering/thinLineWeight`), read from the font. A barline
    // that picked its own number is exactly the drift that family exists to stop.
    for (const t of [1, 1.6, 0.11 * 10, 4]) expect(openingBarlineInk(0, 0, 40, t).thickness).toBe(t)
  })
})

describe('⭐ THE RULE — x is the BOUNDARY and the ink grows RIGHTWARD from it', () => {
  it('⛔ it is not centred on the boundary', () => {
    const recorder = new SceneRecorder()
    stampOpeningBarline(recorder, INK)
    const [bar] = rects(recorder.scene)
    // The whole reason: the spacing model measures the lead-in from `x`, the registry's `noteEndX`
    // hit box is placed at it, and `barWidth.e2e` asserts a drawn barline sits at the stave's `x2`.
    expect(bar.x, 'the left edge of the ink IS the boundary').toBe(100)
    expect(bar.x + bar.width, 'and all of it is to the right').toBeCloseTo(101.6, 10)
  })

  it('⭐ it spans the staff’s full ink — the five lines it closes are inside it', () => {
    const recorder = new SceneRecorder()
    stampOpeningBarline(recorder, INK)
    const [bar] = rects(recorder.scene)
    expect(bar.y).toBe(40)
    expect(bar.y + bar.height, 'down to the bottom line’s own bottom').toBe(81)
  })

  it('⚠️ measured in staff spaces, so a small staff’s `<g>` scales it — ⛔ no conversion here', () => {
    // The rect lands inside the bar's own group, which carries the staff's scale; a 0.7-size staff
    // gets 0.7 × 1.6 on screen without this module knowing that staff sizes exist. (Moved from
    // `barlineInk.test.ts`, where the same statement was made about the DOM repair.)
    const recorder = new SceneRecorder()
    stampOpeningBarline(recorder, INK)
    expect(rects(recorder.scene)[0].width / 10).toBeCloseTo(0.16)
  })
})

describe('drawOpeningBarline — the group', () => {
  it('🚨 opens `stavebarline` and keeps the id it was given', () => {
    const recorder = new SceneRecorder()
    drawOpeningBarline(recorder, INK, 'vf-auto-4242')

    const group = recorder.scene.children[0]
    // ⚠️ The BARE class: `hintBarlines`, `dev/barlineCensus` and three e2e specs all find a barline
    // by `g.vf-stavebarline rect`, and `ElementRegistry` resolves its box by the id.
    expect(group.kind === 'group' && group.cls).toBe('stavebarline')
    expect(group.kind === 'group' && group.id).toBe('vf-auto-4242')
    expect(rects(recorder.scene)).toHaveLength(1)
  })

  it('⚠️ closes after each line — an unbalanced pair swallows the rest of the render', () => {
    const recorder = new SceneRecorder()
    drawOpeningBarline(recorder, INK)
    drawOpeningBarline(recorder, INK)
    // Two SIBLINGS, ⛔ not one nested inside the other.
    expect(recorder.scene.children).toHaveLength(2)
    expect(recorder.scene.children.every(c => c.kind === 'group')).toBe(true)
  })
})

describe('stampOpeningBarline — the ungrouped entry point', () => {
  it('⛔ opens NO group: the caller owns the group its ink lands in', () => {
    const recorder = new SceneRecorder()
    stampOpeningBarline(recorder, INK)
    expect(recorder.scene.children.every(c => c.kind === 'rect'), 'a bare rect').toBe(true)
  })
})
