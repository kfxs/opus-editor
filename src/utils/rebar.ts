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
  BeamMode,
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
import { slotLength, writtenLength } from '@/utils/durations'
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
interface RebarTupletPayload {
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
  /**
   * ⭐ **THE AUTHORED WRITTEN SHAPE** — what the slot is DRAWN as, carried beside `duration` (what
   * it LASTS). Set by {@link flattenRegion} from the model; used by {@link relayEvents} when the
   * event survives whole (no barline split), and ignored the moment it does not, because a split
   * note's halves are new shapes.
   *
   * 🚨 Without it, a dotted quarter re-laid at beat 0 of 4/4 comes back as a QUARTER TIED TO AN
   * EIGHTH — his report, 2026-08-19: *"the paste is not a dotted figure… that is not expected"*.
   * The re-derivation (`decomposeSpan`) applies the RESTS' metric rules, where a value may not
   * cross a beat stronger than its own endpoints; a NOTE has no such rule (a dotted quarter on a
   * downbeat is ordinary notation), so re-deriving one is a wrong answer to a question that was
   * already answered when the note was written.
   *
   * ⭐⭐ **A SEQUENCE, because a tie chain is one event and several shapes.** His report,
   * 2026-08-30 (the Prelude, bar 1 of the bass staff copied onto bar 2): a **dotted eighth tied to
   * a quarter** came back as a 16th + an eighth + a quarter — the same length, three notes instead
   * of two. The chain collapses into ONE event here (that is what lets a paste re-split it at a
   * barline), and a single shape could not describe 7/4 of a beat, so the whole authored spelling
   * was dropped and `decomposeSpan` re-tiled it by the metre. The tie chain IS the answer the user
   * already gave; it just takes more than one figure to say.
   *
   * ⚠️ INVARIANT: the entries' written lengths sum to `duration`. `flattenRegion` only records a
   * shape that describes its own slot's length, and the merge only concatenates when BOTH sides
   * carry one — a piece with no authored shape breaks the chain and the relay re-derives, which is
   * the honest answer when part of the spelling is unknown.
   */
  written?: { duration: NoteDuration; dots: number }[]
  /**
   * ⭐ True for an event that is SILENCE. ⚠️ Only ever set when {@link FlattenOptions.keepRests} is
   * on: for a rebar a rest is a GAP the relay regenerates (which is how a meter change re-shapes
   * the silence it inherits), and for a CLIP it is content the user selected and expects to see
   * again. Same stream, two readings, and the caller says which.
   */
  isRest?: boolean
  stemDirection?: StemDirection
  articulations?: ArticulationType[]
  articulationPlacement?: 'above' | 'below'
  /** Stem-side alignment for those marks — an authored decision about the SAME marks, so it travels
   *  with them (`utils/slotFieldTravel`). Onto every piece of a split, like the marks themselves. */
  articulationStemAlign?: boolean
  /** Single-note tremolo on the event. Carried through the relay so a meter change or a paste does
   *  not silently drop it — and carried onto EVERY piece a tie-split makes of this event, because a
   *  tremolo interrupted at a barline is still being played across it. */
  tremolo?: TremoloMark
  /** Fanned (feathered) beam on the event. Carried for the same reason as {@link tremolo} — a slot
   *  field the relay does not list is a slot field the relay eats — but ⚠️ handed to the FIRST piece
   *  of a tie-split ONLY: a fan cut in half at a barline is a cross-barline fan nobody asked for,
   *  and the split has already destroyed the group the mark was an assertion about. */
  fan?: FanMark
  /**
   * The note's explicit BEAM statement, carried for the reason {@link tremolo} and {@link fan} are:
   * a slot field the relay does not list is a slot field the relay eats, and this one is authored
   * by hand — a copied run would arrive re-beamed by the automatic beat rules, which is the one
   * thing the user just overrode.
   *
   * ⚠️ Which piece of a tie-split keeps it depends on WHAT it says, because the modes are not all
   * statements about the same end of the note — see {@link relayEvents}.
   */
  beam?: BeamMode
  /** Secondary-beam break in front of the note. Travels with {@link beam}; it is the same kind of
   *  authored statement, and it belongs to the note's HEAD (the break is in front of it). */
  secondaryBreak?: boolean
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
  /** Stem-side alignment. See {@link RebarEvent.articulationStemAlign}. */
  articulationStemAlign?: boolean
  /** Single-note tremolo. See {@link RebarEvent.tremolo} — every piece of a split event keeps it. */
  tremolo?: TremoloMark
  /** Fanned beam. See {@link RebarEvent.fan} — only the FIRST piece of a split event keeps it. */
  fan?: FanMark
  /** Explicit beam statement. See {@link RebarEvent.beam} — which piece keeps it depends on the mode. */
  beam?: BeamMode
  /** Secondary-beam break. See {@link RebarEvent.secondaryBreak} — the FIRST piece only. */
  secondaryBreak?: boolean
  /** True for an atomic tuplet passthrough piece (materialise from `payload`). */
  atomic?: boolean
  payload?: RebarTupletPayload
}

