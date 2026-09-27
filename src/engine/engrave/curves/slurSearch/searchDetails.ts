/**
 * ⭐ **EVERY NUMBER LilyPond's slur search runs on — ONE table of rows** (docs/plans/slur-search-plan.md P2).
 * CLAUDE.md's rule: a number is one house style's DEFAULT, never a constant — these are LilyPond's, and
 * his eye may tune them (plan §6: *"The search's own taste … They are rows"*). No book gives any of them
 * (`docs/research/slur-tie-research.md` §8.4).
 *
 * Lengths are in STAFF SPACES. Sources, LilyPond 2.27.3: `scm/layout-slur.scm` (`default-slur-details`),
 * `scm/define-grobs.scm:3172-3184` (the `Slur` grob), `scm/paper.scm` `calc-line-thickness`.
 */
export interface SlurSearchDetails {
  // ── `default-slur-details` (scm/layout-slur.scm) ─────────────────────────────────────────────
  /** How far each end may move outward from its base attachment, in staff spaces (in half-space steps). */
  regionSize: number
  /** A notehead the curve passes THROUGH. */
  headEncompassPenalty: number
  /** A stem the curve passes through (÷5 at a left end going up, or a right end going down). */
  stemEncompassPenalty: number
  /** Per staff space an end moved from its base attachment. */
  edgeAttractionFactor: number
  /** Scales the edge demerit by `exp(dir·side·slope·this)` — the uphill end is cheaper to move. */
  edgeSlopeExponent: number
  /** A slur sloping against the music's direction. */
  sameSlopePenalty: number
  /** Per staff space of rise beyond the music's own. */
  steeperSlopeFactor: number
  /** A sloped slur over music that does not move. */
  nonHorizontalPenalty: number
  /** Slopes steeper than this are demerited… */
  maxSlope: number
  /** …by this, per unit of slope beyond it. */
  maxSlopeFactor: number
  /** Any extra object the curve comes near (articulations, fingerings, nested slurs). */
  extraObjectCollisionPenalty: number
  /** …and an ACCIDENTAL, which is cheaper — his flat, `docs/plans/slur-search-plan.md` §1. */
  accidentalCollision: number
  /** The gap a nested slur keeps inside an outer one. */
  freeSlurDistance: number
  /** The gap the curve keeps above a covered head (below it, the demerit grows as 1/distance). */
  freeHeadDistance: number
  /** Declared by LilyPond but read by nothing in 2.27.3 — kept so the table is the whole list. */
  extraEncompassCollisionDistance: number
  /** Inside this distance an extra object starts to cost — `peak_around`'s threshold. */
  extraEncompassFreeDistance: number
  /** The gap between the curve's turning point and a staff line it is INSIDE of… */
  gapToStafflineInside: number
  /** …and OUTSIDE of. */
  gapToStafflineOutside: number
  /** Added to the closest head distance in the variance demerit, so a tight curve is not infinitely bad. */
  absoluteClosenessMeasure: number
  /** An avoid-point closer than this to either end does not raise the arch (the edge discount). */
  closeToEdgeLength: number
  /** Caps the variance demerit's ratio (average ÷ closest head distance)… */
  headSlurDistanceMaxRatio: number
  /** …and scales it. */
  headSlurDistanceFactor: number
  /** How far past an `inside` object's reach the end's range is extended. */
  encompassObjectRangeOvershoot: number
  /** An end this close to a tie's end… */
  slurTieExtremaMinDistance: number
  /** …costs this. */
  slurTieExtremaMinDistancePenalty: number
  // ── the `Slur` grob (scm/define-grobs.scm) ─────────────────────────────────────────────────
  /** `height-limit` — the arch's asymptotic height (`bezier-bow.cc` `slur_height`). */
  heightLimit: number
  /** `ratio` — the arch's height per unit of width, for short slurs. */
  ratio: number
  /** `minimum-length` — shorter than this, an end moves off the stem onto the head. */
  minimumLength: number
  /** `thickness`, in LINE THICKNESSES. */
  thickness: number
  /** `eccentricity` — shifts both controls along the chord (unset ⇒ 0). */
  eccentricity: number
  // ── the layout ───────────────────────────────────────────────────────────────────────────
  /** `line-thickness` at the default 20 pt staff (`calc-line-thickness`: 0.5 pt of a 5 pt space). */
  lineThickness: number
  // ── OURS, read only by a `house` choice of a row ({@link SlurSearchRules}) ─────────────────────────────
  /** Row B `'house'`: how far past the head's edge an end beside the stem steps — `house`'s own number
   *  (`rendering/curves/curveStyle` `slurStemDodge`, MuseScore's 0.35). */
  houseStemClearance: number
}

