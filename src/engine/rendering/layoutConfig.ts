import type { Clef, TimeSignature } from '@/types/music'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * Layout configuration for proportional measure spacing.
 *
 * Lives in its own module (rather than on VexFlowRenderer) so the width-math
 * collaborators (MeasureLayout) can share these constants and the
 * `MeasureWidthInfo` shape without importing the renderer — which would create a
 * circular dependency, since the renderer imports MeasureLayout. VexFlowRenderer
 * re-exports these names for backward compatibility with existing importers.
 *
 * ⭐ **These are ENGRAVING constants — how music is set *on a line* — and nothing here is a
 * SURFACE.** `CONTAINER_WIDTH` and `MARGIN` used to sit in this object and were exactly that: a
 * page width and a page margin that nothing owned and nothing forbade, read from ten sites that
 * each thought they were reading an engraving constant. They now live in
 * `engine/layout/surface.ts` and reach a render as a `SurfaceMetrics` (docs/layout-plan.md §1).
 * ⛔ Do not put a page dimension back in here; a constant in this object must hold whether or not
 * there is a page at all.
 *
 * ## ⭐ INK vs FINGER — the rule that sorts a pixel constant (docs/staff-size-plan.md §1)
 *
 * Every number in `LAYOUT_CONFIG` is **ink**: it is a distance in the engraving, and it is secretly
 * a staff-space at the score's staff size — so each is written as one, `spaces × STAFF_SPACE_PX`,
 * rather than as the pixel total it used to be. Nothing changed numerically; what changed is that
 * the unit is now stated.
 *
 * Its opposite lives further down this same file and is *correctly* pixels: `VIEWPORT_LINES`,
 * `VIEWPORT_PADDING`, `VIEWPORT_HEIGHT` — a **window**, plus (elsewhere) `STEM_CLICK_PAD`,
 * `ENSURE_VISIBLE_PADDING`, `PAGE_GAP_PX` and the gutter chrome. A fingertip and a window do not
 * shrink with the staff. That both kinds lived in one object under one naming is exactly why nobody
 * noticed the difference for so long.
 *
 * ## ⚠️ …and where a STAFF's own size does and does not multiply them
 *
 * A staff drawn small is drawn inside a `<g transform="scale(k)">`, so **ink used at DRAW time
 * already scales — do not multiply it by the staff's size, that is the double-scaling bug.** The
 * ones that do need `× sizeₛ` are the ones read during the **casting-off**, before any group
 * exists: the four width constants below, which is why every one of them is still full-size on a
 * small staff today (docs/staff-size-plan.md §6 — P3, open).
 */
export const LAYOUT_CONFIG = {
  /**
   * ⚠️ **THE FAN'S UNIT, and nothing else's — it dies with `fanRoom.ts` at P5.**
   *
   * It used to be the editor's whole spacing rule: "minimum space between notes for clickability",
   * 1.8 staff-spaces, applied per event and (as P0 measured) not actually deciding a single bar.
   * The spacing model replaced it — `engine/layout/spacingPadding.ts`'s {@link MIN_COLUMN_GAP} is
   * the engraving floor now, 1.43 spaces, and it is a notehead plus note↔note padding rather than a
   * number nobody chose. ⭐ Note what the old doc-comment conflated: *clickability* is a FINGER
   * (see the INK vs FINGER rule above) and does not belong in the width path at all.
   *
   * What still reads it is `fanColumns`, which counts a fan's claim in units of "one ordinary
   * event's column" — `fanRoom.ts` and `FanPass` buy the fan's drawn span with it, and
   * `MeasureLayout` covers that claim so the heads do not draw through the barline. ⛔ All four go
   * together at P5 (docs/spacing-model-plan.md §2), and this constant goes with them.
   */
  MIN_NOTE_SPACING: 1.8 * STAFF_SPACE_PX,
  /** Minimum measure width even for empty measures — 10 staff-spaces. ⚠️ WIDTH path. */
  MIN_MEASURE_WIDTH: 10 * STAFF_SPACE_PX,
  /** Maximum measure width, so one measure can't dominate — 40 staff-spaces. ⚠️ WIDTH path. */
  MAX_MEASURE_WIDTH: 40 * STAFF_SPACE_PX,
  /** Room for the clef on the first measure of a line — 4.5 staff-spaces. ⚠️ WIDTH path, and also
   *  the clef's hit-box at draw time (where it scales with the staff, being inside its group). */
  CLEF_WIDTH: 4.5 * STAFF_SPACE_PX,
  /** Room for a mid-line clef change (smaller than a line-start clef) — 3 staff-spaces. */
  CLEF_CHANGE_WIDTH: 3 * STAFF_SPACE_PX,
  /** Room for the time signature — 3 staff-spaces. */
  TIME_SIG_WIDTH: 3 * STAFF_SPACE_PX,
  /** Padding before/after barlines — 1 staff-space. */
  BARLINE_PADDING: 1 * STAFF_SPACE_PX,
  /** The vertical room one staff takes, five lines plus what hangs off them — 12 staff-spaces.
   *  Read through `layout/staffStride`, which is where a staff's own size multiplies it. */
  STAVE_HEIGHT: 12 * STAFF_SPACE_PX,
  /** The clearance below a staff, to the next one — 3 staff-spaces. ⛔ Deliberately NOT scaled by a
   *  staff's size: a gap is not made of ink (docs/staff-size-plan.md §5). */
  VERTICAL_SPACING: 3 * STAFF_SPACE_PX,
}

