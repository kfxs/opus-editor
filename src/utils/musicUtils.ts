import type { NoteDuration, TimeSignature, Tuplet, TupletShape, TupletNumberStyle, TupletMarkRun, TupletFormat, TupletBracketEnd, Measure, Note, Score } from '@/types/music'
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
import { MET_NOTE_GLYPH, MET_AUGMENTATION_DOT } from '@/utils/tempoText'
import { getMeterInfo } from '@/utils/meter'
import { fanMembers } from '@/utils/fannedBeam'
import type { AccidentalNote } from '@/utils/accidentalState'
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
 * Where a tuplet bracket stops when the tuplet does not say — the right edge of its last notehead.
 *
 * Sibelius's and Finale's behaviour, where running the bracket over the group's full TIME is a box
 * you tick ("Full duration", "Extend Bracket"). Dorico defaults the other way, and the argument for
 * copying it is real — a bracket that stops at the notehead ends slightly before the group does. But
 * the longer bracket is the more intrusive mark, it reaches toward whatever follows, and most tuplets
 * never need it: the ordinary beamed group is unambiguous either way. So it is OPT-IN, on the
 * tuplets where the span genuinely needs showing, rather than something every triplet gets.
 */
export const DEFAULT_TUPLET_BRACKET_END: TupletBracketEnd = 'lastNote'

/** Where THIS tuplet's bracket stops — its own choice, or the default above. The renderer asks here
 *  rather than reading the field, so "absent means division" is stated once. */
export function tupletBracketEnd(t: TupletFormat): TupletBracketEnd {
  return t.bracketEnd ?? DEFAULT_TUPLET_BRACKET_END
}

/**
 * Does this group get a bracket? Its own choice, or — for `auto` and for absent — the rule: **no
 * bracket when a beam already shows the group**, one when it does not.
 *
 * The beam and the bracket say the same thing (these notes are one group), so drawing both is saying
 * it twice; the bracket exists for the groups a beam cannot cover — quarters and longer, or a group
 * broken across beams. Which is why `beamed` is asked for rather than derived here: only the renderer
 * knows whether the beam actually happened, and it knows it AFTER the beams are built.
 */
export function tupletBracketed(t: TupletFormat, beamed: boolean): boolean {
  if (t.bracket === 'always') return true
  if (t.bracket === 'never') return false
  return !beamed
}

/**
 * **M, worked out from the METER** — how many of the armed note value the group replaces, given
 * where in the bar it starts. Null when this meter has no tuplet of N to offer.
 *
 * M is not a function of N, which is why nothing looks it up in a table: a quintuplet is 5:4 in
 * simple meter and 5:3 in 6/8, because the normal side comes from what is being DIVIDED. Written as
 * one rule, taking the three things that decide it — the meter, the position, and the unit — so that
 * `5` can mean the right thing everywhere instead of meaning 5:4 and being wrong half the time.
 *
 * The rule, in one line: **M is the nearest natural grouping of the unit that makes a real tuplet.**
 *
 *   1. The span being divided is the metrical GROUP the position falls in — the beat, and in 7/8 the
 *      beat you are actually on, since its groups differ (3+2+2).
 *   2. The natural groupings of the unit are that span and its halvings and doublings: 4/4 counted in
 *      eighths gives 1, 2, 4, 8; 6/8 in eighths gives 3, 6, 12 — never 2 or 4, which is exactly why
 *      the answer differs by meter.
 *   3. Prefer to SQUEEZE: the largest grouping below N. Failing that, STRETCH to the smallest one
 *      above — which is how the duplet arrives at 2:3, the one case where M exceeds N.
 *   4. Skip any candidate where N:M reduces to a power of two (2:1, 4:2, 8:4, 1:2). Those are not
 *      tuplets at all, only the same notes written at another value — and refusing them is what makes
 *      the answer NULL for a duplet in 4/4 or a triplet of eighths in 6/8, where no tuplet exists.
 *
 * ⛔ It is deliberately NOT `defaultNotesOccupied(n)`. A table keyed on N alone cannot know the meter,
 * and the whole point is that it must.
 */
