/**
 * Rebar engine (Phase 8) — pure core for rewriting music across a meter change.
 *
 * When a time signature changes, the dominant engraving model (Sibelius / Finale
 * / MuseScore) **re-bars** the following music: barlines move to the new bar
 * length, notes that straddle a new barline are split with **ties**, and overflow
 * flows forward — bounded to the next explicit TS change / end of score. Nothing
 * is deleted.
 *
 * This module is split into two pure passes so the crux is table-testable without
 * any `ScoreModel` mutation:
 *
 *   1. {@link flattenRegion} — region measures → an absolute, ordered event stream
 *      (one voice). Plain rests become gaps (regenerated later); existing tie
 *      chains are collapsed back into single logical notes; tuplets are kept as
 *      atomic, indivisible events.
 *   2. {@link relayEvents} — event stream + new meter → {@link BarPlan}s (per-bar
 *      pieces with fresh tie topology and rest-fill). The caller (`ScoreModel`)
 *      materialises pieces into real slots with ids and `tiedTo`/`tiedFrom`.
 *
 * Exactness: all timing is `Fraction`. Note-splitting reuses {@link decomposeSpan}
 * (the syncopation-free decomposer shared with rest-fill). This deliberately does
 * NOT use the float `splitBeatsIntoDurations` path.
 *
 * Documented limitations (Phase 8):
 *   - Tuplets are atomic: a tuplet that straddles a new barline stays whole and
 *     may render crowded (SOFT) rather than being tie-split.
 *   - Only a partial / full chord tie is collapsed (all pitches tied through);
 *     mixed partial ties are left as separate events (still never lost).
 */

import type {
  ChordRest,
  Measure,
  NoteDuration,
  PitchStep,
  PitchAlter,
  StemDirection,
  ArticulationType,
  TremoloMark,
  FanMark,
  Tuplet,
} from '@/types/music'
import {
  type Fraction,
  fracAdd,
  fracSub,
  fracMul,
  fracEq,
  fracLt,
  fracGt,
  fracCompare,
  fracFromInt,
  fracToNumber,
} from '@/utils/fraction'
import { slotLength } from '@/utils/durations'
import { tupletSpan } from '@/utils/musicUtils'
import { getMeterInfo, type MeterInfo } from '@/utils/meter'
import { fillRests, decomposeSpan } from '@/utils/restFill'
import { cloneFanFresh } from '@/utils/fannedBeam'
import { voiceOf } from '@/utils/lanes'

// ---------------------------------------------------------------------------
// Public data shapes
// ---------------------------------------------------------------------------

/** A single pitch within a logical event (tie linkage is regenerated, not carried). */
export interface RebarPitch {
  step: PitchStep
  alter: PitchAlter
  octave: number
  forceAccidental?: boolean
}

/** Opaque payload preserved verbatim for an atomic (tuplet) event. */
export interface RebarTupletPayload {
  def: Tuplet
  slots: ChordRest[]
}

/** One logical musical event on the absolute region timeline (quarter beats). */
export interface RebarEvent {
  /** Absolute start from the region start, in quarter-note beats. */
  offset: Fraction
  /** Actual sounding length, in quarter-note beats. */
  duration: Fraction
  /** Pitches of a note/chord. Omitted for an atomic tuplet event. */
  pitches?: RebarPitch[]
  stemDirection?: StemDirection
  articulations?: ArticulationType[]
  articulationPlacement?: 'above' | 'below'
  /** Single-note tremolo on the event. Carried through the relay so a meter change or a paste does
   *  not silently drop it — and carried onto EVERY piece a tie-split makes of this event, because a
   *  tremolo interrupted at a barline is still being played across it. */
  tremolo?: TremoloMark
  /** Fanned (feathered) beam on the event. Carried for the same reason as {@link tremolo} — a slot
   *  field the relay does not list is a slot field the relay eats — but ⚠️ handed to the FIRST piece
   *  of a tie-split ONLY: a fan cut in half at a barline is a cross-barline fan nobody asked for,
   *  and the split has already destroyed the group the mark was an assertion about. */
  fan?: FanMark
  /** True for an indivisible tuplet event (never tie-split). */
  atomic?: boolean
  /** Verbatim tuplet payload when `atomic`. */
  payload?: RebarTupletPayload
}

