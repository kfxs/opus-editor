/**
 * ⭐⭐ **THINGS THAT TOUCH SHARE A LINE — the dynamics CHAIN.**
 *
 * The local rule (`./dynamicsLine.ts`) gives every mark its own answer: clear the ink under *me*,
 * floored at the staff. That is right for marks standing alone, and it is what makes a page of
 * ordinary dynamics read as one line with the occasional deviation. It is wrong for a RUN — a
 * crescendo running into a diminuendo running into an `f` — because those are one continuous
 * gesture, and a gesture that steps up and down mid-phrase reads as broken rather than as engraved.
 *
 * His report, 2026-08-12, on a `< >` over a low C beside a `< >` over ordinary notes: *"the hairpins
 * are not aligned… there must be a way in which this should be adjusted."*
 *
 * ⭐ **The unit is the CHAIN, not the measure.** He asked whether it should be per bar; it should
 * not, and the reason is that a bar is a spelling convenience rather than a phrase. It breaks in
 * both directions: a hairpin crossing a barline belongs to no single measure, and two *unrelated*
 * marks that happen to share a bar would be yoked together for no musical reason. What both
 * reference engines use instead is connectivity:
 *
 *  - **MuseScore** — `SystemLayout::layoutDynamicExpressionAndHairpins` collects dynamics,
 *    expressions and hairpin segments and calls `AlignmentLayout::alignItemsWithTheirSnappingChain`,
 *    which moves every item of a snapped chain to a single **outermost** y
 *    (`placeAbove ? std::min : std::max`).
 *  - **LilyPond** — one `DynamicLineSpanner` covers a connected run of dynamic events, and the
 *    whole spanner is placed as a unit.
 *
 * ⚠️ **OUTERMOST, never an average.** A chain has to clear everything under all of it, so the member
 * that needs the most room decides — one wedge left crossing a ledger line is the whole failure this
 * fixes. Averaging would leave that member colliding and move the others for nothing.
 *
 * ⭐⭐ **And it deliberately chains ACROSS BARLINES** (his call, 2026-08-12, choosing this over a
 * bar-bounded variant). That is the one place it competes with the LOCAL rule he set after P1: a
 * `>` ending on a barline and a `<` starting on the next downbeat are one gesture, so a low note
 * under the second DOES lift the first — the very "one low note moved bar 1" the local rule exists
 * to prevent. The difference is that these marks are *connected*, and connected marks stepping
 * apart is worse than a slightly generous line. Marks that touch nothing keep the local rule
 * entirely.
 *
 * **Pure, and derived — stored nowhere.** In: each member's own answer plus the span it covers. Out:
 * the answer it should actually use. ⛔ No module-level state (DESIGN-PRINCIPLES §1).
 */
import type { Fraction } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import type { DynamicsPlacement } from './dynamicsLine'

/**
 * One thing on a dynamics line, as the chaining rule needs to see it.
 *
 * ⚠️ `start`/`end` are ABSOLUTE beats from the score's start, not in-measure ones — chaining is the
 * question "does this touch that", and two marks either side of a barline can only be compared on a
 * shared axis. A LETTER is a point (`start === end`); a HAIRPIN is a range.
 *
 * ⚠️ `line` is the SYSTEM. It is part of the grouping key, not incidental: a wedge split across a
 * break contributes one member per system, and each chains with what is around it *there*. Two
 * marks a page apart are never one chain however connected they are musically.
 */
export interface ChainItem {
  /** What the answer is filed under — an id, or an id + system for a split wedge. Unique per item. */
  key: string
  line: number
  staffId: string | undefined
  placement: DynamicsPlacement
  start: Fraction
  end: Fraction
  /** This member's OWN answer from the local rule, in staff spaces below the top stave line. */
  baseline: number
}

/** The grouping key: one chain can only form within a single (system, staff, side). */
function laneOf(item: ChainItem): string {
  return `${item.line}|${item.staffId ?? ''}|${item.placement}`
}

/**
 * Resolve every item's baseline against the chain it belongs to.
 *
 * Items are grouped by lane, sorted by where they start, and merged while they keep touching —
 * `end >= next.start`, so a letter sitting exactly on a wedge's end joins it, and so do two wedges
 * meeting on a barline. Each resulting chain takes the outermost baseline of its members: the
 * LOWEST for a `below` chain, the HIGHEST for an `above` one.
 *
 * @returns key → the baseline to draw at. Every item in, every item out — an item that touches
 *   nothing is a chain of one and comes back with its own answer unchanged, which is what keeps the
 *   local rule intact for everything standing alone.
 */
export function levelDynamicsChains(items: readonly ChainItem[]): Map<string, number> {
  const out = new Map<string, number>()

  const lanes = new Map<string, ChainItem[]>()
  for (const item of items) {
    const lane = laneOf(item)
    const bucket = lanes.get(lane)
    if (bucket) bucket.push(item)
    else lanes.set(lane, [item])
  }

  for (const bucket of lanes.values()) {
    // Sorted by start, then by end — so a point mark at a wedge's start is seen before the wedge,
    // and the sweep below only ever has to look one step back.
    const sorted = [...bucket].sort((a, b) => fracCompare(a.start, b.start) || fracCompare(a.end, b.end))

    let chain: ChainItem[] = []
    let reach: Fraction | null = null
    const flush = () => {
      if (chain.length === 0) return
      const below = chain[0].placement === 'below'
      // OUTERMOST — the member needing the most room decides for all of them.
      const level = chain.reduce(
        (best, item) => (below ? Math.max(best, item.baseline) : Math.min(best, item.baseline)),
        chain[0].baseline,
      )
      for (const item of chain) out.set(item.key, level)
      chain = []
      reach = null
    }

    for (const item of sorted) {
      // `>= 0` and not `> 0`: TOUCHING is joining. A wedge ending exactly where the next begins is
      // the case this whole module exists for, and it is the one a strict overlap test would miss.
      if (reach !== null && fracCompare(reach, item.start) >= 0) {
        chain.push(item)
        if (fracCompare(item.end, reach) > 0) reach = item.end
      } else {
        flush()
        chain = [item]
        reach = item.end
      }
    }
    flush()
  }

  return out
}
