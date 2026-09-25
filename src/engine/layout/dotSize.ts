/**
 * ⭐⭐ **HOW BIG AN AUGMENTATION DOT IS — a TABLE OF RULES** (docs/plans/multiple-dots-plan.md R6, P4f).
 *
 * ## What we drew until 2026-09-25 — the `font` row
 *
 * The music face's own `augmentationDot`, unscaled: **0.40 sp** in Bravura, 0.52 in Leipzig, 0.50 in Sebastian.
 *
 * ## What the sources say (`docs/research/multiple-dots-research.md` §0.3 #6, Part B §E)
 *
 * The books disagree. Gould p. 54: *"larger than a staccato dot – often twice the size"* — and her plates
 * DRAW **0.49 sp** (threshold-free, five dots; her words would be ≈0.67 in Bravura, bigger than anything she
 * draws). Ross p. 169 states *"about one third of a space"*. Gerou & Lusk draw ≈0.3. SMuFL gives no default.
 * His call (R6): presets, `gould` the default.
 *
 * ## ⭐ ONE size for the ink AND the room
 *
 * {@link dotSizeScale} scales the glyph where it is stamped (`rendering/engraved/EngravedDot`, the grace's
 * `drawGraceDots`) AND where its room is counted (`spacingPadding`, `noteDotXs`, `graceRoom`, `dotFlag`):
 * a bigger dot is a WIDER dotted note. The glyph is scaled about its own origin — SMuFL's dot sits centred on
 * its baseline, so it stays centred in its space.
 *
 * 🚨 It is a WIDTH, so its generation is in `layout/widthRowGenerations`.
 */
import { glyphBox } from '@/engine/fonts/fontMetrics'

/** One rule: the dot's diameter in staff spaces — `null` = the face's own glyph, unscaled. */
export interface DotSizeRule {
  size: number | null
  source: string
}

export const DOT_SIZE_RULES = {
  /** ✅ **ARMED — Gould's plates**, p. 54 (and p. 38's rests), threshold-free: 0.491–0.494 sp across. */
  gould: { size: 0.49, source: 'Gould p. 54 — her plates measured, 0.49 sp' },
  /** ⛔ **What we drew until 2026-09-25** — the music face's own glyph. */
  font: { size: null, source: 'the music face’s augmentationDot, unscaled' },
  /** **Ross** p. 169, stated: *"about one third of a space"* (his plates draw 0.43–0.51). */
  ross: { size: 1 / 3, source: 'Ross p. 169 — "about one third of a space"' },
  /** **Gerou & Lusk** p. 22, drawn: ≈0.3 sp (0.26–0.32 by threshold). */
  gerouLusk: { size: 0.3, source: 'Gerou & Lusk p. 22 — their plate, ≈0.3 sp' },
} as const satisfies Record<string, DotSizeRule>

export type DotSizeRuleName = keyof typeof DOT_SIZE_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_DOT_SIZE_RULE: DotSizeRuleName = 'gould'

const state: { rule: DotSizeRuleName; generation: number } = { rule: ACTIVE_DOT_SIZE_RULE, generation: 0 }

export function dotSizeSettings(): { rule: DotSizeRuleName; generation: number } {
  return { ...state }
}
/** 🚨 In the LAYOUT key AND the width-cache fingerprint (`layout/widthRowGenerations`). */
export function dotSizeGeneration(): number {
  return state.generation
}
export function setDotSizeRule(rule: DotSizeRuleName): boolean {
  if (!(rule in DOT_SIZE_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetDotSizeRule(): void {
  state.rule = ACTIVE_DOT_SIZE_RULE
  state.generation++
}

/** The armed diameter, sp — `null` for the face's own glyph. */
export function armedDotSize(): number | null {
  return DOT_SIZE_RULES[state.rule].size
}

/**
 * ⭐ How much the face's dot glyph is scaled — 1 for `font`. Read through a FUNCTION every time, ⛔ never
 * captured: the face can change under it (`fonts/musicFont`), and so can the row.
 */
export function dotSizeScale(): number {
  const size = armedDotSize()
  return size === null ? 1 : size / glyphBox('augmentationDot').right
}

/** The dot's drawn width, sp — the glyph's, scaled. */
export function dotInkWidth(): number {
  return glyphBox('augmentationDot').right * dotSizeScale()
}

/** The dot's drawn half-height, sp. */
export function dotInkRadius(): number {
  return glyphBox('augmentationDot').up * dotSizeScale()
}
