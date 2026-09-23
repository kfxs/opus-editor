import { describe, it, expect } from 'vitest'
import { ENCLOSURE_GLYPHS, ENCLOSURE_ROWS, chordEnclosure, enclosureLayout } from './headEnclosure'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setEnclosure } from '@/engine/models/enclosureOps'
import { fracCreate as frac } from '@/utils/fraction'
import { INK, accidentalExtent, dotExtent } from './spacingPadding'
import { glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import type { Chord, NotePitch, PitchStep } from '@/types/music'

/**
 * Subject: `./headEnclosure` — where a parenthesised head's brackets stand and the room they take
 * (docs/plans/parenthesised-note-plan.md P1). Pure arithmetic on the metric tables.
 */
describe('enclosureLayout', () => {
  const pitch = (id: string, step: PitchStep, octave: number, enclosed = true): NotePitch =>
    ({ id, step, alter: 0, octave, ...(enclosed && { enclosure: 'round' as const }) })
  const none = () => null
  const L = glyphBox(ENCLOSURE_GLYPHS.round.left)
  const R = glyphBox(ENCLOSURE_GLYPHS.round.right)

  it('null when no head wears brackets', () => {
    expect(enclosureLayout({ notes: [pitch('a', 'B', 4, false)] }, none, 'treble')).toBeNull()
  })

  it('⭐ a bare head: each bracket\'s INK keeps the head row of white from the head', () => {
    const layout = enclosureLayout({ notes: [pitch('a', 'B', 4)] }, none, 'treble')!
    const [pair] = layout.pairs
    // `(`'s ink ends `L.right` past its origin; `)`'s begins `R.left` before its own.
    expect(pair.leftParenX + L.right).toBeCloseTo(-ENCLOSURE_ROWS.head.value, 9)
    expect(pair.rightParenX - R.left).toBeCloseTo(INK.notehead + ENCLOSURE_ROWS.head.value, 9)
    expect(layout.left).toBeCloseTo(L.left - pair.leftParenX, 9)
    expect(layout.right).toBeCloseTo(pair.rightParenX + R.right, 9)
    expect(pair.line).toBe(3)
  })

  it('⭐ a WHOLE note\'s head is wider — `)` stands past IT, not past a quarter\'s (his report, 2026-09-23)', () => {
    const quarter = enclosureLayout({ notes: [pitch('a', 'B', 4)], duration: 'q' }, none, 'treble')!
    const whole = enclosureLayout({ notes: [pitch('a', 'B', 4)], duration: 'w' }, none, 'treble')!
    expect(quarter.pairs[0].rightParenX - R.left).toBeCloseTo(INK.notehead + ENCLOSURE_ROWS.head.value, 9)
    expect(whole.pairs[0].rightParenX - quarter.pairs[0].rightParenX).toBeCloseTo(noteheadInk('w') - noteheadInk('q'), 9)
    expect(whole.pairs[0].leftParenX).toBe(quarter.pairs[0].leftParenX)
  })

  it('⭐ the ACCIDENTAL is inside: `(` stands past it by the accidental row', () => {
    const signs = { a: '#' } as Record<string, string>
    const layout = enclosureLayout({ notes: [pitch('a', 'B', 4)] }, id => signs[id], 'treble')!
    const reach = accidentalExtent([{ position: 0, sign: '#' }])
    expect(layout.pairs[0].leftParenX + L.right).toBeCloseTo(-(reach + ENCLOSURE_ROWS.accidental.value), 9)
  })

  it('⭐ the DOTS are inside: `)` stands past the last dot', () => {
    const bare = enclosureLayout({ notes: [pitch('a', 'B', 4)] }, none, 'treble')!
    const dotted = enclosureLayout({ notes: [pitch('a', 'B', 4)], dots: 2 }, none, 'treble')!
    expect(dotted.pairs[0].rightParenX - R.left).toBeCloseTo(
      Math.max(INK.notehead + ENCLOSURE_ROWS.head.value, dotExtent(2) + ENCLOSURE_ROWS.dot.value), 9)
    expect(dotted.right).toBeGreaterThan(bare.right)
  })

  it('⭐ a head on a LEDGER line: the brackets clear the ledger\'s ends', () => {
    const layout = enclosureLayout({ notes: [pitch('a', 'C', 4)] }, none, 'treble')!
    expect(layout.pairs[0].leftParenX + L.right).toBeCloseTo(
      -Math.max(ENCLOSURE_ROWS.head.value, INK.ledgerLeft + ENCLOSURE_ROWS.ledger.value), 9)
  })

  it('⭐ N3 default: a chord\'s bracketed heads take one pair EACH, at the same x; a bare head takes none', () => {
    const layout = enclosureLayout({ notes: [pitch('a', 'G', 4), pitch('b', 'D', 5, false), pitch('c', 'B', 4)] }, none, 'treble')!
    expect(layout.pairs.map(p => p.pitch.id)).toEqual(['a', 'c'])
    expect(layout.pairs[0].leftParenX).toBe(layout.pairs[1].leftParenX)
    expect(layout.pairs[0].rightParenX).toBe(layout.pairs[1].rightParenX)
  })

  it('⭐ a STEM-DOWN second displaces its head to the LEFT: `(` moves out, `)` does not', () => {
    const single = enclosureLayout({ notes: [pitch('a', 'D', 5)], stemDown: true }, none, 'treble')!
    const second = enclosureLayout({ notes: [pitch('a', 'D', 5), pitch('b', 'E', 5, false)], stemDown: true }, none, 'treble')!
    expect(single.pairs[0].leftParenX - second.pairs[0].leftParenX).toBeCloseTo(INK.secondDisplacement, 9)
    expect(second.pairs[0].rightParenX).toBeCloseTo(single.pairs[0].rightParenX, 9)
  })

  it('⭐ an UP-FLAG: `)` stands past the flag by the flag row (it hangs through where `)` would be)', () => {
    const layout = enclosureLayout({ notes: [pitch('a', 'G', 4)], upFlag: true }, none, 'treble')!
    expect(layout.pairs[0].rightParenX - R.left).toBeCloseTo(INK.notehead + INK.flagReach + ENCLOSURE_ROWS.flag.value, 9)
  })

  it('a SECOND puts the right bracket past the displaced head', () => {
    const single = enclosureLayout({ notes: [pitch('a', 'B', 4)] }, none, 'treble')!
    const second = enclosureLayout({ notes: [pitch('a', 'B', 4), pitch('b', 'C', 5, false)] }, none, 'treble')!
    expect(second.pairs[0].rightParenX - single.pairs[0].rightParenX).toBeCloseTo(INK.secondDisplacement, 9)
  })

  it('chordEnclosure reads the chord\'s drawn sign from its LANE — a second sharp in the bar draws none', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    setEnclosure(model.getScore(), [b.id], 'round')
    const chord = model.getScore().measures[0].slots.find(s => s.type === 'chord' && s.notes[0].id === b.id) as Chord
    const bare = enclosureLayout({ notes: chord.notes }, none, 'treble')!
    expect(chordEnclosure(model.getScore(), chord, 'treble')!.left).toBeCloseTo(bare.left, 9)
  })
})
