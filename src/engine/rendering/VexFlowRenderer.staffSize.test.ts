// @vitest-environment jsdom
/**
 * **A small staff gets a small slot** (docs/staff-size-plan.md §5, P2).
 *
 * The vertical stride used to be one number for every staff in every system, and `pageCastOff`
 * decides page breaks from it — so a staff drawn at 0.7 in a full-size slot is not merely ugly,
 * the score paginates wrong.
 *
 * ⚠️ These are STAVE ARITHMETIC assertions, not glyph positions: jsdom has no fonts, so a
 * notehead measures 0×0 and any claim about where ink landed would agree with itself. Where a
 * *stave* sits is computed, not measured, and is real here. (docs/ARCHITECTURE.md, the browser
 * suite is for the rest.)
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { LAYOUT_CONFIG } from './layoutConfig'
import { fracCreate as frac } from '@/utils/fraction'

/** Two staves, three bars, a note on each staff so nothing is empty. Three bars because only the
 *  first of a line is REDRAWN on a multi-staff score — bars 2 and 3 take the translate path, which
 *  is the one a mere move is supposed to take. */
function buildScore(): ScoreModel {
  const model = new ScoreModel()
  model.addStaff(0, 'below')
  model.addMeasure()
  model.addMeasure()
  model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'G', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
  model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 3, beat: frac(0, 1) })
  model.addNote({ step: 'C', octave: 3, duration: 'h', measure: 3, beat: frac(0, 1), staff: 1 })
  return model
}

/**
 * ⭐ ONE renderer, re-rendered — not a fresh one per picture. A second render REUSES the measure
 * groups whose shape key is unchanged and merely translates them, and a size change is exactly a
 * bar that moves without looking different. A fresh renderer would draw everything from scratch
 * and prove nothing about the path the app actually takes (docs/staff-size-plan.md §7).
 */
function makeRenderer(): VexFlowRenderer {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 600)
  return renderer
}

function render(model: ScoreModel, renderer: VexFlowRenderer): VexFlowRenderer {
  renderer.renderScore(model.getScore())
  return renderer
}

/** How tall the drawn SVG came out (the sketching canvas grows with the music). */
function svgHeight(renderer: VexFlowRenderer): number {
  return Number(renderer.getSVGElement()?.getAttribute('height'))
}

/** The top staff line of a measure's staff, as tier 1 registered it. */
function staffTop(renderer: VexFlowRenderer, measure: number, staff: number): number {
  const geo = renderer.getElementRegistry().getStaffGeometry(measure, staff)
  expect(geo).not.toBeNull()
  return geo!.lineYPositions[0]
}

/** The top of staff 0's SLOT — where the casting-off put the bar, before the staff's own ink
 *  arranges itself inside it. Distinct from {@link staffTop} since P4: a staff drawn small sits its
 *  five lines closer to the top of its slot, because the room above them is ink too. */
function slotTop(renderer: VexFlowRenderer, measure: number): number {
  return renderer.getAllMeasureBounds().get(measure)!.measureY
}

