// @vitest-environment jsdom
/**
 * Subject: `./EngravedAccidental` — on the PAGE, through the real renderer, read off the SCENE: each sign of the
 * table stamps its own glyph (K4's quarter-tones — his crash, 2026-10-10: a quarter flat's note key `"ad/3"` was
 * refused and the bar drew nothing), and a bracketed sign stamps E26A, the sign, E26B in one group (K3).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { setAccidentalEnclosure } from '../../models/accidentalEnclosureOps'
import { ALTERATION_SIGNS, oneSign } from '@/utils/alterationSigns'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { fracCreate as frac } from '@/utils/fraction'
import type { AlterationSignId } from '@/types/music'

/** One bar per sign (A4 carrying it), optionally bracketed — each accidental group's stamped characters. */
function drawnAccidentals(signs: AlterationSignId[], bracketed = false): string[][] {
  const model = new ScoreModel()
  for (let i = 1; i < signs.length; i++) model.addMeasure()
  const notes = signs.map((sign, i) => model.addNote({ step: 'A', alteration: oneSign(sign), octave: 4, duration: 'w', measure: i + 1, beat: frac(0, 1) }))
  if (bracketed) setAccidentalEnclosure(model.getScore(), notes.map(n => n.id), 'round')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1600, 800)
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return sceneGroups(scene, 'accidental').map(g => scenePrimitives(g).flatMap(p => (p.kind === 'text' ? [p.text] : [])))
}

const char = (glyph: string) => String.fromCodePoint(GLYPH_CODEPOINTS[glyph as keyof typeof GLYPH_CODEPOINTS])

describe('EngravedAccidental — drawn', () => {
  it('⭐ every sign of the table stamps its own glyph — the quarter-tones included (K4)', () => {
    const ids = ALTERATION_SIGNS.map(s => s.id)
    expect(drawnAccidentals(ids)).toEqual(ALTERATION_SIGNS.map(s => [char(s.glyph)]))
  })

  it('⭐ ♮♯ / ♮♭ — a sharp / flat carrying `naturalBefore` — stamp the font\'s own precomposed pair (K5)', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const a = model.addNote({ step: 'A', alteration: ['sharp'], octave: 4, duration: 'w', measure: 1, beat: frac(0, 1), naturalBefore: true })
    const b = model.addNote({ step: 'A', alteration: ['flat'], octave: 4, duration: 'w', measure: 2, beat: frac(0, 1), naturalBefore: true })
    expect([a, b].every(Boolean)).toBe(true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1600, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const drawn = sceneGroups(scene, 'accidental').map(g => scenePrimitives(g).flatMap(p => (p.kind === 'text' ? [p.text] : [])))
    expect(drawn).toEqual([[char('accidentalNaturalSharp')], [char('accidentalNaturalFlat')]])
  })

  it('⭐ a BRACKETED sign stamps the sign, then E26A and E26B, in its one group (K3)', () => {
    expect(drawnAccidentals(['quarterToneFlatStein'], true)).toEqual([
      [char('accidentalQuarterToneFlatStein'), char('accidentalParensLeft'), char('accidentalParensRight')],
    ])
  })
})
