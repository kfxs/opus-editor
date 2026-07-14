// @vitest-environment jsdom
/**
 * P5.2 — every (measure, staff) draws into its **own addressable `<g>`**
 * (docs/render-performance-plan.md §7).
 *
 * This is the structure P5's incremental redraw and P6's culling both address the score through, so
 * these tests are about the *shape of the SVG*, not about speed. The one that matters most is
 * "sibling, never nested": VexFlow's `openGroup` pushes the context's append target, so a single
 * unclosed group would silently swallow **the entire rest of the score** — every later measure, the
 * ties, the slurs, the ghosts — into one measure's `<g>`. Everything would still look right on
 * screen, and every later phase would be built on a lie.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { fracCreate as frac } from '@/utils/fraction'

function render(build: (m: ScoreModel) => void, staves = 1) {
  const model = new ScoreModel()
  for (let i = 1; i < staves; i++) model.addStaff(i - 1, 'below')
  build(model)

  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 600)
  renderer.renderScore(model.getScore())

  const svg = renderer.getSVGElement()!
  return { renderer, svg, score: model.getScore() }
}

/** Every measure group in the document, in document order. */
function groups(svg: SVGElement): SVGGElement[] {
  return Array.from(svg.querySelectorAll('g.vf-measure')) as SVGGElement[]
}

describe('P5.2 — measures as addressable groups', () => {
  it('gives every (measure, staff) its own group, addressable by id', () => {
    const { renderer, svg } = render(m => {
      m.addMeasure()
      m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      m.addNote({ step: 'G', octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    }, 2)

    // 2 measures × 2 staves
    expect(groups(svg)).toHaveLength(4)

    for (const measure of [1, 2]) {
      for (const staff of [0, 1]) {
        const group = renderer.getMeasureSVGGroup(measure, staff)
        expect(group, `measure ${measure}, staff ${staff}`).not.toBeNull()
        expect(group!.getAttribute('id')).toBe(`vf-m${measure}-s${staff}`)
        // It is in the document, and it is the same node the SVG exposes.
        expect(svg.querySelector(`#vf-m${measure}-s${staff}`)).toBe(group)
      }
    }
  })

  it('the group actually CONTAINS its measure — it is not an empty wrapper', () => {
    const { renderer } = render(m => {
      m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    })

    const group = renderer.getMeasureSVGGroup(1, 0)!
    // The staff lines, the clef, and the notehead all drew inside it.
    expect(group.querySelectorAll('path, text, rect').length).toBeGreaterThan(0)
    expect(group.querySelector('g.vf-stavenote')).not.toBeNull()
  })

  it('measure groups are SIBLINGS, never nested — an unclosed group would swallow the score', () => {
    const { svg } = render(m => {
      m.addMeasure()
      m.addMeasure()
      m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      m.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
      m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
    }, 2)

    const all = groups(svg)
    expect(all).toHaveLength(6)

    for (const group of all) {
      // No measure group may contain another.
      expect(group.querySelector('g.vf-measure')).toBeNull()
      // Nor may any of them sit inside one.
      expect(group.parentElement!.closest('g.vf-measure')).toBeNull()
    }
  })

  it('cross-measure spans stay OUTSIDE the measure groups', () => {
    // A slur from measure 1 into measure 2 belongs to neither measure's group: under P6 it must be
    // drawn whenever it INTERSECTS the window, not only when its anchors happen to be drawn (§8).
    const { svg } = render(m => {
      m.addMeasure()
      const a = m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const b = m.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
      m.addSlur({ startNoteId: a!.id, endNoteId: b!.id, voice: 0 })
    })

    const slur = svg.querySelector('g.vf-slur')
    expect(slur, 'the slur drew').not.toBeNull()
    expect(slur!.closest('g.vf-measure'), 'slur must not be trapped inside a measure').toBeNull()
  })

  it('a re-render rebuilds the groups rather than accumulating them', () => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new VexFlowRenderer(container)
    renderer.initialize(1200, 600)

    renderer.renderScore(model.getScore())
    const first = groups(renderer.getSVGElement()!).length

    renderer.renderScore(model.getScore())
    expect(groups(renderer.getSVGElement()!)).toHaveLength(first)
    // And the map hands back the LIVE node, not the stale one from the previous render.
    const group = renderer.getMeasureSVGGroup(1, 0)!
    expect(group.isConnected).toBe(true)
  })
})
