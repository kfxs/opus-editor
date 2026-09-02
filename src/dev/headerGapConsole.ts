/**
 * ⭐⭐ **THE GAP IN FRONT OF A FIRST NOTE WITH AN ACCIDENTAL, FROM THE CONSOLE — his eye, on his own
 * music.**
 *
 * His report, 2026-09-02, minutes after Gould's printed table reached the page:
 *
 * > *"i have the feeling that with the accidental is a little too close"* … *"i the case of the clef
 * > is not problem but when there is a time signature, is a little too close to the time signature"*
 *
 * ⭐ **The books do not settle that cell.** Gould's printed label is **1**, her own drawing of the
 * same cell measures **1.15**, and MuseScore never goes below **1.5** of clear white in a header. So
 * the rows are in `engine/layout/headerAccidentalLadder` and this is the entry point that arms one.
 *
 * ✅ **And it worked the same day it was built**: he compared the rows and chose MuseScore's
 * (*"lets make musescore default"*). ⛔ The instrument STAYS — the rows are what a different house
 * style would draw, and the next eye needs them the way his did.
 *
 * ```js
 *   __header.dump()                 // every row's numbers, side by side, with sources
 *   __header.rule('musescore')      // ✅ ARMED, his choice — 1.5 of clear white, always
 *   __header.rule('gouldDrawn')     // her own PLATE — meter+accidental 1.15
 *   __header.rule('gould')          // her printed table — meter+accidental 1.00
 *   __header.rule('lilypond')       // the TIGHTEST — it closes by the accidental's own ink
 *   __header.rule('none')           // what we drew before 2026-09-02 — no rule at all
 *   __header.reset()
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE (`engine/` may not
 * import `dev/`), this is the entry point, and `App.ts` wires it — the same contract as
 * `dev/beamSlopeConsole` and `dev/slurShapeConsole`. ⏭️ When his eye has chosen, the winner is frozen
 * with his choice as the citation and both files go.
 */
import { dbg } from '@/utils/debug'
import {
  HEADER_GAP_RULES, headerGapSettings, resetHeaderGapRule, setHeaderGapRule,
  type HeaderGapRuleName,
} from '@/engine/layout/headerAccidentalLadder'

export interface HeaderGapConsole {
  rule(rule: HeaderGapRuleName): HeaderGapReadout
  reset(): HeaderGapReadout
  dump(): HeaderGapReadout
}

export interface HeaderGapReadout {
  armed: HeaderGapRuleName
  /** The other rows, so the next thing to try is on screen without a second call. */
  others: HeaderGapRuleName[]
  /** ⭐ The cell his report is about: a time signature followed by a note with ONE accidental. */
  meterThenOneAccidental: Record<string, number>
}

export function headerGapConsole(render: () => void): HeaderGapConsole {
  const names = Object.keys(HEADER_GAP_RULES) as HeaderGapRuleName[]
  const readout = (): HeaderGapReadout => {
    const armed = headerGapSettings().rule
    return {
      armed,
      others: names.filter(n => n !== armed),
      meterThenOneAccidental: Object.fromEntries(
        names.map(n => [n, HEADER_GAP_RULES[n].meter[1]])),
    }
  }
  const report = () => dbg(`[header] rule:${headerGapSettings().rule} — __header.dump() for the table`)
  return {
    rule: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setHeaderGapRule(rule)) {
        dbg(`[header] ⛔ no such rule: ${rule} — try ${names.map(n => `'${n}'`).join(', ')}`)
        return readout()
      }
      render()
      report()
      return readout()
    },
    reset: () => {
      resetHeaderGapRule()
      render()
      report()
      return readout()
    },
    dump: () => {
      const { rule, generation } = headerGapSettings()
      dbg(`[header] armed: ${rule} (generation ${generation}). The gap before the first note, in staff spaces,`)
      dbg('         ink to ink, by how many accidentals that note carries — [none, one, more]:')
      for (const name of names) {
        const r = HEADER_GAP_RULES[name]
        const mark = name === rule ? '▶' : ' '
        dbg(`  ${mark} ${name.padEnd(11)} after clef/key [${r.sign.join(', ')}]   after meter [${r.meter.join(', ')}]   — ${r.source}`)
      }
      dbg('[header] ⛔ the FIRST number of each pair is decision D (2½ / 2, his, 2026-09-01) and is not open.')
      return readout()
    },
  }
}
