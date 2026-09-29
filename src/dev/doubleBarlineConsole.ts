/**
 * `__barlines.double(…)` — the thin double barline's GAP rows, armed from the console
 * (`engine/layout/doubleBarlineGap`, docs/plans/double-barline-plan.md P0). Merged into the existing
 * `__barlines` object in `App.ts`. ⛔ Default = Gould; an unknown name is refused and says what exists.
 */
import { dbg } from '@/utils/debug'
import {
  DOUBLE_BARLINE_GAP_RULES, armedDoubleBarlineGap, doubleBarlineGapSettings, resetDoubleBarlineGapRule,
  setDoubleBarlineGapRule, type DoubleBarlineGapRuleName,
} from '@/engine/layout/doubleBarlineGap'

export interface DoubleBarlineConsole {
  /** Arm a row and re-render; answers what is armed afterwards. */
  double: (rule: DoubleBarlineGapRuleName) => DoubleBarlineGapRuleName
  /** The table, the armed row marked. */
  doubleDump: () => void
  /** Back to Gould. */
  doubleReset: () => DoubleBarlineGapRuleName
}

export function doubleBarlineConsole(render: () => void): DoubleBarlineConsole {
  const NAMES = Object.keys(DOUBLE_BARLINE_GAP_RULES) as DoubleBarlineGapRuleName[]
  const report = () => {
    const { rule } = doubleBarlineGapSettings()
    dbg(`[barlines] double armed:${rule} — gap ${armedDoubleBarlineGap()} sp · ${DOUBLE_BARLINE_GAP_RULES[rule].source}`)
  }
  return {
    double: (rule) => {
      if (!setDoubleBarlineGapRule(rule)) {
        dbg(`[barlines] ⛔ no such double row: ${rule} — try ${NAMES.map(n => `'${n}'`).join(', ')}`)
        return doubleBarlineGapSettings().rule
      }
      render()
      report()
      return doubleBarlineGapSettings().rule
    },
    doubleDump: () => {
      const armed = doubleBarlineGapSettings().rule
      console.table(Object.fromEntries(NAMES.map(n => [
        `${n}${n === armed ? ' ◀' : ''}`, DOUBLE_BARLINE_GAP_RULES[n],
      ])))
    },
    doubleReset: () => {
      resetDoubleBarlineGapRule()
      render()
      report()
      return doubleBarlineGapSettings().rule
    },
  }
}
