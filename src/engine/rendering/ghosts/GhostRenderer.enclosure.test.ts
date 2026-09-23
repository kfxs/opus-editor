// @vitest-environment jsdom
/**
 * Subject: `./GhostRenderer` — the NOTE ghost wears the armed entry BRACKETS (parenthesised-note-plan
 * P4b; his report, 2026-09-23: *"when a note stamp with parenthesis is armed i dont see the parenthesis in
 * the ghost"*). Stamped inside the ghost's own `.ghost-note-group`, so they are swept and tinted with it.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { ENCLOSURE_GLYPHS } from '@/engine/layout/headEnclosure'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import type { GhostNote } from './ghostTypes'

const char = (n: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[n])

function ghostTexts(ghost: GhostNote): string[] {
  const model = new ScoreModel()
  model.addMeasure()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  renderer.renderScore(model.getScore())
  expect(renderer.drawGhostNote(model.getScore(), ghost)).toBe(true)
  const group = renderer.getSVGElement()!.querySelector('.ghost-note-group')!
  return Array.from(group.querySelectorAll('text')).map(t => t.textContent ?? '')
}

describe('the note ghost and the armed entry brackets', () => {
  const base: GhostNote = { step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: 1 }

  it('⭐ brackets armed: the pair is drawn inside the ghost\'s own group', () => {
    const texts = ghostTexts({ ...base, enclosure: 'round' })
    expect(texts).toContain(char(ENCLOSURE_GLYPHS.round.left))
    expect(texts).toContain(char(ENCLOSURE_GLYPHS.round.right))
  })

  it('none armed: no brackets', () => {
    expect(ghostTexts(base)).not.toContain(char(ENCLOSURE_GLYPHS.round.left))
  })
})
