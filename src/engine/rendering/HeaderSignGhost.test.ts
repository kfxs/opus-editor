// @vitest-environment jsdom
/**
 * The clef and meter ghosts (S11a): the armed sign, drawn by the score's own sign objects on our
 * surface, swept into its class-tagged overlay group.
 *
 * ⚠️ jsdom has no `getBBox`, so the group is never parked on the pointer here — that, and that the
 * glyph is the page's own at the page's size, is the browser suite's (`e2e/ghosts.e2e.ts`) and was
 * proved once by an A/B of every cursor ghost's ink against the previous commit
 * (`docs/vexflow-removal-map.md` S11a). Pinned here: which group, which glyph, and nothing loose.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { GHOST_GROUP_SELECTOR } from './GhostRenderer'

describe('HeaderSignGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine
  const svg = () => container.querySelector('svg')!
  const codes = (sel: string) =>
    [...container.querySelectorAll(`${sel} text`)].map(t => t.textContent!.codePointAt(0)!.toString(16))

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  it('draws the ARMED clef in `.ghost-clef-group`, appended last, and nothing outside it', () => {
    const before = svg().children.length
    expect(engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'clef', clef: 'bass' })).toBe(true)
    expect(svg().children.length).toBe(before + 1)
    expect(svg().lastElementChild!.getAttribute('class')).toBe('ghost-clef-group')
    expect(codes('.ghost-clef-group')).toEqual(['e062']) // SMuFL fClef
  })

  it('draws the armed meter\'s rows in `.ghost-timesig-group` — two numerals, or one symbol', () => {
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'timeSignature', timeSignature: { numerator: 3, denominator: 4 } })
    expect(codes('.ghost-timesig-group')).toEqual(['e083', 'e084']) // timeSig3 over timeSig4
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'timeSignature', timeSignature: { numerator: 4, denominator: 4, symbol: 'common' } })
    expect(codes('.ghost-timesig-group')).toEqual(['e08a']) // timeSigCommon
  })

  it('is swept by the ghost take-down, like every other cursor ghost', () => {
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'clef', clef: 'treble' })
    expect(container.querySelectorAll(GHOST_GROUP_SELECTOR).length).toBe(1)
    engine.clearGhosts()
    expect(container.querySelectorAll(GHOST_GROUP_SELECTOR).length).toBe(0)
  })
})
