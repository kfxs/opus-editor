// @vitest-environment jsdom
/**
 * The fan actually RENDERS (docs/fanned-beams-plan.md §3, P1).
 *
 * ⚠️ Deliberately not a geometry suite — jsdom stubs glyph measurement, so an assertion about where
 * the ink landed would pass vacuously (reference_jsdom_cannot_measure_glyphs); the picture is
 * checked by eye. What IS real here is that the pass runs at all, and the two ways it could take the
 * whole render down with it:
 *
 * - the TICK correction (a note drawn as a quarter while occupying a blanca — a FULL-mode `Voice`
 *   handed the wrong total throws), and
 * - the group balance (`openGroup`/`closeGroup` — an unbalanced pair swallows the rest of the score).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { FAN_GROUP } from '@/utils/fannedBeam'
import { fracCreate as frac } from '@/utils/fraction'
import type { FanMark } from '@/types/music'

const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 400)
  return { renderer, container }
}

/** `vf-` is prefixed by `openGroup`, so this is what the fan's group is called in the DOM. */
const fanGroups = (container: HTMLElement) =>
  container.querySelectorAll(`g.vf-${FAN_GROUP}`)

describe('a fanned slot renders', () => {
  it('paints one fan group for the marked note, and none for a plain one', () => {
    const model = new ScoreModel('fan render')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const { renderer, container } = makeRenderer()

    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(0)

    model.setFan(note.id, FAN)
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
    // The id carries the name AND the slot — `getElementById` is document-wide.
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    expect(container.querySelector(`#vf-${FAN_GROUP}-${slot.id}`)).not.toBeNull()
  })

  it('the note itself is still there — member 0 is the real StaveNote', () => {
    const model = new ScoreModel('fan render')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())

    // The whole point of not suppressing it: the registry still knows the note, so selection,
    // ties, articulations and the dynamic anchor all keep working.
    expect(renderer.getElementRegistry().getById(note.id)).not.toBeNull()
    expect(container.querySelectorAll('g.vf-stavenote').length).toBeGreaterThan(0)
  })

  it('survives every direction, count and beam setting', () => {
    for (const direction of ['accel', 'rit'] as const) {
      for (const count of [2, 6, 12]) {
        for (const beams of [1, 3, 4]) {
          const model = new ScoreModel('fan render')
          const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
          model.setFan(note.id, { direction, count, beams })
          const { renderer, container } = makeRenderer()
          renderer.renderScore(model.getScore())
          expect(fanGroups(container), `${direction} ${count}×${beams}`).toHaveLength(1)
        }
      }
    }
  })

  it('renders on a fanned note that is not the only thing in the bar', () => {
    // The busy-bar case: the fan's span now ends at the NEXT note rather than at the barline.
    const model = new ScoreModel('fan render')
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setFan(a.id, FAN)
    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(1)
  })

  it('renders a fanned CHORD, and a fan in a second voice', () => {
    const model = new ScoreModel('fan render')
    const c = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) }) // same beat = same chord
    model.setFan(c.id, FAN)
    const v1 = model.addNote({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    model.setFan(v1.id, { ...FAN, direction: 'rit' })

    const { renderer, container } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(fanGroups(container)).toHaveLength(2)
  })

  it('the rest of the score still draws after it — the group is balanced', () => {
    const model = new ScoreModel('fan render')
    model.addMeasure()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const later = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const { renderer } = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(renderer.getElementRegistry().getById(later.id)).not.toBeNull()
  })
})
