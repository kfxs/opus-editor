import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * The TWO-NOTE tremolo MODEL — one field on the FIRST slot (docs/two-note-tremolo-plan.md §1).
 *
 * These pin the apply/refuse rule and the two staleness defences (drop + validate). Nothing here is
 * about how the strokes are DRAWN: jsdom cannot measure glyphs, so a geometry assertion would pass
 * vacuously (reference_jsdom_cannot_measure_glyphs) — the strokes are checked by eye.
 */
describe('tremoloPair (model)', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel('Two-note tremolo')
  })

  const chordAt = (measure: number, beat: number): Chord => {
    const slot = model.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)!
    if (slot?.type !== 'chord') throw new Error('expected a chord slot')
    return slot
  }

  /** Two quarters at beats 0 and 1 of bar 1 — the ordinary pairable neighbours. */
  const twoQuarters = () => ({
    a: model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }),
    b: model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) }),
  })

  it('marks the FIRST slot only — the second carries nothing', () => {
    const { a } = twoQuarters()
    expect(model.setTremoloPair(a.id, true)).not.toBeNull()
    expect(chordAt(1, 0).tremoloPair).toBe(true)
    expect('tremoloPair' in chordAt(1, 1)).toBe(false)
  })

  it('mints THREE strokes when the note carries none, and keeps a count it already has', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    expect(chordAt(1, 0).tremolo).toBe(3)

    const model2 = new ScoreModel('kept')
    const c = model2.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model2.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model2.setTremolo(c.id, 5)
    model2.setTremoloPair(c.id, true)
    const slot = model2.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === 0) as Chord
    expect(slot.tremolo).toBe(5)
  })

  it('does NOT rewrite the durations — only the drawing doubles', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    expect(chordAt(1, 0).duration).toBe('q')
    expect(chordAt(1, 1).duration).toBe('q')
  })

  it('refuses when the next slot is a rest (nothing to alternate with)', () => {
    // A fresh bar is rest-filled: a lone note at beat 0 has a rest after it.
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(model.setTremoloPair(a.id, true)).toBeNull()
    expect('tremoloPair' in chordAt(1, 0)).toBe(false)
    // …and having refused, it wrote no stroke count either.
    expect(chordAt(1, 0).tremolo).toBeUndefined()
  })

  it('refuses a REST outright', () => {
    const rest = model.getMeasure(1)!.slots[0]
    expect(rest.type).toBe('rest')
    expect(model.setTremoloPair(rest.id, true)).toBeNull()
  })

  it('removing takes BOTH fields off — the pair is one mark', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    expect(model.setTremoloPair(a.id, false)).not.toBeNull()
    expect('tremoloPair' in chordAt(1, 0)).toBe(false)
    expect('tremolo' in chordAt(1, 0)).toBe(false)
  })

  it('removing a pair that is not there is a no-op', () => {
    const { a } = twoQuarters()
    expect(model.setTremoloPair(a.id, false)).toBeNull()
  })

  it('marks the SLOT, so any pitch of a chord is the same press', () => {
    const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(model.setTremoloPair(e.id, true)).not.toBeNull()
    expect(chordAt(1, 0).tremoloPair).toBe(true)
    expect(model.getNote(c.id)?.tremoloPair).toBe(true)
  })

  it('serializes with the slot — no migration, ever', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    const round = JSON.parse(JSON.stringify(model.getScore()))
    const first = round.measures[0].slots.find((s: { beat: { num: number } }) => s.beat.num === 0)
    expect(first.tremoloPair).toBe(true)
    expect(first.tremolo).toBe(3)
  })

  /**
   * ⚠️ A pair is a RELATION, so it can go STALE — the one thing the single-note mark cannot do. The
   * relay must hand `tremolo` to every piece of a split and `tremoloPair` to NONE of them: adjacency
   * is not a property of the event. That is why `RebarEvent` has no such field.
   */
  it('is DROPPED by a re-bar, while the stroke count survives it', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)
    expect(chordAt(1, 0).tremoloPair).toBe(true)

    // A meter change re-bars the region through the relay.
    model.setTimeSignature(1, { numerator: 3, denominator: 4 }, { rewrite: 'rebar' })

    const slots = model.getScore().measures.flatMap(m => m.slots)
    expect(slots.some(s => s.type === 'chord' && s.tremoloPair)).toBe(false)
    expect(slots.some(s => s.type === 'chord' && s.tremolo === 3)).toBe(true)
  })
})

