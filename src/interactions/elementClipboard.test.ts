import { describe, it, expect, beforeEach, vi } from 'vitest'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { MusicEngine } from '../engine/MusicEngine'
import { copyElement, pasteElement } from './elementClipboard'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { levelToGlyphString } from '../utils/dynamics'

/**
 * COPY/PASTE of one selected element — an expression (a dynamic), a TEMPO mark, and a HAIRPIN.
 *
 * Subject: {@link elementClipboard}, sitting beside this file. Real engine, stubbed renderer and
 * playback: what a clip carries and what a paste writes are both model facts.
 */
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

/** The id of whatever a paste left selected — ⚠️ `SelectedElement` is a union and two of its arms
 *  (a barline, a measure range) name a place rather than a thing, so `.id` is not total over it. */
const idOf = (element: ReturnType<typeof pasteElement>): string | null =>
  (element && 'id' in element ? element.id : null)

describe('elementClipboard', () => {
  let engine: MusicEngine
  let dynamicId: string

  /** Every dynamic in the score as `measure@beat:text`, in bar/beat order. */
  const dynamics = () => engine.getScore().measures.flatMap(m =>
    (m.dynamics ?? []).map(d => `${m.number}@${fracToNumber(d.beat)}:${d.text}`))

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    dynamicId = engine.addDynamic(1, { beat: frac(0, 1), text: 'dolce', voice: 0, placement: 'below' })!.id
  })

  it('copies the MARK — its text and how it reads — and no id', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })
    expect(clip).toEqual({ kind: 'dynamic', text: 'dolce', placement: 'below', voice: 0 })
    expect(JSON.stringify(clip)).not.toContain(dynamicId)
  })

  it('declines a kind that cannot travel yet, and a stale id', () => {
    expect(copyElement(engine, { kind: 'barline', measure: 1 })).toBeNull()
    expect(copyElement(engine, { kind: 'dynamic', id: 'gone' })).toBeNull()
    expect(copyElement(engine, null)).toBeNull()
  })

  it('⭐ pastes a NEW mark at the anchor, leaving the copied one alone', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    const created = pasteElement(engine, clip, { measure: 2, beat: frac(0, 1), staff: 0, voice: 0 })
    expect(created).toEqual({ kind: 'dynamic', id: expect.any(String) })
    expect(created).not.toEqual({ kind: 'dynamic', id: dynamicId })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce'])
  })

  it('pastes the same clip any number of times — it holds no position of its own', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    pasteElement(engine, clip, { measure: 2, beat: frac(2, 1) })
    expect(dynamics()).toEqual(['1@0:dolce', '2@0:dolce', '2@2:dolce'])
  })

  it('keeps the CLIP’s scope, whatever voice the anchor names', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    const voiced = { ...clip, voice: 1 as const }
    pasteElement(engine, voiced, { measure: 2, beat: frac(0, 1), voice: 2 })
    pasteElement(engine, voiced, { measure: 2, beat: frac(1, 1) })
    const voices = engine.getScore().measures[1].dynamics!.map(d => d.voice)
    expect(voices).toEqual([1, 1])
  })

  // ⭐ The reversal this replaced: the anchor used to win, so an ALL mark could never be pasted.
  it('a mark governing ALL voices stays ALL, even pasted onto a voice-2 note', () => {
    // No `voice` at all — the stamp sites' shape since P1, meaning "every voice of this staff".
    const all = engine.addDynamic(1, { beat: frac(2, 1), text: 'dolce', placement: 'below' })!
    expect(all.voice).toBeUndefined()
    const clip = copyElement(engine, { kind: 'dynamic', id: all.id })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1), voice: 2 })
    expect(engine.getScore().measures[1].dynamics![0].voice).toBeUndefined()
  })

  it('a glyph level travels verbatim — the mark IS its text', () => {
    const level = engine.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('ff') })!
    const clip = copyElement(engine, { kind: 'dynamic', id: level.id })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(engine.getScore().measures[1].dynamics![0].text).toBe(levelToGlyphString('ff'))
  })

  it('an undo takes the pasted mark back out', () => {
    const clip = copyElement(engine, { kind: 'dynamic', id: dynamicId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(engine.undo()).toBe(true)
    expect(dynamics()).toEqual(['1@0:dolce'])
  })
})

