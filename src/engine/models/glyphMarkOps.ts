/**
 * GLYPH MARKS — the user's SYMBOLS on the score, as SCORE operations: add, remove, look up.
 * Free functions on a `Score`, in the `pedalOps` idiom (docs/plans/symbol-plan.md P0;
 * DESIGN-PRINCIPLES principle 5 — the score is independent of the editor, so none of this lives on
 * `MusicEngine`, and ⛔ no forwarder on `ScoreModel` either: a caller imports this module).
 *
 * A glyph mark is a SMuFL glyph anchored at a `(measure, beat, staff, voice)` address and meaning
 * nothing ({@link GlyphMark}). Its one rule of its own is the DYNAMIC'S, not the clef's: **any number
 * may share an address** — the same glyph twice included — so an add never replaces. Their stored
 * order at one beat is the order they were added (the beat sort is stable), and that order is the
 * stack the renderer draws outward from the staff.
 *
 * ⚠️ Re-anchoring across a re-bar is NOT here — that is `rebarOps`, which owns every beat-anchored
 * thing that has to survive the barlines moving (`captureBeatAnchors`). The same split as `pedalOps`.
 */
import type { Score, GlyphMark, Measure } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare } from '@/utils/fraction'
import { clearEngravingOverride } from './overrideOps'

/** A measure's glyph marks (the live array; empty if none), sorted by beat, added-order within one. */
export function measureGlyphMarks(measure: Measure): GlyphMark[] {
  return measure.glyphMarks ?? []
}

/**
 * Add a glyph mark at (`measureNumber`, `mark.beat`). `beat` must already be snapped to a slot
 * boundary by the caller, exactly as for a dynamic. A fresh id is generated.
 *
 * ⭐ **Never an upsert** — a mark already at this address stays, and the new one goes after it
 * (module header). The list is re-sorted by beat; `Array.prototype.sort` is stable, so marks sharing
 * a beat keep the order they were added in.
 *
 * Rejected (returns null) when the measure does not exist, or when `glyph` is empty: a mark with no
 * glyph draws nothing and could never be seen to be selected or deleted.
 */
export function addGlyphMark(score: Score, measureNumber: number, mark: Omit<GlyphMark, 'id'>): GlyphMark | null {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return null
  if (mark.glyph === '') return null

  const created: GlyphMark = { ...mark, id: uuidv4() }
  if (!measure.glyphMarks) measure.glyphMarks = []
  measure.glyphMarks.push(created)
  measure.glyphMarks.sort((a, b) => fracCompare(a.beat, b.beat))
  return created
}

/**
 * ⭐ **Add a glyph mark to the EVENT a selected note or rest belongs to** — what the Symbols window's
 * *Add symbol* does (docs/plans/symbol-plan.md P2). `noteId` is a chord's pitch id (any head of it: a
 * symbol is the chord's, plan §2) or a rest's slot id; the mark takes that slot's address — its measure,
 * beat, staff and voice — and is added like any other ({@link addGlyphMark}: never a replacement).
 *
 * Returns null when the id names no chord pitch or rest of a measure — ⛔ a grace note, a fanned
 * member or a bracketed grace is not an event on the staff's beat grid, so it is refused rather than
 * silently filed at its main note's beat.
 */
export function addGlyphMarkToEvent(score: Score, noteId: string, glyph: string): GlyphMark | null {
  for (const measure of score.measures) {
    const slot = measure.slots.find(s =>
      s.type === 'rest' ? s.id === noteId : s.notes.some(n => n.id === noteId))
    if (!slot) continue
    return addGlyphMark(score, measure.number, {
      glyph,
      beat: slot.beat,
      // Absent = voice 0 / the first staff — the write convention every slot already follows.
      ...(slot.voice ? { voice: slot.voice } : {}),
      ...(slot.staffId !== undefined ? { staffId: slot.staffId } : {}),
    })
  }
  return null
}

/**
 * Remove a glyph mark by id, deleting the array when it empties (an absent list and an empty one
 * must not both be reachable, or the JSON has two spellings of "none").
 *
 * Clears any engraving override keyed by that id on the way out — an override must not outlive its
 * anchor (the `removePedal` rule). Nothing writes one until P4; the call is here so it cannot orphan.
 * @returns true if a mark was removed.
 */
export function removeGlyphMark(score: Score, id: string): boolean {
  for (const measure of score.measures) {
    if (!measure.glyphMarks) continue
    const idx = measure.glyphMarks.findIndex(g => g.id === id)
    if (idx === -1) continue
    measure.glyphMarks.splice(idx, 1)
    if (measure.glyphMarks.length === 0) delete measure.glyphMarks
    clearEngravingOverride(score, id)
    return true
  }
  return false
}

/**
 * Flip a symbol to the other side of the staff — above ↔ below (the `x` key, plan P3). Absent means
 * ABOVE, so flipping back DELETES the field rather than writing `'above'`: one spelling per side.
 * @returns false when there is no such mark.
 */
export function flipGlyphMarkPlacement(score: Score, id: string): boolean {
  const mark = getGlyphMarkById(score, id)
  if (!mark) return false
  if (mark.placement === 'below') delete mark.placement
  else mark.placement = 'below'
  return true
}

/** Find a glyph mark anywhere in the score by id (live reference), or null. */
export function getGlyphMarkById(score: Score, id: string): GlyphMark | null {
  for (const measure of score.measures) {
    const found = measure.glyphMarks?.find(g => g.id === id)
    if (found) return found
  }
  return null
}

/** The measure a glyph mark is stored in (live reference), or null if no such mark exists. */
export function glyphMarkMeasure(score: Score, id: string): Measure | null {
  for (const measure of score.measures) {
    if (measure.glyphMarks?.some(g => g.id === id)) return measure
  }
  return null
}
