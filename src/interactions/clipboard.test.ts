import { describe, it, expect, beforeEach, vi } from 'vitest'
import { levelToGlyphString, dynamicLevelOf } from '@/utils/dynamics'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { getMeasureNotes } from '../utils/musicUtils'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'

const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure() // a second measure for paste targets
  return engine
}

const flat = (engine: MusicEngine, m: number) =>
  getMeasureNotes(engine.getScore().measures.find(x => x.number === m)!)

const pitches = (engine: MusicEngine, m: number) =>
  flat(engine, m).filter(n => !n.isRest).map(n => `${n.step}${n.octave}@${fracToNumber(n.beat)}`)

describe('clipboard — copy/paste of notes', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  /** Add C4 D4 E4 F4 on beats 0..3 of measure 1; return their ids. */
  const fillM1 = () => [
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
    engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id,
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id,
    engine.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id,
  ]

  it('copies the selected span and pastes it verbatim into an empty bar', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.lanes).toHaveLength(1)
    expect(payload.lanes[0].events).toHaveLength(4)
    expect(fracToNumber(payload.spanBeats)).toBe(4)

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(pitches(engine, 2)).toEqual(['C4@0', 'D4@1', 'E4@2', 'F4@3'])
  })

  it('overwrites forward (existing content in the target window is replaced)', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    // Put a different note into measure 2 first.
    engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    expect(pitches(engine, 2)).toEqual(['G4@0'])

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(pitches(engine, 2)).toEqual(['C4@0', 'D4@1', 'E4@2', 'F4@3']) // G4 gone
  })

  it('returns the pasted note ids (for selecting them)', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    const pasted = engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(pasted).toHaveLength(4)
    const m2Ids = new Set(flat(engine, 2).map(n => n.id))
    for (const id of pasted) expect(m2Ids.has(id)).toBe(true)
  })

  it('round-trips a chord', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const e = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }).id
    const payload = buildClipboardFromSelection(engine.getScore(), [c, e])!
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const m2 = flat(engine, 2).filter(n => !n.isRest && fracToNumber(n.beat) === 0)
    expect(new Set(m2.map(n => `${n.step}${n.octave}`))).toEqual(new Set(['C4', 'E4']))
  })

  it('splits a note across a barline with a tie when pasted near the bar end', () => {
    // Copy a single half note (2 beats).
    const h = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [h])!
    expect(fracToNumber(payload.spanBeats)).toBe(2)

    // Paste at beat 3 of measure 2: 2 beats from beat 3 overflows the 4/4 bar.
    engine.pasteEvents(payload, { measure: 2, beat: frac(3, 1), voice: 0 })

    const m2 = flat(engine, 2).find(n => !n.isRest && fracToNumber(n.beat) === 3)!
    const m3 = flat(engine, 3).find(n => !n.isRest && fracToNumber(n.beat) === 0)!
    expect(m2.duration).toBe('q')
    expect(m3.duration).toBe('q')
    expect(m2.tiedTo).toBe(m3.id)   // first piece ties to the continuation
    expect(m3.tiedFrom).toBe(m2.id)
  })

  it('re-voices a single-voice clip into the paste target voice', () => {
    // Copy a voice-1 (model voice 0) note, paste into voice 2 (model voice 1).
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [c])!
    expect(payload.lanes).toHaveLength(1)
    expect(payload.lanes[0].voice).toBe(0)

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 1 })
    const pasted = flat(engine, 2).find(n => !n.isRest && fracToNumber(n.beat) === 0)!
    expect(pasted.step).toBe('C')
    expect(pasted.voice).toBe(1) // landed in voice 2, not voice 1
  })

  it('copies a multi-voice passage and preserves each voice on paste', () => {
    const v1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })!.id
    const v2 = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [v1, v2])!
    expect(payload.lanes.map(vv => vv.voice).sort()).toEqual([0, 1])

    // A multi-voice clip ignores the target voice and preserves the originals.
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    const m2 = flat(engine, 2).filter(n => !n.isRest && fracToNumber(n.beat) === 0)
    const byVoice = new Map(m2.map(n => [n.voice ?? 0, `${n.step}${n.octave}`]))
    expect(byVoice.get(0)).toBe('C5')
    expect(byVoice.get(1)).toBe('E3')
  })

  it('returns null when nothing is selected', () => {
    fillM1()
    expect(buildClipboardFromSelection(engine.getScore(), [])).toBeNull()
  })
})

