/**
 * ⚠️⚠️ **AN EXPERIMENT, AND IT IS HIS** (2026-09-01) — *"it would be nice to have also an instrument
 * to changes the algorithm so we can really test and decide"*.
 *
 * ⭐⭐ **THE SIX HOUSES, as one table**, so the question *"which spacing law should this editor
 * use?"* can be answered by his eye on his own music instead of by an argument. The shape is P4b's,
 * one layer down: a table of named laws, one armed, swapped live from the console.
 *
 * ```js
 *   __spacing.law('gould')     // 3.5 × √t — Gould read as Dorico reads her
 *   __spacing.law('lilypond')  // the LOG law — TODAY'S, his call
 *   __spacing.dump()           // every law's spaces-per-duration, side by side
 *   __spacing.reset()
 * ```
 *
 * ## ⭐ What is VERIFIED here and what is not — the distinction matters
 *
 * 🚨 `docs/spacing-model-research.md` was written **2026-07-30**, and the books reached the disk on
 * **2026-08-17/18** while the engine clones arrived **2026-08-18**. So every number in it was
 * second-hand: its Gould table came *"via the facsimile in MuseScore's spacing paper"*, its engine
 * formulas from web manuals.
 *
 * ✅ **Three of them are now verified against the cloned source** (2026-09-01), and they hold:
 *
 * | law | verified at | reads |
 * |---|---|---|
 * | LilyPond | `lily/spacing-options.cc::get_duration_space` + `scm/define-grobs.scm:3249` (`SpacingSpanner`) | `(2.0 + log₂(t/shortest)) × 1.2`, linear below `shortest` |
 * | MuseScore | `rendering/score/horizontalspacing.cpp::durationStretchForTicks` + `style/styledef.cpp:270` | `pow(1.5, log₂(t / ♩))` |
 * | Verovio | `src/horizontalaligner.cpp::HorizontalSpaceForDuration` + `src/options.cpp:1509/1513` | `pow(t×1024, 0.6) × 0.25 × 10` |
 *
 * ⚠️ **Dorico, Finale and Sibelius are CLOSED and stay second-hand** — their rows are marked, and
 * ⛔ must not be cited as if they were read.
 */
import {
  GOULD_SPACING, LILYPOND_SPACING, type SpacingRule,
  activeSpacingRule, resetActiveSpacingRule, setActiveSpacingRule, spacingGeneration,
} from './spacing'

/**
 * ⭐ **Every power-law row is anchored at the QUARTER = 3.5 staff spaces** and differs only in its
 * per-doubling ratio. That anchor is the one number every source in the library agrees on: Gould's
 * table, Ross's tradition, MuseScore's `DEFAULT_QUARTER_NOTE_SPACE` and Sibelius's reference width
 * are all 3½.
 *
 * ⚠️ So a row reproduces its engine's **CURVE**, ⛔ not necessarily its absolute scale — Verovio's
 * own output is in its internal units and only its exponent is transcribed here. That is the right
 * comparison for an eye: the anchor is held fixed and the shape of the curve is what changes.
 */
const QUARTER_SPACE = 3.5

