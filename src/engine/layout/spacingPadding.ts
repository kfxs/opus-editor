/**
 * THE INK HALF — how much room an event's own glyphs take, and the least space that may be left
 * between two of them (docs/spacing-model-plan.md P3). Pure: staff spaces in, staff spaces out.
 *
 * Gould's second fact. `spacing.ts` says how much room a DURATION earns; this says how much room the
 * ink NEEDS, and the two are combined with a `max` — the duration gives the ideal gap, the ink gives
 * the minimum, and the wider wins. Before P3 the minimum was one flat constant per event
 * (`MIN_NOTE_SPACING`, 1.8 spaces, documented as a *clickability* floor and used as an engraving
 * one), which is why a quarter with a sharp in front of it and a bare quarter were asked to live in
 * the same column.
 *
 * ## ⭐ Every number here was MEASURED off our own drawing, in Chrome
 *
 * Not read out of a font spec and not invented: rendered, then read back with `e2e/harness.ts`'s
 * glyph readers, so the table says what VexFlow actually does. `e2e/spacing.e2e.ts` re-measures them
 * and fails if the two drift — which is the answer to *"⛔ what is not an option is measuring one
 * and drawing the other silently"* (plan §P3). The paddings BETWEEN events are a different kind of
 * number — a judgement, not a measurement — and are seeded from MuseScore's published table
 * (docs/spacing-model-research.md §3).
 *
 * ## ⛔ A new element that draws ink adds a ROW here
 *
 * Never a constant somewhere else. That rule is the whole point of the model: five constants in the
 * fan alone once negotiated one boundary, each right on the screenshot it was measured against
 * (plan §0). The kinds are a closed union, so the compiler names every table that needs the row.
 */

import type { NoteDuration } from '@/types/music'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * What sits at one edge of a gap. Not "what the event IS" — what its ink at that edge IS, which is
 * the thing the padding is a judgement about: a dotted note ends in a DOT, a note with a sharp
 * begins with an ACCIDENTAL.
 */
export type InkKind = 'note' | 'rest' | 'accidental' | 'dot' | 'ledger' | 'barline'

/**
 * The ink an event's own glyphs take, in staff spaces, measured off the drawing (see the header).
 *
 * ⚠️ These are **advances from the notehead's own anchor x**, which is where VexFlow places the
 * glyph's left edge — so `notehead` is a notehead's width, and `firstDot` is how far past the anchor
 * the first augmentation dot is placed.
 */
export const INK = {
  /** A notehead's own width. Measured as the offset of the DISPLACED head of a second: 11.3 px. */
  notehead: 1.13,
  /**
   * ⭐ A LEDGER LINE reaches from **−0.30 to +1.50** of the notehead's anchor — 1.80 spaces wide,
   * against the notehead's own 1.13, so a ledgered note is **0.67 spaces wider than a bare one** and
   * overhangs it on BOTH sides. Measured at four pitches (one line below, two below, two above, four
   * above): every ledger is the same length, so one pair of numbers covers all of them.
   *
   * ⚠️ This is why a dense run of ledgered 32nds drew its ledger lines ON TOP of each other before
   * P3.1: the model gave those notes a bare notehead's extent, the gaps came out at 1.64 spaces, and
   * the ink needed 2.15.
   */
  ledgerLeft: 0.3,
  ledgerRight: 1.5,
  /** Where the first augmentation dot lands, past the notehead's anchor. */
  firstDot: 1.7,
  /** …and each dot after it. */
  dotStep: 0.9,
  /** The dot glyph's own width. */
  dotWidth: 0.4,
  /** The gap VexFlow leaves between the nearest accidental column and the notehead. */
  accidentalToHead: 0.1,
} as const

/**
 * One accidental COLUMN's width, in staff spaces, by the VexFlow sign string.
 *
 * Derived from the measured total: a single sharp puts its ink 1.40 spaces left of the head, which
 * is this width plus {@link INK.accidentalToHead}. Two sharps measured 2.70 and three 4.00 — one
 * more column each, exactly 1.30 apart.
 */
