/**
 * Running-accidental state within a measure — the ONE walk shared by the passes that
 * ask "what is already in effect at this staff position?"
 *
 * Common-practice rule: an explicit accidental holds for the rest of the bar at its own
 * diatonic position. To decide a note's prevailing alteration (or whether its sign is
 * redundant), we replay the measure's earlier notes and remember the last alteration seen
 * at each diatonic position.
 *
 * ## ⭐⭐ THE KEY SIGNATURE IS THE FALLBACK, NOT A PRE-FILL (docs/plans/key-signature-plan.md §3)
 *
 * The running map is keyed by **diatonic position** — octave-specific, so F4 and F5 are two
 * entries. A key signature governs a **LETTER, in all octaves** (Gould pp. 93–94, and it is what
 * makes a key signature a key signature). So the key is ⛔ never poured into that map: it is the
 * answer consulted **when a position is absent from it** ({@link alterationInForce}). Pre-filling would
 * need seven entries per octave and would still be wrong at the edges.
 *
 * 🚨 **And the key never suppresses a COURTESY.** Gould p. 81, printed: *"This practice holds good
 * even when a key signature corrects the accidental"* — her figure is in E♭ major and still writes
 * an explicit ♭ in bar 2. `forceAccidental` is what carries that intent, and it is checked BEFORE
 * the suppression below. ⛔ Do not re-derive "was this sign explicit?" from `alteration`.
 *
 * Pure and dependency-light. The CALLER chooses which notes to feed in (the whole measure
 * across voices, or a single voice) — that scope is the caller's interpretation, not part
 * of this walk — **and which key**: five call sites ask, and the key each one needs is ITS OWN
 * BAR'S (a fan member and a cross-bar beam member can live in a different bar from the slot being
 * drawn), ⛔ never "the key the caller happened to have".
 * `MusicEngine.getPrevailingAlteration` ("prevailing alteration") and
 * `SelectionController.computeDisplayedAccidental` ("displayed sign") both build on this;
 * `NoteBuilder`'s render pass implements the same rule incrementally as it lays out slots.
 */
import type { Alteration, ChordRest, DrawnSignId, Fraction, KeySignature, NotePitch, PitchStep } from '@/types/music'
import { fracLt, fracCompare } from './fraction'
import { keyAlterationOf } from './keySignature'
import { spellingDiatonicPos } from './pitchSpelling'
import { drawnSignOfPitch, sameAlteration } from './alterationSigns'

/** The minimal note shape the running-accidental walk reads. */
export interface AccidentalNote {
  isRest?: boolean
  tiedFrom?: string
  step?: PitchStep
  octave?: number
  alteration?: Alteration
  beat: Fraction
}

/**
 * What the bar has said, per line: diatonic position ({@link spellingDiatonicPos}) → the alteration
 * of the LAST note there. ⚠️ A position ABSENT from the map has not appeared yet in the bar; one
 * PRESENT with `undefined` is an explicit NATURAL — the two are told apart by `has`, never by `??`.
 */
export type BarAlterations = ReadonlyMap<number, Alteration | undefined>

/**
 * {@link BarAlterations}: the alteration of the LAST note at each position strictly before `beat`.
 * A position absent from the map has not appeared yet in the bar. Only non-rest, non-tied notes count (a tied continuation re-states nothing),
 * and same-beat notes are excluded (strictly `< beat`), so a chord never alters itself.
 */
export function prevailingAlterations(notes: AccidentalNote[], beat: Fraction): Map<number, Alteration | undefined> {
  const active = new Map<number, Alteration | undefined>()
  const preceding = notes
    .filter(n => !n.isRest && !n.tiedFrom && n.step !== undefined && n.octave !== undefined && fracLt(n.beat, beat))
    .sort((a, b) => fracCompare(a.beat, b.beat))
  for (const n of preceding) {
    active.set(spellingDiatonicPos(n.step!, n.octave!), n.alteration)
  }
  return active
}

/**
 * ⭐⭐ **THE ALTERATION IN FORCE at one pitch** — the bar's running accidental at that diatonic
 * position, and where the bar is silent there, **what the KEY says about the letter**.
 *
 * ⭐ THE rule of this module, named once so every pass reads the same one: the sign a note draws,
 * the pitch a new note is born with, the note a trill alternates with and what "remove the
 * accidental" reverts to are all this question asked from four places
 * (docs/plans/key-signature-plan.md §3).
 *
 * ⚠️ **`has`, not `??`** — an explicit natural earlier in the bar is stored as `undefined`, and it must
 * WIN over a sharp in the key. That is the whole difference between "the bar said nothing" and "the
 * bar said natural", and it is the one line where a key signature could silently overrule a written sign.
 * @returns the alteration in force — `undefined` = the letter unaltered (natural).
 */
export function alterationInForce(
  barAlterations: BarAlterations,
  key: KeySignature,
  step: PitchStep,
  octave: number,
): Alteration | undefined {
  const position = spellingDiatonicPos(step, octave)
  return barAlterations.has(position) ? barAlterations.get(position) : keyAlterationOf(key, step)
}

/** {@link alterationInForce} from a bar's notes: the walk and the fallback in one call. */
export function alterationInForceAt(
  notes: AccidentalNote[], beat: Fraction, key: KeySignature, step: PitchStep, octave: number,
): Alteration | undefined {
  return alterationInForce(prevailingAlterations(notes, beat), key, step, octave)
}

