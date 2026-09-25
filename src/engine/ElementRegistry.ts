/**
 * ElementRegistry - Maps rendered SVG elements to score data
 *
 * After VexFlow renders, this registry stores the bounding box of each element
 * along with its score data (note ID, measure, beat, pitch, etc.)
 *
 * This allows:
 * - Hit detection: "What element is at pixel (x, y)?"
 * - Position lookup: "Where is note with ID 'abc123' on screen?"
 */

import type { PitchSpelling } from '@/types/music'
import type { ScoreTextField } from '@/engine/models/scoreTextOps'
import { dbg } from '@/utils/debug'
import { staffOf } from '@/utils/lanes'
import { staffLineAtY, staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'

/**
 * Types of elements we track
 */
export type ElementType =
  /**
   * ⭐ A GROUPING SIGN at a system's left edge — the brace, bracket or sub-bracket
   * (`rendering/staff/systemStart`). Registered from the PEN, in SVG space.
   *
   * ⚠️ **It has to be**, and that is not a style choice: the brace is drawn inside a NON-UNIFORM
   * `scale(sx, sy)` group, and {@link ElementRegistry.withScale} takes ONE number — so a box filed
   * through the usual scaled path has no representation. The drawing already knows the sign's
   * corners in the SVG's own coordinates, so it writes them down there.
   */
  | 'staffGroupSign'
  /** ⭐ One of the two SQUARES of a selected grouping sign — grab it to grow or shrink the group
   *  (`interactions/elements/staffGroupHandles`). Registered by the HIGHLIGHT, like the barline
   *  join's square, because it exists only while something is selected. */
  | 'staff-group-handle'
  | 'note'
  /**
   * A note's STEM, as its own ink rect — registered per stemmed slot (a chord has one stem, and
   * one stem element). Its own type rather than something inferred from the note's box, because
   * the note's box deliberately spans head + stem + beam: from outside, "where is the stem" is
   * not answerable from it, only guessable (which side, how far). VexFlow knows exactly, so we
   * write it down at render time.
   *
   * The first caller is the tremolo stamp — the strokes ride the stem, so the stem is where the
   * pointer goes. Stem length drag and a stem-side selection want the same rect.
   *
   * ⚠️ It carries {@link ElementInfo.noteId}, NOT `id`. See that field for why.
   */
  | 'stem'
  /**
   * A note's TREMOLO mark — the stroke stack (or the Penderecki sign) as its own ink rect, one per
   * slot, anchored like the stem it rides.
   *
   * It sits ON the stem, so the two rects overlap wherever the strokes are: the mark wins inside its
   * own boundaries and the stem stays clickable everywhere else along its length — which is why both
   * are registered as ink, not as targets. The rect is the strokes' MEASURED ink, not a modifier
   * bounding box (see {@link CenteredTremolo.inkRect}).
   *
   * ⚠️ Carries {@link ElementInfo.noteId}, NOT `id` — same reason as `'stem'`.
   */
  | 'tremolo'
  | 'rest'
  | 'clef'
  | 'timeSignature'
  /**
   * ⭐ A **KEY SIGNATURE** — the whole row of signs at a bar's head, as ONE box from the first
   * sign's ink to the last's, five staff lines tall.
   *
   * ONE box for the row and not one per sign, deliberately: the signature is what you select, edit
   * and delete (there is no such thing as removing the C♯ from D major and keeping the F♯), so the
   * box is the statement rather than its letters. The same call the clef's box makes one column
   * over.
   *
   * ⚠️ Registered by the DRAWING pass, like `'repeatStart'` and for its reason: what a bar draws
   * depends on the bar before it and on the casting-off, so tier 1 cannot know it. Its existence IS
   * proof it was painted, so a press needs no `isPainted` filter.
   *
   * ⛔ A bar whose signature is EMPTY (C major, an open key) registers nothing, because it draws
   * nothing — the first element whose valid state is zero ink, and why a SIGNPOST is owed
   * (docs/plans/key-signature-plan.md §5). See `engine/rendering/staff/KeySignaturePass`.
   */
  | 'keySignature'
  | 'barline'
  /**
   * ⭐⭐ **THE PART OF A JOINED BARLINE THAT CROSSES THE GAP** between two staves — the ink
   * `rendering/staff/barlineGap` draws, made clickable (docs/plans/barline-join-plan.md). His ask, 2026-08-28:
   * *"if the barline is join and i click on in the empty space of the two staves i want to be able to
   * select it too and move and do the normal barline operations"*.
   *
   * ⭐ **It selects the same thing the staff ink does** — the one system-wide `barline` element at
   * that boundary, with the same width drag armed. ⛔ It is NOT a second selectable kind, and there
   * is no `SelectedElement` for it: `interactions/elements/barline.ts` simply counts these boxes as
   * candidates beside the tier-1 ones.
   *
   * ⚠️ Registered by the DRAWING pass and only where ink actually landed, so unlike `'barline'` it
   * needs no `isPainted` filter — and a gap that is not joined registers nothing, because nothing is
   * drawn there. `measure` is the bar the line ENDS (⛔ not always the bar that drew it) and `staff`
   * is the staff ABOVE the gap.
   */
  | 'barline-gap'
  /**
   * ⭐⭐ One of the blue SQUARES a selected barline draws in the gaps between the staves — the handle
   * that JOINS that gap or disjoins it (docs/plans/barline-join-plan.md §1). The `'pedal-endpoint'` family's
   * arrangement: registered by the HIGHLIGHT pass so it exists only while its barline is selected,
   * removed again by `clearHighlights`, and answered by a MouseController pre-step rather than by a
   * row in `ELEMENT_HIT_ORDER` — ⛔ a join square is not a selectable element and there is no
   * `SelectedElement` kind for it.
   *
   * ⚠️ It carries `measure` + `staff`, and `staff` is **THE STAFF ABOVE THE GAP** — `barlineJoinBelow`'s
   * own key (`engine/models/barlineJoin`), so the TWO squares of one gap register the same pair. ⛔ Not
   * the staff the square is drawn nearest: `interactions/elements/barlineJoinHandles` keeps that
   * distinction, and only for which way a P3 drag means "join".
   */
  | 'barline-join'
  /**
   * ⭐ The **OPEN REPEAT** (`|:`) — the one barline sign registered by the DRAWING pass rather than
   * by tier 1, because it is the one whose position tier 1 cannot know: a bar with a header displaces
   * it past the clef/meter, so it may stand at no boundary at all. Owned by the bar it OPENS
   * (`measure`), which at a `:||:` junction is the bar on the far side of the line.
   *
   * ⚠️ Registered only when PAINTED, so unlike `'barline'` it needs no `isPainted` filter at press
   * time. See `engine/rendering/staff/BarlineRenderer.registerRepeatStart`.
   */
  | 'repeatStart'
  | 'beam'
  | 'staff'
  | 'tie'
  /**
   * A GLISSANDO stroke (docs/plans/glissando-plan.md P4). ⚠️ ONE ENTRY PER DRAWN PIECE — a line across a
   * system break registers twice, each carrying the same glissando `id`. `points` are the stroke's two
   * ends, walked by `interactions/elements/glissando.ts`.
   */
  | 'glissando'
  | 'slur'
  | 'slur-handle'
  | 'slur-endpoint'
  | 'slur-segment-endpoint'
  /**
   * A HAIRPIN wedge. ⚠️ ONE ENTRY PER DRAWN FRAGMENT — a wedge split across a system break
   * registers twice (or more), each carrying the same hairpin id, because each piece is separately
   * clickable and the id is what a hit resolves to. `points` are its outline, walked by
   * `interactions/elements/hairpin.ts`; the bbox alone would be a wide flat band under every note
   * the wedge spans.
   */
  | 'hairpin'
  /**
   * One of the two blue SQUARES a selected hairpin draws, at each end of the wedge. Registered by
   * the HIGHLIGHT pass (not the render) like the slur's handles, so it exists only while its hairpin
   * is selected — and is removed again by `clearHighlights`. Carries `hairpinId` + `endpoint`;
   * ⛔ deliberately NOT `id`, since {@link getById} answers with the FIRST entry holding one and a
   * handle sharing the wedge's id would shadow the wedge itself.
   */
  | 'hairpin-endpoint'
  /**
   * A TRILL — the `tr` and its wavy extension. ⚠️ ONE ENTRY PER DRAWN FRAGMENT, like the hairpin's
   * and for the same reason: a trill repeated on a continuation system registers once per system,
   * each carrying the same trill id, so either piece is clickable and a hit resolves to the whole
   * ornament. `points` are its drawn band, walked by `interactions/elements/trill.ts`.
   */
  | 'trill'
  /**
   * An OTTAVA — the octave numeral and its dashed bracket. ⚠️ ONE ENTRY PER DRAWN FRAGMENT, the
   * trill's rule and for its reason: a bracket crossing a system break registers once per system,
   * each carrying the same ottava id, so either piece is clickable and a hit resolves to the whole
   * line. `points` are its drawn band — the bbox alone would be a wide flat strip over every note
   * the line governs.
   */
  | 'ottava'
  /**
   * One of the two blue SQUARES a selected ottava draws, one beyond each end of the bracket. The
   * `'hairpin-endpoint'` above verbatim, one family and one look: registered by the HIGHLIGHT pass
   * so it exists only while its ottava is selected, removed again by `clearHighlights`, and carrying
   * `ottavaId` + `endpoint` rather than `id` for that entry's reason — {@link getById} answers with
   * the FIRST entry holding an id, and a handle sharing the bracket's would shadow the bracket.
   */
  | 'ottava-endpoint'
  /**
   * A SUSTAIN PEDAL's sign — `Ped.` or its release `✻`. ⚠️⚠️ **ONE ENTRY PER DRAWN GLYPH**, which is
   * one grain FINER than the hairpin's, trill's and ottava's per-fragment rule, and deliberately: a
   * `Ped.✻` pedal has no ink at all between its two signs, so a fragment-wide box would claim every
   * press over the music it merely passes over (*a press may only reach INK*). So an unbroken pedal
   * registers twice, and one crossing a break registers its `(Ped.)` resumptions too — every entry
   * carrying the same pedal id, so a hit on any sign resolves to the whole pedal.
   * ⭐ The day the bracket style arrives the line becomes ink and this returns to one box per
   * fragment (docs/plans/pedal-plan.md §5.3/§6.2).
   */
  | 'pedal'
  /**
   * One of the blue SQUARES a selected pedal draws, one beyond each of its two signs. The
   * `'ottava-endpoint'` above verbatim, one family and one look: registered by the HIGHLIGHT pass so
   * it exists only while its pedal is selected, removed again by `clearHighlights`, and carrying
   * `pedalId` + `endpoint` rather than `id` for that entry's reason — {@link getById} answers with
   * the FIRST entry holding an id, and a handle sharing the pedal's would shadow the signs.
   */
  | 'pedal-endpoint'
  /**
   * ⭐⭐ **THE DASHED TETHER a selected pedal draws between its two signs** — one entry per drawn
   * SEGMENT (one per system, `interactions/elements/pedalTether`).
   *
   * ⭐ **It exists so the line can be PRESSED** (his ask, 2026-08-21: *"when the pedal is selected,
   * the dashed line should be selectable too for the draging, now is invisible for the click"*).
   * ⚠️ That is not a hole in the rule *a press may only reach INK* (`elements/pedal`): while the
   * pedal is selected the tether IS ink, and it is the only ink the pair has between its signs.
   * Registered by the HIGHLIGHT pass and removed by `clearHighlights`, so it can only ever be hit
   * while it is on the page — ⛔ a pedal that is not selected still owns nothing between its signs.
   *
   * ⚠️ It carries `pedalId` rather than `id`, the endpoint squares' reason: {@link getById} answers
   * with the FIRST entry holding an id, and a tether sharing the pedal's would shadow the signs.
   */
  | 'pedal-tether'
  /**
   * One of the two blue SQUARES a selected trill draws, one beyond the `tr` and one beyond the end
   * of its wavy line. The `'pedal-endpoint'` above verbatim, one family and one look: registered by
   * the HIGHLIGHT pass so it exists only while its trill is selected, removed again by
   * `clearHighlights`, and carrying `trillId` + `endpoint` rather than `id` for that entry's
   * reason — {@link getById} answers with the FIRST entry holding an id.
   */
  | 'trill-endpoint'
  | 'accidental'
  | 'dot'
  /** ⭐ One bracket of a PARENTHESISED head — `noteId` is the head's pitch id; each of `(` and `)` its
   *  own box (`rendering/EnclosurePass`, `GracePass`). */
  | 'headEnclosure'
  | 'tuplet'
  | 'articulation'
  | 'dynamic'
  | 'tempo'
  /**
   * 🚧 One line of the SKETCHED HEADER at the top of the first page — the title or the composer,
   * its own drawn ink, registered by `rendering/ScoreHeaderPass` (read its ⛔ note first). WHICH of
   * them is {@link ElementInfo.scoreTextField}.
   *
   * ⚠️ It carries **neither `id` nor `measure`**: these are fields on `Score` and belong to no bar,
   * so there is nothing to key them by. That makes them invisible to every id-addressed consumer —
   * `playbackStart`, `pasteAnchor`, the measure-box gather — which is exactly right for something
   * outside the music, and it is why an entry exists only when the ink was actually MEASURED (jsdom
   * cannot measure text, so under the unit runner there is no entry and no hit).
   */
  | 'scoreText'

/**
 * The small ink glyphs the §6a-ii tripwire polices: each must register its OWN glyph box,
 * never a StaveNote container that unions attached modifiers. Deliberately excludes
 * `note` (keeps a semantic head box that intentionally spans its stem/beam), the region
 * click-targets (`clef`/`timeSignature`/`keySignature`/`staff`/`barline`/`beam`), the span types
 * (`tie`/`slur*`/`tuplet`), and `dynamic`/`tempo` (their own text boxes, large by design).
 */
const GLYPH_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
  'rest',
  'accidental',
  'dot',
  'articulation',
])

