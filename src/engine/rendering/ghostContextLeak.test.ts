// @vitest-environment jsdom
/**
 * A ghost must not leak its colour into the **shared draw context**.
 *
 * `openGroup` stamps the context's CURRENT attributes onto each new `<g>`, and children with no
 * style of their own inherit them — staff lines carry no `stroke`, so they turn whatever colour was
 * sitting on the context. That is not hypothetical: the tie ghost shipped with exactly that bug and
 * turned the staff lines blue from the second mouse move onward. It is invisible on the FIRST draw
 * (the context is still clean when the group opens), which is why these tests draw repeatedly.
 *
 * The rule these pin — colour an element by setting the attribute on its SVG node AFTER drawing,
 * never by painting the shared context — survived the return of `save()`/`restore()` and is not
 * really about them. `initialize()` used to stub both to no-ops, which made EVERY style change
 * permanent and made a save/restore pair look correct while doing nothing; the stubs are gone (see
 * the history there) and the paint is properly scoped again. But post-draw DOM styling is still the
 * right answer for a ghost or a highlight, because it recolours without re-engraving.
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

  it('save/restore round-trip the context paint — they are real, not stubs', () => {
    const ctx = (engine as unknown as {
      renderer: { context: { save(): void; restore(): void; setStrokeStyle(s: string): void } }
    }).renderer.context
    const before = contextPaint(engine)

    ctx.save()
    ctx.setStrokeStyle('#ff0000')
    expect(contextPaint(engine).stroke).toBe('#ff0000') // the change lands…
    ctx.restore()

    expect(contextPaint(engine)).toEqual(before) // …and unwinds
  })

  /**
   * The reason re-enabling them mattered. VexFlow scopes its own styles with
   * `save() → applyStyle() → draw() → restore()`, so while restore was a stub every style it set
   * was permanent: a stem left `stroke-width: 1.5` on the shared context and a ledger line left `2`
   * (`defaultLedgerLineStyle`), for the rest of that render and every render after it. A whole note
   * below the staff is the clean probe — it has ledger lines and no stem, so nothing overwrites the
   * ledger's width on the way out.
   */
  it('drawing stems and ledger lines leaves the shared paint where it found it', () => {
    const fresh = new MusicEngine({ container, width: 800, height: 400 })
    fresh.renderScore()
    const clean = contextPaint(fresh)
    expect(clean['stroke-width']).toBe(1) // guard: the baseline is the untouched default

    // A3 whole note in treble: ledger lines, no stem.
    fresh.addNoteAtBeat({
      step: 'A', octave: 3, duration: 'w', measure: 1, beat: { num: 0, den: 1 },
    } as unknown as Parameters<MusicEngine['addNoteAtBeat']>[0])
    fresh.renderScore()
    expect(contextPaint(fresh), 'ledger lines leaked their width').toEqual(clean)

    // C5 quarter: a stem, no ledger lines.
    fresh.addNoteAtBeat({
      step: 'C', octave: 5, duration: 'q', measure: 2, beat: { num: 0, den: 1 },
    } as unknown as Parameters<MusicEngine['addNoteAtBeat']>[0])
    fresh.renderScore()
    expect(contextPaint(fresh), 'the stem leaked its width').toEqual(clean)
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