/**
 * Rest-shift travel through copy/paste (docs/rest-shift-plan.md §4–§6.5): a shifted rest in
 * the copy window rides along at its clip-relative offset (the canon effect), and a paste
 * that overwrites a destination rest with a note drops that destination's shift.
 */
describe('clipboard — rest-shift travel', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const restAt = (m: number, beatNum: number) =>
    flat(engine, m).find((n) => n.isRest && fracToNumber(n.beat) === beatNum)!

  it('copies a shifted rest and travels it to the pasted position (same meter / canon)', () => {
    // m1 4/4: C@0(q), D@3(q) → a rest in between. Shift the rest at beat 1.
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id
    engine.nudgeRestShift(restAt(1, 1).id, 2)

    const payload = buildClipboardFromSelection(engine.getScore(), [c, d])!
    expect(payload.lanes[0].restShifts).toEqual([{ offset: frac(1, 1), steps: 2 }])

    // Paste at measure 2 beat 0 (empty, same 4/4) → the regenerated rest at offset 1 is stamped.
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const m2 = engine.getScore().measures.find((x) => x.number === 2)!
    expect(restShiftOverrideOf(engine.getScore(), restPositionKey(m2.id, 0, frac(1, 1)))?.steps).toBe(2)
  })

  it('a lone shifted rest (no note events) still produces a copyable payload', () => {
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = restAt(1, 1)
    engine.nudgeRestShift(rest.id, 1)
    const payload = buildClipboardFromSelection(engine.getScore(), [rest.id])
    expect(payload).not.toBeNull()
    expect(payload!.lanes[0].restShifts).toEqual([{ offset: frac(0, 1), steps: 1 }])
  })

  it('a paste that overwrites a shifted rest with a note drops that destination shift', () => {
    // m2 4/4: C@0(q) → rest@1(q), rest@2(half). Shift the rest at beat 2.
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const m2 = engine.getScore().measures.find((x) => x.number === 2)!
    engine.nudgeRestShift(restAt(2, 2).id, 3)
    expect(engine.getScore().engravingOverrides).toBeDefined()

    // Copy a quarter note from m1 and paste onto m2 beat 2 → a NOTE now starts there.
    const c = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [c])!
    engine.pasteEvents(payload, { measure: 2, beat: frac(2, 1), voice: 0 })

    expect(restShiftOverrideOf(engine.getScore(), restPositionKey(m2.id, 0, frac(2, 1)))).toBeUndefined()
  })
})

describe('clipboard — hidden-rest travel (client #6)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const restAt = (m: number, beatNum: number) =>
    flat(engine, m).find((n) => n.isRest && fracToNumber(n.beat) === beatNum)!

  it('copies a hidden rest and travels it to the pasted position', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id
    engine.toggleRestHidden(restAt(1, 1).id)

    const payload = buildClipboardFromSelection(engine.getScore(), [c, d])!
    expect(payload.lanes[0].restHidden).toEqual([{ offset: frac(1, 1) }])

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const m2 = engine.getScore().measures.find((x) => x.number === 2)!
    expect(restHiddenOf(engine.getScore(), restPositionKey(m2.id, 0, frac(1, 1)))).toBe(true)
  })

  it('a lone hidden rest (no note events) still produces a copyable payload', () => {
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = restAt(1, 1)
    engine.toggleRestHidden(rest.id)
    const payload = buildClipboardFromSelection(engine.getScore(), [rest.id])
    expect(payload).not.toBeNull()
    expect(payload!.lanes[0].restHidden).toEqual([{ offset: frac(0, 1) }])
  })
})