/**
 * Tripwire threshold in staff-spaces. A legit single glyph is ≤ a few staff-spaces tall
 * (bare rest ≈ 1, a tall mid-measure clef ≈ 4); a StaveNote unioned with a below-staff
 * dynamic is ≈ 7-8. 6 clears every legitimate glyph with daylight (docs/history/tight-bbox-plan.md
 * §6a-ii calibration note). Raise only if a real glyph ever trips it.
 */
const GLYPH_MAX_STAFF_SPACES = 6

/**
 * How far either side of a stem's own ink a click still counts (px). A stem is `Stem.WIDTH` — about
 * a pixel and a half — so its true rect is not a target anyone can hit; every hit-test here pads.
 * Kept well under half a notehead so the pad cannot reach across to a neighbouring stem.
 */
const STEM_CLICK_PAD = 5

/**
 * Bounding box in pixel coordinates
 */
interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Clef types (duplicated here to avoid circular imports)
 */
type ClefType = 'treble' | 'bass' | 'alto' | 'tenor'

/**
 * A horizontal clef region within a measure: the clef applies from `fromX`
 * rightward until the next segment. Boundaries are the measure start and each
 * mid-measure (inline) clef's X position.
 */
export interface ClefSegment {
  /** X position where this clef region begins */
  fromX: number
  /** Clef in effect from fromX onward */
  clef: ClefType
}

/**
 * One painted (system, staff): its five lines, the x its music occupies — and ⚠️ how far that
 * music's INK reaches above and below (2026-08-30), which is what a mark dragged into the white
 * space between two staves is judged against. `ElementRegistry.staffRuns`.
 */
export interface StaffRun {
  top: number
  bottom: number
  left: number
  right: number
  staff: number
  /** The run's topmost ink — its own notes and rests, stems and all. Never above `top`. */
  inkTop: number
  /** The run's lowest ink, by the same measure. Never below `bottom`. */
  inkBottom: number
}

/**
 * Staff geometry for a measure - stores actual Y positions of staff lines
 * Used for accurate pitch calculation from cursor Y position
 */
export interface StaffGeometry {
  /** Measure number (1-indexed) */
  measure: number
  /** 0-based staff index within the system (multi-staff). Absent-content resolves to
   *  0; the first staff. Together with `measure` this forms the geometry key. */
  staff: number
  /** Y positions of staff lines 0-4 (top to bottom) */
  lineYPositions: [number, number, number, number, number]
  /** Spacing between staff lines in pixels */
  lineSpacing: number
  /** X where notes can start (after clef/time sig) */
  noteStartX: number
  /** X where notes must end (before barline) */
  noteEndX: number
  /** Opening clef type for this staff */
  clef: ClefType
  /**
   * Clef regions within the measure, sorted ascending by fromX. When present,
   * pitch↔pixel conversions pick the clef of the region containing the X.
   * The first segment is the opening clef; later ones are mid-measure changes.
   */
  clefSegments?: ClefSegment[]
}

/**
 * Tuplet geometry - stores all geometrical data from VexFlow's rendered tuplet
 * Used for accurate hit detection and future engraving adjustments
 */
export interface TupletGeometry {
  // === Position (actual rendered coordinates from VexFlow) ===
  /** X position of the tuplet bracket start */
  x: number
  /** Y position of the tuplet bracket */
  y: number
  /** Width of the tuplet bracket (from first to last note) */
  width: number

  // === Bracket properties ===
  /** Whether the bracket is drawn (false for beamed notes) */
  bracketed: boolean
  /** Bracket position: 1 = above notes (TOP), -1 = below notes (BOTTOM) */
  location: 1 | -1
  /** Height of the vertical bracket legs in pixels */
  bracketLegLength: number
  /** Thickness of the bracket lines in pixels */
  bracketThickness: number
  /** Padding at the bracket ends in pixels */
  bracketPadding: number

  // === Text/number position ===
  /** X position of the center of the tuplet number (e.g., "3") */
  notationCenterX: number
  /** Vertical offset of the tuplet number text */
  textYOffset: number

  // === Offsets for manual adjustments ===
  /** Manual vertical offset applied to the tuplet */
  yOffset: number
}

/**
 * Information about a rendered element
 */
/**
 * One dashed ATTACHMENT GUIDE — a segment from a point on an ELEMENT to the thing it is attached to.
 *
 * ⭐ The two ends are not interchangeable, and the difference is what {@link ElementRegistry.shiftById}
 * turns on: `from` is ON the element and travels with it when a pass translates it; `to` is on
 * something else — a notehead, a beat's column at the staff's edge — and staying put while the
 * element is nudged away is the whole point of drawing the line.
 */
export interface GuideLine {
  /** On the element's own INK, at the corner nearest what it points at. */
  from: { x: number; y: number }
  /** What the element hangs off. ⛔ Never moved by the element's own transform. */
  to: { x: number; y: number }
}

