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
 * ## ⭐ Every number here was MEASURED off our own drawing, in Chrome — and is now CHECKED
 *
 * Not read out of a font spec and not invented: rendered, then read back with `e2e/harness.ts`'s
 * glyph readers, so the table says what VexFlow actually does. `e2e/spacing.e2e.ts` re-measures them
 * and fails if the two drift — which is the answer to *"⛔ what is not an option is measuring one
 * and drawing the other silently"* (plan §P3). The paddings BETWEEN events are a different kind of
 * number — a judgement, not a measurement — and are seeded from MuseScore's published table
 * (docs/spacing-model-research.md §3).
 *
 * ⭐⭐ **F2 added the other side of that pairing**: `spacingPadding.font.test.ts` holds every extent
 * here against **Bravura's own metrics** (`engine/fonts/`), in jsdom, with no browser. So the table
 * now answers to two things that cannot both be wrong in the same direction — what we DRAW and what
 * the FONT says — and a row that agrees with neither is a failing test.
 * ⛔ **A deliberate difference is an OVERRIDE carrying its sentence**, declared in that file. Never a
 * silent one: a silent difference is how a rounded-out clearance gets "corrected" by the next reader.
 *
 * ⚠️ **Three quantities live in this one table and always have** — an ink extent, a placement, and a
 * distance measured off VexFlow's BEHAVIOUR (docs/font-metrics-plan.md §3.1). `notehead` and
 * `secondDisplacement` are the pair that shows why it matters: they were one row until F2, and the
 * font agrees with only one of them.
 *
 * ## ⛔ A new element that draws ink adds a ROW here
 *
 * Never a constant somewhere else. That rule is the whole point of the model: five constants in the
 * fan alone once negotiated one boundary, each right on the screenshot it was measured against
 * (plan §0). The kinds are a closed union, so the compiler names every table that needs the row.
 */

import type { NoteDuration } from '@/types/music'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { restStaffLine } from './restPlacement'

/**
 * What sits at one edge of a gap. Not "what the event IS" — what its ink at that edge IS, which is
 * the thing the padding is a judgement about: a dotted note ends in a DOT, a note with a sharp
 * begins with an ACCIDENTAL.
 *
 * ⭐ `stem` joined the union for KERNING (`layout/kerning.ts`) and buys no width of its own: a stem
 * stands at its notehead's right edge, so it never reaches past ink that is already counted. What it
 * does is *block* — it is the piece hanging through the space a low accidental would otherwise tuck
 * into, and a horizontal-only ink model had no reason to name it.
 */
export type InkKind = 'note' | 'rest' | 'accidental' | 'dot' | 'ledger' | 'stem' | 'flag' | 'barline'

/**
 * The ink an event's own glyphs take, in staff spaces, measured off the drawing (see the header).
 *
 * ⚠️ These are **advances from the notehead's own anchor x**, which is where VexFlow places the
 * glyph's left edge — so `notehead` is a notehead's width, and `firstDot` is how far past the anchor
 * the first augmentation dot is placed.
 */
