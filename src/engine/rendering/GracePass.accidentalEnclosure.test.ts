// @vitest-environment jsdom
/**
 * Subject: `./GracePass` — a GRACE's bracketed accidental (alteration-signs K3b): its run `(` sign `)` is stamped
 * at the room's own offsets, and each bracket is filed as its own `accidentalEnclosure` hit box so it selects alone.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { scenePrimitives } from '@/engine/scene/Scene'
import * as graceOps from '../models/graceOps'
import { setAccidentalEnclosure } from '../models/accidentalEnclosureOps'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { fracCreate as frac } from '@/utils/fraction'

const char = (name: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[name])

describe('GracePass — a bracketed accidental on a grace (K3b)', () => {
  function draw(bracketed: boolean) {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const grace = graceOps.addGrace(model.getScore(), host.id, 'before', { step: 'D', alteration: ['sharp'], octave: 5 }, 'appoggiatura', { duration: '8' })!
    if (bracketed) setAccidentalEnclosure(model.getScore(), [grace.pitches[0].id], 'round')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const texts = scenePrimitives(scene).flatMap(p => (p.kind === 'text' ? [p.text] : []))
    const boxes = renderer.getElementRegistry().getByType('accidentalEnclosure').filter(el => el.noteId === grace.pitches[0].id)
    return { texts, boxes }
  }

  it('⭐ stamps `(` and `)` beside the grace\'s sharp, and files two bracket boxes', () => {
    const { texts, boxes } = draw(true)
    const at = texts.indexOf(char('accidentalSharp'))
    expect(texts.slice(at, at + 3)).toEqual([char('accidentalSharp'), char('accidentalParensLeft'), char('accidentalParensRight')])
    expect(boxes).toHaveLength(2)
  })

  it('…and a bare grace sign stamps none', () => {
    const { texts, boxes } = draw(false)
    expect(texts).not.toContain(char('accidentalParensLeft'))
    expect(boxes).toHaveLength(0)
  })
})
