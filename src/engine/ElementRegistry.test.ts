import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ElementRegistry, type StaffGeometry } from './ElementRegistry'
import { setDebugLogging } from '@/utils/debug'

/**
 * Regression coverage for selection hit-detection: selecting a note/rest or a tuplet
 * must not be scoped to the click's vertical staff band. A note whose head is drawn
 * far from its staff (ledger lines) — or a tuplet bracket above the staff — is
 * rendered into a neighbouring band, so a measure-restricted search used to miss it
 * ("Selection cleared (too far from element)"). The hit-test now scans all measures
 * and uses each element's own measure geometry for its true rendered Y.
 */
describe('ElementRegistry selection hit-detection', () => {
  let registry: ElementRegistry

  // Two systems (lines), each one measure. Treble clef: G4 (MIDI 67) sits on line 3.
  const m1Geometry: StaffGeometry = {
    measure: 1,
    staff: 0,
    lineYPositions: [40, 50, 60, 70, 80],
    lineSpacing: 10,
    noteStartX: 50,
    noteEndX: 450,
    clef: 'treble',
  }
  const m2Geometry: StaffGeometry = {
    measure: 2,
    staff: 0,
    lineYPositions: [190, 200, 210, 220, 230],
    lineSpacing: 10,
    noteStartX: 50,
    noteEndX: 450,
    clef: 'treble',
  }

  beforeEach(() => {
    registry = new ElementRegistry()
    registry.setStaffGeometry(m1Geometry)
    registry.setStaffGeometry(m2Geometry)
  })

  describe('findClosestNoteOrRest', () => {
    it('selects a high note drawn above its staff (its head is outside the staff band)', () => {
      // C6 (MIDI 84) in measure 1 renders at y=20 — above the top staff line (40).
      registry.add({
        type: 'note', id: 'high', measure: 1, beat: 0, pitch: 84,
        bbox: { x: 90, y: 20, width: 20, height: 60 },
      })
      // A note one system down sharing the same X column — must not win.
      registry.add({
        type: 'note', id: 'lower-system', measure: 2, beat: 0, pitch: 67,
        bbox: { x: 90, y: 200, width: 20, height: 40 },
      })

      const hit = registry.findClosestNoteOrRest(100, 20)
      expect(hit?.id).toBe('high')
    })

    it('disambiguates chord notes (shared bbox) by pitch-derived Y', () => {
      // Two pitches in one slot share the same staveNote bbox.
      const sharedBbox = { x: 190, y: 50, width: 20, height: 40 }
      registry.add({ type: 'note', id: 'E4', measure: 1, beat: 0, pitch: 64, bbox: sharedBbox }) // y≈80
      registry.add({ type: 'note', id: 'C5', measure: 1, beat: 0, pitch: 72, bbox: sharedBbox }) // y≈55

      expect(registry.findClosestNoteOrRest(200, 80)?.id).toBe('E4')
      expect(registry.findClosestNoteOrRest(200, 55)?.id).toBe('C5')
    })

    it('returns null when no element is within the X tolerance', () => {
      registry.add({
        type: 'note', id: 'n', measure: 1, beat: 0, pitch: 67,
        bbox: { x: 90, y: 60, width: 20, height: 40 },
      })
      expect(registry.findClosestNoteOrRest(300, 70)).toBeNull()
    })

    it('falls back to bbox center for rests (no pitch)', () => {
      registry.add({
        type: 'rest', id: 'r', measure: 2, beat: 0,
        bbox: { x: 90, y: 200, width: 20, height: 30 },
      })
      // bbox center is (100, 215); a click there selects it across measures.
      expect(registry.findClosestNoteOrRest(100, 215)?.id).toBe('r')
    })
  })

  describe('getTupletAt', () => {
    it('finds a tuplet bracket by containment regardless of measure band', () => {
      registry.add({
        type: 'tuplet', tupletId: 't1', measure: 2,
        bbox: { x: 60, y: 170, width: 120, height: 20 },
      })
      // Bracket sits above measure 2's staff (top line 190); containment still resolves it.
      const hit = registry.getTupletAt(100, 180)
      expect(hit?.tupletId).toBe('t1')
    })

    it('returns null when the point is outside every tuplet bbox', () => {
      registry.add({
        type: 'tuplet', tupletId: 't1', measure: 1,
        bbox: { x: 60, y: 20, width: 120, height: 20 },
      })
      expect(registry.getTupletAt(400, 300)).toBeNull()
    })
  })
})

/**
 * Multi-staff (Phase 2): geometry is keyed by (measure, staff), so ONE measure holds a
 * separate lane per stacked staff. A click's staff is resolved by its Y-band, and pitch↔y
 * runs against that staff's OWN clef/lines — a bass second staff resolves differently from
 * the treble first at the same pixel Y.
 */
