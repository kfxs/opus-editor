// @vitest-environment jsdom
/**
 * {@link placeGlyphMarksOnLine} — the user's symbols lifted onto their row and stacked (docs/plans/symbol-plan.md
 * P1), read off the `translate` the pass writes on each symbol's group in a real jsdom render.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../../models/ScoreModel'
import { ScoreRenderer } from '../../ScoreRenderer'
import { addGlyphMark } from '../../../models/glyphMarkOps'
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
  return { container }
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