export function deriveTupletM(
  numNotes: number,
  unit: NoteDuration,
  unitDots: number,
  meter: TimeSignature,
  /** Where the group starts, in quarter-note beats from the bar's start. */
  beat: Fraction,
): number | null {
  if (!Number.isInteger(numNotes) || numNotes < 2) return null

  const info = getMeterInfo(meter)
  const span = metricalGroupAt(info, beat)
  const unitSpan = durationToFraction(unit, unitDots)
  const perGroup = fracDiv(span, unitSpan)
  // The unit has to COUNT in this span: a dotted quarter does not fit a whole number of times into a
  // 4/4 beat, and a rule that rounded there would answer confidently and wrongly.
  if (perGroup.den !== 1) return null

  // The span, its halvings (while they stay whole) and its doublings. Bounded because a tuplet
  // borrowing from sixteen beats is not a tuplet anyone is entering by pressing a number.
  const candidates: number[] = []
  for (let n = perGroup.num; n >= 1 && Number.isInteger(n); n /= 2) {
    candidates.unshift(n)
    if (n % 2 !== 0) break
  }
  for (let n = perGroup.num * 2; n <= perGroup.num * 8; n *= 2) candidates.push(n)

  const real = (m: number): boolean => !isPowerOfTwoRatio(numNotes, m)
  const below = candidates.filter(m => m < numNotes && real(m))
  if (below.length) return below[below.length - 1]
  const above = candidates.filter(m => m > numNotes && real(m))
  return above.length ? above[0] : null
}

/** The metrical group `beat` falls inside, in quarters — the beat you are ON, which in 7/8 (3+2+2)
 *  is not the same length everywhere in the bar. */
function metricalGroupAt(info: ReturnType<typeof getMeterInfo>, beat: Fraction): Fraction {
  let start = fracCreate(0, 1)
  for (const group of info.groups) {
    const end = fracAdd(start, group)
    if (fracLt(beat, end)) return group
    start = end
  }
  // Past the bar's end (an overfull bar, or a position being previewed): the felt beat is the best
  // answer available, and it is the one every uniform meter would have given anyway.
  return info.beatUnit
}

/** Does N:M reduce to a power of two — 2:1, 4:2, 1:2, or 1:1? Then it is not a tuplet: the same
 *  notes are written at another value, with no borrowing at all. */