export interface ElementInfo {
  /** Type of element */
  type: ElementType
  /** Our internal ID (for notes/rests) */
  id?: string
  /** Measure number (1-indexed) */
  measure?: number
  /** 0-based staff index within the system (multi-staff; absent = staff 0). Carried on
   *  notes/rests/geometry so a hit result knows which staff it landed on and pitch↔y
   *  resolves against that staff's own clef/lines. */
  staff?: number
  /** Beat position within measure (for notes/rests) */
  beat?: number
  /** Clef that cannot be dragged (the big line-start clef) */
  immovable?: boolean
  /** 🚧 WHICH line of the sketched header this is — set on `'scoreText'` entries and on nothing
   *  else. ⛔ Not `id`: {@link getById} answers with the first entry holding one, and 'title' is not
   *  an element id (`engine/models/scoreTextOps`). */
  scoreTextField?: ScoreTextField
  /** MIDI pitch (for notes) */
  pitch?: number
  /** Pixel bounding box */
  bbox: BoundingBox
  /**
   * True notehead-center X (for notes), from VexFlow's notehead span — EXCLUDING
   * accidentals/dots that widen the full stavenote bbox. The plain `bbox.x +
   * width/2` skews left when a note carries a left-hanging accidental (or sits in a
   * stacked voice), which misplaces the head hit-box; selection/distance use this
   * instead. Falls back to bbox center when absent.
   */
  headX?: number
  /**
   * ⭐ CROSS-STAFF — the 0-based staff this head is WRITTEN on, when that is not {@link staff}
   * (docs/plans/cross-staff-plan.md). `staff` stays the note's HOME — the lane it is edited, navigated
   * and played in; this is only where its head stands, so it is what a pitch→y question must ask:
   * ⛔ `pitchToPixelY(…, el.staff)` puts a crossed head's hit target on the staff it left.
   */
  headStaff?: number
  /**
   * ⭐⭐ **THE ATTACHMENT GUIDES** — the dashed lines a SELECTED element draws to whatever it hangs
   * off (Dorico/MuseScore style). Pure visualization: never engraved, never hit-tested, never
   * serialized. Measured HERE, at render, because both ends are facts about drawn ink; drawn by
   * `elements/anchorGuideLine.paintAnchorGuideLine`, which is the only reader.
   *
   * ⭐ **A LIST, because a SPANNER has two ends.** A dynamic, a tempo mark and a trill each attach at
   * one place and carry one line; a hairpin attaches at a start beat AND an end beat, and drawing one
   * of them would say the wedge's other end floats free. ⚠️ For a span cut across a system break the
   * lines live on the FRAGMENT they belong to — the first fragment's entry carries the start, the
   * last's the end — because two x's from different systems are not on one ruler. The drawer reads
   * every entry registered under the id, so a fragment with nothing to say simply carries none.
   *
   * ⚠️ Absent — not empty, not a guessed point — when the render could not measure an end (the
   * anchor note's bar was culled, a font the metrics cannot speak for). ⛔ A guide is never a guess.
   *
   * 🚨 **A coordinate field here has THREE handlers to satisfy**, and each was found a different way:
   * {@link offsetElement} (a translated bar), {@link ElementRegistry.shiftById} (an element moved
   * after registration — ⛔ only the `from` ends move) and {@link scaleElement} (a reduced staff).
   * See `docs/plans/dynamic-offset-plan.md`.
   */
  guides?: GuideLine[]
  // Tie-specific properties
  /** ID of the note this tie starts from (for ties) */
  fromNoteId?: string
  /** ID of the note this tie goes to (for ties) */
  toNoteId?: string
  /** Source measure number (for ties) */
  fromMeasure?: number
  /** Destination measure number (for ties) */
  toMeasure?: number
  /** Whether this is a partial tie (line break) */
  isPartial?: boolean
  /** Type of partial span: 'start' / 'end' (tie or slur), or 'middle' (a slur's
   *  full-width segment over a system it merely crosses). Informational — written
   *  for hit-test/debug parity, never switched on. */
  partialType?: 'start' | 'end' | 'middle'
  /** Curve direction this tie was drawn with (-1 up / +1 down); lets a flip read
   *  the last auto-resolved side so the first `x` press always visibly inverts it. */
  tieDirection?: number
  /**
   * Sampled points along a curved element's arc (slurs), in pixel space. Used for
   * arc-proximity hit-testing — clicking near the drawn curve, not anywhere inside
   * the (coarse) bbox rectangle that sits over the spanned notes.
   */
  points?: { x: number; y: number }[]
  // Slur-shape-editing properties (same-line slurs only; cross-system slurs omit
  // these, which automatically suppresses their handles — a split slur shares one cps).
  /** The two on-screen cubic control points (C0, C1) of a slur arc, in pixels.
   *  Drawn as draggable handles when the slur is selected (Phase 7). */
  controlPoints?: [{ x: number; y: number }, { x: number; y: number }]
  /** The slur arc's endpoint geometry, so a handle drag can invert `curveControlPoints`'
   *  control-point math (cp = f(handlePixel, endpoints)) back into pixel control-point
   *  deltas. */
  slurEndpoints?: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number }
  /** The stave's line spacing (px) where this slur was drawn. Lets a handle drag convert
   *  the new pixel shape to **staff-spaces** before storing it in the engraving-overrides
   *  compartment (so the saved shape is resolution-independent). See docs/plans/engraving-overrides-plan.md. */
  staffSpacePx?: number
  /** The side a slur was actually drawn on: -1 = above, +1 = below. Lets a flip
   *  toggle an auto-placed slur to the opposite of what's on screen. */
  slurDirection?: number
  // --- Cross-system per-segment shape (multi-system slur segment-shape plan) ---
  // A cross-system slur registers one partial PER segment; each carries its OWN
  // round-handle drag context here, distinct from `slurEndpoints` (which on a
  // cross-system slur holds the TRUE note ends for the square re-anchor handles).
  /** This segment's own arc endpoints (begin/middle/end), for the round-handle drag
   *  math. On a same-line slur this is absent and the handles use `slurEndpoints`. */
  segmentEndpoints?: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number }
  /** Which segment of a cross-system slur this is. Absent = a same-line single arc
   *  (its shape edit routes to the slur's `curveShape`, not `segmentCurveShape`). */
  segmentRole?: 'begin' | 'middle' | 'end'
  /** 0-based ordinal among MIDDLE segments (only set when `segmentRole === 'middle'`). */
  segmentOrdinal?: number
  /** Live system count (`toLine − fromLine + 1`) the segment was drawn at — the reset
   *  signature a handle drag writes into the `segmentCurveShape` override. */
  slurSpanCount?: number
  /** For a 'slur-handle' element: the slur it belongs to and which control point. */
  slurId?: string
  cpIndex?: 0 | 1
  /** For a 'slur-endpoint' handle: which end of the slur it re-anchors. Also carried by a
   *  'hairpin-endpoint' square, where it is which end of the WEDGE the press arms — by an
   *  'ottava-endpoint' square, where it is which end of the BRACKET, by a 'pedal-endpoint'
   *  square, where it is the press or the lift — and by a 'trill-endpoint' square. */
  endpoint?: 'start' | 'end'
  /** For a 'hairpin' fragment: the mouth it was DRAWN at (staff-spaces, after the automatic rule,
   *  any authored override and the steepness cap), and the drawn length that decided it. The
   *  Properties mouth control reads both — the effective value to step from, and the bound it may be
   *  typed up to. ⚠️ Facts about the last RENDER, like every other measurement here. */
  apertureSpaces?: number
  hairpinLengthSpaces?: number
  /** For a 'hairpin-endpoint' square: the wedge it belongs to. Its own field rather than `id`, so a
   *  lookup for the hairpin cannot find a handle's small box instead (the `stem` trap next door). */
  hairpinId?: string
  /** For an 'ottava-endpoint' square: the bracket it belongs to. `hairpinId`'s twin, its own field
   *  for that field's reason. */
  ottavaId?: string
  /** For a 'pedal-endpoint' square: the pedal it belongs to. `ottavaId`'s twin, same reason. */
  pedalId?: string
  /** For a 'trill-endpoint' square: the ornament it belongs to. `pedalId`'s twin, same reason. */
  trillId?: string
  /**
   * ⭐ For a 'pedal' entry: WHICH SIGN this box is — the `Ped.` that presses the damper (`'down'`,
   * and a `(Ped.)` resumption is one too) or the `✻` that lifts it (`'up'`).
   *
   * ⚠️ **It exists because this family's grain is the GLYPH, not the fragment.** Every other span
   * registers one box per drawn piece, so its two ends are coordinates OF an entry; a pedal's ends
   * are two separate MARKS, and `interactions/elements/pedalHandles` has to tell them apart to put a
   * square beyond each. ⛔ Not by counting entries: the first is the press only because a
   * resumption comes later, and the last is the release only when the cutter kept the final
   * fragment — both true today, neither a fact about pedals.
   */
  pedalSign?: 'down' | 'up'
  /**
   * ⭐ For an 'ottava' fragment: the BRACKET'S OWN AXIS on this system — the y the dashed line runs
   * at, and the x's of the fragment's ink at either end (`startX` is the numeral's left edge, not
   * the line's start; `endX` is the far edge of whichever of line and numeral reaches further).
   *
   * ⚠️ **It is not derivable from `points`, and that is why it exists.** `points` are the fragment's
   * BAND — the numeral's ink box stretched along the line — and the line does not run down its
   * middle: the bracket closes toward the staff, so an 8va's horizontal rides the numeral's TOP and
   * an 8vb's its FOOT ({@link OTTAVA_LINE_RAISE_ABOVE}). Reading the band's midpoint would put the
   * endpoint handles three quarters of a space off the line under the staff, and dead on it above —
   * a bug that looks like a one-sided mistake and is really a missing measurement.
   */
  ottavaAxis?: { y: number; startX: number; endX: number }
  /** For a 'slur-segment-endpoint' handle (the orange open-join squares): which side of a
   *  MIDDLE segment this open end is. Begin/end open joins need no side (one each). Combined
   *  with `segmentRole` + `segmentOrdinal` + `slurSpanCount` it forms the nudge address. */
  segmentSide?: 'left' | 'right'
  // Accidental-specific properties
  /** Type of accidental: '#', 'b', 'n', '##', 'bb' (for accidentals) */
  accidentalType?: string
  /** ID of the note this accidental belongs to (for accidentals) — and, for a 'dot', the ANCHOR the
   *  slot's dots hang off (see ScoreRenderer.registerDots): EVERY dot glyph of one chord/rest
   *  shares it, because `dots` is one value on the slot.
   *
   *  Also carried by a **'stem'**, for the same "one per slot" reason: a chord has one stem, anchored
   *  on the LOWEST pitch exactly as its articulations and dots are. ⚠️ A stem deliberately does NOT
   *  fill `id` — {@link getById} returns the FIRST element carrying an id, so a stem sharing its
   *  notehead's id would let a lookup for the NOTE find the stem's tall rect instead: silently, and
   *  only sometimes, depending on registration order.
   *
   *  And by a **'tremolo'**, which is one mark on the slot and rides that same stem — `id` stays
   *  empty for the same reason. */
  noteId?: string
  // Articulation-specific properties
  /** Articulation type (for articulations) */
  articulationType?: string
  // Tuplet-specific properties
  /** Tuplet ID (for tuplet brackets, or for notes/rests belonging to a tuplet) */
  tupletId?: string
  /** Start beat of the tuplet */
  startBeat?: number
  /** Number of notes in the tuplet (e.g., 3 for triplet) */
  numNotes?: number
  /** Duration of the note/rest */
  duration?: string
  /** Detailed geometry data for tuplet elements (only for type: 'tuplet') */
  tupletGeometry?: TupletGeometry
}

/**
 * ⭐ **WHERE A NOTE OR REST STANDS, for anything that asks "how far is this click from it?"** — the
 * head's own centre ({@link ElementInfo.headX}) when the entry has one, the box's centre otherwise.
 *
 * ⚠️ A note's `bbox` is VexFlow's union of every modifier, so a sharp hanging left drags its centre
 * off the head the user is looking at. A rest's box is its own glyph and it carries no `headX`, so a
 * rest answers exactly what it did before. ⭐ First reader moved off the note's union rectangle
 * (`docs/plans/own-engraving-engine.md` §5 P6) — the note-entry lookups, 2026-09-14.
 */
export function headCentreX(element: ElementInfo): number {
  return element.headX ?? element.bbox.x + element.bbox.width / 2
}

/** What {@link mapElementCoordinates} does to an x, to a y, and to a LENGTH (a width, a height, a
 *  thickness, a relative offset — anything that is ink but not a place). */
interface CoordinateMap {
  x(value: number): number
  y(value: number): number
  length(value: number): number
}

/**
 * ⭐⭐ **THE ONE WALK over every coordinate-bearing field of an {@link ElementInfo}** — what
 * {@link offsetElement} and {@link scaleElement} each spelled field by field
 * (docs/plans/code-shape-plan-2026-09-19.md, Phase 5).
 *
 * ⚠️ **A new coordinate field is taught HERE, once**, and to `EVERY_COORDINATE` in
 * `ElementRegistry.coordinates.test.ts`. A missed one does not crash and does not look wrong: it
 * makes the *hit-box* drift away from the *glyph*. 🚨 `segmentEndpoints` was missing from BOTH
 * walkers until 2026-08-17 — a cross-system slur's round handles are placed and dragged from it,
 * not from `slurEndpoints` (that one holds the true note ends, for the square re-anchor handles), so
 * a segment on a bar that moved put its handles where the bar used to be, and one on a REDUCED staff
 * put them off the arc by a factor of `k`. Found by auditing every field against the two walkers and
 * `shiftById`; the table and the reasoning are in docs/plans/dynamic-offset-plan.md.
 *
 * ⛔ **NOT {@link ElementRegistry.shiftById}**, which is no third caller: it moves the element and
 * the guides' `from` ends while the `to` ends deliberately STAY — a different statement, not a
 * different function of the same one.
 *
 * Returns a copy; the element handed in is never mutated.
 */
