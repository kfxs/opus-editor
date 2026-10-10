// @vitest-environment jsdom
/**
 * Subject: `./FanPass` — a fan MEMBER's bracketed accidental (alteration-signs K3b): `(` sign `)` stamped in the
 * member's ink, each bracket filed as its own `accidentalEnclosure` hit box.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { scenePrimitives } from '@/engine/scene/Scene'
import { setAccidentalEnclosure } from '../../models/accidentalEnclosureOps'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

const char = (name: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[name])

describe('FanPass — a bracketed accidental on a fan member (K3b)', () => {
  it('⭐ stamps `(` and `)` beside the member\'s sharp, and files two bracket boxes', () => {
    const model = new ScoreModel()
    const n = model.addNote({ step: 'E', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(n.id, { direction: 'accel', count: 3, beams: 3 })
    const slot = model.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!
    const member = slot.fan!.members![0].pitches[0]
    member.alteration = ['sharp']
    expect(setAccidentalEnclosure(model.getScore(), [member.id], 'round')).toBe(1)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const texts = scenePrimitives(scene).flatMap(p => (p.kind === 'text' ? [p.text] : []))
    const at = texts.indexOf(char('accidentalSharp'))
    expect(texts.slice(at, at + 3)).toEqual([char('accidentalSharp'), char('accidentalParensLeft'), char('accidentalParensRight')])
    expect(renderer.getElementRegistry().getByType('accidentalEnclosure').filter(el => el.noteId === member.id)).toHaveLength(2)
  })
})
