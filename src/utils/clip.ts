/**
 * A CLIP — a position-independent snapshot of musical material, and the one thing
 * `pasteEvents` takes.
 *
 * This is the container for the {@link RebarEvent} stream that DESIGN-PRINCIPLES §2 calls
 * *"the canonical currency for portable musical material, not a private detail of
 * re-barring"* — so it lives in the core, beside the events it holds, and not in the editor.
 * The clipboard is one producer of a clip (`interactions/clipboard.ts` reads a selection into
 * one, and adds the serialization envelope a system clipboard needs); a transposition, an
 * augmentation or an import could be another, with no editor present.
 *
 * ⭐ **A clip carries no position.** Every offset in it is relative to the clip's own start,
 * and every staff index is relative to its own topmost staff, which is exactly what makes it
 * pasteable anywhere, any number of times. Where it lands is the separate {@link ClipTarget}
 * argument — the two are not one object on purpose.
 *
 * ⭐ **Everything that travels with a lane hangs off the lane.** Rest shifts, hidden rests,
 * note offsets and two-note tremolos are all keyed by something the event stream cannot carry
 * (a position-keyed override, or a relation between two slots), so each is its own field here
 * rather than a separate paste argument — the next travelling attribute is a field, not a
 * fifteenth parameter.
 */
import type { Fraction } from '@/utils/fraction'
import type { RebarEvent } from '@/utils/rebar'

/**
 * One copied lane: a `(staff, voice)` pair and its event stream. The staff is a
 * RELATIVE index (0 = topmost copied staff) so a clip spanning staves 1+2 can land
 * on staves 3+4 — paste adds the paste-target staff to it (docs/copy-paste-staff-plan.md).
 */
export interface ClipLane {
  /** RELATIVE staff index within the clip (0 = topmost copied staff). Paste maps it to
   *  `target.staff + staff`, clamped to the score's staff count. */
  staff: number
  /** Model voice number (0-based). */
  voice: number
  /**
   * The rhythmic stream for this lane, offsets relative to the clip start
   * (quarter beats). Internal ties are collapsed into single logical notes;
   * tuplets are atomic. Unselected gaps are implicit — rest-filled on paste.
   */
  events: RebarEvent[]
  /**
   * Manual rest shifts inside the clip window, offsets relative to the clip start (same
   * basis as {@link events}) so they re-base by the paste start. Carried separately because
   * rests are not events — a shifted rest must travel even though it produces no note.
   * Absent/empty = no shifted rests. See docs/rest-shift-plan.md §6.5.
   */
  restShifts?: Array<{ offset: Fraction; steps: number }>
  /**
   * Hidden rests inside the clip window, offsets relative to the clip start (same basis as
   * {@link events}). Carried separately for the same reason as {@link restShifts} — a hidden
   * rest produces no note but must travel. Absent/empty = none hidden. See docs/rest-hide-plan.md.
   */
  restHidden?: Array<{ offset: Fraction }>
  /**
   * Note horizontal offsets (client #12) inside the clip window, offsets relative to the clip
   * start (same basis as {@link events}). Carried separately because the override is
   * SLOT-keyed and nothing in `events` (which holds no ids) can drag it along — a copied passage
   * would otherwise arrive un-offset. Covers chords AND rests (a note offset hangs off the slot).
   * Absent/empty = none. See docs/note-offset-plan.md.
   *
   * ⭐ `member` is a fanned MEMBER's place in its group (1…count−1), absent for the slot itself: the
   * member's own offset travels with the group it belongs to, addressed by index because the paste
   * mints fresh member ids.
   */
  noteOffsets?: Array<{ offset: Fraction; x: number; member?: number }>
  /**
   * Two-note tremolos whose BOTH notes are inside the clip window, at the FIRST note's offset
   * relative to the clip start (same basis as {@link events}).
   *
   * ⭐ Carried separately for the reason {@link restShifts} and {@link noteOffsets} are, and it is the
   * sharpest case of it: `RebarEvent` deliberately has NO `tremoloPair` field, because the relay
   * copies a split event's marks to every piece and a pair minted on each half of a tie-split would
   * be a bogus mark between two halves of one note (docs/two-note-tremolo-plan.md §1). That drop is
   * right for a RE-BAR, where adjacency genuinely may not survive — and wrong for a COPY, which
   * carries both notes and can simply reproduce the mark. So the relay stays clean and the clip
   * carries the relation itself.
   *
   * ⚠️ Only pairs whose PARTNER is also in the window travel: half a mark is not a mark. Re-validated
   * on paste against the tiling that actually arrives.
   */
  tremoloPairs?: Array<{ offset: Fraction; style?: 'joined' | 'open' }>
}

/**
 * A dynamic marking inside the clip window, re-anchored on paste. Staff is a RELATIVE index
 * (0 = topmost copied staff), like {@link ClipLane.staff}; `offset` is relative to the clip
 * start (quarter beats). Only dynamics whose position is FULLY inside the window travel
 * (decision: fully-enclosed-only). See docs/copy-paste-staff-plan.md.
 */
