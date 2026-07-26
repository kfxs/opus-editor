// @vitest-environment jsdom
/**
 * P6 — **virtualization: draw only the window** (docs/render-performance-plan.md §8).
 *
 * P5 made a render re-engrave only the bars whose picture *changed*. What it could not make cheaper
 * is a change that legitimately changes every bar's picture — a clef at bar 2, a paste that re-wraps
 * the score, a view-mode switch. Those are not waste, so no amount of reuse recovers them. The only
 * lever left is to **draw fewer bars**, and this is that lever.
 *
 * Four claims, and the last two are the ones that make it safe rather than merely fast:
 *
 *  1. a measure outside the window is not drawn — and one that *leaves* the window is taken back out
 *     of the DOM, not just left standing;
 *  2. culling is vertical too — at 40 staves you cannot see them all, so they must not all draw;
 *  3. **tier-1 geometry survives culling** (measure bounds exist for every bar in the score,
 *     on-screen or not) — the §8 "geometry consumers" constraint, which is what keeps pixel↔position
 *     and scroll-into-view working off-screen;
 *  4. **a span that crosses the window still draws**, even when both its anchors are outside it —
 *     the §8 cross-measure-span hazard, and the one thing about culling that is not local.
 */
import { describe, it, expect, vi } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer, LAYOUT_CONFIG } from './VexFlowRenderer'
import * as MeasureLayout from './MeasureLayout'
import type { Rect } from '@/engine/ViewportModel'
import { fracCreate as frac } from '@/utils/fraction'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 4000)
  return renderer
}

/** A long single-staff score — enough bars to wrap onto many systems. */
function longScore(bars: number): ScoreModel {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
  }
  return model
}

/** Which of `measures` were painted on staff `staff`. */
function drawn(renderer: VexFlowRenderer, measures: number[], staff = 0): number[] {
  return measures.filter(m => renderer.getMeasureSVGGroup(m, staff) !== null)
}

/** The window over the top-left corner of the score — the first system, roughly. */
const FIRST_SYSTEM: Rect = { x: 0, y: 0, width: 1200, height: LAYOUT_CONFIG.STAVE_HEIGHT }

describe('P6 — only the window is drawn', () => {
  it('draws the bars inside the window and none of the bars far below it', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)

    // The score wraps, so bar 1 is on the first system and bar 40 is far down the page.
    expect(drawn(renderer, [1])).toEqual([1])
    expect(drawn(renderer, [40])).toEqual([])
  })

  it('a bar that scrolls OUT of the window is removed from the DOM, not left standing', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBeNull()

    // Scroll far down: bar 1 is now above the window.
    const bar1 = renderer.getMeasureBounds(1)!
    renderer.setCullWindow({ x: 0, y: bar1.measureY + 2000, width: 1200, height: 400 })
    renderer.renderScore(score)

    expect(renderer.getMeasureSVGGroup(1, 0)).toBeNull()
  })

  it('culls VERTICALLY: a staff below the window is not drawn even where its bar is', () => {
    const model = longScore(4)
    model.addStaff(0, 'below')
    model.addStaff(1, 'below')
    model.addStaff(2, 'below') // 4 staves
    const score = model.getScore()
    const renderer = makeRenderer()

    // A window over the TOP staff only — the same bar 1, three staves lower down, must not draw.
    renderer.setCullWindow({ x: 0, y: 0, width: 1200, height: LAYOUT_CONFIG.STAVE_HEIGHT })
    renderer.renderScore(score)

    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBeNull()
    expect(renderer.getMeasureSVGGroup(1, 3)).toBeNull()
  })

  it('keeps tier-1 geometry for EVERY bar, including the culled ones (§8)', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)

    // Bar 40 was never painted...
    expect(renderer.getMeasureSVGGroup(40, 0)).toBeNull()
    // ...but it still knows exactly where it is. This is what keeps pixel↔position, hit-testing and
    // scroll-into-view honest for music that is off-screen.
    for (let m = 1; m <= 40; m++) {
      expect(renderer.getMeasureBounds(m), `bounds for bar ${m}`).toBeDefined()
    }
  })

  it('a null window draws the whole score (the pre-P6 behaviour, and the pre-layout state)', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(null)
    renderer.renderScore(score)

    expect(drawn(renderer, [1, 20, 40])).toEqual([1, 20, 40])
  })
})

