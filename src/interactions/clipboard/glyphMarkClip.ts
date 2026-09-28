/**
 * ⭐ **THE USER'S SYMBOLS TRAVEL WITH THEIR EVENT** (docs/plans/symbol-plan.md P5) — the glissando's
 * arrangement (`./glissandoClip`): a symbol is copied because the note or rest it stands on is, ⛔ not
 * because it was picked into the mark selection. It belongs to its event the way an articulation does,
 * so a copied passage carries the symbols of the events it carries — and only those.
 */
import type { EngravingOverride, Fraction, GlyphMark, Measure, Score } from '@/types/music'
import type { ClipGlyphMark } from '@/utils/clip'
import { measureStartOffsets as measureStarts } from '@/utils/measureCapacity'
import { fracAdd, fracCompare, fracSub } from '@/utils/fraction'
import { matchesStaff, staffIndexOfId } from '@/engine/models/staffContent'

/**
 * ⭐ THE ONE RULE for "does this symbol come with these notes?" — its EVENT (the slot at its beat, voice and
 * staff) holds one of `ids` (chord pitch ids, rest slot ids). The copy asks it ({@link glyphMarksOnCopiedEvents})
 * and so does the passage box (`./enclosedMarks.marksInBox`): the highlight promises exactly what the copy takes.
 */
export function glyphMarksOnEvents(score: Score, ids: ReadonlySet<string>): { measure: Measure; mark: GlyphMark }[] {
  const out: { measure: Measure; mark: GlyphMark }[] = []
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    for (const g of m.glyphMarks ?? []) {
      const voice = g.voice ?? 0
      const event = m.slots.find(s =>
        fracCompare(s.beat, g.beat) === 0 && (s.voice ?? 0) === voice && matchesStaff(s.staffId, g.staffId, score))
      if (!event) continue
      const eventIds = event.type === 'rest' ? [event.id] : event.notes.map(n => n.id)
      if (eventIds.some(id => ids.has(id))) out.push({ measure: m, mark: g })
    }
  }
  return out
}

/**
 * Every symbol whose event holds a copied note or rest (`copied` — chord pitch ids and rest slot ids),
 * as {@link ClipGlyphMark}s re-based to the copy: staff relative to `topStaff`, offset from `spanStart`.
 */
export function glyphMarksOnCopiedEvents(
  score: Score,
  copied: ReadonlySet<string>,
  topStaff: number,
  spanStart: Fraction,
): ClipGlyphMark[] {
  const starts = measureStarts(score.measures)
  const out: ClipGlyphMark[] = []
  for (const { measure, mark: g } of glyphMarksOnEvents(score, copied)) {
    const mStart = starts.get(measure.number)
    if (!mStart) continue
    const held: EngravingOverride[] | undefined = score.engravingOverrides?.[g.id]
    out.push({
      staff: staffIndexOfId(score, g.staffId) - topStaff,
      voice: g.voice ?? 0,
      offset: fracSub(fracAdd(mStart, g.beat), spanStart),
      glyph: g.glyph,
      ...(g.placement !== undefined ? { placement: g.placement } : {}),
      ...(held?.length ? { engraving: held.map(o => ({ ...o })) } : {}),
    })
  }
  return out
}
