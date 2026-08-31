import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { dragTempo, tempoAnchorXOf } from './tempoDrag'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ⭐⭐ **THE TEMPO DRAG IS A SNAP** — his call, 2026-08-31: *"make the drag not a walk but anchor
 * when the mouse hit the next anchor point"*. The mark sits ON an anchor and has no in-between; the
 * hand carries that anchor point along, and reaching the next one re-anchors.
 *
 * Subject: {@link tempoDrag} — the module beside this file. ⚠️ These cases moved out of
 * `tempoWalk.test.ts` when the drag stopped being a walk, and every one of them was rewritten: the
 * old chapter asserted the OPPOSITE property (an offset interpolating between two onsets), which is
 * exactly what he asked to remove.
 *
 * The `MusicEngine` is real, but the REGISTRY is fabricated: the drag reads two drawn x's and a
 * staff-space size off the last render, and jsdom draws nothing
 * (`reference_jsdom_cannot_measure_glyphs`). The notes sit 100 px apart at 10 px per staff-space,
 * and the ENGRAVER's anchors are a separate table — that separation is the point, not tidiness
 * (`tempoAnchors.onsetAnchorX`: a downbeat mark anchors to the bar's TIME SIGNATURE, ⛔ never the
 * notehead).
 */
const drawn = vi.hoisted(() => ({
  entries: [] as { type: string; id?: string; staff?: number; bbox: { x: number; y: number; width: number; height: number }; staffSpacePx?: number }[],
  anchors: new Map<string, number>(),
  /** ⭐ The painted (system, staff) runs. One by default — nothing to jump to, so every case above
   *  is about the SNAP; the grand-staff chapter at the bottom sets its own. */
  runs: [] as { top: number; bottom: number; left: number; right: number; staff: number
    inkTop?: number; inkBottom?: number }[],
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      tempoAnchorX: (measure: number, beat: number) => drawn.anchors.get(`${measure}:${beat}`) ?? null,
      staffBands: () => drawn.runs.map(r => ({ top: r.top, bottom: r.bottom })),
      staffRuns: () => drawn.runs,
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('dragTempo', () => {
  let engine: MusicEngine
  let ids: string[]
  let markId: string

  const offsetX = () => tempoOffsetOverrideOf(engine.getScore(), markId)?.x ?? 0
  const offsetY = () => tempoOffsetOverrideOf(engine.getScore(), markId)?.y ?? 0
  /** Where the mark is anchored now, as `measure@beat`. */
  const at = () => {
    for (const measure of engine.getScore().measures) {
      const mark = measure.tempos?.find(t => t.id === markId)
      if (mark) return `${measure.number}@${fracToNumber(mark.beat)}`
    }
    return 'gone'
  }

  /** Four noteheads 100 px apart, and the drawn mark carrying the staff-space size. Pass `null` for
   *  a mark that carries none — ⚠️ NOT `undefined`, which the default would swallow.
   *  ⭐ The engraver's anchors land 5 px right of each notehead: 105, 205, 305, 405. */
  const render = (xs = [100, 200, 300, 400], staffSpacePx: number | null = 10) => {
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, staff: 0, bbox: { x: xs[i], y: 250, width: 10, height: 10 } }))
    drawn.entries.push({
      type: 'tempo', id: markId, bbox: { x: 0, y: 210, width: 40, height: 12 },
      ...(staffSpacePx === null ? {} : { staffSpacePx }),
    })
    drawn.anchors = new Map(xs.map((x, i) => [`1:${i}`, x + 5]))
    // One run: nothing to jump to, so every case here is about the SNAP.
    drawn.runs = [{ top: 240, bottom: 280, left: -Infinity, right: Infinity, staff: 0 }]
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    // Anchored on beat 1 — the engraver draws it at x 205, with a stop 100 px either side.
    markId = engine.addTempoMark(1, { beat: frac(1, 1), text: 'Allegro' })!.id
    render()
  })

  it('says where the mark’s anchor is drawn — the reference a gesture grabs against', () => {
    expect(tempoAnchorXOf(engine, markId)).toBe(205)
  })

  it('⭐⭐ keeps the ANCHOR until the hand reaches the next one', () => {
    // His rule, verbatim: *"till the beginning of the ink doesn't reach the next anchor point,
    // nothing; when it reaches it, re-anchor"* — about the ANCHOR, which is the model.
    for (const handX of [206, 250, 280, 304.9]) {
      dragTempo(engine, markId, handX, 0)
      expect(at(), `hand at ${handX}`).toBe('1@1')
    }
  })

  it('⭐⭐ …while the INK trails the hand the whole way (his ask, 2026-08-31)', () => {
    // *"we are not offsetting, so we must offset"*. The offset is `hand − anchor`, absolute, so the
    // drawn mark sits under the hand between two onsets instead of stopping dead at one.
    // ⛔ Nothing accumulates: each frame is computed from those two numbers alone.
    dragTempo(engine, markId, 250, 0)
    expect(offsetX(), '(250 − 205) / 10 px-per-space').toBeCloseTo(4.5, 6)
    dragTempo(engine, markId, 280, 0)
    expect(offsetX(), 'and again from scratch, ⛔ not 4.5 + 3').toBeCloseTo(7.5, 6)
    // ⭐ Going back is the same computation, so it cannot drift out of step with the hand.
    dragTempo(engine, markId, 206, 0)
    expect(offsetX()).toBeCloseTo(0.1, 6)
  })

  it('⭐⭐ …and re-anchors the moment it does, without the INK moving', () => {
    // ⭐⭐ The identity holds for FREE: the anchor grows by the gap and the offset shrinks by the
    //    gap in the same frame, because the offset is measured from the anchor rather than carried.
    //    ⛔ No re-base, which is what the old walk needed a whole mechanism for.
    dragTempo(engine, markId, 304.9, 0)
    const before = 304.9
    const frame = dragTempo(engine, markId, 305, 0)
    expect(frame?.moved).toBe(true)
    expect(at()).toBe('1@2')
    expect(offsetX(), 'offset zero at the new anchor').toBeCloseTo(0, 6)
    expect(frame?.inkPx, 'the drawn mark moved the tenth of a pixel the hand did')
      .toBeCloseTo(305 - before, 6)
  })

  it('⭐ one fast frame crosses every anchor the hand flew over', () => {
    // ⛔ Re-anchoring once per frame would leave the mark trailing the cursor by however many it
    //    skipped, which is the whole reason the snap loops.
    expect(dragTempo(engine, markId, 1000, 0)?.moved).toBe(true)
    expect(at()).toBe('1@3')
  })

  it('⭐ and it snaps backwards the same way', () => {
    expect(dragTempo(engine, markId, 105, 0)?.moved).toBe(true)
    expect(at()).toBe('1@0')
    // …then the ANCHOR stops at the front of the score rather than running off it — the ink still
    // trails, which is the offset's job and the page limit's to refuse.
    dragTempo(engine, markId, 55, 0)
    expect(at()).toBe('1@0')
    expect(offsetX(), 'the ink went where the hand did').toBeCloseTo(-5, 6)
  })

  it('⭐⭐ a re-anchor DROPS the sideways nudge and KEEPS the lift', () => {
    // The whole-stop write (`tempoOps.setTempoAtSlot`): the `x` said *"a little left of THAT
    // element"* and is stale the moment the mark is on another one; the `y` says how far off the
    // ladder's row it sits, which every row answers the same way. ⚠️ `y` is OUTWARD here (+up).
    engine.nudgeTempoOffset(markId, 3, 2)
    dragTempo(engine, markId, 305, 0)
    expect(at()).toBe('1@2')
    expect(offsetX(), 'the nudge went with the anchor').toBe(0)
    expect(offsetY(), 'the lift survives').toBeCloseTo(2)
  })

  it('🚨 refuses an anchor whose x runs the wrong way — two systems, two rulers', () => {
    render([100, 200, 20, 120])
    dragTempo(engine, markId, 1000, 0)
    expect(at(), 'the anchor stayed — the next stop in TIME is on another system').toBe('1@1')
  })

  it('⛔ …and stops at an onset another tempo mark is sitting on', () => {
    // One mark per beat: the model refuses the write, so the drag stops there — the same answer it
    // gives at the end of the score, and ⛔ never an overwrite.
    const other = engine.addTempoMark(1, { beat: frac(2, 1), text: 'Presto' })!.id
    dragTempo(engine, markId, 1000, 0)
    expect(at(), 'the anchor stopped at the taken beat').toBe('1@1')
    expect(engine.getTempoMarkById(other)).not.toBeNull()
  })

  it('⭐ the vertical is untouched by all this — a plain ink offset, and OUTWARD', () => {
    // ⚠️ The one conversion this mark needs: the cursor is screen-down and the model is +up.
    expect(dragTempo(engine, markId, 205, 30)?.moved).toBe(true)
    expect(offsetY(), 'dragging down is a NEGATIVE outward offset').toBeCloseTo(-3, 6)
    expect(at(), 'and the horizontal wrote nothing').toBe('1@1')
  })

  it('⭐ …and the lift survives a snap', () => {
    dragTempo(engine, markId, 205, -20)   // 2 spaces up
    dragTempo(engine, markId, 305, 0)     // one whole gap right → re-anchors
    expect(at()).toBe('1@2')
    expect(offsetY()).toBeCloseTo(2, 6)
  })

  it('⭐⭐ it is AUDIBLE — a re-anchor moves the tempo map', () => {
    engine.updateTempoMark(markId, { bpm: 144 })
    dragTempo(engine, markId, 305, 0)
    expect(engine.getEffectiveTempoAt(1, frac(2, 1))).toBe(144)
    expect(engine.getEffectiveTempoAt(1, frac(1, 1))).not.toBe(144)
  })

  it('⭐ a drag frame records NO undo entry — the drop commits the whole gesture once', () => {
    dragTempo(engine, markId, 305, 0)
    engine.undo()
    expect(at(), 'the undo took back the mark itself, so the frame pushed nothing').toBe('gone')
  })

  it('🚨🚨 an EMPTIED bar has ONE x for every beat — and the ink still follows the hand', () => {
    // ⭐⭐ **His report, 2026-08-31**, after clearing a measure: an empty bar's onsets all land on the
    // same column, which his log says outright —
    //   `[tempo-anchors] m2: 6 of 6 beats (columns) | 0@539 0.25@539 1@539`
    // The snap has nothing to reach (a next stop whose x is not AHEAD is not one ruler's worth of
    // travel, so it breaks out), and before the offset existed the mark stopped dead there: measured,
    // `hand 541.4 reached the next anchor 538.9` and then silence while the hand ran on to 657 —
    // 116 px behind. ⭐ The trail is the whole of the gesture here.
    drawn.anchors = new Map([['1:0', 105], ['1:1', 205], ['1:2', 205], ['1:3', 205]])
    dragTempo(engine, markId, 400, 0)
    expect(at(), 'nothing AHEAD to snap to — the anchor stays').toBe('1@1')
    expect(offsetX(), 'and the ink is under the hand: (400 − 205) / 10').toBeCloseTo(19.5, 6)
  })

  it('🚨🚨 …and the drag CROSSES that bar — the next anchor point is the next COLUMN', () => {
    // ⭐⭐ **His report with the picture, 2026-08-31**: *"when is a measure with no music it offset,
    // and this is corect… but it does not find the next anchor point in measure 3"*. The mark hung
    // two bars right of the bar it was still anchored in.
    //
    // The old rule ended the search at the first stop whose x was not strictly ahead — which the
    // emptied bar's SECOND onset already is. Beats 1 and 2 share a column (his `0@539 0.25@539`),
    // so they are one anchor point, and the one after it is beat 3.
    drawn.anchors = new Map([['1:0', 105], ['1:1', 205], ['1:2', 205], ['1:3', 405]])
    dragTempo(engine, markId, 404.9, 0)
    expect(at(), 'the hand is short of the next COLUMN, and beat 2 is not one of its own').toBe('1@1')
    dragTempo(engine, markId, 405, 0)
    expect(at(), 'reaching it re-anchors — ⛔ never to a beat inside the column it stepped over')
      .toBe('1@3')
    expect(offsetX(), 'and the ink did not move: the offset shrank by the gap the anchor grew by')
      .toBeCloseTo(0, 6)
  })

  it('⛔ the drag DECLINES (null) when the mark is not drawn — ⚠️ null, not false', () => {
    render([100, 200, 300, 400], null)
    expect(dragTempo(engine, markId, 1000, 0)).toBeNull()
    expect(at()).toBe('1@1')
  })
})