/** All pieces of one rebar'd bar, in beat order. */
export type BarPlan = RebarPiece[]

interface RelayOptions {
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
  /**
   * ⭐⭐ **WHAT THIS CALLER IS ASKING THE RELAY TO DO** — and the two callers are asking opposite
   * things, which is the distinction this field exists to stop being implicit.
   *
   *  - `'as-needed'` — a METER CHANGE. Re-spelling IS the job: the barlines moved, so the figures
   *    that fitted the old bar are not the figures that fit the new one. Inventing a spelling here
   *    is the correct answer.
   *  - `'faithful'` — a PASTE. The music is being put back, not re-shaped, so the authored figures
   *    stand and anything the relay has to invent is a change to notation NOBODY ASKED FOR. It is
   *    reported through {@link RelayOptions.onImprovised} rather than happening quietly.
   *
   * 🚨 Until 2026-08-30 this was carried implicitly — by whether an event happened to have a
   * `written` shape — so a spelling that went missing anywhere upstream silently changed the user's
   * notation instead of failing loudly. That cost two of his reports (see {@link RebarEvent.written})
   * and an audit that found a third field being eaten (`utils/slotFieldTravel`).
   *
   * ⚠️ REQUIRED, deliberately: a third caller must decide which of the two it is. There is no
   * sensible default, because the wrong one is silent both ways.
   */
  respell: 'as-needed' | 'faithful'
  /**
   * Called under `'faithful'` whenever the relay had to invent a spelling anyway — once per piece
   * it minted. ⛔ It is a REPORT, not a veto: the music cannot be dropped, so the relay lays what it
   * can and says so. What to do about it (warn, refuse the paste) is the caller's.
   *
   * `'split-at-barline'` is expected and unavoidable — the event genuinely straddles a barline and
   * its halves are new shapes (MuseScore's `shouldSplit` reaches the same conclusion in the same
   * place). `'no-authored-shape'` is the one worth acting on: the event survived whole and we STILL
   * had nothing to draw it as — a collapsed fan, or a tie chain one of whose pieces was unspellable.
   */
  onImprovised?: (info: { offset: Fraction; reason: 'split-at-barline' | 'no-authored-shape' }) => void
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
export interface FlattenOptions {
  /**
   * ⭐ Carry RESTS as events (default: off, i.e. a rest is a gap the relay regenerates).
   *
   * The CLIPBOARD turns this on and nothing else does. Copying a rest and pasting it must put
   * that rest there — his report, 2026-08-19: *"i'm able to copy a note individual and pasted it,
   * but i cannot doit with a rest"* — where a meter change must be free to re-shape the silence it
   * inherits, which is exactly what dropping rests buys.
   *
   * ⚠️ A MEASURE REST is skipped even here: it is the empty bar's own default fill, so the relay
   * regenerates it identically, and carrying one would hand a paste a whole-bar rest to lay inside
   * a window that may be shorter than the bar.
   */
  keepRests?: boolean
}

export function flattenRegion(
  measures: Measure[],
  voice: 0 | 1 | 2 | 3 = 0,
  opts: FlattenOptions = {},
): RebarEvent[] {
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
      // ⚠️ **Only a shape that DESCRIBES the length may travel.** A slot whose sounding length is
      // not what it is written as — a collapsed fan claiming 7/16 behind a dotted quarter, a measure
      // rest whose `w` stands for whatever the bar holds — has no authored shape to keep, and taking
      // its written value would quietly shorten the music (`rebarOps.fan.test`). Those re-derive.
      const authored = fracEq(writtenLength(slot), slotActual)
        ? [{ duration: slot.duration, dots: slot.dots ?? 0 }]
        : undefined
      track(fracAdd(slot.beat, slotActual))
      if (slot.tupletId) continue // owned by an atomic tuplet event above
      if (slot.type === 'rest') {
        // A gap by default — regenerated by the relay. As CONTENT when the caller asked for it,
        // carrying the shape it is drawn as (see {@link FlattenOptions.keepRests}).
        if (!opts.keepRests || slot.isMeasureRest) continue
        events.push({
          offset: fracAdd(runningOffset, slot.beat),
          duration: slotActual,
          isRest: true,
          ...(authored ? { written: authored } : {}),
        })
        continue
      }

      events.push({
        offset: fracAdd(runningOffset, slot.beat),
        duration: slotActual,
        ...(authored ? { written: authored } : {}),
        pitches: slot.notes.map((p) => ({
          step: p.step,
          alter: p.alter,
          octave: p.octave,
          forceAccidental: p.forceAccidental,
        })),
        stemDirection: slot.stemDirection,
        articulations: slot.articulations,
        articulationPlacement: slot.articulationPlacement,
        articulationStemAlign: slot.type === 'chord' ? slot.articulationStemAlign : undefined,
        tremolo: slot.tremolo,
        // ⚠️ A COPY, not the slot's own mark. The flattened stream is also the clipboard's payload —
        // documented as position-independent and re-pasteable — and `fan` is the one field on an
        // event that is an OBJECT. Held by reference, a copied fan would keep changing as its source
        // was edited (reference_live_model_objects_break_dedup); with member pitches inside, it
        // would also hand the payload live model ids.
        fan: slot.fan && cloneFanFresh(slot.fan),
        beam: slot.beam,
        secondaryBreak: slot.secondaryBreak,
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
      // The merged note is `prev` grown longer, so it keeps prev's marks — including its beam
      // statement, which is the head's and the head is where the merged note still begins. An
      // `end` authored on the swallowed TAIL is dropped: one event holds one beam value, and
      // inventing a second field to carry a tail statement would be a shape for a case (beaming
      // the far half of a tie) nothing in the editor asks for.
      prev.duration = fracAdd(prev.duration, ev.duration)
      prev.tiedForward = ev.tiedForward
      // ⭐ **The chain's spelling travels with it.** The merged note is longer than either piece was
      // drawn as, so no single shape describes it — but the SEQUENCE of shapes does, and it is the
      // answer the author already gave. Concatenating here is what lets a paste re-lay a dotted
      // eighth tied to a quarter as itself, instead of re-tiling 7/4 of a beat by the rests' metric
      // rules (his report, 2026-08-30). ⚠️ Both sides must carry one: a piece whose spelling was
      // unknown makes the whole chain unknown, and the relay re-derives — which it must, because a
      // partial sequence would not sum to the length.
      prev.written = prev.written && ev.written ? [...prev.written, ...ev.written] : undefined
    } else {
      out.push({ ...ev })
    }
  }
  // Drop the internal marker from the returned events.
  return out.map(({ tiedForward: _tiedForward, ...rest }) => rest)
}

/**
 * The authored shapes placed end to end from `startBeat` — the relay's reading of
 * {@link RebarEvent.written}.
 *
 * Each figure starts where the previous one ended, which is only meaningful because of the field's
 * invariant: every entry's written length IS its own sounding length, so the run covers exactly the
 * event. The relay's own tie loop then ties consecutive pieces, which is what the chain was.
 */
function writtenSegments(
  written: { duration: NoteDuration; dots: number }[],
  startBeat: Fraction,
): { beat: Fraction; duration: NoteDuration; dots: number }[] {
  let beat = startBeat
  return written.map(({ duration, dots }) => {
    const at = beat
    beat = fracAdd(beat, writtenLength({ duration, dots }))
    return { beat: at, duration, dots }
  })
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
      // ⭐ **THE AUTHORED SHAPE WINS WHERE THE EVENT SURVIVES WHOLE** — one fragment covering the
      // event start to end, so nothing has been split and the thing being drawn is the same thing
      // that was written. `decomposeSpan` answers a different question (how do you TILE this span
      // by the metre), and its answer for 1.5 beats at a downbeat is a quarter tied to an eighth —
      // right for a rest, wrong for the dotted quarter somebody typed. See {@link RebarEvent.written}.
      const whole = fracEq(p, startAt) && fracEq(fragEnd, endAt)
      // ⭐ A SEQUENCE, laid in the order it was written: one figure for a plain note, several for a
      // tie chain that was collapsed on the way in. Each starts where the one before it ended,
      // which is exactly what `written`'s invariant (the lengths sum to `duration`) buys.
      const faithful = ev.written && whole
      if (!faithful && opts.respell === 'faithful') {
        // ⭐ The caller asked for the music back as written and is about to get something else. Say
        // which of the two reasons it is — one is unavoidable, the other is worth refusing over.
        opts.onImprovised?.({ offset: ev.offset, reason: whole ? 'no-authored-shape' : 'split-at-barline' })
      }
      const segments = faithful
        ? writtenSegments(ev.written!, fracSub(p, bs))
        : decomposeSpan(fracSub(p, bs), fracSub(fragEnd, bs), meter)
      for (const s of segments) {
        const piece: RebarPiece = {
          beat: s.beat,
          duration: s.duration,
          dots: s.dots,
          ...(ev.isRest ? { isRest: true } : {}),
          pitches: ev.pitches,
          stemDirection: ev.stemDirection,
          articulations: ev.articulations,
          articulationPlacement: ev.articulationPlacement,
          articulationStemAlign: ev.articulationStemAlign,
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
    // Tie every piece of this logical note to the next. ⛔ Never a REST: silence split at a barline
    // is two rests, not one tied one — a tie between rests is not a thing the notation has.
    if (!ev.isRest) for (let k = 0; k < pieces.length; k++) {
      if (k > 0) pieces[k].tieFromPrev = true
      if (k < pieces.length - 1) pieces[k].tieToNext = true
    }
    // The BEAM statement, once the pieces are known — and unlike the tremolo (every piece) or the
    // fan (the first), it is not one rule, because the modes do not all talk about the same end of
    // the note. `begin`/`continue` say where the group STARTS, and the note starts at its first
    // piece; `end` says where it CLOSES, and the note ends at its last; `single` isolates the whole
    // note, and half of it beamed to a neighbour is exactly what `single` forbids — so every piece.
    if (ev.beam && pieces.length > 0) {
      if (ev.beam === 'single') for (const p of pieces) p.beam = 'single'
      else if (ev.beam === 'end') pieces[pieces.length - 1].beam = 'end'
      else pieces[0].beam = ev.beam
    }
    // The break is in front of the note, so it belongs to the head piece.
    if (ev.secondaryBreak && pieces.length > 0) pieces[0].secondaryBreak = true
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
