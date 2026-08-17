// @vitest-environment jsdom
/**
 * The sustain pedal stamp's ghost: `Ped.` at the cursor.
 *
 * Subject: {@link PedalGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — that is
 * how a ghost gets drawn over a real score (test-layout plan decision 4), the shape
 * `TrillGhost.test.ts` and `OttavaGhost.test.ts` use.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY HERE.** This ghost is ONE music glyph, and jsdom has no
 * fonts: `getBBox` is not implemented, so the drawer takes its "nothing measurable was drawn" exit,
 * removes its group and answers false — the same answer its two siblings give in a unit test (see
 * the header of `e2e/ghosts.e2e.ts`). Pinned all the same, because the alternative to removing the
 * group is a ghost that smears one copy per mouse position.
 *
 * So the CLAIMS here are the wiring ones. That the glyph is `Ped.` (U+E650) and that it parks BELOW
 * the pointer — the side of the staff the mark goes — is measured in `e2e/ghosts.e2e.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { PEDAL_GHOST_GROUP_CLASS } from './PedalGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('PedalGhost', () => {
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
  const draw = () => engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'pedal' })

  it('the pedal kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.pedal).toBeTypeOf('function')
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${PEDAL_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the glyph cannot be measured — it removes its own group', () => {
    draw(); draw(); draw()
    expect(svg().querySelectorAll(`.${PEDAL_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('never throws — a preview is not allowed to break the render', () => {
    expect(() => draw()).not.toThrow()
    // …and the score under it is untouched: the ghost is an overlay, so the music survives it.
    expect(svg().querySelectorAll('.vf-stavenote').length).toBeGreaterThan(0)
  })
})
