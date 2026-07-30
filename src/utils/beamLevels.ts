/**
 * ⭐ **WHICH BEAM LINES RUN WHERE, over a run of notes that share one beam.**
 *
 * A beamed group is not one thickness. Every note carries the levels its own value asks for — an
 * eighth 1, a sixteenth 2, a thirty-second 3 — and a LINE exists between two neighbours only where
 * both of them have it. That is the whole rule, and it is what draws the picture everyone reads:
 * three sixteenths beamed to two thirty-seconds show two lines over the sixteenths and a third over
 * the pair alone.
 *
 * ⭐ **A level that no neighbour shares is a FRACTIONAL beam** — the stub on a lone thirty-second
 * among sixteenths. It is not decoration: without it the note is drawn as a sixteenth, which is a
 * different rhythm. So this answers with SPANS, and a span of one note is a stub.
 *
 * WHY IT IS ITS OWN MODULE. `FanPass` needed it (a fan's PREFIX is beamed by us, not by VexFlow, and
 * it drew `Math.min` across the whole group — his report: *"where are the fusas in the first group?
 * why we are not showing them?"*, a mixed prefix losing its third beam since 2026-07-26). But it is
 * not a fan rule: `CrossBarBeams` already computes the same `min(left, right)` for the lines that
 * cross a system break (`crossingAfter`), and VexFlow's own `Beam` does its version internally for
 * every ordinary group. One arithmetic, stated once, testable without a renderer — the third place
 * that needs it should call this rather than write the reduce again.
 *
 * ⚠️ Counts in, spans out: this knows nothing about durations, stems, x positions or breaks. A caller
 * that wants a SECONDARY BREAK passes the counts it wants — dropping a shared level to 1 at the gap
 * — which is how `CrossBarBeams` already spells it.
 */

/** One beam line, over the notes `[from … to]` by index. `from === to` is a FRACTIONAL beam — a stub
 *  on that note alone, because no neighbour carries this level. */
export interface BeamLevelSpan {
  /** 0 is the primary (which every beamed note has); 1 is the second line, and so on. */
  level: number
  from: number
  to: number
}

/**
 * The spans of every level ABOVE the primary, for notes whose beam counts are `counts`.
 *
 * The primary is not returned: it runs over the whole group by definition, and its ends are the
 * caller's business (a fan's primary reaches into the ramp; a cross-bar group's stops at the system
 * break). What is genuinely per-gap starts at level 1.
 *
 * Ordered by level, then left to right, so a caller drawing them in order draws each line once.
 */
export function beamLevelSpans(counts: number[]): BeamLevelSpan[] {
  const spans: BeamLevelSpan[] = []
  if (counts.length === 0) return spans

  const deepest = Math.max(...counts)
  for (let level = 1; level < deepest; level++) {
    // A gap carries the level when the notes on BOTH sides do — the rule, in one line.
    const carried = (gap: number): boolean => Math.min(counts[gap], counts[gap + 1]) > level

    let run = -1
    for (let gap = 0; gap < counts.length; gap++) {
      const has = gap < counts.length - 1 && carried(gap)
      if (has && run === -1) run = gap
      if (!has && run !== -1) {
        spans.push({ level, from: run, to: gap })
        run = -1
      }
    }

    // A note that carries the level with nothing to share it with gets a stub. Checked AFTER the
    // runs so the two cannot both claim one note: a note inside a run is not orphaned.
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] <= level) continue
      const leftShares = i > 0 && carried(i - 1)
      const rightShares = i < counts.length - 1 && carried(i)
      if (!leftShares && !rightShares) spans.push({ level, from: i, to: i })
    }
  }
  return spans
}
