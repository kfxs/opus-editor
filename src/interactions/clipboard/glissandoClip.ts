/**
 * ⭐ **THE GLISSANDI A COPY CARRIES** — every glissando whose ANCHOR note is inside the copy window, as a
 * {@link ClipGlissando} (his call, 2026-09-25: copy/paste carries a glissando — *"of course yes"*).
 *
 * ⭐ It travels with its NOTE, like a tie, ⛔ not with the mark selection (`clipboard`'s `wanted` filter): a
 * glissando is something its head carries, and it is not a selectable mark yet. Only the anchor is
 * addressed — the far end is derived again wherever it lands (docs/plans/glissando-plan.md G4).
 */
import type { EngravingOverride, Fraction, Score } from '@/types/music'
import type { ClipGlissando } from '@/utils/clip'
import { measureStartOffsets as measureStarts } from '@/utils/measureCapacity'
import { fracAdd, fracGte, fracLt, fracSub } from '@/utils/fraction'
import { getMeasureNotes } from '@/utils/musicUtils'
import { staffOf, voiceOf } from '@/utils/lanes'

export function glissandiInWindow(
  score: Score,
  topStaff: number,
  maxStaff: number,
  spanStart: Fraction,
  spanEnd: Fraction,
): ClipGlissando[] {
  const glissandi = score.glissandi
  if (!glissandi?.length) return []
  const wanted = new Set(glissandi.map(g => g.noteId))
  const starts = measureStarts(score.measures)
  const at = new Map<string, Omit<ClipGlissando, 'side' | 'end' | 'direction' | 'engraving'>>()
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    const mStart = starts.get(m.number)
    if (!mStart) continue
    for (const n of getMeasureNotes(m, score)) {
      if (!wanted.has(n.id) || n.isRest || n.step === undefined || n.octave === undefined) continue
      const abs = fracAdd(mStart, n.beat)
      const staff = staffOf(n)
      if (!fracGte(abs, spanStart) || !fracLt(abs, spanEnd) || staff < topStaff || staff > maxStaff) continue
      at.set(n.id, {
        staff: staff - topStaff, voice: voiceOf(n), offset: fracSub(abs, spanStart),
        pitch: { step: n.step, alter: n.alter ?? 0, octave: n.octave },
      })
    }
  }
  const out: ClipGlissando[] = []
  for (const g of glissandi) {
    const anchor = at.get(g.noteId)
    if (!anchor) continue
    const held: EngravingOverride[] | undefined = score.engravingOverrides?.[g.id]
    out.push({
      ...anchor,
      ...(g.side && { side: g.side }),
      ...(g.end && { end: g.end }),
      ...(g.direction && { direction: g.direction }),
      ...(held?.length && { engraving: held.map(o => ({ ...o })) }),
    })
  }
  return out
}
