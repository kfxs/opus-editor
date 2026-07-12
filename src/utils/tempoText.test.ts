import { describe, it, expect } from 'vitest'
import { parseTempoText, composeTempoText, tempoFieldsFromTool } from './tempoText'
import { fracCreate as frac } from './fraction'
import type { TempoMark } from '@/types/music'

const mark = (extra: Partial<TempoMark>): TempoMark => ({ id: 't', beat: frac(0, 1), ...extra })

/**
 * The mark IS its text. These tests are the contract that makes that safe: whatever you type is
 * what gets stored and printed, and the SPEED is read back out of it. Nothing re-composes the
 * string, so nothing can quietly rewrite it.
 */
describe('parseTempoText — the string is kept, the speed is read out of it', () => {
  it('keeps the string exactly as typed, and finds the metronome in it', () => {
    expect(parseTempoText('Allegro (♩ = 144)')).toEqual({
      ok: true, text: 'Allegro (♩ = 144)', unit: 'q', dots: undefined, bpm: 144,
    })
  })

  /** The two bugs that killed the old fields-are-truth model, now impossible by construction. */
  it('KEEPS deleted brackets deleted — they are characters, not a setting', () => {
    expect(parseTempoText('Moderato ♩ = 112')).toMatchObject({ text: 'Moderato ♩ = 112', bpm: 112 })
  })

  it('KEEPS words typed after the number after it', () => {
    expect(parseTempoText('Moderato ♩ = 112 sempre'))
      .toMatchObject({ text: 'Moderato ♩ = 112 sempre', bpm: 112 })
  })

  it('accepts a TYPED shorthand for the unit and prints it as a real note', () => {
    // You cannot type ♩ on a keyboard — Sibelius makes you insert it from a palette. We take
    // either, and normalize to the glyph so the score engraves a note, not the letter 'q'.
    expect(parseTempoText('Allegro (q = 120)')).toMatchObject({ text: 'Allegro (♩ = 120)', unit: 'q', bpm: 120 })
    expect(parseTempoText('h=60')).toMatchObject({ text: '𝅗𝅥 = 60', unit: 'h', bpm: 60 })
  })

  it('reads the dots — ♩. = 60 is not ♩ = 60', () => {
    expect(parseTempoText('♩. = 60')).toMatchObject({ unit: 'q', dots: 1, bpm: 60 })
  })

  it('a word or a phrase with no metronome states no speed at all', () => {
    expect(parseTempoText('sempre più mosso')).toEqual({ ok: true, text: 'sempre più mosso' })
  })

  /**
   * The shorthands are single letters, so an unanchored match eats the ends of words: 'Andante'
   * ends in 'e' (the eighth-note shorthand), which would parse as ♪ = 120 and leave the word as
   * 'Andant'. The unit has to stand on its own.
   */
  it('does not mistake the end of a word for a unit', () => {
    expect(parseTempoText('Andante = 120')).toEqual({ ok: true, text: 'Andante = 120' })
  })

  it('deleting a PRINTED metronome really deletes the speed', () => {
    const prev = mark({ text: 'Allegro (♩ = 144)', unit: 'q', bpm: 144 })
    expect(parseTempoText('Allegro', prev)).toEqual({ ok: true, text: 'Allegro' })
  })

  /** An edit can only delete what it could SEE. The word 'Allegro' quietly means 144: that number
   *  is nowhere in the string, so retyping the word must not wipe it. */
  it('retyping a word whose number was never printed keeps it sounding', () => {
    const prev = mark({ text: 'Allegro', unit: 'q', bpm: 144 })
    expect(parseTempoText('Allegro con brio', prev)).toEqual({
      ok: true, text: 'Allegro con brio', unit: 'q', dots: undefined, bpm: 144,
    })
  })

  it('rejects a nonsense bpm rather than producing an impossible clock', () => {
    expect(parseTempoText('♩ = 0')).toEqual({ ok: false, reason: 'bpm-out-of-range', bpm: 0 })
    expect(parseTempoText('♩ = 5000')).toMatchObject({ ok: false, reason: 'bpm-out-of-range' })
  })

  it('an empty string says nothing at all — the mark should go', () => {
    expect(parseTempoText('   ')).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('composeTempoText — the string the palette places', () => {
  it('brackets the metronome when there is a word beside it', () => {
    expect(composeTempoText({ text: 'Allegro', unit: 'q', bpm: 144, showMetronome: true }))
      .toBe('Allegro (♩ = 144)')
  })

  it('places a bare metronome unbracketed (no word to bracket it against)', () => {
    expect(composeTempoText({ unit: 'q', dots: 1, bpm: 60, showMetronome: true })).toBe('♩. = 60')
  })

  it('places the word alone when the tool is not printing a metronome (it still sounds)', () => {
    expect(composeTempoText({ text: 'Allegro', bpm: 144, showMetronome: false })).toBe('Allegro')
  })

  /** Everything it composes must survive the round trip, or the palette would place marks whose
   *  text and speed disagree the moment they are opened for editing. */
  it('round-trips: what the palette places, the parser reads back unchanged', () => {
    const placed = composeTempoText({ text: 'Andante', unit: 'h', dots: 1, bpm: 66, showMetronome: true })
    expect(parseTempoText(placed)).toEqual({ ok: true, text: placed, unit: 'h', dots: 1, bpm: 66 })
  })
})

/**
 * The GHOST and the CLICK must compose the same string, or the preview lies about what will be
 * engraved. They didn't: the ghost spread the raw tool, and a bare-metronome tool has NO `text` —
 * so the ghost had nothing to draw and no preview appeared at all while the tool was armed.
 */
describe('tempoFieldsFromTool — the one place the palette becomes a mark', () => {
  it('gives a BARE METRONOME tool its text (it has none of its own — the ghost drew nothing)', () => {
    expect(tempoFieldsFromTool({ unit: 'q', bpm: 120, showMetronome: true }))
      .toEqual({ text: '♩ = 120', unit: 'q', dots: undefined, bpm: 120 })
  })

  it('carries the speed through even when the number is not printed (the word still sounds)', () => {
    expect(tempoFieldsFromTool({ text: 'Allegro', unit: 'q', bpm: 144, showMetronome: false }))
      .toEqual({ text: 'Allegro', unit: 'q', dots: undefined, bpm: 144 })
  })

  it('drops showMetronome — it is a property of the FORM, not of the mark', () => {
    expect(tempoFieldsFromTool({ text: 'Adagio', bpm: 60, showMetronome: true }))
      .not.toHaveProperty('showMetronome')
  })
})
