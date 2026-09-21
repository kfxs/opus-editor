import { afterEach, describe, expect, it } from 'vitest'
import { tempoGlyphSizePt, tempoInkAbove, tempoSymbolRaisePx, tempoTextFont } from './tempoStyle'
import { drawnFontPx } from '../../painter/drawnFontSize'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { DEFAULT_MUSIC_FONT, setActiveMusicFont } from '@/engine/fonts/musicFont'

afterEach(() => { setActiveMusicFont(DEFAULT_MUSIC_FONT) })

/**
 * ⚠️ Whether the note really LANDS on the baseline is a browser fact — `e2e/tempoSymbolBaseline.e2e.ts`
 * measures the ink in all three faces. Here: the arithmetic, and which face needs how much.
 */
describe('tempoSymbolRaisePx — the tempo’s note stands on its words’ baseline', () => {
  const emPx = () => drawnFontPx(tempoGlyphSizePt())

  it('a music face whose note hangs below the baseline is raised by exactly that much', () => {
    for (const id of ['bravura', 'leipzig'] as const) {
      setActiveMusicFont(id)
      const hangs = glyphBox('metNoteQuarterUp').down
      expect(hangs, id).toBeGreaterThan(0.4)
      expect(tempoSymbolRaisePx(), id).toBeCloseTo((hangs / 4) * emPx(), 10)
    }
  })

  it('⛔ a face that already stands the note on the line is not moved — never a negative raise', () => {
    setActiveMusicFont('sebastian')
    expect(glyphBox('metNoteQuarterUp').down).toBeLessThanOrEqual(0)
    expect(tempoSymbolRaisePx()).toBe(0)
  })

  it('the mark’s ink band grows by the raise — the note’s top is higher than it was', () => {
    expect(tempoInkAbove()).toBeCloseTo(emPx() * 0.75 + tempoSymbolRaisePx(), 10)
  })
})

describe('tempoTextFont', () => {
  it('bold words in the words’ face, the music faces behind for the glyphs — at the table’s size', () => {
    expect(tempoTextFont()).toEqual({ family: 'Academico, Bravura', sizePt: 18, weight: 'bold', style: 'normal' })
  })
})