describe('ElementRegistry multi-staff geometry', () => {
  let registry: ElementRegistry

  // One system, two staves stacked. Staff 0 treble (lines 40..80), staff 1 bass (190..230).
  const staff0: StaffGeometry = {
    measure: 1, staff: 0,
    lineYPositions: [40, 50, 60, 70, 80], lineSpacing: 10,
    noteStartX: 50, noteEndX: 450, clef: 'treble',
  }
  const staff1: StaffGeometry = {
    measure: 1, staff: 1,
    lineYPositions: [190, 200, 210, 220, 230], lineSpacing: 10,
    noteStartX: 50, noteEndX: 450, clef: 'bass',
  }

  beforeEach(() => {
    registry = new ElementRegistry()
    registry.setStaffGeometry(staff0)
    registry.setStaffGeometry(staff1)
  })

  it('keeps a separate geometry per staff of the same measure', () => {
    expect(registry.getStaffGeometry(1, 0)?.clef).toBe('treble')
    expect(registry.getStaffGeometry(1, 1)?.clef).toBe('bass')
    // Default arg resolves to staff 0 (the N=1 convention).
    expect(registry.getStaffGeometry(1)?.clef).toBe('treble')
  })

  describe('staffIndexAtY', () => {
    it('resolves a click inside each staff band to that staff', () => {
      expect(registry.staffIndexAtY(1, 60)).toBe(0)  // middle of staff 0
      expect(registry.staffIndexAtY(1, 210)).toBe(1) // middle of staff 1
    })
    it('resolves a click above the top staff to staff 0', () => {
      expect(registry.staffIndexAtY(1, 10)).toBe(0)
    })
    it('resolves a click in the gap to the nearer staff', () => {
      expect(registry.staffIndexAtY(1, 100)).toBe(0) // 20 below staff0, 90 above staff1
      expect(registry.staffIndexAtY(1, 170)).toBe(1) // 90 below staff0, 20 above staff1
    })
    it('falls back to 0 for a measure with no geometry', () => {
      expect(registry.staffIndexAtY(99, 500)).toBe(0)
    })
  })

  describe('per-staff pitch↔y', () => {
    it('resolves the same Y to different pitches per staff clef', () => {
      // Staff 0 line 3 (y=70) is treble G4; staff 1 line 3 (y=220) is bass B2.
      const treblePitch = registry.pixelYToPitch(70, 1, undefined, 0)
      const bassPitch = registry.pixelYToPitch(220, 1, undefined, 1)
      expect(treblePitch).toEqual({ step: 'G', alter: 0, octave: 4 })
      expect(bassPitch).toEqual({ step: 'B', alter: 0, octave: 2 })
    })

    it('pitchToPixelY uses the requested staff geometry', () => {
      // Treble G4 (67) → staff 0 line 3 = y70; bass F3 (53) → staff 1 line 1 = y200.
      expect(registry.pitchToPixelY(67, 1, undefined, 0)).toBe(70)
      expect(registry.pitchToPixelY(53, 1, undefined, 1)).toBe(200)
    })
  })

  it('findClosestNoteOrRest computes a note Y from its own staff geometry', () => {
    // A bass-clef note on staff 1: F3 (53) draws at staff-1 line 1 (y=200), NOT where
    // staff-0 treble geometry would put it. A click there must select it.
    registry.add({
      type: 'note', id: 'bassF3', measure: 1, staff: 1, beat: 0, pitch: 53,
      bbox: { x: 90, y: 190, width: 20, height: 40 },
    })
    expect(registry.findClosestNoteOrRest(100, 200)?.id).toBe('bassF3')
  })
})

/**
 * The §6a-ii RESULT tripwire (docs/history/tight-bbox-plan.md): a glyph-type box that is
 * implausibly tall for its staff means a caller registered a container-union box
 * (a StaveNote that unioned an attached dynamic) instead of the leaf glyph — the
 * flagship inflated-rest bug. It dev-warns so a future re-introduction is caught.
 *
 * jsdom has no canvas metrics, so a real render never trips this in unit tests; here
 * we feed synthetic boxes + geometry so the guard's arithmetic is exercised directly.
 */