describe('elementClipboard — the TEMPO mark (his ask, 2026-08-19)', () => {
  let engine: MusicEngine
  let tempoId: string

  /** Every tempo mark as `measure@beat:text`. */
  const tempos = () => engine.getScore().measures.flatMap(m =>
    (m.tempos ?? []).map(t => `${m.number}@${fracToNumber(t.beat)}:${t.text}`))

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Bar 1: notes on beats 0 and 2 only — so beats 1 and 3 sound NOTHING and are not anchors.
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    tempoId = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', unit: 'q', bpm: 144 })!.id
  })

  it('copies the mark — its text AND what it sounds — and no id', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })
    expect(clip).toEqual({ kind: 'tempo', text: 'Allegro', unit: 'q', bpm: 144 })
    expect(JSON.stringify(clip)).not.toContain(tempoId)
  })

  it('declines a stale id', () => {
    expect(copyElement(engine, { kind: 'tempo', id: 'gone' })).toBeNull()
  })

  it('⭐ pastes a NEW mark on an ONSET, keeping what it sounds', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    const created = pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(created).toEqual({ kind: 'tempo', id: expect.any(String) })
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Allegro'])
    expect(engine.getScore().measures[1].tempos![0].bpm).toBe(144)
  })

  it('⭐⭐ a beat NOTHING sounds on resolves FORWARD to the next onset — the ink’s own rule', () => {
    // Beat 1 of bar 1 is inside a half note: no onset, so no anchor. The mark lands on beat 2,
    // where the drawing would put it anyway (TempoLayout.anchorX: the first element at-or-after).
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 1, beat: frac(1, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '1@2:Allegro'])
  })

  it('⭐ REPLACES the mark sitting on that beat — one tempo per beat — and one undo puts it back', () => {
    const other = engine.addTempoMark(2, { beat: frac(0, 1), text: 'Adagio' })!.id
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Allegro'])
    expect(engine.getTempoMarkById(other), 'the Adagio is gone').toBeNull()

    expect(engine.undo()).toBe(true)
    expect(tempos()).toEqual(['1@0:Allegro', '2@0:Adagio'])
  })

  it('pastes the same clip any number of times', () => {
    const clip = copyElement(engine, { kind: 'tempo', id: tempoId })!
    pasteElement(engine, clip, { measure: 1, beat: frac(2, 1) })
    pasteElement(engine, clip, { measure: 2, beat: frac(0, 1) })
    expect(tempos()).toEqual(['1@0:Allegro', '1@2:Allegro', '2@0:Allegro'])
  })

  /**
   * ⭐⭐ THE SLUR (his ask, 2026-08-20) — the first clip whose identity is two NOTE IDS, which mean
   * nothing anywhere else. What travels is *"a slur over this much music"*, and the paste resolves
   * the ends against the destination's own notes.
   */
  describe('a slur', () => {
    let ids: string[]
    let slurId: string
    /** Every slur as `start→end`, by the pitch letters it joins. */
    const slurs = () => engine.getScore().slurs!.map(s =>
      `${engine.getNote(s.startNoteId)?.step}→${engine.getNote(s.endNoteId)?.step}`)

    beforeEach(() => {
      ids = (['D', 'E', 'F', 'G'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
      slurId = engine.createSlur([ids[0], ids[1]])!.id   // D→E, one beat of span
    })

    it('⭐⭐ copies the SPAN, since two note ids mean nothing anywhere else', () => {
      expect(copyElement(engine, { kind: 'slur', id: slurId })).toEqual({ kind: 'slur', span: frac(1, 1) })
    })

    it('⭐ pastes a slur over the SAME amount of music at the anchor', () => {
      const clip = copyElement(engine, { kind: 'slur', id: slurId })!
      pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0, noteId: ids[2] })
      expect(slurs()).toEqual(['D→E', 'F→G'])
    })

    it('⭐⭐ …and a WIDER slur stays wider — the span is what was copied', () => {
      const wide = engine.createSlur([ids[0], ids[2]])!   // D→F, two beats
      const clip = copyElement(engine, { kind: 'slur', id: wide.id })!
      expect(clip).toMatchObject({ span: frac(2, 1) })
      // Pasted on the second note, two beats reach the fourth.
      pasteElement(engine, clip, { measure: 1, beat: frac(1, 1), staff: 0, noteId: ids[1] })
      expect(slurs()).toContain('E→G')
    })

    it('⭐ an explicit PLACEMENT travels; an absent one stays absent so the stems decide', () => {
      engine.flipSlur(slurId)
      const clip = copyElement(engine, { kind: 'slur', id: slurId })!
      expect(clip).toHaveProperty('placement')
      const pasted = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0, noteId: ids[2] }))!
      expect(engine.getSlurById(pasted)?.placement).toBe(engine.getSlurById(slurId)?.placement)
    })

    it('🚨⛔ REFUSES where nothing sounds — a click on an empty bar is not a slur', () => {
      // His report, 2026-08-20: clicking an empty bar drew a slur anyway, reaching forward however
      // many bars it took to find two notes. ⭐ The start must be AT the anchor: a click resolves to
      // the nearest slot boundary, so that is exactly what was pointed at — and a REST cannot anchor
      // a slur.
      const clip = copyElement(engine, { kind: 'slur', id: slurId })!
      // ⭐ The anchor names no NOTE — which is exactly what a click on an empty bar produces, and
      // what a slur must refuse (`PasteAnchor.noteId`).
      engine.addMeasure()
      const empty = engine.getScore().measures[engine.getScore().measures.length - 1].number
      expect(pasteElement(engine, clip, { measure: empty, beat: frac(0, 1), staff: 0 })).toBeNull()
      expect(engine.getScore().slurs, 'and nothing was written').toHaveLength(1)
    })

    it('⛔ …and where the lane runs out — a slur with one end is not a slur', () => {
      // ⚠️ The LAST note of the score, ⛔ not merely the last of a bar: a span reaches through a
      // barline like anything else. (This fixture's fifth quarter overflowed into bar 2.)
      const last = engine.getScore().measures.find(m => m.number === 2)!.slots
        .find(x => x.type === 'chord')!
      const clip = copyElement(engine, { kind: 'slur', id: slurId })!
      expect(pasteElement(engine, clip, {
        measure: 2, beat: frac(0, 1), staff: 0,
        noteId: (last as { notes: { id: string }[] }).notes[0].id,
      })).toBeNull()
    })
  })

  /**
   * ⭐⭐ THE TRILL (his ask, 2026-08-20) — the slur's shape, for the slur's reason: its identity is a
   * NOTE plus an extent. ⭐ What is its own is that the three ways it READS travel with it — the
   * side, the continuation label, and whether it draws a line at all.
   */
  describe('a trill', () => {
    let ids: string[]
    let trillId: string
    /** Every trill as `start→end` by pitch letter, or just `start` for the one-note trill. */
    const trills = () => engine.getTrills().map(t => {
      const from = engine.getNote(t.startNoteId)?.step
      const to = t.endNoteId ? engine.getNote(t.endNoteId)?.step : undefined
      return to ? `${from}→${to}` : `${from}`
    })

    beforeEach(() => {
      ids = (['D', 'E', 'F', 'G'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
      trillId = engine.createTrill([ids[0], ids[1]])!.id   // D→E, one beat of span
    })

    it('⭐⭐ copies the SPAN, since a note id means nothing anywhere else', () => {
      expect(copyElement(engine, { kind: 'trill', id: trillId })).toEqual({
        kind: 'trill', span: frac(1, 1),
      })
    })

    it('⭐ pastes a trill over the SAME amount of music at the anchor', () => {
      const clip = copyElement(engine, { kind: 'trill', id: trillId })!
      pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0, noteId: ids[2] })
      expect(trills()).toEqual(['D→E', 'F→G'])
    })

    it('⚠️ a ONE-NOTE trill travels as a span of ZERO, and arrives with no end', () => {
      // ⭐ Its extent is its own note's sounding duration ({@link Trill.endNoteId}), which is spelled
      // by ABSENCE — so the clip carries nothing to resolve and the paste asks for no end.
      const alone = engine.createTrill([ids[2]])!
      const clip = copyElement(engine, { kind: 'trill', id: alone.id })!
      expect(clip).toMatchObject({ span: frac(0, 1) })
      pasteElement(engine, clip, { measure: 1, beat: frac(3, 1), staff: 0, noteId: ids[3] })
      expect(trills()).toContain('G')
    })

    it('⭐⭐ the three ways it READS travel — side, label, and whether it has a line', () => {
      engine.toggleTrillPlacement(trillId)
      engine.setTrillContinuationLabel(trillId, 'plain')
      const clip = copyElement(engine, { kind: 'trill', id: trillId })!
      expect(clip).toMatchObject({ placement: 'below', continuationLabel: 'plain' })

      const pasted = idOf(pasteElement(engine, clip, {
        measure: 1, beat: frac(2, 1), staff: 0, noteId: ids[2],
      }))!
      expect(engine.getTrillById(pasted)).toMatchObject({
        placement: 'below', continuationLabel: 'plain',
      })
    })

    it('⛔ …but the hand-nudged INK does not — it was authored against other music', () => {
      engine.nudgeTrillEndpoint(trillId, 'start', 3, 2)
      const clip = copyElement(engine, { kind: 'trill', id: trillId })!
      expect(clip).not.toHaveProperty('startX')
      const pasted = idOf(pasteElement(engine, clip, {
        measure: 1, beat: frac(2, 1), staff: 0, noteId: ids[2],
      }))!
      expect(trillOffsetOverrideOf(engine.getScore(), pasted),
        'it arrives where the engraver would put it').toBeUndefined()
      expect(trillOffsetOverrideOf(engine.getScore(), trillId), 'the copied one keeps its own')
        .toBeTruthy()
    })

    it('🚨🚨 A BARE `tr` COPIES AS A BARE `tr` — his call, 2026-08-20', () => {
      // *"a `tr` with no extension should be copied and pasted as a `tr` with no extension — this is
      // important because it is a use case the user wants to KEEP"*. ⛔⛔ `extension: 'none'` and an
      // `endNoteId` contradict each other ({@link Trill.extension}), so the pair has to arrive in the
      // right ORDER: no end asked for, then the line turned off.
      const alone = engine.createTrill([ids[2]])!
      engine.setTrillExtension(alone.id, 'none')
      const clip = copyElement(engine, { kind: 'trill', id: alone.id })!
      expect(clip).toMatchObject({ span: frac(0, 1), extension: 'none' })

      const pasted = idOf(pasteElement(engine, clip, {
        measure: 1, beat: frac(3, 1), staff: 0, noteId: ids[3],
      }))!
      expect(engine.getTrillById(pasted)?.extension, 'still a bare sign').toBe('none')
      expect(engine.getTrillById(pasted)?.endNoteId, 'and no end, which is the other half').toBeUndefined()
    })

    it('🚨⛔ REFUSES where the anchor names no NOTE — a trill is a sign ON a notehead', () => {
      // The slur's rule and its report: an address resolves forward until it finds music, so a paste
      // into an empty bar would ornament a note bars away.
      // ⚠️ This pins the OUTCOME, ⛔ not which guard produced it: the model refuses an unresolvable
      // start too, so the anchor check above it is belt-and-braces (break-tested — removing it keeps
      // this green). It stays because it states the RULE where the rule is decided.
      const clip = copyElement(engine, { kind: 'trill', id: trillId })!
      engine.addMeasure()
      const empty = engine.getScore().measures[engine.getScore().measures.length - 1].number
      expect(pasteElement(engine, clip, { measure: empty, beat: frac(0, 1), staff: 0 })).toBeNull()
      expect(engine.getTrills(), 'and nothing was written').toHaveLength(1)
    })

    it('⚠️ a note that ALREADY trills gives its own trill back — the add is idempotent', () => {
      const clip = copyElement(engine, { kind: 'trill', id: trillId })!
      const pasted = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(0, 1), staff: 0, noteId: ids[0] }))
      expect(pasted, 'the one that is already there').toBe(trillId)
      expect(engine.getTrills()).toHaveLength(1)
    })
  })

  /**
   * ⭐⭐ THE HAIRPIN (his ask, 2026-08-20) — the first clip that is not a POINT. A wedge is an amount
   * of music, so its LENGTH is part of what makes it the mark it is and travels with it; the mouth
   * and the end nudges do not, being overrides keyed to the copied wedge's own id
   * (*"we should not copy the override but probably we should copy the length"*, his words).
   */
  describe('a hairpin', () => {
    let wedgeId: string
    /** Every wedge in the score as `measure@beat:type/length`. */
    const wedges = () => engine.getScore().measures.flatMap(m =>
      (m.hairpins ?? []).map(h => `${m.number}@${fracToNumber(h.beat)}:${h.type}/${fracToNumber(h.length)}`))

    beforeEach(() => {
      engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
      wedgeId = engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
    })

    it('⭐⭐ copies the wedge WITH its length — a hairpin is an amount of music', () => {
      const clip = copyElement(engine, { kind: 'hairpin', id: wedgeId })
      expect(clip).toEqual({ kind: 'hairpin', type: 'cresc', length: frac(2, 1), placement: 'below' })
      expect(clip).not.toHaveProperty('id')
    })

    it('⛔ …and NOT the drawing: neither end nudge nor the hand-set mouth', () => {
      engine.nudgeHairpinEndpoint(wedgeId, 'end', 2, -1)
      engine.setHairpinAperture(wedgeId, 1.8)
      const clip = copyElement(engine, { kind: 'hairpin', id: wedgeId })!

      const pasted = pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 })
      expect(engine.getScore().engravingOverrides?.[idOf(pasted)!], 'the new wedge carries none')
        .toBeUndefined()
    })

    it('⭐ pastes at the anchor, keeping the extent', () => {
      const clip = copyElement(engine, { kind: 'hairpin', id: wedgeId })!
      pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 })
      expect(wedges()).toEqual(['1@0:cresc/2', '1@2:cresc/2'])
    })

    it('⭐ …and it is a NEW wedge every time, so one copy pastes many', () => {
      const clip = copyElement(engine, { kind: 'hairpin', id: wedgeId })!
      const first = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(1, 1), staff: 0 }))
      const second = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 }))
      expect(first).not.toBe(second)
      expect(first).not.toBe(wedgeId)
    })

    it('⭐ the SCOPE travels verbatim — an absent one stays absent (staff-wide)', () => {
      const scoped = engine.addHairpin(1, { type: 'dim', beat: frac(1, 1), length: frac(1, 1), voice: 2 })!
      expect(copyElement(engine, { kind: 'hairpin', id: scoped.id })).toMatchObject({ voice: 2 })
      expect(copyElement(engine, { kind: 'hairpin', id: wedgeId })).not.toHaveProperty('voice')
    })

    it('⛔ copies nothing for a wedge that is no longer in the score', () => {
      engine.removeHairpin(wedgeId)
      expect(copyElement(engine, { kind: 'hairpin', id: wedgeId })).toBeNull()
    })
  })

  /**
   * ⭐⭐ AN OTTAVA (his ask, 2026-08-21) — the wedge's chapter one lane over, with two differences
   * that are the bracket's own:
   *
   * ⭐⭐ `shift` is the WHOLE STATEMENT (size and side in one signed number), so there is no
   * `placement` to copy beside it — and no `voice` either, an octave line governing its whole staff.
   *
   * ⚠️ And a paste onto an occupied beat REPLACES rather than stacks: `addOttava`'s upsert, the
   * clef's rule (docs/ottava-plan.md §7.8), where two wedges may share a beat happily.
   */
  describe('an ottava', () => {
    let bracketId: string
    /** Every bracket in the score as `measure@beat:shift/length`. */
    const brackets = () => engine.getScore().measures.flatMap(m =>
      (m.ottavas ?? []).map(o => `${m.number}@${fracToNumber(o.beat)}:${o.shift}/${fracToNumber(o.length)}`))

    beforeEach(() => {
      engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
      bracketId = engine.addOttava(1, { shift: 1, beat: frac(0, 1), length: frac(2, 1) })!.id
    })

    it('⭐⭐ copies the bracket WITH its length — an octave line is an amount of music', () => {
      const clip = copyElement(engine, { kind: 'ottava', id: bracketId })
      expect(clip).toEqual({ kind: 'ottava', shift: 1, length: frac(2, 1) })
      expect(clip).not.toHaveProperty('id')
      // ⛔ No placement and no voice: the side is IN the shift, and the mark governs its whole staff.
      expect(clip).not.toHaveProperty('placement')
      expect(clip).not.toHaveProperty('voice')
    })

    it('⭐ the SHIFT travels — an 8vb pastes as an 8vb, a 15ma as a 15ma', () => {
      const low = engine.addOttava(2, { shift: -2, beat: frac(0, 1), length: frac(1, 1) })!
      const clip = copyElement(engine, { kind: 'ottava', id: low.id })!
      pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 })
      expect(brackets()).toContain('1@2:-2/1')
    })

    it('⭐ pastes at the anchor, keeping the extent', () => {
      const clip = copyElement(engine, { kind: 'ottava', id: bracketId })!
      pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 })
      expect(brackets()).toEqual(['1@0:1/2', '1@2:1/2'])
    })

    it('⭐ …and it is a NEW bracket every time, so one copy pastes many', () => {
      const clip = copyElement(engine, { kind: 'ottava', id: bracketId })!
      const first = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(1, 1), staff: 0 }))
      const second = idOf(pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 }))
      expect(first).not.toBe(second)
      expect(first).not.toBe(bracketId)
    })

    it('⚠️ a paste onto an occupied beat REPLACES — one octave line per (beat, staff)', () => {
      const clip = copyElement(engine, { kind: 'ottava', id: bracketId })!
      pasteElement(engine, clip, { measure: 1, beat: frac(0, 1), staff: 0 })
      expect(brackets(), 'one bracket, not two stacked').toEqual(['1@0:1/2'])
      expect(engine.getOttavaById(bracketId), 'and the copied one is the one replaced').toBeNull()
    })

    it('⛔ …and NOT the drawing: neither end nudge nor the shared height', () => {
      engine.nudgeOttavaEndpoint(bracketId, 'end', 2, 1)
      const clip = copyElement(engine, { kind: 'ottava', id: bracketId })!
      const pasted = pasteElement(engine, clip, { measure: 1, beat: frac(2, 1), staff: 0 })
      expect(engine.getScore().engravingOverrides?.[idOf(pasted)!], 'the new bracket carries none')
        .toBeUndefined()
    })

    it('⛔ copies nothing for a bracket that is no longer in the score', () => {
      engine.removeOttava(bracketId)
      expect(copyElement(engine, { kind: 'ottava', id: bracketId })).toBeNull()
    })
  })
})