describe('clipboard — multi-staff copy/paste', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine() // two measures, one staff
  })

  /** Non-rest pitches on one staff of a measure, staff-projected via the score. */
  const notesOf = (m: number, staff: number) => {
    const score = engine.getScore()
    const measure = score.measures.find(x => x.number === m)!
    return getMeasureNotes(measure, score)
      .filter(n => (n.staff ?? 0) === staff && !n.isRest)
      .map(n => `${n.step}${n.octave}@${fracToNumber(n.beat)}`)
  }

  it('pasting a staff-0 clip onto staff 0 does NOT wipe staff 1 content', () => {
    // Staff 0 clip source: C4 D4 in m1.
    const ids = [
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
      engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id,
    ]
    engine.addStaffBelow(0)
    // Staff 1 has a distinct C3 in m2 — the paste target measure — that must survive.
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'h', measure: 2, beat: frac(0, 1), staff: 1 })
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    expect(notesOf(2, 0)).toEqual(['C4@0', 'D4@1']) // clip landed on staff 0
    expect(notesOf(2, 1)).toEqual(['C3@0'])         // staff 1 intact (the reported bug wiped it)
  })

  it('copies only the source staff, not another staff sharing the beat window', () => {
    // C4 on staff 0 and C3 on staff 1, both at m1 b0. Copy the staff-1 note only.
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.addStaffBelow(0)
    const s1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!.id

    const payload = buildClipboardFromSelection(engine.getScore(), [s1])!
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    // The clip carried C3 (source staff 1) only — no C4 from staff 0 mixed in.
    expect(notesOf(2, 0)).toEqual(['C3@0'])
  })

  it('pastes onto the destination staff (staff 1), leaving staff 0 intact', () => {
    const ids = [
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
    ]
    engine.addStaffBelow(0)
    // Staff 0 of m2 has a G4 that must survive a paste targeting staff 1.
    engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0, staff: 1 }) // target staff 1

    expect(notesOf(2, 1)).toEqual(['C4@0']) // clip on staff 1
    expect(notesOf(2, 0)).toEqual(['G4@0']) // staff 0 untouched
  })

  it('copies a two-staff selection and pastes it preserving relative staff offsets (1+2 → 3+4)', () => {
    // Four staves. Staff 0 = C4, staff 1 = C3, both in m1 b0.
    engine.addStaffBelow(0)
    engine.addStaffBelow(1)
    engine.addStaffBelow(2) // now staves 0..3
    const s0 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })!.id
    const s1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!.id

    const payload = buildClipboardFromSelection(engine.getScore(), [s0, s1])!
    expect(payload.spanStaves).toBe(2)
    expect(payload.lanes.map(l => l.staff).sort()).toEqual([0, 1]) // relative: 0 = topmost

    // Paste onto staff 2 → relStaff 0 lands on staff 2, relStaff 1 on staff 3.
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0, staff: 2 })

    expect(notesOf(2, 2)).toEqual(['C4@0']) // top lane → staff 2
    expect(notesOf(2, 3)).toEqual(['C3@0']) // bottom lane → staff 3
  })

  it('clamps + warns when a multi-staff clip would overflow the bottom staff', () => {
    // Two staves. Copy staves 0+1 (spanStaves 2).
    engine.addStaffBelow(0)
    const s0 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })!.id
    const s1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [s0, s1])!

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Target staff 1: relStaff 0 → staff 1 (OK), relStaff 1 → staff 2 (out of range, dropped).
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0, staff: 1 })

    expect(notesOf(2, 1)).toEqual(['C4@0']) // top lane landed on staff 1
    expect(warn).toHaveBeenCalled()          // overflow lane warned + dropped
    warn.mockRestore()
  })
})