/**
 * ⭐ The SIGN each pitch of a lane actually displays — the same running-accidental rule as above,
 * but walked FORWARD slot by slot, which is what the render pass needs: the state as of each slot,
 * updated within a chord as signs are shown.
 *
 * Extracted from `NoteBuilder`'s inline accumulator so that a FANNED slot's members can obey it too
 * (docs/plans/fanned-beam-pitches-plan.md §2). ⚠️ **The drawing READS this decision, it never makes one.**
 * The `StaveNote`s and the hand-drawn member heads look the answer up in the SAME map, so the two
 * cannot drift — a second accidental rule inside the fan renderer is the one thing this feature
 * cannot afford.
 *
 * ⭐ **A member's accidental HOLDS FOR THE REST OF THE BAR.** A member is a note in the bar, so it
 * alters its diatonic position like any other, and a later ordinary F after a member's F♯ draws its
 * natural. The members are folded in immediately AFTER their own slot's pitches — where they lie in
 * time — which is also why the default fan (every member the note you typed) shows exactly one sign:
 * the members repeat an alteration that is already active.
 *
 * Returns `pitchId → the DRAWN sign` (a sign id, or `'natural'`), or `null` where the sign is suppressed. Ids that
 * are absent were never asked about (a rest, another lane).
 *
 * Scope is the CALLER's, as everywhere else in this file: pass one lane's slots, in beat order —
 * ⭐ **and the KEY IN FORCE WHERE THOSE SLOTS ARE**, which is the lane's own bar's, resolved per
 * staff (a signature is per-staff: Bartók writes four sharps in one hand against four flats in the
 * other). An F♯ under a signature that already says F♯ draws nothing; an F♮ under it draws a
 * natural it would not draw in C major.
 *
 * ⚠️ ONE key for the whole lane. A mid-bar key change is permitted by the model ({@link KeyChange})
 * and nothing writes one; the day something does, this parameter becomes a resolver, exactly as
 * `clefForBeat` already is.
 */
export function displayedAccidentals(slots: ChordRest[], key: KeySignature): Map<string, DrawnSignId | null> {
  const signs = new Map<string, DrawnSignId | null>()
  // Key = spellingDiatonicPos(step, octave); value = the alteration in force there. A position
  // absent from the map falls back to the KEY SIGNATURE — never pre-filled from it, see the header.
  const active = new Map<number, Alteration | undefined>()

  /** `write` = false: a BRACKETED pitch — its sign is read against what is in force, ⛔ and it puts
   *  nothing in force (docs/plans/bracketed-grace-plan.md B6: information, not an attack). */
  const decide = (p: NotePitch, write = true): void => {
    if (p.tiedFrom) {
      signs.set(p.id, null) // a tied continuation re-states nothing
      return
    }
    const dPos = spellingDiatonicPos(p.step, p.octave)
    const governing = alterationInForce(active, key, p.step, p.octave)
    // ⭐ A BRACKETED accidental asks for its sign as `forceAccidental` does (alteration-signs K3, Sibelius:
    //    on a note that shows none, the implied one appears in the brackets).
    const force = p.forceAccidental || p.accidentalEnclosure !== undefined
    if (p.alteration) {
      // Altered pitch — show the sign unless the same alteration is already in force (from the bar
      // OR from the signature), and unless it was explicitly asked for (Gould p. 81).
      if (!force && sameAlteration(governing, p.alteration)) {
        signs.set(p.id, null)
      } else {
        signs.set(p.id, drawnSignOfPitch(p)) // ⭐ ♮♯ / ♮♭ where the pitch carries `naturalBefore` (K5)
      }
      if (write) active.set(dPos, p.alteration)
    } else if (governing) {
      signs.set(p.id, 'natural') // cancel what is in force here — an earlier accidental, or the key
      if (write) active.set(dPos, undefined)
    } else if (force) {
      signs.set(p.id, 'natural') // a courtesy natural, asked for explicitly
      if (write) active.set(dPos, undefined)
    } else {
      signs.set(p.id, null)
    }
  }

  for (const slot of slots) {
    // A grace written before a REST (D7 reversed) is a note in the bar like any other.
    if (slot.type === 'rest') {
      for (const note of slot.graceBefore?.notes ?? []) {
        for (const b of note.bracketedBefore ?? []) for (const p of b.pitches) decide(p, false)
        for (const p of note.pitches) decide(p)
      }
      // …and the rest's own bracketed graces, nearest it (B10 reversed) — read-only.
      for (const b of slot.bracketedBefore ?? []) for (const p of b.pitches) decide(p, false)
      continue
    }
    // ⭐ A GRACE is a note in the bar too, walked where it sounds: the group BEFORE, the main
    //   chord, then the group AFTER — MuseScore's order (`dom/chord.cpp:1170-1225`, research
    //   `docs/research/grace-notes-research.md` §B.3.9). So a grace's sign holds into its main note
    //   and on through the bar. ⚠️ A default (no book on disk states it), his to change.
    // ⭐ A BRACKETED pitch is walked where it STANDS — before its grace, before its chord, after it —
    //   and read-only (`decide(p, false)`, B6).
    for (const note of slot.graceBefore?.notes ?? []) {
      for (const b of note.bracketedBefore ?? []) for (const p of b.pitches) decide(p, false)
      for (const p of note.pitches) decide(p)
    }
    for (const b of slot.bracketedBefore ?? []) for (const p of b.pitches) decide(p, false)
    for (const p of slot.notes) decide(p)
    // The fan's other members, in the order they sound — inside this slot, before the next one.
    for (const member of slot.fan?.members ?? []) for (const p of member.pitches) decide(p)
    for (const b of slot.bracketedAfter ?? []) for (const p of b.pitches) decide(p, false)
    for (const note of slot.graceAfter?.notes ?? []) {
      for (const b of note.bracketedBefore ?? []) for (const p of b.pitches) decide(p, false)
      for (const p of note.pitches) decide(p)
    }
  }
  return signs
}