/**
 * The stroke STYLE — joined to both stem tips, or floating clear of them (P6). Offered on the drawn
 * BLANCA and nowhere else, and REFUSED elsewhere rather than written-and-ignored.
 */
describe('tremoloPairStyle (model)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Style') })

  const paired = (duration: 'h' | 'q' | '8') => {
    const step = { h: 2, q: 1, '8': 0.5 }[duration]
    const a = model.addNote({ step: 'C', octave: 4, duration, measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration, measure: 1, beat: frac(step * 2, 2) })
    model.setTremoloPair(a.id, true)
    return a
  }
  const styleAt = (measure: number, beat: number) => {
    const slot = model.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)
    return slot?.type === 'chord' ? slot.tremoloPairStyle : undefined
  }

  it('sets the style on a pair of QUARTERS — the drawn blanca', () => {
    const a = paired('q')
    expect(model.setTremoloPairStyle(a.id, 'joined')).not.toBeNull()
    expect(styleAt(1, 0)).toBe('joined')
    expect(model.tremoloPairAcceptsJoined(a.id)).toBe(true)
  })

  it('⚠️ REFUSES it on any other drawn value — the restriction is the point', () => {
    for (const duration of ['h', '8'] as const) {
      const fresh = new ScoreModel('Style')
      model = fresh
      const a = paired(duration)
      expect(model.setTremoloPairStyle(a.id, 'joined')).toBeNull()
      expect(styleAt(1, 0)).toBeUndefined()
      expect(model.tremoloPairAcceptsJoined(a.id)).toBe(false)
    }
  })

  it('refuses a note with no pair at all', () => {
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(model.setTremoloPairStyle(a.id, 'joined')).toBeNull()
    expect(model.tremoloPairAcceptsJoined(a.id)).toBe(false)
  })

  it("stores 'open' rather than deleting — it is a chosen override, not an absence", () => {
    const a = paired('q')
    model.setTremoloPairStyle(a.id, 'joined')
    model.setTremoloPairStyle(a.id, 'open')
    expect(styleAt(1, 0)).toBe('open')
  })
})

/**
 * ⚠️ THE STYLE IS CLEARED WITH THE MARK. `tremoloPairStyle` left on a plain note is the same
 * resurrection trap the flag itself is: silently re-joining the strokes the day that note is paired
 * again, from a choice nobody remembers making.
 */
describe('tremoloPairStyle is cleared with the mark', () => {
  let model: ScoreModel
  let a: { id: string }

  beforeEach(() => {
    model = new ScoreModel('Clear')
    a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.setTremoloPair(a.id, true)
    model.setTremoloPairStyle(a.id, 'joined')
  })

  const first = () => {
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === 0)
    return slot?.type === 'chord' ? slot : undefined
  }

  it('goes when the PAIR is removed', () => {
    expect(first()?.tremoloPairStyle).toBe('joined')
    model.setTremoloPair(a.id, false)
    expect(first()?.tremoloPairStyle).toBeUndefined()
  })

  it('goes when the COUNT is removed (Delete)', () => {
    model.setTremolo(a.id, null)
    expect(first()?.tremoloPairStyle).toBeUndefined()
    expect(first()?.tremoloPair).toBeUndefined()
  })

  it('⭐ so re-pairing the same note starts OPEN, not silently joined', () => {
    model.setTremoloPair(a.id, false)
    model.setTremoloPair(a.id, true)
    expect(first()?.tremoloPairStyle).toBeUndefined()
  })

  it('but CHANGING the count leaves it — that is the same mark re-read', () => {
    model.setTremolo(a.id, 5)
    expect(first()?.tremoloPairStyle).toBe('joined')
    expect(first()?.tremoloPair).toBe(true)
  })
})
