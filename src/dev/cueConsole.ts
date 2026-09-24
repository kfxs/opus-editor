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
 *   __cue.reset()
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE, this is the entry point,
 * `App.ts` wires it — the `dev/graceConsole` contract.
 */
import { dbg } from '@/utils/debug'
import {
  CUE_LEDGER_RULES, CUE_SIZE_RULES, cueSizeSettings, resetCueSize, setCueLedger, setCueSize,
  type CueLedgerRuleName, type CueSizeRuleName,
} from '@/engine/layout/cueSize'

type Settings = ReturnType<typeof cueSizeSettings>

export interface CueConsole {
  size(rule: CueSizeRuleName | number): Settings
  ledger(rule: CueLedgerRuleName): Settings
  reset(): Settings
  dump(): void
}

const NAMES = Object.keys(CUE_SIZE_RULES) as CueSizeRuleName[]
const LEDGERS = Object.keys(CUE_LEDGER_RULES) as CueLedgerRuleName[]

export function cueConsole(render: () => void): CueConsole {
  const report = () => {
    const armed = cueSizeSettings()
    dbg(`[cue] armed: size ${armed.rule} = ${armed.value.toFixed(3)} · ledgers ${armed.ledger}. __cue.dump() for the table`)
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
      dbg('[cue] ledger weight:')
      for (const name of LEDGERS) dbg(`${name === armed.ledger ? '✅' : '  '} ${name.padEnd(6)} ${CUE_LEDGER_RULES[name].source}`)
    },
  }
}
