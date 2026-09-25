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
 * ⭐ **We sit at 0.50/0.26 — `gould`** (docs/plans/multiple-dots-plan.md R1): her sentence for the head,
 * her plate for the dots. Until 2026-09-25 it was `house`, 0.50/0.50 — above every source for the second
 * gap. A house style either way, and this is the instrument for revisiting it.
 *
 * ```js
 *   __dots.dump()               // every row, side by side, with sources
 *   __dots.gap('house')         // 0.50 / 0.50 — what we drew until 2026-09-25
 *   __dots.gap('gouldDrawn')    // 0.40 / 0.26 — her plate: the dots crowd closer than the first
 *   __dots.gap('gould')         // ✅ ARMED — 0.50 / 0.26: her SENTENCE for the head, her plate for the rest
 *   __dots.gap('ross')          // 0.38 / 0.44 — his plates: the two gaps about equal
 *   __dots.gap('lilypond')      // 0.45 / 0.45 — one callback answers both
 *   __dots.gap('musescore')     // 0.50 / 0.25
 *   __dots.gap('verovio')       // 0.30 / 0.35 — ⚠️ its dot is a drawn circle, not a glyph
 *   __dots.gap('vexflow')       // 0.20 / 0.10 — what we drew before his report
 *   __dots.reset()
 *
 *   // ⭐ A REST's gaps — their own table (docs/plans/multiple-dots-plan.md P4b, `layout/restDotGap`):
 *   __dots.restGap('gould')       // ✅ ARMED — 0.40 / 0.25, her plates pp. 38 + 162
 *   __dots.restGap('followNotes') // the note's armed row, whatever it is (every engine's shape)
 *   __dots.restGap('lilypond')    // 0.45 / 0.45
 *   __dots.restGap('musescore')   // 0.50 / 0.25
 *   __dots.restGap('verovio')     // 0.30 / 0.35 — its short-rest rule
 *   __dots.restGap('vexflow')     // 0.20 / 0.10 — what a rest drew until 2026-09-25
 *   __dots.restReset()
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
  REST_DOT_GAP_RULES, armedRestDotGap, resetRestDotGapRule, restDotGapSettings, setRestDotGapRule,
  type RestDotGapRuleName,
} from '@/engine/layout/restDotGap'
import {
  DOT_GAP_RULES, armedDotGap, dotGapSettings, resetDotGapRule, setDotGapRule,
  type DotGapRuleName,
} from '@/engine/layout/dotGap'

export interface DotGapConsole {
  gap(rule: DotGapRuleName): { rule: DotGapRuleName; head: number; dot: number }
  reset(): { rule: DotGapRuleName; head: number; dot: number }
  /** A REST's two gaps — their own table (P4b). */
  restGap(rule: RestDotGapRuleName): { rule: RestDotGapRuleName; head: number; dot: number }
  restReset(): { rule: RestDotGapRuleName; head: number; dot: number }
  dump(): void
}

const REST_NAMES = Object.keys(REST_DOT_GAP_RULES) as RestDotGapRuleName[]

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

  const restReadout = () => ({ rule: restDotGapSettings().rule, ...armedRestDotGap() })
  const restReport = () => {
    const { head, dot } = armedRestDotGap()
    dbg(`[dots] rest armed:${restDotGapSettings().rule} — rest→dot ${head} sp, dot→dot ${dot} sp`)
  }

  return {
    restGap: (rule) => {
      if (!setRestDotGapRule(rule)) {
        dbg(`[dots] ⛔ no such rest row: ${rule} — try ${REST_NAMES.map(n => `'${n}'`).join(', ')}`)
        return restReadout()
      }
      render()
      restReport()
      return restReadout()
    },
    restReset: () => {
      resetRestDotGapRule()
      render()
      restReport()
      return restReadout()
    },
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
      dbg(`[dots] REST rows (armed: ${restDotGapSettings().rule}) — __dots.restGap(…):`)
      for (const name of REST_NAMES) {
        const row = REST_DOT_GAP_RULES[name]
        const mark = name === restDotGapSettings().rule ? '✅' : '  '
        const nums = 'followNotes' in row ? '  (the note’s row)' : `${row.head.toFixed(2).padStart(9)} ${row.dot.toFixed(2).padStart(8)}`
        dbg(`${mark} ${name.padEnd(12)} ${nums}   ${row.source}`)
      }
    },
  }
}
