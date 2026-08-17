// @vitest-environment jsdom
/**
 * The octave-line stamp's ghost: `8va` / `8ba` at the cursor.
 *
 * Subject: {@link OttavaGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — that is
 * how a ghost gets drawn over a real score (test-layout plan decision 4), the same shape
 * `TrillGhost.test.ts` and `FanGhost.test.ts` use.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY HERE.** This ghost is ONE music glyph, and jsdom has no
 * fonts: `getBBox` is not implemented, so the drawer takes its "nothing measurable was drawn" exit,
 * removes its group and answers false — the same answer the clef, tempo and trill ghosts give in a
 * unit test (see the header of `e2e/ghosts.e2e.ts`). Worth pinning all the same, because the
 * alternative to removing the group is a ghost that smears.
 *
 * So the CLAIMS here are the wiring ones: the kind is routed, the class is swept, nothing is left
 * behind. That the numeral is `8va` for +1 and `8ba` for −1, and that each parks on the side of the
 * pointer its bracket goes, is measured in `e2e/ghosts.e2e.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { OTTAVA_GHOST_GROUP_CLASS } from './OttavaGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('OttavaGhost', () => {
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
  const draw = (shift: 1 | -1) => engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'ottava', shift })

  it('the ottava kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.ottava).toBeTypeOf('function')
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${OTTAVA_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the glyph cannot be measured — it removes its own group', () => {
    draw(1); draw(-1); draw(1)
    expect(svg().querySelectorAll(`.${OTTAVA_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('never throws for either direction — a preview is not allowed to break the render', () => {
    expect(() => draw(1)).not.toThrow()
    expect(() => draw(-1)).not.toThrow()
    // …and the score under it is untouched: the ghost is an overlay, so the music survives it.
    expect(svg().querySelectorAll('.vf-stavenote').length).toBeGreaterThan(0)
  })
})
