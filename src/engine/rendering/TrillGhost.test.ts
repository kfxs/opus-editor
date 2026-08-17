// @vitest-environment jsdom
/**
 * The trill stamp's ghost: a `tr` at the cursor.
 *
 * Subject: {@link TrillGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — that is
 * how a ghost gets drawn over a real score (test-layout plan decision 4), the same shape
 * `FanGhost.test.ts` uses.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY HERE, and it is less than usual.** This ghost is ONE music
 * glyph, and jsdom has no fonts: `getBBox` is not implemented at all, so the drawer takes its
 * "nothing measurable was drawn" exit, removes its group and answers false. That is not a failure —
 * it is the same answer the clef, tempo and accidental ghosts give in a unit test (see the header of
 * `e2e/ghosts.e2e.ts`), and it is worth pinning, because the alternative to removing the group is a
 * ghost that smears.
 *
 * So the CLAIMS here are the wiring ones: the kind is routed, the class is swept, and a repeated
 * draw leaves nothing behind. That the `tr` is the right glyph, at the right size, near the pointer,
 * is measured in `e2e/ghosts.e2e.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { TRILL_GHOST_GROUP_CLASS } from './TrillGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('TrillGhost', () => {
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
  const draw = () => engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'trill' })

  it('the trill kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.trill).toBeTypeOf('function')
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${TRILL_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the glyph cannot be measured — it removes its own group', () => {
    // jsdom's answer, and the one that matters: a ghost that cannot size itself cannot place itself,
    // so it must take itself down rather than pile up at the origin, once per mouse position.
    draw(); draw(); draw()
    expect(svg().querySelectorAll(`.${TRILL_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('never throws, whatever the font situation — a preview is not allowed to break the render', () => {
    expect(() => draw()).not.toThrow()
    // …and the score under it is untouched: the ghost is an overlay, so the music survives it.
    expect(svg().querySelectorAll('.vf-stavenote').length).toBeGreaterThan(0)
  })
})
