/**
 * The FANNED-BEAM expander — the one pure function that turns the stored assertion
 * ({@link FanMark}: "play this note as 6, accelerating") into the notes it is played and drawn as.
 *
 * ⭐ **Written once so its three consumers can never disagree**: the drawing (where the stems go),
 * the playback (when each note sounds) and, if a MusicXML exporter ever lands, the N `<note>`s it
 * would have to emit. Assertion → consequence is a function; the reverse is not, which is why the
 * model stores the assertion and this file is the only place the consequence exists.
 *
 * ⚠️ **EVERY NUMBER IN THIS FILE IS PROVISIONAL** — see docs/fanned-beams-plan.md §1. None of them
 * is a considered engraving or performance decision; they exist so the feature is usable today and
 * they are expected to be wrong. Each lives in exactly one named constant so changing it is a
 * one-line edit. In particular the ramp is LINEAR, and a real accelerando is not: {@link FanCurve}
 * exists from day one so that swapping in a geometric or eased ramp later touches this function and
 * no caller. That is the only thing it promises.
 *
 * No VexFlow, no DOM — pure, and unit-tested as such.
 */
import { v4 as uuidv4 } from 'uuid'
import type { Chord, ChordRest, FanMark, FanMemberChord, NotePitch } from '@/types/music'
import { type Fraction, fracCreate, fracFromInt, fracAdd, fracMul, fracDiv, fracSub, fracToNumber } from './fraction'

/**
 * The SVG group a fan's ink is painted into — class `vf-fan`, id `vf-fan-<slotId>`.
 *
 * ⚠️ `openGroup` PREFIXES both with `vf-`, so the bare name is what goes in. The id carries the name
 * as well as the slot because `getElementById` is document-wide
 * (reference_vexflow_getsvgelement_is_document_wide) and a bare slot id would collide.
 */
export const FAN_GROUP = 'fan'

/** How many notes a fan is played as when one is first applied. */
export const DEFAULT_FAN_COUNT = 6

/** How many beam lines the WIDE end of a new fan carries. The narrow end is always 1. */
export const DEFAULT_FAN_BEAMS = 3

/**
 * The shape of the ramp between the slow end and the fast one. Linear today, and deliberately
 * named rather than assumed — see the file header.
 */
export type FanCurve = 'linear'

/**
 * The bounds an EDITED fan is held inside (P4). ⚠️ **Sanity guards, not engraving claims** — nothing
 * here says a 20-note fan is wrong, only that a typed number should not be able to ask the renderer
 * for a thousand noteheads or a speed ratio of 2^99.
 *
 * `MAX_FAN_BEAMS` is where the two meet notation anyway: beam lines are note values, so 4 is a 64th
 * and past that there is nothing left to name. The ceiling on the count is pure arithmetic — at that
 * many members `fanColumns` is already asking for more width than a system has, and the drawing has
 * been compressing evenly for a while.
 */
export const MAX_FAN_COUNT = 32
export const MAX_FAN_BEAMS = 6

/**
 * How far apart the wide end's beam lines may be pulled — a multiple of the ordinary beam gap, so
 * `1` is the floor (any less and the lines overlap) and this is the ceiling. Four ordinary gaps
 * between each line is already a wedge taller than the staff at three beams; past that the fan stops
 * reading as a beam group at all.
 */
export const MAX_FAN_SPREAD = 4

/**
 * Hold a spread inside `[1, {@link MAX_FAN_SPREAD}]`; a non-number becomes 1 (the ordinary gap).
 *
 * ⚠️ **Rounded to two decimals, and that is not cosmetic.** `laneFingerprint` — the width cache key —
 * stringifies the slot whole, so a spread that arrives as `1.7000000000000002` from an input step
 * would mint its own cache key for the same picture. Fractions are allowed; float noise is not.
 */
