// @vitest-environment jsdom
/**
 * The grouping-sign stamp's ghost: the armed brace or bracket at the cursor.
 *
 * Subject: {@link GroupSignGhost}, sitting beside this file — the shape `BarlineGhost.test.ts` and
 * `PedalGhost.test.ts` use, with a `MusicEngine` as the FIXTURE.
 *
 * ⚠️⚠️ **WHAT jsdom CAN AND CANNOT SAY.** `getBBox` is not implemented, so the drawer takes its
 * "nothing measurable was drawn" exit, removes its group and answers false — the same answer every
 * sign ghost gives in a unit test. So the claims here are the WIRING ones. That the glyph parks at
 * the pointer is the browser suite's to measure.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { GROUP_SIGN_GHOST_GROUP_CLASS } from './GroupSignGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('GroupSignGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  const svg = () => container.querySelector('svg') as SVGSVGElement
  const draw = (symbol: 'brace' | 'bracket' = 'bracket') =>
    engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'group', symbol })

  it('the group kind is routed to a drawer — the armed tool has somewhere to go', () => {
    expect(GHOST_DRAWERS.group).toBeTypeOf('function')
  })

  it('🚨 its class is in the sweep selector — ⛔ or the ghost SMEARS one copy per mouse move', () => {
    // His screenshot, 2026-08-29: blue trails across four systems. The class was exported and never
    // registered, so `clearGhosts` never swept it. ⭐ The SECOND ghost to hit this exact trap, which
    // is why the whole table is asserted below and not just this one row.
    expect(GHOST_GROUP_SELECTOR).toContain(`.${GROUP_SIGN_GHOST_GROUP_CLASS}`)
  })

  it('leaves NOTHING on the page when the sign cannot be measured — it removes its own group', () => {
    draw(); draw(); draw()
    expect(svg().querySelectorAll(`.${GROUP_SIGN_GHOST_GROUP_CLASS}`).length).toBe(0)
  })

  it('draws both armable signs without throwing — a preview may not break the render', () => {
    for (const symbol of ['brace', 'bracket'] as const) {
      expect(() => draw(symbol), symbol).not.toThrow()
    }
  })
})

/**
 * ⭐⭐ **EVERY GHOST'S GROUP CLASS MUST BE IN THE SWEEP — checked for the whole family, not one row.**
 *
 * 🚨 Two ghosts have now shipped with their class unregistered, and the symptom is the same both
 * times: a trail of one copy per mouse position. It is invisible to every other test because the
 * drawer WORKS — nothing throws, the group is created correctly, and only the take-down is missing.
 *
 * ⚠️ This asserts the CONSTANTS each ghost module exports, which is the honest half: a drawer that
 * opened a group under some other name would still slip through. ⏭️ The real fix is for
 * `GHOST_DRAWERS` and the selector to share one table — worth doing the next time a ghost is added.
 */
describe('the ghost sweep covers every ghost module', () => {
  it('lists each exported ghost group class', async () => {
    const modules = await Promise.all([
      import('./BarlineGhost').then(m => m.BARLINE_GHOST_GROUP_CLASS),
      import('./KeySignatureGhost').then(m => m.KEY_SIGNATURE_GHOST_GROUP_CLASS),
      import('./GroupSignGhost').then(m => m.GROUP_SIGN_GHOST_GROUP_CLASS),
    ])
    for (const cls of modules) {
      expect(GHOST_GROUP_SELECTOR, `${cls} must be swept`).toContain(`.${cls}`)
    }
  })
})
