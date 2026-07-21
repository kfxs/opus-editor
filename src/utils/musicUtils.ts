import type { NoteDuration, TimeSignature, Tuplet, TupletShape, TupletNumberStyle, Measure, Note, Score } from '@/types/music'
import {
  type Fraction,
  fracCreate,
  fracMul,
  fracAdd,
  fracLte,
  fracLt,
  fracGte,
  fracCompare,
  fracDiv,
  fracToNumber,
} from '@/utils/fraction'
import { UNIT_GLYPH } from '@/utils/tempoText'
import {
  durationToFraction,
  durationToBeats,
  getDotMultiplier,
  beatsToDuration,
  splitBeatsIntoDurations,
} from '@/utils/durations'

/**
 * Music utility functions for calculations and conversions.
 *
 * The duration ↔ beats / Fraction / VexFlow maps now live in `utils/durations.ts`
 * (single source of truth). The duration helpers below are re-exported from
 * here so existing `@/utils/musicUtils` imports keep working.
 */

export { durationToBeats, getDotMultiplier, beatsToDuration, splitBeatsIntoDurations }

/**
 * Calculate the total duration (in beats) of a measure given its time signature
 * @param timeSignature - Time signature object
 * @returns Total beats in the measure
 */
export function getMeasureDuration(timeSignature: TimeSignature): number {
  // Convert to quarter note equivalents
  // For example: 3/4 = 3 beats, 6/8 = 3 beats (6 * 0.5), 2/2 = 4 beats (2 * 2)
  const beatValue = 4 / timeSignature.denominator
  return timeSignature.numerator * beatValue
}

/**
 * Exact bar length in quarter-note beats for a time signature.
 *
 * The `Fraction` counterpart of {@link getMeasureDuration}: every internal
 * timing comparison should use this rather than float beats, so non-`/4`
 * meters (and `/16`, `/32`) stay exact. 4/4 → 4/1, 6/8 → 3/1, 9/8 → 9/2,
 * 5/8 → 5/2, 7/8 → 7/2.
 */
export function getMeasureDurationFrac(timeSignature: TimeSignature): Fraction {
  return fracMul(
    fracCreate(timeSignature.numerator, 1),
    fracCreate(4, timeSignature.denominator),
  )
}

/**
 * The actual playable length of a measure in quarter-note beats: its
 * {@link Measure.actualDurationOverride} (pickup / anacrusis) when present,
 * else its nominal time-signature length. This is the single source of truth
 * for a bar's *capacity*; use it instead of `getMeasureDuration(measure
 * .timeSignature)` wherever the value means "how much fits in this bar".
 */
export function measureCapacityFrac(measure: Measure): Fraction {
  return measure.actualDurationOverride ?? getMeasureDurationFrac(measure.timeSignature)
}

/** Float counterpart of {@link measureCapacityFrac}. */
export function measureCapacityQuarters(measure: Measure): number {
  return fracToNumber(measureCapacityFrac(measure))
}

/**
 * Convert MIDI note number to note name with octave
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name with octave (e.g., 'C4', 'A#3')
 */
export function midiToNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNote / 12) - 1
  const noteName = noteNames[midiNote % 12]
  return `${noteName}${octave}`
}

/**
 * Calculate total duration of all notes in beats
 * @param notes - Array of note objects with duration and optional dots property
 * @returns Total duration in beats
 */
export function calculateTotalDuration(
  notes: Array<{ duration: NoteDuration; dots?: number }>
): number {
  return notes.reduce((total, note) => total + durationToBeats(note.duration, note.dots || 0), 0)
}

// beatsToDuration and splitBeatsIntoDurations now live in utils/durations.ts
// (re-exported above).

// ==================== Tuplet Utilities ====================

// ==================== Exact Fraction Tuplet Utilities ====================