export function clampFanSpread(spread: number): number {
  if (!Number.isFinite(spread)) return 1
  return Math.round(Math.min(MAX_FAN_SPREAD, Math.max(1, spread)) * 100) / 100
}

/** Hold a member count inside {@link MAX_FAN_COUNT}; a non-number or below 1 becomes 1 (the note itself). */
export function clampFanCount(count: number): number {
  if (!Number.isFinite(count)) return 1
  return Math.min(MAX_FAN_COUNT, Math.max(1, Math.round(count)))
}

/** Hold a beam count inside {@link MAX_FAN_BEAMS}; a non-number or below 1 becomes 1 (no feathering). */
export function clampFanBeams(beams: number): number {
  if (!Number.isFinite(beams)) return 1
  return Math.min(MAX_FAN_BEAMS, Math.max(1, Math.round(beams)))
}

/**
 * How many members a fan claims — `count`, held at 1 or more and whole.
 *
 * A one-liner with a name because it was spelled out at every reader, and a fan whose count is read
 * two different ways is a fan whose drawing and playback disagree about how many notes there are.
 */
export function fanCount(fan: FanMark): number {
  return Math.max(1, Math.round(fan.count))
}

/**
 * ⭐ How far apart this fan's wide end spreads its lines — {@link FanMark.spread}, resolved. Absent
 * is 1: the ordinary beam gap, and the picture every fan drew before this existed.
 *
 * ⚠️ **It CLAMPS, it does not trust**, for {@link fanRampRange}'s reason — `normalizeFan` runs from
 * `ScoreModel.setFan` alone, while `fromJSON` and the undo restore hand the readers whatever the file
 * said. A spread of 0 would stack every line on the primary and a negative one would draw the wedge
 * inside out; both cost one call to make impossible.
 *
 * ⚠️ It is the DRAWING's number and no one else's — nothing in `fanWeights`, `fanColumns` or
 * `fanMembers` may read it. See {@link FanMark.spread}.
 */
export function fanSpread(fan: FanMark): number {
  return clampFanSpread(fan.spread ?? 1)
}

/**
 * ⭐ Which members the feathering covers — {@link FanMark.rampFrom}/{@link FanMark.rampTo} resolved
 * against the count, 0-based and INCLUSIVE. Absent on either side means that end of the group.
 *
 * ⚠️ **It CLAMPS, it does not trust.** `normalizeFan` is the one place these are written, and it runs
 * from `ScoreModel.setFan` alone — `fromJSON` and the undo restore hand the readers whatever the file
 * said. Every other fan reader defends itself for exactly that reason (`fanMemberPitches` falls back
 * to the slot's pitches, the count is re-rounded at each use), and a range read past the end of its
 * own ramp is the one failure mode this feature adds. One line, so it is not worth being clever
 * about.
 *
 * `rampFrom` is pinned first and `rampTo` pushed out past it, so a group that SHRINKS under a range
 * pulls the far end in — `[0…5]` on a fan cut to three members becomes `[0…2]`, the whole group
 * again — and a pair that arrives crossed keeps the start the user typed.
 *
 * A fan of one member has no range to speak of and reports `{from: 0, to: 0}`; every caller has
 * already returned by then (there is no ramp, no wedge and nothing to draw).
 */
export function fanRampRange(fan: FanMark): { from: number; to: number } {
  return rampRange(fanCount(fan), fan.rampFrom, fan.rampTo)
}

/**
 * The same answer for a caller holding the two numbers loose — {@link fannedBeamGeometry}, which is
 * given a member LIST rather than a mark and must clamp against the length it will actually index.
 *
 * Separate so the arithmetic above has one home and not two: an `stems[rampTo]` that runs off the
 * end of the array is the one way this feature crashes, and it must not depend on the renderer
 * having resolved the range correctly on the way in.
 */
