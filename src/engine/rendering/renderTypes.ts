/**
 * **What the renderer hands out** — the types and the one key its readers share, apart from the
 * renderer itself. A module that needs a bar's bounds, its tier-1 placement or its group's id
 * imports THIS file, so it does not import `ScoreRenderer` (4,000 lines, and a runtime cycle for
 * any module the renderer also imports — `systemStart` was one).
 */
import type { Measure, Clef, KeySignature, Fraction, TimeSignature } from '@/types/music'
import type { LeadIn } from '@/engine/layout/measureColumns'
import type { Column } from '@/engine/layout/spacing'
import type { EngravedStave } from './EngravedStave'

/**
 * Bounds information for a rendered measure
 */
export interface MeasureBounds {
  /** X position where the measure starts */
  measureX: number
  /** Y position of the measure */
  measureY: number
  /** Total width of the measure */
  measureWidth: number
  /** X position where notes can start (after clef/time sig) */
  noteStartX: number
  /** X position where notes must end */
  noteEndX: number
  /**
   * ⭐ **This SYSTEM's header→first-note gap, in staff spaces** — 2½ after a clef or key signature,
   * 2 after a meter (decision D, `docs/header-spacing-research.md` §8).
   *
   * ⚠️ **The system's, ⛔ not "what this bar spent".** A bar drawing no header spends its own lead-in
   * padding instead and ignores this — it is recorded on every bar because the reader that wants it
   * ({@link lineLeftCurveX}) looks up the bar that OPENS a line, and that bar always draws a clef.
   *
   * 🚨 Published because `systemEdges.lineLeftCurveX` DERIVES the header's ink edge by subtracting it
   * from `noteStartX`, and before decision D it could assume one constant. ⛔ A second copy of that
   * number would go stale exactly like `VEXFLOW_STAFF_LINE_PX` did — so the bar reports what it used.
   */
  headerToNote?: number
  /** REAL vertical span of this measure's whole system in px (staff 0's top → below the last
   *  staff), including any Client #7 per-system staff-spacing extra. Undefined until a render
   *  populates it; `pixelToMeasure` falls back to the uniform `staffHeight·numStaves` when
   *  absent, which is wrong once staves are spaced apart — hence this real height. */
  systemHeight?: number
}

/**
 * The identity of one drawn measure-on-a-staff — `id="m7-s2"` in the SVG, measure 7, staff 2.
 */
export function measureGroupKey(measureNumber: number, staffIndex: number): string {
  return `m${measureNumber}-s${staffIndex}`
}

/**
 * **Tier 1** — where one (measure, staff) sits, and the `Stave` that knows its geometry
 * (docs/render-performance-plan.md §7).
 *
 * Everything here is derived from the casting-off — `MeasureLayout`'s widths plus the staff-spacing
 * layout — and **nothing here needs a drawing context**. The `stave` is built but not painted; it
 * already answers `getYForLine` / `getNoteStartX` / `getBoundingBox` (pinned by
 * `staveGeometry.test.ts`), which is what lets a measure have a *position* without having a
 * *picture*.
 *
 * That is the whole point of the tier, and since P6 it is exactly what happens: **one of these is
 * produced for every measure in the score, and only the on-screen ones reach `renderMeasure`.**
 * Hit-testing, scroll-into-view, playback-follow and pixel↔position all read tier 1, so they keep
 * working off-screen.
 */
