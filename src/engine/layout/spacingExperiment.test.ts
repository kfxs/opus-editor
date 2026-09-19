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
import { ScoreRenderer } from '@/engine/rendering/ScoreRenderer'
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
    expect(setSpacingLaw('dorico')).toBe(true)
    // The √2 power law — Gould read as Dorico reads her: 3.5 × √t ⇒ a quaver 2.47, a crotchet 3.50.
    expect(followingSpace(frac(1, 2))).toBeCloseTo(2.475, 3)
    expect(followingSpace(frac(1, 1))).toBeCloseTo(3.5, 6)
  })

  // ⭐⭐ THE PRINTED TABLES, as printed — read from the books 2026-09-01. These are the only rows in
  // the whole table that are SOURCES rather than readings, so they are pinned exactly rather than
  // to a tolerance: a drift here is a transcription error, not a taste change.
  it('⭐⭐ `gould` is her p. 39 table verbatim — and her quaver is 2½, not 2¼', () => {
    setSpacingLaw('gould')
    const printed: Array<[number, number, number]> = [
      [1, 4, 2], [1, 2, 2.5], [3, 4, 3], [1, 1, 3.5], [3, 2, 4], [2, 1, 5], [3, 1, 6], [4, 1, 7],
    ]
    for (const [n, d, spaces] of printed) {
      expect(followingSpace(frac(n, d)), `${n}/${d} quarters`).toBeCloseTo(spaces, 9)
    }
  })

  it('⭐⭐ `ross` is his p. 77 table — the SAME table, apart only at the two longest values', () => {
    setSpacingLaw('ross')
    for (const [n, d, spaces] of [[1, 2, 2.5], [3, 4, 3], [1, 1, 3.5]] as const) {
      expect(followingSpace(frac(n, d)), 'identical to Gould here').toBeCloseTo(spaces, 9)
    }
    expect(followingSpace(frac(2, 1)), 'a minim: he says 4¾ where she says 5').toBeCloseTo(4.75, 9)
    expect(followingSpace(frac(4, 1)), 'a semibreve: 7¼ against her 7').toBeCloseTo(7.25, 9)
  })

  it('⚠️ …and a duration a table does not print is INTERPOLATED — ours, not the book’s', () => {
    setSpacingLaw('ross')
    // He prints nothing shorter than a quaver, so a semiquaver continues his own shortest pair's
    // slope in log₂(duration). ⛔ It is a reading of the source, and the spec says so.
    const semiquaver = followingSpace(frac(1, 4))
    expect(semiquaver, 'below his shortest printed value').toBeLessThan(2.5)
    expect(semiquaver, '…and it does NOT clamp to it').not.toBeCloseTo(2.5, 3)
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

  it('⭐ the houses differ most at the ENDS, which is the thing an eye is being asked about', () => {
    const semiquaver = (n: keyof typeof SPACING_LAWS) => followingSpace(frac(1, 4), SPACING_LAWS[n])
    const semibreve = (n: keyof typeof SPACING_LAWS) => followingSpace(frac(4, 1), SPACING_LAWS[n])
    // The log law holds the short end open and squeezes the long end; the power laws do the reverse.
    expect(semiquaver('lilypond'), 'the log law holds the SHORT end open').toBeGreaterThan(semiquaver('dorico'))
    expect(semibreve('lilypond'), '…and squeezes the long one').toBeLessThan(semibreve('dorico'))
    // …and the dynamic range (longest ÷ shortest) is what that difference IS.
    const range = (n: keyof typeof SPACING_LAWS) => semibreve(n) / semiquaver(n)
    expect(range('lilypond')).toBeLessThan(range('dorico'))
    expect(range('finale'), 'the golden ratio spreads hardest of all').toBeGreaterThan(range('dorico'))
  })

  // ⭐⭐ …and the fit lands close to the source it fits, which is the check that the two rows named
  // after Gould are the same author: within 1% on six of her eight values, the 16th and the dotted
  // crotchet being the two the √2 curve cannot hold (`spacing.test.ts` pins those exactly).
  it('⭐⭐ `dorico` is a FIT of `gould`, and this is how close', () => {
    const rows: Array<[number, number]> = [[1, 2], [3, 4], [1, 1], [2, 1], [3, 1], [4, 1]]
    for (const [n, d] of rows) {
      const printed = followingSpace(frac(n, d), SPACING_LAWS.gould)
      const fitted = followingSpace(frac(n, d), SPACING_LAWS.dorico)
      expect(Math.abs(fitted / printed - 1), `${n}/${d} quarters`).toBeLessThan(0.011)
    }
    // ⛔ And the two it misses, so the closeness above cannot be read as "the same thing".
    const miss = (n: number, d: number) =>
      followingSpace(frac(n, d), SPACING_LAWS.dorico) / followingSpace(frac(n, d), SPACING_LAWS.gould) - 1
    expect(miss(1, 4), 'the 16th, where her table flattens into the notehead').toBeCloseTo(-0.125, 3)
    expect(miss(3, 2), 'the dotted crotchet').toBeCloseTo(0.072, 3)
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

  function headXs(renderer: ScoreRenderer, model: ScoreModel): number[] {
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
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)

    const before = headXs(renderer, model)
    expect(before.length, 'the fixture drew heads at all').toBeGreaterThan(4)

    expect(setSpacingLaw('gould')).toBe(true)
    const after = headXs(renderer, model)

    expect(after.length, 'the same music').toBe(before.length)
    expect(after, 'a different law puts the notes somewhere else').not.toEqual(before)
  })
})
