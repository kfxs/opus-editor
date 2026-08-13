/**
 * THE KEY IN FORCE — resolved positionally, bottoming out in C major.
 *
 * ⚠️⚠️ **The editor has no key-signature FEATURE.** Nothing draws a key signature, nothing lets you
 * set one, and `Score` deliberately has no `keySignature` field ({@link Score}'s own note says why:
 * a global would silently mean "the key at bar 1 beat 0", the conflation that made the old
 * `score.clef` bleed across staves). This module is not that feature arriving early — it is the
 * ADDRESS the feature will answer at, written down now because the trill needs to ask the question
 * today (docs/trill-plan.md §3).
 *
 * ⭐ **So `keyAt` takes the full positional address and returns the constant.** The point is the
 * CALL SITES: they are already written as "the key at this bar on this staff", which is what
 * `types/music.ts` says a key signature will be (`Measure.keys?: KeyChange[]` carrying a `staffId`,
 * the shape of `clefs` / `dynamics` / `tempos`). The day that field exists, this function grows a
 * walk-back over it — `effectiveClefAt`'s shape, exactly — and **not one caller changes**. The
 * parameters are underscore-prefixed to say, at the definition, that they are not read YET; making
 * them honest is the whole of the change.
 *
 * ⛔ **Do not add `Measure.keys` here.** A field with no feature is a field nothing maintains, and
 * every score would carry it. The trigger is the key-signature feature itself.
 */
import type { PitchAlter, PitchStep, Score } from '@/types/music'

/**
 * A key signature as a POSITION ON THE CIRCLE OF FIFTHS, which is how MusicXML (`<fifths>`),
 * LilyPond and MuseScore all store one — never as a list of altered letters. One integer says both
 * which letters are altered and in which direction, and the ORDER of accidentals falls out of it
 * rather than being a second thing to keep in step.
 *
 * `mode` is carried because a key signature does not determine it (three sharps is A major or F♯
 * minor) and a future feature will want to print the difference. Nothing here reads it.
 */
export interface KeySignature {
  /** +n = n sharps, −n = n flats, 0 = none. */
  fifths: number
  mode?: 'major' | 'minor'
}

