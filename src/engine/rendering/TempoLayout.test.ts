import { describe, it, expect } from 'vitest'
import { anchorX, splitRuns } from './TempoLayout'
import { fracCreate as frac } from '@/utils/fraction'
import type { ChordRest, TempoMark } from '@/types/music'
import type { Stave, StaveNote } from 'vexflow'

const mark = (extra: Partial<TempoMark>): TempoMark => ({ id: 't', beat: frac(0, 1), ...extra })

/**
 * A stave laid out like an opening bar: barline at 20, clef next, the time signature formatted
 * at 60, and the first note pushed out to 140. `timeSigX = null` = a bar that prints no time
 * signature (i.e. every bar but an opening or a change) — null, not undefined, so passing it
 * explicitly doesn't just re-trigger the default.
 */
const fakeStave = (timeSigX: number | null = 60, x = 20, noteStartX = 100) =>
  ({
    getX: () => x,
    getNoteStartX: () => noteStartX,
    getModifiers: () => (timeSigX === null ? [] : [{ getX: () => timeSigX }]),
  }) as unknown as Stave
const fakeNotes = (...xs: number[]) => xs.map(x => ({ getAbsoluteX: () => x })) as unknown as StaveNote[]
const slotsAt = (...beats: number[]) => beats.map(b => ({ beat: frac(b, 1) })) as unknown as ChordRest[]

/**
 * ⭐⭐ WHAT A TEMPO MARK HANGS OFF — **Gould p. 183**, read from the scan 2026-08-19, and ⛔ never the
 * barline: *"when the tempo change is at the start of the bar, the marking is not placed on the
 * barline"*. The whole Q&A (four books + all three engines) is in `reference/README.md`.
 *
 * 🚨 These cases REVERSED that day. The rule used to be "a downbeat mark belongs to the BAR", which
 * put it on the barline whenever the bar printed no time signature — the one placement the source
 * forbids outright.
 */
describe('anchorX — what a tempo mark hangs off', () => {
  it('⭐ aligns a downbeat mark with the TIME SIGNATURE when the bar prints one', () => {
    // *"When a tempo marking coincides with a time signature indication, align the tempo with the
    // left edge of the time signature"* — Gould p. 183, and Gerou & Lusk p. 142 word for word.
    const x = anchorX(mark({ beat: frac(0, 1) }), slotsAt(0, 2), fakeNotes(140, 200), fakeStave())
    expect(x).toBe(60)
  })

  it('🚨 …and with the FIRST NOTE when it prints none — ⛔ NOT the barline', () => {
    // *"When there is no new time signature, align the tempo marking with the first element of the
    // notation (e.g. a note or accidental) after the clef and key signature."* Her own engraving
    // puts the mark 1.65 sp right of the barline in a plain bar, 7.85 sp when a key change
    // intervenes. ⛔ 20 (the barline) is what this returned before.
    const x = anchorX(mark({ beat: frac(0, 1) }), slotsAt(0), fakeNotes(140), fakeStave(null))
    expect(x).toBe(140)
  })

  it('⭐⭐ …unless the bar is EMPTY: a centred whole-bar rest is not something to align to', () => {
    // His catch, 2026-08-19. The rest is drawn in the MIDDLE of the bar, so the literal reading of
    // "the first element of the notation" would put `Allegro` halfway along an empty measure.
    // LilyPond has exactly this exception in code (`metronome-engraver.cc` keeps the bar grob for a
    // multi-measure rest), so the mark falls back to where the bar's music would start.
    const empty = [{ beat: frac(0, 1), type: 'rest', isMeasureRest: true }] as unknown as ChordRest[]
    expect(anchorX(mark({ beat: frac(0, 1) }), empty, fakeNotes(300), fakeStave(null))).toBe(100)
    // …and with a time signature it is the time signature's, as any downbeat mark is.
    expect(anchorX(mark({ beat: frac(0, 1) }), empty, fakeNotes(300), fakeStave())).toBe(60)
  })

  it('anchors a mid-bar mark to the first note at-or-after its beat', () => {
    // *"Tempo indications mid-bar also align with the first notational element of the respective
    // beat"* — and a mid-bar mark never coincides with the time signature, so it takes this branch
    // even in a bar that prints one.
    const x = anchorX(mark({ beat: frac(2, 1) }), slotsAt(0, 2), fakeNotes(140, 200), fakeStave())
    expect(x).toBe(200)
  })

  it('falls back to the note-start X for a beat with nothing at or after it', () => {
    const x = anchorX(mark({ beat: frac(3, 1) }), slotsAt(0, 2), fakeNotes(140, 200), fakeStave())
    expect(x).toBe(100)
  })

  it('still finds the bar opening when the bar has no notes at all', () => {
    expect(anchorX(mark({ beat: frac(0, 1) }), [], [], fakeStave())).toBe(60)
    expect(anchorX(mark({ beat: frac(0, 1) }), [], [], fakeStave(null))).toBe(100)
  })
})

/**
 * The mark is drawn as RUNS: note characters are engraved from the music font as real SMuFL
 * glyphs, everything else in the text font. This is what replaced VexFlow's StaveTempo — which
 * could only ever print `Word (\u2669 = n)`, its way, brackets forced and word first.
 */
describe('splitRuns \u2014 what is drawn from the music font, and what is not', () => {
  const NOTE_Q = '\uECA5'  // metNoteQuarterUp
  const NOTE_H = '\uECA3'  // metNoteHalfUp
  const DOT = '\uECB7'     // metAugmentationDot

  it('splits a mark into words and note glyphs, in the order typed', () => {
    expect(splitRuns('Moderato \u2669 = 112 sempre')).toEqual([
      { text: 'Moderato ' },
      { glyph: NOTE_Q },
      { text: ' = 112 sempre' },   // words AFTER the number stay after it
    ])
  })

  it('keeps the brackets — they are just characters, so deleting them sticks', () => {
    expect(splitRuns('Allegro (\u2669 = 144)')).toEqual([
      { text: 'Allegro (' },
      { glyph: NOTE_Q },
      { text: ' = 144)' },
    ])
    expect(splitRuns('Allegro \u2669 = 144')).toEqual([
      { text: 'Allegro ' },
      { glyph: NOTE_Q },
      { text: ' = 144' },
    ])
  })

  /**
   * The half note is NOT one character: it is a notehead (U+1D157) plus a COMBINING STEM
   * (U+1D165) \u2014 and the 16th adds a combining flag on top of that, three code points. A scanner
   * that walks one character at a time misses every one of them, and a `\ud834\udd57\ud834\udd65 = 60` metronome prints
   * as raw text instead of a glyph. That was a real bug; this is the test that caught it.
   */
  it('matches a note written as a SEQUENCE of code points, not just a single character', () => {
    expect(splitRuns('\u{1D157}\u{1D165}. = 60')).toEqual([
      { glyph: NOTE_H },
      { glyph: DOT },   // the augmentation dot rides with the note \u2014 \u2669. is a dotted quarter
      { text: ' = 60' },
    ])
  })

  it('a full stop that does NOT follow a note is just a full stop', () => {
    expect(splitRuns('a tempo. Allegro')).toEqual([{ text: 'a tempo. Allegro' }])
  })

  it('a word with no metronome is one plain text run', () => {
    expect(splitRuns('sempre pi\u00f9 mosso')).toEqual([{ text: 'sempre pi\u00f9 mosso' }])
  })
})