export function rampRange(count: number, rampFrom?: number, rampTo?: number): { from: number; to: number } {
  const n = Math.max(1, Math.round(count))
  if (n < 2) return { from: 0, to: 0 }
  // A number that is not one is not an end: it means the same as absence, which is that end of the
  // group. Resolved BEFORE the clamp, so a `NaN` cannot arrive at the bounds and come back as 0.
  const asked = (v: number | undefined, absent: number) =>
    v !== undefined && Number.isFinite(v) ? Math.round(v) : absent
  const from = Math.min(n - 2, Math.max(0, asked(rampFrom, 0)))
  const to = Math.min(n - 1, Math.max(from + 1, asked(rampTo, n - 1)))
  return { from, to }
}

/**
 * ⭐ **THE ONE OWNER OF THE WEIGHT SHAPE** — count, ratio, direction *and* range, resolved into one
 * duration weight per member. `fanMembers` (playback, head spacing) and `fanColumns` (bar width) both
 * read it, and neither knows what a range is.
 *
 * - outside `[rampFrom, rampTo]`: weight `1` — the base, and the note value the wedge's narrow end
 *   converges to, so an outside note draws with ONE beam and sounds at the steady speed;
 * - inside: {@link rampWeights} across the range's own length, reversed for a `rit`.
 *
 * ⚠️ **The direction lives HERE, and that is the whole reason this function exists.** Both callers
 * used to reverse the array themselves, which was harmless while the ramp covered the group and
 * fatal the moment it does not: reversing the WHOLE array mirrors an inset mark to the other end of
 * the fan. The reversal belongs to the ramp, not to the group.
 *
 * ⚠️ Takes the mark, never `(fan, n)` — the count is spelled out at four readers today, and handing
 * it in as an argument re-opens the exact disagreement this closes.
 */
export function fanWeights(fan: FanMark): Fraction[] {
  const n = fanCount(fan)
  if (n < 2) return [fracFromInt(1)]
  const { from, to } = fanRampRange(fan)
  const ramp = rampWeights(to - from + 1, fanSpeedRatio(fan.beams))
  if (fan.direction === 'rit') ramp.reverse()
  const weights: Fraction[] = []
  for (let k = 0; k < n; k++) weights.push(k >= from && k <= to ? ramp[k - from] : fracFromInt(1))
  return weights
}

/**
 * How many times faster the fast end is than the slow one, read off the beam count.
 *
 * **A beam IS a halving**, so 1 → 3 beams is 4×: the same arithmetic that makes a note with two
 * beams twice the speed of one with a single beam. A first guess, not a measurement — the beam
 * count is what the reader sees, so deriving the speed from it at least keeps the sound and the
 * picture saying the same thing.
 */
export function fanSpeedRatio(beams: number): number {
  return 2 ** (Math.max(1, Math.round(beams)) - 1)
}

/**
 * ⭐ How many COLUMNS of horizontal space a FAN needs — **counting from the ramp, not from the
 * member count**, which is the difference between a fan that reads and one that collapses.
 *
 * The heads are placed PROPORTIONALLY to their durations, so the group's tightest gap is its
 * shortest note: `gap_k / span = w_k / Σw`. For the tightest of them to be one ordinary column wide,
 * the whole span must therefore be `Σw / w_tightest` columns — which is a much bigger number than
 * `count`, and the reason a `rit.` was the worst case reported (a rallentando OPENS with its fastest
 * notes, so its tightest gaps are at the very start).
 *
 * ⭐ **Only the gaps BETWEEN heads count — the last member's weight is in neither term.** It is not
 * in the minimum (nothing follows it inside the group) and it is not in the SUM either, which is the
 * half this got wrong: counted in, the group reserved the last member's own duration as blank space
 * after its last head. On an accel that is 0.9 of a column and invisible; on a `rit`, whose last
 * member is its LONGEST, it is four columns of white — his report, *"a lot of space between the end
 * of the fan and the rest… interesting that it happens with rit but not with accel"*, and the room
 * came out of the notes that had to share the bar with it. What follows the last head is one
 * ordinary column, the `+ 1`, exactly as after any other note.
 *
 * ⚠️ The unit is `MIN_NOTE_SPACING`: one column is what an ordinary event gets, and that is exactly
 * the claim being made — *a fanned note takes the room of this many notes.* It has to be a count
 * rather than a measured width because the width pass runs where glyphs cannot be measured.
 *
 * A RANGE is already in the answer, because {@link fanWeights} is: an inset mark holds its outside
 * members at weight 1, so the ramp asking for the room is the one actually drawn. It can ask for
 * MORE, not less — a wedge that ends before the group does puts the tightest gap inside the span
 * instead of after the last head, where it was not counted.
 */
