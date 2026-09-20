// @vitest-environment jsdom
/**
 * The barline stamp's ghost: the armed SIGN at the cursor.
 *
 * Subject: {@link BarlineGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — how a
 * ghost gets drawn over a real score (test-layout plan decision 4), the shape `PedalGhost.test.ts`
 * and `OttavaGhost.test.ts` use.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY HERE.** `getBBox` is not implemented, so the drawer takes its
 * "nothing measurable was drawn" exit, removes its group and answers false — the same answer every
 * sign ghost gives in a unit test. So the CLAIMS here are the wiring ones. That the sign is drawn
 * with the pass's own ink (strokes + `repeatDot`) and parks left of the pointer is the browser
 * suite's to measure.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../../MusicEngine'
import { BARLINE_GHOST_GROUP_CLASS } from './BarlineGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('BarlineGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.addNoteAtBeat({
      step: 'C', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 },
    } as unknown as Parameters<MusicEngine['addNoteAtBeat']>[0])
    engine.renderScore()
  })

  const svg = () => container.querySelector('svg') as SVGSVGElement
  const draw = (sign: 'final' | 'repeatStart' | 'repeatEnd' = 'final') =>
    engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'barline', sign })

  it('the barline kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.barline).toBeTypeOf('function')
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${BARLINE_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the sign cannot be measured — it removes its own group', () => {
    draw(); draw(); draw()
    expect(svg().querySelectorAll(`.${BARLINE_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('draws each of the three signs without throwing — a preview may not break the render', () => {
    for (const sign of ['final', 'repeatStart', 'repeatEnd'] as const) {
      expect(() => draw(sign), sign).not.toThrow()
    }
    // …and the score under it is untouched: the ghost is an overlay, so the music survives it.
    expect(svg().querySelectorAll('.stavenote').length).toBeGreaterThan(0)
  })
})
