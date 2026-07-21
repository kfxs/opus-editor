import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { getMeasureNotes } from '../utils/musicUtils'
import { fracCreate as frac } from '../utils/fraction'
import { spacingPositionKey, leadingSpaceOverrideOf, measureLeadingSpaces } from '../engine/models/engravingOverrides'

/**
 * A leading space TRAVELS WITH THE MUSIC (docs/note-spacing-plan.md §6).
 *
 * The reason it needs its own machinery: the override is keyed by *position*, not by any id the
 * clipboard carries, so nothing in the event stream can drag it along. Without capture/restore a
 * copied passage arrives unspaced and a meter change silently loses the spacing — both quietly.
 *
 * The other half of the same rule is the auto-reset: a space whose column no longer exists is
 * DROPPED, because a space with nothing to space would still widen the bar and shift nothing.
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

const measureId = (engine: MusicEngine, n: number) =>
  engine.getScore().measures.find(m => m.number === n)!.id

/** The space authored at (measure, beat), read back off the score value. */
const spaceAt = (engine: MusicEngine, m: number, beat: number) =>
  leadingSpaceOverrideOf(engine.getScore(), spacingPositionKey(measureId(engine, m), frac(beat, 1)))?.space ?? 0

/** C4 D4 E4 F4 on beats 0..3 of measure `m`; returns their ids. */
function fourNotes(engine: MusicEngine, m: number): string[] {
  const steps = ['C', 'D', 'E', 'F'] as const
  return steps.map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: m, beat: frac(i, 1) })!.id,
  )
}

/** Author a space directly on the model, bypassing the render-measured floor (there is no
 *  renderer here — that seam is covered in noteSpacingNudge.test.ts). */
function authorSpace(engine: MusicEngine, m: number, beat: number, space: number) {
  engine.setNoteSpacing(m, frac(beat, 1), space, -10)
}

describe('leading space — copy/paste', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('is captured into the clip, re-based to the selection start', () => {
    const ids = fourNotes(engine, 1)
    authorSpace(engine, 1, 2, 1.5)

    // Copy from beat 1 onward, so the space at beat 2 lands at clip offset 1.
    const clip = buildClipboardFromSelection(engine.getScore(), ids.slice(1))!
    expect(clip.spaces).toEqual([{ offset: frac(1, 1), space: 1.5 }])
  })

  it('is omitted entirely when the window holds none', () => {
    const ids = fourNotes(engine, 1)
    expect(buildClipboardFromSelection(engine.getScore(), ids)!.spaces).toBeUndefined()
  })

  it('only spaces INSIDE the window travel', () => {
    const ids = fourNotes(engine, 1)
    authorSpace(engine, 1, 1, 1)
    authorSpace(engine, 1, 3, 2)

    // Window = beats 0..2 (the first two notes), so the beat-3 space is left behind.
    const clip = buildClipboardFromSelection(engine.getScore(), ids.slice(0, 2))!
    expect(clip.spaces).toEqual([{ offset: frac(1, 1), space: 1 }])
  })

  it('lands on the pasted music, at the same rhythmic distance from the clip start', () => {
    const ids = fourNotes(engine, 1)
    authorSpace(engine, 1, 2, 1.5)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!

    fourNotes(engine, 2)
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs, clip.spaces ?? [])

    expect(spaceAt(engine, 2, 2)).toBe(1.5)
    expect(spaceAt(engine, 1, 2)).toBe(1.5) // …and the source keeps its own
  })

  it('re-bases by the PASTE start, not just the clip start', () => {
    const ids = fourNotes(engine, 1)
    authorSpace(engine, 1, 1, 2)
    const clip = buildClipboardFromSelection(engine.getScore(), ids.slice(0, 2)) // beats 0..1

    fourNotes(engine, 2)
    engine.pasteEvents(2, frac(2, 1), clip!.lanes, clip!.spanBeats, 0, [], [], 0, clip!.dynamics, clip!.slurs, clip!.spaces ?? [])

    expect(spaceAt(engine, 2, 3)).toBe(2) // clip offset 1 + paste start 2
    expect(spaceAt(engine, 2, 1)).toBe(0)
  })

  it('the clip wins where both sides spaced the same column', () => {
    const ids = fourNotes(engine, 1)
    authorSpace(engine, 1, 2, 3)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!

    fourNotes(engine, 2)
    authorSpace(engine, 2, 2, 1) // the destination had its own idea
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs, clip.spaces ?? [])

    expect(spaceAt(engine, 2, 2)).toBe(3)
  })

  it('an old clip with no `spaces` pastes exactly as before', () => {
    const ids = fourNotes(engine, 1)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    fourNotes(engine, 2)
    authorSpace(engine, 2, 1, 2)

    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs)

    // The destination's own space survives the rebar the paste runs.
    expect(spaceAt(engine, 2, 1)).toBe(2)
  })
})

describe('leading space — survives a rebar, and auto-resets when its column dies', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follows the music when a meter change re-tiles the bars', () => {
    fourNotes(engine, 1)
    authorSpace(engine, 1, 2, 2)

    // 4/4 → 2/4: the bar splits, and beats 2-3 move into a new bar as beats 0-1. The space
    // must go with the note it was authored in front of, not stay on bar 1.
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })

    expect(spaceAt(engine, 1, 2)).toBe(0)
    expect(spaceAt(engine, 2, 0)).toBe(2)
  })

  it('is DROPPED when the new tiling leaves no column at that beat', () => {
    // One note filling the bar, and a space authored at a beat where nothing starts. (Authoring
    // it is only possible off-render; the point is what a rebar does with it.)
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    authorSpace(engine, 1, 1, 2)
    expect(spaceAt(engine, 1, 1)).toBe(2)

    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })

    // Nothing starts at that offset in the re-tiled music, so the space goes rather than
    // widening a bar with nothing to shift.
    for (const m of engine.getScore().measures) {
      expect(measureLeadingSpaces(engine.getScore(), m.id).some(s => s.space === 2)).toBe(false)
    }
  })

  it('a space in an untouched bar is left alone', () => {
    fourNotes(engine, 1)
    fourNotes(engine, 2)
    authorSpace(engine, 2, 1, 1.25)

    const before = getMeasureNotes(engine.getScore().measures[1]).length
    authorSpace(engine, 1, 1, 0.5)
    expect(spaceAt(engine, 2, 1)).toBe(1.25)
    expect(getMeasureNotes(engine.getScore().measures[1]).length).toBe(before)
  })
})
