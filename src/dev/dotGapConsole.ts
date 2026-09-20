/**
 * ⭐⭐ **THE DOT'S TWO GAPS, FROM THE CONSOLE — his eye, on his own music.**
 *
 * The rows are `engine/layout/dotGap`; this is the entry point that arms one. Built 2026-09-14,
 * straight off the survey (`docs/research/accidental-dot-research.md` + `docs/research/accidental-dot-engines.md`),
 * because the survey's headline finding is that **there is no shared law here**:
 *
 * - Gould's plate draws the dots CLOSER to each other (0.26 sp) than the first dot is to the head
 *   (0.37) — and she states no dot-to-dot number at all;
 * - Ross's plate draws the two gaps EQUAL, at about a half space each, and Gerou & Lusk state that
 *   as a principle;
 * - the four engines split four ways: LilyPond 0.45/0.45 · MuseScore 0.50/0.25 · Verovio 0.30/0.35 ·
 *   VexFlow 0.20/0.10.
 *
 * ⭐ **We sit at 0.50/0.50** — MuseScore's first gap and Ross's second — which is the top of the
 * engines' range for the first and above all four for the second. ⛔ Nothing about that is wrong;
 * it is a house style, and this is the instrument for revisiting it.
 *
 * ```js
 *   __dots.dump()               // every row, side by side, with sources
 *   __dots.gap('house')         // ✅ ARMED — 0.50 / 0.50, what his report put on the page
 *   __dots.gap('gouldDrawn')    // 0.40 / 0.26 — her plate: the dots crowd closer than the first
 *   __dots.gap('gould')         // 0.50 / 0.26 — her SENTENCE for the head, her plate for the rest
 *   __dots.gap('ross')          // 0.38 / 0.44 — his plates: the two gaps about equal
 *   __dots.gap('lilypond')      // 0.45 / 0.45 — one callback answers both
 *   __dots.gap('musescore')     // 0.50 / 0.25
 *   __dots.gap('verovio')       // 0.30 / 0.35 — ⚠️ its dot is a drawn circle, not a glyph
 *   __dots.gap('vexflow')       // 0.20 / 0.10 — what we drew before his report
 *   __dots.reset()
 * ```
 *
 * ⚠️ **Look at a DOUBLE-dotted note**, not a single one: five of the eight rows differ only in the
 * second column, and a single dot cannot show it.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE (`engine/` may not
 * import `dev/`), this is the entry point, `App.ts` wires it — the same contract as
 * `dev/headerGapConsole` and `dev/beamSlopeConsole`. ⏭️ When his eye has chosen, the winner is frozen
 * with his choice as the citation and both files go.
 */
import { dbg } from '@/utils/debug'
import {
  DOT_GAP_RULES, armedDotGap, dotGapSettings, resetDotGapRule, setDotGapRule,
  type DotGapRuleName,
} from '@/engine/layout/dotGap'

export interface DotGapConsole {
  gap(rule: DotGapRuleName): { rule: DotGapRuleName; head: number; dot: number }
  reset(): { rule: DotGapRuleName; head: number; dot: number }
  dump(): void
}

const NAMES = Object.keys(DOT_GAP_RULES) as DotGapRuleName[]

export function dotGapConsole(render: () => void): DotGapConsole {
  const readout = () => {
    const { rule } = dotGapSettings()
    const { head, dot } = armedDotGap()
    return { rule, head, dot }
  }
  const report = () => {
    const { head, dot } = armedDotGap()
    dbg(`[dots] armed:${dotGapSettings().rule} — head→dot ${head} sp, dot→dot ${dot} sp. __dots.dump() for the table`)
  }

  return {
    gap: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setDotGapRule(rule)) {
        dbg(`[dots] ⛔ no such row: ${rule} — try ${NAMES.map(n => `'${n}'`).join(', ')}`)
        return readout()
      }
      render()
      report()
      return readout()
    },
    reset: () => {
      resetDotGapRule()
      render()
      report()
      return readout()
    },
    dump: () => {
      dbg(`[dots] armed: ${dotGapSettings().rule}. Both gaps are EDGE TO EDGE, in staff spaces:`)
      dbg(`  ${'row'.padEnd(12)} ${'head→dot'.padStart(9)} ${'dot→dot'.padStart(8)}   source`)
      for (const name of NAMES) {
        const { head, dot, source } = DOT_GAP_RULES[name]
        const mark = name === dotGapSettings().rule ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(12)} ${head.toFixed(2).padStart(9)} ${dot.toFixed(2).padStart(8)}   ${source}`)
      }
      dbg('  ⚠️ Look at a DOUBLE-dotted note — five rows differ only in the second column.')
    },
  }
}