function isPowerOfTwoRatio(numNotes: number, m: number): boolean {
  const g = gcd(numNotes, m)
  const isPow2 = (x: number): boolean => x >= 1 && (x & (x - 1)) === 0
  return isPow2(numNotes / g) && isPow2(m / g)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
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
  if (!Number.isInteger(numNotes) || numNotes < 2) return { ok: false, reason: 'You need at least 2 notes in the group' }
  if (!Number.isInteger(normalCount) || normalCount < 1) return { ok: false, reason: 'The time it replaces must be at least one note' }

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
    return { ok: false, reason: 'The notes would keep their own value' }
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
 * `style` is {@link Tuplet.numberStyle} — what the user chose. Absent = AUTO, and the rule is
 * {@link autoNumberStyle}, stated once here so a GHOST and the engraved mark cannot drift: a preview
 * reading `4` for something that will engrave as `4:3` is a preview of a different tuplet.
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

/** Where a mark is being printed — the meter of its bar and where in that bar it starts. What the
 *  auto rule needs to know whether a bare number is readable. */
export interface TupletMarkContext {
  meter: TimeSignature
  /** The tuplet's start, in quarter-note beats from the bar's start. */
  beat: Fraction
}

/**
 * The RULE behind an absent {@link Tuplet.numberStyle}: **a bare number when the meter already says
 * what it is in the time of, the ratio when it does not.**
 *
 * A number alone is an instruction the reader completes from the meter — `5` in 4/4 is five in the
 * time of four, and in 6/8 five in the time of three, because that is what the beat divides into
 * ({@link deriveTupletM}). So when a tuplet's M is the one its meter would have given, the figure is
 * enough. When it is not — a duplet in 4/4, a quadruplet in simple meter, any borrowed span the
 * reader has no way to infer — the ratio has to be printed or the notation is a guess.
 *
 * The consequence is that the SAME tuplet prints differently in different bars, and it should: `2`
 * over a 6/8 bar is the duplet everyone knows, while the same 2:3 in 4/4 is a thing you have to be
 * told.
 *
 * ⛔ Replaced VexFlow's own default, `|N − M| > 1`, which printed `6:4` and `7:4` in full but left the
 * quadruplet as a bare `4`. That test measures the distance between two numbers, which is not a fact
 * about music: nothing makes 7:4 harder to read than 5:4.
 *
 * Without a context (a caller that has no bar to point at) it falls back to the meter-free
 * approximation of the same idea: N a power of two above 2 is unguessable in simple meter, since it
 * can only be borrowing from a ternary span, and everything else names its tuplet by convention.
 */
function autoNumberStyle(t: TupletShape, printedM: number, ctx?: TupletMarkContext): TupletNumberStyle {
  if (ctx) {
    const expected = deriveTupletM(t.numNotes, t.baseDuration, t.baseDots ?? 0, ctx.meter, ctx.beat)
    return expected === printedM ? 'number' : 'ratio'
  }
  const binary = t.numNotes > 2 && (t.numNotes & (t.numNotes - 1)) === 0
  return binary ? 'ratio' : 'number'
}

/** SMuFL `tupletColon` — the separator between a mark's two figures, in the music font's own cut. */
const TUPLET_COLON = '\uE88A'

/** A note VALUE beside a figure, in the metronome cut with its augmentation dots. */
function markNoteGlyph(duration: NoteDuration, dots = 0): string {
  return MET_NOTE_GLYPH[duration] + MET_AUGMENTATION_DOT.repeat(dots)
}

/**
 * The mark as a list of RUNS — see {@link TupletMarkRun} for why it cannot be one string.
 *
 * The styles, and what each is FOR:
 *
 *   `number`     `3`       — N alone; the reader completes it from convention.
 *   `ratio`      `3:2`     — both figures in the tuplet's OWN written unit, which is what a bare
 *                            ratio means: three eighths in the time of two eighths.
 *   `ratioNote`  `3:2♪`    — that ratio, naming the unit it counts (Sibelius's *Ratio + note*).
 *   `entryRatio` `5x:1q`   — the sentence the user TYPED, each side with its own note value. It
 *                            differs from `ratio` exactly when the sentence used two different
 *                            values, which is when a converted second figure is hardest to read back.
 *
 * `entryRatio` is printable only because the entry is KEPT rather than folded into the ratio
 * ({@link TupletShape.normalCount} and friends). With no entry recorded both sides are the same
 * value, and it prints what `ratioNote` would.
 */
export function tupletMarkRuns(
  t: TupletShape,
  style?: TupletNumberStyle,
  /** The bar this mark sits in — what makes the automatic choice meter-aware. See
   *  {@link autoNumberStyle}; absent falls back to the meter-free approximation. */
  ctx?: TupletMarkContext,
): TupletMarkRun[] {
  const digits = (n: number): string => {
    let out = ''
    for (let rest = n; rest >= 1; rest = Math.floor(rest / 10)) {
      out = String.fromCharCode(0xe880 + (rest % 10)) + out
    }
    return out
  }
  const printed = tupletPrintedCounts(t)
  const resolved = style ?? autoNumberStyle(t, printed.notesOccupied, ctx)
  if (resolved === 'none') return []
  if (resolved === 'number') return [{ text: digits(printed.numNotes) }]

  if (resolved === 'entryRatio') {
    // Straight off the TYPED sentence: the actual side as written, the normal side as named. NOT
    // `tupletPrintedCounts`, which is the converted reading — the very thing this style exists to
    // avoid. The fallbacks are the model's own rule, that an absent normal side means "the same
    // value as the actual side".
    const normalCount = t.normalCount ?? t.notesOccupied
    const normalDuration = t.normalDuration ?? t.baseDuration
    const normalDots = (t.normalDuration ? t.normalDots : t.baseDots) ?? 0
    // `5 ♬ : 1 ♩` — air between a figure and its note value, and around the colon, which here has a
    // GLYPH on its left rather than a digit. A colon set tight against a notehead reads as part of
    // the glyph; between two bare figures (`5:4`) it does not, and gets none.
    return [
      { text: digits(t.numNotes) },
      { text: markNoteGlyph(t.baseDuration, t.baseDots ?? 0), glyph: true, space: true },
      { text: TUPLET_COLON, space: true },
      { text: digits(normalCount), space: true },
      { text: markNoteGlyph(normalDuration, normalDots), glyph: true, space: true },
    ]
  }
  const ratio = `${digits(printed.numNotes)}${TUPLET_COLON}${digits(printed.notesOccupied)}`
  // "Ratio + note" names the value the two figures are counting (Sibelius writes `5:3x`, the x being
  // the tuplet's own sixteenth).
  //
  // In the METRONOME cut of the note, not the staff's own: a `noteQuarterUp` is drawn against a
  // five-line staff and towers over the small tuplet digits beside it. `metNote…` is the same value
  // cut for running text, which is exactly what this string is — and the dot goes with it, since an
  // ASCII full stop next to a music glyph is a full stop, not an augmentation dot.
  if (resolved === 'ratioNote') {
    // `3:2 ♪` — the same rule: a figure and the note value it counts are two things, so they get air
    // between them. The colon sits between two figures here and stays tight.
    return [
      { text: ratio },
      { text: markNoteGlyph(printed.value, printed.dots), glyph: true, space: true },
    ]
  }
  return [{ text: ratio }]
}

/** The whole mark as ONE string — for callers that draw it in a single run and can live with the
 *  note glyphs at the figures' size. See {@link tupletMarkRuns} for why that is a compromise. */
export function tupletMarkText(t: TupletShape, style?: TupletNumberStyle, ctx?: TupletMarkContext): string {
  return tupletMarkRuns(t, style, ctx).map(r => r.text).join('')
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

/**
 * ⭐ The bar's notes AS THE RUNNING-ACCIDENTAL RULE SEES THEM — {@link getMeasureNotes} plus every
 * FANNED member, at the beat it sounds on.
 *
 * A member is a note in the bar, so its accidental holds for the rest of it like any other's
 * (docs/fanned-beam-pitches-plan.md §2, his decision). Left out, a member's F♯ followed by an
 * ordinary F later in the bar would draw no natural — and the sign a note DISPLAYS would disagree
 * with the sign it is engraved with.
 *
 * ⛔ **Not by teaching `getMeasureNotes` to emit them.** It has two dozen callers — spans, counts,
 * navigation, the clipboard's own `selectedSpans` — and every one of them would silently gain N
 * notes per fan. The accidental queries take a list the CALLER chooses (the scope seam
 * `accidentalState.ts` documents), so this is that list and nothing else changes.
 *
 * The member beats are `slot.beat + Σ preceding member quarters` — arbitrary rationals (8/15 of a
 * beat is an ordinary answer), which is fine: `prevailingAlterations` only ever COMPARES beats, so
 * an un-notatable position is a perfectly good one to walk past.
 */
export function measureAccidentalNotes(measure: Measure): AccidentalNote[] {
  const notes: AccidentalNote[] = getMeasureNotes(measure)
  for (const slot of measure.slots) {
    if (slot.type !== 'chord' || !slot.fan?.members?.length) continue
    const spans = fanMembers(slot.fan, slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0))
    let beat = slot.beat
    for (let k = 0; k < slot.fan.members.length; k++) {
      beat = fracAdd(beat, spans[k]?.quarters ?? fracCreate(0, 1)) // member k+1 starts after member k
      for (const p of slot.fan.members[k]) {
        notes.push({ step: p.step, alter: p.alter, octave: p.octave, beat })
      }
    }
  }
  return notes
}
