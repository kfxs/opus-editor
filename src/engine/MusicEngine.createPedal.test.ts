import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { collectScheduledNotes } from './audio/playbackSchedule'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

/**
 * `MusicEngine.createPedal` — **which notes did the user mean**, the editor half of the split that
 * `pedalOps.addPedalOverNotes` owns the other side of (docs/pedal-plan.md §7).
 *
 * ⭐⭐ **The chapter this file exists for is the LANE**, `MusicEngine.createOttava.test.ts`'s reason
 * with a physical rather than a notational argument behind it. `createSlur`, `createHairpin` and
 * `createTrill` all narrow a selection to the first note's `(staff, voice)` and drop the rest,
 * because each of those marks lives in one voice. A pedal does not: there is ONE FOOT, so a
 * selection spanning two voices of a staff must produce one pedal holding both. Narrowing here would
 * leave half the selected music dying under a damper the picture says is down.
 *
 * ⚠️ Break-tested the same way: `createPedal` can be "corrected" to the slur's filter and every other
 * spec stays green. This file is the answer.
 *
 * Assertions are in SOUND (what the scheduled events actually do) wherever the point is audible —
 * a length that reads correctly can still hold the wrong notes.
 */
vi.mock('./rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('MusicEngine.createPedal', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
  })

  const quarters = (measure: number, staff?: number, voice?: 0 | 1) =>
    [0, 1, 2, 3].map(b => engine.addNoteAtBeat({
      step: 'C', octave: 4, duration: 'q', measure, beat: frac(b, 1),
      ...(staff !== undefined ? { staff } : {}), ...(voice !== undefined ? { voice } : {}),
    })!.id)

  const pedals = () => engine.getScore().measures.flatMap(m => m.pedals ?? [])
  const asText = () => pedals().map(p => `${fracToNumber(p.beat)}+${fracToNumber(p.length)}`)
  const ringsFor = (onset: number) =>
    collectScheduledNotes(engine.getScore()).find(e => Math.abs(e.startBeats - onset) < 1e-9)!.durationBeats

  it('holds from the first selected note through the END of the last', () => {
    const ids = quarters(1)
    expect(engine.createPedal([ids[0], ids[1], ids[2]])).not.toBeNull()
    expect(asText(), 'through the end of the third note, not to its onset').toEqual(['0+3'])
  })

  it('⭐ one note gives a pedal holding exactly that note', () => {
    const ids = quarters(1)
    engine.createPedal([ids[2]])
    expect(asText()).toEqual(['2+1'])
  })

  it('⭐ the span COVERS the last note — the half-open window would otherwise release it', () => {
    // Asserted in sound, because this is the one that would be silently wrong: an end on the last
    // note's onset draws the same picture and lets that note go.
    const ids = quarters(1)
    for (const id of ids) engine.updateNote(id, { articulations: ['staccato'] })
    engine.createPedal([ids[0], ids[1]])
    expect(ringsFor(1), 'the LAST selected note is held, not released').toBeCloseTo(1, 10)
  })

  it('⭐⭐ keeps BOTH VOICES of a staff — one foot, ⛔ not the slur\'s (staff, voice) narrowing', () => {
    const upper = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1), voice: 0 })!
    const lower = engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 })!
    engine.createPedal([upper.id, lower.id])
    // One pedal, from voice 0's note through the end of voice 1's — narrowing to voice 0 would have
    // stopped at beat 2.
    expect(asText()).toEqual(['0+4'])
  })

  it('drops notes on OTHER staves — one damper cannot belong to two instruments', () => {
    engine.addStaffBelow(0)
    const upper = quarters(1, 0)
    const lower = engine.addNoteAtBeat({ step: 'C', octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 })!
    engine.createPedal([upper[0], lower.id])
    expect(pedals()).toHaveLength(1)
    // ⚠️ The pedal lands on the FIRST note's staff — stored as an ABSENT id, because that is how the
    // first staff is written everywhere in this model (`utils/lanes`), not because nothing was set.
    expect(pedals()[0].staffId).toBeUndefined()
    // …and the lower staff's WHOLE note was dropped rather than extending the span: keeping it would
    // have run the pedal to beat 4 instead of 1.
    expect(asText()).toEqual(['0+1'])
  })

  it('spans a barline when the selection does', () => {
    const first = quarters(1)
    const second = quarters(2)
    engine.createPedal([first[2], second[1]])
    expect(asText()).toEqual(['2+4']) // beat 2 of bar 1 → through the end of bar 2's beat 1
  })

  it('⛔ refuses a selection of nothing, and a selection of only RESTS', () => {
    const rest = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), isRest: true })!
    expect(engine.createPedal([])).toBeNull()
    expect(engine.createPedal(['no-such-note'])).toBeNull()
    expect(engine.createPedal([rest.id])).toBeNull()
    expect(pedals()).toHaveLength(0)
  })

  it('⭐⭐ LIFTS a pedal that was still down — the entry door\'s truncation, through this call', () => {
    const ids = quarters(1)
    engine.createPedal([ids[0], ids[3]])   // 0 → 4
    engine.createPedal([ids[2]])            // press again at 2
    expect(asText()).toEqual(['0+2', '2+1'])
  })

  it('is ONE undo entry, and undo removes the pedal', () => {
    const ids = quarters(1)
    engine.createPedal([ids[0], ids[1]])
    expect(pedals()).toHaveLength(1)
    engine.undo()
    expect(pedals()).toHaveLength(0)
  })
})