/**
 * The exact tuplet quantities, ALL taking the whole {@link TupletShape}.
 *
 * ⚠️ They read the ACTUAL side only — `numNotes`, `baseDuration` + `baseDots`, `notesOccupied` —
 * because that is what the ratio has always meant: **both counts count the actual value**. A triplet
 * of eighths is 3:2 EIGHTHS. {@link TupletShape.normalDuration} is a record of what the user typed
 * and is deliberately NOT arithmetic: folding it in would silently change `notesOccupied` from "2
 * eighths" to "1 quarter" and make the mark print 5:1 where it must print 5:4.
 *
 * They take the object and not loose arguments because every one of them is wrong-but-plausible if
 * handed half a tuplet — a missing `baseDots` shortens the span by a third, and that surfaces as a
 * rebar bug layers away, never as "a field went missing".
 */

/** The ACTUAL side's note value — what the tuplet's notes are written as. */
function tupletBaseUnit(t: TupletShape): Fraction {
  return durationToFraction(t.baseDuration, t.baseDots ?? 0)
}

/**
 * Exact total duration (in beats) the whole group occupies.
 *
 * **The ENTRY is the truth when it was recorded** — `normalCount × normalDuration`, "3 eighths" —
 * because that is what the user said the group lasts. The ratio is the LABEL, and a label cannot
 * always carry it: three eighths is one and a HALF quarters, and `notesOccupied` is a whole number
 * of quarters or nothing.
 *
 * Without a recorded entry (every tuplet before that field, and every one whose two sides agree) it
 * falls back to `M × the unit` — the same value, since that is what the entry would have said.
 */
export function tupletSpan(t: TupletShape): Fraction {
  if (t.normalDuration && t.normalCount !== undefined) {
    return fracMul(durationToFraction(t.normalDuration, t.normalDots ?? 0), fracCreate(t.normalCount, 1))
  }
  return fracMul(tupletBaseUnit(t), fracCreate(t.notesOccupied, 1))
}

/**
 * The written→sounding factor: what one written note inside the tuplet is multiplied by.
 *
 * `span ÷ (N × unit)` — the N written notes have to fit the span. It is exactly `M/N` whenever the
 * span is `M × unit`, which is every tuplet without a recorded entry, so nothing that existed before
 * changes value.
 */
export function tupletScale(t: TupletShape): Fraction {
  return fracDiv(tupletSpan(t), fracMul(tupletBaseUnit(t), fracCreate(t.numNotes, 1)))
}

/**
 * Exact sounding duration of ONE slot — a note written as the tuplet's own unit.
 * Fully reduced: a triplet eighth → 1/3.
 */
export function tupletSlotDuration(t: TupletShape): Fraction {
  return fracMul(tupletBaseUnit(t), tupletScale(t))
}

/** Exact sounding duration of a note written as `duration`+`dots` INSIDE this tuplet — the members
 *  need not all be the unit (a 3:2 eighth triplet may hold a quarter and an eighth). */
export function tupletWrittenDuration(t: TupletShape, duration: NoteDuration, dots = 0): Fraction {
  return fracMul(durationToFraction(duration, dots), tupletScale(t))
}

/**
 * What "N ♪ in the time of M ♪" came to — the shape, or WHY those boxes describe no tuplet we can
 * store. The reason is a string and not a boolean because the refusals are different facts, and a UI
 * that can only say "no" teaches nothing.
 */
export type TupletResolution =
  | { ok: true; shape: TupletShape }
  | { ok: false; reason: string }

/**
 * Finale's way of asking: "**N** [note value] in the time of **M** [note value]" — four values, one
 * per box, and no ratio to work out in your head. It is how a player says it out loud ("five
 * sixteenths in the time of a quarter"), which is why it beats `5:4` at the point of entry.
 *
 * The WORDS are not Finale's: its dialog says "in the space of", which is a typesetter's idiom for
 * what a tuplet does to TIME. Sibelius and Dorico both say "in the time of", and so do we.
 *
 * BOTH note values may be DOTTED, as Finale's two dropdowns are ("Half(s) • Dotted Quarter(s) •
 * Quarter(s)…") and as MusicXML's `<normal-dot>` / `<tuplet-dot>` are.
 *
 * All four values are KEPT — `TupletShape` has a side for each — where this used to fold the normal
 * side into `M × unit` and throw the note value away. Folding is what made `5:4` unable to answer "in
 * the time of *what*", and what made a span that is not a whole number of units (2 quarters in the
 * time of 3 eighths) refuse outright. Both are gone with it.
 *
 * A pure rule, and here rather than on the controller because it has TWO askers now — the palette's
 * four boxes and the Tuplet window's — and a rule with two copies is a rule that will disagree with
 * itself. Neither caller decides anything; they both ask.
 */