export function fanColumns(fan: FanMark): number {
  const n = fanCount(fan)
  if (n < 2) return 1
  const weights = fanWeights(fan).map(fracToNumber)
  const gaps = weights.slice(0, n - 1) // the gaps, not the members: nothing follows the last head
  const span = gaps.reduce((a, b) => a + b, 0)
  const tightest = Math.min(...gaps)
  return Math.ceil(span / tightest) + 1
}

/**
 * How many COLUMNS of horizontal space a slot claims — 1 for an ordinary event, {@link fanColumns}
 * for a fanned one.
 *
 * 🚨 **The width computation, not the width key.** The key is free: `laneFingerprint` stringifies
 * `lane.slots` whole, so a new slot field reaches both keys by construction. The NUMBER is not: bar
 * width floors at `slots.length × MIN_NOTE_SPACING` (18px — "the floor is what actually spaces
 * music"), and a fanned slot is one slot, so its members would be asked to live in one note's 18px.
 *
 * ⚠️ It must be used by **both** counts in `MeasureLayout` — the width's own floor and the
 * incompressible `spacingFloor` — because a floor larger than the width it floors makes the bar
 * incompressible. See docs/fanned-beams-plan.md §3 (P1).
 */
export function slotColumns(slot: ChordRest): number {
  return slot.type === 'chord' && slot.fan ? fanColumns(slot.fan) : 1
}

/** The columns a whole lane claims — `slots.length` with every fan counted out. */
export function laneColumns(slots: ChordRest[]): number {
  return slots.reduce((n, slot) => n + slotColumns(slot), 0)
}

/**
 * Copy ONE member — fresh pitch ids, and only what a member is allowed to carry.
 *
 * A member is a note (it has an id, so it can be clicked, arrowed and retyped), but it is not the
 * tied or slurred thing the SLOT is: a `tiedTo` copied onto a member would be a reference that
 * `TieRenderer` — which looks its id up in `slot.notes` — can never reach: stored, never drawn.
 *
 * ⭐ ARTICULATIONS DO travel, unlike when this was written: they are the member's own now
 * ({@link FanMemberChord.articulations}), so a member grown from the last one inherits its marks
 * exactly as it inherits its pitch. A new member of a staccato run is staccato, which is the same
 * reasoning that makes a grown member copy the LAST one rather than the first.
 */
function copyMember(member: FanMemberChord): FanMemberChord {
  const out: FanMemberChord = {
    pitches: member.pitches.map((p) => {
      const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
      if (p.forceAccidental) np.forceAccidental = true
      return np
    }),
  }
  if (member.articulations?.length) out.articulations = [...member.articulations]
  return out
}