export const LILYPOND_SLUR_DETAILS: SlurSearchDetails = {
  regionSize: 4,
  headEncompassPenalty: 1000,
  stemEncompassPenalty: 30,
  edgeAttractionFactor: 4,
  edgeSlopeExponent: 1.7,
  sameSlopePenalty: 20,
  steeperSlopeFactor: 50,
  nonHorizontalPenalty: 15,
  maxSlope: 1.1,
  maxSlopeFactor: 10,
  extraObjectCollisionPenalty: 50,
  accidentalCollision: 3,
  freeSlurDistance: 0.8,
  freeHeadDistance: 0.3,
  extraEncompassCollisionDistance: 0.8,
  extraEncompassFreeDistance: 0.3,
  gapToStafflineInside: 0.2,
  gapToStafflineOutside: 0.1,
  absoluteClosenessMeasure: 0.3,
  closeToEdgeLength: 2.5,
  headSlurDistanceMaxRatio: 3,
  headSlurDistanceFactor: 10,
  encompassObjectRangeOvershoot: 0.5,
  slurTieExtremaMinDistance: 0.2,
  slurTieExtremaMinDistancePenalty: 2,
  heightLimit: 2.0,
  ratio: 0.25,
  minimumLength: 1.5,
  thickness: 1.2,
  eccentricity: 0,
  lineThickness: 0.1,
  houseStemClearance: 0.35,
}

/**
 * ⭐⭐ **THE COMPROMISE'S ROWS — a CHOICE per case** (docs/plans/slur-search-plan.md P8, his word 2026-09-27:
 * *"so we should have a preset for every case"*). Where {@link SlurSearchDetails} are LilyPond's numbers, these
 * are the places he compared LilyPond with our `house` and may want either. ⭐ Every default is what the search
 * drew BEFORE the row existed — so a row changes nothing until he arms it — ⚠️ except `midAccent`, whose default is
 * HIS decided rule (T1). (So the P7 rows — `ties`, `nested`, `flags`, `tupletNumbers`, `headerSigns`, `endHead`,
 * `rests`, `ink` — default to OFF, and LilyPond's own behaviour is their other choice.)
 */
