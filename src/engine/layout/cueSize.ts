/**
 * ⭐ **HOW SMALL A CUE NOTE IS — the house-style rows** (docs/plans/cue-size-plan.md C2, C6). The model
 * says only THAT a note is cue (`cue?: true`, `engine/models/cueOps`); how small, and what that does to
 * its ledger lines, are presets here — his pattern when the sources split: a row per source, the default
 * named after the one he chose. Armed from the console (`dev/cueConsole` — `__cue.size(…)`); a free
 * number is accepted too. ⛔ A number never blocks a phase (`CLAUDE.md`).
 *
 * ⭐ `slotScale(slot)` is the ONE answer every reader asks — the note's drawing (`NoteBuilder` hands it to
 * the `EngravedNote`, which sizes its heads, flag, stem length, ledgers and modifiers by it) and the
 * room (`measureColumns.slotInk`). ⚠️ Read per draw, ⛔ never frozen: re-arming bumps
 * {@link cueSizeGeneration}, which is in `layout/widthRowGenerations`, so every bar is re-measured.
 *
 * ⏭️ The cue GRACE's own size (C4) and a cue head's BRACKETS (C11) join this module with their readers (P4).
 */
import type { ChordRest } from '@/types/music'

/** One row: its size, and where it comes from. */
interface CueRow { value: number; source: string }

/**
 * ⭐ **C2 — the cue size**, his call 2026-09-23: *"lets do gould but also this should be done in a preset so
 * gould-ross 0.75 is default"*. The rows are the research's (`docs/research/cue-size-research.md` §0.2).
 * ⚠️ `gouldDrawn` and `lilypond` put a cue BELOW our grace (2/3) — every book orders it above.
 */
export const CUE_SIZE_RULES = {
  gouldRoss: { value: 0.75, source: 'Gould p. 569 and Ross p. 189 write ¾; also Dorico, Sibelius and Verovio' },
  gouldDrawn: { value: 0.62, source: 'what Gould’s plates DRAW (pp. 570–571)' },
  musescore: { value: 0.7, source: 'MuseScore smallNoteMag 0.7 (also IMSLP)' },
  gerouLusk: { value: 0.65, source: 'Gerou & Lusk: 65–75%, the low end' },
  lilypond: { value: 0.63, source: 'LilyPond’s cue font-size' },
} as const satisfies Record<string, CueRow>

export type CueSizeRuleName = keyof typeof CUE_SIZE_RULES

/**
 * ⭐ **C6 — a cue note's LEDGER lines**, his call 2026-09-23 (*"c) and default is gould"*). Their SPACING is
 * the full staff's in every source (the head sits on the full staff's lines); their LENGTH follows the
 * head. What differs is their THICKNESS:
 * - `gould` (default) — thinner, × the note's size. Gould p. 569: *"the same vertical distance apart as
 *   full-sized ledger lines (although they are thinner)"* — she gives no number; MuseScore and Verovio
 *   thin them by the note's size.
 * - `full` — the system's weight: our grace's rule (`GracePass`, G&L p. 75) and LilyPond's.
 */
export const CUE_LEDGER_RULES = {
  gould: { thin: true, source: 'Gould p. 569: “thinner”; MuseScore and Verovio × the note’s size' },
  full: { thin: false, source: 'the system’s weight — our grace’s rule (G&L p. 75), LilyPond’s' },
} as const satisfies Record<string, { thin: boolean; source: string }>

export type CueLedgerRuleName = keyof typeof CUE_LEDGER_RULES

const state: { rule: CueSizeRuleName | 'custom'; value: number; ledger: CueLedgerRuleName; generation: number } = {
  rule: 'gouldRoss', value: CUE_SIZE_RULES.gouldRoss.value, ledger: 'gould', generation: 0,
}

/** The size a cue note is drawn at — the ARMED row. Read per draw, ⛔ never frozen. */
export function cueScale(): number {
  return state.value
}

/** ⭐ The size THIS slot is drawn at: 1 for full size, {@link cueScale} for a cue chord or rest. */
export function slotScale(slot: Pick<ChordRest, 'cue'>): number {
  return slot.cue ? state.value : 1
}

/** How thick a ledger line of a note drawn at `scale` is, as a multiple of the system's weight (C6). */
export function ledgerWeightScale(scale: number): number {
  return CUE_LEDGER_RULES[state.ledger].thin ? scale : 1
}

/** Which rows are armed. */
export function cueSizeSettings(): { rule: CueSizeRuleName | 'custom'; value: number; ledger: CueLedgerRuleName } {
  return { rule: state.rule, value: state.value, ledger: state.ledger }
}

/** 🚨 A WIDTH — in `layout/widthRowGenerations`, so re-arming re-measures (and re-engraves) every bar. */
export function cueSizeGeneration(): number {
  return state.generation
}

/** Arm a size by row name, or by number (0.3–1). ⛔ Anything else is REFUSED, not ignored. */
export function setCueSize(rule: CueSizeRuleName | number): boolean {
  if (typeof rule === 'number') {
    if (!(rule >= 0.3 && rule <= 1)) return false
    state.rule = 'custom'
    state.value = rule
  } else {
    if (!(rule in CUE_SIZE_RULES)) return false
    state.rule = rule
    state.value = CUE_SIZE_RULES[rule].value
  }
  state.generation++
  return true
}

/** Arm the ledger-thickness row. ⛔ An unknown name is refused. */
export function setCueLedger(rule: CueLedgerRuleName): boolean {
  if (!(rule in CUE_LEDGER_RULES)) return false
  state.ledger = rule
  state.generation++
  return true
}

/** Back to the defaults: `gouldRoss`, `gould`. */
export function resetCueSize(): void {
  state.rule = 'gouldRoss'
  state.value = CUE_SIZE_RULES.gouldRoss.value
  state.ledger = 'gould'
  state.generation++
}