/**
 * ⭐ Hold `count` and {@link FanMark.members} in step — the ONE function allowed to know that
 * `members.length === count - 1` (member 0 is the slot's own chord, never repeated in the list).
 *
 * Four jobs, and each is a decision:
 * - **materialise** (no members yet): every member starts as a copy of the note you typed, so a
 *   fresh fan sounds and draws exactly as it did before this existed;
 * - **grow**: new members copy the LAST one — a rising line continues rising. Jumping back to the
 *   first note is never what was meant;
 * - **shrink**: drop from the end;
 * - **settle the ramp range** against the count it just clamped — see the body. The same off-by-one
 *   that makes `members.length === count - 1` this function's business makes `rampTo ≤ count-1` its
 *   business too, and for the same reason: nobody else knows the count is about to change.
 *
 * ⚠️ **PURE — a fresh `members` array out, and the one handed in is never touched.** `toFlatNote`
 * hands out the LIVE `chord.fan` (reference_live_model_objects_break_dedup) and `FanEditController`
 * builds its next mark by spreading it, so an in-place edit here would reach through that spread and
 * write into the model behind the mutator's back. Undo would not catch it either
 * (`UndoRedoManager` snapshots by JSON round-trip), which is exactly what makes it silent.
 * The member arrays that SURVIVE are reused as-is, not re-copied: a member's id has to outlive an
 * unrelated beams edit, or every selection would drop on the next keystroke.
 */
export function normalizeFan(fan: FanMark, own: NotePitch[]): FanMark {
  const count = clampFanCount(fan.count)
  const want = count - 1
  const members = (fan.members ?? []).slice(0, want)
  // Materialising from the slot's own chord takes its PITCHES only: member 0's articulations stay
  // member 0's (they live on the chord), so a fresh fan marks one head, exactly as it did before
  // members could carry marks of their own.
  const source: FanMemberChord = members[members.length - 1] ?? { pitches: own }
  while (members.length < want) members.push(copyMember(source))
  const out: FanMark = { ...fan, count, members }

  // ⭐ THE FOURTH JOB, and the only one that DELETES: the ramp range is written here or not at all.
  // Resolved against the CLAMPED count, so a lowered count pulls a stranded range back in the same
  // way the member list is truncated — one edit, one place, both invariants.
  //
  // ⚠️ **Absent is the only spelling of the whole group.** Writing `{rampFrom: 0, rampTo: count-1}`
  // would say exactly what absence says, in a different string — and `laneFingerprint` stringifies
  // the whole slot, so the width cache would hold two keys for one piece of music. The `{...fan}`
  // spread above is what makes the delete necessary rather than optional: a stale range rides
  // through it untouched.
  const { from, to } = fanRampRange(out)
  if (from === 0 && to === count - 1) {
    delete out.rampFrom
    delete out.rampTo
  } else {
    out.rampFrom = from
    out.rampTo = to
  }

  // The same delete, for the same cache-key reason: the ordinary beam gap is spelled by ABSENCE.
  // Nothing to settle against the count here — a spread is about the lines, not about the members.
  const spread = fanSpread(out)
  if (spread === 1) delete out.spread
  else out.spread = spread
  return out
}

/**
 * Copy a fan onto a NEW slot — same assertion, but every member pitch re-minted.
 *
 * For the one place a relay piece becomes a chord (`rebarOps`) and the one place a pitch is moved
 * into another voice: both build a slot whose own notes get fresh ids, and the members have to
 * follow. Two live chords sharing a pitch id is not a cosmetic problem — `getElementById` is
 * document-wide, so the first in tree order silently wins every lookup
 * (reference_vexflow_getsvgelement_is_document_wide), and an edit aimed at the pasted fan lands on
 * the one it was copied from.
 */
export function cloneFanFresh(fan: FanMark): FanMark {
  return fan.members ? { ...fan, members: fan.members.map(copyMember) } : { ...fan }
}

/**
 * The PITCHES of every member, member 0 first — `[slot.notes, ...fan.members]`, one entry per
 * member the count claims.
 *
 * The one reader of {@link FanMark.members}, and the one place the fallback lives: a mark that has
 * never been through `normalizeFan` (an older JSON file) has no members, and a member with no stored
 * pitch is drawn and sounded at the slot's own — which is exactly what a fan did before pitches were
 * storable. Readers never repair the model, they only read past it.
 */
