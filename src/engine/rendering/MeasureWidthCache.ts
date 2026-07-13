import type { Clef, Measure } from '@/types/music'

/**
 * Memo for the expensive half of the width calc: the VexFlow `Formatter` call that decides how
 * much horizontal space **one staff's lane of one measure** needs for its notes
 * (docs/render-performance-plan.md §4).
 *
 * ## Why a content fingerprint, and not a dirty flag
 *
 * The alternative — a version counter bumped by `ScoreModel` on every write — is tempting and
 * wrong. `ScoreModel` is 3,500 lines with dozens of write sites, and **one missed bump is a
 * silently wrong picture**: a measure that renders at a stale width forever. A fingerprint cannot
 * go stale, because it does not care *how* the measure changed. Rebar, paste, undo, a meter
 * change, a staff copy — all just work, by construction rather than by discipline.
 *
 * ## Why the note-space, and not the total width
 *
 * The total width also carries *overhead* — the clef, the meter glyph, first-in-line, the
 * cautionary clef at a line break. That overhead depends on **where the measure lands**, which
 * changes when the score re-wraps. The note-space does not. So a measure pushed onto a new line
 * keeps its cached note-space and simply pays different overhead: **the cache is never
 * invalidated by re-wrapping.**
 *
 * ## Soundness — verified, not assumed
 *
 * A measure's width cannot depend on a *neighbouring* measure: accidental display state is
 * measure-scoped (`activeMeasureAlterations` in NoteBuilder starts fresh per measure), and
 * tie-continuation suppression reads `tiedFrom` off the slot's own pitch, which is rewritten *in
 * this measure* if its tie partner changes. So an edit next door cannot poison this entry.
 *
 * Not an ambient singleton (that would break multi-document and leak between tests) — the
 * renderer owns one and passes it into the layout.
 */
export class MeasureWidthCache {
  private entries = new Map<string, number>()

  /**
   * A fingerprint-keyed map grows monotonically: every edit mints a new key and nothing ever
   * deletes the old one, so a long editing session accumulates dead entries. Each is one number,
   * so the cap is generous — it exists to bound memory, not to manage a working set.
   */
  private static readonly MAX_ENTRIES = 50_000

  get(key: string): number | undefined {
    return this.entries.get(key)
  }

  set(key: string, width: number): void {
    // Clear-when-full rather than LRU: an entry is a number, and the next render simply
    // re-earns the ones it still needs. Cheaper than tracking recency for no real benefit.
    if (this.entries.size >= MeasureWidthCache.MAX_ENTRIES) this.entries.clear()
    this.entries.set(key, width)
  }

  /** Testing/diagnostics only. */
  get size(): number {
    return this.entries.size
  }
}

/**
 * Everything the formatter reads for one lane, and nothing else.
 *
 * Width depends on more than "the notes": accidental glyphs take space (and `tiedFrom` suppresses
 * one), dots and `forceAccidental` change the glyph set, tuplets rewrite tick values *before* the
 * formatter runs, a mid-measure clef change re-pitches the notes after it, and the time signature
 * feeds the `Voice` and its mode. All of that is here. Dynamics are absent — they do not affect
 * width.
 *
 * Slot ids ride along even though width doesn't depend on them. Stripping them would need a
 * replacer on every serialization to buy a few extra hits on operations that renumber ids
 * wholesale (rebar); not worth the per-render cost, and including them can only cause a
 * recompute, never a wrong width.
 */
export function laneFingerprint(lane: Measure, clef: Clef): string {
  return JSON.stringify([
    lane.slots,
    lane.clefs ?? null,
    lane.tuplets ?? null,
    lane.timeSignature,
    lane.actualDurationOverride ?? null, // a pickup bar's capacity → the Voice's mode
    clef,
  ])
}