/** One drawable piece in a rebar'd bar (beat is bar-relative). */
export interface RebarPiece {
  beat: Fraction
  duration: NoteDuration
  dots: number
  isRest?: boolean
  isMeasureRest?: boolean
  /** Pitches when this is a note/chord piece. */
  pitches?: RebarPitch[]
  /** This piece continues a tie from the previous piece of the same logical note. */
  tieFromPrev?: boolean
  /** This piece is tied to the next piece of the same logical note. */
  tieToNext?: boolean
  stemDirection?: StemDirection
  articulations?: ArticulationType[]
  articulationPlacement?: 'above' | 'below'
  /** Single-note tremolo. See {@link RebarEvent.tremolo} — every piece of a split event keeps it. */
  tremolo?: TremoloMark
  /** Fanned beam. See {@link RebarEvent.fan} — only the FIRST piece of a split event keeps it. */
  fan?: FanMark
  /** True for an atomic tuplet passthrough piece (materialise from `payload`). */
  atomic?: boolean
  payload?: RebarTupletPayload
}

/** All pieces of one rebar'd bar, in beat order. */
export type BarPlan = RebarPiece[]

export interface RelayOptions {
  /**
   * Number of measures the region must occupy.
   * - unbounded (`bounded: false`): the result has `max(neededBars, targetBars)`
   *   bars — content grows the region, shorter content keeps trailing rest bars.
   * - bounded (`bounded: true`): exactly `targetBars` bars — overflow folds into
   *   the last bar (crowded / SOFT), shortfall becomes trailing measure rests.
   */
  targetBars: number
  /** True when a following explicit TS change pins the region's bar count. */
  bounded: boolean
}

// Internal flatten event with the tie-forward marker used only for collapsing.
interface FlatEvent extends RebarEvent {
  tiedForward?: boolean
}

// ---------------------------------------------------------------------------
// Pass 1 — flatten a region into an absolute event stream
// ---------------------------------------------------------------------------

/**
 * Flatten a contiguous run of measures (one voice) into an ordered absolute
 * event stream. Uses each measure's CURRENT length to compute offsets, so call
 * this BEFORE mutating the measures' time signature.
 *
 * Plain (non-tuplet) rests are omitted — they become gaps that {@link relayEvents}
 * rest-fills for the new meter. Existing tie chains are collapsed into single
 * logical notes. Tuplets become atomic events.
 */
