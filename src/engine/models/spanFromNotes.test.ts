/**
 * WHICH NOTES DID THE USER MEAN — {@link spanFromNotes}, the head every span mark's creation shares.
 * The source is fabricated: what is asked is the LANE and the ORDER, not anything a score computes.
 */
import { describe, it, expect } from 'vitest'
import type { Note } from '@/types/music'
import { spanFromNotes, type SpanNoteSource } from './spanFromNotes'

const note = (id: string, measure: number, beat: number, over: Partial<Note> = {}): Note =>
  ({ id, measure, beat: { num: beat, den: 1 }, duration: 'q', ...over }) as Note

function source(notes: Note[], members: Record<string, number> = {}): SpanNoteSource {
  return {
    getNote: id => notes.find(n => n.id === id),
    fanMemberIndexOf: id => members[id] ?? null,
  }
}

const VOICE = { byVoice: true, sounding: true }
const STAFF = { byVoice: false, sounding: true }

describe('spanFromNotes', () => {
  it('orders the selection as the music reads, whatever order it was clicked in', () => {
    const src = source([note('a', 1, 0), note('b', 1, 2), note('c', 2, 0)])
    const span = spanFromNotes(src, ['c', 'a', 'b'], VOICE)!
    expect(span.notes.map(n => n.id)).toEqual(['a', 'b', 'c'])
    expect([span.start.id, span.end.id]).toEqual(['a', 'c'])
  })

  it('⭐ the lane is the FIRST resolved note’s — a voice-2 selection makes a voice-2 span', () => {
    const src = source([note('v2', 1, 1, { voice: 1 }), note('v1', 1, 0), note('v2b', 1, 3, { voice: 1 })])
    const span = spanFromNotes(src, ['v2', 'v1', 'v2b'], VOICE)!
    expect(span.voice).toBe(1)
    expect(span.notes.map(n => n.id)).toEqual(['v2', 'v2b'])
  })

  it('⭐⭐ a mark that governs the STAFF keeps both voices — and still drops other staves', () => {
    const src = source([note('v1', 1, 0), note('v2', 1, 1, { voice: 1 }), note('below', 1, 2, { staff: 1 })])
    const span = spanFromNotes(src, ['v1', 'v2', 'below'], STAFF)!
    expect(span.notes.map(n => n.id)).toEqual(['v1', 'v2'])
    expect(span.staff).toBe(0)
  })

  it('⛔ `sounding` refuses a rest as a candidate; a slur’s lane keeps it', () => {
    const src = source([note('r', 1, 0, { isRest: true }), note('n', 1, 1)])
    expect(spanFromNotes(src, ['r', 'n'], VOICE)!.notes.map(n => n.id)).toEqual(['n'])
    expect(spanFromNotes(src, ['r', 'n'], { byVoice: true, sounding: false })!.notes.map(n => n.id))
      .toEqual(['r', 'n'])
  })

  it('one note is a span of itself — start and end are the same note', () => {
    const span = spanFromNotes(source([note('a', 1, 0)]), ['a'], VOICE)!
    expect(span.start).toBe(span.end)
  })

  it('null when nothing resolves — stale ids, or only rests under `sounding`', () => {
    expect(spanFromNotes(source([]), ['gone'], VOICE)).toBeNull()
    expect(spanFromNotes(source([note('r', 1, 0, { isRest: true })]), ['r'], VOICE)).toBeNull()
  })

  it('⭐ fanned MEMBERS share a beat, so they are ordered by member index — never click order', () => {
    const src = source([note('m2', 1, 0), note('m0', 1, 0), note('m1', 1, 0)], { m0: 0, m1: 1, m2: 2 })
    expect(spanFromNotes(src, ['m2', 'm0', 'm1'], VOICE)!.notes.map(n => n.id)).toEqual(['m0', 'm1', 'm2'])
  })
})
