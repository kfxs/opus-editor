import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * The single-note tremolo MODEL — one field on the slot (docs/tremolo-plan.md §1).
 *
 * These pin the three properties the stamp relies on and nothing about how the mark is DRAWN:
 * jsdom cannot measure glyphs, so a geometry assertion here would pass vacuously
 * (reference_jsdom_cannot_measure_glyphs). The strokes are checked by eye.
 *
 * Subject: {@link markOps} — renamed from `ScoreModel.tremolo.test.ts` on 2026-07-28, when the
 * mark setters moved into their own module (modularity plan Phase 3). A `ScoreModel` is the fixture.
 */
describe('tremolo (model)', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel('Tremolo')
  })

  const chordAt = (measure: number, beat: number): Chord => {
    const slot = model.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  it('rides the SLOT, so a chord tremolos as a chord', () => {
    const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // Same measure + beat = the same slot: addNote joins the existing chord.
    const e = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    // Marked through ONE of its pitches…
    expect(model.setTremolo(e.id, 3)).not.toBeNull()
    // …and the mark is on the event both pitches belong to, not on a notehead.
    expect(chordAt(1, 0).tremolo).toBe(3)
    expect(model.getNote(c.id)?.tremolo).toBe(3)
    expect(model.getNote(e.id)?.tremolo).toBe(3)
  })

  it('is SINGLE-valued: a second mark replaces the first', () => {
    const note = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 2)
    model.setTremolo(note.id, 'penderecki')
    expect(chordAt(1, 0).tremolo).toBe('penderecki')
  })

  it('clears with null, and the field goes away rather than storing a default', () => {
    const note = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 1)
    model.setTremolo(note.id, null)
    expect('tremolo' in chordAt(1, 0)).toBe(false)
  })

  it('refuses a REST — you cannot tremolo silence', () => {
    // A fresh bar is rest-filled, so the rest at beat 0 is a real slot with a real id.
    const rest = model.getMeasure(1)!.slots[0]
    expect(rest.type).toBe('rest')
    expect(model.setTremolo(rest.id, 3)).toBeNull()
    expect((model.getMeasure(1)!.slots[0] as { tremolo?: unknown }).tremolo).toBeUndefined()
  })

  it('serializes with the slot — no migration, ever', () => {
    const note = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 4)
    const round = JSON.parse(JSON.stringify(model.getScore()))
    expect(round.measures[0].slots[0].tremolo).toBe(4)
  })
})
