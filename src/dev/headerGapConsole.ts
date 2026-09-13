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
 *
 *   __header.dumpClefMeter()        // ⭐ the OTHER gap: CLEF → METER, no key signature
 *   __header.clefMeter('stone')     // ✅ ARMED, his choice — 1.0 sp of clear white
 *   __header.clefMeter('books')     // 1.05 — the median of every plate in the library
 *   __header.clefMeter('rossCompass')  // 0.82 — spaced like the first accidental, as Ross does
 *   __header.clefMeter('lilypond')  // 1.52 — ≈ the picture we drew before 2026-09-12
 *   __header.resetClefMeter()
 *
 *   __header.dumpBarlineMeter()        // ⭐ the THIRD gap: BARLINE → METER, a mid-line change
 *   __header.barlineMeter('gerouLusk') // ✅ ARMED, his choice — 0.75, "a little less" than the books
 *   __header.barlineMeter('books')     // 1.00 — Stone p. 46, stated AND drawn
 *   __header.barlineMeter('musescore') // 0.63
 *   __header.barlineMeter('vexflow')   // 0.50 — the unchosen number we drew before
 *   __header.resetBarlineMeter()
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
import {
  BARLINE_METER_RULES, barlineMeterSettings, resetBarlineMeterRule, setBarlineMeterRule,
  type BarlineMeterRuleName,
} from '@/engine/layout/barlineMeterGap'
import {
  CLEF_METER_RULES, clefMeterSettings, resetClefMeterRule, setClefMeterRule,
  type ClefMeterRuleName,
} from '@/engine/layout/clefMeterGap'

export interface HeaderGapConsole {
  rule(rule: HeaderGapRuleName): HeaderGapReadout
  reset(): HeaderGapReadout
  dump(): HeaderGapReadout
  /**
   * ⭐ **The OTHER header gap his eye found, 2026-09-12: CLEF → METER with no key signature**
   * (`engine/layout/clefMeterGap`). A second question on the same run, so it lives on the same
   * console rather than growing a second global.
   */
  clefMeter(rule: ClefMeterRuleName): ClefMeterReadout
  resetClefMeter(): ClefMeterReadout
  dumpClefMeter(): ClefMeterReadout
  /**
   * ⭐ The third gap on the same run: how far after a BARLINE a mid-line time-signature change
   * stands (`engine/layout/barlineMeterGap`). ⚠️ Only a bar whose header is a meter and nothing
   * else changes — a meter after a clef or a key signature is the other two knobs.
   */
  barlineMeter(rule: BarlineMeterRuleName): BarlineMeterReadout
  resetBarlineMeter(): BarlineMeterReadout
  dumpBarlineMeter(): BarlineMeterReadout
}

export interface BarlineMeterReadout {
  armed: BarlineMeterRuleName
  ink: Record<string, number>
}

export interface ClefMeterReadout {
  armed: ClefMeterRuleName
  /** The clear white each row would draw, in staff spaces, ink to ink. */
  ink: Record<string, number>
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
  const bmNames = Object.keys(BARLINE_METER_RULES) as BarlineMeterRuleName[]
  const bmReadout = (): BarlineMeterReadout => ({
    armed: barlineMeterSettings().rule,
    ink: Object.fromEntries(bmNames.map(n => [n, BARLINE_METER_RULES[n].ink])),
  })
  const cmNames = Object.keys(CLEF_METER_RULES) as ClefMeterRuleName[]
  const cmReadout = (): ClefMeterReadout => ({
    armed: clefMeterSettings().rule,
    ink: Object.fromEntries(cmNames.map(n => [n, CLEF_METER_RULES[n].ink])),
  })
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
    clefMeter: (rule) => {
      if (!setClefMeterRule(rule)) {
        dbg(`[header] ⛔ no such clef→meter rule: ${rule} — try ${cmNames.map(n => `'${n}'`).join(', ')}`)
        return cmReadout()
      }
      render()
      dbg(`[header] clef→meter:${clefMeterSettings().rule} — __header.dumpClefMeter() for the table`)
      return cmReadout()
    },
    resetClefMeter: () => {
      resetClefMeterRule()
      render()
      return cmReadout()
    },
    dumpClefMeter: () => {
      const { rule, generation } = clefMeterSettings()
      dbg(`[header] clef→meter armed: ${rule} (generation ${generation}). CLEAR WHITE in staff spaces,`)
      dbg('         the clef’s rightmost ink → the time signature’s leftmost, with NO key signature:')
      for (const name of cmNames) {
        const r = CLEF_METER_RULES[name]
        const mark = name === rule ? '▶' : ' '
        dbg(`  ${mark} ${name.padEnd(12)} ${r.ink.toFixed(2)} sp   — ${r.source}`)
      }
      dbg('[header] ⛔ before 2026-09-12 this was VexFlow’s 15 px padding — 1.42 sp, and nobody chose it.')
      return cmReadout()
    },
    barlineMeter: (rule) => {
      if (!setBarlineMeterRule(rule)) {
        dbg(`[header] ⛔ no such barline→meter rule: ${rule} — try ${bmNames.map(n => `'${n}'`).join(', ')}`)
        return bmReadout()
      }
      render()
      dbg(`[header] barline→meter:${barlineMeterSettings().rule} — __header.dumpBarlineMeter() for the table`)
      return bmReadout()
    },
    resetBarlineMeter: () => {
      resetBarlineMeterRule()
      render()
      return bmReadout()
    },
    dumpBarlineMeter: () => {
      const { rule, generation } = barlineMeterSettings()
      dbg(`[header] barline→meter armed: ${rule} (generation ${generation}). CLEAR WHITE in staff spaces,`)
      dbg('         the barline’s right ink → the digits’ leftmost, on a MID-LINE meter change:')
      for (const name of bmNames) {
        const r = BARLINE_METER_RULES[name]
        const mark = name === rule ? '▶' : ' '
        dbg(`  ${mark} ${name.padEnd(10)} ${r.ink.toFixed(2)} sp   — ${r.source}`)
      }
      dbg('[header] ⚠️ the books say 1.0 and HIS EYE said less — `books` is the row to go back to.')
      return bmReadout()
    },
  }
}
