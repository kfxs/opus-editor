/**
 * ⭐ **THE GLISSANDO's ROWS, FROM THE CONSOLE** — his eye, on his own music (docs/plans/glissando-plan.md
 * §0.1). The rows are `engine/engrave/marks/glissandoLine`; this arms one. `gould` ships armed — his
 * call, 2026-09-25: *"gould is our preset default (but we need other values like in the other projects)"*.
 *
 * ```js
 *   __gliss.dump()                 // every row, with its source
 *   __gliss.end('house')           // Gould's angle, 0.3 sp before an accidental's real ink
 *   __gliss.end('houseClear')      // house, and a sign the line passes CLOSE BY stops it too (the ♭ case)
 *   __gliss.end('houseBase')       // ✅ ARMED — his idea: the end at the target head's side or base, the start round the head with the angle
 *   __gliss.end('houseBox')        // house, measured to the sign's BOX (the simple way) — compare with 'house'
 *   __gliss.end('gould')           // her plates: clear of the heads, leaning toward each other, 0.8 before a ♯
 *   __gliss.end('musescore')       // aimed through the head CENTRES, cut 0.25 sp off the ink
 *   __gliss.end('verovio')         // aimed through the centres, 0.5 sp along; slides under an accidental
 *   __gliss.end('lilypond')        // edge to edge, 0.5 sp along; re-angled to the accidental's edge
 *   __gliss.accidentalGap(0.15)    // the stop before an accidental, sp, over the armed row (null = the row's)
 *   __gliss.thickness('gould')     // ✅ ARMED — a staff line's weight
 *   __gliss.thickness('musescore') // 0.15 sp (also 'verovio'; 'lilypond' 0.10)
 *   __gliss.minLength('musescore') // ✅ ARMED — the spacing is ASKED for 1.2 sp of line (soft: a squeeze wins)
 *   __gliss.minLength('none')      // P1's behaviour — no request
 *   __gliss.squeeze('shrinkGaps')  // ✅ ARMED — squeezed, the gaps give way and the line keeps half the room
 *   __gliss.squeeze('vanish')      // P1's behaviour — no room for the gaps, no line
 *   __gliss.breaks('gould')        // ✅ ARMED — across a system break each piece spans the WHOLE interval
 *   __gliss.breaks('musescore')    // one line, one slope, cut at the break (MuseScore, LilyPond)
 *   __gliss.textPlace('gould')     // ✅ ARMED — the word 0.35 sp above the line, dropped unless it fits · 'musescore' 0.1
 *   __gliss.freeEnd('gould')       // ✅ ARMED — a free end 3.8 sp across × 1.3 sp (p. 411 (c)); 'musescore' / 'rossShort' / 'rossLong'
 *
 *   // ⭐ P3, until the Properties window has it — on the glissandi of the SELECTED notes (one undo step each):
 *   __gliss.side('before')         // a line INTO the note from nothing (scoop, lift, plop) · 'after' back
 *   __gliss.target('none')         // a free end even with a note next (fall, doit) · 'next' back
 *   __gliss.direction('up')        // which way the free end goes · 'down'
 *   __gliss.reset()
 * ```
 *
 * ⚠️ Scaffolding: `dev/` may be deleted whole; `App.ts` wires it. The `dev/dotGapConsole` contract.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import {
  glissandoAccidentalGapOverride, setGlissandoAccidentalGap, armedGlissandoEndRule,
  GLISSANDO_FREE_END_RULES, glissandoFreeEndSettings, resetGlissandoFreeEndRule, setGlissandoFreeEndRule,
  GLISSANDO_TEXT_RULES, glissandoTextSettings, resetGlissandoTextRule, setGlissandoTextRule, type GlissandoTextRuleName,
  type GlissandoFreeEndRuleName,
  GLISSANDO_BREAK_RULES, GLISSANDO_END_RULES, GLISSANDO_SQUEEZE_RULES, glissandoBreakSettings, resetGlissandoBreakRule, setGlissandoBreakRule,
  type GlissandoBreakRuleName, GLISSANDO_THICKNESS_RULES, glissandoSettings, glissandoThicknessSpaces,
  resetGlissandoRules, setGlissandoEndRule, setGlissandoSqueezeRule, setGlissandoThicknessRule,
  type GlissandoEndRuleName, type GlissandoSqueezeRuleName, type GlissandoThicknessRuleName,
} from '@/engine/engrave/marks/glissandoLine'
import {
  GLISSANDO_MIN_LENGTH_RULES, glissandoMinLengthSettings, resetGlissandoMinLengthRule, setGlissandoMinLengthRule,
  type GlissandoMinLengthRuleName,
} from '@/engine/layout/glissandoRoom'

/** What the console needs from the app: a render, and the selected notes' glissandi to act on. */
export interface GlissandoConsoleDeps {
  render: () => void
  getEngine: () => MusicEngine | null
  selectedNoteIds: () => string[]
}

export interface GlissandoConsole {
  freeEnd(rule: GlissandoFreeEndRuleName): GlissandoFreeEndRuleName
  textPlace(rule: GlissandoTextRuleName): GlissandoTextRuleName
  side(side: 'before' | 'after'): number
  target(end: 'none' | 'next'): number
  direction(direction: 'up' | 'down'): number
  end(rule: GlissandoEndRuleName): GlissandoEndRuleName
  accidentalGap(spaces: number | null): number
  thickness(rule: GlissandoThicknessRuleName): GlissandoThicknessRuleName
  minLength(rule: GlissandoMinLengthRuleName): GlissandoMinLengthRuleName
  squeeze(rule: GlissandoSqueezeRuleName): GlissandoSqueezeRuleName
  breaks(rule: GlissandoBreakRuleName): GlissandoBreakRuleName
  reset(): void
  dump(): void
}