/**
 * ⏭️⭐⭐ **A KEY SIGNATURE MUST NOT STAY FIFTHS-ONLY.** His requirement, 2026-08-13: Bartók's
 * *Mikrokosmos* writes signatures like **one flat plus one sharp**, which no position on the circle
 * of fifths can express — *"the key signature should be open"*. `fifths` above is the SHORTHAND for
 * the traditional case, not the storage that is allowed to forbid the rest.
 *
 * That is the standard-blessed shape rather than an exotic extension: MusicXML's `<key>` accepts
 * repeated `<key-step>`/`<key-alter>`/`<key-accidental>` triples INSTEAD of `<fifths>` for exactly
 * this, and LilyPond's `\set Staff.keyAlterations` takes an arbitrary alist of (degree
 * . alteration). Both keep the fifths form only as the common-case convenience.
 *
 * ## ⭐⭐ How the two models coexist: they are NOT peers
 *
 * The trap is treating "fifths" and "an arbitrary set" as two storage formats to reconcile, and
 * bolting the second on as `{ fifths, custom? }`. That is two answers to one question, and every
 * reader would have to ask which is real. **The open list is the STORAGE; `fifths` is a derived
 * NAME for the subset of signatures that have one.**
 *
 * `fifths` looks like a model because it is an integer, but what it is used for splits into three
 * unrelated jobs, and it only wins the third:
 *
 *  1. **What is each letter altered to?** — pitch resolution, playback, the trill auxiliary. The
 *     list answers directly; fifths answers via a lookup table. The list is strictly better.
 *  2. **What ORDER and staff position do the signs print in?** — for traditional keys the order IS
 *     the fifths order, but a mixed signature has no canonical order, so it is AUTHORED. Make the
 *     open form an **ordered** list and the traditional case is just a list that happens to be in
 *     fifths order. Ordering does not need fifths either.
 *  3. **What is this key CALLED?** ("D major", "three sharps") — this genuinely needs fifths + mode.
 *     And it is genuinely ABSENT for a mixed signature, which is the tell: a property that can be
 *     missing is not the storage.
 *
 * So `fifths` becomes a FUNCTION returning `number | null`, where null means "no traditional name" —
 * the honest answer for a Bartók signature, not a failure. A key picker offers the fifteen named
 * signatures by building their lists; a custom tab builds an arbitrary one.
 *
 * Two things get EASIER, not harder: cautionary naturals at a key change are a set difference
 * between two lists (arithmetic to be careful with, in the fifths model), and transposition maps
 * each altered letter through the interval — the same answer as `fifths ± n` for traditional keys,
 * and actually correct for the rest.
 *
 * ## ⚠️ The discipline that keeps the change cheap
 *
 * **Readers ask {@link keyAlterOf}. Nothing reads `key.fifths` directly.** That is true today (this
 * module has exactly one reader, `utils/trillPitch`), and it is the entire reason the eventual
 * change is one function body plus this type — `trillPitch` would not change a character. The first
 * pass that reaches for the integer instead is the one that makes coexistence a real problem.
 *
 * ⚠️ Per-staff is already accounted for ({@link keyAt} takes a `staffId`), and it matters for the
 * same repertoire: Bartók writes DIFFERENT signatures in the two hands (Bagatelle Op. 6 No. 1 —
 * four sharps in the right hand, four flats in the left; his own words for it were that he had
 * carried the key-signature principle *"ad absurdum"*).
 *
 * ## ⭐⭐ The shape, decided by what four engines actually do (researched 2026-08-13)
 *
 * ```ts
 * alterations: Array<{ step: PitchStep; alter: PitchAlter; octave?: number; glyph?: string }>
 * ```
 *
 * **Keyed by LETTER, with an OPTIONAL octave override — and the list ORDER is authored data.**
 * Both halves are what the reference implementations converge on, not a preference:
 *
 *  - **LilyPond** `\set Staff.keyAlterations` takes `((octave . step) . alter)`, with
 *    `(step . alter)` documented as the shorthand meaning "the same alteration in ALL octaves".
 *    ⭐ The octave-scoped form is the primary one; the all-octaves form is the abbreviation.
 *  - **MusicXML** `<key>` offers `<key-step>`/`<key-alter>`/`<key-accidental>` instead of
 *    `<fifths>`, then optional `<key-octave>` — which binds to a signature element **by printed
 *    index, "counted from left to right"**, so the order is load-bearing in the format itself.
 *  - **Finale**'s *Nonstandard Key Signature* dialog had Accidental Order and Amount, plus
 *    Accidental **Octave** Placement *per clef*; its manual says outright that a signature
 *    *"can contain one sharp and one flat… and there need not be any logic to their positions."*
 *  - **Dorico** exposes Order, Note and Octave as three independent arrow-button axes, edited per
 *    clef. **MuseScore** is the outlier — purely positional glyph placement, no letter concept at
 *    all, which is the easiest to build and the hardest to play back.
 *
 * ⭐ **Store the order; do not derive it.** Once a signature is not a circle-of-fifths position
 * there is no rule left to derive an order FROM. LilyPond is the only engine that derives, it
 * needed a dedicated `keyAlterationOrder` table to do it, and its documented behaviour changed
 * between 2.18 and 2.20 — exactly the instability you get from deriving something users think of as
 * authored. Derivation belongs at CREATION time (fill in the traditional F♯-C♯-G♯… order), after
 * which the list is data.
 *
 * ## ⚠️⚠️ SCOPE and PLACEMENT are two different things — do not conflate them
 *
 * Gould, *Behind Bars* (2011) pp. 93–94, has a section `UNCONVENTIONAL KEY SIGNATURES` whose rule is
 * one sentence: *"Any sharp or flat may be selected as a key signature to alter **all octaves** of
 * the selected pitches"* — followed by *"(Bartók uses many unconventional key signatures in the
 * Mikrokosmos piano pieces.)"*
 *
 * Her own example makes the distinction sharp: the signature draws C♯ on the third space (i.e. at
 * C5) and it sharpens the C at **C4** as well. So:
 *
 *  - **SCOPE is per-LETTER, all octaves.** That is the rule, flatly.
 *  - **PLACEMENT is a staff position, DERIVED from the letter and the clef** — it is where the glyph
 *    is drawn, and it says nothing about which octaves are governed.
 *
 * ⭐ **So `octave?` above is about PLACEMENT, not scope**, and it is optional because the standard
 * position is derivable. ⛔ **Per-octave SCOPE is not required by any 20th/21st-century repertoire
 * that could be sourced.** The only per-octave precedent found is Renaissance — a flat printed in
 * *two* octaves, which is reinforcement of a letter, not restriction of one. If a restricting form
 * is ever wanted it is a later extension; nothing today justifies it.
 *
 * ## ⭐ Order is authored, and here is the proof
 *
 * Four printed sources order a signature containing a double accidental four different ways:
 * **Foulds** (*A World Requiem* op. 60, G♯ major) puts the double last; **Ewald** (Brass Quintet
 * op. 8, F♭ major) puts it first; **Reger** (*Supplement to the Theory of Modulation*, 1904,
 * pp. 42–45) repeats B♭ as a courtesy at the start AND writes B𝄫 at the end; **Reicha**
 * (*Practische Beispiele* no. 18, B♯ major) writes them inline in cycle order. No reference states a
 * rule, and Gould gives none for a set that is not a cycle-of-fifths subset.
 *
 * ⭐ **But every VERIFIED non-standard signature is a SUBSET of the standard set, kept in standard
 * order, at standard positions** — Gould's own C♯/G♯ figure, and Bartók's B♭+D♭ (*44 Duos* no. 11
 * "Lullaby", per Oramo, who flags it with his own "(!)"). Nothing is re-ordered; members are simply
 * omitted. So the DEFAULT fill is the cycle-of-fifths order, and authored order is the escape hatch.
 *
 * ## ⚠️ The honest caveat, which belongs in whatever UI is built
 *
 * **A single signature on a single staff mixing sharps AND flats could not be evidenced from any
 * score.** Gould does not show one; Oramo does not; the only named candidate (Rzewski, *God to a
 * Hungry Child* — B♭, E♭, F♯) is uncited. Everything verifiable — Bartók's Bagatelle op. 6 no. 1
 * (4♯ RH against 4♭ LH, which Bartók himself called carrying the principle *ad absurdum*), the
 * *44 Duos*, the *Mikrokosmos* pieces, Stravinsky, Holst, the harp in the Concerto for Orchestra —
 * achieves mixed sharps and flats **across two staves**, never within one signature. The model must
 * still PERMIT it (it costs nothing once a signature is a set of pairs), but the ordering and
 * grouping for that case have no authority to appeal to: whatever we do there is **house style**,
 * and should be documented as such rather than presented as a convention.
 *
 * ## ⏭️ Two things that are RENDER policy, not model
 *
 *  - **Cancellation.** Gould gives two named practices — traditional (naturals in the order of the
 *    signature being cancelled, then the new signature, both after the barline) and contemporary
 *    (only the new signature; naturals only when the new section has none) — plus two historical
 *    variants. What is stored is *the signature changes here*; how it is cancelled is a policy.
 *  - **Courtesy renders.** A signature must be drawn where it does NOT take effect: at a system
 *    break the cancelling naturals and new signature go at the END of the first system, and a
 *    bracketed reminder is wanted in a second-time bar. That is a layout-keyed decision, never a
 *    second signature in the model.
 *
 * ⚠️ This shape serialises to MusicXML almost 1:1, and to LilyPond with one unit conversion:
 * MusicXML's `alter` is in SEMITONES, LilyPond's is a proportion of a 200-cent whole tone
 * (sharp = 1/2). Ours is MusicXML's, matching {@link PitchAlter} elsewhere in the model.
 */

