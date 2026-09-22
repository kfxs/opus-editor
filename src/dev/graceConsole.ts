/**
 * ⭐ **THE GRACE NOTE'S SIZE, FROM THE CONSOLE — his eye, on his own music** (2026-09-22, his ask:
 * *"can we have an instrument to set different size to the grace note?"*).
 *
 * The rows are `engine/layout/graceRoom`'s `GRACE_SIZE_RULES` — every size the research found
 * (`docs/research/grace-notes-research.md` §0.4); a free number is accepted too:
 *
 * ```js
 *   __grace.dump()             // every row, with its source
 *   __grace.size('house')      // ✅ ARMED — 2/3 (D5)
 *   __grace.size('dorico')     // 0.60 — Dorico, and Sibelius
 *   __grace.size('gould')      // 0.625 — her drawings
 *   __grace.size('musescore')  // 0.70
 *   __grace.size(0.62)         // any size from 0.3 to 1
 *   __grace.reset()
 *
 *   // ⭐ the slash on a stem with NO flag (a quarter, a half) — in the GRACE's own staff spaces:
 *   __grace.slash()                                  // what is armed
 *   __grace.slash({ length: 1.5 })                   // any of the three, alone or together
 *   __grace.slash({ angle: 45, crossBelowTip: 1.6 })
 *   __grace.resetSlash()
 * ```
 *
 * ⚠️ A FLAG's slash is not here: it is the font's own (Bravura's anchors on the 8th flag).
 *
 * ⚠️ The size scales the head, flag, accidental, ledger and slash — ⛔ NOT the stem's LENGTH (2.5 sp,
 * its own row) nor the gaps around the group (staff spaces of the page). The room follows the size.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE, this is the entry
 * point, `App.ts` wires it — the `dev/dotGapConsole` contract. ⏭️ When his eye has chosen, the winner
 * becomes the `house` row with his choice as the citation, and this file goes.
 */
import { dbg } from '@/utils/debug'
import {
  GRACE_SIZE_RULES, graceSizeSettings, resetGraceSize, setGraceSize, type GraceSizeRuleName,
} from '@/engine/layout/graceRoom'
import {
  resetUnflaggedSlash, setUnflaggedSlash, unflaggedSlashSettings, type UnflaggedSlash,
} from '@/engine/engrave/notes/graceGroup'

export interface GraceConsole {
  size(rule: GraceSizeRuleName | number): { rule: string; value: number }
  reset(): { rule: string; value: number }
  dump(): void
  slash(change?: Partial<UnflaggedSlash>): UnflaggedSlash
  resetSlash(): UnflaggedSlash
}

const NAMES = Object.keys(GRACE_SIZE_RULES) as GraceSizeRuleName[]

export function graceConsole(render: () => void): GraceConsole {
  const report = () => {
    const { rule, value } = graceSizeSettings()
    dbg(`[grace] size armed: ${rule} = ${value.toFixed(3)}. __grace.dump() for the table`)
    return { rule, value }
  }
  return {
    size: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setGraceSize(rule)) {
        dbg(`[grace] ⛔ no such size: ${rule} — try ${NAMES.map(n => `'${n}'`).join(', ')}, or a number 0.3–1`)
        return graceSizeSettings()
      }
      render()
      return report()
    },
    reset: () => {
      resetGraceSize()
      render()
      return report()
    },
    slash: (change) => {
      if (change) {
        // ⛔ A value out of range is refused, loudly — never half-applied.
        if (!setUnflaggedSlash(change)) {
          dbg('[grace] ⛔ slash refused — length 0.3–5, angle 5–85, crossBelowTip 0–5 (grace staff spaces)')
          return unflaggedSlashSettings()
        }
        render()
      }
      const armed = unflaggedSlashSettings()
      const k = graceSizeSettings().value
      dbg(`[grace] no-flag slash: length ${armed.length.toFixed(2)} (= ${(armed.length * k).toFixed(2)} sp on the page) · angle ${armed.angle.toFixed(1)}° · crosses ${armed.crossBelowTip.toFixed(2)} below the tip`)
      return armed
    },
    resetSlash: () => {
      resetUnflaggedSlash()
      render()
      return unflaggedSlashSettings()
    },
    dump: () => {
      dbg(`[grace] armed: ${graceSizeSettings().rule}. The size against a full note:`)
      for (const name of NAMES) {
        const { value, source } = GRACE_SIZE_RULES[name]
        const mark = name === graceSizeSettings().rule ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(11)} ${value.toFixed(3)}   ${source}`)
      }
    },
  }
}
