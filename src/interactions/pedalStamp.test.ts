import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import { createEditorState, type EditorState } from './EditorState'
import { stampPedalAtClick } from './pedalStamp'
import { collectScheduledNotes } from '../engine/audio/playbackSchedule'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * The pedal stamp's click: a press on a note puts a sustain pedal under that note.
 *
 * Subject: {@link pedalStamp}, sitting beside this file. The `MusicEngine` is real — the refusals and
 * the truncation rule are its answers — but the HIT-TEST is stubbed: which note a pixel lands on
 * needs a rendered score, which jsdom cannot lay out (docs/ARCHITECTURE.md §"The browser suite").
 *
 * ⭐ **Two chapters matter here that the ottava stamp beside it has no equivalent of:**
 *  - one click's pedal holds exactly the note clicked, and the assertion is made in SOUND (the
 *    scheduled event's length) rather than in beats, because ringing is what a pedal is FOR;
 *  - a second press over a pedal already down LIFTS the first rather than stacking on it — the
 *    pianist's re-take, and the entry door's truncation rule surfacing as a gesture.
 */
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
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
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('stampPedalAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let ids: string[]

  /** A registry whose hit-test answers "the click landed on `id`" — or on nothing, for `null`. */
  const hits = (id: string | null): ElementRegistry => ({
    findClosestNoteOrRest: () => (id ? { id } : null),
    hitsNoteOrRestBody: () => id !== null,
  } as unknown as ElementRegistry)

  const pedals = () => engine.getScore().measures.flatMap(m => m.pedals ?? [])

  /** How long the note attacked at `onset` actually SOUNDS — the pedal's whole effect. */
  const ringsFor = (onset: number) =>
    collectScheduledNotes(engine.getScore()).find(e => Math.abs(e.startBeats - onset) < 1e-9)!.durationBeats

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    state = createEditorState()
    state.selectedMarkingTool = { kind: 'pedal' }
    render = vi.fn()
  })

  it('stands down entirely when the tool is not armed', () => {
    state.selectedMarkingTool = null
    expect(stampPedalAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(false)
    expect(pedals()).toHaveLength(0)
  })

  it('puts a pedal under the note clicked, and repaints', () => {
    expect(stampPedalAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(true)
    expect(pedals()).toHaveLength(1)
    expect(fracToNumber(pedals()[0].beat)).toBe(1)
    expect(fracToNumber(pedals()[0].length), 'the clicked note\'s own length').toBe(1)
    expect(render).toHaveBeenCalled()
  })

  it('⭐ holds EXACTLY the note clicked — asserted in SOUND, which is what the pedal is for', () => {
    // ⚠️ **Break-tested fixture.** Every note STACCATO, because a plain one proves nothing here: a
    // one-note pedal lifts where the note ends, so its ringing is unchanged either way and the test
    // would pass against a stamp that placed no pedal at all. Under a damper a staccato note rings
    // its full length (docs/pedal-plan.md §9 — the pedal beats the articulation), so the clicked
    // note is the only one that changes.
    for (const id of ids) engine.updateNote(id, { articulations: ['staccato'] })
    const dry = ringsFor(1)
    expect(dry, 'staccato really did shorten it').toBeLessThan(1)

    stampPedalAtClick(state, engine, hits(ids[1]), 10, 10, render)
    expect(ringsFor(0), 'the note before is untouched').toBeCloseTo(dry, 10)
    expect(ringsFor(1), 'the note clicked rings to the lift').toBeCloseTo(1, 10)
    expect(ringsFor(2), 'the note after is untouched').toBeCloseTo(dry, 10)
  })

  it('⭐⭐ a second press INSIDE a pedal already down LIFTS it there — the pianist\'s re-take', () => {
    // The entry door's truncation rule (docs/pedal-plan.md §3.3) reached through the gesture: two
    // overlapping dampers is not a stack, it is a contradiction — one foot.
    stampPedalAtClick(state, engine, hits(ids[0]), 10, 10, render)
    engine.setPedalLength(pedals()[0].id, frac(4, 1)) // hold the whole bar…
    stampPedalAtClick(state, engine, hits(ids[2]), 10, 10, render) // …then re-press at beat 2

    const all = pedals().map(p => `${fracToNumber(p.beat)}+${fracToNumber(p.length)}`)
    expect(all, 'the first pedal ends where the second begins').toEqual(['0+2', '2+1'])
  })

  it('…so stamping along a run leaves a CHAIN of abutting pedals, never a stack', () => {
    for (const id of ids) stampPedalAtClick(state, engine, hits(id), 10, 10, render)
    expect(pedals().map(p => `${fracToNumber(p.beat)}+${fracToNumber(p.length)}`))
      .toEqual(['0+1', '1+1', '2+1', '3+1'])
  })

  it('CONSUMES a click that missed every note, and changes nothing', () => {
    // A near-miss must not fall through to note entry: a stray note appearing under an armed line
    // tool is worse than a click that does nothing.
    expect(stampPedalAtClick(state, engine, hits(null), 10, 10, render)).toBe(true)
    expect(pedals()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('⛔ refuses a REST — the gesture means "hold THESE notes"', () => {
    // ⚠️ A pedal may of course be held THROUGH a rest; that is a LENGTH (`Ctrl+→` reaches it), not
    // an anchor.
    const rest = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), isRest: true })
    expect(stampPedalAtClick(state, engine, hits(rest!.id), 10, 10, render)).toBe(true)
    expect(pedals()).toHaveLength(0)
  })

  it('leaves the tool ARMED — pedals are placed in runs', () => {
    stampPedalAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(state.selectedMarkingTool).toEqual({ kind: 'pedal' })
  })

  it('⭐ the LAST note of the score still takes one — a pedal needs no second anchor', () => {
    const last = ids[ids.length - 1]
    expect(stampPedalAtClick(state, engine, hits(last), 10, 10, render)).toBe(true)
    expect(pedals()).toHaveLength(1)
    expect(fracToNumber(pedals()[0].length)).toBe(1)
  })

  it('is ONE undo entry per click', () => {
    stampPedalAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(engine.canUndo()).toBe(true)
    engine.undo()
    expect(pedals(), 'one press, one undo').toHaveLength(0)
  })
})
