// @vitest-environment jsdom
/**
 * The bracketed stamp's ghost. Subject: {@link drawBracketedGhost}; a `MusicEngine` is the FIXTURE, as in
 * `GraceGhost.test.ts`. ⚠️ jsdom measures no glyph, so the claims are the PLACEMENT and what is stamped.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../../MusicEngine'
import { BRACKETED_GHOST_GROUP_CLASS, bracketedGhostHead } from './BracketedGhost'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { bracketedScale } from '@/engine/layout/bracketedRoom'

describe('BracketedGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  const draw = (pointerX: number, accidental: 'b' | null = null) => {
    engine.renderScoreWithToolGhost({ x: pointerX, y: 120 }, { kind: 'bracketedGrace', accidental })
    return container.querySelector(`.${BRACKETED_GHOST_GROUP_CLASS}`)
  }
  const ghostX = (pointerX: number) => Number(/^translate\(([-\d.]+),/.exec(draw(pointerX)?.getAttribute('transform') ?? '')?.[1])

  it('⭐ parks LEFT of the arrow, where the stamp judges a click — and follows the pointer smoothly', () => {
    const a = ghostX(300)
    expect(a).toBeCloseTo(bracketedGhostHead(300, null).left, 6)
    expect(a).toBeLessThan(300)
    expect(ghostX(302.5) - a).toBeCloseTo(2.5, 6)
  })

  it('⭐ draws the black head, the armed sign and the armed (gould) brackets, at the head\'s scale', () => {
    const group = draw(300, 'b')!
    expect(group.getAttribute('transform')).toContain(`scale(${bracketedScale()})`)
    const texts = [...group.querySelectorAll('text')].map(t => t.textContent)
    for (const name of ['noteheadBlack', 'accidentalFlat', 'accidentalParensLeft', 'accidentalParensRight'] as const) {
      expect(texts).toContain(String.fromCodePoint(GLYPH_CODEPOINTS[name]))
    }
  })
})
