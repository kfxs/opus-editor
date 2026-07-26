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
import type { ChordRest, FanMark, NotePitch } from '@/types/music'
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
 * Only the gaps BETWEEN heads count, so the last member's weight is not in the minimum: nothing
 * follows it inside the group. Its own glyph still needs room before whatever comes next, which is
 * the `+ 1` — and it is what stops a fan from running into the note after it.
 *
 * ⚠️ The unit is `MIN_NOTE_SPACING`: one column is what an ordinary event gets, and that is exactly
 * the claim being made — *a fanned note takes the room of this many notes.* It has to be a count
 * rather than a measured width because the width pass runs where glyphs cannot be measured.
 */
export function fanColumns(fan: FanMark): number {
  const n = Math.max(1, Math.round(fan.count))
  if (n < 2) return 1
  const weights = rampWeights(n, fanSpeedRatio(fan.beams)).map(fracToNumber)
  if (fan.direction === 'rit') weights.reverse()
  const sum = weights.reduce((a, b) => a + b, 0)
  const tightest = Math.min(...weights.slice(0, n - 1)) // the gaps, not the members
  return Math.ceil(sum / tightest) + 1
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
 * Copy ONE member's pitches — fresh ids, and only what a member is allowed to carry.
 *
 * A member is a note (it has an id, so it can be clicked, arrowed and retyped), but it is not the
 * tied, slurred, articulated thing the SLOT is: those attach to the whole gesture
 * (docs/fanned-beam-pitches-plan.md §3). A `tiedTo` copied onto a member would be a reference that
 * `TieRenderer` — which looks its id up in `slot.notes` — can never reach: stored, never drawn.
 */
function copyMemberPitches(pitches: NotePitch[]): NotePitch[] {
  return pitches.map((p) => {
    const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
    if (p.forceAccidental) np.forceAccidental = true
    return np
  })
}

/**
 * ⭐ Hold `count` and {@link FanMark.members} in step — the ONE function allowed to know that
 * `members.length === count - 1` (member 0 is the slot's own chord, never repeated in the list).
 *
 * Three jobs, and each is a decision:
 * - **materialise** (no members yet): every member starts as a copy of the note you typed, so a
 *   fresh fan sounds and draws exactly as it did before this existed;
 * - **grow**: new members copy the LAST one — a rising line continues rising. Jumping back to the
 *   first note is never what was meant;
 * - **shrink**: drop from the end.
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
  const source = members[members.length - 1] ?? own
  while (members.length < want) members.push(copyMemberPitches(source))
  return { ...fan, count, members }
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
  return fan.members ? { ...fan, members: fan.members.map(copyMemberPitches) } : { ...fan }
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
  const n = Math.max(1, Math.round(fan.count))
  const out: NotePitch[][] = [notes]
  for (let k = 1; k < n; k++) out.push(fan.members?.[k - 1] ?? notes)
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
 * The DURATION weight of each member, before normalization — `w_k = lerp(1, 1/ratio, k/(n-1))`,
 * reversed for `rit`.
 *
 * Durations, not speeds, because that is what the caller needs and it keeps the arithmetic exact:
 * an accelerando's notes get progressively SHORTER, so the first weight is 1 and the last is
 * `1/ratio`. A rallentando is the same ramp read backwards. Every term is rational (`ratio` is a
 * power of two), so nothing here needs a float.
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
  const n = Math.max(1, Math.round(fan.count))
  // A zero-length slot has no span to ramp across and no proportion to report — one member, which
  // is also the only answer that keeps `Σ quarters` equal to the total.
  if (n === 1 || totalQuarters.num === 0) return [{ index: 0, quarters: totalQuarters, startFraction: 0 }]

  const weights = rampWeights(n, fanSpeedRatio(fan.beams))
  if (fan.direction === 'rit') weights.reverse()

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
