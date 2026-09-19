// @vitest-environment jsdom
/**
 * The rest stamp's ghost (S11d): a rest of the armed duration + dots, on a note of the score's own.
 *
 * Subject: {@link RestGhost}, sitting beside this file; a `MusicEngine` is the FIXTURE. ⚠️ NODE
 * IDENTITY ONLY — jsdom measures every glyph 0×0, so where the ghost lands against the pointer is the
 * browser's, proved once by an A/B of every cursor ghost's ink against the previous commit
 * (`docs/vexflow-removal-map.md` S11d).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { REST_GHOST_GROUP_CLASS } from './RestGhost'
import { GHOST_GROUP_SELECTOR } from './GhostRenderer'

describe('RestGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine
  const BLUE = { fill: '#3B82F6', stroke: '#3B82F6' }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  const draw = (duration: 'w' | 'h' | 'q' | '8', dots = 0, color = BLUE) =>
    engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'rest', duration, dots, color })
  const ghost = () => {
    const groups = container.querySelectorAll(GHOST_GROUP_SELECTOR)
    expect(groups).toHaveLength(1)
    expect(groups[0].getAttribute('class')).toBe(REST_GHOST_GROUP_CLASS)
    return groups[0] as SVGGElement
  }
  const codes = () => [...ghost().querySelectorAll('text')].map(t => t.textContent!.codePointAt(0)!.toString(16))

  it('draws the rest glyph and one augmentation dot per dot', () => {
    expect(draw('q', 2)).toBe(true)
    expect(codes()).toEqual(['e4e5', 'e1e7', 'e1e7']) // restQuarter, augmentationDot ×2
  })

  it('draws the ONE line a whole or half rest attaches to — and none for a shorter rest', () => {
    const lines = () => ghost().querySelectorAll(':scope > path').length
    draw('w'); expect(lines()).toBe(1)
    draw('h', 1); expect(lines()).toBe(1)
    draw('8'); expect(lines()).toBe(0)
  })

  it('hands the active voice colour down as the two custom properties the stylesheet reads', () => {
    draw('h', 0, { fill: '#EF4444', stroke: '#DC2626' })
    expect(ghost().style.getPropertyValue('--ghost-fill')).toBe('#EF4444')
    expect(ghost().style.getPropertyValue('--ghost-stroke')).toBe('#DC2626')
  })
})
