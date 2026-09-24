/**
 * ⭐ **THE CUE NOTE'S SIZE, FROM THE CONSOLE — his eye, on his own music** (docs/plans/cue-size-plan.md C2,
 * C6). The rows are `engine/layout/cueSize`'s; a free number is accepted too:
 *
 * ```js
 *   __cue.dump()               // every row, with its source
 *   __cue.size('gouldRoss')    // ✅ ARMED — ¾ (Gould p. 569, Ross p. 189)
 *   __cue.size('gouldDrawn')   // 0.62 — what her plates draw
 *   __cue.size('musescore')    // 0.70
 *   __cue.size(0.68)           // any size from 0.3 to 1
 *   __cue.ledger('full')       // ledger weight: 'gould' (✅ thinner, × the size) or 'full'
 *   __cue.graceSize('graceWins') // a CUE GRACE's size (C4): 'multiply' (✅ grace × cue), 'graceWins',
 *                              //   'musescore' 0.49, 'sibelius' 0.45, 'lilypond' 0.445, or a number 0.2–1
 *   __cue.brackets('shrink')   // a cue head's BRACKETS (C11): 'gould' (✅ full size) or 'shrink' (the head's)
 *   __cue.reset()
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE, this is the entry point,
 * `App.ts` wires it — the `dev/graceConsole` contract.
 */
import { dbg } from '@/utils/debug'
import {
  CUE_BRACKET_RULES, CUE_LEDGER_RULES, CUE_SIZE_RULES, GRACE_CUE_SIZE_RULES, cueSizeSettings, graceCueScale, resetCueSize, setCueLedger,
  setCueBrackets, setCueSize, setGraceCueSize, type CueBracketRuleName, type CueLedgerRuleName, type CueSizeRuleName, type GraceCueSizeRuleName,
} from '@/engine/layout/cueSize'
import { graceScale } from '@/engine/layout/graceRoom'

type Settings = ReturnType<typeof cueSizeSettings>

export interface CueConsole {
  size(rule: CueSizeRuleName | number): Settings
  ledger(rule: CueLedgerRuleName): Settings
  graceSize(rule: GraceCueSizeRuleName | number): Settings
  brackets(rule: CueBracketRuleName): Settings
  reset(): Settings
  dump(): void
}

const NAMES = Object.keys(CUE_SIZE_RULES) as CueSizeRuleName[]
const LEDGERS = Object.keys(CUE_LEDGER_RULES) as CueLedgerRuleName[]
const GRACE_ROWS_NAMES = Object.keys(GRACE_CUE_SIZE_RULES) as GraceCueSizeRuleName[]

export function cueConsole(render: () => void): CueConsole {
  const report = () => {
    const armed = cueSizeSettings()
    dbg(`[cue] armed: size ${armed.rule} = ${armed.value.toFixed(3)} · ledgers ${armed.ledger} · cue grace ${armed.grace} = ${graceCueScale(graceScale()).toFixed(3)} · brackets ${armed.brackets}. __cue.dump() for the table`)
    return armed
  }
  return {
    size: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setCueSize(rule)) {
        dbg(`[cue] ⛔ no such size: ${rule} — try ${NAMES.map(n => `'${n}'`).join(', ')}, or a number 0.3–1`)
        return cueSizeSettings()
      }
      render()
      return report()
    },
    ledger: (rule) => {
      if (!setCueLedger(rule)) {
        dbg(`[cue] ⛔ no such ledger row: ${rule} — try ${LEDGERS.map(n => `'${n}'`).join(', ')}`)
        return cueSizeSettings()
      }
      render()
      return report()
    },
    graceSize: (rule) => {
      if (!setGraceCueSize(rule)) {
        dbg(`[cue] ⛔ no such cue-grace size: ${rule} — try ${GRACE_ROWS_NAMES.map(n => `'${n}'`).join(', ')}, or a number 0.2–1`)
        return cueSizeSettings()
      }
      render()
      return report()
    },
    brackets: (rule) => {
      if (!setCueBrackets(rule)) {
        dbg(`[cue] ⛔ no such brackets row: ${rule} — try ${Object.keys(CUE_BRACKET_RULES).map(n => `'${n}'`).join(', ')}`)
        return cueSizeSettings()
      }
      render()
      return report()
    },
    reset: () => {
      resetCueSize()
      render()
      return report()
    },
    dump: () => {
      const armed = cueSizeSettings()
      dbg(`[cue] armed: ${armed.rule}. The size against a full note:`)
      for (const name of NAMES) {
        const { value, source } = CUE_SIZE_RULES[name]
        dbg(`${name === armed.rule ? '✅' : '  '} ${name.padEnd(11)} ${value.toFixed(3)}   ${source}`)
      }
      dbg(`[cue] a CUE GRACE (C4), with today's grace ${graceScale().toFixed(3)}:`)
      for (const name of GRACE_ROWS_NAMES) {
        const { of, source } = GRACE_CUE_SIZE_RULES[name]
        dbg(`${name === armed.grace ? '✅' : '  '} ${name.padEnd(10)} ${of(graceScale(), armed.value).toFixed(3)}   ${source}`)
      }
      dbg('[cue] a cue head’s brackets:')
      for (const [name, row] of Object.entries(CUE_BRACKET_RULES)) dbg(`${name === armed.brackets ? '✅' : '  '} ${name.padEnd(6)} ${row.source}`)
      dbg('[cue] ledger weight:')
      for (const name of LEDGERS) dbg(`${name === armed.ledger ? '✅' : '  '} ${name.padEnd(6)} ${CUE_LEDGER_RULES[name].source}`)
    },
  }
}