describe('clipboard — hairpins travel', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  /** A measure's hairpins as `type@beat+length`. */
  const hairpinsOf = (m: number) =>
    engine.getHairpins(m).map(h => `${h.type}@${fracToNumber(h.beat)}+${fracToNumber(h.length)}`)

  /** Four quarters in bar 1, returned as their note ids. */
  const fourNotes = () => [0, 1, 2, 3].map(b =>
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })!.id)

  it('copies a hairpin under the selection and re-bases it on paste', () => {
    const ids = fourNotes()
    engine.addHairpin(1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.hairpins).toHaveLength(1)
    expect(payload.hairpins[0]).toMatchObject({ staff: 0, voice: 0, type: 'cresc' })
    expect(fracToNumber(payload.hairpins[0].offset)).toBe(1)
    expect(fracToNumber(payload.hairpins[0].length)).toBe(2)

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(hairpinsOf(2)).toEqual(['cresc@1+2'])
  })

  it('leaves a hairpin STRADDLING the window behind rather than truncating it', () => {
    // Copy only C@0 + D@1 → window [0,2). The wedge starts inside it but runs to beat 3.
    const ids = fourNotes().slice(0, 2)
    engine.addHairpin(1, { type: 'cresc', beat: frac(1, 1), length: frac(2, 1), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    // Half a wedge is not a wedge: dropping matches the dynamics/slurs rule, and a truncated
    // copy would claim a shape the copied music never had.
    expect(payload.hairpins).toHaveLength(0)
  })

  it('counts a wedge ending exactly on the window edge as enclosed', () => {
    // Window [0,2); wedge [0,2] — its end lands on the first beat NOT copied, which is where
    // the copied music stops sounding, so it fits. (A dynamic AT beat 2 would not.)
    const ids = fourNotes().slice(0, 2)
    engine.addHairpin(1, { type: 'dim', beat: frac(0, 1), length: frac(2, 1), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.hairpins).toHaveLength(1)
  })

  it('overwrites a destination hairpin starting in the paste window', () => {
    const ids = fourNotes()
    engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(1, 1), voice: 0 })
    engine.addHairpin(2, { type: 'dim', beat: frac(0, 1), length: frac(1, 1), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(hairpinsOf(2)).toEqual(['cresc@0+1']) // the clip's, not both
  })
})

describe('clipboard — dynamics travel (Phase 2)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  /** Dynamics of a measure on a given staff, as `level@beat` (or `text@beat`). */
  const dynsOf = (m: number, staff: number) => {
    const score = engine.getScore()
    return engine.getDynamics(m)
      .filter(d => (d.staffId ? score.staves!.findIndex(s => s.id === d.staffId) : 0) === staff)
      .map(d => `${dynamicLevelOf(d) ?? d.text}@${fracToNumber(d.beat)}`)
  }

  it('copies a dynamic under the selection and pastes it into the target bar', () => {
    const ids = [
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
      engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id,
    ]
    engine.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f'), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.dynamics).toHaveLength(1)
    expect(payload.dynamics[0]).toMatchObject({ staff: 0, voice: 0, text: levelToGlyphString('f') })
    expect(fracToNumber(payload.dynamics[0].offset)).toBe(0)

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(dynsOf(2, 0)).toEqual(['f@0'])
  })

  it('re-bases a dynamic to its clip-relative offset on paste', () => {
    // C@0, D@1, E@2, F@3 — copy the whole bar; dynamic on beat 2.
    const ids = [0, 1, 2, 3].map(b =>
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })!.id)
    engine.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('p'), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(fracToNumber(payload.dynamics[0].offset)).toBe(2)

    // Paste at m2 beat 1 → the dynamic lands at beat 1 + offset 2 = beat 3.
    engine.pasteEvents(payload, { measure: 2, beat: frac(1, 1), voice: 0 })
    expect(dynsOf(2, 0)).toEqual(['p@3'])
  })

  it('leaves a dynamic outside the copy window behind (fully-enclosed-only)', () => {
    // Select only C@0 + D@1 (window [0,2)); dynamic at beat 2 is on the boundary → excluded.
    const ids = [
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
      engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id,
    ]
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    engine.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f'), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.dynamics).toHaveLength(0)
  })

  it('overwrites a destination dynamic in the paste window (no stacking)', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    engine.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f'), voice: 0 })
    // Destination bar already has a 'p' at beat 0 that the paste should replace.
    engine.addDynamic(2, { beat: frac(0, 1), text: levelToGlyphString('p'), voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), [c])!
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(dynsOf(2, 0)).toEqual(['f@0']) // only the clip's, not ['p@0','f@0']
  })

  it('carries a hand-nudged offset (client #8) with the pasted dynamic', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('f'), voice: 0 })!
    engine.nudgeDynamicOffset(d.id, 2, -3) // hand-nudge the source mark

    const payload = buildClipboardFromSelection(engine.getScore(), [c])!
    expect(payload.dynamics[0].engravingOffset).toEqual({ x: 2, y: -3 })

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    // The pasted dynamic got a fresh id, but the offset rode along, re-keyed to it.
    const pasted = engine.getDynamics(2).find(x => dynamicLevelOf(x) === 'f')!
    expect(dynamicOffsetOverrideOf(engine.getScore(), pasted.id)).toEqual({ kind: 'dynamicOffset', x: 2, y: -3 })
  })

  it('carries a dynamic across staves (1+2 → 3+4)', () => {
    engine.addStaffBelow(0)
    engine.addStaffBelow(1)
    engine.addStaffBelow(2) // staves 0..3
    const s0 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })!.id
    const s1 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!.id
    engine.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('mf'), voice: 0, staffId: engine.staffIdForIndex(1) })

    const payload = buildClipboardFromSelection(engine.getScore(), [s0, s1])!
    expect(payload.dynamics[0]).toMatchObject({ staff: 1, text: levelToGlyphString('mf') }) // relative staff 1 (bottom copied)

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0, staff: 2 })
    expect(dynsOf(2, 3)).toEqual(['mf@0']) // relStaff 1 → staff 3
    expect(dynsOf(2, 2)).toEqual([])       // nothing spurious on staff 2
  })
})