export interface SlurSearchRules {
  /**
   * **Row A — an unbeamed end on the STEM side** (a stem pointing the slur's way).
   * - `'head'` — LilyPond: the end is drawn toward its HEAD (`get_base_attachments` takes the stem tip only
   *   when a beam leaves it inward, `slur-scoring.cc:549-554`).
   * - `'stem'` — Gould p. 111 (our `house`): drawn toward the STEM END — the edge demerit measures from ½ sp
   *   past the tip instead. ⭐ The search keeps its whole range, so the other demerits can still pull the end
   *   down the stem (opposite stems, Gould's own exception).
   */
  stemSideEnd: 'head' | 'stem'
  /**
   * **Row B — where an end stands in x.**
   * - `'lilypond'` — LilyPond's four regimes (`enumerate_attachments`, `slur-scoring.cc:742-791`): beside the
   *   stem's far edge (∓0.3) while the end is alongside a stem pointing the slur's way — on EITHER side of
   *   the head; the stem's centre above its tip; the head centres for a short or steep slur; else the head
   *   centre shifted with the tilt. ⚠️ Spacing can flip an end between them (his screenshot).
   * - `'house'` — ours (`rendering/curves/slurStemEndpoint.stemDodge`): the head's CENTRE, and past the stem
   *   (`houseStemClearance` beyond the head's edge) only when the end is alongside a stem that stands on the
   *   slur's INNER side — an up stem at the start, a down stem at the end.
   */
  endX: 'lilypond' | 'house'
  /**
   * **Row C — how much the slur tilts with the melody.**
   * - `'lilypond'` — the slur may rise as much as the music does, + 0.2 sp (`score_slopes`: past that,
   *   `steeper-slope-factor` 50 a space).
   * - `'house'` — Gould p. 111, our `rendering/curves/slurStemEndpoint`: when the two END stems point opposite
   *   ways, the slur tilts at HALF the melodic interval — the same demerit, measured from half the music's
   *   rise. ⭐ Stems that agree keep LilyPond's allowance (Gould's rule is for opposite stems only).
   */
  tilt: 'lilypond' | 'house'
  /**
   * **Row D — a BROKEN slur's open end.**
   * - `'lilypond'` — level: LilyPond's piece never reads the next system (`get_base_attachments`' no-column
   *   branch — the nearest column's height, or the other end's).
   * - `'house'` — Gould p. 112, our `rendering/curves/brokenSlurTilt`: the open end is drawn toward a LEAN
   *   pointing at the music across the break (1.0–2.0 sp outward from the note end). ⚠️ Only for a piece with
   *   a note end — a MIDDLE piece has none, and stays LilyPond's.
   */
  openEnd: 'lilypond' | 'house'
  /**
   * **Row E — an accidental under the slur.**
   * - `'lilypond'` — it costs `accidental-collision` 3, so a graze is often the cheaper answer (his one-staff E♭:
   *   0.17 sp into the flat).
   * - `'clear'` — it costs `extra-object-collision-penalty` 50, as any other object does — so the search moves
   *   the END or leans the arch to clear it, what his two hand shapes did (both cleared the flat by 0.20 sp).
   *   ⭐ LilyPond's own number, not a new one. (⛔ Not `house`'s answer — one arch factor over the whole curve —
   *   which the search's `fit_factor` already is, and which drew the giant arch he rejected.)
   */
  accidental: 'lilypond' | 'clear'
  /**
   * **Row G — ties under the slur** (P7's first item). ⭐ `'on'` is LilyPond: a tie ending while the slur runs is
   * one of its `encompass-objects` (`slur-engraver.cc` END-acknowledges ties): an `inside` object the curve
   * must stay outside of (penalty 50 within 0.3 sp), and its two ends are FORBIDDEN attachments (a slur end
   * within `slur-tie-extrema-min-distance` 0.2 sp costs 2). `'off'` — what the search drew before: no ties.
   */
  ties: 'off' | 'on'
  /**
   * **Row G — slurs nested under this one** (P7's second item). ⭐ `'on'` is LilyPond: an inner slur is one of the
   * outer's `encompass-objects` — its middle, `free-slur-distance` 0.8 sp further out, raises the arch
   * (`generate_avoid_offsets`), and its curve is scored (at its ends only where it shares the outer's note,
   * `get_extra_encompass_infos`). ⚠️ The inner slur must be DRAWN first: the renderer draws innermost first
   * under `'on'`. `'off'` — what the search drew before: nested slurs may touch.
   */
  nested: 'off' | 'on'
  /**
   * **Row G — an end note's FLAG** (P7's fourth item). ⭐ `'on'` is LilyPond: the flag is united into the end's stem
   * extent (`Bound_info.stem_extent_`, `slur-scoring.cc:191-192`), so an end beside a flagged stem stands past
   * the FLAG (`stem_extent[X][-d] − d·0.3`). `'off'` — what the search drew before: the stem alone, ~1 sp too
   * far in on a flagged stem-up note (the source audit).
   */
  flags: 'off' | 'on'
  /**
   * **Row G — a TUPLET NUMBER over the slur's notes** (P7's third item). ⭐ `'on'` is LilyPond: `TupletNumber` is
   * `avoid-slur: inside` (`define-grobs.scm`), so it is an encompass object — the arch clears it, 50 within
   * 0.3 sp. `'off'` — what the search drew before.
   */
  tupletNumbers: 'off' | 'on'
  /**
   * **Row G — a clef, key or meter CHANGE inside the slur.** ⭐ `'on'` is LilyPond: `Clef`, `KeySignature` and
   * `TimeSignature` are `avoid-slur: inside` — scored, and an avoid-point for the arch, but ⛔ never allowed to
   * widen an end's range (`fill`'s exclusion, `slur-scoring.cc:302-308`). `'off'` — what the search drew before.
   */
  headerSigns: 'off' | 'on'
  /**
   * **An accent on a MIDDLE note** — his T1 rule (docs/plans/articulation-plan.md; Gould pp. 121–122, Ross p. 130,
   * Stone pp. 42–43, Gerou & Lusk p. 128): inside the slur, the slur passing OVER it.
   * - `'inside'` — ⭐ the DEFAULT, his decided rule: handed to the search as `inside`, so it is cleared from above.
   * - `'lilypond'` — `around` (the curve only keeps clear of it): measured 2026-09-27, a slur over a high middle
   *   note (C6 – E7) slipped UNDER its accent, between note and accent.
   * ⚠️ An END note's accent is untouched here — T1 puts it OUTSIDE the slur, which moves the mark (L2).
   */
  midAccent: 'lilypond' | 'inside'
  /**
   * **The end head's EXTENT** (P7, the source audit's 5th item).
   * - `'chord'` — what the search drew before: the chord's whole head span for x, and ±½ sp around the head's
   *   centre for y.
   * - `'own'` — LilyPond: the slur-side head's OWN glyph box (`Stem::extremal_heads`, `slur-scoring.cc:205,223`)
   *   and the first head's x (`Note_column::first_head`, `:561`). Differs on a chord with a displaced second (up
   *   to a head width), and in y by the glyph's real height.
   */
  endHead: 'chord' | 'own'
  /**
   * **A REST at a slur's end** (P7, the source audit's 6th item).
   * - `'asNote'` — what the search drew before: the rest handed over like a note — a one-space "head" around its
   *   centre, and an invisible stem. ⚠️ Measured: the base attachment then sits INSIDE a quarter rest (Bravura's
   *   reaches 1.49 sp, the "head" 0.5), and the end stands near the rest's left edge.
   * - `'lilypond'` — LilyPond's rest column: no stem, the rest glyph's whole extent as the end's head, the end over
   *   its centre (`get_base_attachments` with no `first_head`).
   */
  rests: 'asNote' | 'lilypond'
  /**
   * **The INK around the solved curve** (P7, the source audit's 7th item) — read by the RENDERER, for arcs the
   * search solved.
   * - `'edge'` — what we drew before: the solved curve is the ink's INNER edge, the band bowing outward (~0.06 sp
   *   further from the notes than LilyPond).
   * - `'centre'` — LilyPond (`Lookup::slur`): the solved curve is the ink's MIDDLE.
   */
  ink: 'edge' | 'centre'
}

