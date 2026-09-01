/**
 * ⭐⭐ **THE SPACING LAW, FROM THE CONSOLE — six houses, live on his own music.**
 *
 * His ask, 2026-09-01: *"it would be nice to have also an instrument to changes the algorithm so we
 * can really test and decide"*. ⭐ The same shape as `__beams` and `__slur`, one layer down — and the
 * biggest of the three, because a spacing law changes **every horizontal distance on the page**.
 *
 * ```js
 *   __spacing.law('gould')     // ⭐ her PRINTED TABLE (p. 39), not a fit of it
 *   __spacing.law('ross')      // ⭐ his printed table (p. 77) — the same table, two values apart
 *   __spacing.law('dorico')    // 3.5 × √t — Gould read as Dorico reads her
 *   __spacing.law('sibelius')  // ⚠️ second-hand: the shipped lookup
 *   __spacing.law('musescore') // power, ratio 1.5
 *   __spacing.law('verovio')   // power, ratio 2^0.6
 *   __spacing.law('finale')    // ⚠️ second-hand: the golden ratio
 *   __spacing.law('even')      // ⭐ every event the same 1.8 spaces — what we drew BEFORE the model
 *   __spacing.law('proportional') // ⭐ twice the duration, twice the space — his "evenness" axis
 *   __spacing.law('lilypond')  // the LOG law — TODAY'S
 *   __spacing.dump()           // every law's spaces-per-duration, side by side
 *   __spacing.reset()
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the cell lives in `engine/layout/spacing`, the names in
 * `engine/layout/spacingExperiment` (`engine/` may not import `dev/`), this is the entry point, and
 * `App.ts` wires it.
 *
 * ⚠️ **What a comparison here can and cannot settle.** All the power rows are anchored at the same
 * quarter (3.5 spaces), so what changes between them is the CURVE — how much a semiquaver keeps and
 * how much a semibreve takes. ⛔ It cannot tell you whether 3.5 itself is right; that is the question
 * the plate measurements are for.
 */
import { dbg } from '@/utils/debug'
import {
  SPACING_LAWS, resetSpacingLaw, setSpacingLaw, spacingSettings, type SpacingLawName,
} from '@/engine/layout/spacingExperiment'
import { followingSpace } from '@/engine/layout/spacing'
import { fracCreate } from '@/utils/fraction'

/** The durations Gould's own table is written over — so the dump lines up with her p. 39. */
const DURATIONS: ReadonlyArray<readonly [string, number, number]> = [
  ['𝅘𝅥𝅯 16th', 1, 4], ['♪ 8th', 1, 2], ['♪. dotted 8th', 3, 4], ['♩ quarter', 1, 1],
  ['♩. dotted ♩', 3, 2], ['𝅗𝅥 half', 2, 1], ['𝅗𝅥. dotted 𝅗𝅥', 3, 1], ['𝅝 whole', 4, 1],
]

/** ⭐ Gould's own units, for the same rows — the thing every law is a fit to.
 *  🚨 The quaver is **2½**: this read 2¼ until 2026-09-01, from a facsimile rather than the book. */
const GOULD_UNITS = [2, 2.5, 3, 3.5, 4, 5, 6, 7]

export interface SpacingConsole {
  law(law: SpacingLawName): SpacingReadout
  reset(): SpacingReadout
  dump(): SpacingReadout
}

export interface SpacingReadout {
  armed: SpacingLawName
  others: SpacingLawName[]
  /** What a quaver and a crotchet get under the armed law, in staff spaces. */
  quaverSpaces: number
  quarterSpaces: number
}

export function spacingConsole(render: () => void): SpacingConsole {
  const names = Object.keys(SPACING_LAWS) as SpacingLawName[]
  const readout = (): SpacingReadout => {
    const armed = spacingSettings().law
    return {
      armed,
      others: names.filter(n => n !== armed),
      quaverSpaces: Number(followingSpace(fracCreate(1, 2)).toFixed(3)),
      quarterSpaces: Number(followingSpace(fracCreate(1, 1)).toFixed(3)),
    }
  }
  const report = () => dbg(`[spacing] law:${spacingSettings().law} — __spacing.dump() for the table`)
  return {
    law: (law) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setSpacingLaw(law)) {
        dbg(`[spacing] ⛔ no such law: ${law} — try ${names.map(n => `'${n}'`).join(', ')}`)
        return readout()
      }
      render()
      report()
      return readout()
    },
    reset: () => {
      resetSpacingLaw()
      render()
      report()
      return readout()
    },
    dump: () => {
      dbg(`[spacing] armed: ${spacingSettings().law}. Staff spaces FOLLOWING each duration:`)
      dbg(`  ${'duration'.padEnd(16)} ${'Gould'.padStart(6)} ${names.map(n => n.slice(0, 9).padStart(9)).join('')}`)
      DURATIONS.forEach(([what, num, den], i) => {
        const q = fracCreate(num, den)
        const cells = names.map(n => followingSpace(q, SPACING_LAWS[n]).toFixed(2).padStart(9)).join('')
        dbg(`  ${what.padEnd(16)} ${GOULD_UNITS[i].toFixed(2).padStart(6)}${cells}`)
      })
      dbg('[spacing] ⚠️ finale + dorico + sibelius are SECOND-HAND (closed source). ⭐ gould + ross are PRINTED TABLES, read from the books 2026-09-01.')
      dbg("[spacing] ⭐ 'even' = every event alike (the pre-model rule); 'proportional' = space ∝ time (his axis). ⛔ VexFlow's own law is not a curve — see spacingExperiment's header.")
      return readout()
    },
  }
}