describe('⭐ clipboard — trills travel (docs/trill-plan.md §2.3)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const idAt = (m: number, staff: number, label: string) => {
    const score = engine.getScore()
    const meas = score.measures.find(x => x.number === m)!
    return getMeasureNotes(meas, score)
      .find(n => !n.isRest && (n.staff ?? 0) === staff && `${n.step}${n.octave}@${fracToNumber(n.beat)}` === label)?.id
  }

  const fill = (m: number, staff = 0) => (['C', 'D', 'E', 'F'] as const).map((s, b) =>
    engine.addNoteAtBeat({ step: s, alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1), staff })!.id)

  it('copies a trill and re-anchors both ends onto the pasted notes', () => {
    const ids = fill(1)
    engine.addTrill({ startNoteId: ids[0], endNoteId: ids[3], voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.trills).toHaveLength(1)
    expect(payload.trills[0].startPitch).toMatchObject({ step: 'C', octave: 4 })
    expect(payload.trills[0].endPitch).toMatchObject({ step: 'F', octave: 4 })

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const pasted = (engine.getScore().trills ?? []).filter(t => t.startNoteId === idAt(2, 0, 'C4@0'))
    expect(pasted).toHaveLength(1)
    expect(pasted[0].endNoteId).toBe(idAt(2, 0, 'F4@3'))
  })

  it('carries the ONE-NOTE trill, and does not invent an end for it', () => {
    const ids = fill(1)
    engine.addTrill({ startNoteId: ids[1], voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.trills).toHaveLength(1)
    expect(payload.trills[0].endPitch).toBeUndefined()

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    const pasted = (engine.getScore().trills ?? []).filter(t => t.startNoteId === idAt(2, 0, 'D4@1'))
    expect(pasted).toHaveLength(1)
    expect(pasted[0].endNoteId).toBeUndefined()
  })

  // ⭐ The one place this family departs from the fully-enclosed rule its neighbours share: half a
  // wedge or half an arc is a SHAPE the music never had, but a trill whose end is outside the
  // window is a note that is genuinely trilled — so the sign travels and the line is dropped.
  it('a trill whose END is outside the window travels as the one-note trill', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    const e = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
    engine.addTrill({ startNoteId: c, endNoteId: e, voice: 0 })

    // Copy only C+D → window [0,2); E@2 is outside it.
    const payload = buildClipboardFromSelection(engine.getScore(), [c, d])!
    expect(payload.trills).toHaveLength(1)
    expect(payload.trills[0].startPitch).toMatchObject({ step: 'C', octave: 4 })
    expect(payload.trills[0].endPitch).toBeUndefined()
  })

  it('a trill whose SIGN is outside the window is left behind entirely', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    const e = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
    engine.addTrill({ startNoteId: c, endNoteId: e, voice: 0 })

    const payload = buildClipboardFromSelection(engine.getScore(), [d, e])!
    expect(payload.trills).toHaveLength(0)
  })
})