function mapElementCoordinates(element: ElementInfo, map: CoordinateMap): ElementInfo {
  const point = (p: { x: number; y: number }) => ({ x: map.x(p.x), y: map.y(p.y) })
  const mapped: ElementInfo = {
    ...element,
    bbox: {
      x: map.x(element.bbox.x),
      y: map.y(element.bbox.y),
      width: map.length(element.bbox.width),
      height: map.length(element.bbox.height),
    },
  }

  // True notehead-centre X — the hit-box selection actually uses (not the bbox centre).
  if (element.headX !== undefined) mapped.headX = map.x(element.headX)

  // The attachment guides (visualization only), BOTH ends of each: a bar that moves takes the
  // element AND what it is attached to with it, and a reduced staff registers in its own scaled
  // space — a line left at full-size coordinates would point off the staff it belongs to.
  if (element.guides) mapped.guides = element.guides.map(g => ({ from: point(g.from), to: point(g.to) }))

  // Sampled arc points (slur proximity hit-testing).
  if (element.points) mapped.points = element.points.map(point)

  // The ottava bracket's axis — three coordinates on the element, so all three go with it.
  if (element.ottavaAxis) {
    mapped.ottavaAxis = {
      y: map.y(element.ottavaAxis.y),
      startX: map.x(element.ottavaAxis.startX),
      endX: map.x(element.ottavaAxis.endX),
    }
  }

  // Slur handle geometry. `direction` is a SIGN, never a length, so it is carried across untouched.
  if (element.controlPoints) {
    mapped.controlPoints = [point(element.controlPoints[0]), point(element.controlPoints[1])]
  }
  if (element.slurEndpoints) {
    const e = element.slurEndpoints
    mapped.slurEndpoints = { p0: point(e.p0), p1: point(e.p1), direction: e.direction }
  }
  if (element.segmentEndpoints) {
    const e = element.segmentEndpoints
    mapped.segmentEndpoints = { p0: point(e.p0), p1: point(e.p1), direction: e.direction }
  }

  // Tuplet bracket: x/y/notationCenterX are PLACES; width and the *Offset fields are lengths —
  // a move leaves them alone, a scale takes them, since every one of them is ink.
  if (element.tupletGeometry) {
    const t = element.tupletGeometry
    mapped.tupletGeometry = {
      ...t,
      x: map.x(t.x),
      y: map.y(t.y),
      width: map.length(t.width),
      notationCenterX: map.x(t.notationCenterX),
      bracketLegLength: map.length(t.bracketLegLength),
      bracketThickness: map.length(t.bracketThickness),
      bracketPadding: map.length(t.bracketPadding),
      textYOffset: map.length(t.textYOffset),
      yOffset: map.length(t.yOffset),
    }
  }

  return mapped
}

/**
 * Translate one registered element by (dx, dy) — P5.4b, a measure that **moved** rather than
 * changed (docs/history/render-performance-plan.md §7a).
 *
 * ⚠️ **Every coordinate-bearing field must be listed here.** A missed one does not crash and does
 * not look wrong: it makes the *hit-box* drift away from the *glyph*, so clicks land on the wrong
 * thing — but only for bars that happened to move, and only by however far they moved. That is the
 * worst failure shape available, so it is not guarded by care: `incrementalRedraw.test.ts` compares
 * a *shifted* incremental render against a fresh one **field for field**, and goes red if anything
 * below is forgotten.
 *
 * Returns a copy; the captured snapshot is never mutated (see {@link ElementRegistry.addAll}).
 */
export function offsetElement(element: ElementInfo, dx: number, dy: number): ElementInfo {
  // A move leaves every LENGTH alone — widths, heights and the tuplet's relative offsets.
  return mapElementCoordinates(element, { x: v => v + dx, y: v => v + dy, length: v => v })
}

/** Translate a staff's geometry by (dx, dy). See {@link offsetElement} for the hazard. */
/**
 * Scale one registered element out of a staff's own drawing space into the SVG's — the
 * {@link ElementRegistry.withScale} half of what {@link offsetElement} does for a move
 * (docs/plans/staff-size-plan.md §4.2).
 *
 * ⚠️ **Every coordinate-bearing field must be listed here, and so must every LENGTH.** That is the
 * one way this differs from `offsetElement`, which leaves widths and heights alone: a staff drawn
 * at 0.7 has 0.7-size noteheads, so a box that keeps its full-size width is a hit-box wider than
 * its glyph. The pure-scale form (no offset term) is what building the stave at `x/k, y/k` buys —
 * see `withScale`.
 *
 * Returns a copy; the element handed in is never mutated.
 */
export function scaleElement(element: ElementInfo, k: number): ElementInfo {
  const times = (v: number) => v * k
  return mapElementCoordinates(element, { x: times, y: times, length: times })
}

/** {@link scaleElement} for a staff's own geometry. `lineSpacing` scales with the lines, which is
 *  what every pitch↔pixel consumer divides by. */
export function scaleStaffGeometry(geometry: StaffGeometry, k: number): StaffGeometry {
  return {
    ...geometry,
    lineYPositions: geometry.lineYPositions.map(y => y * k) as [number, number, number, number, number],
    lineSpacing: geometry.lineSpacing * k,
    noteStartX: geometry.noteStartX * k,
    noteEndX: geometry.noteEndX * k,
    clefSegments: geometry.clefSegments?.map(s => ({ ...s, fromX: s.fromX * k })),
  }
}

export function offsetStaffGeometry(geometry: StaffGeometry, dx: number, dy: number): StaffGeometry {
  return {
    ...geometry,
    lineYPositions: geometry.lineYPositions.map(y => y + dy) as [number, number, number, number, number],
    noteStartX: geometry.noteStartX + dx,
    noteEndX: geometry.noteEndX + dx,
    clefSegments: geometry.clefSegments?.map(s => ({ ...s, fromX: s.fromX + dx })),
  }
}

/** Diatonic step names in order C=0…B=6 */
type DiatonicStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * Registry that tracks all rendered elements
 */
export class ElementRegistry {
  private elements: ElementInfo[] = []
  /** Keyed by `(measure, staffIndex)` — see {@link geomKey}. A single measure yields one
   *  geometry per stacked staff (multi-staff); at N=1 there is just `(measure, 0)`. */
  private staffGeometries: Map<string, StaffGeometry> = new Map()

  /**
   * ⭐ The `(measure, staff)` lanes tier 2 actually **painted** this render — and so, exactly, the
   * ones a person can see.
   *
   * It exists because the registry is deliberately NOT a record of the drawing: tier 1 runs for
   * every bar in the score and registers the staff, the opening clef, the meter and the barline for
   * all of them, drawn or not, which is what keeps pixel↔position honest for music off-screen. Tier
   * 2 — the notes, and the ink — runs only inside the cull window. The gap between those two is a
   * bar with **a hit-box and nothing to look at**.
   *
   * That gap was reported from use: *"the selection is in a hidden barline and is not possible to
   * move it"*. A culled bar's barline box still answered a press, so it selected; the bar-width drag
   * then measured the room from its drawn columns, found none, and declined in silence. Selectable,
   * invisible, immovable. **A press may only reach ink**, so a hit-test asks this first.
   *
   * ⚠️ Tier-1-only facts stay available on purpose — {@link getStaffGeometry} answers for an unseen
   * bar, and must, or pitch↔pixel breaks the moment a bar scrolls out. This is the narrower
   * question, "is it *drawn*", asked only by the things a human aims at.
   */
  private painted: Set<string> = new Set()

  /**
   * ⭐⭐ **WHERE A TEMPO MARK ANCHORED AT THIS BEAT IS DRAWN** — `measure:beat` → x, filled by the
   * one function that decides it (`rendering/marks/tempo/TempoLayout.anchorX`) as each bar is drawn.
   *
   * 🚨🚨 **IT EXISTS BECAUSE TWO FUNCTIONS WERE ANSWERING ONE QUESTION**, and his report of
   * 2026-08-31 is what that costs: *"i'm moving the hand and the tempo is not moving on certain
   * occasions"*. A dragged mark is `drawn = base(anchor) + offset`, and the walk has to know `base`
   * to split the hand's travel between the two terms — but it had no way to ask, so it measured
   * NOTEHEAD to NOTEHEAD off this registry while the engraver placed the mark at *the first
   * notational element at-or-after the beat*, which at a downbeat that prints a meter is the TIME
   * SIGNATURE (LilyPond, MuseScore and Verovio all do the same; see `anchorX`). The two differ by
   * ~45 px in bar 1 of the Prelude, measured — so the offset was written from an origin the drawing
   * does not use, and the mark sat that far from the hand until the drop re-drew it.
   *
   * ⭐ So the render publishes the answer and the walk asks. ⛔ Not a copy of the rule in the
   * interactions layer: a second implementation is how the two drifted apart in the first place.
   *
   * ⚠️ Every ONSET of the bar, ⛔ not just the beats a mark sits on — the walk needs the x of the
   * stop it is moving TOWARDS, which by definition has no mark on it yet.
   */
  private tempoAnchors: Map<string, number> = new Map()

  /** Composite key for {@link staffGeometries}: a measure has one geometry per staff. */
  private geomKey(measure: number, staff: number): string {
    return `${measure}:${staff}`
  }

  /** Composite key for {@link tempoAnchors}. ⚠️ The beat as a NUMBER, matching the `beat` every
   *  other row here carries (`fracToNumber`), so a caller never has to hold a Fraction. */
  private tempoKey(measure: number, beat: number): string {
    return `${measure}:${beat}`
  }

  /**
   * The render's answer for one bar: each onset's beat and the x a tempo mark anchored there is
   * drawn at, in the staff's own space (scaled here like every other x).
   */
  registerTempoAnchors(measure: number, anchors: readonly { beat: number; x: number }[]): void {
    for (const anchor of anchors) {
      this.tempoAnchors.set(this.tempoKey(measure, anchor.beat), anchor.x * this.scale)
    }
  }

  /**
   * ⭐ Where a tempo mark anchored at `measure:beat` was drawn, or **null** when this render did not
   * draw that bar — the no-guessing rule: a caller that cannot be told must not invent a distance.
   */
  tempoAnchorX(measure: number, beat: number): number | null {
    return this.tempoAnchors.get(this.tempoKey(measure, beat)) ?? null
  }

  /**
   * ⭐⭐ **ONE BAR'S ANCHORS, SO A REUSED BAR CAN PUT THEM BACK** — {@link sliceFrom}/{@link addAll}
   * for this map, and the third site `resetPerRenderState` warns every new map about.
   *
   * 🚨🚨 **His report, 2026-08-31**: *"anchoring to notes… this is incorrect and while the hand
   * moving it gets stuck"*, with a screenshot of a mark drawn most of a bar away from the note its
   * guide line pointed at. Measured in his log: the walk crossed every stop of bar 1 and then read
   * `next m2b0/1@—` and stopped re-anchoring for good, while the offset ran to **29 staff-spaces**.
   *
   * ⭐ The cause is not the walk — its rule is his own (*"till the beginning of the ink doesn't reach
   * the next anchor point, nothing; when it reaches it, re-anchor"*) and it needs the next anchor's
   * x to test it. A bar whose shape key is unchanged is REUSED rather than redrawn
   * (`ScoreRenderer.replaySnapshot`), so `TempoLayout.registerTempoAnchors` never runs for it and
   * this map answered null for every bar but the one being edited. ⛔ Null then means *"the picture
   * cannot say"* and the walk correctly declines — for ever, because the next full render reuses
   * that bar too.
   */
  tempoAnchorsOf(measure: number): { beat: number; x: number }[] {
    const out: { beat: number; x: number }[] = []
    for (const [key, x] of this.tempoAnchors) {
      const split = key.lastIndexOf(':')
      if (Number(key.slice(0, split)) === measure) out.push({ beat: Number(key.slice(split + 1)), x })
    }
    return out
  }

  /**
   * Re-file anchors captured by {@link tempoAnchorsOf}, shifted by `dx` when the bar merely moved.
   *
   * ⛔ **Already in the page's own space, so ⛔ NOT scaled again** — the same contract as
   * {@link addAll} against {@link add}: capture happens after {@link registerTempoAnchors} has
   * applied the staff's scale, and the offset is measured from where the bar was *drawn*, so a bar
   * that moves ten times still carries one exact shift.
   */
  addTempoAnchors(measure: number, anchors: readonly { beat: number; x: number }[], dx = 0): void {
    for (const anchor of anchors) {
      this.tempoAnchors.set(this.tempoKey(measure, anchor.beat), anchor.x + dx)
    }
  }

  /**
   * Clear all stored elements (call before each render)
   */
  clear(): void {
    this.elements = []
    this.staffGeometries.clear()
    this.tempoAnchors.clear()
    this.painted.clear()
  }

