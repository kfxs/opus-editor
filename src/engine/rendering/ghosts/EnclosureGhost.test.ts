// @vitest-environment jsdom
/**
 * The brackets stamp's ghost (parenthesised-note-plan P4b): the armed PAIR at the cursor.
 *
 * Subject: {@link EnclosureGhost}, beside this file; a `MusicEngine` is the fixture (the barline ghost's
 * shape). ⚠️ jsdom has no `getBBox`, and a sign ghost that measures nothing removes itself — which is
 * exactly what HID his report (*"the ghost parenthesis leak"*, 2026-09-23: one pair left per pointer move,
 * its class missing from the sweep). So `getBBox` is stubbed here: the ghost survives, and the sweep has
 * to take it down.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MusicEngine } from '../../MusicEngine'
import { ENCLOSURE_GHOST_GROUP_CLASS } from './EnclosureGhost'
import { GHOST_GROUP_SELECTOR, GHOST_DRAWERS } from './GhostRenderer'

describe('EnclosureGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect }
  const original = proto.getBBox

  beforeEach(() => {
    proto.getBBox = () => ({ x: 0, y: -10, width: 20, height: 20 }) as DOMRect
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })
  afterEach(() => { proto.getBBox = original })

  const svg = () => container.querySelector('svg') as SVGSVGElement
  const draw = (x: number) => engine.renderScoreWithToolGhost({ x, y: 120 }, { kind: 'headEnclosure', shape: 'round' })

  it('is routed to a drawer, and its class is in the sweep selector', () => {
    expect(GHOST_DRAWERS.headEnclosure).toBeTypeOf('function')
    expect(GHOST_GROUP_SELECTOR).toContain(`.${ENCLOSURE_GHOST_GROUP_CLASS}`)
  })

  it('⭐ draws the pair — and a second move leaves ONE, not two (his report: the ghost leaked)', () => {
    draw(300)
    draw(320)
    const ghosts = svg().querySelectorAll(`.${ENCLOSURE_GHOST_GROUP_CLASS}`)
    expect(ghosts.length).toBe(1)
    expect(ghosts[0].querySelectorAll('text').length).toBe(2)
  })
})