export const INK = {
  /**
   * ⭐⭐ **A notehead's own INK** — how wide the drawn head is. ⚠️ **Bravura says 1.18**
   * (`fonts/fontMetrics.noteheadInk`), and this is 1.13 as an **OVERRIDE pending his eye**
   * (docs/font-metrics-plan.md §3.6 item 2): it moves every note-to-note gap in the score by 0.05
   * spaces, and it drags {@link MIN_COLUMN_GAP} — and therefore the drag floors — with it.
   *
   * ⛔ **1.13 is not this quantity, and that is the point of the split.** It was measured as the
   * offset of the DISPLACED head of a second (11.3 px), which is the head's ink LESS HALF A STEM —
   * see {@link INK.secondDisplacement}, which is what that measurement actually answers. The 0.05
   * was never an error; it was a second question wearing this one's name (plan §3.1a).
   */
  notehead: 1.13,
  /**
   * ⭐ **How far a chord displaces the second of two adjacent noteheads** — the two heads share the
   * stem they hang on, so they overlap by its width instead of sitting edge to edge.
   *
   * FONT: 1.12 (`noteheadInk 1.18 − stemThickness 0.12 / 2`). Ours is the 1.13 measured in Chrome,
   * kept because 0.01 spaces is a tenth of a pixel and re-measuring it is not worth a redraw.
   */
  secondDisplacement: 1.13,
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
  /**
   * ⭐ **How far a FLAG reaches past its notehead's right edge** — 1.0 staff space, measured: an
   * eighth's up-flag runs from 1.05 to **2.15** spaces past the head's anchor, against the head's own
   * 1.13.
   *
   * ⚠️ **It was a real blind spot, and in BOTH directions.** Today the column claims 1.13 and the flag
   * draws to 2.15, so a bar of unbeamed 32nds — whose rule-given gap is 1.50 — draws each flag through
   * the next notehead. And the OLD ink path (VexFlow's `preCalculateMinTotalWidth`) had the opposite
   * error: it counted a flag on every eighth *including beamed ones*, where none is drawn, which is
   * what made an eighth measure WIDER than a quarter (docs/spacing-model-research.md §6). The answer to
   * both is to count it exactly when it is drawn — see {@link measureColumns}, which asks
   * `beamRoleAt` rather than guessing from the duration.
   *
   * A DOWN flag adds nothing: its stem stands at the head's LEFT edge, so its 1.2 spaces of ink land
   * inside the head's own 1.13 (measured: box right 1.3 against the head's 1.2).
   *
   * ⚠️ **This is a COMPOSITION, not a glyph width** (docs/font-metrics-plan.md §3.1b): the font's
   * `flag8thUp` is 1.056 measured from the STEM's x, so the reach past the head is
   * `noteheadInk − stemThickness + flag`, i.e. **0.94** past a 1.18 head — 2.12 from the anchor,
   * against the 2.13 this 1.0 gives on a 1.13 head. ⛔ It cannot be re-sourced on its own: it rides
   * on whichever notehead ink is chosen (§3.6 item 2), so it is an OVERRIDE until that is settled.
   * `fonts/fontMetrics.flagInkRight` is the formula, and the check test holds the two together.
   */
  flagReach: 1.0,
} as const

/**
 * ⭐⭐ **HOW TALL each ink is** — staff spaces ABOVE and BELOW its own anchor, i.e. the vertical half
 * of the same table the numbers above are the horizontal half of.
 *
 * It exists for KERNING (`layout/kerning.ts`): two inks only need horizontal clearance where they
 * share a vertical band, so the model cannot answer *"may this accidental tuck under that notehead"*
 * without knowing how far each reaches up and down.
 *
 * ## ⚠️ Measured with `measureText`, NOT with a bounding box
 *
 * A music glyph's SVG `<text>` reports the same 16-space-tall box for every glyph in the font — the
 * line box, not the ink (which is the same trap as
 * `reference_vexflow_annotation_pointer_rect`, one level down). Canvas `TextMetrics
 * .actualBoundingBoxAscent/Descent` is the glyph's real ink, and is what VexFlow's own
 * `Element.getBoundingBox` uses. `e2e/kerning.e2e.ts` re-measures these the same way.
 *
 * ⭐ The numbers came out as the tradition states them, which is the check worth having: a sharp is
 * symmetric at ±1.4 spaces, a **flat reaches 1.8 up and only 0.8 down** (its bowl sits above the
 * line), and a notehead is half a space either side.
 *
 * ⭐⭐ **And they are now CHECKED, not only measured**: `spacingPadding.font.test.ts` holds every row
 * of this file against Bravura's own metrics (`engine/fonts/`), so a number that drifts from the
 * font is a failing test rather than a discovery years later. ⛔ A row that deliberately differs is
 * an **override carrying its sentence** — never a silent difference (docs/font-metrics-plan.md §3.5).
 *
 * ⚠️ **A REST is not in this table** — it is not drawn at a pitch, so it has a BAND rather than a
 * reach. See {@link restBand}.
 */