export const LILYPOND_SLUR_RULES: SlurSearchRules = {
  stemSideEnd: 'head',
  endX: 'lilypond',
  tilt: 'lilypond',
  openEnd: 'lilypond',
  accidental: 'lilypond',
  ties: 'off',
  nested: 'off',
  flags: 'off',
  tupletNumbers: 'off',
  headerSigns: 'off',
  midAccent: 'inside',
  endHead: 'chord',
  rests: 'asNote',
  ink: 'edge',
}

/** Each row's choices, for the console and a spec — ⚠️ a new row adds its line here. */
export const SLUR_RULE_CHOICES: { readonly [K in keyof SlurSearchRules]: readonly SlurSearchRules[K][] } = {
  stemSideEnd: ['head', 'stem'],
  endX: ['lilypond', 'house'],
  tilt: ['lilypond', 'house'],
  openEnd: ['lilypond', 'house'],
  accidental: ['lilypond', 'clear'],
  ties: ['off', 'on'],
  nested: ['off', 'on'],
  flags: ['off', 'on'],
  tupletNumbers: ['off', 'on'],
  headerSigns: ['off', 'on'],
  midAccent: ['inside', 'lilypond'],
  endHead: ['chord', 'own'],
  rests: ['asNote', 'lilypond'],
  ink: ['edge', 'centre'],
}
