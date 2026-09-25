/**
 * ⭐ **THE GLISSANDO's ROWS, FROM THE CONSOLE** — his eye, on his own music (docs/plans/glissando-plan.md
 * §0.1). The rows are `engine/engrave/marks/glissandoLine`; this arms one. `gould` ships armed — his
 * call, 2026-09-25: *"gould is our preset default (but we need other values like in the other projects)"*.
 *
 * ```js
 *   __gliss.dump()                 // every row, with its source
 *   __gliss.end('gould')           // ✅ ARMED — clear of the heads, each end leaning toward the other note
 *   __gliss.end('musescore')       // head centres, 0.25 sp off the ink
 *   __gliss.end('verovio')         // head centres, 0.5 sp along the line
 *   __gliss.end('lilypond')        // head centres, 0.5 sp along the line, to the accidental's edge
 *   __gliss.thickness('gould')     // ✅ ARMED — a staff line's weight
 *   __gliss.thickness('musescore') // 0.15 sp (also 'verovio'; 'lilypond' 0.10)
 *   __gliss.minLength('musescore') // ✅ ARMED — the spacing is ASKED for 1.2 sp of line (soft: a squeeze wins)
 *   __gliss.minLength('none')      // P1's behaviour — no request
 *   __gliss.squeeze('shrinkGaps')  // ✅ ARMED — squeezed, the gaps give way and the line keeps half the room
 *   __gliss.squeeze('vanish')      // P1's behaviour — no room for the gaps, no line
 *   __gliss.reset()
 * ```
 *
 * ⚠️ Scaffolding: `dev/` may be deleted whole; `App.ts` wires it. The `dev/dotGapConsole` contract.
 */
import { dbg } from '@/utils/debug'
import {
  GLISSANDO_END_RULES, GLISSANDO_SQUEEZE_RULES, GLISSANDO_THICKNESS_RULES, glissandoSettings, glissandoThicknessSpaces,
  resetGlissandoRules, setGlissandoEndRule, setGlissandoSqueezeRule, setGlissandoThicknessRule,
  type GlissandoEndRuleName, type GlissandoSqueezeRuleName, type GlissandoThicknessRuleName,
} from '@/engine/engrave/marks/glissandoLine'
import {
  GLISSANDO_MIN_LENGTH_RULES, glissandoMinLengthSettings, resetGlissandoMinLengthRule, setGlissandoMinLengthRule,
  type GlissandoMinLengthRuleName,
} from '@/engine/layout/glissandoRoom'

export interface GlissandoConsole {
  end(rule: GlissandoEndRuleName): GlissandoEndRuleName
  thickness(rule: GlissandoThicknessRuleName): GlissandoThicknessRuleName
  minLength(rule: GlissandoMinLengthRuleName): GlissandoMinLengthRuleName
  squeeze(rule: GlissandoSqueezeRuleName): GlissandoSqueezeRuleName
  reset(): void
  dump(): void
}

const END_NAMES = Object.keys(GLISSANDO_END_RULES) as GlissandoEndRuleName[]
const THICKNESS_NAMES = Object.keys(GLISSANDO_THICKNESS_RULES) as GlissandoThicknessRuleName[]
const MIN_LENGTH_NAMES = Object.keys(GLISSANDO_MIN_LENGTH_RULES) as GlissandoMinLengthRuleName[]
const SQUEEZE_NAMES = Object.keys(GLISSANDO_SQUEEZE_RULES) as GlissandoSqueezeRuleName[]

export function glissandoConsole(render: () => void): GlissandoConsole {
  const report = () => {
    const { end, thickness, squeeze } = glissandoSettings()
    dbg(`[gliss] armed: ends ${end}, thickness ${thickness} (${glissandoThicknessSpaces().toFixed(3)} sp), minLength ${glissandoMinLengthSettings().rule}, squeeze ${squeeze}. __gliss.dump() for the table`)
  }
  return {
    end: (rule) => {
      if (!setGlissandoEndRule(rule)) {
        dbg(`[gliss] ⛔ no such end row: ${rule} — try ${END_NAMES.map(n => `'${n}'`).join(', ')}`)
        return glissandoSettings().end
      }
      render()
      report()
      return glissandoSettings().end
    },
    thickness: (rule) => {
      if (!setGlissandoThicknessRule(rule)) {
        dbg(`[gliss] ⛔ no such thickness row: ${rule} — try ${THICKNESS_NAMES.map(n => `'${n}'`).join(', ')}`)
        return glissandoSettings().thickness
      }
      render()
      report()
      return glissandoSettings().thickness
    },
    minLength: (rule) => {
      if (!setGlissandoMinLengthRule(rule)) {
        dbg(`[gliss] ⛔ no such minLength row: ${rule} — try ${MIN_LENGTH_NAMES.map(n => `'${n}'`).join(', ')}`)
        return glissandoMinLengthSettings().rule
      }
      render()
      report()
      return glissandoMinLengthSettings().rule
    },
    squeeze: (rule) => {
      if (!setGlissandoSqueezeRule(rule)) {
        dbg(`[gliss] ⛔ no such squeeze row: ${rule} — try ${SQUEEZE_NAMES.map(n => `'${n}'`).join(', ')}`)
        return glissandoSettings().squeeze
      }
      render()
      report()
      return glissandoSettings().squeeze
    },
    reset: () => {
      resetGlissandoRules()
      resetGlissandoMinLengthRule()
      render()
      report()
    },
    dump: () => {
      const { end, thickness } = glissandoSettings()
      dbg('[gliss] END rows — gaps and leans in staff spaces:')
      dbg(`  ${'row'.padEnd(10)} ${'start'.padStart(5)} ${'end'.padStart(5)} ${'acc.'.padStart(5)} ${'lean'.padStart(9)} ${'tilt'.padStart(5)} measured  source`)
      for (const name of END_NAMES) {
        const r = GLISSANDO_END_RULES[name]
        const mark = name === end ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} ${r.startGap.toFixed(2).padStart(5)} ${r.endGap.toFixed(2).padStart(5)} ${r.accidentalGap.toFixed(2).padStart(5)} ${`${r.startBias}/${r.endBias}`.padStart(9)} ${r.sameLineTilt.toFixed(2).padStart(5)} ${r.gapMeasure.padEnd(8)}  ${r.source}`)
      }
      dbg('[gliss] THICKNESS rows:')
      for (const name of THICKNESS_NAMES) {
        const r = GLISSANDO_THICKNESS_RULES[name]
        const mark = name === thickness ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} ${String(r.spaces).padStart(9)}   ${r.source}`)
      }
      dbg('[gliss] MIN LENGTH rows — asked of the spacing, SOFT (a squeeze may go below):')
      for (const name of MIN_LENGTH_NAMES) {
        const r = GLISSANDO_MIN_LENGTH_RULES[name]
        const mark = name === glissandoMinLengthSettings().rule ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} straight ${r.straight} · wavy ${r.wavy}   ${r.source}`)
      }
      dbg('[gliss] SQUEEZE rows — when the heads are too close for the gaps:')
      for (const name of SQUEEZE_NAMES) {
        const r = GLISSANDO_SQUEEZE_RULES[name]
        const mark = name === glissandoSettings().squeeze ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} line keeps ${r.lineShare}   ${r.source}`)
      }
    },
  }
}