export function fanMemberPitches(notes: NotePitch[], fan: FanMark): NotePitch[][] {
  const n = fanCount(fan)
  const out: NotePitch[][] = [notes]
  for (let k = 1; k < n; k++) out.push(fan.members?.[k - 1]?.pitches ?? notes)
  return out
}

/**
 * ⭐ **Every pitch a chord STORES** — its own, plus each fanned member's, in group order.
 *
 * The answer to "what notes are actually in this slot", which is not `chord.notes`: a fanned slot
 * draws N heads and every one of them has an id, is clickable and is selectable. Callers that ask
 * `chord.notes` and mean *this* have shipped the same bug four times — a shift-click box that could
 * not reach a member, a bar selection that took one note out of six, an articulation that could not
 * be put on one, and a paste that handed back only the owner to select.
 *
 * ⛔ Not the same as {@link fanMemberPitches}, which is the DRAWING's projection: that one is padded
 * to `count` and falls back to the slot's own pitches for a member that was never normalized, so it
 * repeats ids. This returns what exists, once each, and is safe to build a set or a selection from.
 */
export function chordStoredPitches(chord: Chord): NotePitch[] {
  const members = chord.fan?.members ?? []
  if (!members.length) return chord.notes
  return [...chord.notes, ...members.flatMap(m => m.pitches)]
}

/**
 * ⭐ The beat EVERY member of a fan starts on, member 0 first — `slot.beat + Σ preceding member
 * quarters`, one entry per member the count claims. **The one owner of that arithmetic**, which is
 * now four passes' worth: the accidental walk, arrow navigation, playback, and — since a member can
 * carry its own leading space (docs/note-spacing-plan.md §7) — the spacing address it is nudged by.
 *
 * ⚠️ Arbitrary rationals, and that is fine: they are POSITIONS, never notatable durations. Nothing
 * turns one back into a slot. It is also what lets a member share `spacingPositionKey` with an
 * ordinary column — the key takes any rational, so a member space needs no key of its own.
 *
 * Member 0 IS here (at the slot's own beat), unlike {@link fanMemberEntries}: a caller indexing by
 * member number must be able to ask about the first one without special-casing it.
 */
export function fanMemberBeats(fan: FanMark, totalQuarters: Fraction, slotBeat: Fraction): Fraction[] {
  const spans = fanMembers(fan, totalQuarters)
  const out: Fraction[] = []
  let beat = slotBeat
  for (let k = 0; k < spans.length; k++) {
    out.push(beat)
    beat = fracAdd(beat, spans[k].quarters) // member k+1 starts where member k ends
  }
  return out
}

/**
 * Every STORED member with the beat it sounds on — `slot.beat + Σ preceding member quarters`.
 *
 * The one owner of that arithmetic, because three passes now need the same answer and a member at
 * the wrong beat is wrong in three different ways: the running-accidental walk would decide the
 * signs in the wrong order, arrow navigation would step out of order, and playback would too.
 *
 * ⚠️ The beats are arbitrary rationals — 8/15 of a beat is an ordinary answer — and that is fine.
 * They are POSITIONS, never notatable durations; nothing turns them back into slots, which is
 * exactly what storing the assertion buys (docs/fanned-beams-plan.md §0).
 *
 * Member 0 is NOT here: it is the slot's own chord, at the slot's own beat.
 */
export function fanMemberEntries(
  fan: FanMark,
  totalQuarters: Fraction,
  slotBeat: Fraction,
): Array<{ index: number; pitches: NotePitch[]; beat: Fraction }> {
  const stored = fan.members ?? []
  if (stored.length === 0) return []
  const beats = fanMemberBeats(fan, totalQuarters, slotBeat)
  const out: Array<{ index: number; pitches: NotePitch[]; beat: Fraction }> = []
  for (let k = 0; k < stored.length; k++) {
    out.push({ index: k + 1, pitches: stored[k].pitches, beat: beats[k + 1] ?? slotBeat })
  }
  return out
}

