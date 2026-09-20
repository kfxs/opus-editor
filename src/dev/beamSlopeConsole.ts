/**
 * ⭐⭐ **THE BEAM'S SLOPE, FROM THE CONSOLE — the engines' answers, live on his own music.**
 *
 * His ask, 2026-09-01: *"lets not fix the rule, but leave it open, i would like to test the three
 * engine solutions… so we can in the future test the posibilities and try an optimal solution"* —
 * and then, minutes after the first rule reached the page, *"(to my eyes the angle looks too flat
 * now)"*. ⭐ **That is the instrument earning its place on the first day**: the answer is his eye,
 * and his eye needs the alternatives one keystroke apart.
 *
 * ```js
 *   __beams.rule('vexflow')   // what shipped before P4b — VexFlow's ANGLE cap, the steepest
 *   __beams.rule('interval')  // Ross's interval table, WITHOUT Gould's close-notes flattening
 *   __beams.rule('tables')    // Ross + Gould as MuseScore encodes them — the flattest
 *   __beams.dump()            // what is armed, and every rule's budget side by side
 *   __beams.reset()
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE
 * (`engine/rendering/beams/beamSlopeExperiment` — `engine/` may not import `dev/`), this is the entry
 * point, and `App.ts` wires it. ⏭️ When his eye has chosen, the winner is frozen with his choice as
 * the citation and both files go — the same contract as `dev/slurShapeConsole`.
 *
 * ⏭️ **NOT BUILT, deliberately** (`docs/plans/beam-engraving-plan.md`): LilyPond's and Verovio's rows. Both
 * are measured in `docs/research/beam-slope-research.md` §4, and both need the seam widened from a *budget* to
 * a *chosen rise* first. ⭐ This file is the marker that says so.
 */
import { dbg } from '@/utils/debug'
import {
  beamSlopeSettings, resetBeamSlope, setBeamSlopeRule,
} from '@/engine/rendering/beams/beamSlopeExperiment'
import { BEAM_SLOPE_RULES, type BeamSlopeRuleName } from '@/engine/engrave/beams/beamSlope'

/**
 * The shapes worth comparing, as `[interval in diatonic steps, width in staff spaces, what it is]`.
 * ⭐ The first row is the ordinary case in this editor — two quavers, 2.5 spaces apart — and the
 * third is the width Gould DREW her own examples at.
 */
const SHAPES: ReadonlyArray<readonly [number, number, string]> = [
  [1, 2.5, 'a 2nd, two quavers'],
  [2, 2.5, 'a 3rd, two quavers'],
  [4, 2.5, 'a 5th, two quavers'],
  [7, 2.5, 'an octave, two quavers'],
  [2, 4.4, "a 3rd at Gould's own plate (she draws 0.46)"],
  [6, 4.8, "a 7th at Gould's own plate (she draws 1.00)"],
  [4, 5.5, 'a 5th across four semiquavers'],
]

/**
 * ⚠️ Every method RETURNS what is armed, and that is not decoration: a console method returning
 * `void` makes DevTools echo a bare `undefined` under the log line, which reads as a failure to
 * anyone sensible (his question, 2026-09-01). ⭐ An instrument answers.
 */
/**
 * A two-note quaver group of the given interval and width, as the rules want it.
 *
 * ⚠️ `naturalRiseSpaces` is what only a real beam can answer — the outer stem TIPS' distance — so for
 * a console table it is ASSUMED: two notes of equal stem length stand exactly their interval apart,
 * i.e. half a space per diatonic step. ⛔ That is right for a plain pair and wrong for a chord, which
 * is why this shape is a probe and ⛔ not what the renderer feeds the rules.
 */
const probeShape = (intervalSteps: number, widthSpaces: number) => ({
  intervalSteps, widthSpaces, noteCount: 2,
  naturalRiseSpaces: intervalSteps * 0.5,
  beamCount: 1,
})

export interface BeamSlopeConsole {
  rule(rule: BeamSlopeRuleName): BeamSlopeReadout
  reset(): BeamSlopeReadout
  dump(): BeamSlopeReadout
}

export interface BeamSlopeReadout {
  armed: BeamSlopeRuleName
  /** The other rows, so the next thing to try is on screen without a second call. */
  others: BeamSlopeRuleName[]
  /** What the armed rule allows for the ordinary case here: two quavers, 2.5 spaces apart. */
  quaverPairClimbSpaces: Record<string, number>
}

export function beamSlopeConsole(render: () => void): BeamSlopeConsole {
  const names = Object.keys(BEAM_SLOPE_RULES) as BeamSlopeRuleName[]
  const report = () => dbg(`[beams] rule:${beamSlopeSettings().rule} — __beams.dump() for the table`)
  /** ⭐ What every call hands back — see {@link BeamSlopeConsole}. */
  const readout = (): BeamSlopeReadout => {
    const armed = beamSlopeSettings().rule
    const quaverPair = probeShape(4, 2.5)
    return {
      armed,
      others: names.filter(n => n !== armed),
      quaverPairClimbSpaces: Object.fromEntries(
        names.map(n => [n, Number(BEAM_SLOPE_RULES[n](quaverPair).toFixed(3))])),
    }
  }
  return {
    rule: (rule) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setBeamSlopeRule(rule)) {
        dbg(`[beams] ⛔ no such rule: ${rule} — try ${names.map(n => `'${n}'`).join(', ')}`)
        return readout()
      }
      render()
      report()
      return readout()
    },
    reset: () => {
      resetBeamSlope()
      render()
      report()
      return readout()
    },
    dump: () => {
      const { rule, generation } = beamSlopeSettings()
      dbg(`[beams] armed: ${rule} (generation ${generation}). How far each rule lets a beam CLIMB, in staff spaces:`)
      for (const [steps, width, what] of SHAPES) {
        const shape = probeShape(steps, width)
        const cells = names.map(n => `${n} ${BEAM_SLOPE_RULES[n](shape).toFixed(2)}`).join('   ')
        dbg(`  ${what.padEnd(46)} ${cells}`)
      }
      dbg('[beams] ⏭️ lilypond and verovio are NOT rows yet — docs/research/beam-slope-research.md §4 has both measured.')
      return readout()
    },
  }
}