describe('ElementRegistry §6a-ii glyph-height tripwire', () => {
  let registry: ElementRegistry
  let warn: ReturnType<typeof vi.spyOn>

  // lineSpacing 10 → the threshold (6 staff-spaces) is 60px.
  const geometry: StaffGeometry = {
    measure: 1,
    staff: 0,
    lineYPositions: [40, 50, 60, 70, 80],
    lineSpacing: 10,
    noteStartX: 50,
    noteEndX: 450,
    clef: 'treble',
  }

  beforeEach(() => {
    // Spy BEFORE enabling: setDebugLogging binds console.log by value, so the spy must
    // already be in place or dbg would hold the original (unspied) console.log.
    warn = vi.spyOn(console, 'log').mockImplementation(() => {})
    setDebugLogging(true) // dbg → console.log; the tripwire is silent otherwise
    registry = new ElementRegistry()
    registry.setStaffGeometry(geometry)
  })

  afterEach(() => {
    warn.mockRestore()
    setDebugLogging(false)
  })

  const fired = () => warn.mock.calls.some((args: unknown[]) => String(args[0]).includes('[hit-box]'))

  it('fires when a rest box is a container-union (spans down to a below-staff dynamic)', () => {
    registry.add({
      type: 'rest', id: 'inflated', measure: 1, staff: 0, beat: 0,
      bbox: { x: 90, y: 79, width: 11, height: 77 }, // 7.7 staff-spaces → over 6
    })
    expect(fired()).toBe(true)
  })

  it('stays silent for a tight rest glyph', () => {
    registry.add({
      type: 'rest', id: 'tight', measure: 1, staff: 0, beat: 0,
      bbox: { x: 90, y: 55, width: 11, height: 10 }, // ~1 staff-space
    })
    expect(fired()).toBe(false)
  })

  it('exempts region/semantic types (a note keeps a tall semantic head box)', () => {
    registry.add({
      type: 'note', id: 'note-with-dyn', measure: 1, staff: 0, beat: 0, pitch: 67,
      bbox: { x: 90, y: 20, width: 20, height: 120 }, // 12 staff-spaces, but 'note' is exempt
    })
    expect(fired()).toBe(false)
  })

  it('stays silent when the element has no registered geometry (can not reason about scale)', () => {
    registry.add({
      type: 'rest', id: 'no-geom', measure: 99, staff: 0, beat: 0,
      bbox: { x: 90, y: 0, width: 11, height: 500 },
    })
    expect(fired()).toBe(false)
  })
})

/**
 * The STEM as its own registered element (docs/plans/tremolo-plan.md §2). A tremolo's strokes ride the
 * stem, so the stem is where the pointer goes — and the note's own box cannot answer "where is the
 * stem", since it spans head + stem + beam by design. These pin the finder, not the geometry: what
 * the renderer writes into the rect comes from VexFlow (`getStemX` / `getStemExtents`).
 */
describe('ElementRegistry stem hit-detection', () => {
  let registry: ElementRegistry

  const geometry: StaffGeometry = {
    measure: 1, staff: 0,
    lineYPositions: [40, 50, 60, 70, 80], lineSpacing: 10,
    noteStartX: 50, noteEndX: 450, clef: 'treble',
  }

  beforeEach(() => {
    registry = new ElementRegistry()
    registry.setStaffGeometry(geometry)
  })

  /** A stem-up G4 at x=106: head on the line at y=70, tip at y=35. */
  const addStemUpNote = (id: string, headX: number) => {
    registry.add({
      type: 'note', id, measure: 1, staff: 0, beat: 0, pitch: 67,
      bbox: { x: headX - 10, y: 35, width: 20, height: 40 }, headX,
    })
    registry.add({
      type: 'stem', noteId: id, measure: 1, staff: 0, beat: 0,
      bbox: { x: headX + 6, y: 35, width: 1.5, height: 35 },
    })
  }

  it('resolves a click on the stem to the note the stem belongs to', () => {
    addStemUpNote('n1', 100)
    expect(registry.findStemAt(107, 45)?.noteId).toBe('n1')
  })

  it('is what makes the click work: the notehead test refuses the same point', () => {
    addStemUpNote('n1', 100)
    const note = registry.getById('n1')!
    expect(registry.hitsNoteOrRestBody(note, 107, 45)).toBe(false)
  })

  it('pads the 1.5px line so it is actually clickable, but not by half a notehead', () => {
    addStemUpNote('n1', 100)
    expect(registry.findStemAt(103, 45)?.noteId).toBe('n1')  // 3px left of the ink
    expect(registry.findStemAt(94, 45)).toBeNull()            // 12px away → the head's territory
  })

  it('does not reach past the stem tip or below the notehead', () => {
    addStemUpNote('n1', 100)
    expect(registry.findStemAt(107, 20)).toBeNull()  // above the tip
    expect(registry.findStemAt(107, 90)).toBeNull()  // below the head
  })

  it('beats nearest-note: a click high on a stem stays on ITS note, not a closer neighbour head', () => {
    addStemUpNote('n1', 100)
    // A high neighbour whose HEAD (y=20) is nearer to (107,40) than n1's head (y=70) is.
    registry.add({
      type: 'note', id: 'high', measure: 1, staff: 0, beat: 1, pitch: 84,
      bbox: { x: 110, y: 20, width: 20, height: 45 }, headX: 120,
    })
    expect(registry.findClosestNoteOrRest(107, 40)?.id).toBe('high') // nearest is the WRONG answer…
    expect(registry.findStemAt(107, 40)?.noteId).toBe('n1')          // …containment is the right one
  })

  it('a stem never answers a lookup for its note (it carries noteId, not id)', () => {
    addStemUpNote('n1', 100)
    expect(registry.getById('n1')?.type).toBe('note')
    expect(registry.getByType('stem')[0].id).toBeUndefined()
  })
})

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — HOW FAR A PAINTED STAFF'S OWN MUSIC REACHES**, which is what a
 * mark dragged into the white space between two staves is judged against (`interactions/
 * markSystemJump`). His call, on an 8va left sitting on the lower staff's stems: *"as the ottava
 * alta is more closer to the upper element of the down staff … we should reanchor"*.
 */
