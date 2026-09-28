// @vitest-environment jsdom
/**
 * {@link placeGlyphMarksOnLine} — the user's symbols lifted onto their row and stacked (docs/plans/symbol-plan.md
 * P1), read off the `translate` the pass writes on each symbol's group in a real jsdom render.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../../models/ScoreModel'
import { ScoreRenderer } from '../../ScoreRenderer'
import { addGlyphMark, setGlyphMarkOffset } from '../../../models/glyphMarkOps'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'
import { fracCreate as frac } from '@/utils/fraction'
import { GLYPH_MARK_STACK_GAP } from './glyphMarkStyle'
import { glyphMarkStacks } from './glyphMarkLinePass'

function renderWith(add: (model: ScoreModel) => void) {
  const model = new ScoreModel()
  model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
  add(model)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  renderer.renderScore(model.getScore())
  return { container, renderer }
}

/** The `translate(0, dy)` the line pass wrote — 0 when it wrote none. */
const liftOf = (container: HTMLElement, id: string): number => {
  const t = container.querySelector(`[id="${id}"]`)?.getAttribute('transform') ?? ''
  const m = /translate\(0, (-?[\d.e-]+)\)/.exec(t)
  return m ? Number(m[1]) : 0
}

describe('placeGlyphMarksOnLine', () => {
  it('lifts a symbol ABOVE the staff and stacks the next one outward, in the order added', () => {
    let first = ''
    let second = ''
    const { container } = renderWith(m => {
      const s = m.getScore()
      first = addGlyphMark(s, 1, { glyph: 'fermataAbove', beat: frac(0, 1) })!.id
      second = addGlyphMark(s, 1, { glyph: 'pictGlsp', beat: frac(0, 1) })!.id
    })
    const a = liftOf(container, first)
    const b = liftOf(container, second)
    expect(a).toBeLessThan(0) // drawn on the top line, moved up off it
    const fermata = smuflGlyph('fermataAbove')!.box
    const glsp = smuflGlyph('pictGlsp')!.box
    expect(b - a).toBeCloseTo(-(fermata.up + GLYPH_MARK_STACK_GAP + glsp.down) * 10)
  })

  it('stacks BELOW the staff downward', () => {
    let id = ''
    const { container } = renderWith(m => { id = addGlyphMark(m.getScore(), 1, { glyph: 'fermataBelow', beat: frac(0, 1), placement: 'below' })!.id })
    expect(liftOf(container, id)).toBeGreaterThan(0)
  })
})

describe('the rung — the tempo mark clears a symbol', () => {
  it('files a claim the tempo pass reads, so a tempo mark over a symbol stands further out', () => {
    const tempoLift = (withSymbol: boolean): number => {
      let id = ''
      const { container } = renderWith(m => {
        id = m.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 120 })!.id
        if (withSymbol) addGlyphMark(m.getScore(), 1, { glyph: 'pictGlsp', beat: frac(0, 1) })
      })
      return liftOf(container, id)
    }
    expect(tempoLift(true)).toBeLessThan(tempoLift(false))
  })
})

describe('the registry box — the press target moves with the lift', () => {
  it('files the glyph INK from the table and lifts it by the same amount as the drawing, on every render', () => {
    let id = ''
    const { container, renderer } = renderWith(m => { id = addGlyphMark(m.getScore(), 1, { glyph: 'fermataAbove', beat: frac(0, 1) })!.id })
    const box = () => renderer.getElementRegistry().getById(id)!.bbox
    const glyph = smuflGlyph('fermataAbove')!.box
    expect(box().height).toBeCloseTo((glyph.up + glyph.down) * 10)
    expect(box().width).toBeCloseTo((glyph.left + glyph.right) * 10)
    const lift = liftOf(container, id)
    // The glyph was stamped with its baseline on the top line; its ink's top is `up` above that, lifted.
    const topLine = renderer.getElementRegistry().getStaffGeometry(1, 0)!.lineYPositions[0]
    expect(box().y).toBeCloseTo(topLine - glyph.up * 10 + lift)
  })
})

describe('the attachment guide — from the symbol\'s ink to its note', () => {
  it('starts at the bottom of the ink (it moved up with the symbol) and ends on the head, straight down', () => {
    let id = ''
    const { renderer } = renderWith(m => { id = addGlyphMark(m.getScore(), 1, { glyph: 'fermataAbove', beat: frac(0, 1) })!.id })
    const entry = renderer.getElementRegistry().getById(id)!
    const [guide] = entry.guides!
    expect(guide.from.y).toBeCloseTo(entry.bbox.y + entry.bbox.height) // the ink's bottom, lifted with it
    expect(guide.to.x).toBeCloseTo(guide.from.x)
    expect(guide.to.y).toBeGreaterThan(guide.from.y) // the C5 head is below the symbol
  })
})

describe('the hand offset (P4) rides on the row', () => {
  it('moves the drawing AND the press box by the offset, and the stack neighbour not at all', () => {
    const build = (offset: boolean) => {
      const ids = { a: '', b: '' }
      const out = renderWith(m => {
        const s = m.getScore()
        ids.a = addGlyphMark(s, 1, { glyph: 'fermataAbove', beat: frac(0, 1) })!.id
        ids.b = addGlyphMark(s, 1, { glyph: 'pictGlsp', beat: frac(0, 1) })!.id
        if (offset) setGlyphMarkOffset(s, ids.a, 1.5, -0.5)
      })
      const t = (id: string) => out.container.querySelector(`[id="${id}"]`)!.getAttribute('transform')!
      const move = (id: string) => /translate\((.+), (.+)\)/.exec(t(id))!.slice(1).map(Number)
      return { a: move(ids.a), b: move(ids.b), box: out.renderer.getElementRegistry().getById(ids.a)!.bbox }
    }
    const plain = build(false)
    const nudged = build(true)
    expect(nudged.a[0] - plain.a[0]).toBeCloseTo(15)
    expect(nudged.a[1] - plain.a[1]).toBeCloseTo(-5)
    expect(nudged.b).toEqual(plain.b) // the neighbour stays on its own row
    expect(nudged.box.x - plain.box.x).toBeCloseTo(15)
    expect(nudged.box.y - plain.box.y).toBeCloseTo(-5)
  })
})

describe('glyphMarkStacks', () => {
  it('groups by (beat, side), keeping the stored order, and drops an unknown glyph', () => {
    const at = (id: string, beat: number, placement?: 'below', glyph = 'fermataAbove') =>
      ({ id, glyph, beat: frac(beat, 1), ...(placement ? { placement } : {}) })
    const stacks = glyphMarkStacks([at('a', 0), at('b', 1), at('c', 0), at('d', 0, 'below'), at('e', 0, undefined, 'notAGlyph')])
    expect(stacks.map(s => [s.side, s.marks.map(m => m.mark.id)])).toEqual([
      ['above', ['a', 'c']], ['above', ['b']], ['below', ['d']],
    ])
  })
})
