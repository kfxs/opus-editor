import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import * as graceOps from '../../engine/models/graceOps'
import { buildClipboardFromSelection } from '../clipboard/clipboard'
import { fracCreate as frac } from '../../utils/fraction'
import { gracePitchesOf } from '../../utils/graceNotes'
import type { Chord, GraceGroup } from '../../types/music'
import { makeEngine } from '@/testing/makeEngine'

/**
 * GRACES TRAVEL WITH THEIR NOTE (docs/plans/grace-notes-plan.md §1.1, P0) — the fan's rule, and
 * `tremoloTravel.test.ts`'s shape: one test per list a slot field has to be named in, because a field
 * a list does not name is dropped in silence.
 *
 *   - the rebar relay (slot → `RebarEvent` → `RebarPiece` → `Chord`), ridden by a meter change AND a
 *     paste — with the split rule: a grace BEFORE on the FIRST piece, a grace AFTER on the LAST;
 *   - `moveNoteToVoice`'s payload — the graces go only with the chord's LAST head;
 *   - `placeSpanningNote`, which rebuilds a lengthened note's continuations from the pitch alone.
 */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

const D5 = { step: 'D' as const, alter: 0 as const, octave: 5 }
const B4 = { step: 'B' as const, alter: 0 as const, octave: 4 }

/** The chord at (measure, beat) in `voice` — a re-laid slot has a fresh id, so it is found by place. */
function chordAt(engine: MusicEngine, m: number, beat: number, voice = 0): Chord | undefined {
  const measure = engine.getScore().measures.find(mm => mm.number === m)
  const slot = measure?.slots.find(s =>
    s.type === 'chord' && s.beat.num === beat && s.beat.den === 1 && (s.voice ?? 0) === voice)
  return slot?.type === 'chord' ? slot : undefined
}

/** A group as MUSIC — the ids stripped, since a copy must mint fresh ones. */
const shape = (g: GraceGroup | undefined) =>
  g && { ...g, notes: g.notes.map(n => ({ ...n, pitches: n.pitches.map(({ id: _id, ...p }) => p) })) }

/** A note with a slashed grace D5 before it and a Nachschlag B4 after it. */
function graced(engine: MusicEngine, noteId: string) {
  graceOps.addGrace(engine.getScore(), noteId, 'before', D5, 'acciaccatura', { duration: '8' })
  graceOps.addGrace(engine.getScore(), noteId, 'after', B4, 'appoggiatura', { duration: '16' })
}
const BEFORE = { notes: [{ pitches: [D5], duration: '8' }], slash: true }
const AFTER = { notes: [{ pitches: [B4], duration: '16' }] }

describe('graces — survive a rebar', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follow the note when a meter change re-tiles the bars', () => {
    const notes = [0, 1, 2, 3].map(b =>
      engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })!)
    graced(engine, notes[2].id) // at absolute beat 2
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    // 4/4 → 2/4: the note now opens bar 2.
    expect(shape(chordAt(engine, 2, 0)?.graceBefore)).toEqual(BEFORE)
    expect(shape(chordAt(engine, 2, 0)?.graceAfter)).toEqual(AFTER)
    expect(chordAt(engine, 1, 0)?.graceBefore).toBeUndefined() // and nothing smears onto a neighbour
  })

  it('⭐ a tie-split puts the grace BEFORE on the FIRST piece and the grace AFTER on the LAST', () => {
    const head = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!
    graced(engine, head.id)
    engine.setTimeSignature(1, { numerator: 1, denominator: 4 }) // the half note is cut at beat 1
    const first = chordAt(engine, 1, 0)!
    const last = chordAt(engine, 2, 0)!
    expect(first.notes[0].tiedTo).toBe(last.notes[0].id)
    expect(shape(first.graceBefore)).toEqual(BEFORE)
    expect(first.graceAfter).toBeUndefined()
    expect(last.graceBefore).toBeUndefined()
    expect(shape(last.graceAfter)).toEqual(AFTER)
  })
})