  /** Tier 2 painted this lane — the renderer says so once per drawn (measure, staff). */
  markPainted(measure: number, staff: number): void {
    this.painted.add(this.geomKey(measure, staff))
  }

  /** Is there ink on screen for this lane? See {@link painted} — the question every hit-test that a
   *  human aims with has to ask, because a registered box does not imply a drawn one. */
  isPainted(measure: number, staff: number = 0): boolean {
    return this.painted.has(this.geomKey(measure, staff))
  }

  /**
   * The elements registered since {@link count} read `start` — how P5.4 captures exactly what one
   * measure contributed: read `count` before registering it, `sliceFrom(n)` after.
   *
   * Index-slicing rather than filtering by (measure, staff): a filter is O(all elements) per
   * measure, which is quadratic over the score — at orchestral scale that is the whole budget.
   * Contiguity holds because a measure is registered in one uninterrupted go.
   */
  sliceFrom(start: number): ElementInfo[] {
    return this.elements.slice(start)
  }

  /**
   * Re-register elements captured by {@link sliceFrom} — P5.4 replaying a measure it chose not to
   * redraw, shifted by (dx, dy) if the measure merely **moved** (P5.4b).
   *
   * The captured elements are never mutated: the offset is always computed against the coordinates
   * the measure was actually *drawn* at, so a bar that moves twice does not accumulate error.
   */
  addAll(elements: ElementInfo[], dx = 0, dy = 0): void {
    for (const element of elements) {
      this.elements.push(dx === 0 && dy === 0 ? element : offsetElement(element, dx, dy))
    }
  }

  /**
   * Set staff geometry for a (measure, staff) lane, in the coordinates of the staff currently
   * being registered ({@link withScale}).
   *
   * ⭐ `lineSpacing` scales with everything else, which is what makes a small staff's pitch↔pixel
   * arithmetic come out right: every consumer divides by it rather than by the score's constant.
   */
  setStaffGeometry(geometry: StaffGeometry): void {
    const scaled = this.scale === 1 ? geometry : scaleStaffGeometry(geometry, this.scale)
    this.staffGeometries.set(this.geomKey(scaled.measure, scaled.staff), scaled)
  }

  /**
   * Attach a measure's mid-measure clef regions — a **tier-2** addition to a **tier-1** record
   * (docs/history/render-performance-plan.md §7).
   *
   * The staff's geometry is registered without drawing, but an inline clef's X only exists once the
   * voice has been formatted, which is part of the draw. So a drawn measure adds its segments here,
   * on top of the geometry it already has, and an undrawn one simply never does — {@link clefAtX}
   * then falls back to the measure's opening clef, which is all a measure nobody can see needs.
   */
  setClefSegments(measure: number, staff: number, clefSegments: ClefSegment[]): void {
    const geometry = this.staffGeometries.get(this.geomKey(measure, staff))
    if (!geometry) return
    // Local X's, like everything else drawn inside the staff's group ({@link withScale}).
    geometry.clefSegments = this.scale === 1
      ? clefSegments
      : clefSegments.map(s => ({ ...s, fromX: s.fromX * this.scale }))
  }

  /**
   * Get staff geometry for a measure's staff (defaults to the first staff — the N=1 case).
   */
  getStaffGeometry(measure: number, staff: number = 0): StaffGeometry | undefined {
    return this.staffGeometries.get(this.geomKey(measure, staff))
  }

  /**
   * ⭐ The [top, bottom] LINE BAND of every staff this render painted, deduplicated by extent.
   *
   * For `engine/layout/systemBand`, which asks "what is nearest to this staff, above and below" and
   * does not care which measure or system the answer belongs to — a piano's other staff and the next
   * system's staff are both simply somebody else's room. Deduplicated because a band repeats once per
   * measure in its system, and the question is about DISTINCT staves.
   */
  /**
   * ⭐ **EVERY STAFF THIS RENDER MEASURED**, live entries, in registration order — for a reader that
   * has a POINT and needs the row it belongs to, which no measure number can answer for a mark drawn
   * under a system it does not name (`interactions/elements/pedalTether`, 2026-08-21: a pedal's
   * glyphs all carry the FIRST fragment's measure).
   *
   * ⛔ Not a copy: the caller must not mutate what it gets, exactly as with {@link getStaffGeometry}.
   */
  allStaffGeometries(): StaffGeometry[] {
    return [...this.staffGeometries.values()]
  }

  staffBands(): { top: number; bottom: number }[] {
    const seen = new Map<string, { top: number; bottom: number }>()
    for (const g of this.staffGeometries.values()) {
      const band = { top: g.lineYPositions[0], bottom: g.lineYPositions[4] }
      seen.set(`${band.top}:${band.bottom}`, band)
    }
    return [...seen.values()]
  }

  /**
   * 🚨🚨 **ONE ENTRY PER (SYSTEM, STAFF), WITH THE X IT OCCUPIES** — what {@link staffBands} cannot
   * say, and the difference is a whole sheet wide.
   *
   * **His report, 2026-08-30** (the Prelude, 35 bars): dragging a hairpin — and an octave line, and
   * *"i suppose other lines too"* — made the mark vanish. It had teleported onto **another page**:
   * `PagePass` draws the sheets SIDE BY SIDE, so page 2's third system shares page 1's third
   * system's row, and a band keyed by its y-range alone folds them into one. The jump then chose
   * "the nearest candidate on that band" from a row whose only members were on the next sheet:
   * measured, one such band held notes from x 1382…2607 while his cursor was at 334.
   *
   * ⭐⭐ **A SYSTEM IS THE CONTIGUOUS RUN OF BARS THAT SHARE THE ROW** — the law
   * `markBreakWrap.systemInkAt` already states, and which the trill's ribbon was repaired with on
   * 2026-08-24 (`ac9fc12`, *"two sheets side by side put two systems on the same row"*). The bands
   * never got it. Contiguity is what the y alone cannot say: between two same-y systems lie the bars
   * of the lines in between, so the run stops at the break — on this page or the next.
   *
   * ⚠️ {@link staffBands} is NOT this and keeps its own meaning: `MusicEngine.nudgeStaysInBand` and
   * `layout/systemBand` ask *"what other staff is nearest, above and below"* and deliberately do not
   * care whose system it is. Two questions, two readers — ⛔ do not merge them.
   */
  staffRuns(): StaffRun[] {
    const byStaff = new Map<number, StaffGeometry[]>()
    for (const g of this.staffGeometries.values()) {
      const list = byStaff.get(g.staff)
      if (list) list.push(g)
      else byStaff.set(g.staff, [g])
    }
    type Building = StaffRun & { first: number; last: number }
    const runs: Building[] = []
    for (const [staff, geometries] of byStaff) {
      geometries.sort((a, b) => a.measure - b.measure)
      let run: Building | null = null
      let previousMeasure = 0
      for (const g of geometries) {
        const top = g.lineYPositions[0]
        const bottom = g.lineYPositions[4]
        // A new run when the row changes, or when a bar is MISSING between this and the last — an
        // undrawn bar ends a run for `systemInkAt`'s reason, and so does a jump to the next sheet.
        if (!run || run.top !== top || run.bottom !== bottom || g.measure !== previousMeasure + 1) {
          run = {
            top, bottom, left: g.noteStartX, right: g.noteEndX, staff,
            // ⭐ The five lines are the FLOOR of a run's ink: a staff with no music at all still
            // occupies itself, so no reader has to special-case an empty system.
            inkTop: top, inkBottom: bottom, first: g.measure, last: g.measure,
          }
          runs.push(run)
        } else {
          run.left = Math.min(run.left, g.noteStartX)
          run.right = Math.max(run.right, g.noteEndX)
          run.last = g.measure
        }
        previousMeasure = g.measure
      }
    }

    // ⭐⭐ **HOW FAR THE RUN'S OWN MUSIC REACHES**, stems and beams and ledger lines included: a
    // registered note's box is the whole `StaveNote`'s. ⛔ Notes and rests ONLY — never a mark's box,
    // or a dragged bracket carries the boundary with it and can never leave the staff it is over
    // (2026-08-30).
    for (const el of [...this.getByType('note'), ...this.getByType('rest')]) {
      if (el.measure === undefined) continue
      const measure = el.measure
      const run = runs.find(r => r.staff === (el.staff ?? 0) && measure >= r.first && measure <= r.last)
      if (!run) continue
      run.inkTop = Math.min(run.inkTop, el.bbox.y)
      run.inkBottom = Math.max(run.inkBottom, el.bbox.y + el.bbox.height)
    }
    return runs
  }

  /**
   * Which staff (0-based index) does a click Y fall on, within a measure? Picks the staff
   * whose lines are vertically nearest the click (by distance to the staff's [top,bottom]
   * band, so a click in the gap between two staves resolves to the closer one, and a click
   * on ledger lines above/below still resolves to its own staff). Falls back to 0 when the
   * measure has no registered geometry. At N=1 there is one staff, so this always returns 0.
   */
  /**
   * ⭐ The STAFF under a pointer — the geometry whose bar spans `x` (a little past its note area either
   * side) and whose lines are vertically nearest `y` — or null off every staff. What a tool ghost that
   * previews a PITCH stands on (the grace stamp's: its snapped line, its ledger lines).
   */
  staffGeometryAt(x: number, y: number): StaffGeometry | null {
    let best: StaffGeometry | null = null
    let bestDist = Infinity
    for (const g of this.staffGeometries.values()) {
      const pad = 2 * g.lineSpacing
      if (x < g.noteStartX - pad || x > g.noteEndX + pad) continue
      const top = g.lineYPositions[0]
      const bottom = g.lineYPositions[4]
      const dist = y < top ? top - y : y > bottom ? y - bottom : 0
      if (dist < bestDist) {
        bestDist = dist
        best = g
      }
    }
    return best
  }

  staffIndexAtY(measure: number, y: number): number {
    let best = 0
    let bestDist = Infinity
    for (const g of this.staffGeometries.values()) {
      if (g.measure !== measure) continue
      const top = g.lineYPositions[0]
      const bottom = g.lineYPositions[4]
      // Distance from y to the staff's line band (0 when inside it).
      const dist = y < top ? top - y : y > bottom ? y - bottom : 0
      if (dist < bestDist) {
        bestDist = dist
        best = g.staff
      }
    }
    return best
  }

  /**
   * The scale of the staff whose ink is being registered right now — 1 outside {@link withScale}.
   * See that method for why this is state rather than a parameter.
   */
  private scale = 1

  /**
   * **Register everything `fn` produces in the coordinates of a staff drawn at `k`.**
   *
   * A staff drawn small is drawn inside a `<g transform="scale(k)">` (docs/plans/staff-size-plan.md §4.1),
   * so everything VexFlow reports back — `getYForLine`, `getNoteStartX`, `getBoundingBox`,
   * `getBBox` — answers in the group's own PRE-transform space, while every consumer of this
   * registry (hit-testing, pixel↔pitch, scroll-into-view) works in the SVG's. The two differ by
   * exactly `k`, because the stave is built at `x/k, y/k, width/k` so that the scale is a pure
   * multiplication about the origin with no offset term.
   *
   * ⭐ **One seam, so no call site changes.** There are ~30 `add` sites across seven modules; each
   * would otherwise have to learn which staff it is on and multiply. Instead the renderer wraps the
   * work for one (measure, staff) and every registration inside it lands in SVG coordinates. It is
   * scoped state rather than a parameter for the same reason a graphics context has a transform:
   * the code in between does not want to know.
   *
   * ⚠️ It restores on the way out, exceptions included — a leaked scale would silently multiply the
   * rest of the score.
   */
  withScale<T>(k: number, fn: () => T): T {
    const previous = this.scale
    this.scale = k
    try {
      return fn()
    } finally {
      this.scale = previous
    }
  }

