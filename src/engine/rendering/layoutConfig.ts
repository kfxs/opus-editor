import type { Clef, TimeSignature } from '@/types/music'

/**
 * Layout configuration for proportional measure spacing.
 *
 * Lives in its own module (rather than on VexFlowRenderer) so the width-math
 * collaborators (MeasureLayout) can share these constants and the
 * `MeasureWidthInfo` shape without importing the renderer — which would create a
 * circular dependency, since the renderer imports MeasureLayout. VexFlowRenderer
 * re-exports these names for backward compatibility with existing importers.
 */
export const LAYOUT_CONFIG = {
  /** Minimum pixels between notes for clickability */
  MIN_NOTE_SPACING: 18,
  /** Minimum measure width even for empty measures */
  MIN_MEASURE_WIDTH: 100,
  /** Maximum measure width to prevent one measure dominating */
  MAX_MEASURE_WIDTH: 400,
  /** Space for clef symbol on first measure of line */
  CLEF_WIDTH: 45,
  /** Space for a mid-line clef change (smaller than a line-start clef) */
  CLEF_CHANGE_WIDTH: 30,
  /** Space for time signature */
  TIME_SIG_WIDTH: 30,
  /** Padding before/after barlines */
  BARLINE_PADDING: 10,
  /** Default container width */
  CONTAINER_WIDTH: 1000,
  /** Margin around the score */
  MARGIN: 20,
  /** Stave height */
  STAVE_HEIGHT: 120,
  /** Vertical spacing between lines */
  VERTICAL_SPACING: 30,
}

/** How many staff lines of music the viewport shows at once. THE knob for the viewport's height —
 *  raised from 2.5 once the floating panels (Keypad, Properties) started needing room to sit over
 *  the music without covering the system being edited. */
export const VIEWPORT_LINES = 3.5

/**
 * Fixed height of the score *viewport* (the window you scroll inside), sized to VIEWPORT_LINES
 * staff lines so the JSON panel below stays visible. Derived from LAYOUT_CONFIG so it tracks the
 * per-line content height (STAVE_HEIGHT + VERTICAL_SPACING) + the score's top/bottom margins,
 * rather than being a magic number. See docs/navigation-viewport-plan.md §2.
 */
export const VIEWPORT_HEIGHT =
  VIEWPORT_LINES * (LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING) +
  LAYOUT_CONFIG.MARGIN * 2

/**
 * How the music is laid out on the surface: `wrapped` = today's view, measures broken into
 * stacked systems and justified to the line; `linear` = one endless system, measures at their
 * intrinsic width (Sibelius Panorama / Dorico galley / MuseScore continuous-horizontal).
 *
 * Two things it deliberately is NOT. It is not a *score* field — it is view state, owned by
 * MusicEngine and never written to JSON (docs/linear-view-plan.md §5, P0). And pagination is
 * not a third member: pages, if they ever come, are a property of `wrapped` (a casting-off),
 * not a sibling of it (§1).
 *
 * Lives here, beside the layout config, because that is exactly what it decides — the break
 * and justify policy in MeasureLayout — and because both the renderer and MeasureLayout need
 * it without importing each other.
 */
export type ViewMode = 'wrapped' | 'linear'

/**
 * Width of the frozen left gutter in linear view (layout px): a clef, with a little breathing
 * room. No meter — the music draws its own wherever it changes, and repeating it here is noise.
 */
export const GUTTER_WIDTH = LAYOUT_CONFIG.CLEF_WIDTH + 35

/** One staff's worth of what the frozen gutter shows: where it sits, and the clef in force. */
export interface GutterStaffState {
  /** Y of the staff's TOP line, in layout (unzoomed) coords — straight off the last render. */
  topLineY: number
  lineSpacing: number
  /** The clef in force at the gutter's x — mid-measure changes included. */
  clef: Clef
}

