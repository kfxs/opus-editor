import { renderProbe } from '@/engine/RenderProbe' // TEMPORARY — the §9 layout-breakdown probes
import type { Measure } from '@/types/music'

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
 * ## Ids are CANONICALIZED, not included and not dropped
 *
 * Raw ids used to ride along, on the theory that they "can only cause a recompute, never a wrong
 * width". True, and it cost 74% of the layout term. Add a staff to a 300-bar score and you mint 300
 * whole-rest lanes that are musically *identical* — same duration, same meter — but each carries a
 * freshly-minted rest id, so each got its own key and the formatter measured 300 bars that all come
 * out the same width. Paste is the same story: the rebar pipeline renumbers ids wholesale, so bars
 * whose music never changed missed the cache.
 *
 * They cannot simply be **deleted**, either: `tupletId` is what says *which slots are in the same
 * tuplet*, and two different groupings of the same notes would collide on one key and take each
 * other's width. So instead every id is rewritten to its **first-appearance ordinal within this
 * lane** ({@link canonicalizeIds}). Identical music mints an identical key no matter which UUIDs it
 * happens to hold, and the grouping structure survives intact.
 *
 * Tie targets (`tiedTo`/`tiedFrom`) are ids too, and usually point *out* of this lane. Canonicalizing
 * them collapses "tied to some note elsewhere" to a single token — which is exactly right: width
 * cares only that a tie *suppresses the accidental*, never which note is on the far end.
 *
 * ## ⚠️ The GOVERNING CLEF is deliberately NOT here — and it used to be
 *
 * It was the single most expensive thing in the editor. A clef is *inherited*: an alto clef at bar
 * 40 is the governing clef of **every bar after it**. With `clef` in this key, changing one clef
 * minted a fresh key for 260 bars and re-ran the formatter on all of them — and *dragging* that clef
 * did it again on every mouse-move. The census caught it: 1,175 formatter re-runs, **293 ms, 47% of
 * all layout time**, against a 3% cache miss rate. The cache was working; the key was wrong.
 *
 * And the clef cannot change the answer. It moves every notehead the same distance *vertically*.
 * Width is driven by durations, notehead glyphs, and accidental stacking — and stacking depends on
 * the notes' *relative* positions, which a clef does not disturb. `clefWidthIndependence.test.ts`
 * pins this: identical widths under treble, bass, alto and tenor, with controls proving the harness
 * would have seen a difference if there were one.
 *
 * A **mid-measure** clef change is a different animal and stays in the key via `lane.clefs` — it
 * re-pitches the notes after it *within this bar*, and that is content, not inheritance.
 */
export function laneFingerprint(lane: Measure): string {
  // TEMPORARY probe — see {@link RenderProbe.layoutSub}. ⚠️ It reported **0 ms** from the day it was
  // added until 2026-08-22, and was read as "the stringify walk is free". It was never wired: the
  // probe sat in the width path, which stopped consulting this fingerprint (see
  // `MeasureLayout.noteSpaceForMeasure`), while the walk itself moved to `measureShapeKey` — once per
  // (measure, staff) per render, 128 of them on a 64-bar grand staff. ⛔ A zero from an unwired probe
  // and a zero from a free walk are the same number; only the call site tells them apart.
  const probing = renderProbe().recording
  const t0 = probing ? performance.now() : 0
  const key = JSON.stringify(
    [
      lane.slots,
      lane.clefs ?? null,
      lane.tuplets ?? null,
      lane.timeSignature,
      lane.actualDurationOverride ?? null, // a pickup bar's capacity → the Voice's mode
    ],
    canonicalizeIds(),
  )
  if (probing) renderProbe().layoutSub('fingerprint', performance.now() - t0)
  return key
}

/** Any property whose value is an id. `*Id` catches `tupletId` and whatever §10 adds next. */
function isIdKey(key: string): boolean {
  return key === 'id' || key === 'tiedTo' || key === 'tiedFrom' || key.endsWith('Id')
}

/**
 * A `JSON.stringify` replacer that rewrites each distinct id to `#0`, `#1`, … in the order it is
 * first seen. Two lanes holding the same music produce the same string even though every UUID in
 * them differs.
 *
 * Stateful, so it must be built fresh per serialization — hence a factory, not a constant. That is
 * also what keeps the numbering *lane-local*: an ordinal means "the 3rd distinct id in this bar",
 * which is a property of the bar's own structure and cannot leak in from a neighbour.
 */
function canonicalizeIds(): (key: string, value: unknown) => unknown {
  const seen = new Map<string, string>()
  return (key, value) => {
    if (typeof value !== 'string' || !isIdKey(key)) return value
    let ordinal = seen.get(value)
    if (ordinal === undefined) {
      ordinal = `#${seen.size}`
      seen.set(value, ordinal)
    }
    return ordinal
  }
}