export function resolveTupletInTimeOf(
  numNotes: number,
  unit: NoteDuration,
  normalCount: number,
  normalUnit: NoteDuration,
  unitDots = 0,
  normalDots = 0,
): TupletResolution {
  if (!Number.isInteger(numNotes) || numNotes < 2) return { ok: false, reason: 'you need at least 2 notes in the group' }
  if (!Number.isInteger(normalCount) || normalCount < 1) return { ok: false, reason: 'the time it replaces must be at least one note' }

  // The RATIO is worked out exactly as it always was: both counts count the ACTUAL value, so
  // "5 sixteenths in the time of 1 quarter" is 5:4 — four sixteenths — and never 5:1.
  const span = fracMul(durationToFraction(normalUnit, normalDots), fracCreate(normalCount, 1))
  const occupied = fracDiv(span, durationToFraction(unit, unitDots))

  // …but the ratio cannot always carry it: "2 quarters in the time of 3 eighths" is one and a HALF
  // quarters, and a printed count is a whole number. That used to be refused. It is not any more —
  // the ENTRY is stored and the timing reads it (see tupletSpan), so the only thing left to decide
  // is what the LABEL says, and there the answer is the ratio in the value the user named: 2:3,
  // which is why a mark in this case has to show the note value beside it to be unambiguous.
  const label = occupied.den === 1 ? occupied.num : normalCount

  const shape: TupletShape = {
    numNotes,
    notesOccupied: label,
    baseDuration: unit,
    ...(unitDots && { baseDots: unitDots }),
    // WHAT THE USER TYPED, kept beside the ratio and used by nothing that counts: the ratio above
    // cannot say "in the time of a QUARTER", and a mark that prints the value needs to know. Stored
    // only when it differs from the unit, so an ordinary triplet is written as it always was.
    ...(unit !== normalUnit || unitDots !== normalDots
      ? { normalDuration: normalUnit, normalCount, ...(normalDots && { normalDots }) }
      : {}),
  }
  // The one thing still refused: N notes that exactly fill the span are not squeezed at all, so
  // they keep their own value and there is no tuplet to make.
  const scale = tupletScale(shape)
  if (scale.num === scale.den) {
    return { ok: false, reason: 'the notes would keep their own value' }
  }
  return { ok: true, shape }
}

/**
 * What the tuplet's mark PRINTS — in SMuFL TUPLET DIGITS, not ASCII.
 *
 * The digits are a line-for-line port of VexFlow's private `Tuplet.resolveGlyphs()`: `tuplet0`…
 * `tuplet9` (U+E880 + d) and `tupletColon` (U+E88A), so the string is drawn from the music font's
 * own numerals — the small, wide-spaced figures a tuplet uses — and NOT the text face's. Ported
 * rather than called because `resolveGlyphs` needs a VexFlow `Tuplet`, which needs real notes.
 * ⚠️ Codepoints are written out: VexFlow's `Glyphs` table is CJS-only and `undefined` in the browser.
 *
 * `style` is {@link Tuplet.numberStyle} — what the user chose. Absent = AUTO, which is VexFlow's own
 * default (a bare number when the counts are close, the ratio when they are not), stated here so a
 * GHOST and the engraved mark cannot drift: a preview reading `5` for something that will engrave as
 * `5:3` is a preview of a different tuplet.
 *
 * Derived every time, never stored — the numbers ARE the rhythm, so a saved string would go on
 * saying `5:4` after the tuplet changed (docs/tuplet-extension-plan.md §6).
 */
