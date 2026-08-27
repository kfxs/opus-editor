/**
 * THE KEY IN FORCE — resolved positionally, bottoming out in C major.
 *
 * ⭐ **`keyAt` takes the full positional address**, because a key signature is per-staff and
 * mid-score: `Measure.keys` is the storage ({@link KeyChange}, the shape of `clefs` / `dynamics` /
 * `tempos`), and this module is the walk back over it. ⛔ `Score` has no key field and never will —
 * a global would silently mean "the key at bar 1 beat 0", the conflation that made the old
 * `score.clef` bleed across staves.
 *
 * ⚠️⚠️ **THE DISCIPLINE THAT KEEPS THIS CHEAP: readers ask {@link keyAlterOf}, never the shape of
 * the list.** Every reader wants one of three things, and only the third needs a number:
 *
 *  1. **what a letter is altered to** — pitch resolution, playback, the trill auxiliary:
 *     {@link keyAlterOf} answers directly;
 *  2. **the printed order and position of the signs** — that is the list's own order, which is
 *     AUTHORED data (see below);
 *  3. **what the key is CALLED** — {@link fifthsOf}, which returns `null` when there is no
 *     traditional name.
 *
 * The first pass that reaches past these and reads `alterations` positionally is the one that makes
 * a custom signature expensive again.
 *
 * ⛔ **The types live in `types/music.ts`** ({@link KeySignature}, {@link KeyAlteration},
 * {@link KeyChange}) — they are stored model data, serialized into the score file, so they sit with
 * `Clef` and `TimeSignature` while the resolution sits here. This module re-exports them so a reader
 * that thinks of the key as one subject can import it as one subject.
 *
 * ## ⭐⭐ Why the LIST is the storage and `fifths` is only a NAME
 *
 * His requirement, 2026-08-13: Bartók-style signatures like **one flat plus one sharp**, which no
 * position on the circle of fifths can express — *"the key signature should be open"*. And it is his
 * own compositional want, not repertoire fidelity: *"I would be able to write a piece with that key
 * signature (I think is a nice mode)"* — which raises the bar from round-tripping one through import
 * to AUTHORING one in the UI.
 *
 * That is the standard-blessed shape, not an exotic extension. MusicXML's `<key>` accepts repeated
 * `<key-step>`/`<key-alter>`/`<key-accidental>` triples INSTEAD of `<fifths>` for exactly this, and
 * LilyPond's `\set Staff.keyAlterations` takes an arbitrary alist of (degree . alteration). Both
 * keep the fifths form only as the common-case convenience.
 *
 * ⛔ **The trap avoided here was `{ fifths, custom? }`** — two answers to one question, with every
 * reader having to ask which is real. `fifths` looks like a model because it is an integer, but it
 * only wins job 3 above, and it is genuinely ABSENT for a mixed signature. **A property that can be
 * missing is not the storage.**
 *
 * Two things got EASIER, not harder: cancellation naturals at a key change are a set difference
 * between two lists, and transposition maps each altered letter through the interval — the same
 * answer as `fifths ± n` for traditional keys, and actually correct for the rest.
 *
 * ## ⭐⭐ The shape, decided by what four engines actually do (researched 2026-08-13)
 *
 * **Keyed by LETTER, with an OPTIONAL octave override — and the list ORDER is authored data.**
 *
 *  - **LilyPond** `\set Staff.keyAlterations` takes `((octave . step) . alter)`, with
 *    `(step . alter)` documented as the shorthand meaning "the same alteration in ALL octaves".
 *    ⭐ The octave-scoped form is the primary one; the all-octaves form is the abbreviation.
 *  - **MusicXML** binds `<key-octave>` to a signature element **by printed index, "counted from left
 *    to right"** — so the order is load-bearing in the format itself.
 *  - **Finale**'s *Nonstandard Key Signature* dialog had Accidental Order and Amount plus Accidental
 *    **Octave** Placement *per clef*; its manual says outright that a signature *"can contain one
 *    sharp and one flat… and there need not be any logic to their positions."*
 *  - **Dorico** exposes Order, Note and Octave as three arrow-button axes, per clef. **MuseScore** is
 *    the outlier — purely positional glyph placement, no letter concept at all, which is the easiest
 *    to build and the hardest to play back.
 *
 * ⭐ **Store the order; do not derive it.** Once a signature is not a circle-of-fifths position there
 * is no rule left to derive an order FROM. LilyPond is the only engine that derives, it needed a
 * dedicated `keyAlterationOrder` table to do it, and its documented behaviour CHANGED between 2.18
 * and 2.20 — exactly the instability you get from deriving something users think of as authored.
 * Derivation belongs at CREATION time ({@link keyFromFifths}), after which the list is data.
 *
 * ## ⚠️⚠️ SCOPE and PLACEMENT are two different things — do not conflate them
 *
 * Gould, *Behind Bars* (2011) pp. 93–94, `UNCONVENTIONAL KEY SIGNATURES`: *"Any sharp or flat may be
 * selected as a key signature to alter **all octaves** of the selected pitches"* — followed by
 * *"(Bartók uses many unconventional key signatures in the Mikrokosmos piano pieces.)"* Her own
 * example draws C♯ on the third space (C5) and it sharpens the C at C4 as well. So:
 *
 *  - **SCOPE is per-LETTER, all octaves.** That is the rule, flatly, and it is what
 *    {@link keyAlterOf} implements.
 *  - **PLACEMENT is a staff position DERIVED from the letter and the clef** — {@link
 *    KeyAlteration.octave} overrides it and says nothing about which octaves are governed.
 *
 * ⛔ **Per-octave SCOPE is required by no sourced repertoire.** The only per-octave precedent found
 * is Renaissance — a flat printed in *two* octaves, which is reinforcement of a letter, not
 * restriction of one.
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
 * score.** Everything verifiable — Bartók's Bagatelle op. 6 no. 1 (4♯ RH against 4♭ LH, which he
 * himself called carrying the principle *ad absurdum*), the *44 Duos*, the *Mikrokosmos* pieces,
 * Stravinsky, Holst — achieves mixed sharps and flats **across two staves**, never within one
 * signature. The model must still PERMIT it (it costs nothing once a signature is a set of pairs),
 * but the ordering and grouping for that case have no authority to appeal to: whatever we do there
 * is **house style**, and should be documented as such rather than presented as a convention.
 *
 * @see docs/key-signature-plan.md — the build (P1 is this file plus `Measure.keys`)
 * @see docs/key-signature-research.md — the five research passes behind every number in it
 */