describe('graces — copy/paste', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('travel with a pasted note, with FRESH ids — and the ids come back as what landed', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!
    graced(engine, note.id)
    const sourceIds = gracePitchesOf(chordAt(engine, 1, 1)!).map(p => p.id)
    const clip = buildClipboardFromSelection(engine.getScore(), [note.id])!
    engine.addMeasure()
    const landed = engine.pasteEvents(clip, { measure: 2, beat: frac(1, 1), voice: 0 })

    const pasted = chordAt(engine, 2, 1)!
    expect(shape(pasted.graceBefore)).toEqual(BEFORE)
    expect(shape(pasted.graceAfter)).toEqual(AFTER)
    const pastedIds = gracePitchesOf(pasted).map(p => p.id)
    expect(pastedIds.some(id => sourceIds.includes(id))).toBe(false)
    // The paste's return IS the selection you are left holding, and a grace is a head you can click.
    for (const id of pastedIds) expect(landed).toContain(id)
  })

  it('pasting the SAME clip twice mints two sets of ids — the clip is re-pasteable', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    graced(engine, note.id)
    const clip = buildClipboardFromSelection(engine.getScore(), [note.id])!
    engine.addMeasure()
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
    engine.pasteEvents(clip, { measure: 3, beat: frac(0, 1), voice: 0 })
    const first = gracePitchesOf(chordAt(engine, 2, 0)!).map(p => p.id)
    const second = gracePitchesOf(chordAt(engine, 3, 0)!).map(p => p.id)
    expect(second).toHaveLength(2)
    expect(second.some(id => first.includes(id))).toBe(false)
  })

  it('⭐ a pasted TIE CHAIN keeps its grace before on the head and its grace after on the tail', () => {
    const head = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!
    const tail = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!
    engine.updateNote(head.id, { tiedTo: tail.id })
    engine.updateNote(tail.id, { tiedFrom: head.id })
    graceOps.addGrace(engine.getScore(), head.id, 'before', D5, 'acciaccatura', { duration: '8' })
    graceOps.addGrace(engine.getScore(), tail.id, 'after', B4, 'appoggiatura', { duration: '16' })
    // The flatten COLLAPSES the chain into one event; the relay re-splits it on the far side.
    const clip = buildClipboardFromSelection(engine.getScore(), [head.id, tail.id])!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(2, 1), voice: 0 })
    expect(shape(chordAt(engine, 2, 2)?.graceBefore)).toEqual(BEFORE)
    expect(chordAt(engine, 2, 2)?.graceAfter).toBeUndefined()
    expect(shape(chordAt(engine, 2, 3)?.graceAfter)).toEqual(AFTER)
  })

  it('a pasted TUPLET does not share its graces\' ids with its source', () => {
    expect(engine.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 4 }, 3, 2)).toBeTruthy()
    const member = chordAt(engine, 1, 0)!
    expect(member.tupletId).toBeDefined()
    graceOps.addGrace(engine.getScore(), member.notes[0].id, 'before', D5, 'appoggiatura', { duration: '8' })
    const sourceIds = gracePitchesOf(member).map(p => p.id)
    const clip = buildClipboardFromSelection(engine.getScore(), [member.notes[0].id])!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
    const pasted = chordAt(engine, 2, 0)
    expect(pasted?.graceBefore).toBeDefined()
    expect(gracePitchesOf(pasted!).some(p => sourceIds.includes(p.id))).toBe(false)
  })
})

describe('graces — the voice move (Alt+1/2)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('go with the note into the new voice, KEEPING their ids — the slot moved, it was not copied', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    graced(engine, note.id)
    const ids = gracePitchesOf(chordAt(engine, 1, 0)!).map(p => p.id)
    engine.moveNoteToVoice(note.id, 1)
    const moved = chordAt(engine, 1, 0, 1)!
    expect(gracePitchesOf(moved).map(p => p.id)).toEqual(ids)
    expect(chordAt(engine, 1, 0, 0)).toBeUndefined()
  })

  it('⭐ one head leaving a CHORD leaves the graces on the chord they were played into', () => {
    const low = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const high = engine.addChordNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    graced(engine, low.id)
    engine.moveNoteToVoice(high.id, 1)
    expect(shape(chordAt(engine, 1, 0, 0)?.graceBefore)).toEqual(BEFORE)
    expect(chordAt(engine, 1, 0, 1)?.graceBefore).toBeUndefined()
  })

  it('does NOT clobber a group the destination chord already carries', () => {
    const v0 = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const v1 = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!
    graced(engine, v0.id)
    graceOps.addGrace(engine.getScore(), v1.id, 'before', B4, 'appoggiatura', { duration: '16' })
    engine.moveNoteToVoice(v0.id, 1) // merges into the voice-1 chord
    expect(shape(chordAt(engine, 1, 0, 1)?.graceBefore)).toEqual({ notes: [{ pitches: [B4], duration: '16' }] })
    expect(shape(chordAt(engine, 1, 0, 1)?.graceAfter)).toEqual(AFTER) // …and takes the side it lacked
  })
})

