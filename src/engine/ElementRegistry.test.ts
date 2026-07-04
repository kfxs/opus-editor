import { describe, it, expect, beforeEach } from 'vitest'
import { ElementRegistry, type StaffGeometry } from './ElementRegistry'

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
