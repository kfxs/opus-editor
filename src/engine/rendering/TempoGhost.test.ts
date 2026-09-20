// @vitest-environment jsdom
/**
 * The tempo mark's ghost (S11c): the armed mark's text at the pointer, drawn by `drawTempoText`.
 *
 * ⚠️ jsdom has no `getBBox`, so this spec STUBS it — the claims are the wiring: which group, which
 * runs, painted how. Where the ink lands against the pointer is the browser's, proved once by an A/B
 * of every cursor ghost's ink against the previous commit (`docs/history/vexflow-removal-map.md` S11c).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { GHOST_GROUP_SELECTOR } from './GhostRenderer'
import { TEMPO_GHOST_GROUP_CLASS } from './TempoGhost'

const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect }
let saved: typeof proto.getBBox

describe('TempoGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine
  const tempo = (text: string) => ({ kind: 'tempo' as const, mark: { id: 'ghost-tempo', beat: { num: 0, den: 1 }, text } })

  beforeAll(() => {
    saved = proto.getBBox
    proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect
  })
  afterAll(() => { proto.getBBox = saved })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  it('draws the mark in its own swept group, a run per face, ghost blue at 0.7', () => {
    expect(engine.renderScoreWithToolGhost({ x: 200, y: 100 }, tempo('Allegro ♩ = 120'))).toBe(true)
    const groups = container.querySelectorAll(GHOST_GROUP_SELECTOR)
    expect(groups).toHaveLength(1)
    expect(groups[0].classList.contains(TEMPO_GHOST_GROUP_CLASS)).toBe(true)
    expect(groups[0].getAttribute('opacity')).toBe('0.7')
    const texts = [...groups[0].querySelectorAll('text')]
    expect(texts).toHaveLength(3) // the words, the note glyph, the number
    expect(texts.every(t => t.getAttribute('fill') === '#3B82F6')).toBe(true)
  })

  it('draws nothing for a mark with no text — one that only sounds', () => {
    expect(engine.renderScoreWithToolGhost({ x: 200, y: 100 }, tempo(''))).toBe(false)
    expect(container.querySelectorAll(GHOST_GROUP_SELECTOR)).toHaveLength(0)
  })
})
