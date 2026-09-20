import type { Chord, Rest } from '@/types/music'

/**
 * ⭐⭐ **WHAT HAPPENS TO EVERY FIELD OF A SLOT WHEN THE MUSIC IS RE-LAID** — one table, total over
 * `Chord | Rest`, so a new slot field cannot reach a paste unclassified.
 *
 * ## Why this table exists
 *
 * `RebarEvent` (utils/rebar) is a SECOND MODEL of a `ChordRest`. A rebar or a paste flattens slots
 * into events and materialises new slots out the other side, so **any field the event shape does not
 * list, the round trip eats** — silently, because the music still has the right pitches and the right
 * length. It has cost three of his reports already:
 *
 *   - 2026-08-19 — a dotted quarter pasted back as a quarter tied to an eighth (`written` was added);
 *   - 2026-08-30 — a dotted eighth TIED to a quarter pasted back as three notes (`written` became a
 *     SEQUENCE);
 *   - 2026-08-30 — and the audit that produced this table found `articulationStemAlign` being eaten
 *     with no report at all, because losing it only makes the marks sit slightly differently.
 *
 * ⭐ The fix for the class, not the instance: `satisfies Record<SlotField, SlotFieldTravel>` — the
 * device `scoreFile.ts`'s `KNOWN_SCORE_KEYS` already uses. Add a field to `Chord` or `Rest` and this
 * file **fails to compile** until someone says what a paste does with it. That decision was always
 * being made; it was just being made by omission.
 *
 * ⚠️ The table does not IMPLEMENT anything — it records a decision and forces it to be taken. The
 * carrying lives in `utils/rebar` (the event and piece shapes) and `engine/models/rebarOps` (the
 * materialiser); `interactions/clipboard/clipboard` owns the side channels. `slotFieldTravel.test.ts` is what
 * checks the table against what those actually do.
 */

/** Every field a slot can have — the union, because `keyof ChordRest` would give only the shared ones. */
export type SlotField = keyof Chord | keyof Rest

/**
 * What becomes of a field on the way through.
 *
 *  - `carried`     — rides `RebarEvent` and is written back by the materialiser. The default a field
 *                    should have unless there is a reason it cannot.
 *  - `sideChannel` — travels BESIDE the stream, addressed by position rather than by event. For a
 *                    field the stream must not hold: a lane key (the stream is already per lane), or
 *                    a RELATION between slots, which a split event would duplicate.
 *  - `rebuilt`     — regenerated at materialise, and correct by construction: identity, position,
 *                    and anything derived from the written figure.
 *  - `dropped`     — deliberately not carried. ⚠️ Only legitimate when the re-lay is exactly what
 *                    invalidates the statement; every entry here must say why.
 */
export type SlotFieldTravel = 'carried' | 'sideChannel' | 'rebuilt' | 'dropped'

export const SLOT_FIELD_TRAVEL = {
  // --- identity and position: the relay's own answers -------------------------------------------
  /** A relay piece is a COPY, and a paste can land one twice; a shared id is silent corruption. */
  id: 'rebuilt',
  /** `RebarEvent.isRest` says which; the materialiser builds a `Chord` or calls `pushRestSlot`. */
  type: 'rebuilt',
  /** The event carries an OFFSET; where it lands is the whole question the relay answers. */
  beat: 'rebuilt',
  /** Positional, like `beat` — and a paste is precisely a change of measure. */
  measure: 'rebuilt',

  // --- the written figure -----------------------------------------------------------------------
  /** ⭐ Via `RebarEvent.written`, the authored SEQUENCE — the field this table's history is about.
   *  Re-derived only where the event is genuinely split by a barline. */
  duration: 'carried',
  /** With `duration`; the two are one statement. */
  dots: 'carried',
  /** Recomputed from the written figure at materialise (`writtenLength(piece)`). */
  actualDuration: 'rebuilt',
  /** The fill decides what a whole-bar rest is; a measure rest is never copied AS content. */
  isMeasureRest: 'rebuilt',

  // --- the lane: already the stream's own axis ---------------------------------------------------
  /** The flatten runs per voice and a clip lane IS a (staff, voice); the materialiser is told which. */
  voice: 'sideChannel',
  /** The lane's other half, and re-based on paste so a clip can land on another staff. */
  staffId: 'sideChannel',

  // --- authored marks that ride the event --------------------------------------------------------
  /** An authored stem is a decision, not a derivation. */
  stemDirection: 'carried',
  articulations: 'carried',
  articulationPlacement: 'carried',
  /** ⭐ Added 2026-08-30 by the audit that produced this table — it was being eaten. The alignment is
   *  a hand-made decision about the same marks `articulations` carries; there is no reason a paste
   *  should undo it. */
  articulationStemAlign: 'carried',
  /** Single-note tremolo — onto EVERY piece of a split, because it is still being played across. */
  tremolo: 'carried',
  /** Onto the FIRST piece only: a fan cut in half at a barline is a fan nobody asked for. A
   *  collapsed fan's `length` is dropped when the piece is re-tiled (`rebarOps`). */
  fan: 'carried',
  /** Which piece keeps it depends on WHAT it says — `begin` the first, `end` the last (`relayEvents`). */
  beam: 'carried',
  /** ⭐ An authored override of one stub's direction (`docs/research/beam-hook-research.md` §8). Carried for
   *  `stemDirection`'s reason — it is a hand-made decision about THIS note, and nothing a re-lay does
   *  invalidates it. ⚠️ Unlike `beam` it needs no per-piece choice: the stub belongs to the note, so
   *  every piece of a split may keep it, and the metric default reasserts itself wherever the
   *  override is absent. */
  fractionalBeamSide: 'carried',
  /** The FIRST piece: the break is in front of the note, and the note starts at its first piece. */
  secondaryBreak: 'carried',

  // --- relations: never on the event -------------------------------------------------------------
  /** ⚠️ A RELATION with the NEXT slot, not a property. The relay hands a split event's marks to every
   *  piece, so riding the event would mint pairs that were never authored — it is captured by
   *  position and restored (`rebarOps.captureTremoloPairs`), and a pair the re-lay broke is dropped. */
  tremoloPair: 'sideChannel',
  /** Rides with the pair it styles. */
  tremoloPairStyle: 'sideChannel',
  /** A tuplet travels WHOLE, as an atomic event carrying its own slots; ids come from that clone. */
  tupletId: 'rebuilt',

  // --- tie topology ------------------------------------------------------------------------------
  /** Ties are regenerated: the flatten COLLAPSES a chain into one event and the relay re-splits and
   *  re-links it. That is what lets a paste land the same music across a different barline. */
  tiedFrom: 'rebuilt',

  // --- pitches -----------------------------------------------------------------------------------
  /** As `RebarEvent.pitches`, with fresh `NotePitch` ids for the reason `id` is rebuilt. */
  notes: 'carried',

  // --- deliberately lost -------------------------------------------------------------------------
  /** ⛔ DROPPED, and the type says why: "a structural edit that regenerates the rest (rebar, paste)
   *  drops it — which is also when the beaming context it describes has changed". The statement is
   *  about this rest's NEIGHBOURS, and after a re-lay they may not be the same notes. */
  beamOver: 'dropped',
} satisfies Record<SlotField, SlotFieldTravel>

/** The fields a round trip must preserve verbatim — what `slotFieldTravel.test.ts` checks. */
export const CARRIED_SLOT_FIELDS = (Object.keys(SLOT_FIELD_TRAVEL) as SlotField[])
  .filter((k) => SLOT_FIELD_TRAVEL[k] === 'carried')
