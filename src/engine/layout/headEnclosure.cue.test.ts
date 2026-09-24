import { describe, it, expect, afterEach } from 'vitest'
import { ENCLOSURE_GLYPHS, enclosureLayout } from './headEnclosure'
import { resetCueSize, setCueBrackets } from './cueSize'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import type { NotePitch } from '@/types/music'

/**
 * Subject: `./headEnclosure` — a CUE head's brackets (cue-size-plan C11, P4b): they stand round the SMALL head
 * either way; under `gould` (default) their glyphs are full size, under `shrink` the head's.
 */
describe('headEnclosure — a cue head’s brackets', () => {
  afterEach(() => resetCueSize())
  const B4: NotePitch = { id: 'b', step: 'B', alter: 0, octave: 4, enclosure: 'round' }
  const layout = (cue: boolean) => enclosureLayout({ notes: [B4], duration: 'q', ...(cue && { cue: true as const }) }, () => null, 'treble')!

  it('⭐ `gould`: full-size brackets, standing CLOSER in round the smaller head', () => {
    const full = layout(false)
    const cue = layout(true)
    expect(cue.up, 'the glyph is full size').toBeCloseTo(full.up, 10)
    expect(cue.pairs[0].rightParenX, '`)` comes in with the head').toBeLessThan(full.pairs[0].rightParenX)
    // The left `(` keeps the head's white on its side: the head starts at the same anchor.
    expect(cue.pairs[0].leftParenX).toBeCloseTo(full.pairs[0].leftParenX, 10)
  })

  it('⭐ `shrink`: the brackets at the head’s size — their reach and their white ¾', () => {
    setCueBrackets('shrink')
    const full = layout(false)
    const cue = layout(true)
    expect(cue.up).toBeCloseTo(full.up * 0.75, 10)
    expect(cue.left).toBeCloseTo(full.left * 0.75, 10)
    expect(cue.right).toBeCloseTo(full.right * 0.75, 10)
  })

  it('⛔ a full-size head is what it was', () => {
    const { left, right } = ENCLOSURE_GLYPHS.round
    expect(layout(false).up).toBeCloseTo(Math.max(glyphBox(left).up, glyphBox(right).up), 10)
  })
})
