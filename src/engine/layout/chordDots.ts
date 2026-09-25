/**
 * ⭐⭐ **A CHORD WHOSE DOTS COLLIDE — a cluster of seconds: a TABLE OF RULES** (docs/plans/multiple-dots-plan.md
 * R5, P4e).
 *
 * ## What we drew until 2026-09-25 — the `vexflow` row
 *
 * VexFlow's `Dot.format` (`engrave/notes/dotStack`) walks the chord top-down and never checks a SPACE note's
 * dot against the one before it: in a cluster C5 D5 E5 F5, D5's dot drops into C5's space and TWO DOTS ARE
 * DRAWN ON TOP OF EACH OTHER (measured, `e2e/dots.e2e.ts` P3) — which reads as one.
 *
 * ## Gould pp. 55–56 — the `gould` row, read off her figures (2026-09-25)
 *
 * - p. 55: *"Each dot should always have a stave-space to itself."*
 * - p. 56: *"Centre the dots on the chord, rather than placing them in one direction, away from the chord"* —
 *   her four-note cluster puts one dot BELOW it (spaces 3.5 / 2.5 / 1.5 / 0.5), ⛔ not all four upward.
 * - p. 56: *"When a dot is forced to be two or more stave-spaces from the chord … use only as many dots as
 *   cover the number of stave-spaces taken up by the chord"* — her eight-head cluster from the bottom line to
 *   above the top one carries FIVE dots, exactly the spaces it covers, ⛔ not eight running off both ends.
 *
 * ⇒ **Only a chord whose natural dots COLLIDE is touched** — her ordinary chords (p. 55) keep a dot beside
 * each head. Such a chord's dots take a contiguous run of spaces centred on it; if that run would need a
 * second space beyond the chord on either side, only the spaces the chord covers are used and the surplus
 * dots are DROPPED.
 *
 * ⏸️ **No LilyPond or MuseScore row yet**: their collision rules (an optimiser with a badness score; a
 * claimed-space walk bottom-up then top-down — `docs/research/multiple-dots-research.md` Part C §D) are
 * algorithms to TRANSCRIBE from their source, ⛔ not to approximate from a summary.
 *
 * Not a width — ⚠️ but a re-arm must re-engrave, so its generation is in `layout/widthRowGenerations` (the
 * SHAPE key), as `layout/dotVoice`'s is.
 */

/** What a chord does when two of its dots would share a space. */
export type ChordDotCollision = 'keep' | 'merge' | 'centre'

export interface ChordDotRule {
  collisions: ChordDotCollision
  source: string
}

export const CHORD_DOT_RULES = {
  /** ✅ **ARMED — Gould** pp. 55–56: each dot its own space, centred on the chord, surplus dropped. */
  gould: { collisions: 'centre', source: 'Gould pp. 55–56 — a space each, centred; surplus dropped' },
  /** **Verovio** — two dots landing in one space MERGE into one (`chord.cpp`, a set of locs). */
  verovio: { collisions: 'merge', source: 'Verovio — chord.cpp, coincident dots merge' },
  /** ⛔ **What we drew until 2026-09-25** — both dots drawn, one on top of the other. */
  vexflow: { collisions: 'keep', source: 'VexFlow — Dot.format, no collision check for a space note' },
} as const satisfies Record<string, ChordDotRule>

export type ChordDotRuleName = keyof typeof CHORD_DOT_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_CHORD_DOT_RULE: ChordDotRuleName = 'gould'

const state: { rule: ChordDotRuleName; generation: number } = { rule: ACTIVE_CHORD_DOT_RULE, generation: 0 }

export function armedChordDots(): ChordDotRule {
  return CHORD_DOT_RULES[state.rule]
}
export function chordDotSettings(): { rule: ChordDotRuleName; generation: number } {
  return { ...state }
}
export function chordDotGeneration(): number {
  return state.generation
}
export function setChordDotRule(rule: ChordDotRuleName): boolean {
  if (!(rule in CHORD_DOT_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetChordDotRule(): void {
  state.rule = ACTIVE_CHORD_DOT_RULE
  state.generation++
}

/**
 * ⭐ **Gould's placement** — the SPACES a colliding chord's dots take, top first, in staff-line units (a space
 * is a half: 3.5 is the space below the top line's neighbour). `heads` are the chord's dotted heads' lines.
 * Pure: `engrave/notes/dotStack` hands a colliding chord to it.
 */
export function centredChordSpaces(heads: readonly number[]): number[] {
  const low = Math.min(...heads)
  const high = Math.max(...heads)
  // The spaces the chord COVERS — every half-line between its outer heads, inclusive.
  const covered: number[] = []
  for (let s = Math.ceil(low - 0.5) + 0.5; s <= high; s += 1) covered.push(s)
  const n = heads.length
  const centre = (low + high) / 2
  // A contiguous run of n spaces, its centre nearest the chord's; a tie goes UP — a line note's own way.
  let best: number[] = []
  let bestDistance = Infinity
  for (let bottom = Math.floor(low - n) + 0.5; bottom <= high + 0.5; bottom += 1) {
    const run = Array.from({ length: n }, (_, i) => bottom + i)
    const distance = Math.abs((run[0] + run[n - 1]) / 2 - centre)
    if (distance < bestDistance - 1e-9 || (Math.abs(distance - bestDistance) < 1e-9 && bottom > best[0])) {
      best = run
      bestDistance = distance
    }
  }
  // ⭐ p. 56: a dot TWO spaces beyond the chord ⇒ only the spaces the chord covers.
  const firstOut = covered.length ? covered[0] - 1 : low - 0.5
  const lastOut = covered.length ? covered[covered.length - 1] + 1 : high + 0.5
  const tooFar = best.some(s => s < firstOut || s > lastOut)
  return (tooFar ? covered : best).slice().sort((a, b) => b - a)
}