export function flattenRegion(measures: Measure[], voice: 0 | 1 | 2 | 3 = 0): RebarEvent[] {
  const events: FlatEvent[] = []
  let runningOffset = fracFromInt(0)

  for (const m of measures) {
    const nominal = getMeterInfo(m.timeSignature).barQuarters
    const slots = m.slots
      .filter((s) => voiceOf(s) === voice)
      .sort((a, b) => fracCompare(a.beat, b.beat))

    let occupiedEnd = fracFromInt(0)
    const track = (end: Fraction) => {
      if (fracGt(end, occupiedEnd)) occupiedEnd = end
    }

    // Each tuplet is one atomic event, captured from its definition (so an empty
    // or partially-filled tuplet is preserved too — slots may not exist yet).
    for (const def of m.tuplets ?? []) {
      // A tuplet belongs to a single voice (derived from its member slots, as in
      // ScoreModel.fillGapsWithRests). Only flatten tuplets of the voice being
      // flattened — otherwise a voice-0 triplet pollutes voice 1's event stream
      // with a phantom atomic, and vice versa.
      const owner = m.slots.find((s) => s.tupletId === def.id)
      if ((owner?.voice ?? 0) !== voice) continue
      const tupletDur = tupletSpan(def)
      events.push({
        offset: fracAdd(runningOffset, def.startBeat),
        duration: tupletDur,
        atomic: true,
        payload: { def, slots: slots.filter((s) => s.tupletId === def.id) },
      })
      track(fracAdd(def.startBeat, tupletDur))
    }

    for (const slot of slots) {
      const slotActual = slotLength(slot)
      track(fracAdd(slot.beat, slotActual))
      if (slot.tupletId) continue // owned by an atomic tuplet event above
      if (slot.type === 'rest') continue // gap — regenerated by relay

      events.push({
        offset: fracAdd(runningOffset, slot.beat),
        duration: slotActual,
        pitches: slot.notes.map((p) => ({
          step: p.step,
          alter: p.alter,
          octave: p.octave,
          forceAccidental: p.forceAccidental,
        })),
        stemDirection: slot.stemDirection,
        articulations: slot.articulations,
        articulationPlacement: slot.articulationPlacement,
        tremolo: slot.tremolo,
        // ⚠️ A COPY, not the slot's own mark. The flattened stream is also the clipboard's payload —
        // documented as position-independent and re-pasteable — and `fan` is the one field on an
        // event that is an OBJECT. Held by reference, a copied fan would keep changing as its source
        // was edited (reference_live_model_objects_break_dedup); with member pitches inside, it
        // would also hand the payload live model ids.
        fan: slot.fan && cloneFanFresh(slot.fan),
        // Collapse marker: the whole chord is tied forward into the next slot.
        tiedForward: slot.notes.length > 0 && slot.notes.every((p) => !!p.tiedTo),
      })
    }

    // Advance by the greater of nominal length and the actual occupied end, so an
    // over-full bar's tail does not collide with the next measure's content.
    runningOffset = fracAdd(runningOffset, fracGt(occupiedEnd, nominal) ? occupiedEnd : nominal)
  }

  // Sort by offset so tie-collapse sees true temporal adjacency.
  events.sort((a, b) => fracCompare(a.offset, b.offset))
  return collapseTies(events)
}

/** Merge consecutive, fully-tied, pitch-matching, contiguous chord events. */
function collapseTies(events: FlatEvent[]): RebarEvent[] {
  const out: FlatEvent[] = []
  for (const ev of events) {
    const prev = out[out.length - 1]
    const mergeable =
      prev &&
      prev.tiedForward &&
      !prev.atomic &&
      !ev.atomic &&
      prev.pitches &&
      ev.pitches &&
      pitchesEqual(prev.pitches, ev.pitches) &&
      fracEq(fracAdd(prev.offset, prev.duration), ev.offset)
    if (mergeable) {
      prev.duration = fracAdd(prev.duration, ev.duration)
      prev.tiedForward = ev.tiedForward
    } else {
      out.push({ ...ev })
    }
  }
  // Drop the internal marker from the returned events.
  return out.map(({ tiedForward: _tiedForward, ...rest }) => rest)
}

function pitchesEqual(a: RebarPitch[], b: RebarPitch[]): boolean {
  if (a.length !== b.length) return false
  const key = (p: RebarPitch) => `${p.octave}/${p.step}/${p.alter}`
  const as = a.map(key).sort()
  const bs = b.map(key).sort()
  return as.every((k, i) => k === bs[i])
}

// ---------------------------------------------------------------------------
// Pass 2 — re-lay events into bars of the new meter
// ---------------------------------------------------------------------------

/**
 * Re-lay an absolute event stream into bars of `meter`, splitting straddling
 * notes/chords with ties and rest-filling gaps. Pure.
 */