describe('a small staff takes a smaller slot', () => {
  it('pulls the staff BELOW it up by what it gave back', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const slot0 = slotTop(r, 1)
    const lineOffset = staffTop(r, 1, 0) - slot0 // room above the top line, inside the slot
    const below = staffTop(r, 1, 1)

    model.setStaffSize(model.getScore().staves![0].id, 0.7)
    render(model, r)

    // The staff below is full size in both renders, so its own lines sit the same distance into
    // its slot — the whole move is the slot's.
    expect(staffTop(r, 1, 1)).toBeCloseTo(below - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 6)
    // The small staff's SLOT did not move…
    expect(slotTop(r, 1)).toBeCloseTo(slot0, 6)
    // …but its five lines sit closer to the top of it, because the room above them is ink and
    // shrank with the staff. (P4: before the transform this was `lineOffset` at any size.)
    expect(staffTop(r, 1, 0)).toBeCloseTo(slot0 + lineOffset * 0.7, 6)
  })

  it('moves the bars that are TRANSLATED rather than redrawn, not just the line’s first', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const before = staffTop(r, 3, 1)

    model.setStaffSize(model.getScore().staves![0].id, 0.7)
    render(model, r)

    // Bar 3 is mid-line: its group is reused and given a transform, and its registered geometry is
    // offset by the same dy. Leave the offset out and the music is drawn here and clickable there.
    expect(staffTop(r, 3, 1)).toBeCloseTo(before - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 6)
    expect(staffTop(r, 3, 1)).toBeCloseTo(staffTop(r, 1, 1), 6)
  })

  it('moves nothing ABOVE it when it is the BOTTOM staff that shrinks', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const above = staffTop(r, 1, 0)
    const below = staffTop(r, 1, 1)

    model.setStaffSize(model.getScore().staves![1].id, 0.7)
    render(model, r)

    expect(staffTop(r, 1, 0)).toBe(above)
    // The bottom staff's slot is where it was; only its own ink is smaller, so its lines rise
    // inside it. Nothing below it to push around — that is the whole claim here.
    expect(staffTop(r, 1, 1)).toBeLessThan(below)
  })

  it('shortens the whole drawn score — the number pagination is decided from', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const tall = svgHeight(r)

    model.setStaffSize(model.getScore().staves![0].id, 0.7)
    render(model, r)

    // On the sketching canvas the SVG is as tall as the music; on paper the same shortening is
    // what lets one more system fit on a page (pageCastOff reads the system heights).
    expect(svgHeight(r)).toBeCloseTo(tall - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 0)
  })

  it('leaves a full-size score exactly where it was — size 1 is not a special case', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const tops = [staffTop(r, 1, 0), staffTop(r, 1, 1)]

    model.setStaffSize(model.getScore().staves![0].id, 1)
    render(model, r)

    expect([staffTop(r, 1, 0), staffTop(r, 1, 1)]).toEqual(tops)
  })

  it('⚠️ a REUSED bar keeps its scale — moved or standing still', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const staffId = model.getScore().staves![0].id
    model.setStaffSize(staffId, 0.7)
    render(model, r)

    const transform = (measure: number) =>
      r.getMeasureSVGGroup(measure, 0)!.getAttribute('transform')
    expect(transform(1), 'drawn small').toBe('scale(0.7)')

    // Nothing about the small staff changed, so its bars are REUSED. Standing still, the group
    // must keep its scale rather than have the attribute removed as a stale translate.
    model.setStaffSpacing(model.getScore().staves![1].id, 3)
    render(model, r)
    expect(transform(1), 'reused where it was').toBe('scale(0.7)')

    // Now move the staff itself. `replaySnapshot` OWNS the attribute — this is the case that
    // snapped a scaled staff back to full size mid-drag if the scale were left out, and the order
    // matters: dx/dy are in the parent's space, the scale applies to what is inside.
    model.setStaffSize(staffId, 0.7) // (already 0.7 — the move comes from the staff above it)
    model.setStaffSpacing(staffId, 4)
    render(model, r)
    expect(transform(3), 'reused after a move').toMatch(/^translate\([^)]+\) scale\(0\.7\)$/)
  })

  it('and back again: full size restores the original positions on the SAME renderer', () => {
    const model = buildScore()
    const r = render(model, makeRenderer())
    const tops = [staffTop(r, 1, 0), staffTop(r, 1, 1)]
    const tall = svgHeight(r)

    model.setStaffSize(model.getScore().staves![0].id, 0.7)
    render(model, r)
    model.setStaffSize(model.getScore().staves![0].id, 1)
    render(model, r)

    expect([staffTop(r, 1, 0), staffTop(r, 1, 1)]).toEqual(tops)
    expect(svgHeight(r)).toBe(tall)
  })
})
