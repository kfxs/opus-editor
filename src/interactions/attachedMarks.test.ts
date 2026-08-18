import { describe, it, expect, beforeEach } from 'vitest'
import { attachedMarksOf } from './attachedMarks'
import type { MarkQueryEngine } from './attachedMarks'
import { fracCreate as frac } from '../utils/fraction'
import type { Score } from '../types/music'

/**
 * What hangs off the selected note, as things that can be SELECTED.
 *
 * Subject: {@link attachedMarks}, sitting beside this file. No renderer and no DOM: the query reads
 * the MODEL, which is the whole point — it is the route to a mark whose ink is off screen, so it must
 * not depend on anything drawn.
 *
 * ⭐ His report, 2026-08-18: a slur endpoint dragged far enough takes every repair affordance off
 * screen with it, and clicking away then strands you, because they all live ON the ink.
 */
const NOTE = { id: 'N2', measure: 3, beat: frac(1, 1), voice: 0, staff: 0 }

/** A score with one of everything in bar 3, and a two-note slur across N2 → N3. */
function scoreWith(overrides: Partial<Score['measures'][0]> = {}): Score {
  return {
    id: 'S', title: 't',
    measures: [{
      id: 'm3', number: 3, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
      ...overrides,
    }],
    slurs: [{ id: 'SL1', startNoteId: 'N2', endNoteId: 'N3', voice: 0 }],
    trills: [{ id: 'TR1', startNoteId: 'N2', voice: 0 }],
  } as unknown as Score
}

let engine: MarkQueryEngine
const stand = (score: Score, note: unknown = NOTE): MarkQueryEngine => ({
  getNote: () => note,
  getScore: () => score,
} as unknown as MarkQueryEngine)

beforeEach(() => { engine = stand(scoreWith()) })

describe('attachedMarksOf', () => {
  it('⭐ offers a note-anchored slur by the END that touches this note', () => {
    // Which end is armed is the whole point of arriving this way: the arrows and Ctrl+Backspace act on
    // the armed one, so the row has to produce the same selection a click on that square would.
    expect(attachedMarksOf(engine, 'N2').filter(m => m.label.startsWith('Slur')))
      .toEqual([{ label: 'Slur (start)', element: { kind: 'slur', id: 'SL1', endpoint: 'start' } }])
    expect(attachedMarksOf(stand(scoreWith(), { ...NOTE, id: 'N3' }), 'N3').filter(m => m.label.startsWith('Slur')))
      .toEqual([{ label: 'Slur (end)', element: { kind: 'slur', id: 'SL1', endpoint: 'end' } }])
  })

  it('offers BOTH ends when one note is both — a slur that begins and ends on it', () => {
    const score = scoreWith()
    score.slurs = [{ id: 'SL1', startNoteId: 'N2', endNoteId: 'N2', voice: 0 }] as Score['slurs']
    expect(attachedMarksOf(stand(score), 'N2').filter(m => m.label.startsWith('Slur')).map(m => m.label))
      .toEqual(['Slur (start)', 'Slur (end)'])
  })

  it('offers a trill anchored to it, and no trill anchored elsewhere', () => {
    expect(attachedMarksOf(engine, 'N2').some(m => m.label === 'Trill')).toBe(true)
    const score = scoreWith()
    score.trills = [{ id: 'TR1', startNoteId: 'N9', voice: 0 }] as Score['trills']
    expect(attachedMarksOf(stand(score), 'N2').some(m => m.label === 'Trill')).toBe(false)
  })

  it('⚠️ offers a SPAN that starts at or before this note in its bar', () => {
    // The documented limit: a span running past the barline is reachable from the bar it STARTS in.
    const score = scoreWith({
      hairpins: [{ id: 'H1', type: 'cresc', beat: frac(0, 1), length: frac(3, 1), voice: 0 }],
      pedals: [{ id: 'P1', beat: frac(0, 1), length: frac(5, 1) }],
      ottavas: [{ id: 'O1', beat: frac(0, 1), length: frac(6, 1), shift: 1 }],
    } as unknown as Partial<Score['measures'][0]>)
    expect(attachedMarksOf(stand(score), 'N2').map(m => m.label)).toEqual([
      'Slur (start)', 'Trill', 'Hairpin (cresc)', 'Octave line', 'Pedal',
    ])
  })

  it('…and NOT a span that starts after it', () => {
    const score = scoreWith({
      pedals: [{ id: 'P1', beat: frac(3, 1), length: frac(1, 1) }],
    } as unknown as Partial<Score['measures'][0]>)
    expect(attachedMarksOf(stand(score), 'N2').some(m => m.label === 'Pedal')).toBe(false)
  })

  it('offers a POINT mark only on its own beat, and names its text', () => {
    // Several dynamics in a bar are otherwise indistinguishable in a menu.
    const onBeat = scoreWith({
      dynamics: [{ id: 'D1', beat: frac(1, 1), text: 'mf', voice: 0, placement: 'below' }],
      tempos: [{ id: 'T1', beat: frac(1, 1), text: 'Allegro' }],
    } as unknown as Partial<Score['measures'][0]>)
    expect(attachedMarksOf(stand(onBeat), 'N2').map(m => m.label))
      .toEqual(['Slur (start)', 'Trill', 'Dynamic (mf)', 'Tempo (Allegro)'])

    const elsewhere = scoreWith({
      dynamics: [{ id: 'D1', beat: frac(0, 1), text: 'mf', voice: 0, placement: 'below' }],
    } as unknown as Partial<Score['measures'][0]>)
    expect(attachedMarksOf(stand(elsewhere), 'N2').some(m => m.label.startsWith('Dynamic'))).toBe(false)
  })

  it('⚠️ never offers another VOICE’s mark', () => {
    const score = scoreWith({
      hairpins: [{ id: 'H1', type: 'cresc', beat: frac(0, 1), length: frac(3, 1), voice: 1 }],
    } as unknown as Partial<Score['measures'][0]>)
    expect(attachedMarksOf(stand(score), 'N2').some(m => m.label.startsWith('Hairpin'))).toBe(false)
  })

  it('answers with nothing for a missing note, and nothing for a bar it cannot find', () => {
    expect(attachedMarksOf(stand(scoreWith(), null), 'N2')).toEqual([])
    const note = { ...NOTE, measure: 99 }
    // The note-anchored kinds still answer — they never needed the bar.
    expect(attachedMarksOf(stand(scoreWith(), note), 'N2').map(m => m.label))
      .toEqual(['Slur (start)', 'Trill'])
  })
})