export const INK_HEIGHT = {
  /** A notehead, up and down from its own line. 0.6 both ways — the measured 0.5/0.6, rounded OUT. */
  notehead: 0.6,
  /** An augmentation dot. */
  dot: 0.2,
  /** A ledger line: a hairline, but its BAND spans head→staff rather than the head alone. */
  ledger: 0.15,
  /**
   * ⭐ A FLAG hangs **3.3 staff spaces from the stem TIP back toward the notehead** — down for an
   * up-stem, up for a down-stem — which is nearly the whole stem. Measured, and the same for the 8th,
   * 16th and 32nd flags (each extra hook thickens the glyph rather than lengthening it).
   *
   * ⚠️ It is a band from the TIP, not around an anchor, which is why the flag box is built from the
   * stem's own geometry in `measureColumns` rather than from a `± height` like the others.
   */
  flagFromTip: 3.3,
} as const

/**
 * ⭐⭐ **A REST'S HEIGHT — the row this table never had** (docs/font-metrics-plan.md §3.4).
 *
 * Every other ink here is a `± reach` around its own anchor. A rest cannot be: **it is not drawn at
 * a pitch**, it is drawn at a fixed place on the staff that depends on its duration, so what the
 * model needs is the BAND itself. Hence {@link restBand} rather than a pair of numbers.
 *
 * ## ⚠️ It takes TWO facts, and the font supplies only one of them
 *
 * The font gives the **extent** — how far the glyph's ink runs either side of its own origin. Where
 * that origin SITS is a placement, and a placement is the drawing's, not the font's: a whole rest
 * hangs from the second line down, everything else centres on the middle line. ⭐ That is the same
 * *"name the quantity"* trap the notehead row carries (plan §3.1), and it is why `restPlacement.ts`
 * is a separate MODULE with its own source — one the DRAWING reads too, so the band and the glyph
 * cannot land on different lines (they did: see that module's header).
 *
 * ## ⭐ The asymmetry is the whole reason to have it
 *
 * A whole rest hangs almost entirely BELOW its line (0.04 up, 0.54 down) and a half rest sits
 * entirely above it (0.57 up, 0.01 down) — the same glyph shape, the same width, on opposite sides
 * of the line. One number for *"a rest is this tall"* would be wrong for both.
 */
const REST_HEIGHT: Record<NoteDuration, { up: number; down: number }> = {
  w: { up: 0.036, down: 0.54 },
  h: { up: 0.568, down: 0.008 },
  q: { up: 1.492, down: 1.5 },
  '8': { up: 0.696, down: 1.004 },
  '16': { up: 0.716, down: 2.0 },
  '32': { up: 1.704, down: 2.0 },
}

/**
 * The vertical band a rest of this duration occupies, in staff spaces below the top stave line.
 *
 * ⚠️ **Nothing kerns against a rest today** (`MAY_KERN` in `layout/kerning.ts` has no rest row), so
 * this changes no width until that row is added — which is a decision and not a consequence
 * (plan §3.6 item 6). It exists so that the question *"may this accidental tuck under that rest?"*
 * becomes answerable at all: before it, a rest claimed the WHOLE staff as its band, which is the
 * most conservative answer there is and the honest one while the extents were unknown.
 */
export function restBand(duration: NoteDuration): { top: number; bottom: number } {
  const line = restStaffLine(duration)
  const height = REST_HEIGHT[duration] ?? REST_HEIGHT.q
  return { top: line - height.up, bottom: line + height.down }
}

