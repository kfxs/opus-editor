// @vitest-environment jsdom
/**
 * The spacing-law knob — his experiment (2026-09-01).
 *
 * ⛔ No spec here asserts that a LAW is right: which house this editor should live in is open. What
 * is pinned is the instrument's contract, and — the one that matters — that arming a law actually
 * moves the ink, which the memoised width cache would otherwise quietly prevent.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  SPACING_LAWS, armedRuleMatchesName, resetSpacingLaw, setSpacingLaw, spacingSettings,
} from './spacingExperiment'
import { followingSpace, spacingGeneration } from './spacing'
import { fracCreate as frac } from '@/utils/fraction'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { VexFlowRenderer } from '@/engine/rendering/VexFlowRenderer'
import { sceneGroups } from '@/engine/scene/Scene'

afterEach(() => resetSpacingLaw())

describe('spacingExperiment', () => {
  it('⛔ changes nothing by default — a session that never opens the console spaces as it always did', () => {
    expect(spacingSettings().law).toBe('lilypond')
    // LilyPond's log law, verified at source: (2 + log₂(t/♪)) × 1.2 ⇒ a quaver 2.40, a crotchet 3.60.
    expect(followingSpace(frac(1, 2))).toBeCloseTo(2.4, 6)
    expect(followingSpace(frac(1, 1))).toBeCloseTo(3.6, 6)
  })

  it('⭐ arming a law changes what a duration earns', () => {
    expect(setSpacingLaw('gould')).toBe(true)
    // Gould's √2 power law: 3.5 × √t ⇒ a quaver 2.47, a crotchet 3.50.
    expect(followingSpace(frac(1, 2))).toBeCloseTo(2.475, 3)
    expect(followingSpace(frac(1, 1))).toBeCloseTo(3.5, 6)
  })

  it('⭐ …and the armed NAME and armed RULE never drift apart', () => {
    for (const name of Object.keys(SPACING_LAWS) as Array<keyof typeof SPACING_LAWS>) {
      expect(setSpacingLaw(name)).toBe(true)
      expect(armedRuleMatchesName(), `${name} armed both halves`).toBe(true)
    }
  })

  it('⛔ a name that is not a law is REFUSED, not silently ignored', () => {
    setSpacingLaw('gould')
    expect(setSpacingLaw('gourlay' as never)).toBe(false)
    expect(spacingSettings().law, 'untouched by a refusal').toBe('gould')
  })

  it('🚨 every write bumps the generation — the width cache and the layout key both read it', () => {
    const before = spacingGeneration()
    setSpacingLaw('musescore')
    expect(spacingGeneration()).toBeGreaterThan(before)
  })

  it('⭐ the six houses differ most at the ENDS, which is the thing an eye is being asked about', () => {
    const semiquaver = (n: keyof typeof SPACING_LAWS) => followingSpace(frac(1, 4), SPACING_LAWS[n])
    const semibreve = (n: keyof typeof SPACING_LAWS) => followingSpace(frac(4, 1), SPACING_LAWS[n])
    // The log law holds the short end open and squeezes the long end; the power laws do the reverse.
    expect(semiquaver('lilypond')).toBeGreaterThan(semiquaver('gould'))
    expect(semibreve('lilypond')).toBeLessThan(semibreve('gould'))
    // …and the dynamic range (longest ÷ shortest) is what that difference IS.
    const range = (n: keyof typeof SPACING_LAWS) => semibreve(n) / semiquaver(n)
    expect(range('lilypond')).toBeLessThan(range('gould'))
    expect(range('finale'), 'the golden ratio spreads hardest of all').toBeGreaterThan(range('gould'))
  })
})

describe('⭐⭐ the two rows his memory asked for, and they are OPPOSITES', () => {
  it('⭐ `even` ignores duration entirely — every event 1.8 spaces, the rule we drew BEFORE the model', () => {
    for (const [n, d] of [[1, 4], [1, 2], [1, 1], [2, 1], [4, 1]] as const) {
      expect(followingSpace(frac(n, d), SPACING_LAWS.even), `${n}/${d} quarters`).toBeCloseTo(1.8, 6)
    }
  })

  it('⭐ `proportional` obeys duration exactly — twice the note, twice the space', () => {
    const q = followingSpace(frac(1, 1), SPACING_LAWS.proportional)
    expect(followingSpace(frac(1, 2), SPACING_LAWS.proportional)).toBeCloseTo(q / 2, 6)
    expect(followingSpace(frac(2, 1), SPACING_LAWS.proportional)).toBeCloseTo(q * 2, 6)
    // ⭐ His bar's four quavers, measured in `docs/shortest-duration-plan.md` §9.5 as 1.80 under
    // LilyPond's own proportional mode — ours lands within a twentieth of a space of that.
    expect(followingSpace(frac(1, 2), SPACING_LAWS.proportional)).toBeCloseTo(1.75, 2)
  })

  // 🚨 The two things the word "even" can mean, asserted against each other so the names cannot be
  // confused later: one flattens the curve to nothing, the other is the steepest curve there is.
  it('🚨 …so they are at OPPOSITE ends, and every other law lies between them', () => {
    const range = (r: typeof SPACING_LAWS.even) =>
      followingSpace(frac(4, 1), r) / followingSpace(frac(1, 4), r)
    expect(range(SPACING_LAWS.even), 'no spread at all').toBeCloseTo(1, 6)
    expect(range(SPACING_LAWS.proportional), 'a semibreve is 16 semiquavers').toBeCloseTo(16, 6)
    for (const n of ['lilypond', 'gould', 'musescore', 'verovio', 'finale'] as const) {
      expect(range(SPACING_LAWS[n]), n).toBeGreaterThan(range(SPACING_LAWS.even))
      expect(range(SPACING_LAWS[n]), n).toBeLessThan(range(SPACING_LAWS.proportional))
    }
  })
})

describe('🚨🚨 the regression that the WIDTH CACHE would otherwise hide', () => {
  /** Two bars whose durations differ enough that the laws disagree about them: 16ths, then a semibreve. */
  function fixture(): ScoreModel {
    const model = new ScoreModel()
    model.addMeasure()
    for (let i = 0; i < 8; i++) {
      model.addNote({ step: 'C', octave: 4, duration: '16', measure: 1, beat: frac(i, 4) })
    }
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })
    return model
  }

  function headXs(renderer: VexFlowRenderer, model: ScoreModel): number[] {
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    return sceneGroups(scene, 'notehead')
      .flatMap(g => g.children.filter(c => c.kind === 'text'))
      .map(t => (t.kind === 'text' ? Math.round(t.x * 100) / 100 : 0))
  }

  // 🚨 THE POINT. `laneFingerprint` memoises how much room a lane's notes need — exactly what a
  // spacing law decides — so without the generation in that key the second render hands back every
  // MEMOISED width and the page does not move, while the console reports success. The same trap that
  // caught P4b in the SHAPE key, one level shallower. ⚠️ The SAME renderer twice, on purpose: a
  // fresh one has an empty cache and would pass while the app stayed broken.
  it('🚨🚨 arming a law RE-MEASURES every bar — the same renderer, twice', () => {
    const model = fixture()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new VexFlowRenderer(container)
    renderer.initialize(1200, 800)

    const before = headXs(renderer, model)
    expect(before.length, 'the fixture drew heads at all').toBeGreaterThan(4)

    expect(setSpacingLaw('gould')).toBe(true)
    const after = headXs(renderer, model)

    expect(after.length, 'the same music').toBe(before.length)
    expect(after, 'a different law puts the notes somewhere else').not.toEqual(before)
  })
})