/** One note of the expanded group. */
export interface FanMember {
  /** 0-based position in the group. */
  index: number
  /**
   * This member's sounding length in quarter beats, EXACT — `Σ quarters` is the group's total to
   * the last unit, per the Fraction/float invariant.
   *
   * ⚠️ Not a notatable duration: these are arbitrary rationals (8/15 of a beat is an ordinary
   * answer). They are offsets and lengths for drawing and playback, and are never turned back into
   * slots — that is exactly what storing the assertion buys.
   */
  quarters: Fraction
  /**
   * Where this member starts along the group's span, **0…1**. The drawing multiplies it by the
   * x-span; the playback multiplies it by the time.
   *
   * A float on purpose: it is a proportion for geometry, not a musical position. The exact position
   * is the running sum of {@link quarters}, and playback should accumulate that instead of scaling
   * by this.
   */
  startFraction: number
}

/**
 * The DURATION weight of each of the RAMP's `n` members, before normalization —
 * `w_k = lerp(1, 1/ratio, k/(n-1))`, always descending.
 *
 * Durations, not speeds, because that is what the caller needs and it keeps the arithmetic exact:
 * an accelerando's notes get progressively SHORTER, so the first weight is 1 and the last is
 * `1/ratio`. Every term is rational (`ratio` is a power of two), so nothing here needs a float.
 *
 * ⚠️ **The RAMP's length, not the GROUP's, and no direction.** Reversing for a `rit` and mapping the
 * result onto the group's members are both {@link fanWeights}' business — the ramp may cover only
 * part of the fan (docs/fan-ramp-range-plan.md §2), and an array reversed by a caller that thinks it
 * holds the whole group mirrors an inset mark to the other end. This function shapes a ramp; it does
 * not know where one sits.
 */
export function rampWeights(n: number, ratio: number, curve: FanCurve = 'linear'): Fraction[] {
  void curve // one shape today; the parameter is the seam, see the file header
  if (n <= 1) return [fracFromInt(1)]
  const last = fracCreate(1, Math.max(1, ratio))
  const drop = fracSub(fracFromInt(1), last) // how far the ramp falls, total
  const weights: Fraction[] = []
  for (let k = 0; k < n; k++) {
    weights.push(fracSub(fracFromInt(1), fracMul(fracCreate(k, n - 1), drop)))
  }
  return weights
}

/**
 * Expand a fan into the notes it is played and drawn as, across `totalQuarters` — the duration of
 * the ONE slot carrying the mark. The group's total time is unchanged by construction: the weights
 * are normalized so `Σ quarters` is exactly the total, which is the whole point of a fan (free
 * accelerando *within* the duration; nothing after the group moves).
 *
 * Degenerates cleanly rather than throwing: a count of 1 or less is one member holding the whole
 * duration, and `beams: 1` is a ratio of 1 — an evenly spaced group, which is what a fan with no
 * feathering means.
 */
export function fanMembers(fan: FanMark, totalQuarters: Fraction): FanMember[] {
  const n = fanCount(fan)
  // A zero-length slot has no span to ramp across and no proportion to report — one member, which
  // is also the only answer that keeps `Σ quarters` equal to the total.
  if (n === 1 || totalQuarters.num === 0) return [{ index: 0, quarters: totalQuarters, startFraction: 0 }]

  const weights = fanWeights(fan)
  const sum = weights.reduce(fracAdd, fracFromInt(0))
  const scale = fracDiv(totalQuarters, sum)

  const members: FanMember[] = []
  let elapsed = fracFromInt(0)
  for (let k = 0; k < n; k++) {
    const quarters = fracMul(weights[k], scale)
    members.push({
      index: k,
      quarters,
      startFraction: fracToNumber(fracDiv(elapsed, totalQuarters)),
    })
    elapsed = fracAdd(elapsed, quarters)
  }
  return members
}