export const SPACING_LAWS = {
  /** ⭐ **TODAY'S**, his call: *"in general we should approximate to LilyPond as much as possible."* */
  lilypond: LILYPOND_SPACING,

  /** Gould's √2 power law — *"Gould read as Dorico reads her"*, and the fit `spacing.ts` documents. */
  gould: GOULD_SPACING,

  /** ⭐ MuseScore 4's shipped `measureSpacing`, verified at `styledef.cpp:270`. */
  musescore: { law: 'power', quarterSpace: QUARTER_SPACE, ratio: 1.5 } as SpacingRule,

  /** ⭐ Verovio's exponent 0.6 ⇒ a per-doubling ratio of `2^0.6`, verified at `options.cpp:1513`.
   *  ⚠️ Its CURVE only — see the note above the anchor. */
  verovio: { law: 'power', quarterSpace: QUARTER_SPACE, ratio: 2 ** 0.6 } as SpacingRule,

  /** ⚠️ **SECOND-HAND** (Scoring Notes, via the research doc): Finale is reported to use the golden
   *  ratio. ⛔ Not verified — Finale shipped no source. `~/dev/engine-sources/musxdom` is the closest
   *  thing we hold and ⏭️ has never been asked this question. */
  finale: { law: 'power', quarterSpace: QUARTER_SPACE, ratio: 1.618 } as SpacingRule,

  /** ⚠️ **SECOND-HAND**: Dorico's *"spacing ratio"* default is reported as 1.41 = √2, i.e. the same
   *  curve as {@link SPACING_LAWS.gould}. ⛔ Closed source; the row exists so the name is findable. */
  dorico: GOULD_SPACING,

  /**
   * ⭐⭐ **EVEN — every event the same space, whatever it lasts.** His memory, 2026-09-01: *"i see
   * before we have an even space rule"*. He is right: this editor's width rule before the spacing
   * model was `laneColumns × MIN_NOTE_SPACING` — a flat **1.8 staff spaces per column**, so a bar of
   * four semiquavers and a bar of four crotchets came out identical
   * (`docs/spacing-model-research.md` §5.1).
   *
   * ⭐ It is a power law with **ratio 1**: `t^log₂(1) = t^0 = 1`, i.e. duration cancels out entirely.
   * ⛔ **No engraver's rule has this shape** — it is here as the BASELINE the model replaced, so
   * *"what did it look like before we had rhythmic spacing at all"* is one call away.
   */
  even: { law: 'power', quarterSpace: 1.8, ratio: 1 } as SpacingRule,

  /**
   * ⭐⭐ **PROPORTIONAL — twice the duration, twice the space.** ⚠️ The OTHER thing "even" can mean,
   * and the two are opposites, so the names are kept apart deliberately: {@link SPACING_LAWS.even}
   * ignores duration, this one obeys it exactly.
   *
   * ⭐ This is **his own axis**, already written up as a separate plan rather than a bug fix:
   * *"the second group can have more space so it looks more even matching with the first group… it
   * will look more beautiful"* (`docs/shortest-duration-plan.md` §1, §9.5). The mechanism it names is
   * LilyPond's `proportionalNotationDuration` (`lily/spacing-engraver.cc`), which overwrites every
   * column's shortest-duration with one fixed value so that `fraction = delta_t / that` is **pure
   * elapsed time** — a quaver is a quaver everywhere.
   *
   * ⭐ As a curve that is simply **ratio 2**. ⚠️ And it is a **different aesthetic** (proportional
   * notation), ⛔ not "the same picture, tidier": that plan measured his bar's four quavers coming
   * out at **1.80 each** and the bar getting NARROWER, not wider. ⇒ ⏭️ the ENGRAVING PRESETS item
   * this row now makes visible, ⛔ still not a default.
   */
  proportional: { law: 'power', quarterSpace: QUARTER_SPACE, ratio: 2 } as SpacingRule,
} satisfies Record<string, SpacingRule>

/**
 * ⛔⛔ **AND WHY VEXFLOW'S OWN LAW IS NOT A ROW — his question, 2026-09-01** (*"i remember we tried
 * also… the vexflow law for spacing"*). We did draw with it, for months; it cannot become a row here,
 * and the reason is worth stating because it is not laziness:
 *
 * > **It is not a function of duration at all.** `Formatter.preFormat` distributes a bar's width by
 * > `Voice.softmax`: `ideal(event) ∝ SOFTMAX_FACTOR ^ (ticks / voice.ticksUsed)` (`voice.js:115`,
 * > factor 10) — the exponent is the event's **fraction of ITS BAR**, so the same rhythm is spaced
 * > differently depending on the meter. A quarter against an eighth is **1.33× in 4/4** and
 * > **1.78× in 2/4** (`docs/spacing-model-research.md` §5.2).
 *
 * ⇒ A `SpacingRule` maps a DURATION to a space; VexFlow's needs the bar as well. Faking it with the
 * 4/4-equivalent ratio 1.33 would be a row that is wrong in every other meter — ⛔ a guessing
 * fallback, and those get believed. ⏭️ A real row means a third `law` shape carrying the voice's
 * total, threaded through `followingSpace`. Cheap enough, ⛔ not written until somebody wants it.
 */
export const VEXFLOW_SOFTMAX_FACTOR = 10

export type SpacingLawName = keyof typeof SPACING_LAWS

/** ⛔ Sibelius is a hand-tuned LOOKUP TABLE, not a curve, so it cannot be a row of this union at all
 *  (32nd 1.41 · 16th 1.94 · 8th 2.53 · ♩ 3.5 · 𝅗𝅥 5.94 · 𝅝 8.19, second-hand). ⏭️ Adding it means a
 *  third `law` shape in `spacing.ts` — worth doing only if his eye wants to see it. */
export const SIBELIUS_TABLE_SPACES = [1.41, 1.94, 2.53, 3.5, 5.94, 8.19]

const state = { law: 'lilypond' as SpacingLawName }

/** What is armed right now — for the console's read-back, and for a spec. */
export function spacingSettings(): { law: SpacingLawName; generation: number } {
  return { law: state.law, generation: spacingGeneration() }
}

/** Arm a law. ⛔ Unknown names are REFUSED rather than silently ignored. */
export function setSpacingLaw(law: SpacingLawName): boolean {
  if (!(law in SPACING_LAWS)) return false
  state.law = law
  setActiveSpacingRule(SPACING_LAWS[law])
  return true
}

/** Back to what ships (`lilypond`). */
export function resetSpacingLaw(): void {
  state.law = 'lilypond'
  resetActiveSpacingRule()
}

/** ⚠️ A guard for specs: the armed NAME and the armed RULE must not drift apart. */
export function armedRuleMatchesName(): boolean {
  return activeSpacingRule() === SPACING_LAWS[state.law]
}
