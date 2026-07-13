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

/**
 * Fixed height of the score *viewport* (the window you scroll inside), sized to ≈ two staff
 * lines so the JSON panel below stays visible. Derived from LAYOUT_CONFIG so it tracks the
 * per-line content height (STAVE_HEIGHT + VERTICAL_SPACING) + the score's top/bottom margins,
 * rather than being a magic 340. See docs/navigation-viewport-plan.md §2.
 */
export const VIEWPORT_TWO_LINE_HEIGHT =
  2 * (LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING) + LAYOUT_CONFIG.MARGIN * 2

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
 * Width calculation result for a measure
 */
export interface MeasureWidthInfo {
  measureNumber: number
  minWidth: number
  finalWidth: number
  lineNumber: number
  /** Cautionary clef drawn at this measure's end when the next line opens with a
   *  different clef (last measure of a line only). */
  cautionaryEndClef?: Clef
  /** Cautionary (courtesy) time signature drawn at this measure's end when the next
   *  line opens with a meter change (last measure of a line only). Drawn FULL size
   *  (unlike the cautionary clef), per standard engraving — it sits after the final
   *  barline of the line. */
  cautionaryEndTimeSig?: TimeSignature
}
