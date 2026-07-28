import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Chord } from '@/types/music'
import { buildClipboardFromSelection } from '@/interactions/clipboard'

/**
 * The TWO-NOTE tremolo MODEL — one field on the FIRST slot (docs/two-note-tremolo-plan.md §1).
 *
 * These pin the apply/refuse rule and the two staleness defences (drop + validate). Nothing here is
 * about how the strokes are DRAWN: jsdom cannot measure glyphs, so a geometry assertion would pass
 * vacuously (reference_jsdom_cannot_measure_glyphs) — the strokes are checked by eye.
 *
 * Subject: {@link markOps} — renamed from `ScoreModel.tremoloPair.test.ts` on 2026-07-28, when the
 * mark setters moved into their own module (modularity plan Phase 3). A `ScoreModel` is the fixture.
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
   * ⚠️ A pair is a RELATION, so a re-bar can break it — the one thing the single-note mark cannot
   * suffer. `RebarEvent` has no `tremoloPair` field and must not (the relay hands a split event's
   * marks to EVERY piece, which would mint a bogus pair between two halves of one note), so the
   * relation travels by POSITION instead: captured before the re-tile, re-found after, and re-applied
   * only where it is still a pair.
   */
  it('SURVIVES a re-bar that leaves the two adjacent', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)

    // 4/4 → 3/4: both quarters stay in bar 1, side by side. Still a pair, so still marked.
    model.setTimeSignature(1, { numerator: 3, denominator: 4 }, { rewrite: 'rebar' })
    expect(chordAt(1, 0).tremoloPair).toBe(true)
    expect(chordAt(1, 0).tremolo).toBe(3)
  })

  it('is DROPPED by a re-bar that tears the two APART', () => {
    const { a } = twoQuarters()
    model.setTremoloPair(a.id, true)

    // 4/4 → 1/4: one quarter per bar, so the two land in different measures — not a pair any more.
    model.setTimeSignature(1, { numerator: 1, denominator: 4 }, { rewrite: 'rebar' })

    const slots = model.getScore().measures.flatMap(m => m.slots)
    expect(slots.some(s => s.type === 'chord' && s.tremoloPair)).toBe(false)
    // The COUNT is a property of the event, so it rides along — the mark degrades to stem strokes
    // rather than vanishing.
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

/**
 * ⭐ "I should be able to paste what I copied" — and the same for a voice move. Both are pipelines
 * that can break the relation, and the answer is the same in both: if BOTH notes travel, the mark
 * travels; if only one does, it is severed rather than left dangling.
 */
describe('the pair survives copy/paste and a voice move', () => {
  const twoQuarters = (m: ScoreModel) => {
    const a = m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = m.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    m.setTremoloPair(a.id, true)
    return { a, b }
  }
  const chordAt = (m: ScoreModel, measure: number, beat: number) => {
    const slot = m.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)
    return slot?.type === 'chord' ? slot : undefined
  }

  it('COPIES and PASTES whole, style included', () => {
    const m = new ScoreModel('P')
    m.addMeasure()
    const { a, b } = twoQuarters(m)
    m.setTremoloPairStyle(a.id, 'joined')

    const clip = buildClipboardFromSelection(m.getScore(), [a.id, b.id])!
    expect(clip.lanes[0].tremoloPairs).toHaveLength(1)
    m.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    expect(chordAt(m, 2, 0)?.tremoloPair).toBe(true)
    expect(chordAt(m, 2, 0)?.tremolo).toBe(3)
    expect(chordAt(m, 2, 0)?.tremoloPairStyle).toBe('joined')
    // Still ONE field, on the first slot — the paste did not invent a second.
    expect(chordAt(m, 2, 1)?.tremoloPair).toBeUndefined()
  })

  it('⚠️ a paste does NOT un-pair the marks it lands NEAR (his report)', () => {
    // Reported: pasting into bar 4 quietly cleared a pair at bar 4 beat 0 AND one in bar 5 — neither
    // of them touched by the paste. Every slot in the rebuilt region goes through the relay, which
    // cannot carry the relation, so the destination's OWN pairs must be captured across the re-tile
    // exactly as the clip's are re-applied after it.
    const m = new ScoreModel('P')
    for (let i = 0; i < 5; i++) m.addMeasure()
    const a = m.addNote({ step: 'C', octave: 4, duration: 'q', measure: 4, beat: frac(0, 1) })
    const b = m.addNote({ step: 'F', octave: 4, duration: 'q', measure: 4, beat: frac(1, 1) })
    m.setTremoloPair(a.id, true)

    const clip = buildClipboardFromSelection(m.getScore(), [a.id, b.id])!
    const paste = (measure: number, beat: number) => m.pasteEvents(clip, { measure, beat: frac(beat, 1), voice: 0 })

    paste(5, 0)
    paste(4, 2)   // the paste whose region spans BOTH bars

    const paired = (measure: number, beat: number) => {
      const slot = m.getMeasure(measure)!.slots.find(s => fracToNumber(s.beat) === beat)
      return slot?.type === 'chord' && slot.tremoloPair === true
    }
    expect(paired(4, 0)).toBe(true)   // the original — untouched by either paste
    expect(paired(4, 2)).toBe(true)   // the second paste's own
    expect(paired(5, 0)).toBe(true)   // the first paste's, a bar away
  })

  it('⚠️ copying only the FIRST note copies a NOTE, not half a mark', () => {
    const m = new ScoreModel('P')
    const { a } = twoQuarters(m)
    const clip = buildClipboardFromSelection(m.getScore(), [a.id])!
    expect(clip.lanes[0].tremoloPairs).toBeUndefined()
  })

  it('a STALE pair is never what gets copied', () => {
    const m = new ScoreModel('P')
    const { a, b } = twoQuarters(m)
    m.updateNote(b.id, { duration: '8' })   // no longer the same value → no longer a pair
    const clip = buildClipboardFromSelection(m.getScore(), [a.id, b.id])!
    expect(clip.lanes[0].tremoloPairs).toBeUndefined()
  })

  it('MOVES to another voice when BOTH notes go', () => {
    const m = new ScoreModel('P')
    const { a, b } = twoQuarters(m)
    const moving = new Set([a.id, b.id])
    for (const id of [a.id, b.id]) m.moveNoteToVoice(id, 1, moving)
    m.dropStaleTremoloPairs(1)

    const moved = m.getMeasure(1)!.slots.find(s => s.type === 'chord' && (s.voice ?? 0) === 1 && fracToNumber(s.beat) === 0)
    expect(moved?.type === 'chord' && moved.tremoloPair).toBe(true)
  })

  it('is SEVERED when only one of the two moves — either one', () => {
    for (const which of ['first', 'second'] as const) {
      const m = new ScoreModel('P')
      const { a, b } = twoQuarters(m)
      m.moveNoteToVoice(which === 'first' ? a.id : b.id, 1)
      const flagged = m.getMeasure(1)!.slots.filter(s => s.type === 'chord' && s.tremoloPair)
      expect(flagged).toHaveLength(0)
    }
  })
})
