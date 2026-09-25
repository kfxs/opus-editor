/**
 * ⭐⭐ **A DOT AND A STEM-UP FLAG — when the dots are pushed past the flag, and how far: a TABLE OF RULES**
 * (docs/plans/multiple-dots-plan.md R2, P4c).
 *
 * ## What we drew until 2026-09-25 — the `vexflow` row
 *
 * VexFlow's rule, ported (`engrave/notes/modifierStart`, `forceFlagRight`): EVERY stem-up note that draws a
 * flag has its dots pushed past the flag's width, whatever the dot's height — measured in the browser at
 * ≈0.35 sp past the flag's ink (`e2e/dots.e2e.ts`). A BEAMED note draws no flag and is not pushed.
 *
 * ## What the sources say
 *
 * The books: never a dot between the head and its flag (Gould p. 55, Ross p. 171, G&L p. 22) — and Gould
 * moves it past the flag only *"should the end of a tail coincide with the position of the dot"*. The three
 * engines agree with her on WHEN: the dot is pushed only when it is LEVEL with the flag
 * (`docs/research/multiple-dots-research.md` Part C §E). His call (R2): presets, `gould` the default.
 *
 * ## ⭐ ONE answer for the ink AND the room
 *
 * {@link flagPushedFirstDot} is read by the drawing (`rendering/format/dotPlacement.placeDots`), by the
 * layout's dot positions (`layout/noteDotXs` — graces, a parenthesised head's brackets) and by the spacing
 * model's dot box (`layout/measureColumns`). 🚨 Until P4c the spacing model reserved the UNPUSHED dot's room
 * and the flag's, and the pushed dot stood ≈0.8 sp outside both.
 *
 * ⛔ **A row here is a SOURCE, never an invention.** `clear` is the WHITE from the flag's ink to the first
 * dot's, in staff spaces.
 *
 * 🚨 It is a WIDTH, so its generation is in `layout/widthRowGenerations`.
 */
