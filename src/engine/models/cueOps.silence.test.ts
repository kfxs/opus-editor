import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { MusicEngine } from '../MusicEngine'
import { buildClipboardFromSelection } from '@/interactions/clipboard/clipboard'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./cueOps` — ⭐ **only a DELETE takes cue off** (his rule, 2026-09-24: *"if a user mark a rest as
 * cue it should carry the cue flag unless the user change it, what only can clean the cue without explicit
 * user intervention is delete"*) — and ⭐ *"for note editing the cue value persist, for note entry what is
 * important is what is armed on the pallette"*: a note ENTERED into cue silence is full size until the
 * palette can arm cue; the rests around it stay cue. The model churns rests on its own — a note typed on part of one, a note
 * grown into one, a rest shortened, a meter change — and each time the silence a cue rest held stays cue
 * (`keepCueSilence`, and the relay carrying a cue rest as content).
 */
describe('cueOps — a cue SILENCE survives the model\'s own rest churn', () => {
  /** Bar 1's rests as `beat:duration(:cue)`, left to right. */
  const rests = (engine: MusicEngine, bar = 1) =>
    engine.getScore().measures[bar - 1].slots
      .filter(s => s.type === 'rest')
      .map(s => `${fracToNumber(s.beat)}:${s.duration}${s.cue ? ':cue' : ''}`)
  const restIdAt = (engine: MusicEngine, beat: number, bar = 1) =>
    engine.getScore().measures[bar - 1].slots.find(s => s.type === 'rest' && fracToNumber(s.beat) === beat)!.id
  const note = (engine: MusicEngine, beat: number, duration: 'q' | 'h' | '8' = 'q') =>
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration, measure: 1, beat: frac(beat, 1) })!

  /** A 4/4 bar: a quarter C, then a cue HALF rest at beat 2 (the quarter rest at beat 1 is full). */
  const withCueHalfRest = () => {
    const engine = makeEngine()
    note(engine, 0)
    engine.updateNote(restIdAt(engine, 1), { duration: 'q' }) // pin the fill: q rest at 1, h rest at 2
    engine.cue.set([restIdAt(engine, 2)], true)
    expect(rests(engine)).toEqual(['1:q', '2:h:cue'])
    return engine
  }

  it('a note typed on PART of it: the refilled remainder is cue', () => {
    const engine = withCueHalfRest()
    note(engine, 2)
    expect(rests(engine)).toEqual(['1:q', '3:q:cue'])
  })

  it('an eighth ENTERED at its start: the silence after it is cue; ⛔ the note follows the palette (full)', () => {
    const engine = withCueHalfRest()
    const n = note(engine, 2, '8')
    expect(engine.getNote(n.id)!.cue).toBeUndefined()
    expect(rests(engine).slice(1).every(r => r.endsWith(':cue'))).toBe(true)
  })

  it('a note GROWN into it: what is left of it is cue', () => {
    const engine = withCueHalfRest()
    const n = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    engine.updateNote((n as { notes: { id: string }[] }).notes[0].id, { duration: 'h', dots: 1 })
    expect(rests(engine)).toEqual(['3:q:cue'])
  })

  it('the cue rest SHORTENED: it and its freed tail are cue', () => {
    const engine = withCueHalfRest()
    engine.updateNote(restIdAt(engine, 2), { duration: 'q' })
    expect(rests(engine)).toEqual(['1:q', '2:q:cue', '3:q:cue'])
  })

  it('a METER change carries it (a cue rest travels as content, ⛔ not regenerated as a gap)', () => {
    const engine = makeEngine()
    note(engine, 0)
    engine.cue.set([restIdAt(engine, 1)], true)
    const before = rests(engine).filter(r => r.endsWith(':cue'))
    expect(before.length).toBeGreaterThan(0)
    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const all = engine.getScore().measures.flatMap(m => m.slots).filter(s => s.type === 'rest')
    expect(all.some(s => s.cue)).toBe(true)
    // …and ONLY where the cue rest stood: the new silence the meter change made is full size.
    expect(all.filter(s => s.cue).every(s => s.measure === 1)).toBe(true)
  })

  it('a cue MEASURE rest through a meter change is still cue silence', () => {
    const engine = makeEngine()
    const measureRest = engine.getScore().measures[0].slots[0]
    engine.cue.set([measureRest.id], true)
    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const bar1 = engine.getScore().measures[0].slots
    expect(bar1.length).toBeGreaterThan(0)
    expect(bar1.every(s => s.type === 'rest' && s.cue)).toBe(true)
  })

  it('⛔ a note ENTERED over the whole cue rest follows the palette — nothing arms cue yet, so full', () => {
    const engine = withCueHalfRest()
    const n = note(engine, 2, 'h')
    expect(engine.getNote(n.id)!.cue).toBeUndefined()
  })

  it('PASTE into cue silence: the rests left there stay cue; the pasted note keeps the clip\'s own size', () => {
    const engine = makeEngine()
    engine.addMeasure()
    const a = note(engine, 0)
    const clip = buildClipboardFromSelection(engine.getScore(), [a.id])!
    engine.cue.set([engine.getScore().measures[1].slots[0].id], true)
    engine.pasteEvents(clip, { measure: 2, beat: frac(1, 1), voice: 0 })
    expect(rests(engine, 2)).toEqual(['0:q:cue', '2:h:cue'])
    const pasted = engine.getScore().measures[1].slots.find(s => s.type === 'chord')!
    expect(pasted.cue).toBeUndefined()
  })

  it('a TUPLET entered into cue silence: its rests and the bar\'s stay cue; its first note is entry (full)', () => {
    const engine = makeEngine()
    engine.cue.set([engine.getScore().measures[0].slots[0].id], true)
    engine.createTupletAtBeat(1, 1, '8', { step: 'C', alter: 0, octave: 5 }, 3, 2)
    const slots = engine.getScore().measures[0].slots
    expect(slots.filter(s => s.type === 'rest').every(s => s.cue)).toBe(true)
    expect(slots.find(s => s.type === 'chord')!.cue).toBeUndefined()
  })

  it('⭐ a cue rest turned into a note IN PLACE (a pitch typed over the selected rest) is an EDIT: cue persists', () => {
    const engine = withCueHalfRest()
    const id = restIdAt(engine, 2)
    engine.updateNote(id, { isRest: false, step: 'E', alter: 0, octave: 5 })
    expect(engine.getNote(id)!.isRest).toBeFalsy()
    expect(engine.getNote(id)!.cue).toBe(true)
  })

  it('⛔ a note OUTSIDE the cue silence stays full, and a note grown into it keeps its own size', () => {
    const engine = withCueHalfRest()
    const n = note(engine, 1)
    expect(engine.getNote(n.id)!.cue).toBeUndefined()
    engine.updateNote(n.id, { duration: 'h' })
    expect(engine.getNote(n.id)!.cue).toBeUndefined()
  })

  it('⛔ a DELETE clears it — the refill after Delete is full size', () => {
    const engine = withCueHalfRest()
    engine.deleteNotes([restIdAt(engine, 2)])
    expect(rests(engine).some(r => r.endsWith(':cue'))).toBe(false)
  })
})
