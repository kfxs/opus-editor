// @vitest-environment jsdom
/**
 * The grace stamp's ghost. Subject: {@link drawGraceGhost}; a `MusicEngine` is the FIXTURE, the shape
 * `BarlineGhost.test.ts` uses. ⚠️ jsdom measures no glyph, so the claim is the PLACEMENT's — the one
 * transform that stands the small note where it goes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../../MusicEngine'
import { GRACE_GHOST_GROUP_CLASS } from './GraceGhost'

describe('GraceGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  const ghostX = (pointerX: number): number => {
    engine.renderScoreWithToolGhost({ x: pointerX, y: 120 }, {
      kind: 'grace', duration: '8', dots: 0, slash: false, accidental: null, articulations: [],
    })
    const transform = container.querySelector(`.${GRACE_GHOST_GROUP_CLASS}`)?.getAttribute('transform') ?? ''
    return Number(/^translate\(([-\d.]+),/.exec(transform)?.[1])
  }

  it('⭐ its x follows the pointer SMOOTHLY — a pixel moved is a pixel moved (his call: never snapped)', () => {
    const a = ghostX(300)
    expect(a).toBeLessThan(300) // parked left of the arrow
    expect(ghostX(301) - a).toBeCloseTo(1, 6)
    expect(ghostX(303.5) - a).toBeCloseTo(3.5, 6)
  })
})
