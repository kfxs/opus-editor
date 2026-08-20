/**
 * WHERE WRITTEN PITCH BECOMES SOUND — the one function that answers *"how far is this position's
 * notated pitch from the pitch you hear"*, in semitones. See docs/ottava-plan.md §6.
 *
 * ⭐ **Our model stores WRITTEN pitch** ({@link Ottava}): an 8va does not move a notehead, it moves
 * the sound. So the octave has to be added back somewhere, and the whole design rests on that
 * somewhere being *singular* — the argument `docs/octave-clefs-plan.md` §1 made first: storing the
 * sound instead means every note must be shifted back before it reaches VexFlow, and **a missed
 * site draws silently an octave wrong**. Written pitch inverts that risk into this file, where a
 * missed site *sounds* an octave wrong — still silent, but reachable from one place.
 *
 * ⭐⭐ **This is deliberately the seam the OCTAVE CLEF will share.** `docs/octave-clefs-plan.md`
 * §2.4's one genuinely new coupling is "resolve the effective clef here and subtract 12 under an
 * 8vb clef", which is this signature exactly. When that arrives it becomes a second term in
 * {@link soundingShiftAt}, not a second resolver — and that matters beyond tidiness, because it is
 * where that plan's stated TRAP can be *checked at all*: an 8vb clef **and** an octave-transposing
 * instrument is two octaves down, and nothing objects unless one place knows about both.
 *
 * ⭐ It answers a question about the SCORE, so it lives here beside `tempoMap`'s `effectiveTempoAt`
 * and `clefUtils`' `effectiveClefAt` — the same positional-resolution shape. ⛔ Never a method on
 * `MusicEngine`, which is the *editor's* facade (CLAUDE.md; DESIGN-PRINCIPLES §5).
 *
 * Pure: no engine imports, no VexFlow, no instance state.
 */
import type { Score, Fraction, PitchSpelling } from '@/types/music'
import { fracCreate, fracAdd, fracLt, fracGte } from './fraction'
import { measureCapacityFrac } from './measureCapacity'

const ZERO: Fraction = fracCreate(0, 1)

/** Semitones in one octave of shift — `Ottava.shift` counts octaves, this file speaks semitones. */
const SEMITONES_PER_OCTAVE = 12

/**
 * One octave line flattened onto the absolute beat axis: `[startAbs, endAbs)`, half-open.
 *
 * Half-open because {@link Ottava.length} is *an amount of music*: a note attacking exactly where
 * the span ends is the first note NOT under the bracket. (The same window rule the clipboard and
 * the rebar's paste filter use, and the reason a wedge finishing on a barline covers the bar.)
 */
interface OttavaRegion {
  startAbs: Fraction
  endAbs: Fraction
  staffId?: string
  /** Octaves, signed — `Ottava.shift` verbatim. */
  shift: number
}

/**
 * Does an octave line belong to the staff addressed by `staffId`? An absent id on either side
 * resolves to the first staff, so at N=1 (all absent, query undefined) every line matches the one
 * staff. `clefUtils.clefOnStaff`'s three lines, for `clefUtils`' reason — this module is in
 * `utils/` and may not reach into `engine/models/staffContent` for `matchesStaff`.
 */
function ottavaOnStaff(regionStaffId: string | undefined, staffId: string | undefined, score: Score): boolean {
  const first = score.staves?.[0]?.id
  return (regionStaffId ?? first) === (staffId ?? first)
}

/** Every octave line in the score, on the absolute beat axis. Empty for the ordinary score. */
function ottavaRegions(score: Score): OttavaRegion[] {
  const out: OttavaRegion[] = []
  let base = ZERO
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    for (const o of m.ottavas ?? []) {
      const startAbs = fracAdd(base, o.beat)
      out.push({ startAbs, endAbs: fracAdd(startAbs, o.length), staffId: o.staffId, shift: o.shift })
    }
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return out
}

/**
 * The shift in force at one absolute position, over pre-flattened regions.
 *
 * ⭐⭐ **THE OVERLAP RULE, and it is this file's one real decision.** `ottavaOps` refuses two lines
 * that *start* on one (beat, staff) — a contradiction, not a stack — but it deliberately leaves two
 * merely OVERLAPPING lines storable, because truncate-or-refuse is a question about an entry gesture
 * and this is the reader that has to survive whatever gets stored. The answer:
 *
 * > **the latest-starting line that still covers the position wins.**
 *
 * That is `effectiveClefAt`'s rule, not an invention — the latest statement at or before a position
 * governs it — and it is the right one here for the reason §4 gives for the model's whole shape: an
 * ottava IS a clef-shaped statement. A later 15ma opening inside an 8va takes over exactly as a bass
 * clef takes over from a treble; and when it ends, an outer line that is still running resumes,
 * because the question asked is *what covers this note*, not *what was declared most recently*.
 *
 * ⛔ **Never a SUM.** Two lines covering one note is not a 15ma — it is two people saying different
 * things about one passage, and adding them would make the loudest possible wrong answer out of the
 * least reliable input.
 */
function shiftOverRegions(regions: OttavaRegion[], absBeat: Fraction, staffId: string | undefined, score: Score): number {
  let best: OttavaRegion | null = null
  for (const r of regions) {
    if (fracLt(absBeat, r.startAbs) || fracGte(absBeat, r.endAbs)) continue
    if (!ottavaOnStaff(r.staffId, staffId, score)) continue
    // `>=`, so on an exact tie the LATER entry in the array wins — the same last-wins tie-break the
    // rebar's restore uses. (`ottavaOps` upserts, so a tie only reaches here from hand-written JSON.)
    if (!best || fracGte(r.startAbs, best.startAbs)) best = r
  }
  return best ? best.shift * SEMITONES_PER_OCTAVE : 0
}