/**
 * The two numbers the mark PRINTS, and the note value they COUNT — all three DERIVED, never read off
 * the model.
 *
 * `span ÷ unit` gives the second figure: both then count the written note, which is what a tuplet's
 * ratio means. When that does not come out whole (a group lasting one and a half quarters) the ratio
 * is quoted in the value the user named instead — 2:3 EIGHTHS — and `value` says so, which is the
 * case where the note beside the ratio stops being decoration.
 *
 * Derived because `notesOccupied` is otherwise stored AND computable, and anything both can drift:
 * one write that forgets the entry and the tuplet says two different things with nothing to catch
 * it. For a tuplet with no recorded entry the span IS `notesOccupied × unit`, so this returns exactly
 * the stored number — same answer, one source.
 */
export function tupletPrintedCounts(
  t: TupletShape,
): { numNotes: number; notesOccupied: number; value: NoteDuration; dots: number } {
  const inUnits = fracDiv(tupletSpan(t), tupletBaseUnit(t))
  const whole = inUnits.den === 1
  return {
    numNotes: t.numNotes,
    notesOccupied: whole ? inUnits.num : (t.normalCount ?? t.notesOccupied),
    value: whole || !t.normalDuration ? t.baseDuration : t.normalDuration,
    dots: (whole || !t.normalDuration ? t.baseDots : t.normalDots) ?? 0,
  }
}

export function tupletMarkText(t: TupletShape, style?: TupletNumberStyle): string {
  const digits = (n: number): string => {
    let out = ''
    for (let rest = n; rest >= 1; rest = Math.floor(rest / 10)) {
      out = String.fromCharCode(0xe880 + (rest % 10)) + out
    }
    return out
  }
  const printed = tupletPrintedCounts(t)
  const resolved = style ?? (Math.abs(printed.numNotes - printed.notesOccupied) > 1 ? 'ratio' : 'number')
  if (resolved === 'none') return ''
  if (resolved === 'number') return digits(printed.numNotes)
  const ratio = `${digits(printed.numNotes)}\uE88A${digits(printed.notesOccupied)}` // U+E88A tupletColon
  // "Ratio + note" names the value the two figures are counting (Sibelius writes `5:3x`, the x being
  // the tuplet's own sixteenth).
  if (resolved === 'ratioNote') return ratio + UNIT_GLYPH[printed.value] + '.'.repeat(printed.dots)
  return ratio
}

/**
 * Exact check: does `beat` fall within the given tuplet's time span?
 * No epsilon — comparison is cross-multiplication of integers.
 *
 * Inclusive of startBeat, exclusive of end.
 */
export function isBeatInTupletFrac(beat: Fraction, tuplet: Tuplet): boolean {
  const end = fracAdd(tuplet.startBeat, tupletSpan(tuplet))
  return fracGte(beat, tuplet.startBeat) && fracLt(beat, end)
}

/**
 * Compare two notes by their position ACROSS the whole score: measure first, then
 * exact beat. Use this for cross-measure ordering; within a single measure use
 * `fracCompare(a.beat, b.beat)` directly (no measure tiebreak needed there).
 */
export const compareByPosition = (
  a: { measure: number; beat: Fraction },
  b: { measure: number; beat: Fraction },
): number => (a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat))

/**
 * Convert a numeric beat value to an exact Fraction.
 * Used wherever beat positions are computed via float arithmetic (coordinate mapping,
 * tuplet ratios, quantization) and need to be passed to APIs that expect Fraction.
 */
export function beatToFrac(beat: number): Fraction {
  // Fast path for common integer and dyadic values
  if (Number.isInteger(beat)) return fracCreate(beat, 1)
  // Try denominators that cover all standard + tuplet subdivisions
  const DENS = [2, 3, 4, 5, 6, 7, 8, 12, 14, 16, 21, 24, 28, 32, 48, 56, 96, 112]
  for (const d of DENS) {
    const n = Math.round(beat * d)
    if (Math.abs(beat - n / d) < 1e-9) return fracCreate(n, d)
  }
  // Fallback: rational approximation with den=96 (covers up to 32nd-note triplets)
  return fracCreate(Math.round(beat * 96), 96)
}

