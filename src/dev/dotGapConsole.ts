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
 *
 *   // ⭐ Dots and a stem-up FLAG — when they are pushed past it, and how far (P4c, `layout/dotFlag`):
 *   __dots.flag('gould')       // ✅ ARMED — only when the tail meets the dot; 0.30 past the flag
 *   __dots.flag('ross')        // always; 0.20
 *   __dots.flag('gerouLusk')   // always; 0.03 (their dot lines up with the flag's bulge)
 *   __dots.flag('lilypond')    // when level; 0.45
 *   __dots.flag('musescore')   // when level; 0
 *   __dots.flag('verovio')     // when level; 0.09
 *   __dots.flag('vexflow')     // every flagged stem-up note, the flag's width — what we drew until 2026-09-25
 *   __dots.flagReset()
 *
 *   // ⭐ TWO VOICES — which way a stem-down line note's dot goes (P4d, `layout/dotVoice`):
 *   __dots.voice('gould')      // ✅ ARMED — below the lower part; crossed parts lift it (pp. 56 + 58)
 *   __dots.voice('verovio')    // below, no exception
 *   __dots.voice('vexflow')    // always up — what we drew until 2026-09-25
 *   __dots.voiceReset()
 *
 *   // ⭐ A CHORD whose dots collide — a cluster of seconds (P4e, `layout/chordDots`):
 *   __dots.chord('gould')      // ✅ ARMED — a space each, centred; surplus dropped (pp. 55–56)
 *   __dots.chord('lilypond')   // its chain shift + chord-dots-limit 3 — ported from source, on EVERY chord
 *   __dots.chord('musescore')  // its one-flip walk — two dots CAN share a space; ported, on EVERY chord
 *   __dots.chord('verovio')    // coincident dots merge into one
 *   __dots.chord('vexflow')    // two dots in one space — what we drew until 2026-09-25
 *   __dots.chordReset()
 *
 *   // ⭐ The dot's SIZE (P4f, `layout/dotSize`):
 *   __dots.size('gould')       // ✅ ARMED — 0.49 sp, her plates
 *   __dots.size('font')        // the face's own glyph (Bravura 0.40) — what we drew until 2026-09-25
 *   __dots.size('ross')        // ⅓ sp, stated
 *   __dots.size('gerouLusk')   // ≈0.3 sp, drawn
 *   __dots.sizeReset()
 *
 *   // ⭐ A dotted note TIED — the tie before or after the dot (P4g, `layout/dotTie`):
 *   __dots.tie('gould')        // ✅ ARMED — the dot within the tie (p. 63); what we draw
 *   __dots.tie('gerouLusk')    // the tie after the dot (p. 22) — their white UNKNOWN, read as 0
 *   __dots.tieReset()
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
  DOT_TIE_RULES, dotTieSettings, resetDotTieRule, setDotTieRule, type DotTieRuleName,
} from '@/engine/layout/dotTie'
import {
  DOT_SIZE_RULES, dotSizeSettings, resetDotSizeRule, setDotSizeRule, type DotSizeRuleName,
} from '@/engine/layout/dotSize'
import {
  CHORD_DOT_RULES, chordDotSettings, resetChordDotRule, setChordDotRule, type ChordDotRuleName,
} from '@/engine/layout/chordDots'
import {
  DOT_VOICE_RULES, dotVoiceSettings, resetDotVoiceRule, setDotVoiceRule, type DotVoiceRuleName,
} from '@/engine/layout/dotVoice'
import {
  DOT_FLAG_RULES, dotFlagSettings, resetDotFlagRule, setDotFlagRule, type DotFlagRuleName,
} from '@/engine/layout/dotFlag'
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
  /** Dots and a stem-up FLAG (P4c). */
  flag(rule: DotFlagRuleName): DotFlagRuleName
  flagReset(): DotFlagRuleName
  /** Two voices: which way a stem-down line note's dot goes (P4d). */
  voice(rule: DotVoiceRuleName): DotVoiceRuleName
  voiceReset(): DotVoiceRuleName
  /** A chord whose dots collide (P4e). */
  chord(rule: ChordDotRuleName): ChordDotRuleName
  chordReset(): ChordDotRuleName
  /** The dot's size (P4f). */
  size(rule: DotSizeRuleName): DotSizeRuleName
  sizeReset(): DotSizeRuleName
  /** A dotted note tied (P4g). */
  tie(rule: DotTieRuleName): DotTieRuleName
  tieReset(): DotTieRuleName
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

  const FLAG_NAMES = Object.keys(DOT_FLAG_RULES) as DotFlagRuleName[]
  const flagReport = () => dbg(`[dots] flag armed:${dotFlagSettings().rule} — ${DOT_FLAG_RULES[dotFlagSettings().rule].source}`)

  const VOICE_NAMES = Object.keys(DOT_VOICE_RULES) as DotVoiceRuleName[]
  const voiceReport = () => dbg(`[dots] voice armed:${dotVoiceSettings().rule} — ${DOT_VOICE_RULES[dotVoiceSettings().rule].source}`)

  const CHORD_NAMES = Object.keys(CHORD_DOT_RULES) as ChordDotRuleName[]
  const chordReport = () => dbg(`[dots] chord armed:${chordDotSettings().rule} — ${CHORD_DOT_RULES[chordDotSettings().rule].source}`)

  const SIZE_NAMES = Object.keys(DOT_SIZE_RULES) as DotSizeRuleName[]
  const sizeReport = () => dbg(`[dots] size armed:${dotSizeSettings().rule} — ${DOT_SIZE_RULES[dotSizeSettings().rule].source}`)

  const TIE_NAMES = Object.keys(DOT_TIE_RULES) as DotTieRuleName[]
  const tieReport = () => dbg(`[dots] tie armed:${dotTieSettings().rule} — ${DOT_TIE_RULES[dotTieSettings().rule].source}`)

  return {
    tie: (rule) => {
      if (!setDotTieRule(rule)) {
        dbg(`[dots] ⛔ no such tie row: ${rule} — try ${TIE_NAMES.map(n => `'${n}'`).join(', ')}`)
        return dotTieSettings().rule
      }
      render()
      tieReport()
      return dotTieSettings().rule
    },
    tieReset: () => {
      resetDotTieRule()
      render()
      tieReport()
      return dotTieSettings().rule
    },
    size: (rule) => {
      if (!setDotSizeRule(rule)) {
        dbg(`[dots] ⛔ no such size row: ${rule} — try ${SIZE_NAMES.map(n => `'${n}'`).join(', ')}`)
        return dotSizeSettings().rule
      }
      render()
      sizeReport()
      return dotSizeSettings().rule
    },
    sizeReset: () => {
      resetDotSizeRule()
      render()
      sizeReport()
      return dotSizeSettings().rule
    },
    chord: (rule) => {
      if (!setChordDotRule(rule)) {
        dbg(`[dots] ⛔ no such chord row: ${rule} — try ${CHORD_NAMES.map(n => `'${n}'`).join(', ')}`)
        return chordDotSettings().rule
      }
      render()
      chordReport()
      return chordDotSettings().rule
    },
    chordReset: () => {
      resetChordDotRule()
      render()
      chordReport()
      return chordDotSettings().rule
    },
    voice: (rule) => {
      if (!setDotVoiceRule(rule)) {
        dbg(`[dots] ⛔ no such voice row: ${rule} — try ${VOICE_NAMES.map(n => `'${n}'`).join(', ')}`)
        return dotVoiceSettings().rule
      }
      render()
      voiceReport()
      return dotVoiceSettings().rule
    },
    voiceReset: () => {
      resetDotVoiceRule()
      render()
      voiceReport()
      return dotVoiceSettings().rule
    },
    flag: (rule) => {
      if (!setDotFlagRule(rule)) {
        dbg(`[dots] ⛔ no such flag row: ${rule} — try ${FLAG_NAMES.map(n => `'${n}'`).join(', ')}`)
        return dotFlagSettings().rule
      }
      render()
      flagReport()
      return dotFlagSettings().rule
    },
    flagReset: () => {
      resetDotFlagRule()
      render()
      flagReport()
      return dotFlagSettings().rule
    },
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
      dbg(`[dots] FLAG rows (armed: ${dotFlagSettings().rule}) — __dots.flag(…):`)
      for (const name of FLAG_NAMES) {
        const row = DOT_FLAG_RULES[name]
        const mark = name === dotFlagSettings().rule ? '✅' : '  '
        const what = 'vexflow' in row ? 'always, the flag’s width' : `${row.when}, ${row.clear.toFixed(2)} past the flag`
        dbg(`${mark} ${name.padEnd(12)} ${what.padEnd(28)} ${row.source}`)
      }
      dbg(`[dots] TIE rows (armed: ${dotTieSettings().rule}) — __dots.tie(…):`)
      for (const name of TIE_NAMES) {
        dbg(`${name === dotTieSettings().rule ? '✅' : '  '} ${name.padEnd(12)} ${DOT_TIE_RULES[name].source}`)
      }
      dbg(`[dots] SIZE rows (armed: ${dotSizeSettings().rule}) — __dots.size(…):`)
      for (const name of SIZE_NAMES) {
        const { size, source } = DOT_SIZE_RULES[name]
        dbg(`${name === dotSizeSettings().rule ? '✅' : '  '} ${name.padEnd(12)} ${(size === null ? 'the face’s' : size.toFixed(2)).padEnd(11)} ${source}`)
      }
      dbg(`[dots] CHORD rows (armed: ${chordDotSettings().rule}) — __dots.chord(…):`)
      for (const name of CHORD_NAMES) {
        dbg(`${name === chordDotSettings().rule ? '✅' : '  '} ${name.padEnd(12)} ${CHORD_DOT_RULES[name].source}`)
      }
      dbg(`[dots] VOICE rows (armed: ${dotVoiceSettings().rule}) — __dots.voice(…):`)
      for (const name of VOICE_NAMES) {
        dbg(`${name === dotVoiceSettings().rule ? '✅' : '  '} ${name.padEnd(12)} ${DOT_VOICE_RULES[name].source}`)
      }
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