import type { NoteDuration } from '@/types/music'
import { flagDropFromTip, flagGlyph, flagInkRight, glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { MODIFIER_RIGHT_GAP_PX } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** WHEN the dots are pushed: every flagged note, or only when a dot is level with the flag. */
export type DotFlagWhen = 'always' | 'level'

/** One rule — or VexFlow's, which is not a clearance but the flag's WIDTH added to the modifier start. */
export type DotFlagRule =
  | { when: DotFlagWhen; clear: number; source: string }
  | { when: 'always'; vexflow: true; source: string }

/** ⭐ The rules, each sourced. */
export const DOT_FLAG_RULES = {
  /**
   * ✅ **ARMED — Gould** (p. 55): pushed only *"should the end of a tail coincide with the position of the
   * dot and thereby obscure it"* — *"it is equally acceptable to lengthen the stem"*, which we do not do —
   * and then **0.30** past the flag, her engraved eighth measured (her 16th's dot tucks in just past the
   * lowest hook, ≈0).
   */
  gould: { when: 'level', clear: 0.3, source: 'Gould p. 55 — only when the tail meets the dot; 0.30 measured' },
  /** **Ross** (p. 171): *"Don't place a dot below a flag's tail … DO place the dot after the flag!"* — always; 0.20 measured. */
  ross: { when: 'always', clear: 0.2, source: 'Ross p. 171 — always after the flag; 0.20 measured' },
  /**
   * **Gerou & Lusk** (p. 22): *"the dot is placed further right, altogether avoiding the flag"* — ALWAYS,
   * their seven engraved dotted eighths MEASURED (2026-09-25, 450 dpi): even the low ones, whose dot sits
   * BELOW the flag's tail, are pushed, the dot's left ink 0.00–0.05 sp past the flag's rightmost (its
   * bulge — the clearance is diagonal, 0.27–0.47 sp ink to ink). 0.03, the middle of what they drew.
   */
  gerouLusk: { when: 'always', clear: 0.03, source: 'Gerou & Lusk p. 22 — always; 0.00–0.05 measured' },
  /** **LilyPond** — the flag joins the dot skyline, so a dot LEVEL with it stands one dot-width (0.45) past. */
  lilypond: { when: 'level', clear: 0.45, source: 'LilyPond — dot-column.cc, the flag in the skyline' },
  /** **MuseScore** — the top dot above the hook's bottom (+0.25) ⇒ the dot starts at the hook's width: ≈0 white. */
  musescore: { when: 'level', clear: 0, source: 'MuseScore — chordlayout.cpp, d = hook->width()' },
  /** **Verovio** — shifted 0.8 × the flag's width only when they overlap: ≈0.09 white past the flag. */
  verovio: { when: 'level', clear: 0.09, source: 'Verovio — calcdotsfunctor.cpp, 0.8 × flag width' },
  /** ⛔ **What we drew until 2026-09-25** — every flagged stem-up note, the flag's width added. */
  vexflow: { when: 'always', vexflow: true, source: 'VexFlow — forceFlagRight, every flagged stem-up note' },
} as const satisfies Record<string, DotFlagRule>

export type DotFlagRuleName = keyof typeof DOT_FLAG_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_DOT_FLAG_RULE: DotFlagRuleName = 'gould'

const state: { rule: DotFlagRuleName; generation: number } = { rule: ACTIVE_DOT_FLAG_RULE, generation: 0 }

export function armedDotFlag(): DotFlagRule {
  return DOT_FLAG_RULES[state.rule]
}
export function dotFlagSettings(): { rule: DotFlagRuleName; generation: number } {
  return { ...state }
}
/** 🚨 In the LAYOUT key AND the width-cache fingerprint (`layout/widthRowGenerations`). */
export function dotFlagGeneration(): number {
  return state.generation
}
/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored. */
export function setDotFlagRule(rule: DotFlagRuleName): boolean {
  if (!(rule in DOT_FLAG_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetDotFlagRule(): void {
  state.rule = ACTIVE_DOT_FLAG_RULE
  state.generation++
}

/** The dot's radius, sp — Bravura's `augmentationDot` is 0.4 across. */
const dotRadius = () => glyphBox('augmentationDot').up

/**
 * Where the flag's ink and the dot stand vertically, in staff spaces from the flagged (inner) head's centre,
 * UP negative — what decides "level". Absent ⇒ the caller cannot say, and the dot is taken as level: the
 * pushed room is the SAFE side (it may over-reserve, never overlap).
 */
export interface DotFlagGeometry {
  /** The centre of the dot beside the flagged head — 0 in a space, −0.5 when a line lifted it. */
  dotY: number
  /** The stem's length from that head's centre to its tip. */
  stemLength: number
}

/** Is the dot beside the flagged head LEVEL with the flag's ink? */
export function dotLevelWithFlag(duration: NoteDuration, geometry: DotFlagGeometry): boolean {
  const flagBottom = -geometry.stemLength + flagDropFromTip(duration, true)
  return geometry.dotY - dotRadius() < flagBottom
}

/**
 * ⭐ **THE RULE** — where the FIRST dot's left edge must stand, in staff spaces past the head's anchor, to
 * clear a stem-up flag under the armed row — or `null` when the flag does not push it (no flag, or not level
 * under a `level` row). The caller takes the MAX of this and the unflagged position.
 */
export function flagPushedFirstDot(duration: NoteDuration, geometry?: DotFlagGeometry): number | null {
  const flag = flagGlyph(duration, true)
  if (!flag) return null
  const rule: DotFlagRule = armedDotFlag()
  if ('vexflow' in rule) return noteheadInk(duration) + MODIFIER_RIGHT_GAP_PX / STAFF_SPACE_PX + glyphBox(flag).right
  if (rule.when === 'level' && geometry && !dotLevelWithFlag(duration, geometry)) return null
  return flagInkRight(duration, true) + rule.clear
}