/** How many staff lines of music the viewport shows at once. THE knob for the viewport's height —
 *  raised from 2.5 once the floating panels (Keypad, Properties) started needing room to sit over
 *  the music without covering the system being edited. */
export const VIEWPORT_LINES = 3.5

/**
 * The scroll box's own breathing room above and below the music, in px.
 *
 * ⚠️ Its own constant, and deliberately so: this used to read `LAYOUT_CONFIG.MARGIN`, i.e. the
 * viewport's height tracked **the page's margin**. That is the conflation docs/layout-plan.md §1
 * is about, one import deep — how much padding a *sheet of paper* has is no business of how tall
 * the window you look through it is. ⛔ Do not "de-duplicate" this back onto a surface: they are
 * equal by history, not by meaning.
 */
export const VIEWPORT_PADDING = 20

/**
 * Fixed height of the score *viewport* (the window you scroll inside), sized to VIEWPORT_LINES
 * staff lines so the JSON panel below stays visible. Derived from LAYOUT_CONFIG so it tracks the
 * per-line content height (STAVE_HEIGHT + VERTICAL_SPACING), rather than being a magic number.
 * See docs/navigation-viewport-plan.md §2.
 */
export const VIEWPORT_HEIGHT =
  VIEWPORT_LINES * (LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING) +
  VIEWPORT_PADDING * 2

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
 * How a ledger line is inked. VexFlow's own default is `{ strokeStyle: '#444', lineWidth: 2 }` —
 * grey, and twice the weight of a staff line (which inherits the context's `stroke-width: 1`).
 * Neither matches engraving practice, and at high zoom both are plainly visible.
 *
 * A ledger line is part of the staff: same ink as everything else on the page, so **black**. It IS
 * drawn slightly heavier than a staff line, deliberately — Bravura's SMuFL `engravingDefaults` put
 * `staffLineThickness` at 0.13 staff spaces and `legerLineThickness` at 0.16, a ratio of ~1.23, and
 * Gould (*Behind Bars*) says the same in words. So 1.25 against the staff's 1, not 2.
 *
 * Applied per Stave, since that is the only seam VexFlow offers
 * ({@link Stave.setDefaultLedgerLineStyle}) — every stave that can carry a note off the staff needs
 * it, including the ghost's.
 */
export const LEDGER_LINE_STYLE = { strokeStyle: '#000000', lineWidth: 1.25 }

/**
 * Where every SYSTEM starts vertically, once the per-system staff-spacing overrides (Client #7 —
 * docs/staff-spacing-plan.md) have been resolved. Computed by `VexFlowRenderer.staffSpacingLayout`,
 * which is the only thing that can: the answer depends on the view mode and linear view's own
 * spacing knob, and those are the renderer's. Declared here so anything drawing INTO that layout —
 * the note ghost, notably — can be handed the result instead of recomputing it.
 */
export interface StaffSpacingLayout {
  /** `lineTopPx[line]` — that system's top Y **in the SVG**: on a canvas, the margin plus every
   *  earlier system's grown height; on a page, its own page's top plus its place on that page.
   *  Absolute deliberately — everything downstream (staves, the ghost, the registry) reads this
   *  one number, so a page offset applied downstream would be a page offset somebody forgets. */
  lineTopPx: number[]
  /** `lineLeftPx[line]` — where that system's first bar STARTS. The surface's left margin on a
   *  canvas; on a page, its own page's left edge plus that margin — which is what puts a system on
   *  the second sheet of a side-by-side spread instead of under the first. Same reasoning as
   *  `lineTopPx`: one absolute number, so no drawing code has to know where the pages are. */
  lineLeftPx: number[]
  /** `pageOfLine[line]` — which page that system landed on (all 0 on a canvas). */
  pageOfLine: number[]
  /** How many sheets the music took. 1 on a canvas: the endless strip is one page. */
  pageCount: number
  /**
   * `staffTopPx[line][staffIndex]` — that staff's top, measured from its SYSTEM's top: the strides
   * of every staff above it (each one its own, since a staff drawn small takes a smaller slot —
   * docs/staff-size-plan.md §5) plus the space-above of every staff at/above it.
   *
   * ⭐ One number, not two. It used to be `cumPx` — the space-above prefix alone — with every
   * consumer adding `staffIndex × stride` itself, which was only correct while every staff in the
   * score was the same size. A per-staff stride cannot be re-derived from an index, so the sum is
   * computed once, here, and read.
   */
  staffTopPx: number[][]
  /** `staffSize[line][staffIndex]` — how big that staff is DRAWN on that system, as a ratio
   *  (1 = full size). Published rather than re-resolved by every consumer so there is ONE answer
   *  per (system, staff): it is what decided `staffTopPx` above, and per-system size (§3 of
   *  docs/staff-size-plan.md) would make it genuinely vary by line. */
  staffSize: number[][]
  lineHeightPx: number[]
  /** Σ over lines of that system's height (every staff's own stride + its extra) — the score's
   *  drawn height. */
  contentHeightPx: number
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
  /**
   * The bar's INCOMPRESSIBLE, UNSTRETCHABLE part — clef, meter and barline padding — in px.
   *
   * ⭐ It exists so justification can share a line's surplus **by the music alone**: a clef is 4.5
   * staff spaces whether the line is justified or not, so `naturalWidth − overhead` is the only part
   * of a bar that can absorb anything. Sharing by the whole width instead over-stretched every
   * system-opening bar — see the long note in `distributeLineWidths`.
   *
   * ⚠️ Not the same as {@link floorWidth}, which is this PLUS the per-column ink floor: overhead is
   * what cannot move in EITHER direction, the floor is how far the music may be forced.
   */
  overhead?: number
  /**
   * The narrowest this bar's **intrinsic** part may be pushed when something else on the line needs
   * the room: its overhead (clef, meter, barline padding — none of it compressible) plus
   * `MIN_NOTE_SPACING` per column. Excludes `userSpace`/`stretchSpace`, which are reserved off the
   * top and never squeezed.
   *
   * The second half of a **two-number** width. `minWidth` is what the bar ASKS FOR when nothing
   * competes — it drives the casting-off and therefore the default look of the page. This is how
   * far it can be FORCED, and it applies only when a bar on the line is actually claiming room.
   * Collapsing the two (an empty bar was briefly given its floor as its intrinsic) makes every bar
   * permanently narrow and packs the systems: 14 empty bars to a line at 63px instead of 9 at 103.
   */
  floorWidth?: number
  /**
   * What this bar would ask for at stretch 1 — `minWidth` with the user's growth taken back out.
   * **This, not `minWidth`, is what decides how many bars fit on a system.**
   *
   * The third number, and the one that keeps growth from rewriting the page: casting off on
   * `minWidth` means a grown bar pushes a neighbour onto the next system before anything squeezes,
   * and casting off on `floorWidth` means a grown bar *recruits* bars onto its line (measured: 23
   * empty bars where 9 belong). Neither is what growing a bar means. Capacity is growth-blind; the
   * growth is then absorbed by compression, and only overflows the system when even the floors will
   * not hold it.
   *
   * ⚠️ Also how "is this bar being grown?" is asked — `minWidth > naturalWidth`. NOT derivable from
   * `stretchSpace`: an EMPTY bar's growth folds into `minWidth` instead (`stretchScalesShare`), so
   * it carries `stretchSpace: 0` however hard it was stretched, and reading the reserved pool alone
   * would silently exempt exactly the bars this is mostly used on.
   */
  naturalWidth?: number
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