export interface ClipDynamic {
  /** RELATIVE staff index (0 = topmost copied staff). Paste maps it to `target.staff + staff`. */
  staff: number
  /** Governed voice (0-based). */
  voice: number
  /** Beat offset from the clip start (same basis as {@link ClipLane.events}). */
  offset: Fraction
  /** The mark's whole text (SMuFL glyphs + words) — the level travels inside it. See `Dynamic.text`. */
  text: string
  placement?: 'above' | 'below'
  /** Hand-nudged engraving offset (client #8), captured at copy so it travels with the mark. */
  engravingOffset?: { x: number; y: number }
}

/**
 * A hairpin inside the clip window, re-anchored on paste. Staff is a RELATIVE index
 * (0 = topmost copied staff), like {@link ClipLane.staff}; `offset` is relative to the clip start
 * (quarter beats) and `length` travels verbatim, since it is an amount of music and not an address.
 *
 * ⭐ Carried at all because DESIGN-PRINCIPLES §2 requires it: a hairpin is part of a passage, so
 * copying four bars and pasting them WITHOUT their hairpins would be a feature operating on
 * bar-anchored data while conceptually operating on a run of music — the forbidden clause, word for
 * word. Dynamics are here for the same reason ({@link ClipDynamic}).
 *
 * Only hairpins lying FULLY inside the window travel — both the start AND the end, matching the
 * fully-enclosed-only rule the dynamics and slurs already follow. So copying the *middle* of a long
 * crescendo leaves the wedge behind rather than silently truncating it to the selection: a clip
 * says what it holds, and half a wedge would claim a shape the music never had.
 */
export interface ClipHairpin {
  /** RELATIVE staff index (0 = topmost copied staff). Paste maps it to `target.staff + staff`. */
  staff: number
  /** Governed voice (0-based). */
  voice: number
  /** Start offset from the clip start (same basis as {@link ClipLane.events}). */
  offset: Fraction
  /** How much music the wedge covers, in quarter beats — position-independent, so it is copied
   *  through unchanged. */
  length: Fraction
  type: 'cresc' | 'dim'
  placement?: 'above' | 'below'
}

/** A pitch identity used to re-find a slur endpoint on the pasted notes. */
export interface ClipSlurPitch { step: string; alter: number; octave: number }

/**
 * A slur inside the clip window, re-anchored on paste. Both endpoints are addressed by
 * RELATIVE staff (0 = topmost copied staff), voice, clip-relative offset, and pitch — so paste
 * re-finds the freshly-pasted note that now sits at that position. Only slurs with BOTH
 * endpoints fully inside the window travel (decision: fully-enclosed-only).
 */
export interface ClipSlur {
  startStaff: number; startVoice: number; startOffset: Fraction; startPitch: ClipSlurPitch
  endStaff: number;   endVoice: number;   endOffset: Fraction;   endPitch: ClipSlurPitch
  placement?: 'above' | 'below'
}

/**
 * A run of musical material, detached from where it came from and where it is going.
 * See the module comment for why the target is not in here.
 */
export interface Clip {
  /**
   * One entry per `(staff, voice)` lane, with the staff stored as a RELATIVE index
   * (0 = topmost copied staff). A single-voice clip is re-voiced into the paste target voice;
   * a multi-voice clip preserves each voice. An array (not a Map) to stay JSON-serializable.
   */
  lanes: ClipLane[]
  /** Total covered length, in quarter-note beats. */
  spanBeats: Fraction
  /** Dynamics fully inside the clip window, re-anchored on paste. Absent/empty = none. */
  dynamics?: ClipDynamic[]
  /** Slurs fully inside the clip window, re-anchored on paste. Absent/empty = none. */
  slurs?: ClipSlur[]
  /** Hairpins fully inside the clip window (start AND end), re-anchored on paste. Absent/empty = none. */
  hairpins?: ClipHairpin[]
  /**
   * User-authored horizontal spaces (client #10) whose column falls inside the clip window,
   * offsets relative to the clip start (same basis as {@link ClipLane.events}).
   *
   * **Top-level, not per lane** — the one piece of a clip that is neither, and deliberately:
   * a space belongs to the COLUMN, not to a note in it, so it has no voice and no staff to carry.
   * That makes it the simplest thing here to re-base and the only one paste maps by offset alone.
   *
   * Carried at all for the same reason `restShifts` is: the override is position-keyed, so nothing
   * in `events` can drag it along, and a copied passage would silently arrive unspaced.
   * Absent/empty = none. See docs/note-spacing-plan.md §6.
   */
  spaces?: Array<{ offset: Fraction; space: number }>
  // future: clefs?: ClipClef[]; …
}

/**
 * Where a clip lands: the ABSOLUTE position a paste drops it at. The counterpart to the clip's
 * own relative addressing — `voice` is the destination for a single-voice clip (a multi-voice
 * clip keeps its own voices), and `staff` is the destination for the clip's relative staff 0.
 *
 * This is DESIGN-PRINCIPLES §4's *"place this material into (instrument, measure, beat)"*,
 * spelled as one value.
 */
export interface ClipTarget {
  measure: number
  beat: Fraction
  /** Destination voice (0-based) for a single-voice clip. */
  voice: number
  /** Destination staff (0-based) for the clip's RELATIVE staff 0. Absent = the first staff. */
  staff?: number
}