/**
 * ⭐ **How far this position's written pitch is from its sounding pitch, in SEMITONES.** 0 for the
 * ordinary note; +12 under an 8va, −12 under an 8vb, +24 under a 15ma.
 *
 * Semitones rather than octaves precisely because it is a SUM waiting to happen (see the module
 * comment): an octave clef contributes semitones too, and so would a transposing instrument.
 *
 * ⚠️ For scheduling a whole score, use {@link soundingShiftBySlot} instead — this one re-flattens
 * every octave line per call, which is the wrong direction inside a loop over slots.
 */
export function soundingShiftAt(score: Score, measureNumber: number, beat: Fraction, staffId?: string): number {
  const regions = ottavaRegions(score)
  if (regions.length === 0) return 0

  let base = ZERO
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    if (m.number === measureNumber) return shiftOverRegions(regions, fracAdd(base, beat), staffId, score)
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return 0 // no such measure — a position that is not in the score is not under anything
}

/**
 * ⭐ **Every SLOT's shift, resolved ONCE** — `trilledSlotIds`' shape, and for a sharper version of
 * its reason (docs/ottava-plan.md §6).
 *
 * ⚠️ **The point is not speed, it is that there is no single seam downstream.** `playbackSchedule`
 * derives a MIDI number in four places — a chord's notes, the fan attacks, the two-note tremolo's
 * pitch sets and the trill's auxiliary — on three independent emit paths. Shifting *some* of them
 * is a silent octave bug in the others: a trill under an 8va would trill in the wrong octave and
 * nothing would fail. Resolving per SLOT, up front, makes the rule one a reader can check by grep —
 * *every `spellingToMidi` in that file takes its slot's shift, except the comparison* — instead of
 * a seam that has to be found four times.
 *
 * ⭐ Per slot is the right grain because everything downstream that re-attacks — the tremolo, the
 * fan's members, the trill's alternation — sounds *inside one slot's position*, so one lookup
 * covers a gesture however many notes it emits.
 *
 * @returns slot id → semitones, **only for slots that are actually shifted**. An empty map is the
 *   ordinary score, and `?? 0` at the call site is the whole of the un-shifted path.
 */
export function soundingShiftBySlot(score: Score): Map<string, number> {
  const out = new Map<string, number>()
  const regions = ottavaRegions(score)
  if (regions.length === 0) return out

  let base = ZERO
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    for (const slot of m.slots) {
      if (slot.type !== 'chord') continue // a rest has no pitch to shift
      const shift = shiftOverRegions(regions, fracAdd(base, slot.beat), slot.staffId, score)
      if (shift !== 0) out.set(slot.id, shift)
    }
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return out
}

/**
 * ⭐⭐ **WRITTEN SPELLING + THE SHIFT = THE SOUNDING SPELLING** — the fold that lets the schedule
 * carry a PITCH instead of a MIDI integer (docs/playback-semantics-plan.md, built 2026-08-20).
 *
 * ## ⭐ Why this adds to the OCTAVE NUMBER and not to a semitone count
 *
 * Because an **octave is the one transformation no representation change can break**: it is 12
 * semitones, ×2 in frequency and +1 to the octave number **in every tuning system**, so folding it
 * into `octave` is exact and stays exact. `alter` is untouched — an 8va does not change an
 * accidental, it changes a register.
 *
 * ⛔⛔ **And this is why the schedule carries no `shiftSemitones` field.** A semitone count was the
 * obvious shape and it is the wrong currency the moment the shift is *not* an octave: a transposing
 * instrument (a B♭ clarinet, written-to-sounding a major second) is a DIATONIC + CHROMATIC operation
 * on the spelling, and in meantone "down a major 2nd" is not a number of semitones at all — the same
 * conflation `docs/tuning-systems-and-alteration.md` catches in `alter` itself. So when that case
 * arrives it is a **spelling transposition**, written here beside this function; ⛔ it is never a
 * number added at the audio boundary.
 *
 * ## ⚠️ The non-octave shift, and why it does not throw
 *
 * Every producer today multiplies `Ottava.shift` (octaves) by 12, and the octave clef this seam is
 * reserved for (§ the module note) is octaves too — so a remainder is unreachable from any score the
 * editor can write. It is reachable from hand-edited JSON, and a throw there would kill the whole
 * play. ⭐ So it **logs and returns the WRITTEN spelling**: that is not a guess, it is the honest
 * *"this shift could not be expressed"*, and it is the one answer that cannot invent a pitch nobody
 * notated. ⛔ Do not "round to the nearest octave" — that is exactly the guessing fallback that gets
 * believed.
 */
export function applySoundingShift(spelling: PitchSpelling, semitones: number): PitchSpelling {
  if (semitones === 0) return spelling
  const octaves = semitones / SEMITONES_PER_OCTAVE
  if (!Number.isInteger(octaves)) {
    console.error(
      `applySoundingShift: ${semitones} semitones is not a whole octave. A non-octave shift is a `
      + 'SPELLING transposition, not a number (docs/tuning-systems-and-alteration.md); sounding the '
      + 'written pitch instead.')
    return spelling
  }
  return { ...spelling, octave: spelling.octave + octaves }
}