describe('ElementRegistry.staffRuns — the run’s own ink', () => {
  const geometry = (measure: number, staff: number, top: number): StaffGeometry => ({
    measure, staff, lineYPositions: [top, top + 10, top + 20, top + 30, top + 40],
    lineSpacing: 10, noteStartX: 50, noteEndX: 450, clef: 'treble',
  })

  it('⭐ the five lines are the FLOOR — a staff with no music still occupies itself', () => {
    const registry = new ElementRegistry()
    registry.setStaffGeometry(geometry(1, 0, 40))
    registry.setStaffGeometry(geometry(1, 1, 240))
    expect(registry.staffRuns().map(r => [r.inkTop, r.inkBottom])).toEqual([[40, 80], [240, 280]])
  })

  it('⭐⭐ …and the music stretches it: a stem reaching up out of the staff is that staff’s ink', () => {
    const registry = new ElementRegistry()
    registry.setStaffGeometry(geometry(1, 0, 40))
    registry.setStaffGeometry(geometry(1, 1, 240))
    // A left-hand note whose box (stem included — a registered note carries the whole StaveNote's)
    // reaches 30 px above its own top line.
    registry.add({ type: 'note', id: 'lh', measure: 1, staff: 1, beat: 0, pitch: 48,
      bbox: { x: 100, y: 210, width: 10, height: 60 } })
    const lower = registry.staffRuns().find(r => r.staff === 1)!
    expect(lower.inkTop, 'up into the white space').toBe(210)
    expect(lower.inkBottom, '⛔ never inside the lines — the floor still holds').toBe(280)
  })

  it('⛔ a MARK’s own box is not the staff’s ink — a dragged bracket may never carry the boundary', () => {
    const registry = new ElementRegistry()
    registry.setStaffGeometry(geometry(1, 0, 40))
    registry.setStaffGeometry(geometry(1, 1, 240))
    registry.add({ type: 'ottava', id: '8va', measure: 1, staff: 1,
      bbox: { x: 100, y: 120, width: 200, height: 10 } })
    expect(registry.staffRuns().find(r => r.staff === 1)!.inkTop).toBe(240)
  })

  it('⭐ each RUN is measured on its own bars — a second system does not lend its ink to the first', () => {
    const registry = new ElementRegistry()
    registry.setStaffGeometry(geometry(1, 0, 40))
    registry.setStaffGeometry(geometry(2, 0, 240))
    registry.add({ type: 'note', id: 'n2', measure: 2, staff: 0, beat: 0, pitch: 72,
      bbox: { x: 100, y: 200, width: 10, height: 60 } })
    const [first, second] = registry.staffRuns()
    expect([first.inkTop, first.inkBottom], 'bar 1 drew no notes').toEqual([40, 80])
    expect([second.inkTop, second.inkBottom]).toEqual([200, 280])
  })
})