const END_NAMES = Object.keys(GLISSANDO_END_RULES) as GlissandoEndRuleName[]
const THICKNESS_NAMES = Object.keys(GLISSANDO_THICKNESS_RULES) as GlissandoThicknessRuleName[]
const MIN_LENGTH_NAMES = Object.keys(GLISSANDO_MIN_LENGTH_RULES) as GlissandoMinLengthRuleName[]
const SQUEEZE_NAMES = Object.keys(GLISSANDO_SQUEEZE_RULES) as GlissandoSqueezeRuleName[]
const BREAK_NAMES = Object.keys(GLISSANDO_BREAK_RULES) as GlissandoBreakRuleName[]

export function glissandoConsole(deps: GlissandoConsoleDeps): GlissandoConsole {
  const { render } = deps
  /** The glissandi on the selected heads. */
  const selected = (): string[] => {
    const engine = deps.getEngine()
    if (!engine) return []
    return deps.selectedNoteIds().map(id => engine.glissando.on(id)?.id).filter((id): id is string => !!id)
  }
  const act = (label: string, run: (engine: MusicEngine, ids: string[]) => number): number => {
    const engine = deps.getEngine()
    const ids = selected()
    if (!engine || !ids.length) {
      dbg(`[gliss] ${label}: select a note that carries a glissando first`)
      return 0
    }
    const changed = run(engine, ids)
    if (changed) render()
    dbg(`[gliss] ${label}: ${changed} of ${ids.length} changed`)
    return changed
  }
  const report = () => {
    const { end, thickness, squeeze } = glissandoSettings()
    dbg(`[gliss] armed: ends ${end}, thickness ${thickness} (${glissandoThicknessSpaces().toFixed(3)} sp), minLength ${glissandoMinLengthSettings().rule}, before an accidental ${armedGlissandoEndRule().accidentalGap} sp${glissandoAccidentalGapOverride() === null ? '' : ' (knob)'}, squeeze ${squeeze}, breaks ${glissandoBreakSettings().rule}. __gliss.dump() for the table`)
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
    accidentalGap: (spaces) => {
      if (!setGlissandoAccidentalGap(spaces)) {
        dbg(`[gliss] ⛔ not a gap: ${spaces} — a number of staff spaces ≥ 0, or null for the row's own`)
      } else {
        render()
        report()
      }
      return armedGlissandoEndRule().accidentalGap
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
    breaks: (rule) => {
      if (!setGlissandoBreakRule(rule)) {
        dbg(`[gliss] ⛔ no such breaks row: ${rule} — try ${BREAK_NAMES.map(n => `'${n}'`).join(', ')}`)
        return glissandoBreakSettings().rule
      }
      render()
      report()
      return glissandoBreakSettings().rule
    },
    freeEnd: (rule) => {
      if (!setGlissandoFreeEndRule(rule)) {
        dbg(`[gliss] ⛔ no such freeEnd row: ${rule} — try ${Object.keys(GLISSANDO_FREE_END_RULES).map(n => `'${n}'`).join(', ')}`)
        return glissandoFreeEndSettings().rule
      }
      render()
      report()
      return glissandoFreeEndSettings().rule
    },
    textPlace: (rule) => {
      if (!setGlissandoTextRule(rule)) {
        dbg(`[gliss] ⛔ no such textPlace row: ${rule} — try ${Object.keys(GLISSANDO_TEXT_RULES).map(n => `'${n}'`).join(', ')}`)
        return glissandoTextSettings().rule
      }
      render()
      report()
      return glissandoTextSettings().rule
    },
    side: (side) => act(`side ${side}`, (engine, ids) => engine.glissando.setSide(ids, side)),
    target: (end) => act(`target ${end}`, (engine, ids) => engine.glissando.setEnd(ids, end)),
    direction: (direction) => act(`direction ${direction}`, (engine, ids) => engine.glissando.setDirection(ids, direction)),
    reset: () => {
      resetGlissandoFreeEndRule()
      resetGlissandoTextRule()
      resetGlissandoRules()
      resetGlissandoBreakRule()
      resetGlissandoMinLengthRule()
      render()
      report()
    },
    dump: () => {
      const { end, thickness } = glissandoSettings()
      dbg('[gliss] END rows — gaps and leans in staff spaces:')
      dbg(`  ${'row'.padEnd(10)} ${'start'.padStart(5)} ${'end'.padStart(5)} ${'acc.'.padStart(5)} ${'lean'.padStart(9)} ${'tilt'.padStart(5)} aim      measured before♯  source`)
      for (const name of END_NAMES) {
        const r = GLISSANDO_END_RULES[name]
        const mark = name === end ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} ${r.startGap.toFixed(2).padStart(5)} ${r.endGap.toFixed(2).padStart(5)} ${r.accidentalGap.toFixed(2).padStart(5)} ${`${r.startBias}/${r.endBias}`.padStart(9)} ${r.sameLineTilt.toFixed(2).padStart(5)} ${r.aim.padEnd(8)} ${r.gapMeasure.padEnd(8)} ${r.accidental.padEnd(8)}  ${r.source}`)
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
      dbg('[gliss] BREAK rows — across a system break:')
      for (const name of BREAK_NAMES) {
        const r = GLISSANDO_BREAK_RULES[name]
        const mark = name === glissandoBreakSettings().rule ? '✅' : '  '
        dbg(`${mark} ${name.padEnd(10)} ${r.slope} · ${r.beforeBarline} sp before the barline · ${r.afterHeader} sp after the header   ${r.source}`)
      }
    },
  }
}