import type { Fraction, KeyChange, KeySignature, PitchAlter, PitchStep, Score } from '@/types/music'
import { fracCreate, fracLt, fracLte, fracGt } from './fraction'

const ZERO: Fraction = fracCreate(0, 1)

export type { KeyAlteration, KeyChange, KeySignature } from '@/types/music'

/** The key everything resolves to when nothing has said otherwise. ⭐ Not a special case anywhere:
 *  it draws nothing because the list is empty, and every rule reads it the same as any other key. */
export const C_MAJOR: KeySignature = { alterations: [], mode: 'major' }

/** The order sharps are added in — F♯ C♯ G♯ D♯ A♯ E♯ B♯. */
const SHARP_ORDER: readonly PitchStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
/** …and flats, which is the same list backwards. */
const FLAT_ORDER: readonly PitchStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/**
 * What the key signature ALONE does to a letter — the alteration every note of that letter carries
 * unless an accidental in the bar says otherwise. **Independent of octave**, which is what makes a
 * key signature a key signature (and why {@link KeyAlteration.octave}, a placement override, is not
 * consulted here).
 *
 * ⭐ THE reader. Ask this, not the list.
 */
export function keyAlterOf(key: KeySignature, step: PitchStep): PitchAlter {
  for (const a of key.alterations) {
    if (a.step === step) return a.alter
  }
  return 0
}

/**
 * The key's traditional NAME as a circle-of-fifths position — `+n` sharps, `−n` flats, `0` for C
 * major / A minor — or **`null` when it has none**, which is the honest answer for a signature
 * mixing sharps and flats, and for an open/atonal one.
 *
 * ⭐ **Matched by CONTENT, not by printed order.** D major with its two sharps written in the other
 * order is still D major: the order is a printing decision (see the header), and this function is
 * not about printing. {@link KeyAlteration.octave} is ignored for the same reason — it is placement.
 *
 * ⛔ **Never rebuild a key from its own `fifthsOf`.** `keyFromFifths(fifthsOf(k))` normalises away
 * exactly the authored order and placement this model exists to carry.
 */
