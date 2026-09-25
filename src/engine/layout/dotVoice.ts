/**
 * ⭐⭐ **TWO VOICES: which way a line note's dot goes — a TABLE OF RULES** (docs/plans/multiple-dots-plan.md
 * R3 3a, P4d).
 *
 * ## What we drew until 2026-09-25 — the `vexflow` row
 *
 * VexFlow's `Dot.format` (`engrave/notes/dotStack`), which knows no voice and no stem: a note on a line lifts
 * its dot into the space ABOVE, and drops it only when that space is already taken. Measured in the browser
 * (`e2e/dots.e2e.ts`): a stem-down E4 in voice 2 puts its dot above its line.
 *
 * ## What the sources say
 *
 * Four books (Gould p. 56 *"Drop the dot into the space below the lower part"*, Ross p. 169, Stone p. 125,
 * G&L p. 23) and all three engines: with TWO parts on a staff, a stem-DOWN note on a line puts its dot in
 * the space BELOW. Gould p. 58 adds the exception: *"For a dotted down-stemmed part on a line, the dot is
 * forced into the space above, to be clear of the up-stemmed part"* — where the parts overlap. His call
 * (R3): presets, `gould` the default.
 *
 * ⛔ **Only a column with BOTH stem directions** is "two parts": a single voice's stem-down note keeps the
 * space above, in every source.
 *
 * ⚠️ **3b — the dots' x — is NOT here.** Two voices' heads stand at ONE x in this editor (the multi-voice
 * pass clears VexFlow's head shift; `e2e/dots.e2e.ts`, P4d), so their dots already share one column: every
 * 3b row would draw the same picture. It waits for voices that can stand apart.
 *
 * ⚠️ **No `byVoice` row yet** (LilyPond, MuseScore: voice 2's dots down): a dot knows its note's STEM, ⛔ not
 * its voice. In this editor voice 2 IS the stem-down voice unless a stem is flipped by hand, which is the
 * only case the row would differ from `verovio`'s.
 *
 * Not a width (a dot's height buys no room) — ⚠️ but a re-arm must re-engrave, so its generation IS in
 * `layout/widthRowGenerations`, which is also the SHAPE key (as the grace slash's is).
 */

/** One rule: does a two-part column's stem-down line note drop its dot, and does an overlap lift it back? */
export interface DotVoiceRule {
  /** In a column with both stem directions, a stem-DOWN note on a line takes the space BELOW. */
  downStemBelow: boolean
  /** …except where the parts overlap — the stem-down head at or above a stem-up head (Gould p. 58). */
  overlapLifts: boolean
  source: string
}

export const DOT_VOICE_RULES = {
  /** ✅ **ARMED — Gould** pp. 56 + 58: below the lower part, lifted where the parts overlap. */
  gould: { downStemBelow: true, overlapLifts: true, source: 'Gould pp. 56 + 58 — below the lower part; overlap lifts it' },
  /** **Verovio** — a two-layer stem-down note's dot goes down (`note.cpp`), no overlap exception. */
  verovio: { downStemBelow: true, overlapLifts: false, source: 'Verovio — note.cpp, stem-down in two layers' },
  /** ⛔ **What we drew until 2026-09-25** — VexFlow's `Dot.format`: always up, down only when the space is taken. */
  vexflow: { downStemBelow: false, overlapLifts: false, source: 'VexFlow — Dot.format, no voice rule' },
} as const satisfies Record<string, DotVoiceRule>

export type DotVoiceRuleName = keyof typeof DOT_VOICE_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_DOT_VOICE_RULE: DotVoiceRuleName = 'gould'

const state: { rule: DotVoiceRuleName; generation: number } = { rule: ACTIVE_DOT_VOICE_RULE, generation: 0 }

export function armedDotVoice(): DotVoiceRule {
  return DOT_VOICE_RULES[state.rule]
}
export function dotVoiceSettings(): { rule: DotVoiceRuleName; generation: number } {
  return { ...state }
}
/** A dot's HEIGHT changes, not a width — but a re-arm must re-engrave, so the shape key reads this. */
export function dotVoiceGeneration(): number {
  return state.generation
}
export function setDotVoiceRule(rule: DotVoiceRuleName): boolean {
  if (!(rule in DOT_VOICE_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetDotVoiceRule(): void {
  state.rule = ACTIVE_DOT_VOICE_RULE
  state.generation++
}