export function relayEvents(events: RebarEvent[], meter: MeterInfo, opts: RelayOptions): BarPlan[] {
  const L = meter.barQuarters
  const Lnum = fracToNumber(L)
  const evs = [...events].sort((a, b) => fracCompare(a.offset, b.offset))

  const bars: RebarPiece[][] = []
  const ensureBar = (i: number) => {
    while (bars.length <= i) bars.push([])
  }
  const barIndex = (offset: Fraction) => Math.floor(fracToNumber(offset) / Lnum + 1e-9)
  const barStart = (i: number) => fracMul(L, fracFromInt(i))

  // Rest-fill the absolute span [a, b), split across bar boundaries.
  const fillRestSpan = (a: Fraction, b: Fraction) => {
    let p = a
    while (fracLt(p, b)) {
      const i = barIndex(p)
      const bs = barStart(i)
      const be = fracAdd(bs, L)
      const segEnd = fracLt(b, be) ? b : be
      ensureBar(i)
      for (const r of fillRests(fracSub(p, bs), fracSub(segEnd, bs), meter)) {
        bars[i].push({
          beat: r.beat,
          duration: r.duration,
          dots: r.dots,
          isRest: true,
          isMeasureRest: r.isMeasureRest,
        })
      }
      p = segEnd
    }
  }

  let cursor = fracFromInt(0)
  for (const ev of evs) {
    if (fracGt(ev.offset, cursor)) {
      fillRestSpan(cursor, ev.offset)
      cursor = ev.offset
    }
    // Place at the cursor (clamps any overlap from over-full source bars).
    const startAt = cursor
    const endAt = fracAdd(startAt, ev.duration)

    if (ev.atomic) {
      const i = barIndex(startAt)
      ensureBar(i)
      bars[i].push({
        beat: fracSub(startAt, barStart(i)),
        duration: ev.payload?.def.baseDuration ?? 'q',
        dots: 0,
        atomic: true,
        payload: ev.payload,
      })
      cursor = endAt
      continue
    }

    // Split [startAt, endAt) across barlines; decompose each in-bar fragment.
    const pieces: RebarPiece[] = []
    let p = startAt
    while (fracLt(p, endAt)) {
      const i = barIndex(p)
      const bs = barStart(i)
      const be = fracAdd(bs, L)
      const fragEnd = fracLt(endAt, be) ? endAt : be
      ensureBar(i)
      for (const s of decomposeSpan(fracSub(p, bs), fracSub(fragEnd, bs), meter)) {
        const piece: RebarPiece = {
          beat: s.beat,
          duration: s.duration,
          dots: s.dots,
          pitches: ev.pitches,
          stemDirection: ev.stemDirection,
          articulations: ev.articulations,
          articulationPlacement: ev.articulationPlacement,
          // EVERY piece, not just the head: a tremolo interrupted at a barline is still being
          // played across it, so both halves of a tie-split carry the mark.
          tremolo: ev.tremolo,
          // ⚠️ The FIRST piece only — the opposite rule, and deliberately so. A fan is an assertion
          // about ONE event ("play this note as six, accelerating"); split that event at a barline
          // and the group it described is gone. Copying it like the tremolo would silently mint the
          // cross-barline fan docs/fanned-beams-plan.md §4 excludes, on both halves, twice over.
          fan: pieces.length === 0 ? ev.fan : undefined,
        }
        bars[i].push(piece)
        pieces.push(piece)
      }
      p = fragEnd
    }
    // Tie every piece of this logical note to the next.
    for (let k = 0; k < pieces.length; k++) {
      if (k > 0) pieces[k].tieFromPrev = true
      if (k < pieces.length - 1) pieces[k].tieToNext = true
    }
    cursor = endAt
  }

  // Complete the last partial bar with rests; ensure at least one content bar.
  const neededBars = Math.max(1, Math.ceil(fracToNumber(cursor) / Lnum - 1e-9))
  const filledEnd = barStart(neededBars)
  if (fracLt(cursor, filledEnd)) fillRestSpan(cursor, filledEnd)
  ensureBar(neededBars - 1)

  // Pad with whole measure-rest bars up to the target.
  const wantBars = opts.bounded ? opts.targetBars : Math.max(neededBars, opts.targetBars)
  while (bars.length < wantBars) {
    const r = fillRests(fracFromInt(0), L, meter)[0]
    bars.push([{ beat: r.beat, duration: r.duration, dots: r.dots, isRest: true, isMeasureRest: true }])
  }

  // Bounded: fold any overflow bars into the last allowed bar (crowded → SOFT).
  if (opts.bounded && bars.length > opts.targetBars) {
    const last = opts.targetBars - 1
    for (let i = opts.targetBars; i < bars.length; i++) {
      const shift = fracMul(L, fracFromInt(i - last))
      for (const pc of bars[i]) {
        if (pc.isMeasureRest) continue
        bars[last].push({ ...pc, beat: fracAdd(pc.beat, shift) })
      }
    }
    bars.length = opts.targetBars
  }

  return bars
}
