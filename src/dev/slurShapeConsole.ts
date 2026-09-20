/**
 * ⭐⭐ **THE SLUR'S SHAPE, FROM THE CONSOLE — three engines' laws, live on his own music.**
 *
 * His ask, 2026-08-31: *"so, do you have any idea how to improve the slur now?"* → *"yes"* to putting
 * the choice under his eye instead of under my arithmetic.
 *
 * ```js
 *   __slur.law('musescore')  // 'lilypond' (today's) | 'verovio' | 'musescore'
 *   __slur.indent(0.167)     // how far in the controls sit, as a fraction of the span (0.25 = ours)
 *   __slur.reset()           // back to what shipped
 *   __slur.dump()            // what is armed, and the three laws' heights side by side
 * ```
 *
 * ## ⭐ Why a knob and not a patch
 *
 * A slur's height has **no published source** — the library was searched again the same day and the
 * verdict was UNDOCUMENTED — and the three engines disagree most exactly where most slurs live, at
 * the short end (`rendering/curves/slurArchHeight`'s table: at 2.4 sp, LilyPond 0.42, Verovio 0.45,
 * MuseScore 0.58 apex). His two hand-drawn shapes both asked for MORE than ours. ⛔ Rather than fit a
 * fourth law to two samples, this draws all three and he picks.
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: the setting lives in the ENGINE
 * (`engine/rendering/curves/slurShapeExperiment` — `engine/` may not import `dev/`), this is the entry
 * point, and `App.ts` wires it. ⏭️ When his eye has chosen, the winner is frozen in the law with his
 * choice as the citation and both files go.
 */
import { dbg } from '@/utils/debug'
import {
  resetSlurShape, setSlurHeightLaw, setSlurIndentFraction, slurShapeSettings,
  type SlurHeightLaw,
} from '@/engine/rendering/curves/slurShapeExperiment'
import { lilypondArchHeightSpaces } from '@/engine/rendering/curves/slurArchHeight'

/** The spans worth comparing, in staff spaces: two eighths, a beat, a bar, a long phrase. */
const SPANS = [2.4, 4, 10.8, 18, 25.2]

export interface SlurShapeConsole {
  law(law: SlurHeightLaw): void
  indent(fraction: number): void
  reset(): void
  dump(): void
}

export function slurShapeConsole(render: () => void): SlurShapeConsole {
  const report = () => {
    const { law, indent } = slurShapeSettings()
    dbg(`[slur] law:${law} indent:${indent} — __slur.dump() for the table`)
  }
  return {
    law: (law) => {
      // ⛔ A typo that looked like it worked would be the worst possible instrument.
      if (!setSlurHeightLaw(law)) {
        dbg(`[slur] ⛔ no such law: ${law} — try 'lilypond', 'verovio' or 'musescore'`)
        return
      }
      render()
      report()
    },
    indent: (fraction) => {
      if (!setSlurIndentFraction(fraction)) {
        dbg('[slur] ⛔ indent must be greater than 0 and at most 0.5'
          + " — 0.167 Verovio's short end, 0.25 ours, 0.33 Verovio's long, 0.5 both controls in one point")
        return
      }
      render()
      report()
    },
    reset: () => { resetSlurShape(); render(); report() },
    dump: () => {
      const { law, indent } = slurShapeSettings()
      dbg(`[slur] ARMED law:${law} indent:${indent}`)
      // ⭐ The APEX, not the control height — a cubic's apex is 0.75 × the control in all four
      //   engines, which is what makes this table comparable with the published one.
      dbg('[slur] span(sp) | apex: lilypond  verovio  musescore')
      for (const span of SPANS) {
        const row = [lilypondArchHeightSpaces(span), Math.min(1.5, Math.max(0.6, span / 5)), Math.sqrt(span / 4)]
          .map(h => (h * 0.75).toFixed(2).padStart(8))
          .join(' ')
        dbg(`[slur] ${span.toString().padStart(8)} |      ${row}`)
      }
    },
  }
}
