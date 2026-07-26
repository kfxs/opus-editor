import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { fracCreate as frac } from '../utils/fraction'
import { noteOffsetOverrideOf } from '../engine/models/engravingOverrides'

/**
 * A note horizontal offset (client #12) TRAVELS WITH THE MUSIC (docs/note-offset-plan.md).
 *
 * Like the rest shift and leading space, the override is keyed by something the clipboard event
 * stream does not carry — here the SLOT id, which a rebar re-mints — so without capture/restore a
 * copied passage arrives un-offset and a meter change silently loses it. Capture is by (voice, staff,
 * absolute offset); restore stamps the slot that now starts there, dropping any the tiling dissolved.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
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
  engine.addMeasure()
  return engine
}

/** C4 D4 E4 F4 on beats 0..3 of measure `m`; returns their (pitch) ids. */
function fourNotes(engine: MusicEngine, m: number): string[] {
  const steps = ['C', 'D', 'E', 'F'] as const
  return steps.map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: m, beat: frac(i, 1) })!.id,
  )
}

/** The offset stored for note `noteId`, or 0 when none — read at the key the engine itself writes. */
const offsetOf = (engine: MusicEngine, noteId: string) => {
  const key = engine.offsetTargetOf(noteId)?.key
  return key ? noteOffsetOverrideOf(engine.getScore(), key)?.x ?? 0 : 0
}

/** The id of the note at (measure, beat) — the pasted/re-tiled slot has a fresh id. */
const noteIdAt = (engine: MusicEngine, m: number, beat: number) => {
  const measure = engine.getScore().measures.find(mm => mm.number === m)!
  const slot = measure.slots.find(s => s.beat.num === beat && s.beat.den === 1 && s.type === 'chord')
  return slot && slot.type === 'chord' ? slot.notes[0].id : undefined
}

describe('note offset — copy/paste', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('is captured into the clip lane, re-based to the selection start', () => {
    const ids = fourNotes(engine, 1)
    engine.nudgeNoteOffset(ids[1], 2) // beat 1
    const clip = buildClipboardFromSelection(engine.getScore(), ids.slice(1))! // window starts at beat 1
    expect(clip.lanes[0].noteOffsets).toEqual([{ offset: frac(0, 1), x: 2 }])
  })

  it('is omitted entirely when the window holds none', () => {
    const ids = fourNotes(engine, 1)
    expect(buildClipboardFromSelection(engine.getScore(), ids)!.lanes[0].noteOffsets).toBeUndefined()
  })

  it('lands on the pasted music at the same rhythmic distance from the clip start', () => {
    const ids = fourNotes(engine, 1)
    engine.nudgeNoteOffset(ids[2], -3) // beat 2
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    const clipNoteOffsets = clip.lanes
      .filter(l => l.noteOffsets?.length)
      .map(l => ({ staff: l.staff, voice: l.voice, noteOffsets: l.noteOffsets! }))
    engine.addMeasure()
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs, clip.spaces ?? [], clipNoteOffsets)
    expect(offsetOf(engine, noteIdAt(engine, 2, 2)!)).toBe(-3)
  })

  it('an old clip with no `noteOffsets` pastes exactly as before', () => {
    const ids = fourNotes(engine, 1)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    // Call the pre-client-#12 arity (no clipNoteOffsets) — must not throw.
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs)
    expect(offsetOf(engine, noteIdAt(engine, 2, 0)!)).toBe(0)
  })
})

/**
 * ⭐ A FANNED MEMBER's offset travels too (docs/note-offset-plan.md P3) — and by a different address
 * than everything else here: the group's own beat plus the member's INDEX. A member has no column of
 * its own for the tiling to hand back, and its key (its first pitch id) is re-minted by
 * `cloneFanFresh` on the far side, so the index is what survives the crossing.
 */
describe('note offset — a fanned member', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  /** A fanned half note at bar 1 beat 0, plus a second half note to fill the bar. */
  function fanned() {
    const owner = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.setFan(owner.id, { direction: 'accel', count: 4, beams: 3 })
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    return { owner, memberIds: slot.fan!.members!.map(m => m[0].id) }
  }

  /** The offset stored on member `k` of the fan at (measure, beat 0), or 0 when none. */
  const memberOffsetAt = (m: number, k: number) => {
    const measure = engine.getScore().measures.find(mm => mm.number === m)!
    const slot = measure.slots.find(s => s.type === 'chord' && s.beat.num === 0)
    if (!slot || slot.type !== 'chord') return 0
    const id = slot.fan?.members?.[k - 1]?.[0]?.id
    return id ? noteOffsetOverrideOf(engine.getScore(), id)?.x ?? 0 : 0
  }

  it('⭐ is captured with its INDEX, beside the group’s own offset', () => {
    const { owner, memberIds } = fanned()
    engine.nudgeNoteOffset(owner.id, 1)
    engine.nudgeNoteOffset(memberIds[1], -2) // member 2 of 4
    const clip = buildClipboardFromSelection(engine.getScore(), [owner.id])!
    expect(clip.lanes[0].noteOffsets).toEqual([
      { offset: frac(0, 1), x: 1 },
      { offset: frac(0, 1), x: -2, member: 2 },
    ])
  })

  it('⭐ lands on the member of the same index in the pasted fan', () => {
    const { owner, memberIds } = fanned()
    engine.nudgeNoteOffset(memberIds[1], -2)
    const clip = buildClipboardFromSelection(engine.getScore(), [owner.id])!
    const clipNoteOffsets = clip.lanes
      .filter(l => l.noteOffsets?.length)
      .map(l => ({ staff: l.staff, voice: l.voice, noteOffsets: l.noteOffsets! }))
    engine.addMeasure()
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs, clip.spaces ?? [], clipNoteOffsets)

    expect(memberOffsetAt(2, 2)).toBe(-2)
    // …on the PASTED fan's own member, whose id is a fresh one — and only that member.
    expect(memberOffsetAt(2, 1)).toBe(0)
    expect(memberOffsetAt(2, 3)).toBe(0)
  })

  it('follows the group when a meter change re-tiles the bars', () => {
    const { memberIds } = fanned()
    engine.nudgeNoteOffset(memberIds[0], 3)
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })

    // ⚠️ The precondition, asserted so this cannot pass vacuously: the rebuilt slot's members are
    // FRESH pitches (`cloneFanFresh`), so the entry can only be there because it was re-stamped.
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    expect(slot.fan!.members![0][0].id).not.toBe(memberIds[0])
    expect(memberOffsetAt(1, 1)).toBe(3)
  })
})

describe('note offset — survives a rebar', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follows the music when a meter change re-tiles the bars', () => {
    const ids = fourNotes(engine, 1)
    engine.nudgeNoteOffset(ids[0], 2) // beat 0, C4
    // 4/4 → 2/4 splits the bar; the offset note stays at absolute beat 0 (bar 1, beat 0).
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(offsetOf(engine, noteIdAt(engine, 1, 0)!)).toBe(2)
  })

  it('re-lands on the bar the note moved to when the meter re-tiles', () => {
    const ids = fourNotes(engine, 1)
    engine.nudgeNoteOffset(ids[2], -1) // E4 at absolute beat 2
    // 4/4 → 2/4: bar 1 = C(0) D(1), bar 2 = E(0) F(1). E4 (abs beat 2) now opens bar 2.
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(offsetOf(engine, noteIdAt(engine, 2, 0)!)).toBe(-1)
  })
})