export function fifthsOf(key: KeySignature): number | null {
  // ⚠️ An OPEN key is not C major (see {@link KeySignature.mode}). Both have no alterations, and
  // only this line keeps them apart here: "no key" has no traditional name, it is not the name of
  // the key with no accidentals.
  if (key.mode === 'open') return null
  if (key.alterations.length === 0) return 0
  if (key.alterations.length > 7) return null

  const sharps = key.alterations.every(a => a.alter === 1)
  const flats = key.alterations.every(a => a.alter === -1)
  if (!sharps && !flats) return null

  const order = sharps ? SHARP_ORDER : FLAT_ORDER
  const n = key.alterations.length
  const wanted = order.slice(0, n)
  // A cycle-of-fifths PREFIX, as a set: every letter of the prefix is altered exactly once.
  const letters = new Set(key.alterations.map(a => a.step))
  if (letters.size !== n) return null
  if (!wanted.every(step => letters.has(step))) return null
  return sharps ? n : -n
}

/**
 * The classical constructor — the fifteen traditional signatures, built as lists in cycle order.
 * ⭐ **This is the whole of "we do classical first":** the classical case is a *constructor*, not a
 * second model, and the dev palette's buttons are calls to it.
 *
 * `n` is clamped to ±7; ⛔ there is no wrap (C♯ major stepping round to C♭ major is a 14-semitone
 * jump dressed as one step).
 */
export function keyFromFifths(n: number, mode: 'major' | 'minor' = 'major'): KeySignature {
  const count = Math.min(Math.abs(Math.trunc(n)), 7)
  const order = n > 0 ? SHARP_ORDER : FLAT_ORDER
  const alter: PitchAlter = n > 0 ? 1 : -1
  return {
    alterations: count === 0 ? [] : order.slice(0, count).map(step => ({ step, alter })),
    mode,
  }
}

/** Does a key change belong to the staff being asked about? Both sides resolve absent → the first
 *  staff, so at N=1 (all absent) everything matches. `clefUtils.clefOnStaff`'s twin — ⛔ and NOT
 *  `staffContent.matchesStaff`, which lives a layer up (`engine/models`). */
function keyOnStaff(k: KeyChange, staffId: string | undefined, score: Score): boolean {
  const first = score.staves?.[0]?.id
  return (k.staffId ?? first) === (staffId ?? first)
}

/** Key changes of a measure, sorted ascending by beat (empty if none), filtered to one staff. */
function measureKeyChanges(score: Score, measureNumber: number, staffId?: string): KeyChange[] {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure?.keys?.length) return []
  return measure.keys
    .filter(k => keyOnStaff(k, staffId, score))
    .sort((a, b) => (fracLt(a.beat, b.beat) ? -1 : fracGt(a.beat, b.beat) ? 1 : 0))
}

/**
 * The key in force at a bar on a staff — the latest change at or before `beat` in that measure, else
 * inherited from earlier measures on **this** staff, else {@link C_MAJOR}.
 *
 * `beat` defaults to the bar's start, which is what a caller asking "the key at bar N" means and
 * what every caller wants today: a beat-0 signature is the only kind anything writes. ⭐ Pass a beat
 * when the question is really "the key at this moment" — a mid-bar change (permitted by
 * {@link KeyChange}) takes effect from its own beat, exactly as a mid-bar clef change does.
 *
 * ⚠️ **Key is per-staff content.** There is no document-level key, so an unset staff cannot inherit
 * another staff's — the same rule, and for the same reason, as `effectiveClefAt`.
 *
 * ⚠️ **This is the MODEL's answer, and it walks.** Layout must not ask it per bar per staff: that
 * shape, for the clef, was 47% of all layout time until `resolveStaffClefs` replaced it with one
 * forward pass. See docs/key-signature-plan.md §2.1.
 */
export function keyAt(score: Score, measureNumber: number, staffId?: string, beat: Fraction = ZERO): KeySignature {
  const changes = measureKeyChanges(score, measureNumber, staffId)
  let best: KeyChange | undefined
  for (const k of changes) {
    if (fracLte(k.beat, beat)) best = k // sorted, so the last match wins
    else break
  }
  if (best) return best.key

  for (let n = measureNumber - 1; n >= 1; n--) {
    const earlier = measureKeyChanges(score, n, staffId)
    if (earlier.length) return earlier[earlier.length - 1].key
  }
  return C_MAJOR
}
