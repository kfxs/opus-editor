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
    lineYPositions: [40, 50, 60, 70, 80],
    lineSpacing: 10,
    noteStartX: 50,
    noteEndX: 450,
    clef: 'treble',
  }
  const m2Geometry: StaffGeometry = {
    measure: 2,
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