  /**
   * Add an element to the registry, in the coordinates of the staff currently being registered
   * ({@link withScale} — a no-op at full size).
   */
  add(element: ElementInfo): void {
    const scaled = this.scale === 1 ? element : scaleElement(element, this.scale)
    this.checkGlyphHeight(scaled)
    this.elements.push(scaled)
  }

  /**
   * Move an already-registered element by a delta measured in the **local** (pre-transform) space
   * the ink was drawn in — the twin of {@link add} under the same transform.
   *
   * For the passes that draw a glyph and *then* nudge it with an SVG `translate` (a co-located
   * dynamic, a hand-offset one): the translate rides inside the scaled group, so it is a local
   * delta, while the registry's box is already global. Adding one to the other is off by exactly
   * `k` — the mixing §4.2 of the plan names, and the reason this is a method rather than two
   * hand-written `entry.bbox.x + dx` at the call sites.
   */
  shiftById(id: string, dx: number, dy: number): void {
    const entry = this.getById(id)
    if (!entry) return
    entry.bbox = {
      x: entry.bbox.x + dx * this.scale,
      y: entry.bbox.y + dy * this.scale,
      width: entry.bbox.width,
      height: entry.bbox.height,
    }
    // ⭐⭐ Anything else that is a point ON THE ELEMENT moves with it — every guide's `from` end.
    // Forgetting it is invisible until you look: the box moved onto the dynamics line while the
    // guide stayed where VexFlow first dropped the mark, so the line pointed at a place the mark had
    // left. Found by the browser test, because every mark in jsdom sits at 0.
    // ⛔ NOT the `to` ends: those are points on a NOTEHEAD or a staff edge, and the whole purpose of
    // the guide is to keep showing them while the element is moved away.
    if (entry.guides) {
      entry.guides = entry.guides.map(g => ({
        from: { x: g.from.x + dx * this.scale, y: g.from.y + dy * this.scale },
        to: g.to,
      }))
    }
  }

  /**
   * ⭐⭐ **MOVE THE `to` ENDS — the one thing {@link shiftById} may never do, for the one reason it
   * may be done: the element changed WHAT IT HANGS OFF.**
   *
   * 🚨 His report, 2026-08-31, on the tempo mark's new snap drag: *"the anchor line is not updating
   * during the drag"*. A preview may only rewrite a mark's transform, and that is `shiftById`'s
   * whole world — the box and the guides' `from` ends. Correct for a NUDGE, where the far end
   * staying put is the guide's entire point. ⛔ Wrong for a RE-ANCHOR: the drag hands the mark to the
   * next onset, so the place it points at genuinely moved, and a line still drawn to the old one is
   * saying something false about the model.
   *
   * ⚠️ **`dx` is the ANCHOR's travel, ⛔ not the element's** — the two differ by whatever offset the
   * mark carries, and passing the element's would drag the far end along with the ink and turn the
   * guide into a stick of constant length. Local (pre-transform) pixels, exactly like
   * {@link shiftById}, so the caller does not have to know the staff's scale.
   */
  repointGuidesById(id: string, dx: number, dy = 0): void {
    const entry = this.getById(id)
    if (!entry?.guides) return
    entry.guides = entry.guides.map(g => ({
      from: g.from,
      to: { x: g.to.x + dx * this.scale, y: g.to.y + dy * this.scale },
    }))
  }

  /**
   * Register a GLYPH element by its OWN VexFlow object's ink box (docs/history/tight-bbox-plan.md §6a).
   *
   * Pass the LEAF glyph — a `NoteHead`, `Accidental`, `Articulation`, `Dot`, `Clef` — never a
   * `StaveNote` container: `StaveNote.getBoundingBox()` unions every attached modifier into its own
   * box, and our dynamics are attached `Annotation`s, so a rest/note carrying a dynamic would
   * register a box reaching all the way down to the dynamic's ink and steal its clicks. This is the
   * one choke point that keeps that container-union box out of every glyph registration site.
   *
   * Carve-outs that legitimately do NOT go through here: notes/chords (hit-tested semantically off
   * the notehead, §4a — they keep the union box + `headX`), the region types (line-start clef, time
   * signature, stave, barline — hand-built rects they WANT), and dynamics/tempo (own ink rebuild).
   *
   * ⭐ It lives HERE, not on the renderer, because the renderer is no longer the only place that
   * registers a glyph — {@link FanPass} draws and registers its own noteheads (Phase 6a). It is
   * structurally typed on `getBoundingBox()`, so this file still imports nothing from VexFlow, and
   * it now sits beside {@link checkGlyphHeight}, the tripwire for the very bug it prevents.
   *
   * @returns whether an element was registered (false when the glyph has no box yet — pre-draw).
   */
  addGlyph(
    glyph: { getBoundingBox(): { x: number; y: number; w: number; h: number } | undefined },
    info: Omit<ElementInfo, 'bbox'>,
  ): boolean {
    const b = glyph.getBoundingBox()
    if (!b) return false
    this.add({ ...info, bbox: { x: b.x, y: b.y, width: b.w, height: b.h } })
    return true
  }

  /**
   * The RESULT tripwire (docs/history/tight-bbox-plan.md §6a-ii) — the forever version of the
   * Phase 0 audit. A single glyph is at most a few staff-spaces tall; a StaveNote box
   * that has unioned an attached modifier (a rest carrying a below-staff dynamic, say) is
   * ~7-8. So if a *glyph-type* box measures taller than {@link GLYPH_MAX_STAFF_SPACES}
   * staff-spaces, some caller handed us a container-union box instead of the leaf glyph —
   * exactly the bug {@link addGlyph} above exists to prevent. This guard catches a *future*
   * element that reintroduces it.
   *
   * Dev-only (jsdom has no canvas metrics, so this never fires under unit tests; `dbg` is
   * a NOOP in prod). It reasons purely about numbers — no VexFlow coupling — using the
   * `lineSpacing` the registry already holds. Region types (clef/timeSignature/staff/…)
   * are large by design and exempt; only the small ink glyphs are checked.
   */
  private checkGlyphHeight(element: ElementInfo): void {
    if (!GLYPH_TYPES.has(element.type) || element.measure === undefined) return
    const spacing = this.getStaffGeometry(element.measure, staffOf(element))?.lineSpacing
    if (!spacing) return // no geometry yet → can't reason about scale; skip silently
    const staffSpaces = element.bbox.height / spacing
    if (staffSpaces > GLYPH_MAX_STAFF_SPACES) {
      dbg(
        `⚠️ [hit-box] ${element.type} ${element.id} is ${staffSpaces.toFixed(1)} staff-spaces tall ` +
          `(> ${GLYPH_MAX_STAFF_SPACES}) — likely registered from a container-union box, not its own ` +
          `glyph. Route it through ElementRegistry.addGlyph (docs/history/tight-bbox-plan.md §6a).`,
      )
    }
  }

  /**
   * Drop every element of a type. Needed by the highlight layer: it registers its own
   * hit-boxes (slur handles) *after* the render, and those used to be wiped by the next
   * render's `clear()`. Once a render can be skipped (docs/history/render-performance-plan.md §5a),
   * the highlight pass must remove its own entries instead, or they accumulate.
   */
  removeByType(type: ElementType): void {
    this.elements = this.elements.filter(el => el.type !== type)
  }

  /**
   * Get all registered elements
   */
  getAll(): ElementInfo[] {
    return this.elements
  }

