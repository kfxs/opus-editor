// @vitest-environment jsdom
/**
 * The key-signature stamp's ghost: the armed signature at the cursor.
 *
 * Subject: {@link KeySignatureGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — how
 * a ghost gets drawn over a real score (test-layout plan decision 4), the shape `BarlineGhost.test.ts`
 * and `PedalGhost.test.ts` use.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY HERE.** `getBBox` is not implemented, so the drawer takes its
 * "nothing measurable was drawn" exit, removes its group and answers false — the same answer every
 * sign ghost gives in a unit test. So the CLAIMS here are the wiring ones. That the signs step along
 * by the pass's own advance, sit on the placement table's staff lines and park left of the pointer is
 * the browser suite's to measure.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { KEY_SIGNATURE_GHOST_GROUP_CLASS, drawKeySignatureGhost } from './KeySignatureGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'
import { keyFromFifths, C_MAJOR } from '@/utils/keySignature'

describe('KeySignatureGhost', () => {
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
  const draw = (fifths = -3) =>
    engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'keySignature', key: keyFromFifths(fifths) })

  it('the keySignature kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.keySignature).toBeTypeOf('function')
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${KEY_SIGNATURE_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the signs cannot be measured — it removes its own group', () => {
    draw(); draw(); draw()
    expect(svg().querySelectorAll(`.${KEY_SIGNATURE_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('draws sharps and flats without throwing — a preview may not break the render', () => {
    for (const fifths of [-7, -3, -1, 1, 2, 7]) {
      expect(() => draw(fifths), `${fifths} fifths`).not.toThrow()
    }
    // …and the score under it is untouched: the ghost is an overlay, so the music survives it.
    expect(svg().querySelectorAll('.stavenote').length).toBeGreaterThan(0)
  })

  it('⛔ an EMPTY signature draws nothing and says so — C major has no ink to preview', () => {
    // The one case that is answered before any measuring, so jsdom CAN speak to it: the drawer
    // refuses on the alterations list, not on `getBBox`. ⛔ And it invents no placeholder glyph —
    // that hole is the SIGNPOST's (docs/plans/key-signature-plan.md §5).
    const ctx = { openGroup: () => document.createElementNS('http://www.w3.org/2000/svg', 'g') }
    expect(drawKeySignatureGhost(ctx as never, 100, 100, C_MAJOR)).toBe(false)
  })
})
