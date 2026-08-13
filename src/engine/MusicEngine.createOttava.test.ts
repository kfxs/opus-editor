import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { soundingShiftAt } from '@/utils/soundingShift'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

/**
 * `MusicEngine.createOttava` — **which notes did the user mean**, the editor half of the split that
 * `ottavaOps.addOttavaOverNotes` owns the other side of (docs/ottava-plan.md P5).
 *
 * ⭐⭐ **The chapter this file exists for is the LANE.** `createSlur`, `createHairpin` and
 * `createTrill` all narrow a selection to the first note's `(staff, voice)` and drop the rest —
 * because each of those marks lives in one voice. An ottava does not: it governs the STAFF, so a
 * selection spanning two voices of one staff must produce ONE line covering both. Narrowing here
 * would silently leave half the selected music sounding where it was, with the bracket drawn over
 * all of it — the picture and the sound disagreeing about notes the user selected on purpose.
 *
 * ⚠️ That rule was NOT caught by any other spec: break-testing P5 found `createOttava` could be
 * "corrected" to the slur's filter with the whole suite still green. This file is the answer.
 *
 * Everything is asserted in SOUND (`soundingShiftAt`) rather than in beats — it is what an octave
 * line is for, and a length that reads correctly can still cover the wrong notes.
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

describe('MusicEngine.createOttava', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
  })

  const ottavas = () => engine.getScore().measures.flatMap(m => m.ottavas ?? [])
  const shiftAt = (measure: number, beat: number) =>
    soundingShiftAt(engine.getScore(), measure, frac(beat, 1))

  /** Four quarters in bar 1, voice 0. */
  const fourNotes = () => (['C', 'D', 'E', 'F'] as const).map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)

  it('covers the selection from its first note through the END of its last', () => {
    const ids = fourNotes()
    const created = engine.createOttava([ids[1], ids[2]], 1)!
    expect(fracToNumber(created.beat)).toBe(1)
    expect(fracToNumber(created.length)).toBe(2)
    expect(shiftAt(1, 0)).toBe(0)
    expect(shiftAt(1, 1)).toBe(12)
    expect(shiftAt(1, 2)).toBe(12)
    expect(shiftAt(1, 3), 'and stops there').toBe(0)
  })

  it('takes the selection in POSITION order, not the order it was clicked in', () => {
    const ids = fourNotes()
    const created = engine.createOttava([ids[3], ids[0]], 1)!
    expect(fracToNumber(created.beat)).toBe(0)
    expect(fracToNumber(created.length)).toBe(4)
  })

  it('⭐⭐ a selection across TWO VOICES of one staff makes ONE line covering both', () => {
    // The rule this file exists for. Narrowing to the first note's voice — which every other span
    // in this codebase does — would leave voice 1 sounding where it was, under a bracket drawn
    // over it.
    const v0 = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1), voice: 0 })!
    const v1 = engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 })!

    const created = engine.createOttava([v0.id, v1.id], 1)
    expect(created, 'the cross-voice selection is accepted').not.toBeNull()
    expect(ottavas(), 'ONE line, not one per voice').toHaveLength(1)
    // It reaches the voice-1 note, which a voice-narrowed span would have stopped short of.
    expect(shiftAt(1, 0)).toBe(12)
    expect(shiftAt(1, 2)).toBe(12)
  })

  it('…and a line placed from voice 1 alone still governs voice 0’s notes under it', () => {
    // The other half of "it governs the staff": membership is POSITIONAL, so the voice the gesture
    // started from cannot narrow what the line affects.
    engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'w', measure: 1, beat: frac(0, 1), voice: 0 })
    const v1 = engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1), voice: 1 })!

    engine.createOttava([v1.id], 1)
    expect(shiftAt(1, 0)).toBe(12)
    expect(ottavas()[0].staffId, 'and it carries no voice at all').toBeUndefined()
    expect('voice' in ottavas()[0]).toBe(false)
  })

  it('⛔ DROPS notes on another staff — an octave line cannot govern two', () => {
    const lower = engine.addStaffBelow(0)
    const top = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })!
    const bottom = engine.addNoteAtBeat({ step: 'C', octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!

    engine.createOttava([top.id, bottom.id], 1)
    expect(ottavas()).toHaveLength(1)
    expect(ottavas()[0].staffId, 'on the FIRST note’s staff').not.toBe(lower)
    expect(soundingShiftAt(engine.getScore(), 1, frac(0, 1), lower), 'the other staff is untouched').toBe(0)
  })

  it('⛔ refuses a selection of only RESTS — there is no sounding music to displace', () => {
    const rest = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), isRest: true })!
    expect(engine.createOttava([rest.id], 1)).toBeNull()
    expect(ottavas()).toHaveLength(0)
  })

  it('refuses an empty selection and unknown ids', () => {
    expect(engine.createOttava([], 1)).toBeNull()
    expect(engine.createOttava(['nope'], 1)).toBeNull()
  })

  it('⭐ does not re-spell the notes — §7.3 is answered as SIBELIUS’s, and this pins it', () => {
    // ⏭️ The open question: (a) leave the noteheads and let the passage sound higher — what this
    // does — or (b) drop every covered note an octave so the SOUND is unchanged (Dorico's). If his
    // hand-testing picks (b), THIS assertion is the one that has to change, and deliberately.
    const ids = fourNotes()
    engine.createOttava(ids, 1)
    for (const id of ids) expect(engine.getNote(id)!.octave).toBe(4)
    expect(shiftAt(1, 0)).toBe(12)
  })

  it('a 15ma is the same gesture with a different number', () => {
    const ids = fourNotes()
    engine.createOttava([ids[0]], 2)
    expect(ottavas()[0].shift).toBe(2)
    expect(shiftAt(1, 0)).toBe(24)
  })
})