/** The key everything resolves to until the key-signature feature exists. */
export const C_MAJOR: KeySignature = { fifths: 0, mode: 'major' }

/** The order sharps are added in — F♯ C♯ G♯ D♯ A♯ E♯ B♯. */
const SHARP_ORDER: readonly PitchStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
/** …and flats, which is the same list backwards. */
const FLAT_ORDER: readonly PitchStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/**
 * What the key signature ALONE does to a letter — the alteration every note of that letter carries
 * unless an accidental in the bar says otherwise. Independent of octave, which is what makes a key
 * signature a key signature.
 */
export function keyAlterOf(key: KeySignature, step: PitchStep): PitchAlter {
  const n = key.fifths
  if (n > 0) return SHARP_ORDER.slice(0, Math.min(n, 7)).includes(step) ? 1 : 0
  if (n < 0) return FLAT_ORDER.slice(0, Math.min(-n, 7)).includes(step) ? -1 : 0
  return 0
}

/**
 * The key in force at a bar on a staff. **Today: always C major** — see the module note for why
 * that is a placeholder with a real address rather than a stub.
 *
 * @param _score the score to resolve against (unread — the walk-back lands here)
 * @param _measureNumber where to resolve (unread)
 * @param _staffId which staff (unread) — a key is PER-STAFF, since a transposing instrument's key
 *   differs from the score's. Absent = the first staff, the convention everywhere (`utils/lanes`).
 */
export function keyAt(_score: Score, _measureNumber: number, _staffId?: string): KeySignature {
  return C_MAJOR
}