describe('graces — the tie-split a duration change makes', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('⭐ lengthening across the barline: the grace before stays on the head, the grace after moves to the new END', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!
    graced(engine, note.id)
    engine.updateNote(note.id, { duration: 'h' }) // overflows 4/4 by a beat → head + tied continuation
    const head = chordAt(engine, 1, 3)!
    const tail = chordAt(engine, 2, 0)!
    expect(head.notes[0].tiedTo).toBe(tail.notes[0].id)
    expect(shape(head.graceBefore)).toEqual(BEFORE)
    expect(head.graceAfter).toBeUndefined()
    expect(shape(tail.graceAfter)).toEqual(AFTER)
  })

  it('…and again when an already-split note is re-split: the old tail\'s group is not eroded with it', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!
    graced(engine, note.id)
    engine.updateNote(note.id, { duration: 'h' })
    engine.updateNote(note.id, { duration: 'h', dots: 1 }) // the continuation is rebuilt, one beat longer
    const tails = engine.getScore().measures[1].slots.filter((s): s is Chord => s.type === 'chord')
    const tail = tails[tails.length - 1]
    expect(shape(tail.graceAfter)).toEqual(AFTER)
    const all = engine.getScore().measures.flatMap(m => m.slots).filter((s): s is Chord => s.type === 'chord')
    expect(all.filter(c => c.graceAfter)).toHaveLength(1)
  })
})

describe('graces — delete and undo through the facade', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('isGraceNote answers for a grace pitch and nothing else', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const grace = graceOps.addGrace(engine.getScore(), note.id, 'before', D5, 'acciaccatura', { duration: '8' })!
    expect(engine.isGraceNote(grace.pitches[0].id)).toBe(true)
    expect(engine.isGraceNote(note.id)).toBe(false)
  })

  it('⭐ deleting a grace is ONE undo entry, and undo brings it back exactly', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    graced(engine, note.id)
    // `graceOps` has no facade command yet (P1), so an ordinary edit is what snapshots the graced
    // score as an undo step — the step the delete must be undone back to.
    engine.updateNote(note.id, { articulations: ['accent'] })
    const before = JSON.stringify(chordAt(engine, 1, 0))
    const graceId = chordAt(engine, 1, 0)!.graceBefore!.notes[0].pitches[0].id

    expect(engine.deleteNote(graceId)).toBe(true)
    expect(chordAt(engine, 1, 0)!.graceBefore).toBeUndefined()
    expect(chordAt(engine, 1, 0)!.notes[0].id).toBe(note.id) // the main note stays
    engine.undo()
    expect(JSON.stringify(chordAt(engine, 1, 0))).toBe(before)
  })

  it('loadJSON REPORTS a grace it cannot hold, and loads the file as written', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    chordAt(engine, 1, 0)!.graceBefore = { notes: [] }
    const json = engine.exportJSON()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(engine, 'renderScore').mockImplementation(() => {}) // the stubbed renderer draws nothing
    engine.loadJSON(json)
    expect(warn.mock.calls.some(c => String(c[0]).includes('grace group with no notes'))).toBe(true)
    warn.mockRestore()
    expect(engine.getNote(note.id)).toBeDefined()
    expect(chordAt(engine, 1, 0)!.graceBefore).toEqual({ notes: [] }) // reported, not repaired
  })
})