describe('ElementRegistry tempo anchors — capture and replay', () => {
  it('⭐ a bar’s anchors come back when the bar is REUSED rather than redrawn', () => {
    const registry = new ElementRegistry()
    registry.registerTempoAnchors(2, [{ beat: 0, x: 400 }, { beat: 0.25, x: 430 }])
    const captured = registry.tempoAnchorsOf(2)

    // What a render does: wipe the lot, then replay the bars it chose not to draw.
    registry.clear()
    expect(registry.tempoAnchorX(2, 0), 'the wipe really did take them').toBeNull()
    registry.addTempoAnchors(2, captured)
    expect(registry.tempoAnchorX(2, 0)).toBe(400)
    expect(registry.tempoAnchorX(2, 0.25)).toBe(430)
  })

  it('⭐ a reused bar that MOVED carries its anchors with it — dx, measured from where it was drawn', () => {
    const registry = new ElementRegistry()
    registry.registerTempoAnchors(2, [{ beat: 0, x: 400 }])
    const captured = registry.tempoAnchorsOf(2)
    registry.clear()
    registry.addTempoAnchors(2, captured, -60)
    expect(registry.tempoAnchorX(2, 0)).toBe(340)
    // ⛔ Twice from the SAME capture is the same answer — the snapshot is never mutated, so a bar
    //    that moves on every frame of a drag accumulates nothing.
    registry.clear()
    registry.addTempoAnchors(2, captured, -60)
    expect(registry.tempoAnchorX(2, 0)).toBe(340)
  })

  it('⛔ the capture is one bar’s, and ⛔ a replay never re-scales what is already in page space', () => {
    const registry = new ElementRegistry()
    registry.withScale(0.5, () => registry.registerTempoAnchors(2, [{ beat: 0, x: 400 }]))
    registry.registerTempoAnchors(3, [{ beat: 0, x: 900 }])
    expect(registry.tempoAnchorsOf(2), 'the staff’s scale is applied ONCE, at registration')
      .toEqual([{ beat: 0, x: 200 }])
    const captured = registry.tempoAnchorsOf(2)
    registry.clear()
    registry.withScale(0.5, () => registry.addTempoAnchors(2, captured))
    expect(registry.tempoAnchorX(2, 0), '⛔ not 100 — the replay is not a registration').toBe(200)
  })
})

/**
 * ⭐⭐ **THE TWO ENDS OF AN ATTACHMENT GUIDE MOVE FOR DIFFERENT REASONS**, and the registry is where
 * that distinction is enforced: `shiftById` is *the element moved*, `repointGuidesById` is *what it
 * hangs off moved*.
 *
 * 🚨 His report, 2026-08-31, on the tempo mark's snap drag: *"the anchor line is not updating during
 * the drag"*. The drag hands the mark to the next onset, so the place it points at genuinely moves —
 * and every pass a preview may run could only reach the `from` end.
 */
describe('ElementRegistry guides — which end a move is allowed to touch', () => {
  const withGuide = () => {
    const registry = new ElementRegistry()
    registry.add({ type: 'tempo', id: 'T1', bbox: { x: 100, y: 50, width: 40, height: 12 },
      guides: [{ from: { x: 100, y: 62 }, to: { x: 100, y: 120 } }] })
    return registry
  }

  it('⛔ shiftById moves the element’s end and LEAVES the anchor — the guide stretches', () => {
    const registry = withGuide()
    registry.shiftById('T1', 30, 0)
    const [guide] = registry.getById('T1')!.guides!
    expect(guide.from.x, 'the ink travelled').toBe(130)
    expect(guide.to.x, 'and the thing it hangs off did not').toBe(100)
  })

  it('⭐⭐ repointGuidesById moves the ANCHOR’s end and leaves the ink', () => {
    const registry = withGuide()
    registry.repointGuidesById('T1', 100)
    const [guide] = registry.getById('T1')!.guides!
    expect(guide.to.x).toBe(200)
    expect(guide.from.x, 'the ink is the transform’s business, ⛔ not this one’s').toBe(100)
    expect(registry.getById('T1')!.bbox.x, 'and so is the box').toBe(100)
  })

  it('⭐ …in LOCAL pixels, so a reduced staff is scaled the same way the box is', () => {
    const registry = new ElementRegistry()
    registry.withScale(0.5, () => registry.add({ type: 'tempo', id: 'T2',
      bbox: { x: 100, y: 50, width: 40, height: 12 },
      guides: [{ from: { x: 100, y: 62 }, to: { x: 100, y: 120 } }] }))
    registry.withScale(0.5, () => registry.repointGuidesById('T2', 100))
    // Registered at half scale (to.x 50), then moved by 100 local px = 50 page px.
    expect(registry.getById('T2')!.guides![0].to.x).toBe(100)
  })

  it('⛔ says nothing about an element that draws no guide', () => {
    const registry = new ElementRegistry()
    registry.add({ type: 'tempo', id: 'T3', bbox: { x: 0, y: 0, width: 1, height: 1 } })
    expect(() => registry.repointGuidesById('T3', 10)).not.toThrow()
    expect(() => registry.repointGuidesById('nope', 10)).not.toThrow()
  })
})
