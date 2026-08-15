/**
 * ⭐⭐ **WHICH WAY A TIE CURVES.** The twin of {@link ./slurDirection}, and it was the half that
 * still answered from the pitch alone.
 *
 * Gould states the tie rule on the **stems**, not on the staff position:
 *
 * > *Behind Bars* p. 64: *"A tie curves away from the stems."* … and where two consecutive notes
 * > have opposite stems, *"**Ties curve away from the middle stave-line**."*
 *
 * Those are two rules, in that order: read the stems, and only when they disagree fall back to the
 * note's side of the **middle line**. Everything below is that order, with the two decisions that
 * outrank both — an explicit flip, and the multi-voice parity rule — kept in front.
 *
 * 🚨 **What this replaces, and why it was wrong twice.** The old `TieRenderer.getTieDirection`
 * had only the middle-line half, and it asked for that middle line with a hardcoded
 * `middleLineDiatonicPos('treble')` — diatonic **34**, in a function whose `Measure` argument
 * carries the clefs it needed. Bass's middle line is **22**, alto's 28, tenor's 26, so on a bass
 * staff every note from D3 up to A4 — nearly the whole staff — measured as *below the middle line*
 * and curved **down**, which above the real middle line is the same side as its own down-stem: the
 * one thing p. 64 forbids. There was no test naming the function at all.
 *
 * ⚠️ **Resolved stem directions, never the model's** — the same rule as `slurDirection`, for the
 * same reason: beaming forces a whole group's stems, so a note's natural direction and its drawn
 * one differ. The caller passes what VexFlow actually drew.
 *
 * ⚠️ And it takes stems as **numbers**, not `StaveNote`s, deliberately: a bare `new StaveNote(...)`
 * reports stem direction `1` for every pitch, so a spec built from live notes in jsdom would agree
 * with itself and prove nothing.
 */
import type { Chord, Clef, Fraction, Measure, NotePitch } from '@/types/music'
import { fracEq } from '@/utils/fraction'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import { voiceOf } from '@/utils/lanes'

/** Which way the arc bows: **−1 up/over**, **+1 down/under** — `TieRenderer`'s sign, and the
 *  slur's. It is also VexFlow's stem sign inverted, which is what makes rule 3 a one-liner. */
export type TieSide = -1 | 1

/**
 * ⭐ **THE RULE, in the order the decisions actually outrank each other.**
 *
 * 1. an explicit flip (`pitch.tieDirection`, set with `x`) wins over everything;
 * 2. in a **multi-voice** bar the tie follows its VOICE's outer side — upper voices over, lower
 *    voices under, regardless of pitch or stem — so two voices' ties spread apart instead of
 *    meeting in the middle. Gould, and the same parity our stems / articulations / tuplet
 *    brackets already use;
 * 3. inside a **chord** the tie goes outward from the note's place in it (the top note over, the
 *    bottom note under, a middle note toward its nearer outer neighbour). A chord has one stem for
 *    all its pitches, so the stems cannot answer this and never could;
 * 4. ⭐ otherwise **away from the stems**, when both tied notes agree on where their stems point;
 * 5. ⭐ and when they do **not** agree — or when nothing drew a stem to read — away from the
 *    **middle line of the clef in force**, which is where the old rule's one hardcoded constant
 *    used to sit.
 *
 * `stems` is what VexFlow drew for the two tied chords (`1` up / `−1` down); anything else, and an
 * empty array, mean *no opinion* and drop through to rule 5. A pending tie has only its first note,
 * so it passes one — which trivially "agrees" with itself, and that is the right answer for it.
 *
 * ⚠️ So in the live pipeline rule 5 fires **only for opposite stems**: a drawn note always reports a
 * direction, stemless or not. Its clef is still the load-bearing part of that branch — and the only
 * place it can be tested is headless, where the stems can be withheld.
 */
export function tieSide(
  pitch: NotePitch,
  beat: Fraction,
  measure: Measure,
  clef: Clef,
  stems: readonly number[] = [],
): TieSide {
  // 1. An explicit override (set by flipping the tie with `x`) wins over auto placement.
  if (pitch.tieDirection !== undefined) return pitch.tieDirection

  // Find the chord slot that CONTAINS this pitch. In a multi-voice bar each voice has its own
  // chord at the same beat, so matching on beat alone returns the wrong voice's slot (usually
  // voice 1's) — match by the pitch id, then fall back to beat.
  const chordAtBeat = (
    measure.slots.find(s => s.type === 'chord' && s.notes.some(p => p.id === pitch.id))
    ?? measure.slots.find(s => s.type === 'chord' && fracEq(s.beat, beat))
  ) as Chord | undefined

  // 2. Multi-voice: the voice's own outer side, whatever the pitch and whatever the stem.
  if (new Set(measure.slots.map(s => voiceOf(s))).size > 1) {
    return (chordAtBeat?.voice ?? 0) % 2 === 0 ? -1 : 1
  }

  const thisDiatonic = spellingDiatonicPos(pitch.step, pitch.octave)

  // 3. Inside a chord: outward from this pitch's place in it.
  if (chordAtBeat && chordAtBeat.notes.length > 1) {
    const sorted = chordAtBeat.notes
      .map(n => spellingDiatonicPos(n.step, n.octave))
      .sort((a, b) => a - b)
    const lowest = sorted[0]
    const highest = sorted[sorted.length - 1]
    if (thisDiatonic === highest) return -1  // Top note: tie curves UP
    if (thisDiatonic === lowest) return 1    // Bottom note: tie curves DOWN
    // Middle note: follow the nearer outer voice.
    return highest - thisDiatonic <= thisDiatonic - lowest ? -1 : 1
  }

  // 4. Away from the stems — but only while they agree. An up stem (VexFlow `1`) is ink standing
  //    above the notehead, so the tie takes the space below it, and vice versa: the side IS the
  //    stem sign.
  const stemmed = stems.filter((d): d is TieSide => d === 1 || d === -1)
  if (stemmed.length > 0 && stemmed.every(d => d === stemmed[0])) return stemmed[0]

  // 5. Opposite stems, or no stem to read: away from the middle line OF THIS CLEF. A note on the
  //    line itself has no free side, and ties over it with the rest of the upper half.
  return thisDiatonic >= middleLineDiatonicPos(clef) ? -1 : 1
}