/**
 * Exact overlap check for two note spans [aStart, aStart+aDur) and [bStart, bStart+bDur).
 * Returns true if they overlap (share any time), false if they are adjacent or disjoint.
 */
export function noteSpansOverlapFrac(
  aStart: Fraction,
  aDur: Fraction,
  bStart: Fraction,
  bDur: Fraction,
): boolean {
  const aEnd = fracAdd(aStart, aDur)
  const bEnd = fracAdd(bStart, bDur)
  // Overlap iff aStart < bEnd AND bStart < aEnd
  return fracLt(aStart, bEnd) && fracLt(bStart, aEnd)
}

/**
 * Check if span [start, start+dur) is fully contained within [regionStart, regionEnd).
 *
 * Reserved for the nested-tuplets containment guard (docs: allow one tuplet fully inside
 * another, reject a partial overlap). No caller yet — kept because that guard is the exact
 * shape this computes; delete if nested tuplets are ruled out. See project_nested_tuplets_future.
 */
export function spanContainedInFrac(
  start: Fraction,
  dur: Fraction,
  regionStart: Fraction,
  regionEnd: Fraction,
): boolean {
  return fracGte(start, regionStart) && fracLte(fracAdd(start, dur), regionEnd)
}

/**
 * Flatten a Measure's ChordRest slots into a backward-compatible Note[] array.
 * Each Rest slot becomes one Note with isRest=true.
 * Each Chord slot becomes one Note per pitch.
 */
/**
 * Resolve a slot's `staffId` (string) to a 0-based staff index for the flat {@link Note}
 * projection. Absent `staffId`, no score, or an unknown id all resolve to staff 0 (the N=1
 * default). Inlined here (rather than importing the engine's staffContent seam) so this leaf
 * util keeps no upward dependency on the engine layer.
 */
function resolveStaffIndex(score: Score | undefined, staffId: string | undefined): number {
  if (!score || staffId === undefined) return 0
  const idx = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return idx < 0 ? 0 : idx
}

/**
 * Flatten a measure's slots to `Note[]`. Pass `score` to also project each note's 0-based
 * `staff` index (multi-staff) — the interaction layer needs it for staff-scoped nav/entry/
 * selection. Without `score`, `staff` is left undefined (= staff 0), preserving the
 * single-staff behaviour of every existing caller.
 */
export function getMeasureNotes(measure: Measure, score?: Score): Note[] {
  const result: Note[] = []
  const staffOf = (staffId: string | undefined): number | undefined =>
    score ? resolveStaffIndex(score, staffId) : undefined
  for (const slot of measure.slots) {
    if (slot.type === 'rest') {
      result.push({
        id: slot.id,
        duration: slot.duration,
        measure: slot.measure,
        beat: slot.beat,
        isRest: true,
        dots: slot.dots,
        tupletId: slot.tupletId,
        actualDuration: slot.actualDuration,
        voice: slot.voice,
        staff: staffOf(slot.staffId),
      })
    } else {
      for (const pitch of slot.notes) {
        result.push({
          id: pitch.id,
          step: pitch.step,
          alter: pitch.alter,
          octave: pitch.octave,
          duration: slot.duration,
          measure: slot.measure,
          beat: slot.beat,
          isRest: false,
          forceAccidental: pitch.forceAccidental,
          stemDirection: slot.stemDirection,
          tiedTo: pitch.tiedTo,
          tiedFrom: pitch.tiedFrom,
          dots: slot.dots,
          tupletId: slot.tupletId,
          actualDuration: slot.actualDuration,
          articulations: slot.articulations,
          voice: slot.voice,
          staff: staffOf(slot.staffId),
        })
      }
    }
  }
  return result
}
