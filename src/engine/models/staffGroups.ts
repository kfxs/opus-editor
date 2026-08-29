/**
 * ⭐⭐ **WHICH GROUPING SIGNS STAND AT A BAR** — the brace and the bracket a system opening at that
 * bar draws, resolved from the score. P2/P4 of docs/braces-brackets-plan.md.
 *
 * ## ⭐⭐ THE BAR IS IN THE SIGNATURE THOUGH NOTHING VARIES BY IT YET
 *
 * **His call, 2026-08-29: grouping is POSITIONAL** — it can change mid-score (§1b of the plan; the
 * case that decided it is a soprano line splitting onto two bracketed staves at bar 40). Principle 6
 * therefore governs `StaffGroup` the way it governs tempo, meter and clef.
 *
 * ⛔ **And yet no `fromMeasure` field is added here, deliberately.** This is
 * `./barlineJoin.barlineJoinsBelow`'s arrangement, copied on purpose and for its reason:
 *
 * > ⭐ **What forecloses a future is a READER THAT ASSUMES, never a field that is missing.**
 *
 * With the bar already asked for, the day a group carries a measure range the lookup changes
 * **inside this function** and ⛔ **not one caller moves**. Add the field first and it is a field
 * with no feature — nothing authors it, nothing maintains it, and nothing reads it back
 * (`docs/barline-types-plan.md` §2 lists exactly that as a smell, and key signatures P1 left
 * `Measure.keys` out for the same reason). ⇒ the field arrives with the **authoring** that writes
 * it (P5), and this signature is what makes that arrival a one-file change.
 *
 * ## 🚨🚨 GATED ON `symbol`, NOT ON THE OVERLAY BEING ABSENT
 *
 * ⛔ **`Score.staffGroups` is NOT a reliable "nobody asked for a sign" signal**, and reading it as
 * one is the mistake that would put a brace on every grand staff in the repo:
 * `ScoreModel.ensureSingleGroupSpansAllStaves` **writes a group spanning all staves whenever a score
 * has two or more** — automatically, on staff count, from `addStaff`. 40 test files trip it.
 *
 * ⭐ The auto-writer never invents a `symbol` (it only carries an existing one forward), and
 * `StaffGroup.symbol` is optional. So **`symbol` present is the honest gate**: *absent means nobody
 * asked for a sign*, which is exactly what is true. See the plan's §1a, and
 * [[reference_an_absent_field_is_a_claim_about_the_writers]].
 *
 * ## The ORDER is the drawing order
 *
 * ⭐⭐ **The SMALLER the group, the FURTHER LEFT its sign** — Gould p. 509 / p. 518, Ross pp. 155–6
 * and Stone p. 6, all measured, unanimous (research §3.2). LilyPond and Verovio do this; ⛔ MuseScore
 * stacks the outer sign first and is the odd one out. So the returned list runs **innermost first**,
 * which is left-to-right *outward* from the staves — and the caller may place them by walking it.
 *
 * ⭐ **Nesting needs no depth field** (his call, 2026-08-29): a group whose staves are a subset of
 * another's IS the inner one, so sorting by span says everything a `column` integer would.
 */
import type { Score, StaffGroup } from '@/types/music'
import { getStaves } from './staffContent'

/** One sign to draw at a system's left edge, resolved to the staves it actually spans. */
export interface ResolvedStaffGroup {
  /** The `StaffGroup` this came from — its id is what a selection or an override would key on. */
  group: StaffGroup
  symbol: NonNullable<StaffGroup['symbol']>
  /** 0-based index of the topmost staff the sign reaches. */
  topStaffIndex: number
  /** 0-based index of the bottommost staff the sign reaches. */
  bottomStaffIndex: number
}

/**
 * **The signs standing at this bar**, innermost first.
 *
 * ⚠️ **Report, never repair** (`docs/json-io-plan.md`). Three shapes are silently *skipped* rather
 * than drawn wrongly, because each would put ink somewhere no engraver would:
 *
 * - **no `symbol`** — nobody asked for a sign (see the header);
 * - **fewer than two staves in the score, or a group naming none of them** — a sign spanning nothing.
 *
 * ⭐ A **single-staff group** is NOT skipped (since 2026-08-29): Gould p. 516 gives a single stave in
 * a full score both a bracket and a systemic barline, and it is what his authoring rule produces
 * from a one-staff selection.
 *
 * ⚠️ A group whose staves are **not contiguous** (staves 1 and 3, skipping 2) is not engravable —
 * there is no way to draw it. It is resolved to the span it *encloses* rather than dropped, so the
 * user sees the sign they asked for reaching further than they said, instead of nothing at all.
 * ⏭️ Refusing it belongs to the authoring that can say why (plan P5/P6).
 */
export function groupsAt(
  score: Score,
  /** The bar the system opens at. Reserved; see the header — nothing varies by it yet. */
  measureNumber?: number,
): ResolvedStaffGroup[] {
  void measureNumber // reserved — the positional range arrives with P5's authoring.
  const staves = getStaves(score)
  if (staves.length < 2) return []
  const indexOf = new Map(staves.map((s, i) => [s.id, i]))

  const resolved: ResolvedStaffGroup[] = []
  for (const group of score.staffGroups ?? []) {
    if (!group.symbol) continue
    const indices = group.staffIds.map(id => indexOf.get(id)).filter((i): i is number => i !== undefined)
    // ⭐⭐ **ONE STAFF IS ENOUGH, and the books say so for the BRACKET** — *"A score system of only
    //   one stave takes a square bracket **as well as** a systemic barline"* (Gould p. 516; Ross
    //   pp. 151–2). It is also his authoring rule of 2026-08-29: *"if just one staff selected we
    //   apply just to that staff"*. ⛔ This guard used to be `< 2` and was mine, not a source's.
    //   ⏭️ A one-staff BRACE is not engraving anyone draws — that refusal, if it is ever wanted,
    //   belongs to the authoring (`models/staffGroupOps`), ⛔ not to this reader.
    if (indices.length < 1) continue
    resolved.push({
      group,
      symbol: group.symbol,
      topStaffIndex: Math.min(...indices),
      bottomStaffIndex: Math.max(...indices),
    })
  }

  // Innermost first — the smaller span is drawn nearer the staves. ⭐ A stable tie-break on the top
  // staff keeps two same-size groups in score order rather than in `sort`'s.
  return resolved.sort((a, b) =>
    (a.bottomStaffIndex - a.topStaffIndex) - (b.bottomStaffIndex - b.topStaffIndex)
    || a.topStaffIndex - b.topStaffIndex)
}
