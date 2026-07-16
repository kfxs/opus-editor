// @vitest-environment jsdom
/**
 * A ghost must not leak its colour into the **shared draw context**.
 *
 * {@link VexFlowRenderer.initialize} replaces `context.save()`/`restore()` with no-ops
 * (structuredClone throws on Vue's reactive proxies). So every context style change is PERMANENT,
 * app-wide: `setStrokeStyle` repaints the shared context, `openGroup` stamps the current attributes
 * onto each new group, and children with no style of their own inherit it — staff lines carry no
 * `stroke`, so they turn whatever colour leaked. Wrapping the change in save/restore looks correct
 * and does nothing at all.
 *
 * That is not hypothetical: the tie ghost shipped with exactly that bug and turned the staff lines
 * blue from the second mouse move onward. It is invisible on the FIRST draw (the context is still
 * clean when the group opens), which is why these tests draw the ghost repeatedly.
 *
 * These MUST go through `MusicEngine` — a raw `new Renderer()` has WORKING save/restore, so probing
 * one would pass while the app leaks. The context under test has to be the neutered one.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import type { PixelCoordinates } from '@/types/music'

/**
 * The context's paint, as the next `openGroup` would read it. Covers `stroke-width` too: the ghost
 * draws through `drawCurveArc`, which pins a thin outline and must put the width back by hand.
 */
function contextPaint(engine: MusicEngine): Record<string, unknown> {
  const ctx = (engine as unknown as {
    renderer: { context: { attributes: Record<string, unknown> } }
  }).renderer.context
  const { stroke, fill } = ctx.attributes
  return { stroke, fill, 'stroke-width': ctx.attributes['stroke-width'] }
}

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no <svg> rendered')
  return svg as SVGSVGElement
}

describe('ghost renders must not leak paint into the shared context', () => {
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

  it('save/restore really are no-ops — the premise these tests rest on', () => {
    // If this ever fails, initialize() stopped neutering the context and the rule below relaxes.
    const ctx = (engine as unknown as { renderer: { context: Record<string, unknown> } }).renderer.context
    expect(String(ctx.save)).toBe('() => {}')
    expect(String(ctx.restore)).toBe('() => {}')
  })

  it('the tie ghost leaves the context paint untouched, however many times it draws', () => {
    const before = contextPaint(engine)
    expect(before.stroke).toBe('black') // guard: a meaningless 'before' would make this vacuous

    for (let i = 0; i < 4; i++) {
      engine.renderScoreWithTieGhost({ x: 100 + i * 10, y: 100 } as PixelCoordinates)
      expect(contextPaint(engine)).toEqual(before)
    }
  })

  it('the tie ghost never stamps its colour onto its own group — only onto the arc', () => {
    // The tell for a leak: `openGroup` copies the context's attributes onto the <g>, so a coloured
    // group means the context was already dirty when the ghost opened it.
    for (let i = 0; i < 4; i++) {
      engine.renderScoreWithTieGhost({ x: 100 + i * 10, y: 100 } as PixelCoordinates)
      const group = svgOf(container).querySelector('g.vf-ghost-tie')
      expect(group, 'the ghost arc should be drawn').not.toBeNull()
      expect(group!.getAttribute('stroke')).toBeNull()
      expect(group!.getAttribute('fill')).toBeNull()
      // The colour belongs on the arc itself.
      const path = group!.querySelector('path')
      expect(path!.getAttribute('stroke')).toBe('#3B82F6')
    }
  })

  it('a dirty context would survive a full repaint — why the leak reached the staff lines', () => {
    // Documents the blast radius: the paint is not reset by clearCanvas()/renderScore(), so a leaked
    // colour goes on to stamp every group of the NEXT render, and the staff lines inside inherit it.
    // Hence the rule above is about the context, not about tidying up per draw.
    const before = contextPaint(engine)
    for (let i = 0; i < 4; i++) {
      engine.renderScoreWithTieGhost({ x: 100 + i * 10, y: 100 } as PixelCoordinates)
    }
    engine.clearCanvas()
    engine.renderScore()
    expect(contextPaint(engine)).toEqual(before)
  })
})