const ACCIDENTAL_WIDTH: Record<string, number> = {
  '#': 1.3,
  'b': 1.2,
  'n': 1.0,
  '##': 1.3,
  'bb': 2.0,
}

/**
 * ⭐ **Two accidentals share a column when they are a SEVENTH or more apart** — measured, one
 * interval at a time: a third, fourth, fifth and sixth all stack into two columns; a seventh and
 * everything above it come out at one x. That is also the engraver's own rule, so the drawing and
 * the tradition agree here and the number is not ours to choose.
 */
const ACCIDENTAL_SHARE_INTERVAL = 6

/**
 * A rest's own width, in staff spaces, by duration — measured off the drawing.
 *
 * ⭐ **Not one number: the SHORT rests are the WIDE ones.** A 16th rest is 1.30 and a 32nd 1.50,
 * against a quarter's 1.10 and an eighth's 1.00, because each extra flag leans further right. P3
 * shipped with a single 1.2 for every duration, which was too generous for an eighth and 20% too
 * tight for a 32nd — precisely backwards in the dense music where it matters.
 *
 * ⚠️ Measured as the glyph's LAYOUT BOX, not as an advance like {@link INK.notehead} (which came
 * from the offset of a displaced second, the one measurement that reads a notehead's true ink). The
 * box over-reads a notehead by 0.17 spaces, so these carry about that much slack. Left uncorrected
 * on purpose: this is a MINIMUM, and a generous minimum prevents collisions where a tight one causes
 * them — and a per-glyph side-bearing correction is not something we can verify.
 */
const REST_WIDTH: Record<NoteDuration, number> = {
  w: 1.2,
  h: 1.2,
  q: 1.1,
  '8': 1.0,
  '16': 1.3,
  '32': 1.5,
}

/** How wide a rest of this duration is, in staff spaces. */
export function restExtent(duration: NoteDuration): number {
  return REST_WIDTH[duration] ?? REST_WIDTH.q
}

/**
 * How far left of the notehead column a chord's accidentals reach, in staff spaces.
 *
 * `signs` is one entry per sounding pitch that DRAWS a sign, as `[diatonicPosition, sign]` — the
 * position being `spellingDiatonicPos`, so "a seventh apart" is a difference of 6. Pitches whose
 * sign is suppressed by the running-accidental rule are simply not in the list, which is why the
 * caller resolves them through `displayedAccidentals` rather than looking at `alter`.
 *
 * The stacking is VexFlow's own, greedily: take the pitches from the top down, and put each into the
 * first column whose last occupant it clears.
 */
export function accidentalExtent(signs: { position: number; sign: string }[]): number {
  if (signs.length === 0) return 0
  const sorted = [...signs].sort((a, b) => b.position - a.position)
  /** Per column: the lowest position placed in it so far, and its widest sign. */
  const columns: { lowest: number; width: number }[] = []
  for (const { position, sign } of sorted) {
    const width = ACCIDENTAL_WIDTH[sign] ?? ACCIDENTAL_WIDTH['#']
    const room = columns.find(column => column.lowest - position >= ACCIDENTAL_SHARE_INTERVAL)
    if (room) {
      room.lowest = position
      room.width = Math.max(room.width, width)
    } else {
      columns.push({ lowest: position, width })
    }
  }
  return INK.accidentalToHead + columns.reduce((total, column) => total + column.width, 0)
}

/** How far right of the notehead column `dots` augmentation dots reach, in staff spaces. */
export function dotExtent(dots: number): number {
  if (dots <= 0) return 0
  return INK.firstDot + INK.dotStep * (dots - 1) + INK.dotWidth
}

