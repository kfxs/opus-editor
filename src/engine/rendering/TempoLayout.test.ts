import { describe, it, expect } from 'vitest'
import { tempoOptions } from './TempoLayout'
import { fracCreate as frac } from '@/utils/fraction'
import type { TempoMark } from '@/types/music'

const mark = (extra: Partial<TempoMark>): TempoMark => ({ id: 't', beat: frac(0, 1), ...extra })

/**
 * These guard the ONE thing VexFlow's StaveTempo.draw() gets wrong: it gates the whole
 * metronome on `duration` and prints `bpm` in an `else if` INSIDE that block. So the unit
 * and the number must travel together or not at all.
 */
describe('tempoOptions — the StaveTempo print gate', () => {
  it('prints the word alone when the metronome is hidden (it still SOUNDS — D1)', () => {
    // The naive reading passes {name, duration, bpm: undefined} → StaveTempo engraves the
    // broken "Allegro (♩ = )": open paren, notehead, equals, NOTHING, close paren.
    const opts = tempoOptions(mark({ text: 'Allegro', unit: 'q', bpm: 144, showMetronome: false }))
    expect(opts).toEqual({ name: 'Allegro' })
    expect(opts.duration).toBeUndefined() // ← the trap
    expect(opts.bpm).toBeUndefined()
  })

  it('treats an absent showMetronome as "do not print" (same trap)', () => {
    expect(tempoOptions(mark({ text: 'Largo', unit: 'q', bpm: 50 }))).toEqual({ name: 'Largo' })
  })

  it('never passes a bpm without a unit (StaveTempo would print NOTHING at all)', () => {
    // A metronome mark with no unit stored: default to a quarter rather than engrave nothing.
    const opts = tempoOptions(mark({ bpm: 120, showMetronome: true }))
    expect(opts.duration).toBe('q')
    expect(opts.bpm).toBe(120)
  })

  it('passes unit + dots + bpm together when the metronome is printed', () => {
    expect(tempoOptions(mark({ text: 'Andante', unit: 'h', dots: 1, bpm: 60, showMetronome: true })))
      .toEqual({ name: 'Andante', duration: 'h', dots: 1, bpm: 60 })
  })

  it('prints a metronome with no word (VexFlow omits the parens when name is absent)', () => {
    expect(tempoOptions(mark({ unit: 'q', bpm: 120, showMetronome: true })))
      .toEqual({ name: undefined, duration: 'q', dots: undefined, bpm: 120 })
  })

  it('cannot print a metronome for a word-only mark (no bpm to print)', () => {
    expect(tempoOptions(mark({ text: 'a tempo', showMetronome: true }))).toEqual({ name: 'a tempo' })
  })
})