/** Everything the frozen left gutter draws at a given scroll-x. See MusicEngine.getGutterState. */
export interface GutterState {
  /** The measure you are currently looking at — the gutter's "where am I". */
  measureNumber: number
  staves: GutterStaffState[]
}

/**
 * Width calculation result for a measure
 */
export interface MeasureWidthInfo {
  measureNumber: number
  /** Everything the bar needs: the engraver's intrinsic width **plus** `userSpace`. This is what
   *  the break pass casts off on — a bar with 40px of authored space genuinely needs the room and
   *  may legitimately push the line to re-wrap. */
  minWidth: number
  /**
   * The slice of `minWidth` the USER authored (client #10 — docs/note-spacing-plan.md), in px.
   *
   * Split out because justification treats the two halves differently: the intrinsic half
   * (`minWidth − userSpace`) is the engraver's and gets stretched or squeezed to fill the line,
   * the authored half is reserved off the top and handed back whole. Feed it through the stretcher
   * instead and a 20px drag arrives as ~13px, with every other bar on the line shuffled to pay for
   * it. Absent/0 on every bar the user never touched.
   */
  userSpace?: number
  /**
   * The slice of `minWidth` the user's **bar stretch** bought (client #11 —
   * docs/bar-width-plan.md), in px: `noteSpace × (stretch − 1)`. Signed — a stretch below 1 makes
   * it negative.
   *
   * Reserved off the top exactly as `userSpace` is, and for the same reason (a stretch must not be
   * diluted by the stretcher). The one place the two differ is in the renderer: `userSpace` is a
   * dead gap and is subtracted before formatting, this is live and is NOT — that omission is the
   * whole feature ("hand the formatter a bigger box and stop"). Carried on the info because the
   * drag math needs `intrinsic = minWidth − userSpace − stretchSpace`. Absent/0 on every bar the
   * user never stretched.
   */
  stretchSpace?: number
  /**
   * The widest lane's **note space** in px, before any stretch — the unit `stretchSpace` is
   * measured in (`stretchSpace = noteSpace × (stretch − 1)`).
   *
   * Carried because the gesture works in pixels and the model stores a ratio: converting "move this
   * barline 10px" into a stretch needs the divisor, and re-deriving it would mean running the width
   * pass again. Excludes the bar's clef/meter overhead, deliberately — see `measureWidthParts`.
   */
  noteSpace?: number
  /**
   * True when this bar's stretch scales its **share of the line** instead of adding a reserved
   * amount on top — the EMPTY-bar case (docs/bar-width-plan.md §2, corrected at P1).
   *
   * The difference is visible in `distributeLineWidths`: a share-scaling bar carries
   * `stretchSpace: 0` and folds its stretch into `minWidth`, so `intrinsicOf` — and therefore the
   * bar's whole claim on the line — moves with it. A bar with music does the opposite, because its
   * music is what sets its claim. Carried here because the gesture has to invert the right one of
   * the two.
   */
  stretchScalesShare?: boolean
  finalWidth: number
  lineNumber: number
  /**
   * Cautionary clef drawn at this measure's end when the next line opens with a different clef
   * (last measure of a line only) — **per staff**, indexed by staff index.
   *
   * Per staff because a clef IS per staff: a piano score whose left hand changes to treble across a
   * break must warn on the lower staff and say nothing on the upper. This used to be one clef for
   * the whole measure, drawn only on staff 0, which is why a change on any other staff warned
   * nowhere. The WIDTH it reserves is still charged once — the courtesies sit at the same x on
   * different staves, so one clef's width covers all of them.
   */
  cautionaryEndClefs?: (Clef | undefined)[]
  /** Cautionary (courtesy) time signature drawn at this measure's end when the next
   *  line opens with a meter change (last measure of a line only). Drawn FULL size
   *  (unlike the cautionary clef), per standard engraving — it sits after the final
   *  barline of the line. */
  cautionaryEndTimeSig?: TimeSignature
}