describe('P6 — a span that crosses the window still draws (§8)', () => {
  it('forces the anchor bars of a slur whose ENDS are both outside the window', () => {
    const model = longScore(40)
    const score = model.getScore()

    // A slur from bar 1 to bar 30 — over most of the score.
    const first = score.measures[0].slots[0]
    const last = score.measures[29].slots[0]
    const startId = first.type === 'chord' ? first.notes[0].id : ''
    const endId = last.type === 'chord' ? last.notes[0].id : ''
    model.addSlur({ startNoteId: startId, endNoteId: endId })

    const renderer = makeRenderer()
    const bar15 = (() => {
      const probe = makeRenderer()
      probe.renderScore(model.getScore())
      return probe.getMeasureBounds(15)!
    })()

    // A window over the MIDDLE of the slur: neither bar 1 nor bar 30 is in it.
    renderer.setCullWindow({
      x: bar15.measureX - 50,
      y: bar15.measureY - 20,
      width: 300,
      height: LAYOUT_CONFIG.STAVE_HEIGHT,
    })
    renderer.renderScore(model.getScore())

    // Bar 15 is in the window; bar 1 and bar 30 are not — but they hold the slur's endpoints, and
    // the span renderers resolve those through `staveNoteMap`, which only a DRAWN bar populates. So
    // they are drawn anyway (off-screen, harmlessly), and the slur survives.
    expect(renderer.getMeasureSVGGroup(15, 0)).not.toBeNull()
    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBeNull()
    expect(renderer.getMeasureSVGGroup(30, 0)).not.toBeNull()

    // A bar with no span in it, equally far outside the window, is still culled — the rule pulls in
    // the anchors of crossing spans, not the whole score.
    expect(renderer.getMeasureSVGGroup(40, 0)).toBeNull()
  })

  it('does NOT force the anchors of a slur that misses the window entirely', () => {
    const model = longScore(40)
    const score = model.getScore()
    const a = score.measures[34].slots[0]
    const b = score.measures[37].slots[0]
    model.addSlur({
      startNoteId: a.type === 'chord' ? a.notes[0].id : '',
      endNoteId: b.type === 'chord' ? b.notes[0].id : '',
    })

    const renderer = makeRenderer()
    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(model.getScore())

    expect(renderer.getMeasureSVGGroup(35, 0)).toBeNull()
    expect(renderer.getMeasureSVGGroup(38, 0)).toBeNull()
  })
})

/**
 * P6, second pass — **the cost culling itself introduced**.
 *
 * The first cut of P6 worked, and then the census said the scroll handler was 40% of all render
 * time: 19 ms per boundary crossing, of which **13.3 ms was `calculateMeasureWidths`** — at 200 bars,
 * on a scroll, where the score had not changed by one note. Two things were being redone for bars
 * nobody could see and nothing had touched:
 *
 *  1. the whole **casting-off** (the width cache's fingerprint walk — §9's 101 ms at 500×25), and
 *  2. every culled bar's **tier-1 `Stave`**.
 *
 * Neither can be changed by moving the window. So neither is recomputed any more.
 */
describe('P6 — a scroll must not re-derive what a scroll cannot change', () => {
  it('reuses the casting-off across a pure window move (the 13 ms)', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()
    const spy = vi.spyOn(MeasureLayout, 'calculateMeasureWidths')

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    expect(spy).toHaveBeenCalledTimes(1)

    // Scroll. Only the engine may license reuse — it is the only thing that knows the model is
    // unchanged — so this is what MusicEngine.renderScore does on a non-dirty render.
    renderer.setLayoutReusable(true)
    renderer.setCullWindow({ x: 0, y: 400, width: 1200, height: 400 })
    renderer.renderScore(score)

    // Not recomputed: the window moved, and the window cannot change a bar's width.
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('does NOT reuse it when the engine has not vouched for the model (the default)', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()
    const spy = vi.spyOn(MeasureLayout, 'calculateMeasureWidths')

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    renderer.setCullWindow({ x: 0, y: 400, width: 1200, height: 400 })
    renderer.renderScore(score) // layoutReusable still false — a renderer driven with no engine

    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('a culled bar keeps its EXACT tier-1 geometry when its snapshot is replayed', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    const before = new Map([...renderer.getAllMeasureBounds()].map(([n, b]) => [n, { ...b }]))

    // A pure scroll: bar 40 is culled in both renders, so its geometry is replayed rather than
    // rebuilt. Replayed must mean IDENTICAL — this is the geometry hit-testing reads off-screen.
    renderer.setLayoutReusable(true)
    renderer.setCullWindow({ x: 0, y: 400, width: 1200, height: 400 })
    renderer.renderScore(score)

    for (const [n, b] of renderer.getAllMeasureBounds()) {
      expect(b, `bounds for bar ${n}`).toEqual(before.get(n))
    }
  })

  it('a bar that leaves the window and comes back is drawn again', () => {
    const score = longScore(40).getScore()
    const renderer = makeRenderer()

    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBeNull()

    // Away — its `<g>` is taken out of the DOM...
    renderer.setLayoutReusable(true)
    renderer.setCullWindow({ x: 0, y: 3000, width: 1200, height: 400 })
    renderer.renderScore(score)
    expect(renderer.getMeasureSVGGroup(1, 0)).toBeNull()

    // ...and back. The snapshot it replayed while culled carries no picture, so it must re-engrave
    // rather than reuse a group that no longer exists.
    renderer.setCullWindow(FIRST_SYSTEM)
    renderer.renderScore(score)
    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBeNull()
  })
})