/**
 * 🚨🚨 **THE GRAND STAFF, AND HIS REPORT OF 2026-08-31**: *"look where my mouse is and the tempo have
 * not go to the next system"* — dragging straight down over 460 px and the mark never leaving system
 * 1, its vertical apparently dead.
 *
 * ⭐⭐ **The numbers below are his**, off the Prelude: treble 276…316 and bass 404…444 on system 1,
 * the mark engraved 43 px above its own top line. `staffRuns()` lists a run per (system, STAFF), and
 * the shared natural-home rule then read the bass of the SAME system as somewhere the mark could go —
 * it fired at 70 px of lift, re-anchored to a bass-only onset, zeroed the lift, and the snap handed
 * it straight back. Fourteen times in one gesture.
 *
 * ⭐ A tempo mark has no staff: it is engraved once per system above the top one, so its bands are
 * SYSTEMS. ⛔ That is this family's own filter and ⛔ not a change to the shared rule — five other
 * families read staves because they have a rung on each.
 */
describe('dragTempo — the vertical, on a grand staff', () => {
  let engine: MusicEngine
  let markId: string

  const at = () => {
    for (const measure of engine.getScore().measures) {
      const mark = measure.tempos?.find(t => t.id === markId)
      if (mark) return `${measure.number}@${fracToNumber(mark.beat)}`
    }
    return 'gone'
  }
  const offsetY = () => tempoOffsetOverrideOf(engine.getScore(), markId)?.y ?? 0

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addMeasure()
    // Bar 1 on system 1, bar 2 on system 2 — one onset each, and a BASS-ONLY onset in bar 1 so the
    // old rule has something to land on (it is what his log picked).
    const n1 = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })!
    const n2 = engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    markId = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro' })!.id

    drawn.entries = [
      { type: 'note', id: n1.id, staff: 0, bbox: { x: 150, y: 296, width: 10, height: 10 } },
      { type: 'note', id: n2.id, staff: 0, bbox: { x: 150, y: 580, width: 10, height: 10 } },
      // The mark's own ink: 43 px above system 1's top line, his measurement.
      { type: 'tempo', id: markId, bbox: { x: 150, y: 227, width: 40, height: 12 }, staffSpacePx: 10 },
    ]
    drawn.anchors = new Map([['1:0', 150], ['2:0', 150]])
    drawn.runs = [
      { top: 276, bottom: 316, left: 100, right: 700, staff: 0, inkTop: 271, inkBottom: 340 },
      { top: 404, bottom: 444, left: 100, right: 700, staff: 1, inkTop: 346, inkBottom: 444 },
      { top: 560, bottom: 600, left: 100, right: 700, staff: 0, inkTop: 555, inkBottom: 624 },
      { top: 688, bottom: 728, left: 100, right: 700, staff: 1, inkTop: 630, inkBottom: 728 },
    ]
  })

  it('🚨🚨 does NOT hand the mark to the staff BELOW it in its own system', () => {
    // 70 px down puts the ink at 303 — past halfway between its home (233) and where it would sit
    // under the bass staff (361), which is exactly where his drag died.
    dragTempo(engine, markId, 150, 70)
    expect(at(), 'it is still anchored where it was').toBe('1@0')
    expect(offsetY(), 'and the lift was written — the vertical is the whole gesture here')
      .toBeCloseTo(-7, 6)
  })

  it('⭐⭐ …and DOES hand it to the next SYSTEM once the ink belongs there', () => {
    // System 2's top line is 560, so the mark's home there is 517; halfway from 233 is 375.
    expect(dragTempo(engine, markId, 150, 330)?.moved).toBe(true)
    expect(at()).toBe('2@0')
    expect(offsetY(), '⭐ a jump lands the mark where the ENGRAVER would put it').toBe(0)
  })

  it('⭐ the lift ACCUMULATES on the way down instead of springing back', () => {
    // ⛔ The bug's real signature: his log rebuilt the same 70 px fourteen times because every
    //    hand-over zeroed it. Four frames of 15 px is 60 px of lift, and no hand-over at all.
    for (let i = 0; i < 4; i++) dragTempo(engine, markId, 150, 15)
    expect(at()).toBe('1@0')
    expect(offsetY()).toBeCloseTo(-6, 6)
  })
})
