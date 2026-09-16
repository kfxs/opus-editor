/**
 * ⭐⭐ **THE ACCIDENTAL'S GAP, FROM THE CONSOLE — his eye, on his own music.**
 *
 * The rows are `engine/layout/accidentalGap`; this arms one. Built 2026-09-14 beside
 * `dev/dotGapConsole`, off the same survey — and it arrived with a mismatch already closed: the
 * page drew **0.30 sp** while the spacing model reserved **0.10**, and ONE number now feeds both
 * (his call: *"close the mismatch and build the accidental knob"*).
 *
 * ⚠️⚠️ **A gap is a number PLUS a model of ink.** MuseScore's and Verovio's 0.25 are measured to
 * SMuFL cut-out sub-rectangles, LilyPond's 0.35 to skylines in a shared band, VexFlow's 0.30 to a
 * plain bounding box. ⛔ Arming `musescore` gives you MuseScore's NUMBER, ⛔ not MuseScore's spacing.
 * ⭐ Which is fine for what this is for: the eye judges white, not provenance.
 *
 * ```js
 *   __accidentals.dump()              // every row, with sources
 *   __accidentals.gap('house')        // ✅ ARMED — 0.30, VexFlow's standoff AND Gould's own plate
 *   __accidentals.gap('musescore')    // 0.25 — = Verovio's `rightMarginAccid`
 *   __accidentals.gap('lilypond')     // 0.35 — skylines, the loosest engine
 *   __accidentals.gap('ross')         // 0.54 — ⭐ the only NUMBER in the library, p. 131
 *   __accidentals.reset()
 * ```
 *
 * ⚠️ **Look at a chord with two or three signs**: the whole column moves together, and the gaps
 * BETWEEN columns are the column rule's (`engrave/notes/accidentalStack`) — this knob moves the stack, not its packing.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly** — the setting lives in the ENGINE, this is the entry
 * point, `App.ts` wires it. Same contract as `dev/dotGapConsole`.
 */
import { dbg } from '@/utils/debug'
import {
  ACCIDENTAL_GAP_RULES, accidentalGapSettings, armedAccidentalGap, resetAccidentalGapRule,
  setAccidentalGapRule, type AccidentalGapRuleName,
} from '@/engine/layout/accidentalGap'

export interface AccidentalGapConsole {
  gap(rule: AccidentalGapRuleName): { rule: AccidentalGapRuleName; gap: number }
  reset(): { rule: AccidentalGapRuleName; gap: number }
  dump(): void
}

const NAMES = Object.keys(ACCIDENTAL_GAP_RULES) as AccidentalGapRuleName[]

export function accidentalGapConsole(render: () => void): AccidentalGapConsole {
  const readout = () => ({ rule: accidentalGapSettings().rule, gap: armedAccidentalGap().gap })
  const report = () =>
    dbg(`[accidentals] armed:${accidentalGapSettings().rule} — ${armedAccidentalGap().gap} sp of ink to the notehead. __accidentals.dump() for the table`)

  return {
    gap: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setAccidentalGapRule(rule)) {
        dbg(`[accidentals] ⛔ no such row: ${rule} — try ${NAMES.map(n => `'${n}'`).join(', ')}`)
        return readout()
      }
      render()
      report()
      return readout()
    },
    reset: () => {
      resetAccidentalGapRule()
      render()
      report()
      return readout()
    },
    dump: () => {
      dbg(`[accidentals] armed: ${accidentalGapSettings().rule}. INK to ink, in staff spaces:`)
      dbg(`  ${'row'.padEnd(11)} ${'gap'.padStart(5)}   source`)
      for (const name of NAMES) {
        const { gap, source } = ACCIDENTAL_GAP_RULES[name]
        const mark = name === accidentalGapSettings().rule ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(11)} ${gap.toFixed(2).padStart(5)}   ${source}`)
      }
      dbg('  ⚠️ Each number is measured against its own engine\'s idea of where a glyph ends —')
      dbg('     cut-outs (MuseScore, Verovio), skylines (LilyPond), plain boxes (ours).')
    },
  }
}