export interface MeasurePlacement {
  /** This staff's own lane of the measure (`staffMeasureView`), not the shared measure. */
  view: Measure
  /**
   * ⭐⭐ **The SYSTEM's spacing facts for this measure — one answer, shared by every staff of it.**
   *
   * A column is a position in the *system*, so beat 2 must land on one x on every staff. Both numbers
   * here are therefore resolved from the WHOLE measure (all staves merged) and handed to each staff,
   * rather than recomputed inside `drawMeasureContent` — which is where this went wrong: that function
   * destructures `view` (this staff's LANE) as `measure`, so each staff was spacing itself as though
   * it were alone on the page. Reported on a grand staff: *"vertically the second stave doesn't match
   * with the first, this is wrong notation"*, and measured at 1.0, 1.7 and 2.4 staff spaces of drift
   * across one bar — a shift plus a scale, because the lane's lead-in AND its column list both
   * differed.
   */
  system: {
    /** The measure's merged columns, barline last (`engine/layout/measureColumns.ts`). */
    columns: Column[]
    /** The measure's lead-in: `barline↔first ink` padding, and that ink's own left reach. */
    leadIn: LeadIn
    /**
     * ⭐ **The WIDEST header any staff of this measure draws**, in staff spaces — so every staff's
     * notes start at the same x.
     *
     * A clef is per staff and a clef CHANGE may happen on one staff alone, which legitimately makes
     * that staff's header wider. What must not follow is that staff's music starting later than its
     * neighbour's: measured on a grand staff where only the lower staff changed clef, the two hands
     * came out 2.6 staff spaces apart at beat 1 and converged to 0.65 by beat 4. The width path
     * already reserves the widest header (`MeasureLayout`'s `widestOverhead`), so the room is there —
     * this is the drawing agreeing with it.
     */
    headerExtent: number
    /** ⭐ The gap this system's header earns before its first note — see {@link headerToNoteGap}. */
    headerToNote: number
  }
  measureNumber: number
  staffIndex: number
  line: number
  x: number
  y: number
  width: number
  isFirstInLine: boolean
  clef: Clef
  /**
   * ⭐ The signature THIS staff draws at this bar's head, absent where it draws none — the answer
   * `headerKeyAt` gives, resolved once here so the room (`headerExtent`), the meter's x
   * (`buildStave`) and the glyphs (`KeySignaturePass`) cannot disagree about it.
   *
   * Per STAFF, like the clef and unlike the meter: Bartók writes four sharps in one hand against
   * four flats in the other, and each hand states its own.
   */
  headerKey?: KeySignature
  /** ⭐⭐ The CAUTIONARY row this bar draws at its END — set only on the last bar of a line whose next
   *  line opens a key change (`engine/layout/cautionaryKey.ts`, Gould p. 93). Per staff, because a
   *  key is per-staff content. */
  cautionaryKey?: KeySignature
  /** The bare staff after that courtesy, in staff spaces — default or authored (`cautionaryKeyGapKey`). */
  cautionaryKeyTrailing?: number
  /**
   * ⭐⭐ **The signature GOVERNING this bar on this staff** — which is not {@link headerKey}: that
   * one is what the bar *prints* (absent on every bar mid-line that restates nothing), while this is
   * what is in FORCE, inherited from wherever it was last set.
   *
   * Every note's drawn accidental is decided against it (`accidentalState.displayedAccidentals`),
   * and so is the bar's WIDTH, since the signs are ink. ⚠️ It is therefore also a row in the shape
   * key: bar 40's own fields never change when bar 1's signature does, so without it P5 would
   * replay bar 40's cached `<g>` — the new signature on the stave and the old accidentals
   * underneath it, forever. That is the governing-CLEF bug verbatim (see `clef` above).
   */
  key: KeySignature
  hasClefChange: boolean
  cautionaryEndClef?: Clef
  cautionaryEndTimeSig?: TimeSignature
  ghostClefBeat?: Fraction
  /** The real height of the system this measure sits on (staff-spacing aware). */
  systemHeight: number
  /**
   * **How big this staff is drawn**, as a ratio (1 = full size — docs/staff-size-plan.md).
   *
   * ⚠️ `x`, `y` and `width` above are where the bar lands **in the SVG**; the `stave` below is
   * built at `x/scale, y/scale, width/scale` and painted inside a `<g transform="scale(k)">`, so
   * everything it reports back is in that group's own space. The two agree at full size, which is
   * why the difference has to be stated rather than noticed. Anything reading the stave's
   * coordinates for ink drawn OUTSIDE the group (ties, slurs, cross-bar beams, connectors) has to
   * multiply — that is §4.3, and it is not done yet.
   */
  scale: number
  /** Built by tier 1 when the measure is (re)drawn; restored from the snapshot when it is reused. */
  stave: EngravedStave
}
