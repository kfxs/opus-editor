// @vitest-environment jsdom
/**
 * The feather stamp's ghost: a NOTEHEAD, and nothing else.
 *
 * Subject: {@link FanGhost}, sitting beside this file. A `MusicEngine` is the FIXTURE — that is how
 * a ghost gets drawn over a real score (test-layout plan decision 4), the same shape
 * `GhostRenderer.contextLeak.test.ts` uses.
 *
 * ⚠️ NODE IDENTITY ONLY. jsdom has no layout and no fonts, so every glyph measures 0×0 — where the
 * head landed is a browser question (docs/ARCHITECTURE.md §"The browser suite"). What is testable
 * here is what these tests assert: which SVG nodes the ghost kept and which it dropped, which is
 * exactly the claim the module makes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { FAN_GHOST_GROUP_CLASS } from './FanGhost'
import { GHOST_GROUP_SELECTOR } from './GhostRenderer'

describe('FanGhost', () => {
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
  const ghost = () => svg().querySelector(`.${FAN_GHOST_GROUP_CLASS}`)

  const draw = (duration: 'w' | 'h' | 'q' | '8' | '16' | '32', dots = 0) =>
    engine.renderScoreWithToolGhost({ x: 300, y: 120 }, { kind: 'fan', duration, dots })

  it('draws a group holding the notehead', () => {
    expect(draw('h')).toBe(true)
    const g = ghost()
    expect(g).not.toBeNull()
    expect(g!.querySelectorAll('.vf-notehead').length).toBeGreaterThan(0)
  })

  it('⭐ keeps NO stem and NO flag — an eighth is a bare head at the cursor', () => {
    draw('8')
    const g = ghost()!
    expect(g.querySelector('.vf-stem')).toBeNull()
    // The note's own group is KEPT (it carries the font the head inherits — see FanGhost's header);
    // what is pruned is everything INSIDE it that is not a head. The flag is the `<text>` a stemmed
    // note draws beside its notehead group, so nothing may be left in there but heads.
    for (const container of Array.from(g.children)) {
      for (const child of Array.from(container.children)) {
        expect(child.getAttribute('class')).toContain('vf-notehead')
      }
    }
  })

  it('the dot travels with the head — it is drawn INSIDE the notehead group', () => {
    draw('h', 1)
    const head = ghost()!.querySelector('.vf-notehead')!
    const dotted = head.querySelectorAll('text, path, circle, ellipse').length
    draw('h', 0)
    const plain = ghost()!.querySelector('.vf-notehead')!.querySelectorAll('text, path, circle, ellipse').length
    expect(dotted).toBeGreaterThan(plain)
  })

  it('every value draws something — a whole note has no stem to lose', () => {
    for (const d of ['w', 'h', 'q', '8', '16', '32'] as const) {
      expect(draw(d)).toBe(true)
      expect(ghost()).not.toBeNull()
    }
  })

  it('⚠️ its class is in the sweep selector, or the ghost would smear one copy per mouse move', () => {
    expect(GHOST_GROUP_SELECTOR).toContain(`.${FAN_GHOST_GROUP_CLASS}`)
    draw('h')
    draw('h')
    draw('q')
    expect(svg().querySelectorAll(`.${FAN_GHOST_GROUP_CLASS}`).length).toBe(1)
  })
})