/**
 * The least ink-free space between two adjacent things, in staff spaces — **keyed by the PAIR**.
 *
 * Seeded from MuseScore's published padding table (research §3), which is the same shape: a max over
 * item pairs of `a.right − b.left + padding(typeA, typeB)`. ⛔ Corrected by eye, never by adding a
 * constant elsewhere.
 *
 * ⭐ The note↔note number is the one the rest of the model leans on: a notehead's 1.13 plus 0.30
 * gives **1.43 staff spaces** as the tightest two ordinary noteheads may come — which is what plan
 * §1.1 predicts from the other end (*"model the ink and the bottom of Gould's table arrives on its
 * own"*), and it lands on Sibelius's 32nd (1.41) and LilyPond's (1.5) to two decimals.
 */
export function pairPadding(left: InkKind, right: InkKind): number {
  // ⭐ A BARLINE has two sides and they are two different rows. The one BEFORE it is the run-out at
  //   the end of a bar; the one AFTER it is the bar's LEAD-IN, the blank between the line and the
  //   first thing drawn.
  //
  // ⚠️ **1.2 leading against 1.0 trailing, and the odd number is deliberate.** VexFlow adds a 12 px
  //   `Stave.padding` to every note inside `getAbsoluteX`, with no public setter, while
  //   `getNoteStartX` — which is what our own geometry, hit-testing and shrink-room all read — does
  //   not carry it. So a lead-in under 1.2 spaces can only be drawn by pushing the note-start LEFT
  //   OF THE BARLINE, and then the bar's clickable area begins outside the bar
  //   (`tier1Geometry.test.ts` pins that it may not). 1.2 is the tightest the drawing and the model
  //   can BOTH say, and saying the same thing is the property worth having: an aspirational 1.0 that
  //   comes out at 1.2 is the silent disagreement this whole table exists to end. It also sits
  //   between our trailing 1.0 and MuseScore's `barline↔barline` 1.35, which is where a leading gap
  //   belongs — a barline reads as an event, and the note after it wants a shade more air than the
  //   note before it.
  if (left === 'barline') return right === 'rest' ? 1.65 : 1.2
  if (right === 'barline') return left === 'rest' ? 1.65 : 1.0
  if (left === 'rest' || right === 'rest') return 0.5
  if (left === 'dot') return 0.5
  if (right === 'accidental') return 0.35
  // ⭐ A LEDGER LINE wants a shade more clearance than two noteheads do — MuseScore's own
  //   `note↔ledger`. Two ledgers that merely touch read as one long line through both notes.
  if (left === 'ledger' || right === 'ledger') return 0.35
  return 0.3
}

/**
 * ⭐ **The tightest two ordinary noteheads may come**, in staff spaces — the model's own answer to
 * the question `MIN_NOTE_SPACING` was invented for, and the number the drag gestures floor at.
 *
 * ⚠️ It is 1.43 where that constant was 1.8, so a bar can now be squeezed about 20% further. The
 * constant was never derived from anything: its doc called it *"minimum space between notes for
 * **clickability**"* while `layoutConfig`'s own INK-vs-FINGER rule says a fingertip is not ink and
 * does not scale with the staff — so it was two different concerns wearing one number. This is the
 * engraving one. If a column ever becomes hard to *click* at 1.43 spaces, that is a hit-box question
 * and belongs to the registry, not to the spacing.
 */
export const MIN_COLUMN_GAP = INK.notehead + pairPadding('note', 'note')

/**
 * How narrow an EMPTY bar's note area may be squeezed, in PIXELS — one column's worth.
 *
 * ⭐ In pixels and not in staff spaces, deliberately: an empty bar's width is a **default**, not
 * music (`MeasureLayout.noteSpaceForMeasure` and `measureWidthParts` both turn on that), and the two
 * places that clamp it — the layout's own scalable floor and the bar-width gesture's `layoutFloor` —
 * must name the SAME number or a press dies one step early or one step late.
 *
 * ⚠️ It is one column's gap and NOT `INK.rest + pairPadding('rest','barline')`, which would be
 * wider: a measure rest is **centred** in its bar, so it never stands against a barline and that
 * pair never comes up. Reading it as though it did would make an empty bar shrink *less* far, and
 * he has reported three times that empty bars already do not shrink far enough.
 */
export const EMPTY_BAR_FLOOR_PX = MIN_COLUMN_GAP * STAFF_SPACE_PX