  /**
   * Find element at a specific pixel coordinate
   * Returns the topmost (last added) element if multiple overlap
   */
  getAt(x: number, y: number): ElementInfo | null {
    // Search in reverse order (last added = on top)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i]
      const b = el.bbox
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return el
      }
    }
    return null
  }

  /**
   * Find element by its ID (for notes/rests)
   */
  getById(id: string): ElementInfo | null {
    return this.elements.find(el => el.id === id) || null
  }

  /**
   * Get all elements in a specific measure
   */
  getByMeasure(measure: number): ElementInfo[] {
    return this.elements.filter(el => el.measure === measure)
  }

  /**
   * Get all elements of a specific type
   */
  getByType(type: ElementType): ElementInfo[] {
    return this.elements.filter(el => el.type === type)
  }

  /**
   * Get count of registered elements
   */
  get count(): number {
    return this.elements.length
  }

  // ==================== Pitch Calculation ====================

  /**
   * Clef reference data: which pitch sits on which staff line
   * Staff lines are numbered 0-4 from top to bottom
   */
  private static readonly CLEF_REFERENCES: Record<ClefType, { pitch: number; line: number }> = {
    // Treble (G clef): G4 (67) on line 3 (second from bottom)
    treble: { pitch: 67, line: 3 },
    // Bass (F clef): F3 (53) on line 1 (second from top)
    bass: { pitch: 53, line: 1 },
    // Alto (C clef): C4 (60) on line 2 (middle)
    alto: { pitch: 60, line: 2 },
    // Tenor (C clef): C4 (60) on line 1 (second from top)
    tenor: { pitch: 60, line: 1 },
  }

  /**
   * Pick the clef in effect at a given X within a measure. Uses clef segments
   * (mid-measure changes) when present and an X is supplied; otherwise the
   * measure's opening clef.
   *
   * Public because the linear-view gutter asks the same question the pitch math does —
   * "which clef is in force at this X?" — and must answer it identically, mid-measure
   * changes included.
   */
  clefAtX(geometry: StaffGeometry, x?: number): ClefType {
    if (x === undefined || !geometry.clefSegments?.length) return geometry.clef
    let clef = geometry.clefSegments[0].clef
    for (const seg of geometry.clefSegments) {
      if (x >= seg.fromX) clef = seg.clef
      else break
    }
    return clef
  }

  /**
   * Convert pixel Y coordinate to a natural PitchSpelling (alter=0) using staff geometry.
   * @param y - Pixel Y coordinate
   * @param measure - Measure number to get staff geometry from
   * @param x - Optional pixel X, used to pick the clef region for mid-measure changes
   * @param staff - 0-based staff index (default first staff); resolves pitch against that
   *   staff's own clef and line positions.
   * @returns PitchSpelling (always natural), or null if geometry not available
   */
  pixelYToPitch(y: number, measure: number, x?: number, staff: number = 0): PitchSpelling | null {
    const geometry = this.staffGeometries.get(this.geomKey(measure, staff))
    if (!geometry) return null

    const clef = this.clefAtX(geometry, x)

    // Which staff line the y is on — asked of the frame, the one owner of that inverse (rule 5)
    const staffLine = staffLineAtY(geometryFrame(geometry), y)

    // Convert staff line to MIDI pitch using clef-aware calculation, then to spelling
    const midi = this.staffLineToPitch(staffLine, clef)
    // Degenerate geometry (e.g. zero line spacing) yields a non-finite MIDI, which
    // would produce an undefined step. Return null so callers fall back.
    if (!Number.isFinite(midi)) return null
    const clampedMidi = Math.max(21, Math.min(108, midi))

    // midiToSpelling with no hint gives natural (sharp) spelling;
    // since we only produce natural notes here, just compute step+octave from MIDI
    const pc = clampedMidi % 12
    const oct = Math.floor(clampedMidi / 12) - 1
    const WHITE_KEY_PC_TO_STEP: Partial<Record<number, DiatonicStep>> = {
      0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B',
    }
    const step = WHITE_KEY_PC_TO_STEP[pc]
    if (step) {
      return { step, alter: 0, octave: oct }
    }
    // Fell on a black key — snap to nearest white key below
    const snappedPc = [0, 0, 2, 2, 4, 5, 5, 7, 7, 9, 9, 11][pc]
    const snappedStep = WHITE_KEY_PC_TO_STEP[snappedPc]!
    return { step: snappedStep, alter: 0, octave: oct }
  }

  /**
   * Convert MIDI pitch to pixel Y coordinate using staff geometry
   * @param pitch - MIDI pitch number
   * @param measure - Measure number to get staff geometry from
   * @param x - Optional pixel X, used to pick the clef region for mid-measure changes
   * @param staff - 0-based staff index (default first staff)
   * @returns Pixel Y coordinate, or null if geometry not available
   */
  pitchToPixelY(pitch: number, measure: number, x?: number, staff: number = 0): number | null {
    const geometry = this.staffGeometries.get(this.geomKey(measure, staff))
    if (!geometry) return null

    const clef = this.clefAtX(geometry, x)
    const staffLine = this.pitchToStaffLine(pitch, clef)

    return staffLineY(geometryFrame(geometry), staffLine)
  }

  /**
   * Get the diatonic pitch class (0-6 for C-B) from a MIDI pitch
   */
  private getDiatonicClass(pitch: number): number {
    // MIDI pitch to pitch class (0-11), then to diatonic class (0-6)
    const pitchClass = pitch % 12
    // Map: C=0, D=1, E=2, F=3, G=4, A=5, B=6
    // Chromatic to diatonic: 0->0, 1->0, 2->1, 3->1, 4->2, 5->3, 6->3, 7->4, 8->4, 9->5, 10->5, 11->6
    const chromaticToDiatonic = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
    return chromaticToDiatonic[pitchClass]
  }

  /**
   * Get the octave number from a MIDI pitch
   */
  private getOctave(pitch: number): number {
    return Math.floor(pitch / 12) - 1
  }

  /**
   * Calculate diatonic steps between two pitches
   * Positive = pitch2 is higher, negative = pitch2 is lower
   */
  private getDiatonicDistance(pitch1: number, pitch2: number): number {
    const octave1 = this.getOctave(pitch1)
    const octave2 = this.getOctave(pitch2)
    const class1 = this.getDiatonicClass(pitch1)
    const class2 = this.getDiatonicClass(pitch2)

    // Total diatonic steps = octave difference * 7 + class difference
    return (octave2 - octave1) * 7 + (class2 - class1)
  }

  /**
   * Convert staff line position to MIDI pitch (clef-aware)
   * Each half-line is one diatonic step
   * @param staffLine - Staff line position (0-4 for lines, 0.5, 1.5, etc. for spaces)
   * @param clef - The clef type
   */
  private staffLineToPitch(staffLine: number, clef: ClefType): number {
    const ref = ElementRegistry.CLEF_REFERENCES[clef]

    // Round to nearest half-line for diatonic snapping
    const roundedLine = Math.round(staffLine * 2) / 2

    // Calculate diatonic steps from reference
    // Moving DOWN the staff (increasing line number) = LOWER pitch
    const diatonicStepsFromRef = (roundedLine - ref.line) * 2

    // Convert diatonic steps to pitch
    return this.addDiatonicSteps(ref.pitch, -diatonicStepsFromRef)
  }

  /**
   * Convert MIDI pitch to staff line position (clef-aware)
   * @param pitch - MIDI pitch number
   * @param clef - The clef type
   */
  private pitchToStaffLine(pitch: number, clef: ClefType): number {
    const ref = ElementRegistry.CLEF_REFERENCES[clef]

    // Calculate diatonic distance from reference pitch
    const diatonicSteps = this.getDiatonicDistance(ref.pitch, pitch)

    // Convert to staff lines (2 diatonic steps per line, higher pitch = lower line number)
    return ref.line - diatonicSteps / 2
  }

  /**
   * Add diatonic steps to a pitch
   * @param pitch - Starting MIDI pitch
   * @param steps - Number of diatonic steps (positive = up, negative = down)
   */
  private addDiatonicSteps(pitch: number, steps: number): number {
    // Diatonic intervals in semitones from each pitch class
    // Starting from C: C->D=2, D->E=2, E->F=1, F->G=2, G->A=2, A->B=2, B->C=1
    const intervals = [2, 2, 1, 2, 2, 2, 1] // intervals from C, D, E, F, G, A, B

    let currentPitch = pitch
    const direction = steps > 0 ? 1 : -1
    const absSteps = Math.abs(steps)

    for (let i = 0; i < absSteps; i++) {
      const currentClass = this.getDiatonicClass(currentPitch)

      if (direction > 0) {
        // Moving up: add interval from current class
        currentPitch += intervals[currentClass]
      } else {
        // Moving down: subtract interval to previous class
        const prevClass = (currentClass + 6) % 7 // Previous diatonic class
        currentPitch -= intervals[prevClass]
      }
    }

    return currentPitch
  }

  // ==================== Nearby Element Finding ====================

  /**
   * Find the nearest note or rest to a given X position within a measure
   * Used for beat snapping when placing new notes
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @returns The nearest note/rest element, or null if none found
   */
  findNearestNoteOrRest(x: number, measure: number, staff?: number): ElementInfo | null {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
        && (staff === undefined || staffOf(el) === staff)
    )

    if (notesAndRests.length === 0) return null

    let nearest: ElementInfo | null = null
    let minDistance = Infinity

    for (const el of notesAndRests) {
      const distance = Math.abs(x - headCentreX(el))
      if (distance < minDistance) {
        minDistance = distance
        nearest = el
      }
    }

    return nearest
  }

  /**
   * Convert a pixel X to a beat within a measure, by **interpolating between the columns actually
   * drawn** rather than dividing the bar evenly.
   *
   * `CoordinateMapper.pixelXToBeat` answers the same question with one straight line across the
   * note area — `(relativeX / usableWidth) * barQuarters`. That is only right when time and space
   * are proportional in the bar, and they essentially never are: VexFlow gives a quarter note more
   * room than an eighth, so in `♩ ♪ ♪ ♪` the halfway pixel is nowhere near halfway through the
   * bar. User-authored spacing (client #10) widens the same error deliberately — a column can be
   * anywhere its author put it. Under the straight line, pointing at a note could resolve to a
   * beat that belongs to its neighbour.
   *
   * So the drawn notes and rests ARE the mapping: each is an (x, beat) anchor, and a pixel between
   * two of them is interpolated in the time between their beats. Pointing at a column returns that
   * column's beat exactly; pointing between two returns something honestly in between; past the
   * last one the barline (`noteEndX` ↔ `barQuarters`) closes the run. Interpolation and not
   * snapping, because entry has to be able to name a beat that holds no note yet — an empty bar
   * carries a single whole rest, and you must still be able to aim at its beat 3.
   *
   * Scoped to one staff, because the anchors are: staves share a barline, not a rhythm.
   *
   * Rounded to the quarter beat, as the mapper's version is — this is the last word for the
   * public `pixelToPosition`, which applies no duration quantization of its own.
   *
   * @returns null when this measure has nothing drawn on that staff (culled, or not yet rendered),
   * so the caller can fall back rather than be handed a made-up beat.
   */
  pixelXToBeat(x: number, measure: number, barQuarters: number, staff: number = 0): number | null {
    const anchors: { x: number; beat: number }[] = []
    for (const el of this.elements) {
      if (el.measure !== measure || staffOf(el) !== staff) continue
      if ((el.type !== 'note' && el.type !== 'rest') || el.beat === undefined) continue
      // The notehead's own centre — `headX` where we have it, since the full bbox is widened by
      // accidentals and dots that hang to the left of the column the beat actually sits at.
      const cx = el.headX ?? el.bbox.x + el.bbox.width / 2
      const seen = anchors.find(a => a.beat === el.beat)
      if (seen) seen.x = Math.min(seen.x, cx) // chord tones / voices share one column
      else anchors.push({ x: cx, beat: el.beat })
    }
    if (anchors.length === 0) return null

    anchors.sort((a, b) => a.x - b.x)
    // Close the run at the barline so the space after the last note maps to the rest of the bar
    // instead of collapsing onto that note's beat.
    const endX = this.getStaffGeometry(measure, staff)?.noteEndX
    if (endX !== undefined && endX > anchors[anchors.length - 1].x) anchors.push({ x: endX, beat: barQuarters })

    const quarter = (beat: number) => Math.round(beat * 4) / 4
    if (x <= anchors[0].x) return quarter(anchors[0].beat)
    const last = anchors[anchors.length - 1]
    if (x >= last.x) return quarter(last.beat)

    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1]
      const b = anchors[i]
      if (x > b.x) continue
      const span = b.x - a.x
      if (span <= 0) return quarter(a.beat)
      return quarter(a.beat + ((x - a.x) / span) * (b.beat - a.beat))
    }
    return quarter(last.beat)
  }

  /**
   * Find the closest note to a given X,Y position
   * Used for selecting specific notes in chords
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @param measure - Measure number
   * @param xTolerance - Max X distance in pixels (default 30)
   * @returns The closest note element, or null if none found
   */
  findClosestNote(x: number, y: number, measure: number, xTolerance: number = 30): ElementInfo | null {
    const notes = this.elements.filter(
      el => el.measure === measure && el.type === 'note'
    )

    if (notes.length === 0) return null

    let closest: ElementInfo | null = null
    let minDistance = Infinity

    for (const note of notes) {
      const centerX = headCentreX(note)
      const xDist = Math.abs(x - centerX)

      // Only consider notes within X tolerance
      if (xDist <= xTolerance) {
        // For chords, notes share the same bbox but have different pitches
        // Use pitch-based Y position for accurate selection
        let noteY: number
        if (note.pitch !== undefined) {
          // Calculate actual Y position from pitch using staff geometry (clef region at the note's X)
          const pitchY = this.pitchToPixelY(note.pitch, measure, centerX, note.headStaff ?? note.staff)
          noteY = pitchY !== null ? pitchY : note.bbox.y + note.bbox.height / 2
        } else {
          noteY = note.bbox.y + note.bbox.height / 2
        }

        // Use Euclidean distance for selection
        const distance = Math.sqrt(xDist ** 2 + (y - noteY) ** 2)

        if (distance < minDistance) {
          minDistance = distance
          closest = note
        }
      }
    }

    return closest
  }

  /**
   * Find the closest note or rest to a given X,Y position, searching ALL measures.
   * Used for selecting notes and rests in selection mode.
   *
   * Selection must not be scoped to the click's vertical staff band: a note whose
   * head is drawn far from its staff (ledger lines) is rendered into a neighbouring
   * band, so a measure-restricted search would exclude the real note (the "too far
   * from element" bug). Instead we scan every note/rest, compute each one's TRUE
   * rendered Y from its OWN measure's geometry (clef-aware pitchToPixelY), and take
   * the nearest within an X tolerance. Notes on other systems are excluded naturally:
   * their pixel Y is a system-height away, so the Euclidean distance is large.
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @param xTolerance - Max X distance in pixels (default 30)
   * @returns The closest note/rest element, or null if none found
   */
  findClosestNoteOrRest(x: number, y: number, xTolerance: number = 30): ElementInfo | null {
    const elements = this.elements.filter(
      el => el.type === 'note' || el.type === 'rest'
    )

    if (elements.length === 0) return null

    let closest: ElementInfo | null = null
    let minDistance = Infinity

    for (const element of elements) {
      const centerX = (element.type === 'note' ? element.headX : undefined)
        ?? element.bbox.x + element.bbox.width / 2
      const xDist = Math.abs(x - centerX)

      // Only consider elements within X tolerance
      if (xDist <= xTolerance) {
        let elementY: number

        if (element.type === 'note' && element.pitch !== undefined && element.measure !== undefined) {
          // For notes (incl. chords), use the pitch-based Y position computed from the
          // note's OWN (measure, staff) geometry (clef region at the note's X).
          const pitchY = this.pitchToPixelY(element.pitch, element.measure, centerX, element.headStaff ?? element.staff)
          elementY = pitchY !== null ? pitchY : element.bbox.y + element.bbox.height / 2
        } else {
          // For rests (and notes without pitch), use bbox center
          elementY = element.bbox.y + element.bbox.height / 2
        }

        // Use Euclidean distance for selection
        const distance = Math.sqrt(xDist ** 2 + (y - elementY) ** 2)

        if (distance < minDistance) {
          minDistance = distance
          closest = element
        }
      }
    }

    return closest
  }

  /**
   * Euclidean click→element distance using the SAME geometry as
   * {@link findClosestNoteOrRest}: a note's clef-aware pitch Y (from its own measure)
   * and bbox center X; bbox center for rests. Exposed so callers can compare a note's
   * hit distance against a neighbouring glyph (e.g. an articulation sitting on the
   * note head) and pick whichever the click is actually closest to.
   */
  noteOrRestHitDistance(el: ElementInfo, x: number, y: number): number {
    const centerX = el.headX ?? el.bbox.x + el.bbox.width / 2
    let elementY: number
    if (el.type === 'note' && el.pitch !== undefined && el.measure !== undefined) {
      const pitchY = this.pitchToPixelY(el.pitch, el.measure, centerX, el.headStaff ?? el.staff)
      elementY = pitchY !== null ? pitchY : el.bbox.y + el.bbox.height / 2
    } else {
      elementY = el.bbox.y + el.bbox.height / 2
    }
    return Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)
  }

  /**
   * Does (x, y) land on a note/rest's actual clickable body (not just "near" it)?
   * Used to gate selection so clicking the empty staff space around a note — e.g. a
   * space below it, where the user is really aiming to pan — doesn't grab the note.
   *
   * - Notes: a box around the NOTE HEAD. Center X = bbox center, center Y = the
   *   clef-aware pitch Y (the head's true vertical position, even on ledger lines).
   *   Half-extents are scaled to the staff's line spacing (a head is ≈ one space tall
   *   and a little wider), plus a small click margin. This deliberately ignores the
   *   stem, whose tall bbox is what made the old radius feel so over-eager.
   * - Rests / pitchless notes: inside the glyph bbox plus a small pad (the rest bbox
   *   already hugs the glyph).
   */
  /**
   * ⭐⭐ **THE NOTE OR REST WHOSE OWN INK IS UNDER (x, y)** — nearest AND actually hit, which is the
   * pair every spanner stamp asks for: a mark that attaches to an existing event must land ON one,
   * ⛔ never merely near one (`interactions/stamps/slurStamp` and its five siblings; the paste click for a
   * slur, 2026-08-20 — *"for slurring a note we should be really close to the bbox of that note"*).
   *
   * ⭐ The two calls were written out six times before this; they are one question.
   */
  noteOrRestAtBody(x: number, y: number): ElementInfo | null {
    const el = this.findClosestNoteOrRest(x, y)
    return el && this.hitsNoteOrRestBody(el, x, y) ? el : null
  }

  hitsNoteOrRestBody(el: ElementInfo, x: number, y: number): boolean {
    // Prefer the true notehead-center X (excludes a left-hanging accidental that
    // would otherwise skew the bbox center and misplace the head hit-box).
    const centerX = el.headX ?? el.bbox.x + el.bbox.width / 2
    if (el.type === 'note' && el.pitch !== undefined && el.measure !== undefined) {
      const pitchY = this.pitchToPixelY(el.pitch, el.measure, centerX, el.headStaff ?? el.staff)
      if (pitchY !== null) {
        const sp = this.getStaffGeometry(el.measure, el.headStaff ?? el.staff)?.lineSpacing ?? 10
        const halfW = sp * 1.1 // head ≈ 1.3 spaces wide + click margin
        const halfH = sp * 0.9 // head ≈ 1 space tall + click margin (< one full space)
        return Math.abs(x - centerX) <= halfW && Math.abs(y - pitchY) <= halfH
      }
    }
    const pad = 4
    const b = el.bbox
    return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad
  }

  /**
   * The STEM under (x, y), or null — the registered `'stem'` rect, widened by {@link STEM_CLICK_PAD}
   * so a 1.5px line is actually clickable.
   *
   * The deliberate complement to {@link hitsNoteOrRestBody}, which ignores the stem on purpose: the
   * stem's tall box is what made selection feel over-eager, and that judgement stands for
   * *selection*. It does not stand for a mark that lives ON the stem — a tremolo's strokes ride it,
   * so aiming at the notehead would mean clicking where the mark will not appear.
   *
   * Containment, not nearest — and that is the point of registering the stem rather than inferring
   * it. {@link findClosestNoteOrRest} measures from the NOTEHEAD, and a click at the top of a stem
   * is a whole stem-length from its own head, so a denser neighbour's head wins and the mark lands
   * on the wrong note. Being ON a rect cannot be fooled that way.
   *
   * Nearest-stem breaks a tie when two padded rects overlap (adjacent notes in a tight beamed
   * group): horizontal distance is the whole ambiguity, since the rects are narrow.
   */
  findStemAt(x: number, y: number): ElementInfo | null {
    let best: ElementInfo | null = null
    let bestDx = Infinity
    for (const el of this.elements) {
      if (el.type !== 'stem') continue
      const b = el.bbox
      const centerX = b.x + b.width / 2
      if (x < b.x - STEM_CLICK_PAD || x > b.x + b.width + STEM_CLICK_PAD) continue
      if (y < b.y - STEM_CLICK_PAD || y > b.y + b.height + STEM_CLICK_PAD) continue
      const dx = Math.abs(x - centerX)
      if (dx < bestDx) {
        bestDx = dx
        best = el
      }
    }
    return best
  }

  /**
   * The TREMOLO mark under (x, y), or null — containment on the strokes' own ink rect, with no pad
   * at all.
   *
   * ⚠️ THE MISSING PAD IS THE RULE, not an oversight. A tremolo is drawn ON the stem, so its rect
   * always overlaps the stem's padded one; asked first, it takes every press inside its boundaries
   * and the stem keeps the whole rest of its length. A pad here would push that border out past the
   * ink, so a click on bare stem *beside* the strokes would select the mark — which is exactly the
   * thing being avoided. The strokes are a notehead wide and several staff-spaces tall between them:
   * unlike a 1.5px stem, this is already a target.
   *
   * Nearest-centre breaks a tie if two rects ever contain the same point (they cannot today — one
   * mark per slot, and slots do not overlap horizontally), for the same reason {@link findStemAt}
   * does it.
   */
  findTremoloAt(x: number, y: number): ElementInfo | null {
    let best: ElementInfo | null = null
    let bestDx = Infinity
    for (const el of this.elements) {
      if (el.type !== 'tremolo') continue
      const b = el.bbox
      if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) continue
      const dx = Math.abs(x - (b.x + b.width / 2))
      if (dx < bestDx) {
        bestDx = dx
        best = el
      }
    }
    return best
  }

  /**
   * Find notes/rests near a given X position (within tolerance)
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @param tolerance - Max distance in pixels (default 30)
   * @returns Array of nearby elements sorted by distance
   */
  findNotesNearX(x: number, measure: number, tolerance: number = 30): ElementInfo[] {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
    )

    return notesAndRests
      .map(el => ({
        el,
        distance: Math.abs(x - headCentreX(el))
      }))
      .filter(({ distance }) => distance <= tolerance)
      .sort((a, b) => a.distance - b.distance)
      .map(({ el }) => el)
  }

  /**
   * Find notes/rests to left and right of a given X position
   * For directional note entry logic where:
   * - right element is rest → new note
   * - right element is note → add to chord
   *
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @returns Object with nearestLeft and nearestRight elements (can be null)
   */
  findNotesLeftRight(x: number, measure: number, staff?: number): {
    nearestLeft: ElementInfo | null,
    nearestRight: ElementInfo | null,
    leftDistance: number,
    rightDistance: number
  } {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
        && (staff === undefined || staffOf(el) === staff)
    )

    let nearestLeft: ElementInfo | null = null
    let nearestRight: ElementInfo | null = null
    let leftDistance = Infinity
    let rightDistance = Infinity

    for (const el of notesAndRests) {
      const distance = headCentreX(el) - x  // Positive = right, negative = left

      if (distance <= 0) {
        // Element is to the left (or at click position)
        const absDistance = Math.abs(distance)
        if (absDistance < leftDistance) {
          leftDistance = absDistance
          nearestLeft = el
        }
      }
      if (distance >= 0) {
        // Element is to the right (or at click position)
        if (distance < rightDistance) {
          rightDistance = distance
          nearestRight = el
        }
      }
    }

    return { nearestLeft, nearestRight, leftDistance, rightDistance }
  }

  // ==================== Tuplet Lookup ====================

  /**
   * Find a tuplet bracket at a given coordinate, searching ALL measures.
   *
   * Like note selection, this must not be scoped to the click's vertical staff band:
   * a tuplet bracket is drawn above/below the staff and can fall into a neighbouring
   * band, so a measure-restricted search would miss it. The bracket's bbox is in real
   * rendered coordinates, so containment alone is unambiguous across measures.
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @returns The tuplet element info, or null if not found
   */
  getTupletAt(x: number, y: number): ElementInfo | null {
    const tuplets = this.elements.filter(el => el.type === 'tuplet')

    for (const tuplet of tuplets) {
      const b = tuplet.bbox
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return tuplet
      }
    }
    return null
  }

  /**
   * Get a tuplet element by its tuplet ID
   * @param tupletId - The tuplet's unique ID
   * @returns The tuplet element info, or null if not found
   */
  getTupletById(tupletId: string): ElementInfo | null {
    return this.elements.find(el => el.type === 'tuplet' && el.tupletId === tupletId) || null
  }

  /**
   * Get all notes and rests belonging to a specific tuplet
   * @param tupletId - The tuplet's unique ID
   * @returns Array of note/rest element infos that belong to the tuplet
   */
  getNotesByTupletId(tupletId: string): ElementInfo[] {
    return this.elements.filter(
      el => (el.type === 'note' || el.type === 'rest') && el.tupletId === tupletId
    )
  }
}

/**
 * ⭐ A registered staff as a frame (`engrave/staff/staffFrame`) — so the registry's pixel↔line questions
 * are asked of the one module that owns staff-line arithmetic (rule 5), ⛔ never summed here.
 */
export function geometryFrame(geometry: StaffGeometry): StaffFrame {
  return { topLineY: geometry.lineYPositions[0], spacePx: geometry.lineSpacing, lineCount: geometry.lineYPositions.length }
}
