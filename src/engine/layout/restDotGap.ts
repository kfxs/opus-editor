/**
 * ⭐⭐ **HOW FAR A REST'S AUGMENTATION DOTS STAND — from the rest, and from each other: a TABLE OF RULES**
 * (docs/plans/multiple-dots-plan.md R4, P4b). The note's twin is `layout/dotGap`.
 *
 * ## Why a rest has a table of its own
 *
 * Until 2026-09-25 a dotted rest was left on VexFlow's placement — **0.2 sp** off the rest, **0.1 sp**
 * between dots (measured in the browser, `e2e/dots.e2e.ts`) — while notes moved to half a space. That was
 * never his decision: the session that answered his report about NOTES (`642c82f`, 2026-07-28) left rests
 * alone as a SCOPE choice, citing MuseScore's `dotRestDistance` — which MuseScore 4 reads nowhere. The
 * research (`docs/research/multiple-dots-research.md` §0.3 #3) found no book that puts a rest's dot closer
 * than a note's, and Gould's plates draw a rest's dots at a NOTE's spacing.
 *
 * His call (2026-09-25): *"presets … default should be gould"*. Hence this table, `gould` armed.
 *
 * ⛔ **A row here is a SOURCE, never an invention.** Both numbers are EDGE TO EDGE, in staff spaces: white
 * between the rest's ink and the first dot's, and between one dot's ink and the next's.
 *
 * ⛔ **Only the HORIZONTAL.** A rest's dot HEIGHT (it keeps its place relative to the rest glyph — Gould
 * p. 38, Ross p. 179) agrees with ours and is not in this table.
 *
 * ## 🚨 It is a WIDTH, so it goes in the LAYOUT key — `layout/widthRowGenerations`.
 */
import { armedDotGap, type DotGapRule } from './dotGap'

/** One rule: the rest's two gaps, in staff spaces, edge to edge — or `followNotes`, the note's armed row. */
export type RestDotGapRule = DotGapRule | { followNotes: true; source: string }

/** ⭐ The rules, each sourced. */
export const REST_DOT_GAP_RULES = {
  /**
   * ✅ **ARMED — Gould's plates, MEASURED** (pp. 38 + 162, 2026-09-25, threshold-free): **0.40** off a
   * quaver-family rest (four of them, and her double-dotted one), **0.25** between dots (pitch 0.75). ⚠️ Her
   * CROTCHET rests measure 0.50–0.55 off the rest's nearest ink in the dot's rows — the breast of that
   * glyph sits further left than its box, so one number off the box is what she draws for the others.
   */
  gould: { head: 0.4, dot: 0.25, source: 'Gould pp. 38 + 162, her plates measured' },
  /** **The note's armed row** (`layout/dotGap`) — every engine's shape: a rest's dots spaced as a note's. */
  followNotes: { followNotes: true, source: 'the note’s armed row — LilyPond, MuseScore, Verovio all do this' },
  /** **LilyPond** — the same `DotColumn` padding as a note: one dot's width, both gaps. */
  lilypond: { head: 0.45, dot: 0.45, source: 'LilyPond — the note’s padding (output-lib.scm)' },
  /** **MuseScore 4** — `restlayout.cpp` reads `dotNoteDistance` / `dotDotDistance`, the note's own. */
  musescore: { head: 0.5, dot: 0.25, source: 'MuseScore 4 — the note’s distances (dotRestDistance is dead code)' },
  /**
   * **Verovio** — the note's 0.3 / 0.35 for a rest shorter than a half. ⚠️ For a HALF rest or longer it
   * stands the dot a fixed 1.25 sp from the rest's LEFT instead (`calcdotsfunctor.cpp`), which no gap
   * off the ink can say; this row is its short-rest rule.
   */
  verovio: { head: 0.3, dot: 0.35, source: 'Verovio — the note’s, for a rest shorter than a half' },
  /** ⛔ **What we drew until 2026-09-25** — VexFlow's `getModifierStartXY` 2 px and `Dot.format` 1 px. */
  vexflow: { head: 0.2, dot: 0.1, source: 'VexFlow — kept for rests until 2026-09-25' },
} as const satisfies Record<string, RestDotGapRule>

export type RestDotGapRuleName = keyof typeof REST_DOT_GAP_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_REST_DOT_GAP_RULE: RestDotGapRuleName = 'gould'

const state: { rule: RestDotGapRuleName; generation: number } = { rule: ACTIVE_REST_DOT_GAP_RULE, generation: 0 }

/** The rest's two gaps in force right now — `followNotes` resolved to the note's armed row. */
export function armedRestDotGap(): { head: number; dot: number } {
  const rule: RestDotGapRule = REST_DOT_GAP_RULES[state.rule]
  return 'followNotes' in rule ? armedDotGap() : rule
}

export function restDotGapSettings(): { rule: RestDotGapRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint (`layout/widthRowGenerations`). */
export function restDotGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored. */
export function setRestDotGapRule(rule: RestDotGapRuleName): boolean {
  if (!(rule in REST_DOT_GAP_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

export function resetRestDotGapRule(): void {
  state.rule = ACTIVE_REST_DOT_GAP_RULE
  state.generation++
}
