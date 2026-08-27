import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fifthsOf } from '@/utils/keySignature'
import { keyFromFifths } from '@/utils/keySignature'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * `MusicEngine.setKeyAt` / `removeKeyAt` — the EDITOR half of the key writes: staff INDEX rather
 * than staff id, and **undo**.
 *
 * ⚠️ The undo assertions are the reason this file exists at all. A mutator that skips its undo
 * snapshot costs two things at once and neither of them throws: the edit cannot be taken back, and
 * the score never repaints, because the same call is what tells the app the model moved. `keyOps`'
 * own spec proves the write; only this one proves it was COMMITTED.
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

describe('MusicEngine key signatures', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addMeasure()
  })

  it('sets a key and reads it back through the walk', () => {
    expect(engine.setKeyAt(2, keyFromFifths(1))).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(1)
    expect(fifthsOf(engine.getKeyAt(3)), 'carried forward').toBe(1)
    expect(fifthsOf(engine.getKeyAt(1))).toBe(0)
  })

  it('⭐ UNDO takes the key change back, and redo puts it there again', () => {
    engine.setKeyAt(2, keyFromFifths(-3))
    expect(fifthsOf(engine.getKeyAt(2))).toBe(-3)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'gone').toBe(0)
    expect(engine.getScore().measures[1].keys).toBeUndefined()

    expect(engine.redo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'back').toBe(-3)
  })

  it('⭐ undo reaches a REMOVAL too', () => {
    engine.setKeyAt(2, keyFromFifths(2))
    expect(engine.removeKeyAt(2)).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(0)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(2)
  })

  it('⛔ a write that changes nothing commits nothing — there is no empty entry to undo past', () => {
    engine.setKeyAt(2, keyFromFifths(1))
    expect(engine.setKeyAt(3, keyFromFifths(1)), 'already in force at bar 3').toBe(false)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'one undo is enough to clear the one real edit').toBe(0)
  })

  it('addresses a staff by INDEX, which is the editor\'s unit', () => {
    engine.addStaffBelow(0)
    expect(engine.setKeyAt(2, keyFromFifths(4), 0)).toBe(true)
    expect(engine.setKeyAt(2, keyFromFifths(-4), 1)).toBe(true)

    expect(fifthsOf(engine.getKeyAt(2, 0))).toBe(4)
    expect(fifthsOf(engine.getKeyAt(2, 1))).toBe(-4)
  })

  /**
   * ⭐⭐ **THE COURTESY ACCIDENTAL A KEY WOULD HIDE** — Gould p. 81 from the user's side.
   *
   * His report, 2026-08-27, on a score in D major: *"suppose the F♯ I want to make it explicit, so I
   * added ♯ to the F that is already ♯ — what I expect is to see the accidental written"*. The rule
   * in `accidentalState` was already right (`forceAccidental` beats the suppression); what refused
   * him was `noteDisplaysAccidental`, one layer above it, which matched on `alter` alone and so
   * answered "already there" about a sign that was not on the page.
   */
  describe('an explicit sign the key already implies', () => {
    const D_MAJOR = keyFromFifths(2) // F♯ C♯

    /** An F♯ at bar 1 beat 0, under `fifths`. */
    const fSharpIn = (fifths: number): { engine: MusicEngine; id: string } => {
      const e = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
      e.setKeyAt(1, keyFromFifths(fifths))
      const note = e.addNoteAtBeat({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
      return { engine: e, id: note.id }
    }

    it('🚨 an F♯ in D major does NOT display its sharp — the signature says it', () => {
      const { engine: e, id } = fSharpIn(2)
      expect(e.noteDisplaysAccidental(id, '#')).toBe(false)
    })

    it('…so stamping ♯ on it is NOT a no-op: it forces the sign', () => {
      const { engine: e, id } = fSharpIn(2)
      expect(e.noteDisplaysAccidental(id, '#'), 'the stamp is allowed through').toBe(false)
      e.setNoteAccidental(id, '#')
      expect(e.getNote(id)!.forceAccidental, 'and THAT is what makes it visible').toBe(true)
      expect(e.getNote(id)!.alter, 'the pitch is untouched').toBe(1)
      expect(e.noteDisplaysAccidental(id, '#'), 'it now displays, so the next press toggles it off').toBe(true)
    })

    it('in C major the same F♯ displays its sharp already, and the stamp stays idempotent', () => {
      const { engine: e, id } = fSharpIn(0)
      expect(e.noteDisplaysAccidental(id, '#')).toBe(true)
    })

    it('⛔ and the alteration still has to MATCH — an F♮ in D major displays no sharp', () => {
      const e = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
      e.setKeyAt(1, D_MAJOR)
      const note = e.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
      expect(e.noteDisplaysAccidental(note.id, '#')).toBe(false)
      expect(e.noteDisplaysAccidental(note.id, 'n'), 'it draws a NATURAL, contradicting the key').toBe(true)
    })

    it('⭐ "remove accidental" reverts to what the KEY says, not to a bare natural', () => {
      const { engine: e, id } = fSharpIn(2)
      expect(e.getPrevailingAlter(id)).toBe(1)
    })
  })
})