describe('clipboard — slurs travel (Phase 3)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  /** Id of the non-rest note at `label` (e.g. 'C4@0') on a given staff of a measure. */
  const idAt = (m: number, staff: number, label: string) => {
    const score = engine.getScore()
    const meas = score.measures.find(x => x.number === m)!
    return getMeasureNotes(meas, score)
      .find(n => !n.isRest && (n.staff ?? 0) === staff && `${n.step}${n.octave}@${fracToNumber(n.beat)}` === label)?.id
  }

  /** Add C D E F quarters on beats 0..3 of a measure/staff; return their ids. */
  const fill = (m: number, staff = 0) => (['C', 'D', 'E', 'F'] as const).map((s, b) =>
    engine.addNoteAtBeat({ step: s, alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1), staff })!.id)

  it('copies a slur and re-anchors it onto the pasted notes', () => {
    const ids = fill(1)
    engine.createSlur([ids[0], ids[3]]) // slur C4@0 → F4@3

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.slurs).toHaveLength(1)
    expect(payload.slurs[0].startPitch).toMatchObject({ step: 'C', octave: 4 })
    expect(payload.slurs[0].endPitch).toMatchObject({ step: 'F', octave: 4 })

    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const pasted = (engine.getScore().slurs ?? []).filter(s => s.startNoteId === idAt(2, 0, 'C4@0'))
    expect(pasted).toHaveLength(1)
    expect(pasted[0].endNoteId).toBe(idAt(2, 0, 'F4@3')) // re-anchored to the pasted notes
  })

  it('leaves a slur with an endpoint outside the copy window behind (fully-enclosed-only)', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const d = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    const e = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id
    engine.createSlur([c, e]) // C@0 → E@2

    // Copy only C+D → window [0,2); E@2 is on the boundary → slur not enclosed.
    const payload = buildClipboardFromSelection(engine.getScore(), [c, d])!
    expect(payload.slurs).toHaveLength(0)
  })

  it('re-bases a slur to the paste offset', () => {
    const ids = fill(1) // C D E F @ 0..3
    engine.createSlur([ids[1], ids[2]]) // slur D4@1 → E4@2

    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    // Paste at m2 beat 0: the slur's D (clip offset 1) and E (offset 2) land at beats 1 and 2.
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })

    const pasted = (engine.getScore().slurs ?? []).filter(s => s.startNoteId === idAt(2, 0, 'D4@1'))
    expect(pasted).toHaveLength(1)
    expect(pasted[0].endNoteId).toBe(idAt(2, 0, 'E4@2'))
  })

  it('carries a slur across staves (1+2 → 3+4)', () => {
    engine.addStaffBelow(0)
    engine.addStaffBelow(1)
    engine.addStaffBelow(2) // staves 0..3
    const s0 = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })!.id
    const a = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })!.id
    const b = engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), staff: 1 })!.id
    engine.createSlur([a, b]) // slur on staff 1

    const payload = buildClipboardFromSelection(engine.getScore(), [s0, a, b])!
    expect(payload.slurs).toHaveLength(1)
    expect(payload.slurs[0].startStaff).toBe(1) // relative staff 1 (bottom copied)

    // Paste onto staff 2 → the slur re-anchors on staff 3 (relStaff 1 + target 2).
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0, staff: 2 })

    const pasted = (engine.getScore().slurs ?? []).filter(s => s.startNoteId === idAt(2, 3, 'C4@0'))
    expect(pasted).toHaveLength(1)
    expect(pasted[0].endNoteId).toBe(idAt(2, 3, 'D4@1'))
  })
})