/** How far an accidental's ink reaches above and below the line of the note it belongs to. */
const ACCIDENTAL_HEIGHT: Record<string, { up: number; down: number }> = {
  '#': { up: 1.4, down: 1.4 },
  'b': { up: 1.8, down: 0.8 },
  'n': { up: 1.4, down: 1.4 },
  '##': { up: 0.6, down: 0.5 },
  'bb': { up: 1.8, down: 0.7 },
}

/** The vertical reach of one accidental sign, defaulting to a sharp's. */
export function accidentalHeight(sign: string): { up: number; down: number } {
  return ACCIDENTAL_HEIGHT[sign] ?? ACCIDENTAL_HEIGHT['#']
}

/**
 * How far a STEM reaches from its notehead, in staff spaces — **and why a stem is in this table at
 * all**: it is the ink that decides most kerning questions. An accidental low on the staff cannot
 * tuck under a preceding high note if that note's stem is hanging through the space it wants, and
 * the stem is exactly the piece a horizontal-only ink model never had to know about.
 *
 * 3.5 spaces is VexFlow's default and Gould's, and a stem also always reaches AT LEAST the middle
 * line — the two rules coincide for a note just outside the staff, which is the common case.
 *
 * ⚠️ **A BEAMED note's stem is longer, by an amount no width-time code can know** (it runs to a beam
 * whose height is decided by the whole group, after formatting). So `layout/kerning.ts` does not
 * predict it: a beamed note's stem is treated as reaching the far side of the staff, which declines
 * the kern rather than risking ink through ink.
 */
export const STEM_REACH = 3.5

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
  // ⭐⭐ **A REST GETS A NOTE'S GAP AFTER A BARLINE — every engine agrees, and this row used to claim
  //   otherwise.** It said 1.65, copied from the row BELOW (a rest *before* a barline, which really is
  //   its own bigger number: MuseScore's `table[REST][BAR_LINE] = 1.65` against a note's 1.5). Going the
  //   other way MuseScore assigns the note's own value explicitly —
  //   `table[BAR_LINE][REST] = barNoteDistance` — LilyPond's `BarLine.space-alist` keys on `first-note`
  //   / `next-note`, i.e. the next musical COLUMN whatever is in it, Sibelius has a single control for
  //   *"the gap before the first note/rest in a bar"*, Dorico calls the whole mechanism note spacing
  //   for notes *and* rests, and Verovio gives a rest a note's alignment type.
  //
  // ⚠️ The wrong row never actually fired (a rest reaches nothing to its LEFT, so nothing keyed it), so
  //   the drawing was right by accident and nothing moves by deleting it. What changes is that the table
  //   stops disagreeing with the picture — see `kerning.edgeKind`, which is where the accident lived.
  if (left === 'barline') return 1.2
  // ⭐⭐ **THE TRAILING SIDE — 1.0, and LilyPond has NO number to take here.** Checked at the source:
  //   `BarLine` has no note-facing `space-alist` entry and no `extra-spacing-width`, because LilyPond
  //   spaces the end of a bar STRUCTURALLY instead — `NoteSpacing.space-to-barline` (default on): *"the
  //   distance between a note and the following non-musical column will be measured to the BAR LINE
  //   instead of to the beginning of the non-musical column"*. So the last note's own duration space runs
  //   out to the line and only ink stops it, which is exactly what our barline-as-a-column already does:
  //   this number is the INK FLOOR under that rule, not the gap itself.
  //
  //   Measured: in a sparse bar the last note sits **3.6** spaces from the barline (a quarter's own
  //   space — the floor never enters), and in a bar of 16ths the floor binds at **2.13** (notehead 1.13
  //   plus this). MuseScore is the only engine with a constant here, `noteBarDistance` = 1.5, which would
  //   make that 2.63. Judged on screen and left at 1.0 (*"i think is ok now"*), so ⛔ do not "correct" it
  //   towards MuseScore without an eye on a dense bar — `docs/spacing-model-research.md` §6d.
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
