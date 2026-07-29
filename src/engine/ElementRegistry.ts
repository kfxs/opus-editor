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
import { dbg } from '@/utils/debug'
import { staffOf } from '@/utils/lanes'

/**
 * Types of elements we track
 */
export type ElementType =
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
  | 'barline'
  | 'beam'
  | 'staff'
  | 'tie'
  | 'slur'
  | 'slur-handle'
  | 'slur-endpoint'
  | 'slur-segment-endpoint'
  | 'accidental'
  | 'dot'
  | 'tuplet'
  | 'articulation'
  | 'dynamic'
  | 'tempo'

/**
 * The small ink glyphs the §6a-ii tripwire polices: each must register its OWN glyph box,
 * never a StaveNote container that unions attached modifiers. Deliberately excludes
 * `note` (keeps a semantic head box that intentionally spans its stem/beam), the region
 * click-targets (`clef`/`timeSignature`/`staff`/`barline`/`beam`), the span types
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
 * dynamic is ≈ 7-8. 6 clears every legitimate glyph with daylight (docs/tight-bbox-plan.md
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
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Clef types (duplicated here to avoid circular imports)
 */
export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor'

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
   * For a 'dynamic': the rhythmic ANCHOR point on the staff (the note/beat it attaches to),
   * in pixels. Used only to draw the dashed attachment-line visualization when the dynamic is
   * selected (Dorico/MuseScore style) — never for hit-testing or engraving. Like every other
   * coordinate field it is shifted by {@link offsetElement} when a bar is translated (P5.4b).
   */
  anchor?: { x: number; y: number }
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
  /** The slur arc's endpoint geometry, so a handle drag can invert renderCurve's
   *  control-point math (cp = f(handlePixel, endpoints)) back into pixel control-point
   *  deltas. */
  slurEndpoints?: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number }
  /** The stave's line spacing (px) where this slur was drawn. Lets a handle drag convert
   *  the new pixel shape to **staff-spaces** before storing it in the engraving-overrides
   *  compartment (so the saved shape is resolution-independent). See docs/engraving-overrides-plan.md. */
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
  /** For a 'slur-endpoint' handle: which end of the slur it re-anchors. */
  endpoint?: 'start' | 'end'
  /** For a 'slur-segment-endpoint' handle (the orange open-join squares): which side of a
   *  MIDDLE segment this open end is. Begin/end open joins need no side (one each). Combined
   *  with `segmentRole` + `segmentOrdinal` + `slurSpanCount` it forms the nudge address. */
  segmentSide?: 'left' | 'right'
  // Accidental-specific properties
  /** Type of accidental: '#', 'b', 'n', '##', 'bb' (for accidentals) */
  accidentalType?: string
  /** ID of the note this accidental belongs to (for accidentals) — and, for a 'dot', the ANCHOR the
   *  slot's dots hang off (see VexFlowRenderer.registerDots): EVERY dot glyph of one chord/rest
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
 * Translate one registered element by (dx, dy) — P5.4b, a measure that **moved** rather than
 * changed (docs/render-performance-plan.md §7a).
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
  const moved: ElementInfo = {
    ...element,
    bbox: {
      x: element.bbox.x + dx,
      y: element.bbox.y + dy,
      width: element.bbox.width,
      height: element.bbox.height,
    },
  }

  // True notehead-centre X — the hit-box selection actually uses (not the bbox centre).
  if (element.headX !== undefined) moved.headX = element.headX + dx

  // Dynamic attachment-line anchor (visualization only) — a coordinate, so it moves with the bar.
  if (element.anchor) moved.anchor = { x: element.anchor.x + dx, y: element.anchor.y + dy }

  // Sampled arc points (slur proximity hit-testing).
  if (element.points) moved.points = element.points.map(p => ({ x: p.x + dx, y: p.y + dy }))

  // Slur handle geometry.
  if (element.controlPoints) {
    moved.controlPoints = [
      { x: element.controlPoints[0].x + dx, y: element.controlPoints[0].y + dy },
      { x: element.controlPoints[1].x + dx, y: element.controlPoints[1].y + dy },
    ]
  }
  if (element.slurEndpoints) {
    moved.slurEndpoints = {
      p0: { x: element.slurEndpoints.p0.x + dx, y: element.slurEndpoints.p0.y + dy },
      p1: { x: element.slurEndpoints.p1.x + dx, y: element.slurEndpoints.p1.y + dy },
      direction: element.slurEndpoints.direction,
    }
  }

  // Tuplet bracket: x/y/notationCenterX are absolute; width and the *Offset fields are relative.
  if (element.tupletGeometry) {
    moved.tupletGeometry = {
      ...element.tupletGeometry,
      x: element.tupletGeometry.x + dx,
      y: element.tupletGeometry.y + dy,
      notationCenterX: element.tupletGeometry.notationCenterX + dx,
    }
  }

  return moved
}

/** Translate a staff's geometry by (dx, dy). See {@link offsetElement} for the hazard. */
/**
 * Scale one registered element out of a staff's own drawing space into the SVG's — the
 * {@link ElementRegistry.withScale} half of what {@link offsetElement} does for a move
 * (docs/staff-size-plan.md §4.2).
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
  const scaled: ElementInfo = {
    ...element,
    bbox: {
      x: element.bbox.x * k,
      y: element.bbox.y * k,
      width: element.bbox.width * k,
      height: element.bbox.height * k,
    },
  }

  if (element.headX !== undefined) scaled.headX = element.headX * k
  if (element.anchor) scaled.anchor = { x: element.anchor.x * k, y: element.anchor.y * k }
  if (element.points) scaled.points = element.points.map(p => ({ x: p.x * k, y: p.y * k }))
  if (element.controlPoints) {
    scaled.controlPoints = [
      { x: element.controlPoints[0].x * k, y: element.controlPoints[0].y * k },
      { x: element.controlPoints[1].x * k, y: element.controlPoints[1].y * k },
    ]
  }
  if (element.slurEndpoints) {
    scaled.slurEndpoints = {
      p0: { x: element.slurEndpoints.p0.x * k, y: element.slurEndpoints.p0.y * k },
      p1: { x: element.slurEndpoints.p1.x * k, y: element.slurEndpoints.p1.y * k },
      direction: element.slurEndpoints.direction,
    }
  }
  // The tuplet bracket: positions AND the lengths, since every one of them is ink.
  if (element.tupletGeometry) {
    const t = element.tupletGeometry
    scaled.tupletGeometry = {
      ...t,
      x: t.x * k,
      y: t.y * k,
      width: t.width * k,
      notationCenterX: t.notationCenterX * k,
      bracketLegLength: t.bracketLegLength * k,
      bracketThickness: t.bracketThickness * k,
      bracketPadding: t.bracketPadding * k,
      textYOffset: t.textYOffset * k,
      yOffset: t.yOffset * k,
    }
  }

  return scaled
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

  /** Composite key for {@link staffGeometries}: a measure has one geometry per staff. */
  private geomKey(measure: number, staff: number): string {
    return `${measure}:${staff}`
  }

  /**
   * Clear all stored elements (call before each render)
   */
  clear(): void {
    this.elements = []
    this.staffGeometries.clear()
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
   * (docs/render-performance-plan.md §7).
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
   * Which staff (0-based index) does a click Y fall on, within a measure? Picks the staff
   * whose lines are vertically nearest the click (by distance to the staff's [top,bottom]
   * band, so a click in the gap between two staves resolves to the closer one, and a click
   * on ledger lines above/below still resolves to its own staff). Falls back to 0 when the
   * measure has no registered geometry. At N=1 there is one staff, so this always returns 0.
   */
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
   * A staff drawn small is drawn inside a `<g transform="scale(k)">` (docs/staff-size-plan.md §4.1),
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
  }

  /**
   * Register a GLYPH element by its OWN VexFlow object's ink box (docs/tight-bbox-plan.md §6a).
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
   * The RESULT tripwire (docs/tight-bbox-plan.md §6a-ii) — the forever version of the
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
          `glyph. Route it through ElementRegistry.addGlyph (docs/tight-bbox-plan.md §6a).`,
      )
    }
  }

  /**
   * Drop every element of a type. Needed by the highlight layer: it registers its own
   * hit-boxes (slur handles) *after* the render, and those used to be wiped by the next
   * render's `clear()`. Once a render can be skipped (docs/render-performance-plan.md §5a),
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
   * Find all elements within a rectangle (for marquee selection)
   */
  getInRect(rect: BoundingBox): ElementInfo[] {
    return this.elements.filter(el => {
      const b = el.bbox
      return (
        b.x < rect.x + rect.width &&
        b.x + b.width > rect.x &&
        b.y < rect.y + rect.height &&
        b.y + b.height > rect.y
      )
    })
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

    const { lineYPositions, lineSpacing } = geometry
    const clef = this.clefAtX(geometry, x)

    // Calculate staff line from Y position
    const topLineY = lineYPositions[0]
    const staffLine = (y - topLineY) / lineSpacing

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

    const { lineYPositions, lineSpacing } = geometry
    const clef = this.clefAtX(geometry, x)
    const staffLine = this.pitchToStaffLine(pitch, clef)

    return lineYPositions[0] + staffLine * lineSpacing
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
      const centerX = el.bbox.x + el.bbox.width / 2
      const distance = Math.abs(x - centerX)
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
      const centerX = note.bbox.x + note.bbox.width / 2
      const xDist = Math.abs(x - centerX)

      // Only consider notes within X tolerance
      if (xDist <= xTolerance) {
        // For chords, notes share the same bbox but have different pitches
        // Use pitch-based Y position for accurate selection
        let noteY: number
        if (note.pitch !== undefined) {
          // Calculate actual Y position from pitch using staff geometry (clef region at the note's X)
          const pitchY = this.pitchToPixelY(note.pitch, measure, note.bbox.x + note.bbox.width / 2, note.staff)
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
          const pitchY = this.pitchToPixelY(element.pitch, element.measure, centerX, element.staff)
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
      const pitchY = this.pitchToPixelY(el.pitch, el.measure, centerX, el.staff)
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
  hitsNoteOrRestBody(el: ElementInfo, x: number, y: number): boolean {
    // Prefer the true notehead-center X (excludes a left-hanging accidental that
    // would otherwise skew the bbox center and misplace the head hit-box).
    const centerX = el.headX ?? el.bbox.x + el.bbox.width / 2
    if (el.type === 'note' && el.pitch !== undefined && el.measure !== undefined) {
      const pitchY = this.pitchToPixelY(el.pitch, el.measure, centerX, el.staff)
      if (pitchY !== null) {
        const sp = this.getStaffGeometry(el.measure, el.staff)?.lineSpacing ?? 10
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
        distance: Math.abs(x - (el.bbox.x + el.bbox.width / 2))
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
      const centerX = el.bbox.x + el.bbox.width / 2
      const distance = centerX - x  // Positive = right, negative = left

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
   * Get all tuplet elements in a measure
   * @param measure - Measure number
   * @returns Array of tuplet element infos
   */
  getTupletsByMeasure(measure: number): ElementInfo[] {
    return this.elements.filter(el => el.type === 'tuplet' && el.measure === measure)
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

  /**
   * Check if an element belongs to a tuplet
   * @param elementId - The note/rest ID
   * @returns The tupletId if the element is in a tuplet, undefined otherwise
   */
  getElementTupletId(elementId: string): string | undefined {
    const element = this.elements.find(el => el.id === elementId)
    return element?.tupletId
  }
}
