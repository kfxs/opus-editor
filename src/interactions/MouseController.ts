import { dbg } from '@/utils/debug'
import type { ArticulationType, PitchSpelling, Fraction, Note, SlurSegmentAddress } from '../types/music'
import type { MusicEngine, BarWidthRoom } from '../engine/MusicEngine'
import type { ElementInfo, ElementRegistry, ElementType } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, armedTool, armedNormalSide, armedTupletM, selectedOf, spendArmedTuplet } from './EditorState'
import { tempoLabel } from '../utils/tempoMap'
import { tempoFieldsFromTool } from '../utils/tempoText'
import { TempoTextSource } from './TempoTextSource'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import type { TextEditController } from './TextEditController'
import type { ClipboardController } from './ClipboardController'
import { DynamicTextSource } from './DynamicTextSource'
import { fracToNumber, fracEq } from '../utils/fraction'
import { dynamicTextFromTool, DEFAULT_DYNAMIC_TEXT } from '../utils/dynamics'
import { staffOf } from '@/utils/lanes'
import { stampFanAtClick } from './fanStamp'
import { stampSlurAtClick } from './slurStamp'
import { cpsFromDrawnControlPoints } from './slurHandleNudge'
import { dragArmedSlurEndpoint } from './slurEndpointWalk'
import { dragDynamic } from './dynamicWalk'
import { dragTempo } from './tempoWalk'
import { pickSlurHandleAt } from './slurHandlePick'
import { stampTrillAtClick } from './trillStamp'
import { stampOttavaAtClick } from './ottavaStamp'
import { stampPedalAtClick } from './pedalStamp'
import { stampHairpinAtClick } from './hairpinStamp'
import { ELEMENT_HIT_ORDER, type ElementChainDeps, type MouseDownCtx } from './elements/chain'
import { armHairpinEndpointAt, hairpinStaffSpacePx } from './elements/hairpinHandles'
import { dragHairpinBody, dragHairpinEndpoint } from './hairpinWalk'
import { dragTrillBody, dragTrillEndpoint } from './trillWalk'
import { slurBodyStaffSpacePx, slurBodyDragStep, type SlurBodyAnchor } from './slurBodyDrag'
import { armOttavaEndpointAt } from './elements/ottavaHandles'
import { dragOttavaBody, dragOttavaEndpoint } from './ottavaWalk'
import { ottavaStaffSpacePx } from './ottavaLane'
import { armPedalEndpointAt } from './elements/pedalHandles'
import { pedalStaffSpacePx } from './pedalLane'
import { dragPedalBody, dragPedalEndpoint } from './pedalWalk'
import { armTrillEndpointAt } from './elements/trillHandles'
import { trillStaffSpacePx } from './trillLane'
import { articulationHit } from './elements/articulation'
import { markAtPress } from './markGroupSelect'
/** Placeholder for a Ctrl+Alt+T tempo mark — exists only so the mark renders a measurable box; the
 *  edit box opens blank over it and an empty commit deletes it, so it is never actually seen. */
const DEFAULT_TEMPO_TEXT = 'Tempo'
import { measureSelectableNotes, beatToFrac } from '../utils/musicUtils'
import { measureCapacityQuarters } from '../utils/measureCapacity'
import { spellingToMidi, accidentalToAlter, formatPitch } from '../utils/pitchSpelling'

/** Registry element types that are staff background / structure rather than clickable
 *  notational objects. A Ctrl+Shift+click landing only on one of these is still "empty
 *  space" for the measure-box gesture (see handleModifierMouseDown). */
const MEASURE_BOX_IGNORE_TYPES = new Set<ElementType>(['staff', 'barline', 'beam'])

/** Vertical margin (px) added above/below a staff's five lines to define the band a plain
 *  click must land in to select that bar. Matches the drawn single box's ±12 extent
 *  (HighlightController.applyMeasureBox), so "click where the box would be → select"; a click
 *  in the GAP between two staves falls outside every band and selects nothing. */
const STAFF_BAND_PAD_PX = 12

/**
 * Handles all mouse interactions: clicks, drags, ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 * Call setup() after mount and teardown() before unmount.
 */
export class MouseController {
  // --- Internal ephemeral state (not in EditorState — not needed for reactivity) ---
  private lastCanvasMousePosition: { x: number; y: number } | null = null
  private isMouseButtonDown = false
  private isDraggingNote = false
  private draggedNoteOriginalPitch: PitchSpelling | null = null
  /**
   * Which gesture a note/rest drag turned out to be — **decided on the evidence, not on the
   * press** (the hand/pan plan's shape). `undecided` until the cursor has travelled far enough to
   * mean something, then the dominant axis picks: vertical → re-pitch, horizontal → note spacing.
   *
   * This is why the gate below is a DISTANCE and not the old elapsed-time one. A time gate can only
   * answer "has the user committed to dragging"; it cannot say to what. Under it, a horizontal drag
   * that wandered one staff step re-pitched the note before any axis could be read — the pitch edit
   * fired on the first frame past 150 ms in whichever direction the cursor happened to be.
   */
  private noteDragAxis: 'undecided' | 'pitch' | 'spacing' = 'undecided'
  /** Press point in svg coords — the origin both the axis decision and the spacing delta measure
   *  from. Null when no note/rest drag is armed. */
  private noteDragStart: { x: number; y: number } | null = null

  // --- Note-spacing drag (the horizontal branch of the note drag; docs/note-spacing-plan.md §5) ---
  /** The column being spaced: a space belongs to a (measure, beat), never to the grabbed note. */
  private spacingDragColumn: { measure: number; beat: Fraction } | null = null
  /** The space already authored there when the drag began — the delta rides on top of it. */
  private spacingDragBaseline = 0
  /** The leftward floor, measured ONCE off the picture the user grabbed. Re-measuring per frame
   *  would judge the gesture against a score that is moving because of the gesture. */
  private spacingDragMinSpace = 0
  /** Staff-line spacing (px) on the grabbed note's own staff — the divisor that turns the cursor's
   *  pixel delta into staff-spaces. Its OWN field, not the slur drag's `draggedStaffSpacePx`:
   *  that one is written only when a slur handle is grabbed, so borrowing it would silently scale
   *  this gesture by whatever slur was dragged last. */
  private spacingDragStaffSpacePx = 10
  private spacingDragChanged = false

  // --- Bar-width drag (docs/bar-width-plan.md P2) ---
  /** The bar whose ENDING barline is being dragged, with everything the gesture needs — captured
   *  ONCE at the grab, off the picture the user actually grabbed. Null when no drag is live: the
   *  press stays a plain barline selection. */
  private barWidthDrag: { measure: number; room: BarWidthRoom } | null = null
  /** SVG x at the grab. The gesture is horizontal only — the target is a barline, so unlike the
   *  note drag there is no axis contest and no dominant-axis rule to run. */
  private barWidthDragStartX = 0
  private barWidthDragChanged = false
  /** True while the drag is tracking but the bar is refusing the value — logged on the transition
   *  in, not per frame. Reset on every accepted move and when the drag ends. */
  private barWidthDragBlocked = false
  /** The casting-off the captured room describes (`MusicEngine.barWidthLineKey`). When the drag
   *  re-wraps the system this changes, and the room has to be re-taken — see the drag handler. */
  private barWidthDragLineKey: string | null = null
  /** True once the press has left the dead zone; until then it is still just a click. */
  private isDraggingBarWidth = false

  // --- Clef drag state (selection-tool drag, across slots and measures) ---
  private isDraggingClef = false
  private draggedClefMeasure: number | null = null      // current measure (updates during drag)
  private draggedClefBeat: Fraction | null = null        // current beat (updates during drag)
  private draggedClefStartMeasure: number | null = null  // measure at drag start (no-op check)
  private draggedClefStartBeat: Fraction | null = null   // beat at drag start (no-op check)
  private clefDragStartTime: number | null = null

  // --- Slur control-point handle drag (reshape the selected slur's curve) ---
  private isDraggingSlurHandle = false
  private draggedSlurId: string | null = null
  private draggedCpIndex: 0 | 1 | undefined = undefined
  private draggedSlurEndpoints: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number } | null = null
  /** The slur's [cp0, cp1] at drag start; the non-dragged control point is held fixed. */
  private draggedSlurBaselineCps: [{ x: number; y: number }, { x: number; y: number }] | null = null
  /** Stave line spacing (px) where the dragged slur was drawn — converts the new pixel
   *  shape to staff-spaces before storing (the override is resolution-independent). */
  private draggedStaffSpacePx = 10
  /** For a cross-system slur, which segment the grabbed handle reshapes (begin/end/middle
   *  ordinal). Undefined = a same-line single arc → routes to the slur's `curveShape`. */
  private draggedSlurSegment: SlurSegmentAddress | undefined = undefined
  /** Live system count carried from the handle, written as the `segmentCurveShape` reset
   *  signature (only used when `draggedSlurSegment` is set). */
  private draggedSlurSpanCount: number | undefined = undefined
  private slurDragChanged = false
  private slurDragStartTime: number | null = null

  // --- Slur endpoint handle drag (re-anchor the selected slur's in/out point) ---
  private isDraggingSlurEndpoint = false
  private draggedEndpointSlurId: string | null = null
  private draggedEndpoint: 'start' | 'end' | undefined = undefined
  /** True once a preview re-anchor fired, so the drop records one undo entry. */
  private slurEndpointDragChanged = false
  private slurEndpointDragStartTime: number | null = null
  /** Cursor position at the last ACCEPTED endpoint-drag frame (see `handleSlurEndpointDrag`). */
  private slurEndpointLastX = 0
  private slurEndpointLastY = 0
  /** Motor pixels still to be absorbed by the hold at the note just crossed, and the direction that
   *  crossing was travelling (so turning back releases instead of fighting). */
  private slurEndpointHoldPx = 0
  private slurEndpointHoldDir = 0
  /** Motor pixels the holds have swallowed and the CATCH-UP still owes back — see
   *  {@link catchupGainFor}. */
  private slurEndpointDebtPx = 0
  /** …and the gain that repays it, fixed when the hold was taken (it depends on that gap). */
  private slurEndpointGain = 1
  /** Horizontal travel this gesture has asked of the CURSOR and given to the INK. Their difference is
   *  the deviation the hold introduces, and the whole point of the catch-up is that it comes back to
   *  zero at every note — so it is logged per frame rather than trusted. */
  private slurEndpointCursorTravel = 0
  private slurEndpointInkTravel = 0

  /**
   * ⭐⭐ **THE HOLD — how far the cursor travels while the ink stays on the note it just reached.**
   *
   * Snap-and-go (Baudisch, Cutrell, Hinckley & Eversole, CHI 2005), which is the model this drag
   * already follows: *don't* teleport the ink within a radius of the anchor — that is traditional
   * snapping, and it makes the band either side of every note physically unreachable. Insert motor
   * space at the anchor instead. The ink arrives, is held for a stretch of cursor travel, and then
   * carries on, so every intermediate position stays placeable and the note still feels magnetic.
   *
   * ⭐ The value is theirs: participants preferred the two strongest attractors they tested (18 and
   * 34 px) and the authors state most users prefer friction of **20–30**. Fernquist et al.'s
   * *Oh Snap* (INTERACT 2011) recommends a 10 px snap width with a 20 px catch-up, and warns that the
   * regions of adjacent snap lines must not overlap — see {@link SLUR_ENDPOINT_HOLD_MAX_PX} for how
   * that rule actually lands on us. Both papers are on disk (`reference/`), with what each answered
   * in that directory's manifest.
   *
   * 🚨 **Snap-and-go itself never gives the swallowed motor distance back** — read from the paper,
   * 2026-08-19: its 1-D code returns `x − w + 1` past an attractor, a permanent `w−1` offset per
   * attractor, and it resyncs the POINTER to the object instead (*"it misses code for updating the
   * mouse pointer to keep knob and pointer together"*). We cannot do that — a score is not a widget
   * and the cursor is not ours to move — which is why the catch-up below is not optional here.
   *
   * ⚠️ It is **motor** distance, not model distance: the cursor moves, the ink does not, and the two
   * re-synchronise the moment the hold is spent. That is the whole trick, and it is why this lives
   * with the gesture rather than in `slurEndpointWalk` — the module knows staff-spaces, and this is
   * a fact about hands.
   *
   * ⭐⭐ **A MULTIPLE OF THE GAP JUST CROSSED, not a pixel count** (his ask for a stronger hold,
   * twice, 2026-08-18). A fixed pixel hold is a different gesture at every zoom and in every density
   * of music: 24 px is over half the gap between quavers in a busy bar and a tenth of it between two
   * whole notes. A multiple of the gap is the same gesture everywhere.
   *
   * ⚠️ **It may exceed 1, and their non-overlap rule is satisfied by construction rather than
   * dodged.** 🚨 An earlier version of this comment said the rule did not apply because "their scheme
   * captures the pointer inside a radius" — **that was a misreading, corrected 2026-08-19 against the
   * paper, which is now on disk** (`reference/oh-snap-fernquist-interact2011.pdf`). Oh Snap does not
   * capture anything: §3 is our gesture exactly — *"The object remains stationary unless the user's
   * finger travels a small distance (the snap-width) beyond where snapping has occurred. Once the
   * finger travels beyond the snap-width, the object starts moving at a rate faster than the finger
   * is moving."*
   *
   * ⭐ So their warning does bear on us — §5.2, *"future Oh Snap implementations would have to take
   * great care not to overlap the snap and catch-up regions of different snappable lines"* — and the
   * derived gain below is what answers it: hold + catch-up comes to `h + (gap − h) = gap` for any
   * hold and any spacing, so two neighbouring notes' regions ABUT and can never overlap. ⚠️ With zero
   * margin, which is worth knowing before anyone changes the gain: the two are exactly adjacent, and
   * anything that repaid the debt more slowly than `1/(1−r)` would push this one's catch-up into the
   * next one's hold.
   *
   * ⚠️ And there IS a precision cost, theirs too (§3.1): the gain quantises the reachable positions —
   * *"if the ratio (and super pixel size) is 2, a position 3 pixels away from a snap line is
   * unreachable"* — and `1/(1−0.8)` is a ratio of **5**. It lands inside the catch-up stretch only
   * (once the debt is paid the ink tracks the cursor 1:1), and the endpoint LATCH is what makes the
   * one position that matters — offset zero at the note — reachable exactly rather than by luck.
   *
   * 🚨 **CAPPED IN PIXELS by {@link SLUR_ENDPOINT_HOLD_MAX_PX}, and that cap is not a detail** — his
   * logs, 2026-08-18. A fraction of the gap is right for dense music and absurd for sparse: a
   * whole-note gap here measures 220 px, so 0.8 of it is a **176 px hold**, and mid-hold the cursor
   * sits 176 px past the note the ink is resting on. Cumulative bookkeeping cannot fix that — the hand
   * and the ink are simply in different places. A hold is a HAND-scale distance (Baudisch tested
   * 18–34 px), so the ratio governs dense music and the cap governs the rest.
   *
   * ⭐ The only real cost is TRAVEL: with hold `h` over a gap `g`, carrying an endpoint across one note
   * costs `g` of cursor movement either way — `h` of it standing still, the rest amplified.
   *
   * ⭐⭐ **0.8 is HIS, found by hand and not by argument** (2026-08-18). The whole sweep, since a
   * later reader will otherwise "improve" it: **24 px flat** → asked for stronger; **0.75** → *"i
   * think can be stronger"*; **1.0** (a note holding the ink for as long as it then takes to reach the
   * next) → *"now is too much"*; **0.85** → *"is too much already"*. ⛔ Do not round it. Nothing in
   * the papers picks between these — Baudisch's own preference study landed on a RANGE (18–34 px),
   * not a number, and for exactly this reason.
   *
   * ⚠️ And the ratio is not the only thing the feel depends on: the jitter guard below decides how
   * easily a hold RELEASES, and it arrived in the same step as 0.85 — so a future retune should move
   * one of the two at a time, which this one did not.
   */
  private readonly SLUR_ENDPOINT_HOLD_RATIO = 0.8

  /**
   * ⭐⭐ **THE CATCH-UP — how the hold gives back the travel it swallowed**, so the cursor and the ink
   * do not drift apart.
   *
   * 🚨 **A hold without this is a bug, and it was ours** (his report, 2026-08-18: *"the hold is making
   * not correspond the x with the notes… i have to go further to reach the longer notes"*). Every hold
   * consumes motor distance the ink never travelled, so after two notes the cursor leads the endpoint
   * by two holds and the score no longer sits where the hand says it does. It gets worse with every
   * note crossed, which is why it reads as the notes having moved.
   *
   * ⭐ Fernquist, Shoemaker & Booth, *Oh Snap* (INTERACT 2011) has the second half: snap on contact,
   * hold for the snap width, **then catch up** over a catch-up width at a gain of
   * `(snap + catchup)/catchup` — their published pair is 10 px and 20 px, i.e. a gain of 1.5.
   *
   * 🚨🚨 **AND THE GAIN IS NOT A FREE PARAMETER — taking their 1.5 with our hold was a bug** (his
   * second report: *"the far i go the far the x position of the mouse deviate more and more"*). The
   * debt has only until the NEXT note to be repaid. Repaying `h` while the ink covers one `gap` needs
   * `(G−1)/G ≥ h/gap`, so with `h = 0.8·gap` a gain of 1.5 repays just `0.33·gap` and every note
   * crossed adds `0.47·gap` of permanent drift. Their 1.5 is self-consistent only with THEIR hold —
   * 10 px against a spacing of 30 or more, i.e. a third of a gap.
   *
   * ⭐⭐ So it is DERIVED: `G = 1/(1 − r)`. Then cursor travel per gap is exactly
   * `r·gap + gap/G = gap` — one-to-one, with the debt back at zero on arrival at every note. The
   * hold ratio is now the only dial: raise it and the ink is stickier at each note AND flies faster
   * between them, because those are the same statement.
   *
   * ⚠️ Turning back CANCELS the debt rather than repaying it backwards. The hold was a statement about
   * travel in one direction; a change of mind is not the place to hand back distance the hand did not
   * ask for.
   */
  private readonly SLUR_ENDPOINT_HOLD_MAX_PX = 30

  /**
   * ⭐⭐ The gain that repays THIS latch's hold over THIS gap: `G = 1/(1 − h/gap)`.
   *
   * Derived per latch rather than fixed, because the hold is now capped: `h/gap` is 0.8 between two
   * quavers and 0.14 between two whole notes, so one gain cannot serve both. Solving
   * `(G−1)·c = h` with `G·c = gap` gives the formula, and then the debt reaches zero at the exact
   * moment the ink reaches the next note — cursor travel per gap is the gap, at any spacing.
   *
   * ⚠️ 1 (no amplification) when there is no room to repay: nothing ahead, or a hold that swallowed
   * the whole gap. Better to leave a small debt standing than to divide by zero.
   */
  private catchupGainFor(holdPx: number, gapPx: number): number {
    if (gapPx <= 0 || holdPx <= 0 || holdPx >= gapPx) return 1
    return 1 / (1 - holdPx / gapPx)
  }

  // --- Dynamic drag (docs/dynamic-offset-plan.md, the RE-ANCHOR section). ⚠️ No square and nothing
  //     to arm first: a dynamic is a POINT, so the MARK is its own handle and this arms on the very
  //     press that selects it. The drag walks the mark's lane, the mouse twin of `Ctrl+Shift+←/→`. ---
  private isDraggingDynamic = false
  private draggedDynamicId: string | null = null
  /** True once a preview write landed, so the drop records one undo entry. */
  private dynamicDragChanged = false
  /** The cursor of the last ACCEPTED frame of a dynamic drag; null until the first frame past the
   *  time threshold sets it. See {@link handleDynamicDrag}. */
  private dynamicDragLastX: number | null = null
  private dynamicDragLastY = 0
  private dynamicDragStartTime: number | null = null

  // --- Tempo mark drag (docs/tempo-marks-plan.md). The dynamic's arrangement above, one mark over:
  //     the MARK is its own handle, so this arms on the very press that selects it, and the frame
  //     runs the same interpolating walk with a LATCH (his call — a tempo wants its anchor exactly).
  private isDraggingTempo = false
  private draggedTempoId: string | null = null
  private tempoDragChanged = false
  private tempoDragLastX: number | null = null
  private tempoDragLastY = 0
  private tempoDragStartTime: number | null = null

  // --- Hairpin endpoint square drag (the wedge's own two ends — docs/dynamics-line-and-hairpins-
  //     plan.md). ⭐ Since 2026-08-20 it is the WALK (`./hairpinWalk`), not a snap: the ink follows
  //     the hand and the wedge comes along when the ink reaches a boundary, so the mouse and the
  //     arrows are one gesture and land in one state. ---
  private isDraggingHairpinEnd = false
  private draggedHairpinId: string | null = null
  private draggedHairpinEnd: 'start' | 'end' | undefined = undefined
  /** True once a preview write landed, so the drop records one undo entry. */
  private hairpinDragChanged = false
  private hairpinDragStartTime: number | null = null
  /** The last ACCEPTED cursor position, in SVG px — the anchor each frame's delta is measured from.
   *  ⚠️ Not advanced on a refusal, the body drag's rule: an end stopped at a limit picks the cursor
   *  up where it left it rather than jumping the distance it did not travel. */
  private hairpinEndLastX = 0
  private hairpinEndLastY = 0

  // --- Hairpin BODY drag (his ask, 2026-08-18): the whole wedge's INK, where the squares above move
  //     its ENDS through the music. Free pixels, not a snap — it writes the offset override, so the
  //     cursor's delta is converted to staff-spaces and accumulated frame by frame. ---
  private isDraggingHairpinBody = false
  private draggedHairpinBodyId: string | null = null
  /** The last ACCEPTED cursor position, in SVG px — the anchor each frame's delta is measured from.
   *  ⚠️ Not advanced on a refusal (the page limit), so a wedge stopped at the sheet's edge picks the
   *  cursor up again exactly where it left it rather than jumping the distance it did not travel. */
  private hairpinBodyLastX = 0
  private hairpinBodyLastY = 0
  /** True once a preview write landed, so the drop records one undo entry. */
  private hairpinBodyDragChanged = false
  private hairpinBodyDragStartTime: number | null = null

  // --- Slur ARC BODY drag (his ask, 2026-08-18): the whole curve's INK, where a press on a HANDLE
  //     moves one point instead. Free pixels, no walk and no hold — a whole-curve move has no anchor
  //     to arrive at (`./slurBodyDrag`, which owns the arithmetic and the refusal rule). ---
  private isDraggingSlurBody = false
  private draggedSlurBodyId: string | null = null
  /** The last ACCEPTED cursor position + the measured px→staff-space scale. ⚠️ Not advanced on a
   *  refusal, so a curve stopped by the page or band limit picks the cursor up where it left it. */
  private slurBodyAnchor: SlurBodyAnchor | null = null
  /** True once a preview write landed, so the drop records one undo entry. */
  private slurBodyDragChanged = false
  private slurBodyDragStartTime: number | null = null

  // --- Ottava endpoint square drag (the bracket's own two ends — docs/ottava-plan.md). The RIGHT
  //     square re-anchors the end, the LEFT one moves the beginning and holds the end: the drag twin
  //     of `Ctrl+Shift+←/→`, snapping to onsets of its STAFF. ---
  private isDraggingOttavaEnd = false
  private draggedOttavaId: string | null = null
  private draggedOttavaEnd: 'start' | 'end' | undefined = undefined
  /** True once a preview write landed, so the drop records one undo entry. */
  private ottavaDragChanged = false
  /** ⭐ Where the cursor was at the last ACCEPTED frame — the walk accumulates, so a refused frame
   *  must leave this put ({@link handleOttavaEndDrag}). */
  private ottavaEndLastX = 0
  private ottavaEndLastY = 0
  private ottavaDragStartTime: number | null = null

  // --- Ottava BODY drag (a press on the numeral or its dashed line). The whole bracket follows the
  //     hand — sideways through the music, and DOWN ONTO ANOTHER SYSTEM vertically. ---
  private isDraggingOttavaBody = false
  private draggedOttavaBodyId: string | null = null
  private ottavaBodyLastX = 0
  private ottavaBodyLastY = 0
  private ottavaBodyDragChanged = false
  private ottavaBodyDragStartTime: number | null = null

  // --- Pedal endpoint square drag (the `Ped.` and the `✻` — docs/pedal-plan.md). The RIGHT square
  //     moves the LIFT, the LEFT one moves the press and holds the lift. ⭐ The INTERPOLATING WALK
  //     with a cursor (`pedalWalk.dragPedalEndpoint`) — the arrows' own gesture, so the ink follows
  //     the hand and the foot comes along at each stop the ink reaches. ---
  private isDraggingPedalEnd = false
  private draggedPedalId: string | null = null
  private draggedPedalEnd: 'start' | 'end' | undefined = undefined
  /** True once a preview write landed, so the drop records one undo entry. */
  private pedalDragChanged = false
  /** ⭐ Where the cursor was at the last ACCEPTED frame — the walk accumulates, so a refused frame
   *  must leave these put ({@link handlePedalEndDrag}). */
  private pedalEndLastX = 0
  private pedalEndLastY = 0
  private pedalDragStartTime: number | null = null

  // --- Pedal BODY drag: a press on either SIGN moves the whole pedal — through the music sideways
  //     (`pedalWalk.dragPedalBody`) and onto another system vertically (`markSystemJump`). ---
  private isDraggingPedalBody = false
  private draggedPedalBodyId: string | null = null
  private pedalBodyLastX = 0
  private pedalBodyLastY = 0
  private pedalBodyDragChanged = false
  private pedalBodyDragStartTime: number | null = null

  // --- Trill endpoint square drag (the `tr` and the end of its wavy line). ⭐ The INTERPOLATING
  //     WALK with a cursor (`trillWalk.dragTrillEndpoint`) — the arrows' own gesture, so the ink
  //     follows the hand and the ANCHOR (a NOTE, not a slot) comes along when the ink reaches one. ---
  private isDraggingTrillEnd = false
  private draggedTrillId: string | null = null
  private draggedTrillEnd: 'start' | 'end' | undefined = undefined
  /** True once a preview write landed, so the drop records one undo entry. */
  private trillDragChanged = false
  private trillDragStartTime: number | null = null
  /** ⚠️ The cursor x the next frame's delta is measured from — ⛔ never the press point: the walk
   *  ACCUMULATES, and the latch holds this back by what it dropped. */
  private trillEndLastX = 0
  /** …and its y, which the LADDER reads (`trillWalk`: the side of its staff, then the system). */
  private trillEndLastY = 0

  // --- Trill BODY drag: a press on the ornament's own ink moves the WHOLE thing (2026-08-20). ---
  private isDraggingTrillBody = false
  private draggedTrillBodyId: string | null = null
  private trillBodyLastX = 0
  private trillBodyLastY = 0
  private trillBodyDragChanged = false
  private trillBodyDragStartTime: number | null = null

  // --- Staff-spacing vertical drag (Sibelius "space above staff" — Client #7) ---
  private isDraggingStaffSpacing = false
  private draggedSpacingStaff = 0            // staff index being spaced
  private draggedSpacingMeasure = 0          // a measure on the target SYSTEM (per-system key)
  private draggedSpacingBaseline = 0         // its `above` (staff-spaces) at drag start
  private draggedSpacingStartY = 0           // cursor Y (px) at drag start
  private staffSpacingDragChanged = false
  private staffSpacingDragStartTime: number | null = null


  private readonly DRAG_TIME_THRESHOLD_MS = 150

  /** Min cursor travel (px) before a note/rest press becomes a drag AND picks its axis. The same
   *  dead-zone idea as {@link PAN_THRESHOLD_PX}, a little wider: this one also has to tell two
   *  gestures apart, and 4px of jitter is a coin toss between them. */
  private readonly NOTE_DRAG_THRESHOLD_PX = 6

  // --- Hand / grab-to-pan gesture (tool-agnostic navigation) ---
  // A press on empty space ARMS a possible pan but changes nothing yet; we decide
  // tap-vs-pan on RELEASE by movement distance (not time). Tracked in client (screen)
  // pixels, NOT svg coords — svg coords shift as the view scrolls and would feed the
  // scroll back on itself. Deltas drive `panBy(-dx, -dy)` so the content follows the hand.
  private isPanArmed = false
  private isPanning = false
  private panStartClient: { x: number; y: number } = { x: 0, y: 0 }
  private panLastClient: { x: number; y: number } = { x: 0, y: 0 }
  /** True only when armed in the selection tool: a tap-release clears the selection. */
  private pendingTapClearsSelection = false
  /** SVG coords of the armed empty-space press. On a tap-release we try to select the
   *  measure they fell inside (Sibelius plain-click passage select); only a tap OUTSIDE
   *  every bar falls back to clearing the selection. Null when no clearing pan is armed. */
  private pendingTapCoords: { x: number; y: number } | null = null
  /** Set on a pan-release so the trailing `click` doesn't run the tool's tap action. */
  private suppressNextClick = false
  /** Min cursor travel (px) from press before an armed press becomes a real pan. */
  private readonly PAN_THRESHOLD_PX = 4

  /** Clear all ephemeral pan flags. Called defensively at the top of every mousedown so
   *  a flag (notably `suppressNextClick`) can never outlive the gesture that set it —
   *  browsers don't reliably fire `click` after a movement-heavy press/release. */
  private resetPanState(): void {
    this.isPanArmed = false
    this.isPanning = false
    this.pendingTapClearsSelection = false
    this.suppressNextClick = false
    this.detachPanListeners()
  }

  /** Arm a possible pan from an empty-space press. Records the press point in client
   *  coords and attaches the document-level drivers; the pan only becomes real once
   *  movement crosses {@link PAN_THRESHOLD_PX}. */
  private armPan(event: MouseEvent, clearsSelection: boolean): void {
    this.isPanArmed = true
    this.pendingTapClearsSelection = clearsSelection
    this.panStartClient = { x: event.clientX, y: event.clientY }
    this.panLastClient = { x: event.clientX, y: event.clientY }
    this.attachPanListeners()
  }

  private attachPanListeners(): void {
    if (this.panListenersAttached) return
    document.addEventListener('mousemove', this.onDocPanMove, true)
    document.addEventListener('mouseup', this.onDocPanUp, true)
    this.panListenersAttached = true
  }

  private detachPanListeners(): void {
    if (!this.panListenersAttached) return
    document.removeEventListener('mousemove', this.onDocPanMove, true)
    document.removeEventListener('mouseup', this.onDocPanUp, true)
    this.panListenersAttached = false
  }

  /**
   * Document-level pan move. Drives the pan from anywhere on screen (not just over the
   * viewport), so leaving the viewport mid-drag keeps panning. Uses CLIENT coords — svg
   * coords shift as we scroll and would feed the scroll back on itself.
   */
  private handleDocPanMove(event: MouseEvent): void {
    if (!this.isPanArmed) return
    const cx = event.clientX
    const cy = event.clientY
    if (!this.isPanning) {
      const dist = Math.hypot(cx - this.panStartClient.x, cy - this.panStartClient.y)
      if (dist < this.PAN_THRESHOLD_PX) return // still within the dead zone — maybe a tap
      // Threshold crossed: a real pan has begun. Hide the OS pointer and measure deltas
      // from here (the small threshold travel is absorbed, not applied as a jump).
      this.isPanning = true
      this.state.isPanning = true
      this.panLastClient = { x: cx, y: cy }
      dbg('Pan started')
    }
    const dx = cx - this.panLastClient.x
    const dy = cy - this.panLastClient.y
    this.panLastClient = { x: cx, y: cy }
    this.panBy(-dx, -dy) // content follows the hand → scroll opposite to pointer motion
  }

  /** Document-level pan release. Resolves drag-vs-tap and tears the gesture down. */
  private handleDocPanUp(): void {
    if (!this.isPanArmed) return
    const wasPanning = this.isPanning
    const clears = this.pendingTapClearsSelection
    const tapCoords = this.pendingTapCoords
    this.detachPanListeners()
    this.isPanArmed = false
    this.isPanning = false
    this.pendingTapClearsSelection = false
    this.pendingTapCoords = null
    if (wasPanning) {
      // Real pan: swallow the trailing click, restore the pointer, keep the selection.
      this.suppressNextClick = true
      this.state.isPanning = false
      dbg('Pan ended')
    } else if (clears) {
      // Tap on empty space in the selection tool (deferred from mousedown). Sibelius-style:
      // a tap INSIDE a bar selects that whole bar (single blue box + its contents); only a
      // tap OUTSIDE every bar clears EVERYTHING, same as Esc — incl. tuplet/dynamic
      // selections and resetting entry to the default voice 1 (selectNote(null) alone would
      // leave the active voice stuck on a previously chosen voice).
      if (!tapCoords || !this.selectMeasureAt(tapCoords.x, tapCoords.y)) {
        this.selection.deselectAll()
        dbg('Selection cleared (tap)')
      }
      this.render.renderScore()
    }
  }

  // --- Manual double-click detection for the in-canvas text editor (the native
  // dblclick event is defeated by the re-render-on-select swapping SVG nodes) ---
  private lastDynamicDownId: string | null = null
  private lastDynamicDownTime = 0
  private lastTempoDownId: string | null = null
  private lastTempoDownTime = 0
  private readonly DOUBLE_CLICK_MS = 400

  private readonly onDocMouseDown = () => { this.isMouseButtonDown = true }
  private readonly onDocMouseUp = (event: MouseEvent) => {
    this.isMouseButtonDown = false
    // ⭐⭐ **EVERY drag is settled HERE as well as in the element's own handler**, because a release
    // outside the viewport never reaches that one — and a drag left armed is not a harmless leak: it
    // holds an uncommitted preview, so the score keeps changing under the next mouse move with no
    // button held (his report, 2026-08-20: *"i click release outside the viewport, and then when i
    // went back with no mouse pressed the system think i'm still pressing"*).
    //
    // ⭐ It runs the SAME chain the canvas's own release runs — ⛔ not a list of gestures repeated
    // here, which is a list that would be one short again the next time a drag is added. Every ender
    // is guarded by its own `isDragging…` flag and clears it, so whichever handler runs first does
    // the work and the other no-ops. Capture-phase, so this one is first.
    this.handleMouseUp(event)
  }

  /**
   * ⭐⭐ **EVERY DRAG KEEPS TRACKING WHEN THE POINTER LEAVES THE CANVAS** — his report, 2026-08-21:
   * *"i move up and then i dont release the mouse but went out of the viefinder and when i go back
   * im not editing the slur… this is wrong"*.
   *
   * ⭐ It is the PAN's own mechanism, which has had it since the hand tool shipped and says why in
   * `handleMouseLeave`: the element's `mousemove` stops firing once the pointer exits the canvas, so
   * a gesture that lives on it dies at the edge. ⛔ The list of gestures is not repeated here — this
   * forwards the SAME `handleMouseMove` the canvas calls, and every drag handler in it is guarded by
   * its own `isDragging…` flag.
   *
   * ⚠️ **Only OUTSIDE the canvas**, or the element's own handler and this one would both fire and the
   * gesture would move twice per frame. Capture phase, so the target test happens before the element
   * sees it.
   *
   * ⚠️ **Only with the button DOWN.** With nothing held there is no gesture to keep alive, and
   * `handleMouseMove` returns early on `isMouseButtonDown` before any ghost work, so a move outside
   * the viewport costs nothing.
   */
  private readonly onDocMouseMove = (event: MouseEvent) => {
    if (!this.isMouseButtonDown) return
    const canvas = this.getScoreCanvas()
    if (!canvas || canvas.contains(event.target as Node)) return
    this.handleMouseMove(event)
  }

  // Document-level pan drivers: attached for the duration of an armed pan so the gesture
  // keeps tracking movement and release even when the pointer leaves the viewport (the
  // element's own mousemove/mouseup stop firing once the pointer exits scoreCanvas).
  private readonly onDocPanMove = (e: MouseEvent) => this.handleDocPanMove(e)
  private readonly onDocPanUp = () => this.handleDocPanUp()
  private panListenersAttached = false

  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
    private getPendingArticulations: () => ArticulationType[] | undefined,
    private getTextEdit: () => TextEditController | null,
    private clipboard: ClipboardController,
    /** Arm the click-to-type expression tool (PaletteController.armDynamicEntry). Injected rather
     *  than reached for so {@link insertExpression} — the Ctrl+E / Insert▸Text▸Expression action —
     *  can live here (with the attach-and-edit half) without MouseController depending on the palette. */
    private armDynamicEntry: () => void,
    /** Arm the click-to-type tempo tool (PaletteController.armTempoEntry) — the tempo twin of
     *  `armDynamicEntry`, used by {@link insertTempo} (Ctrl+Alt+T). */
    private armTempoEntry: () => void,
    /** Scroll the viewport by a client-pixel delta (content follows the hand). */
    private panBy: (dx: number, dy: number) => void,
    /** Current view zoom — handed to the text editor so its (fixed-position) font scales (§5.4). */
    private getZoom: () => number = () => 1,
  ) {}

  /** Register document-level event listeners. Call on mount. */
  setup(): void {
    document.addEventListener('mousedown', this.onDocMouseDown, true)
    document.addEventListener('mouseup', this.onDocMouseUp, true)
    document.addEventListener('mousemove', this.onDocMouseMove, true)
  }

  /** Remove document-level event listeners. Call on unmount. */
  teardown(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown, true)
    document.removeEventListener('mouseup', this.onDocMouseUp, true)
    document.removeEventListener('mousemove', this.onDocMouseMove, true)
    this.detachPanListeners()
  }

  getLastMousePosition(): { x: number; y: number } | null {
    return this.lastCanvasMousePosition
  }

  // --- Private helpers ---

  private clientToSvg(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } | null {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPoint = point.matrixTransform(ctm.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  }

  /**
   * Resolve a click X within a measure to the beat of the nearest slot boundary
   * (by the slot's left edge). A beat-anchored marking (clef change, dynamic) is
   * placed at that slot; clicking near the measure start resolves to beat 0.
   * Returns the slot's exact Fraction beat when available.
   */
  private resolveSlotBeat(engine: MusicEngine, x: number, measureNum: number): Fraction {
    const registry = engine.getElementRegistry()
    const els = registry.getByMeasure(measureNum)
      .filter(e => (e.type === 'note' || e.type === 'rest') && e.beat !== undefined)

    let bestBeatNum = 0
    let bestDist = Infinity
    for (const e of els) {
      const dist = Math.abs(x - e.bbox.x)
      if (dist < bestDist) {
        bestDist = dist
        bestBeatNum = e.beat as number
      }
    }

    // Recover the slot's exact Fraction beat from the model (numbers lose tuplet precision).
    const measure = engine.getScore().measures.find(m => m.number === measureNum)
    const slot = measure?.slots.find(s => Math.abs(fracToNumber(s.beat) - bestBeatNum) < 1e-6)
    return slot ? slot.beat : beatToFrac(bestBeatNum)
  }

  /**
   * Open the in-canvas text editor on a custom-text dynamic. Builds a
   * {@link DynamicTextSource} (which carries the model write + positioning + glyph
   * hide) and hands it to the shared {@link TextEditController}. No-op if the text
   * editor isn't wired (e.g. before mount).
   */
  private openTextEditor(dynamicId: string, isNew: boolean, seedText?: string): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit) return
    const source = new DynamicTextSource(
      dynamicId,
      isNew,
      engine,
      () => this.getScoreCanvas(),
      () => this.render.renderScore(),
      this.getZoom,
      seedText,
    )
    textEdit.open(source)
  }

  /**
   * Ctrl+E: attach a custom-text dynamic to the currently selected note/rest and open
   * the in-canvas editor to type it immediately — no armed tool, no placeholder to clear
   * out first. The mark is placed carrying the default placeholder so it renders a real
   * box for the overlay to position against, but the editor opens BLANK (seedText `''`)
   * and, being `isNew`, deletes itself on an empty commit — so typing nothing leaves no
   * trace. The place-render and the editor's suppress-render both run before the browser
   * paints, so the placeholder never flashes on screen. No-op with nothing selected, mid
   * text-edit, or before the editor is wired.
   */
  editDynamicOnSelection(): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit || this.state.editingText) return
    const noteId = this.state.selectedNoteId
    if (!noteId) return
    const note = engine.getNote(noteId)
    if (!note) return
    // Anchor to the selected note's STAFF (else it renders on staff 0); absent staffId
    // keeps single-staff output byte-identical. ⭐ No voice = every voice of that staff — see the
    // SCOPE note above. ⚠️ NOT the clicked note's voice: a mark is placed AT a note, not INTO it.
    const staffId = engine.staffIdForIndex(staffOf(note))
    const staffParam = staffId ? { staffId } : {}
    const created = engine.addDynamic(note.measure, {
      beat: note.beat, text: DEFAULT_DYNAMIC_TEXT, placement: 'below', ...staffParam,
    })
    if (!created) return
    // Render so registerDynamics stores the mark's bbox; openTextEditor's source snapshots
    // its position from the registry, then immediately suppresses + re-renders it.
    this.render.renderScore()
    this.openTextEditor(created.id, true, '')
    dbg(`✓ Insert dynamic on selection: measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} staff ${staffOf(note)} (note ${noteId})`)
  }

  /**
   * The "insert an expression" action — the ONE thing Ctrl+E and Insert ▸ Text ▸ Expression both do,
   * so the two entry points share it instead of each spelling the branch. With a note/rest selected,
   * attach a dynamic to it and edit inline; with nothing selected, arm the click-to-type tool (blue
   * cursor) so the next canvas click places and edits one.
   */
  insertExpression(): void {
    if (this.state.selectedNoteId) this.editDynamicOnSelection()
    else this.armDynamicEntry()
  }

  /**
   * Open the inline editor on the currently SELECTED dynamic — the keyboard twin of double-clicking
   * it (bound to Enter). Returns whether it acted, so the Enter shortcut DECLINES (stays free) when
   * no dynamic is selected. No-op mid text-edit or before the editor is wired.
   */
  editSelectedDynamic(): boolean {
    if (this.state.editingText) return false
    const id = selectedOf(this.state, 'dynamic')?.id
    if (!id || !this.getEngine()?.getDynamicById(id)) return false
    this.openTextEditor(id, false)
    return true
  }

  /** Resolve a paste-placement click to a (measure, slot beat) and commit the paste. */
  private commitArmedPaste(event: MouseEvent): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const measure = engine.pixelToMeasure(coords)
    const beat = this.resolveSlotBeat(engine, coords.x, measure)
    // Which stacked staff the click landed on is the paste destination staff (multi-staff).
    const registry = engine.getElementRegistry()
    const staff = registry.staffIndexAtY(measure, coords.y)
    // ⭐⭐ **WHICH NOTE the click landed ON, if any** — his rule for the slur, 2026-08-20: *"for
    // slurring a note we should be really close to the bbox of that note"*. A place is not enough
    // for a kind whose anchor is a NOTE, and only the pointer can say whether one was meant: the
    // click must be inside the note's own ink, ⛔ not merely nearest to it, which is how an empty bar
    // still produced a slur. A rest never qualifies — it cannot anchor one.
    // ⚠️ Optional-chained: the registry is STUBBED in several specs (a partial object with the
    // handful of methods those files need), and a paste that cannot ask simply names no note — which
    // is the same answer it gives for a click on empty staff.
    // ⭐ `noteOrRestAtBody` is the SLUR STAMP's own test (`./slurStamp`), asked once in the registry
    // rather than written out again here: a mark that attaches to an event must land ON one.
    const hit = registry.noteOrRestAtBody?.(coords.x, coords.y)
    const noteId = hit?.type === 'note' ? hit.id : undefined
    dbg(`Paste placement click | measure:${measure} beat:${fracToNumber(beat)} staff:${staff}`
      + `${noteId ? ' on a note' : ''}`)
    this.clipboard.pasteAt(measure, beat, staff, noteId)
  }

  /**
   * What the per-kind hit-tests in `elements/` are allowed to do besides answering "mine" — the
   * shared tail, the two drags they may arm, and the double-click editors. Built once: a press
   * hands the same object to every entry in {@link ELEMENT_HIT_ORDER}.
   *
   * ⭐ `pick` IS the tail eleven of the twelve handlers used to end in — clear the whole NOTE
   * selection (the multi-select Map drives the note highlight, not just `selectedNoteId`), make
   * this the ONE selected element, repaint. Written once here instead of eleven times there.
   */
  private readonly elementDeps: ElementChainDeps = {
    pick: (element, arm) => {
      this.selection.selectNote(null)
      this.state.selectedElement = element
      arm?.()
      this.render.renderScore()
      return true
    },
    pickArticulationGroup: (noteId) => {
      this.selection.selectArticulation(noteId)
      this.render.renderScore()
      return true
    },
    armClefDrag: (clef, event) => this.armClefDrag(clef, event),
    armBarWidthDrag: (measure, x) => {
      const engine = this.getEngine()
      if (engine) this.armBarWidthDrag(engine, measure, x)
    },
    armDynamicDrag: (dynamicId, event) => this.armDynamicDrag(dynamicId, event),
    armTempoDrag: (tempoId, event) => this.armTempoDrag(tempoId, event),
    armHairpinOffsetDrag: (hairpinId, x, y, event) => this.armHairpinOffsetDrag(hairpinId, x, y, event),
    armTrillOffsetDrag: (trillId, x, y, event) => this.armTrillOffsetDrag(trillId, x, y, event),
    armOttavaOffsetDrag: (ottavaId, x, y, event) => this.armOttavaOffsetDrag(ottavaId, x, y, event),
    armPedalOffsetDrag: (pedalId, x, y, event) => this.armPedalOffsetDrag(pedalId, x, y, event),
    armSlurOffsetDrag: (slurId, x, y, event) => this.armSlurOffsetDrag(slurId, x, y, event),
    isDoubleClick: (mark, id) => this.pressIsDoubleClick(mark, id),
    openEditor: (mark, id) => {
      if (mark === 'tempo') this.openTempoTextEditor(id, false)
      else this.openTextEditor(id, false)
    },
  }

  /**
   * Arm the horizontal drag for a MOVABLE clef (every clef except the big line-start one),
   * recovering the exact `Fraction` beat from the model — the pixel beat on the registry entry is
   * rounded, and a drag has to move the real change.
   *
   * Freezes line breaks so sliding the clef re-pitches notes without reflowing the score; we settle
   * the layout on drop.
   */
  private armClefDrag(clefAt: ElementInfo, event: MouseEvent): void {
    if (clefAt.immovable || clefAt.measure === undefined) return
    const engine = this.getEngine()
    if (!engine) return
    const measure = engine.getScore().measures.find(m => m.number === clefAt.measure)
    const approxBeat = clefAt.beat ?? 0
    const change = measure?.clefs?.find(c => Math.abs(fracToNumber(c.beat) - approxBeat) < 1e-6)
    if (!change) return
    this.isDraggingClef = true
    this.draggedClefMeasure = clefAt.measure
    this.draggedClefBeat = change.beat
    this.draggedClefStartMeasure = clefAt.measure
    this.draggedClefStartBeat = change.beat
    this.clefDragStartTime = Date.now()
    engine.setLayoutFrozen(true)
    engine.setDraggingClef({ measure: clefAt.measure, beat: change.beat })
    event.preventDefault()
  }

  /**
   * ⭐ Arm the drag that walks a selected dynamic along its lane — the mouse twin of
   * `Ctrl+Shift+←/→` (his ask, 2026-08-18).
   *
   * ⚠️ **It arms on the SELECTING press, where the four span families arm on a press of an already
   * drawn square.** A dynamic has no handle but itself, so there is nothing to click first; what
   * separates a click from a drag is the same time threshold every other handle uses, applied on
   * MOVE. ⛔ That is also why this must not consume the press: the double-click that opens the text
   * editor has already been decided one branch above, and a plain click still selects.
   */
  /** ⭐ Arm the drag that walks a tempo mark — {@link armDynamicDrag}'s twin, and armed on the
   *  SELECTING press for its reason: the mark has no handle but itself. ⛔ It must not consume the
   *  press, or the double-click that opens the text editor (decided one branch above) would break. */
  private armTempoDrag(tempoId: string, event: MouseEvent): void {
    this.isDraggingTempo = true
    this.draggedTempoId = tempoId
    this.tempoDragChanged = false
    this.tempoDragLastX = null
    this.tempoDragStartTime = Date.now()
    event.preventDefault()
  }

  private armDynamicDrag(dynamicId: string, event: MouseEvent): void {
    this.isDraggingDynamic = true
    this.draggedDynamicId = dynamicId
    this.dynamicDragChanged = false
    this.dynamicDragLastX = null
    this.dynamicDragStartTime = Date.now()
    event.preventDefault()
  }

  /**
   * ⭐⭐ Arm the drag that moves a whole hairpin's INK — a press on the wedge's BODY (his ask,
   * 2026-08-18: *"we are not doing drag offset on the hairpin when no endpoint active"*).
   *
   * ⭐ **One wedge, two gestures, told apart by WHERE you grabbed it**: a square moves that end
   * through the music (a model write, audible), the body moves the drawing (an override, silent).
   * That is the arrows' own split arriving on the mouse — `Ctrl+Shift+←/→` versus the plain arrows,
   * and `nudgeSelectedHairpin`'s *nothing armed → the whole thing*.
   *
   * ⚠️ DECLINES to arm when the wedge's staff has no measured geometry: with no picture there is no
   * px→staff-space scale, and a guessed one would move a small staff's hairpin by the wrong amount.
   * The press stays an ordinary selection.
   */
  /**
   * ⭐⭐ Arm the drag that moves a whole TRILL — a press on the `tr` or its wiggle (his ask,
   * 2026-08-20: *"now the shape drag walking, and taking into consideration also the vertical axis
   * for the target"*).
   *
   * ⭐ **One ornament, two gestures, told apart by WHERE you grabbed it**: a SQUARE moves that end,
   * the BODY moves the whole thing — through the music sideways and up the ladder vertically. That
   * is the arrows' own split arriving on the mouse.
   *
   * ⚠️ DECLINES to arm when the ornament's staff has no measured geometry: with no picture there is
   * no px→staff-space scale, and a guessed one would move a small staff's trill by the wrong amount.
   * The press stays an ordinary selection.
   */
  private armTrillOffsetDrag(trillId: string, x: number, y: number, event: MouseEvent): void {
    const engine = this.getEngine()
    if (!engine || !trillStaffSpacePx(engine.getElementRegistry(), trillId)) return
    this.isDraggingTrillBody = true
    this.draggedTrillBodyId = trillId
    this.trillBodyLastX = x
    this.trillBodyLastY = y
    this.trillBodyDragChanged = false
    this.trillBodyDragStartTime = Date.now()
    event.preventDefault()
  }

  /** ⭐ Arm the drag that moves a whole OTTAVA — a press on the numeral or its dashed line (his ask,
   *  2026-08-21). ⛔ Declines when the bracket is not measurably drawn, exactly as the wedge's does:
   *  a gesture in pixels needs a staff-space size to convert them with. */
  private armOttavaOffsetDrag(ottavaId: string, x: number, y: number, event: MouseEvent): void {
    const engine = this.getEngine()
    if (!engine || !ottavaStaffSpacePx(engine.getElementRegistry(), ottavaId)) return
    this.isDraggingOttavaBody = true
    this.draggedOttavaBodyId = ottavaId
    this.ottavaBodyLastX = x
    this.ottavaBodyLastY = y
    this.ottavaBodyDragChanged = false
    this.ottavaBodyDragStartTime = Date.now()
    event.preventDefault()
  }

  /**
   * ⭐⭐ Arm the drag that moves a whole PEDAL — a press on either sign (his ask, 2026-08-21: *"lets do
   * the pedal shape drag walking, taking into account the y so we jump system"*).
   *
   * ⭐ **One pedal, two gestures, told apart by WHERE you grabbed it**: a SQUARE moves that sign
   * through the music, the BODY moves the pair — sideways, and onto another system vertically. The
   * arrows' own split arriving on the mouse.
   *
   * ⚠️ DECLINES to arm when the pedal's staff has no measured geometry: with no picture there is no
   * px→staff-space scale, and a guessed one would move a small staff's pedal by the wrong amount.
   */
  private armPedalOffsetDrag(pedalId: string, x: number, y: number, event: MouseEvent): void {
    const engine = this.getEngine()
    if (!engine || !pedalStaffSpacePx(engine.getElementRegistry(), pedalId)) return
    this.isDraggingPedalBody = true
    this.draggedPedalBodyId = pedalId
    this.pedalBodyLastX = x
    this.pedalBodyLastY = y
    this.pedalBodyDragChanged = false
    this.pedalBodyDragStartTime = Date.now()
    event.preventDefault()
  }

  private armHairpinOffsetDrag(hairpinId: string, x: number, y: number, event: MouseEvent): void {
    const engine = this.getEngine()
    if (!engine) return
    const spacePx = hairpinStaffSpacePx(engine.getElementRegistry(), hairpinId)
    if (!spacePx) return
    this.isDraggingHairpinBody = true
    this.draggedHairpinBodyId = hairpinId
    this.hairpinBodyLastX = x
    this.hairpinBodyLastY = y
    this.hairpinBodyDragChanged = false
    this.hairpinBodyDragStartTime = Date.now()
    event.preventDefault()
  }

  /**
   * ⭐⭐ Arm the drag that moves a whole SLUR's ink — a press on the ARC itself (his ask, 2026-08-18:
   * *"now the next step is doing this same offset controle by the drag mouse, similar to hairpin"*).
   * The hairpin body drag above, sentence for sentence: a HANDLE moves one point, the BODY moves the
   * drawing.
   *
   * ⚠️ DECLINES when the drawn curve offers no measured staff-space scale — `slurBodyStaffSpacePx`'s
   * rule, since a guessed one would move a small staff's slur by the wrong amount. The press stays an
   * ordinary selection.
   */
  private armSlurOffsetDrag(slurId: string, x: number, y: number, event: MouseEvent): void {
    const engine = this.getEngine()
    if (!engine) return
    const staffSpacePx = slurBodyStaffSpacePx(engine.getElementRegistry(), slurId)
    if (!staffSpacePx) return
    this.isDraggingSlurBody = true
    this.draggedSlurBodyId = slurId
    this.slurBodyAnchor = { x, y, staffSpacePx }
    this.slurBodyDragChanged = false
    this.slurBodyDragStartTime = Date.now()
    event.preventDefault()
  }

  /**
   * Record this press on a tempo mark / dynamic and answer whether it was the SECOND on the same
   * one inside the double-click window, consuming the pair when it was (so a third click is not
   * another double).
   *
   * ⚠️ Manual, not the native `dblclick` event: selecting re-renders the score on every mousedown,
   * which swaps the SVG nodes, so the two clicks land on different element instances and the
   * browser never fires it.
   */
  private pressIsDoubleClick(mark: 'tempo' | 'dynamic', id: string): boolean {
    const now = Date.now()
    const lastId = mark === 'tempo' ? this.lastTempoDownId : this.lastDynamicDownId
    const lastTime = mark === 'tempo' ? this.lastTempoDownTime : this.lastDynamicDownTime
    const isDouble = lastId === id && (now - lastTime) < this.DOUBLE_CLICK_MS
    const keptId = isDouble ? null : id // consume, so a 3rd click isn't another double
    if (mark === 'tempo') {
      this.lastTempoDownId = keptId
      this.lastTempoDownTime = now
    } else {
      this.lastDynamicDownId = keptId
      this.lastDynamicDownTime = now
    }
    return isDouble
  }

  // --- Mouse handlers ---

  handleMouseDown(event: MouseEvent): void {
    // Primary button only. A right-click is not an editing gesture — it opens the context menu
    // (src/menus) — and without this it would ALSO run this whole path: change the selection, arm a
    // drag, arm a box-select. The `click` event never fires for button 2, so only mousedown needed
    // guarding, which is exactly why this went unnoticed until there was a menu to notice it.
    if (event.button !== 0) return
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    // Armed paste: this click chooses the insertion point.
    if (this.state.pastePlacementArmed) { this.commitArmedPaste(event); return }
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    // A press on the viewport's own scrollbar/gutter targets the scroll container element
    // itself, not the SVG inside it. Ignore it — otherwise dragging the scrollbar would map
    // to empty space and clear the selection.
    if (event.target === scoreCanvas) return

    // Defensive reset: a stale pan flag must never outlive its gesture (see resetPanState).
    this.resetPanState()

    // Non-selection tools (entry/clef/dynamic/TS) do their placement in handleClick, not
    // here. Arm a pan on this empty-space press so a drag pans the view instead of placing;
    // a tap falls through to handleClick (which suppresses nothing). These tools have no
    // selection to clear, so pendingTapClearsSelection stays false.
    if (this.state.selectedTool !== 'selection') {
      this.armPan(event, false)
      return
    }

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const registry = engine.getElementRegistry()
    // Selection is resolved by each element's own rendered geometry, NOT by the
    // click's vertical staff band: a note/tuplet drawn far from its staff (ledger
    // lines, brackets) lands in a neighbouring band, so a band-derived measure would
    // pick the wrong line and miss the element. (Band resolution via pixelToMeasure
    // is still correct for note entry / clef tool / clef drag below.)
    const ctx: MouseDownCtx = {
      event, engine, registry,
      x: coords.x, y: coords.y,
      closestElement: registry.findClosestNoteOrRest(coords.x, coords.y),
      tupletAtClick: registry.getTupletAt(coords.x, coords.y),
    }

    // Multi-select and handle-drags run BEFORE the scalar sub-selection clear below,
    // so they keep the existing selection / selected slur intact through the gesture.
    if (this.handleModifierMouseDown(ctx)) return
    if (this.handleTupletMouseDown(ctx)) return
    if (this.handleSlurHandleMouseDown(ctx)) return
    // A press on one of a selected hairpin's blue squares ARMS that end. A pre-step for the slur
    // handles' reason and one of its own: a square can sit inside the box of the dynamic at the
    // wedge's mouth, and `DYNAMIC_ELEMENT` runs ahead of `HAIRPIN_ELEMENT` in the chain — a handle
    // you can see must win the press. The module owns everything but the repaint.
    if (armHairpinEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) moves that end. The square stays armed after either, so the arrows can carry on
      // from where the mouse stopped.
      const armed = selectedOf(this.state, 'hairpin')
      this.isDraggingHairpinEnd = true
      this.draggedHairpinId = armed?.id ?? null
      this.draggedHairpinEnd = armed?.endpoint
      this.hairpinDragChanged = false
      this.hairpinDragStartTime = Date.now()
      this.hairpinEndLastX = coords.x
      this.hairpinEndLastY = coords.y
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and the same for a selected OTTAVA's two squares. ⚠️ A pre-step for the hairpin's reason with
    // a different overlap behind it: the bracket sits on the outside-staff ladder directly above what
    // it clears, so a square can land inside a TRILL's or a TEMPO mark's box — and both run ahead of
    // `OTTAVA_ELEMENT` in the chain.
    if (armOttavaEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) re-anchors that end. The square stays armed after either, so the arrows can
      // carry on from where the mouse stopped.
      const armed = selectedOf(this.state, 'ottava')
      this.isDraggingOttavaEnd = true
      this.draggedOttavaId = armed?.id ?? null
      this.draggedOttavaEnd = armed?.endpoint
      this.ottavaDragChanged = false
      this.ottavaEndLastX = coords.x
      this.ottavaEndLastY = coords.y
      this.ottavaDragStartTime = Date.now()
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and a selected PEDAL's two squares. ⚠️ A pre-step with the strongest case of the three: the
    // pedal is the OUTERMOST below-staff family, so its squares sit beyond everything the ladder put
    // inside it — a dynamic, a hairpin, a trill, an octave line — and every one of those runs ahead
    // of `PEDAL_ELEMENT` in the chain.
    if (armPedalEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) moves that end through the music. The square stays armed after either, so the
      // arrows can carry on from where the mouse stopped.
      const armed = selectedOf(this.state, 'pedal')
      this.isDraggingPedalEnd = true
      this.draggedPedalId = armed?.id ?? null
      this.draggedPedalEnd = armed?.endpoint
      this.pedalDragChanged = false
      this.pedalEndLastX = coords.x
      this.pedalEndLastY = coords.y
      this.pedalDragStartTime = Date.now()
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and a selected TRILL's two squares (2026-08-18). ⚠️ A pre-step for the family's reason: the
    // ornament sits on the ladder between the octave bracket and the tempo mark, and BOTH run ahead
    // of `TRILL_ELEMENT` in the chain, so a square beyond the wiggle can land inside either's box.
    //
    // ⚠️ No drag is armed here, unlike the wedge's, the bracket's and the pedal's: these squares ARM
    // and nothing more for now (`trillHandles`), so there is no end for a drag to move.
    if (armTrillEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) re-anchors that end. The square stays armed after either, so the arrows can
      // carry on from where the mouse stopped.
      const armed = selectedOf(this.state, 'trill')
      this.isDraggingTrillEnd = true
      this.draggedTrillId = armed?.id ?? null
      this.draggedTrillEnd = armed?.endpoint
      this.trillDragChanged = false
      this.trillDragStartTime = Date.now()
      this.trillEndLastX = coords.x
      this.trillEndLastY = coords.y
      this.render.renderScore()
      event.preventDefault()
      return
    }
    if (this.handleStaffSpacingMouseDown(ctx)) return

    // Whatever was picked is gone; the handlers below each set what this press picked instead.
    // ⭐ ONE assignment — this used to be twelve fields, and the third of four clear-lists that had
    // to agree (it was the one missing the accidental, articulation, dot, stem and tremolo).
    this.state.selectedElement = null

    // Single-click element hit-tests, in priority order — one entry per selectable kind, each
    // consuming the press or declining it. ⭐ THE ORDER IS THE CONTENT and it lives in
    // {@link ELEMENT_HIT_ORDER}, with the comments that argue it: the dot before the note, the
    // tremolo before the stem, the barline last of all. Twelve `if`s here, and twelve bodies four
    // hundred lines below, said the same thing in two places that could disagree.
    for (const element of ELEMENT_HIT_ORDER) {
      if (element.hit(ctx, this.elementDeps)) return
    }
    this.handleNoteOrEmptyMouseDown(ctx)
  }

  /**
   * Ctrl/Cmd or Shift click → build a multi-selection. Always "consumes" the press when a modifier
   * is held (it never falls through to single-select), so returns true whenever additive/range is
   * active.
   *
   * ⭐ Ctrl/Cmd toggles NOTES, ARTICULATION groups and — since 2026-08-19 — the six MARK kinds the
   * set can hold (`./markGroupSelect`). Shift stays temporal: a range is an amount of MUSIC, and a
   * hairpin is not a position you can range from.
   */
  private handleModifierMouseDown(ctx: MouseDownCtx): boolean {
    const { event, registry, x, y, closestElement } = ctx
    // Modifier clicks build a multi-selection — they never clear the set and arm no drag, so a
    // press on empty space (or on a kind the set cannot hold) is a no-op:
    //   - Shift  → select the temporal range pivot→target (rests + whole chords),
    //              unioned onto the existing selection (range wins when both held).
    //   - Ctrl/Cmd → toggle the clicked note, articulation group or MARK in/out.
    const additive = event.ctrlKey || event.metaKey
    const range = event.shiftKey
    if (!(additive || range)) return false

    // Any modifier press dismisses a showing measure box — but capture the current span
    // FIRST so a Ctrl+Shift+click can extend from its anchor (re-set in selectMeasureBox).
    const prevRange = selectedOf(this.state, 'measureRange')
    if (prevRange) this.state.selectedElement = null

    // Ctrl+Shift+click on empty space inside a bar → Sibelius-style blue measure box.
    // Purely visual: NO objects are selected. Fires only when the click misses every
    // rendered element (strict registry hit-test), so Ctrl+Shift directly on a note
    // still range-extends the note selection below. A repeat click extends the span.
    if (additive && range) {
      const hitEl = registry.getAt(x, y)
      const hitTuplet = ctx.tupletAtClick?.tupletId ?? null
      // The registry also registers the staff/barline/beam as elements — those are
      // background/structure, not notational objects, so a click on them is still
      // "empty space" for the measure-box gesture. Only a real object blocks the box.
      const onObject = hitEl != null && !MEASURE_BOX_IGNORE_TYPES.has(hitEl.type)
      dbg(
        `⎇ Ctrl+Shift+click | pos:(${Math.round(x)},${Math.round(y)}) | ` +
        `element:${hitEl ? `${hitEl.type}#${hitEl.id ?? '?'}` : 'none'}` +
        `${hitEl && !onObject ? ' (background→empty)' : ''} | ` +
        `tuplet:${hitTuplet ?? 'none'}`,
      )
      if (!onObject && !hitTuplet) {
        if (this.selectMeasureBox(ctx, prevRange)) return true
      } else {
        dbg('  ↳ landed on an object — falling through to note range/toggle (no box)')
      }
    }

    // Ctrl/Cmd-click toggles an articulation GROUP into the multi-selection (so the
    // user can grab several articulations and delete/flip them all at once). Checked
    // before notes since a glyph sits right on its note head; Shift-range isn't
    // supported for articulations yet, so only `additive` arms this path.
    if (additive) {
      const artHit = articulationHit(x, y, closestElement, registry)
      if (artHit?.noteId) {
        this.selection.toggleArticulation(artHit.noteId)
        dbg(`✓ Articulation group toggled in selection | noteId:${artHit.noteId} | size:${this.state.selectedItems.size}`)
        this.render.renderScore()
        return true
      }
    }
    // ⭐ Ctrl/Cmd-click toggles a MARK into the group — a hairpin, a trill, a slur, a dynamic, an
    // 8va, a pedal (`./markGroupSelect`, which re-runs the press chain rather than re-asking where
    // the marks are). BEFORE the note fallback below, whose 30px reach would otherwise swallow a
    // press aimed at a wedge under the staff.
    if (additive) {
      const mark = markAtPress(ctx)
      if (mark) {
        this.selection.toggleMark(mark)
        dbg(`✓ ${mark.kind} toggled in selection | id:${mark.id} | size:${this.state.selectedItems.size}`)
        this.render.renderScore()
        return true
      }
    }
    if (closestElement && closestElement.id) {
      const bbox = closestElement.bbox
      const centerX = bbox.x + bbox.width / 2
      let elementY: number
      if (closestElement.type === 'note' && closestElement.pitch !== undefined && closestElement.measure !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, closestElement.measure, centerX, closestElement.staff)
        elementY = pitchY !== null ? pitchY : bbox.y + bbox.height / 2
      } else {
        elementY = bbox.y + bbox.height / 2
      }
      const distance = Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)
      if (distance < 30) {
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        if (range) {
          this.selection.extendSelectionTo(closestElement.id)
          dbg(`✓ Range extended to ${typeLabel} | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
        } else {
          this.selection.toggleNote(closestElement.id)
          dbg(`✓ ${typeLabel} toggled in selection | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
        }
        this.render.renderScore()
      }
    }
    return true
  }

  /**
   * Outline the clicked measure with the Sibelius-style blue double box. Returns false
   * (so the caller keeps looking) when the click, though empty of elements, doesn't land
   * inside any measure's rectangle — `pixelToMeasure` falls back to the nearest measure on
   * the line, which we don't want to hijack for a stray click below/above the staff.
   */
  private selectMeasureBox(ctx: MouseDownCtx, prevRange: { anchor: number; focus: number } | null): boolean {
    const { engine, x, y } = ctx
    const measure = engine.pixelToMeasure({ x, y })
    const rect = engine.getMeasureRect(measure)
    if (!rect) {
      dbg(`  ↳ no rect for measure ${measure} — box not drawn`)
      return false
    }
    const inside = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
    if (!inside) {
      dbg(
        `  ↳ click outside measure ${measure} rect ` +
        `(x:${Math.round(rect.x)}–${Math.round(rect.x + rect.width)}, ` +
        `y:${Math.round(rect.y)}–${Math.round(rect.y + rect.height)}) — box not drawn`,
      )
      return false
    }
    // GROW the span to include the clicked bar (union with the current span), so a
    // repeat Ctrl+Shift+click on either side only ever makes the selection bigger; a
    // click already inside the span is a no-op. Start a fresh single-bar span when none
    // is active. (To shrink/restart, plain-click first to clear, then Ctrl+Shift+click.)
    const lo = prevRange ? Math.min(prevRange.anchor, prevRange.focus, measure) : measure
    const hi = prevRange ? Math.max(prevRange.anchor, prevRange.focus, measure) : measure
    // The box stands alone — clear any prior selection first, then set the span
    // (deselectAll clears the element selection, so order matters: we set it AFTER).
    this.selection.deselectAll()
    this.state.selectedElement = {
      kind: 'measureRange',
      anchor: lo,
      focus: hi,
      // Which stacked staff the click fell on — the reference staff the "Staff:" add-above/below
      // buttons insert relative to (multi-staff Phase 4). N=1 → always 0.
      staff: engine.getElementRegistry().staffIndexAtY(measure, y),
      boxStyle: 'double',
    }
    dbg(
      lo === hi
        ? `✓ Measure box selected | measure:${measure}`
        : `✓ Measure span selected | measures:${lo}–${hi} (grew to include ${measure})`,
    )
    this.render.renderScore()
    return true
  }

  /**
   * Sibelius plain-click passage select: a tap on empty space inside a bar selects that
   * whole bar on the clicked staff — its notes/rests plus enclosed dynamics and slurs
   * (ties ride along via their notes) — and outlines it with a SINGLE blue box. Returns
   * false (→ caller clears the selection instead) when the tap doesn't land ON a staff:
   * horizontally outside the bar (`pixelToMeasure` snaps to the nearest bar on the line), or
   * vertically off the clicked staff's band — crucially the GAP BETWEEN STAVES, since the
   * bar's `getMeasureRect` spans all staves top-to-bottom and would otherwise grab a gap
   * click for whichever staff is nearest.
   */
  private selectMeasureAt(x: number, y: number): boolean {
    const engine = this.getEngine()
    if (!engine) return false
    const measure = engine.pixelToMeasure({ x, y })
    const rect = engine.getMeasureRect(measure)
    if (!rect) return false
    // Horizontal: within this bar's x-range (reject the nearest-bar snap for a click past
    // the last bar on a line).
    if (x < rect.x || x >= rect.x + rect.width) return false

    const registry = engine.getElementRegistry()
    const staff = registry.staffIndexAtY(measure, y)
    // Vertical: must land ON the clicked staff's own band (its five lines + a small ledger
    // margin, matching the drawn box). A click in the gap between staves — or well above/
    // below the system — is not on any staff, so it selects nothing and the caller clears.
    const geo = registry.getStaffGeometry(measure, staff)
    if (!geo) return false
    if (y < geo.lineYPositions[0] - STAFF_BAND_PAD_PX || y > geo.lineYPositions[4] + STAFF_BAND_PAD_PX) return false

    const score = engine.getScore()
    const m = score.measures.find(mm => mm.number === measure)
    if (!m) return false
    // Every note/rest on the clicked staff of this bar (rests included — a bar always has
    // content), AND every fanned member: selecting a bar means selecting what is in it, and a
    // member is a head with an id like any other. `getMeasureNotes` alone selected one note out
    // of six for a bar holding a fan — so the delete or copy that followed took one note out of
    // six. In beat order, so the anchor is genuinely the bar's last event (`measureSelectableNotes`).
    // These ids drive both the selection and the enclosed-dynamics/slurs pull.
    const ids = measureSelectableNotes(m, score).filter(n => staffOf(n) === staff).map(n => n.id)
    if (!ids.length) return false

    this.selection.selectMeasureContents(ids)
    // AFTER selectMeasureContents, which clears the element selection on its way through.
    this.state.selectedElement = {
      kind: 'measureRange', anchor: measure, focus: measure, staff, boxStyle: 'single',
    }
    dbg(`✓ Measure selected (plain click) | measure:${measure} staff:${staff} | items:${this.state.selectedItems.size}`)
    return true
  }

  /** Select a whole tuplet when the click is on its bracket/number (far enough from
   *  any of its notes); falls through (returns false) when the click is near a note. */
  private handleTupletMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, y, tupletAtClick } = ctx
    if (tupletAtClick && tupletAtClick.tupletId) {
      const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
      let minVerticalDistance = Infinity

      for (const note of tupletNotes) {
        if (note.pitch !== undefined && note.measure !== undefined) {
          const noteY = registry.pitchToPixelY(note.pitch, note.measure, note.bbox.x + note.bbox.width / 2, note.staff)
          if (noteY !== null) {
            const verticalDistance = Math.abs(y - noteY)
            minVerticalDistance = Math.min(minVerticalDistance, verticalDistance)
          }
        }
      }

      if (minVerticalDistance > 12) {
        this.state.selectedElement = { kind: 'tuplet', id: tupletAtClick.tupletId }
        this.state.selectedNoteId = null
        dbg(`✓ Tuplet selected on mousedown | id:${tupletAtClick.tupletId}`)
        this.render.renderScore()
        return true
      }
    }
    return false
  }

  /**
   * If a slur is already selected and the user grabbed one of its handle dots, arm a
   * reshape or endpoint-re-anchor drag. Runs before the selection clears so the slur
   * stays selected throughout the drag.
   */
  private handleSlurHandleMouseDown(ctx: MouseDownCtx): boolean {
    const { event, registry, x, y } = ctx
    const selectedSlur = selectedOf(this.state, 'slur')
    if (!selectedSlur) return false

    // ⭐⭐ ONE decision for all three handle families: the NEAREST one wins (`./slurHandlePick`).
    // This used to be three `.find()`s in a row, so a press that touched both an arc dot and an end
    // square always took the dot — his report, 2026-08-18: *"im trying to get the endpoint but i'm
    // getting the control point"*. The boxes genuinely overlap on a short slur.
    const pick = pickSlurHandleAt(registry, selectedSlur.id, x, y)

    // Slur control-point handle drag.
    // The handle carries its OWN segment's drag context (endpoints + control points +
    // staff spacing + segment address + span count), so we read everything straight off it
    // — no re-lookup of a 'slur' partial, which on a cross-system slur would ambiguously
    // resolve to the wrong segment (§4a). cpIndex disambiguates the two dots within it.
    if (pick?.kind === 'control') {
      const handle = pick.entry
      if (handle.cpIndex !== undefined && handle.slurEndpoints && handle.controlPoints) {
      this.isDraggingSlurHandle = true
      this.draggedSlurId = selectedSlur.id
      this.draggedCpIndex = handle.cpIndex
      this.draggedSlurEndpoints = handle.slurEndpoints
      // The keyboard nudge inverts the same math from the same registry fields, so the conversion
      // lives next to it (`./slurHandleNudge`) rather than being kept twice.
      this.draggedSlurBaselineCps = cpsFromDrawnControlPoints(handle.controlPoints, handle.slurEndpoints)
      this.draggedStaffSpacePx = handle.staffSpacePx ?? 10
      this.draggedSlurSegment = handle.segmentRole === undefined ? undefined
        : handle.segmentRole === 'middle' ? { role: 'middle', ordinal: handle.segmentOrdinal ?? 0 }
        : { role: handle.segmentRole }
      this.draggedSlurSpanCount = handle.slurSpanCount
      this.slurDragChanged = false
      this.slurDragStartTime = Date.now()
      // Grabbing a round (angle) handle PICKS that dot, and by construction disarms any armed
      // endpoint square — the two are different editing targets, so the arrows shouldn't keep
      // nudging an endpoint after you reach for the curve shape (slur-endpoint-offset-plan).
      // ⭐ The dot is recorded by segment as well as index so a cross-system slur lights the one you
      // grabbed rather than one per system, and re-rendered UNCONDITIONALLY (it used to repaint only
      // when a square had been armed) so the picked dot shows the moment you touch it.
      this.state.selectedElement = {
        kind: 'slur',
        id: selectedSlur.id,
        controlPoint: {
          cpIndex: handle.cpIndex,
          segmentRole: handle.segmentRole,
          segmentOrdinal: handle.segmentOrdinal,
        },
      }
      this.render.renderScore()
      dbg(`Slur handle drag ready | id:${handle.slurId} cp:${handle.cpIndex} seg:${handle.segmentRole ?? 'single'}${handle.segmentRole === 'middle' ? `#${handle.segmentOrdinal}` : ''}`)
        event.preventDefault()
        return true
      }
    }

    // Slur endpoint (square) handle drag — re-anchor the in/out point onto a
    // different note.
    if (pick?.kind === 'endpoint' && pick.entry.endpoint) {
      const endHandle = pick.entry
      this.isDraggingSlurEndpoint = true
      this.draggedEndpointSlurId = selectedSlur.id
      this.draggedEndpoint = endHandle.endpoint
      this.slurEndpointDragChanged = false
      this.slurEndpointDragStartTime = Date.now()
      // The drag carries the ink by the cursor's DELTA, so the gesture starts from where the press
      // landed — not from the square's centre, which would jerk the end by the grab offset.
      this.slurEndpointLastX = x
      this.slurEndpointLastY = y
      this.slurEndpointHoldPx = 0 // no note is holding the ink until this gesture reaches one
      this.slurEndpointDebtPx = 0
      this.slurEndpointGain = 1
      this.slurEndpointCursorTravel = 0
      this.slurEndpointInkTravel = 0
      // Click = select this point for keyboard nudging; drag (decided on move) re-anchors.
      // Either way the point stays armed afterward, so arrows can fine-tune it. Re-render so
      // the selected square's highlighted border shows immediately (slur-endpoint-offset-plan).
      // Arming a blue square disarms an orange one — one object, so that is now by construction
      // rather than a second line that had to remember.
      this.state.selectedElement = { kind: 'slur', id: selectedSlur.id, endpoint: endHandle.endpoint }
      this.render.renderScore()
      dbg(`Slur endpoint armed | id:${endHandle.slurId} end:${endHandle.endpoint}`)
      event.preventDefault()
      return true
    }

    // Slur SEGMENT endpoint (orange square) — an OPEN join of a cross-system slur. Click ARMS
    // it for keyboard nudging; there is NO drag/re-anchor (no note to anchor onto). Arming
    // disarms the blue endpoint (mutually exclusive). See
    // docs/multisystem-slur-segment-endpoint-offset-plan.md.
    if (pick?.kind === 'segmentEndpoint' && pick.entry.segmentRole) {
      const segEndHandle = pick.entry
      const role = segEndHandle.segmentRole
      this.state.selectedElement = {
        kind: 'slur',
        id: selectedSlur.id,
        segmentEndpoint:
          role === 'middle' ? { role: 'middle', ordinal: segEndHandle.segmentOrdinal!, side: segEndHandle.segmentSide! }
          : role === 'begin' ? { role: 'begin' }
          : { role: 'end' },
        segmentSpanCount: segEndHandle.slurSpanCount ?? 0,
      }
      this.render.renderScore()
      dbg(`Slur segment endpoint armed | id:${segEndHandle.slurId} role:${role}${role === 'middle' ? `#${segEndHandle.segmentOrdinal} ${segEndHandle.segmentSide}` : ''}`)
      event.preventDefault()
      return true
    }
    return false
  }

  /**
   * If a plain-click SINGLE measure box is already selected and this press lands inside its
   * band, arm a vertical drag that adjusts the staff's "space above" (Sibelius staff drag —
   * Client #7, docs/staff-spacing-plan.md §6). Runs before the selection clear so the box
   * stays selected through the drag; the box highlight follows live as the model re-renders.
   * Mirrors {@link handleSlurHandleMouseDown}: you first select the box, then grab it.
   */
  private handleStaffSpacingMouseDown(ctx: MouseDownCtx): boolean {
    const { engine, event, registry, x, y } = ctx
    const box = selectedOf(this.state, 'measureRange')
    if (!box || box.boxStyle !== 'single') return false
    const measure = box.anchor // single box: anchor === focus
    const rect = engine.getMeasureRect(measure)
    if (!rect) return false
    // Hit-test the exact drawn box: this bar's x-range × the selected staff's band (its five
    // lines + the same ±STAFF_BAND_PAD_PX the box and the plain-click select use).
    if (x < rect.x || x >= rect.x + rect.width) return false
    const staff = box.staff
    const geo = registry.getStaffGeometry(measure, staff)
    if (!geo) return false
    if (y < geo.lineYPositions[0] - STAFF_BAND_PAD_PX || y > geo.lineYPositions[4] + STAFF_BAND_PAD_PX) return false

    if (!this.armStaffSpacingDrag(engine, measure, y)) return false
    dbg(`Staff-spacing drag ready | measure:${measure} staff:${staff} baseline:${this.draggedSpacingBaseline} ss`)
    event.preventDefault()
    return true
  }

  /** Arm the vertical staff-spacing drag on the currently-selected single box's staff,
   *  capturing its current per-system `above` as the baseline and `startY` as the grab origin.
   *  `measure` fixes the target SYSTEM (per-system key). Shared by the "grab an already-selected
   *  box" path and the "select-and-grab in one press" path.
   *
   *  Works in BOTH views, but writes different things: in wrapped view the drag engraves a
   *  per-system override; in linear view it moves an ephemeral VIEW KNOB that persists nothing
   *  (docs/linear-view-plan.md §4.2b). Same gesture, and the engine decides which — so nothing
   *  keyed to a system can be written from a view that has no system worth naming (§4.1).
   *  @returns true if a drag was armed. */
  private armStaffSpacingDrag(engine: MusicEngine, measure: number, startY: number): boolean {
    const staff = selectedOf(this.state, 'measureRange')?.staff ?? 0
    this.isDraggingStaffSpacing = true
    this.draggedSpacingStaff = staff
    this.draggedSpacingMeasure = measure
    this.draggedSpacingBaseline = engine.getStaffSpacingAbove(staff, measure)
    this.draggedSpacingStartY = startY
    this.staffSpacingDragChanged = false
    this.staffSpacingDragStartTime = Date.now()
    return true
  }

  /**
   * Arm a bar-width drag on the grabbed barline: capture the room ONCE, off the last render
   * (docs/bar-width-plan.md §4–§6). Everything the gesture needs is fixed at this moment — the
   * slope, the measured floor, the ceiling — because a stretch changes no bar's *intrinsic* width,
   * so none of those terms move while the drag runs. That is what makes one capture correct rather
   * than merely cheap.
   *
   * **Declines silently** (leaving a plain selection) only when the room cannot be measured at all.
   *
   * ⚠️ It used to decline on a PINNED barline too — the one ending a system, held at the right
   * margin by justification, which cannot follow the pointer by any amount — on the reasoning that
   * a drag unable to track its own cursor should not start. Reported from use: stretch a bar until
   * it fills its system and it becomes **unshrinkable**, because from then on its barline is pinned
   * and no drag would arm. A gesture you can get into and not out of is worse than one that lags.
   * So it arms anyway and the room answers continuously (by the bar's own music rather than by its
   * immovable barline); the moment that shrink re-wraps the system, `reanchorIfRewrapped` picks the
   * tracking back up. Hiding the pointer for the gesture is what makes the untracked stretch
   * unnoticeable rather than wrong-feeling.
   */
  private armBarWidthDrag(engine: MusicEngine, measure: number, x: number): void {
    this.barWidthDrag = null
    this.barWidthDragChanged = false
    this.isDraggingBarWidth = false
    const room = engine.barWidthRoom(measure)
    if (!room) {
      // ⚠️ Was a silent return, and silence is the wrong answer here: from the outside a refusal
      // and a working drag that happens to have no room look identical — the barline lights up and
      // will not move. `barWidthRoom` declines on a dirty model, on a bar with nothing DRAWN (a
      // culled bar still has a hit-box: tier 1 registers every bar in the score), and on a bar with
      // no note space. `__barlines.boxes()` says which of those it is, for every bar at once.
      // ⚠️ Say WHICH of the three reasons it was. `barWidthRoom` returns a bare null — "I don't
      // know", by design — and the three causes are indistinguishable from the outside while
      // looking identical to the user: the barline lights up and will not move. Naming them here is
      // what turned "sometimes the drag dies" into a one-line diagnosis twice over.
      const registry = engine.getElementRegistry()
      const columns = registry.getByMeasure(measure)
        .filter(el => (el.type === 'note' || el.type === 'rest') && el.beat !== undefined).length
      dbg(`Bar width | bar ${measure} REFUSES the drag — no room. `
        + `painted:${registry.isPainted(measure, 0)} · drawn columns:${columns} · `
        + `geometry:${!!registry.getStaffGeometry(measure, 0)} · render stale:${engine.isRenderStale()} `
        + '— Try __barlines.boxes()')
      return
    }
    if (room.barlineSlope <= 0) {
      dbg(`Bar width | bar ${measure} ends its system — its barline is pinned, so the drag moves the bar's own music`)
    }
    this.barWidthDrag = { measure, room }
    this.barWidthDragStartX = x
    this.barWidthDragLineKey = engine.barWidthLineKey(measure)
    dbg(`Bar width | armed on bar ${measure} · now ×${engine.getBarWidth(measure).toFixed(3)} · `
      + `room ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
      + `barline slope ${room.barlineSlope.toFixed(3)} · line ${this.barWidthDragLineKey}`)
  }

  /**
   * Bar-width drag: the grabbed barline follows the cursor, and the bar to its LEFT takes or gives
   * up the room — with its music re-spaced proportionally, not pushed to one end.
   *
   * The px→stretch conversion is the room's own (`stretchForBarlineDelta`), which is why the
   * barline lands under the pointer instead of somewhere short of it: widening a bar also shrinks
   * its own justified share AND every bar's before it on the line. Continuous by contract — never
   * the keyboard's `stretchForStep`, which is allowed to jump the casting-off.
   *
   * Returns true while the drag owns the move.
   */
  private handleBarWidthDrag(engine: MusicEngine, x: number): boolean {
    // Armed-ness IS the guard: `barWidthDrag` is non-null only between the barline press and its
    // release, exactly like the other gestures' own flags.
    if (!this.barWidthDrag) return false
    const dx = x - this.barWidthDragStartX
    if (!this.isDraggingBarWidth) {
      if (Math.abs(dx) < this.NOTE_DRAG_THRESHOLD_PX) return false // still a click
      this.isDraggingBarWidth = true
      // Hide the pointer for the gesture. The barline follows it exactly until the system
      // re-wraps, and at that boundary the layout genuinely moves discontinuously — no arithmetic
      // can keep the line under a cursor that is still visible beside it. With the pointer gone the
      // barline IS the cursor, and the jump reads as the music re-flowing rather than as a slip.
      const canvas = this.getScoreCanvas()
      if (canvas) canvas.style.cursor = 'none'
    }
    const { measure, room } = this.barWidthDrag
    const target = room.stretchForBarlineDelta(dx)
    if (engine.previewBarWidth(measure, target, room.minStretch, room.maxStretch)) {
      this.barWidthDragBlocked = false
      this.barWidthDragChanged = true
      this.render.renderScore()
      this.reanchorIfRewrapped(engine, measure, x)
    } else if (!this.barWidthDragBlocked) {
      // Once per stall, not once per frame: a mousemove fires ~60×/s and the interesting event is
      // the TRANSITION into "the drag is armed and tracking, but the bar will not take the value".
      this.barWidthDragBlocked = true
      dbg(`Bar width | bar ${measure} not moving · asked ×${target.toFixed(3)} · `
        + `clamp ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
        + `now ×${engine.getBarWidth(measure).toFixed(3)} · dx ${dx.toFixed(1)}px`)
    }
    return true
  }

  /**
   * Re-take the room when the drag has RE-WRAPPED the system, and re-anchor to the pointer's
   * current x.
   *
   * The captured room describes one casting-off: `T`, `P` and the slope are sums over the bars
   * sharing the grabbed bar's line, and they hold only while that line holds the same bars. Push
   * one onto the next system and the formula stops describing the picture — measured, the barline
   * tracked the cursor to the pixel and then ran 21px ahead of it and stayed there, gaining more on
   * every further re-wrap.
   *
   * The plan (§5) avoided this by refusing to re-wrap at all. A key press showed that to be the
   * wrong trade — a gesture that seizes up at a boundary reads as broken — so the drag re-anchors
   * instead: one jump at the boundary, which is honest (the layout really did change
   * discontinuously, and every editor does it), then exact tracking again from wherever the barline
   * landed. Cheap, too: this only re-reads on the frames where the system actually re-wrapped.
   */
  private reanchorIfRewrapped(engine: MusicEngine, measure: number, x: number): void {
    const key = engine.barWidthLineKey(measure)
    if (key === null || key === this.barWidthDragLineKey) return
    const fresh = engine.barWidthRoom(measure)
    if (!fresh) return
    this.barWidthDrag = { measure, room: fresh }
    this.barWidthDragStartX = x
    this.barWidthDragLineKey = key
    dbg(`Bar width | system re-wrapped mid-drag — re-anchored on bar ${measure} (slope ${fresh.barlineSlope.toFixed(3)})`)
  }

  /** Finish a bar-width drag: one undo entry if the barline actually moved, then reset. */
  private endBarWidthDrag(): void {
    if (this.barWidthDragChanged) {
      const engine = this.getEngine()
      if (engine && this.barWidthDrag) {
        engine.commitBarWidth()
        dbg(`Bar width set | bar ${this.barWidthDrag.measure} → ×${engine.getBarWidth(this.barWidthDrag.measure).toFixed(3)}`)
      }
    }
    const canvas = this.getScoreCanvas()
    if (canvas) canvas.style.cursor = ''
    this.barWidthDrag = null
    this.barWidthDragChanged = false
    this.barWidthDragBlocked = false
    this.isDraggingBarWidth = false
    this.barWidthDragLineKey = null
  }

  /** Open the in-canvas text overlay over a tempo mark — the WHOLE mark, `Allegro (♩ = 144)`,
   *  as one editable string (TempoTextSource parses the model back out of it). `seedText` opens the
   *  box with different initial text than the model holds — `''` for the blank Ctrl+Alt+T flow. */
  private openTempoTextEditor(tempoId: string, isNew: boolean, seedText?: string): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit) return
    textEdit.open(new TempoTextSource(
      tempoId,
      isNew,
      engine,
      () => this.getScoreCanvas(),
      () => this.render.renderScore(),
      this.getZoom,
      seedText,
    ))
  }

  /**
   * The "insert a tempo" action — the tempo twin of {@link insertExpression}, and the one thing
   * Ctrl+Alt+T does. With a note/rest selected, place a tempo mark at its (measure, beat) and open
   * the edit box blank to type the whole mark; with nothing selected, arm the click-to-type tempo
   * tool (blue cursor) so the next canvas click places and edits one.
   */
  insertTempo(): void {
    if (this.state.selectedNoteId) this.editTempoOnSelection()
    else this.armTempoEntry()
  }

  /**
   * Ctrl+Alt+T with a note/rest selected: place a tempo mark at that element's (measure, beat) and
   * open the edit box blank. Tempo is system-level, so — unlike a dynamic — the mark carries NO
   * staffId and NO voice (it governs the clock, not the staff it was placed from). The placeholder
   * text only exists so the mark renders a measurable box; the box opens blank (seedText `''`) and,
   * being `isNew`, deletes the mark on an empty commit.
   */
  private editTempoOnSelection(): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit || this.state.editingText) return
    const noteId = this.state.selectedNoteId
    if (!noteId) return
    const note = engine.getNote(noteId)
    if (!note) return
    const created = engine.addTempoMark(note.measure, { beat: note.beat, text: DEFAULT_TEMPO_TEXT })
    if (!created) return
    // Render so the mark is in the DOM for TempoTextSource to measure; openTempoTextEditor then
    // suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTempoTextEditor(created.id, true, '')
    dbg(`✓ Insert tempo on selection: measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} (note ${noteId})`)
  }

  /**
   * Last resort: select the note/rest under the cursor (and arm a pitch drag for a note), or —
   * on empty staff space — hand off to {@link beginBoxSelectOrPan}: select the bar's box on this
   * press and arm the staff-spacing drag if it's on a staff, else arm a pan.
   */
  private handleNoteOrEmptyMouseDown(ctx: MouseDownCtx): void {
    const { engine, event, registry, x, y, closestElement } = ctx
    if (closestElement && closestElement.id) {
      // Gate on the note HEAD (or rest glyph), not a wide radius: clicking the empty
      // staff space around a note — e.g. a space below it to pan — must not select it.
      if (registry.hitsNoteOrRestBody(closestElement, x, y)) {
        this.selection.selectNote(closestElement.id)
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        dbg(`✓ ${typeLabel} selected on mousedown | id:${closestElement.id}`)
        this.render.renderScore()

        // Arm the drag on a note OR a rest. A rest used to arm nothing at all, because the only
        // gesture here was re-pitch and a rest has no pitch to drag; note spacing gave the
        // horizontal axis a meaning that applies to both — a rest occupies a column exactly as a
        // note does. Which axis this press turns out to be is decided later, from the movement.
        if (closestElement.type === 'note' || closestElement.type === 'rest') {
          const origNote = engine.getNote(closestElement.id)
          this.isDraggingNote = true
          this.noteDragAxis = 'undecided'
          this.noteDragStart = { x, y }
          this.draggedNoteOriginalPitch = origNote && origNote.step
            ? { step: origNote.step, alter: origNote.alter!, octave: origNote.octave! }
            : null
          this.armSpacingDrag(engine, origNote)
          dbg(`Drag ready | ${closestElement.type}:${closestElement.id}`)
          event.preventDefault()
        }
      } else {
        // Empty space (too far from any element): select-and-grab, or arm a pan.
        this.beginBoxSelectOrPan(ctx)
      }
    } else {
      // Empty space (no element at all): same — select-and-grab, or arm a pan.
      this.beginBoxSelectOrPan(ctx)
    }
  }

  /**
   * A press on empty staff space. If it lands ON a staff inside a bar, select that bar's SINGLE
   * box NOW — on mousedown, not release — and arm the vertical staff-spacing drag, so one
   * fluid press-drag both selects and adjusts the staff's "space above" (no select-then-regrab).
   * A press that misses every staff (the gap between staves, the margins, past the last bar)
   * has no box to grab, so it falls back to arming a pan whose tap-release clears the selection.
   *
   * This is why plain measure-select fires on DOWN: a tap that never drags still lands here,
   * selects the box, and — since the drag never crosses the move threshold — commits nothing
   * (endStaffSpacingDrag is a no-op), leaving exactly the old tap-to-select behavior.
   */
  private beginBoxSelectOrPan(ctx: MouseDownCtx): void {
    const { engine, event, x, y } = ctx
    if (this.selectMeasureAt(x, y)) {
      this.render.renderScore()
      this.armStaffSpacingDrag(engine, selectedOf(this.state, 'measureRange')!.anchor, y)
      event.preventDefault()
      return
    }
    // Not on a staff/bar: defer to a pan (drag pans; tap-release clears the selection).
    this.pendingTapCoords = { x, y }
    this.armPan(event, true)
  }

  handleMouseUp(_event: MouseEvent): void {
    // Note: a hand/grab pan release is resolved by the document-level handleDocPanUp, not
    // here — so it fires even when the pointer is released outside the viewport.
    if (this.isDraggingNote) {
      dbg(`Drag ended | note:${this.state.selectedNoteId}`)
      this.endNoteDrag()
    }
    if (this.isDraggingClef) {
      this.endClefDrag()
    }
    if (this.isDraggingSlurHandle) {
      this.endSlurHandleDrag()
    }
    if (this.isDraggingSlurEndpoint) {
      this.endSlurEndpointDrag()
    }
    if (this.isDraggingTempo) {
      this.endTempoDrag()
    }
    if (this.isDraggingDynamic) {
      this.endDynamicDrag()
    }
    if (this.isDraggingHairpinEnd) {
      this.endHairpinEndDrag()
    }
    if (this.isDraggingHairpinBody) {
      this.endHairpinBodyDrag()
    }
    if (this.isDraggingSlurBody) {
      this.endSlurBodyDrag()
    }
    if (this.isDraggingOttavaEnd) {
      this.endOttavaEndDrag()
    }
    if (this.isDraggingOttavaBody) {
      this.endOttavaBodyDrag()
    }
    if (this.isDraggingPedalBody) {
      this.endPedalBodyDrag()
    }
    if (this.isDraggingPedalEnd) {
      this.endPedalEndDrag()
    }
    if (this.isDraggingTrillBody) {
      this.endTrillBodyDrag()
    }
    if (this.isDraggingTrillEnd) {
      this.endTrillEndDrag()
    }
    if (this.isDraggingStaffSpacing) {
      this.endStaffSpacingDrag()
    }
    // Unconditional: an armed-but-never-moved press has state to clear too.
    if (this.barWidthDrag) {
      this.endBarWidthDrag()
    }
  }

  /** Finish a clef drag: record one undo entry if it actually moved, then reset. */
  private endClefDrag(): void {
    const engine = this.getEngine()
    const moved = this.draggedClefMeasure !== null && this.draggedClefBeat !== null
      && (this.draggedClefMeasure !== this.draggedClefStartMeasure
        || (this.draggedClefStartBeat !== null && !fracEq(this.draggedClefBeat, this.draggedClefStartBeat)))
    if (engine && moved && this.draggedClefMeasure !== null && this.draggedClefBeat !== null) {
      engine.commitClefMove(this.draggedClefMeasure, this.draggedClefBeat)
      dbg(`Clef moved | measure:${this.draggedClefMeasure} beat:${fracToNumber(this.draggedClefBeat)}`)
    }
    this.isDraggingClef = false
    this.draggedClefMeasure = null
    this.draggedClefBeat = null
    this.draggedClefStartMeasure = null
    this.draggedClefStartBeat = null
    this.clefDragStartTime = null
    // Clear the ghost, unfreeze, and re-render once so the layout settles (and a
    // redundant clef, now removed by commitClefMove, is gone) at its final spot.
    if (engine) {
      engine.setDraggingClef(null)
      engine.setLayoutFrozen(false)
      this.render.renderScore()
    }
  }

  /** Finish a slur-handle drag: record one undo entry if the shape changed, then reset. */
  private endSlurHandleDrag(): void {
    const engine = this.getEngine()
    if (engine && this.slurDragChanged) {
      engine.commitSlurShape()
      dbg(`Slur reshaped | id:${this.draggedSlurId}`)
    }
    this.isDraggingSlurHandle = false
    this.draggedSlurId = null
    this.draggedCpIndex = undefined
    this.draggedSlurEndpoints = null
    this.draggedSlurBaselineCps = null
    this.draggedSlurSegment = undefined
    this.draggedSlurSpanCount = undefined
    this.slurDragChanged = false
    this.slurDragStartTime = null
  }

  /**
   * Vertical staff-spacing drag: turn the cursor's Y travel since grab into a new "space
   * above" for the selected staff and preview it live (no undo until drop — mirrors the slur
   * handle). Screen-down (+dy) widens the space (pushes the staff and everything below it
   * down); the box highlight follows because the model re-renders each move. One staff-space
   * = the stored line spacing (px), so dy ÷ that is the delta in staff-spaces.
   */
  private handleStaffSpacingDrag(engine: MusicEngine, _x: number, y: number): boolean {
    if (!this.isDraggingStaffSpacing) return false
    if (this.staffSpacingDragStartTime !== null && Date.now() - this.staffSpacingDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const dy = y - this.draggedSpacingStartY
    const above = this.draggedSpacingBaseline + dy / this.draggedStaffSpacePx
    if (engine.previewStaffSpacing(this.draggedSpacingStaff, this.draggedSpacingMeasure, above)) {
      // Only a real change from the baseline arms the commit — so a press that never moves
      // vertically (a plain tap-to-select, or a horizontal wiggle) records no undo entry.
      if (above !== this.draggedSpacingBaseline) this.staffSpacingDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a staff-spacing drag: record one undo entry if it actually moved, then reset. */
  private endStaffSpacingDrag(): void {
    const engine = this.getEngine()
    if (engine && this.staffSpacingDragChanged) {
      engine.commitStaffSpacing()
      dbg(`Staff spacing set | staff:${this.draggedSpacingStaff} → ${engine.getStaffSpacingAbove(this.draggedSpacingStaff, this.draggedSpacingMeasure)} ss`)
    }
    this.isDraggingStaffSpacing = false
    this.staffSpacingDragChanged = false
    this.staffSpacingDragStartTime = null
  }


  /** Finish a tempo drag: record one undo entry if the mark actually moved, then reset. The mark
   *  stays selected — the drop ends the gesture, not the selection. */
  private endTempoDrag(): void {
    const engine = this.getEngine()
    if (engine && this.tempoDragChanged) {
      engine.commitTempoDrag()
      dbg(`Tempo mark dragged | id:${this.draggedTempoId}`)
    }
    this.isDraggingTempo = false
    this.draggedTempoId = null
    this.tempoDragChanged = false
    this.tempoDragLastX = null
    this.tempoDragStartTime = null
  }

  /** Finish a dynamic drag: record one undo entry if the mark actually moved, then reset. The mark
   *  stays selected — the drop ends the gesture, not the selection — so the arrows can carry on
   *  from where the mouse stopped. */
  private endDynamicDrag(): void {
    const engine = this.getEngine()
    if (engine && this.dynamicDragChanged) {
      engine.commitDynamicDrag()
      dbg(`Dynamic dragged | id:${this.draggedDynamicId}`)
    }
    this.isDraggingDynamic = false
    this.draggedDynamicId = null
    this.dynamicDragChanged = false
    this.dynamicDragLastX = null
    this.dynamicDragStartTime = null
  }

  /** Finish a hairpin-square drag: record one undo entry if the wedge actually moved, then reset.
   *  The square stays armed — the drop is the end of the gesture, not of the selection. */
  private endHairpinEndDrag(): void {
    const engine = this.getEngine()
    if (engine && this.hairpinDragChanged && this.draggedHairpinEnd) {
      engine.commitHairpinDrag(this.draggedHairpinEnd)
      dbg(`Hairpin ${this.draggedHairpinEnd} dragged | id:${this.draggedHairpinId}`)
    }
    this.isDraggingHairpinEnd = false
    this.draggedHairpinId = null
    this.draggedHairpinEnd = undefined
    this.hairpinDragChanged = false
    this.hairpinDragStartTime = null
  }

  /** Finish an ottava-square drag: record one undo entry if the bracket actually moved, then
   *  reset. The square stays armed — the drop ends the gesture, not the selection. */
  private endOttavaEndDrag(): void {
    const engine = this.getEngine()
    if (engine && this.ottavaDragChanged && this.draggedOttavaEnd) {
      engine.commitOttavaDrag(this.draggedOttavaEnd)
      dbg(`Ottava ${this.draggedOttavaEnd} dragged | id:${this.draggedOttavaId}`)
    }
    this.isDraggingOttavaEnd = false
    this.draggedOttavaId = null
    this.draggedOttavaEnd = undefined
    this.ottavaDragChanged = false
    this.ottavaDragStartTime = null
  }

  /** Finish a trill-square drag: record one undo entry if the ornament actually moved, then reset.
   *  The square stays armed — the drop ends the gesture, not the selection. */
  private endTrillEndDrag(): void {
    const engine = this.getEngine()
    if (engine && this.trillDragChanged && this.draggedTrillEnd) {
      engine.commitTrillDrag(this.draggedTrillEnd)
      dbg(`Trill ${this.draggedTrillEnd} dragged | id:${this.draggedTrillId}`)
    }
    this.isDraggingTrillEnd = false
    this.draggedTrillId = null
    this.draggedTrillEnd = undefined
    this.trillDragChanged = false
    this.trillDragStartTime = null
  }

  /** Finish a pedal-square drag: record one undo entry if the pedal actually moved, then reset. The
   *  square stays armed — the drop ends the gesture, not the selection. */
  private endPedalEndDrag(): void {
    const engine = this.getEngine()
    if (engine && this.pedalDragChanged && this.draggedPedalEnd) {
      engine.commitPedalDrag(this.draggedPedalEnd)
      dbg(`Pedal ${this.draggedPedalEnd} dragged | id:${this.draggedPedalId}`)
    }
    this.isDraggingPedalEnd = false
    this.draggedPedalId = null
    this.draggedPedalEnd = undefined
    this.pedalDragChanged = false
    this.pedalDragStartTime = null
  }

  /** Finish a slur-endpoint drag: record the one undo entry for the whole gesture, then reset. The
   *  end stays ARMED — the drop ends the gesture, not the selection — so the arrows carry on from
   *  where the hand stopped, which is the same road (`slurEndpointWalk`). */
  private endSlurEndpointDrag(): void {
    const engine = this.getEngine()
    if (engine && this.slurEndpointDragChanged) {
      engine.commitSlurEndpoint()
      dbg(`Slur endpoint dragged | id:${this.draggedEndpointSlurId} end:${this.draggedEndpoint}`)
    }
    this.isDraggingSlurEndpoint = false
    this.draggedEndpointSlurId = null
    this.draggedEndpoint = undefined
    this.slurEndpointDragChanged = false
    this.slurEndpointDragStartTime = null
  }

  handleClick(event: MouseEvent): void {
    // A pan just ended: swallow the trailing click so a drag in entry mode doesn't drop a
    // stray note on release. Consume the flag here; the defensive reset in handleMouseDown
    // covers the case where the browser never fires this click at all.
    if (this.suppressNextClick) { this.suppressNextClick = false; return }
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    // Armed paste (e.g. while in entry mode): this click chooses the insertion point.
    if (this.state.pastePlacementArmed) { this.commitArmedPaste(event); return }
    if (this.state.selectedTool === 'selection') return

    dbg(`Click RAW | client:(${event.clientX},${event.clientY})`)

    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) {
      dbg('✗ Click ignored: engine or canvas not ready')
      return
    }
    // Scrollbar/gutter clicks target the scroll container element itself, not the SVG —
    // ignore them so using the scrollbar in entry mode doesn't plant a stray note.
    if (event.target === scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) {
      dbg('✗ Click ignored: SVG not found')
      return
    }

    const coords = this.clientToSvg(event, svg)
    if (!coords) {
      dbg('✗ Click ignored: no CTM')
      return
    }
    const { x, y } = coords

    const registry = engine.getElementRegistry()
    const measureNum = engine.pixelToMeasure({ x, y })

    // Marking tools place at the click; each returns true if it consumed the click.
    if (this.placeTimeSignatureAtClick(engine, measureNum)) return
    if (this.placeClefAtClick(engine, x, y, measureNum)) return
    if (this.placeDynamicAtClick(engine, x, y, measureNum)) return
    if (this.placeDynamicEntryAtClick(engine, x, y, measureNum)) return
    if (this.placeTempoAtClick(engine, x, measureNum)) return
    if (this.placeTempoEntryAtClick(engine, x, measureNum)) return
    if (this.stampArticulationAtClick(engine, registry, x, y)) return
    if (this.stampAccidentalAtClick(engine, registry, x, y)) return
    if (this.stampTieAtClick(engine, registry, x, y)) return
    if (this.stampDotAtClick(engine, registry, x, y)) return
    if (this.stampTremoloAtClick(engine, registry, x, y)) return
    if (this.stampRestAtClick(engine, x, y)) return
    // The feather stamp's whole click lives in its own module (interactions/fanStamp); this is the
    // row that gives it a turn.
    if (stampFanAtClick(this.state, engine, x, y, () => this.render.renderScore())) return
    // The slur stamp's click lives in its own module too (interactions/slurStamp); this is its turn.
    if (stampSlurAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampHairpinAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    // …and the trill's (interactions/trillStamp). Last of the spanner stamps; each answers only for
    // its own armed tool, so the order among them decides nothing.
    if (stampTrillAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampOttavaAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampPedalAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return

    // No marking tool armed → note/tuplet entry.
    this.placeNoteAtClick(engine, registry, x, y, measureNum)
  }

  /**
   * Time-signature tool: set/change the measure's time signature (always at beat 0).
   * Propagation + rest reconcile are handled by the engine.
   */
  private placeTimeSignatureAtClick(engine: MusicEngine, measureNum: number): boolean {
    const armed = armedTool(this.state, 'timeSignature')
    const ts = armed?.timeSignature
    if (!ts) return false
    try {
      // The meter, its cautionary and its pickup are ONE act, and the engine owns the sequence —
      // shared with the apply-to-selected-bar path (PaletteController.armTimeSignature), so a click
      // and an OK on a chosen bar cannot drift apart.
      const changed = engine.applyTimeSignatureChange(measureNum, armed)
      dbg(changed
        ? `✓ Time signature set | ${ts.numerator}/${ts.denominator} at measure ${measureNum}`
        : `Time signature unchanged at measure ${measureNum}`)
    } catch (e) {
      console.warn(`✗ Time signature ${ts.numerator}/${ts.denominator} rejected:`, e)
    }
    this.render.renderScore()
    return true
  }

  /**
   * Clef tool: set/change the clef at the nearest slot boundary. A clef change anchors
   * to a slot (beat 0 = the measure's opening clef, drawn at the barline; beat > 0 = an
   * inline mid-measure clef before that slot).
   */
  private placeClefAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    const armed = armedTool(this.state, 'clef')
    const clef = armed?.clef
    if (!clef) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // Anchor the clef to the staff the click landed on (else it changes staff 0's clef).
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const changed = engine.setClefAt(measureNum, beat, clef, staff)
    // The courtesy decision belongs to the change just made. Only written when the arming path
    // carried an opinion, so the older palette path leaves the flag as it found it.
    if (armed.cautionary !== undefined) engine.setCautionaryClefAllowed(measureNum, staff, armed.cautionary)
    dbg(changed
      ? `✓ Clef set | ${clef} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`
      : `Clef unchanged at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    this.render.renderScore()
    return true
  }

  /**
   * Dynamics tool: place a dynamic at the nearest slot boundary. A level mark is
   * interpreted (drives playback); the `'text'` tool drops a silent custom mark.
   * Always placed below the staff.
   *
   * ⭐⭐ SCOPE SEAM: the placed mark carries **NO `voice`, which means it governs EVERY voice of
   * the staff it landed on** (`utils/dynamicScope`, docs/dynamic-voice-scope-plan.md) — the
   * ordinary notation rule, and what the user asked for: *"the default is that it affect ALL"*.
   *
   * ⚠️ This used to write a hardcoded `voice: 0`, and the note here predicted the wrong fix — that
   * the literal would one day be *sourced from a selector*. It should not be sourced at all: the
   * entry voice says which stream you are TYPING INTO, and a dynamic is not typed into a stream.
   * Narrowing the scope is a deliberate second act (`Alt+1…4` on the selected mark), never the
   * by-product of what the palette happened to have armed when the click landed.
   */
  private placeDynamicAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    const tool = armedTool(this.state, 'dynamic')?.dynamic
    if (!tool) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // Anchor the mark to the STAFF the click landed on (else it renders on staff 0).
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const staffId = engine.staffIdForIndex(staff)
    const staffParam = staffId ? { staffId } : {}
    engine.addDynamic(measureNum, { beat, text: dynamicTextFromTool(tool), placement: 'below', ...staffParam })
    dbg(`✓ Dynamic ${tool} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    this.render.renderScore()
    return true
  }

  /**
   * Ctrl+E expression-entry tool (armed with nothing selected): the click places a custom-text
   * dynamic on the nearest slot of the clicked bar/staff and opens the inline editor BLANK to type
   * it — the click-to-place twin of {@link editDynamicOnSelection}. Single-shot: it disarms back to
   * selection mode (this is expression entry, not a repeat stamp). The placeholder text only exists
   * so the mark renders a real box for the overlay to position against; the editor opens blank
   * (seedText `''`) and, being `isNew`, deletes the mark on an empty commit.
   */
  private placeDynamicEntryAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    if (!armedTool(this.state, 'dynamicEntry')) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const staffId = engine.staffIdForIndex(staff)
    const staffParam = staffId ? { staffId } : {}
    const created = engine.addDynamic(measureNum, { beat, text: DEFAULT_DYNAMIC_TEXT, placement: 'below', ...staffParam })
    // Disarm to selection mode either way — the click is consumed. (Reassign, never mutate: the
    // observable Proxy only traps the SET.)
    this.state.selectedMarkingTool = null
    this.state.selectedTool = 'selection'
    if (!created) { this.render.renderScore(); return true }
    // Render so registerDynamics stores the mark's bbox; openTextEditor snapshots its position, then
    // immediately suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTextEditor(created.id, true, '')
    dbg(`✓ Expression entry: dynamic at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    return true
  }

  /**
   * Ctrl+Alt+T tempo-entry tool (armed with nothing selected): the click places a tempo mark at the
   * nearest slot of the clicked bar and opens the edit box BLANK to type it — the click-to-place twin
   * of {@link editTempoOnSelection}. Single-shot: it disarms back to selection mode. NO staff (tempo
   * is system-level); the placeholder text only exists so the mark renders a measurable box.
   */
  private placeTempoEntryAtClick(engine: MusicEngine, x: number, measureNum: number): boolean {
    if (!armedTool(this.state, 'tempoEntry')) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    const created = engine.addTempoMark(measureNum, { beat, text: DEFAULT_TEMPO_TEXT })
    // Disarm to selection mode either way — the click is consumed. (Reassign, never mutate.)
    this.state.selectedMarkingTool = null
    this.state.selectedTool = 'selection'
    if (!created) { this.render.renderScore(); return true }
    // Render so the mark is in the DOM for TempoTextSource to measure; openTempoTextEditor then
    // suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTempoTextEditor(created.id, true, '')
    dbg(`✓ Tempo entry: mark at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
    return true
  }

  /**
   * Tempo tool: place the armed mark at the nearest slot boundary of the clicked bar.
   *
   * NO staff and NO voice, deliberately — unlike `placeDynamicAtClick`, which anchors the
   * mark to the staff the click landed on. A tempo mark governs the clock, so clicking any
   * staff of a grand staff places ONE system-level mark (rendered above the top staff).
   * The armed preset carries the word/unit/bpm; the click supplies only the beat.
   */
  private placeTempoAtClick(engine: MusicEngine, x: number, measureNum: number): boolean {
    const tool = armedTool(this.state, 'tempo')?.tempo
    if (!tool) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // The TOOL is a form (word? metronome? bracketed?); the MARK is the text that form produces.
    // `tempoFieldsFromTool` is the one place the two meet — from then on the string is the truth,
    // and deleting the brackets in the editor deletes them for good. The ghost preview goes
    // through it too, so what you see under the cursor is what gets engraved.
    const created = engine.addTempoMark(measureNum, { beat, ...tempoFieldsFromTool(tool) })
    if (created) {
      dbg(`✓ Tempo ${tempoLabel(created)} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
    }
    this.render.renderScore()
    return true
  }

  /**
   * Articulation stamp tool: add the armed articulation(s) to the note clicked. Only a real note
   * counts — a rest, empty staff space, or any other element is a no-op (but still consumes the
   * click, since the tool is armed). Uses the same note-body hit-test as selection-mode clicks
   * ({@link ElementRegistry.hitsNoteOrRestBody}), so clicking near-but-not-on a note does nothing.
   * Only the armed articulations the note LACKS are added (adding one it already has is meaningless);
   * the additions land as ONE undo entry via runBatch. Returns true whenever the stamp tool is armed
   * (the click is ours either way).
   */
  private stampArticulationAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const types = armedTool(this.state, 'articulation')?.types
    if (!types?.length) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Articulation stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Articulation stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    const missing = types.filter(t => !note.articulations?.includes(t))
    if (missing.length === 0) {
      dbg(`· Articulation stamp: note ${noteId} already has ${types.join('+')} — no change`)
      return true
    }
    engine.runBatch(`Add ${missing.join('+')}`, () => {
      for (const t of missing) engine.toggleArticulation(noteId, t) // each adds (note lacks it)
    })
    dbg(`✓ Articulation stamped | ${missing.join('+')} on note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Accidental stamp tool: a click SETS the armed accidental on the hovered note, changing its
   * pitch (existing notes only). Mirrors {@link stampArticulationAtClick} — same note-body hit-test,
   * one `runBatch` = one undo — but SINGLE-valued and IDEMPOTENT: clicking a note that already shows
   * that accidental does nothing (removal is the Delete key, not a re-stamp). Consumes any click
   * while the tool is armed (returns true) so a near-miss doesn't fall through to note entry.
   */
  private stampAccidentalAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const accidental = armedTool(this.state, 'accidental')?.sign
    if (!accidental) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Accidental stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Accidental stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (engine.noteDisplaysAccidental(noteId, accidental)) {
      dbg(`· Accidental stamp: note ${noteId} already shows ${accidental} — no change`)
      return true
    }
    engine.runBatch(`Set ${accidental}`, () => engine.setNoteAccidental(noteId, accidental))
    dbg(`✓ Accidental stamped | ${accidental} on note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Tremolo stamp tool: a click puts the armed tremolo on the note clicked. Mirrors
   * {@link stampAccidentalAtClick} — one `runBatch` = one undo, SINGLE-valued and IDEMPOTENT (a note
   * already carrying that mark is a no-op; a note carrying a DIFFERENT one is replaced, because a
   * note has one tremolo).
   *
   * ⚠️ THE ONE STAMP WITH TWO TARGETS: the notehead **or the stem**. Every other stamp takes the
   * head alone, because that is where its mark lands. A tremolo's strokes ride the STEM, so that is
   * where the pointer naturally goes — insisting on the head would mean aiming at one place to put
   * ink in another. The head test runs first and unchanged (a click there still resolves by nearest
   * note); {@link ElementRegistry.findStemAt} is the second chance, and it hits the stem's OWN
   * registered rect — a containment test, not a nearest-note one, because a click at the top of a
   * stem is a whole stem-length from its own notehead, which is exactly where "nearest" picks the
   * wrong note.
   *
   * A REST is refused: you cannot tremolo silence. The click is still consumed — the tool is armed,
   * so a near-miss must not fall through to note entry.
   *
   * No playability ceiling, and none is needed: past the unmeasured threshold nothing is scheduled
   * as a subdivision at all, so there is no absurd note value to guard against (docs/tremolo-plan.md
   * §2). A ceiling would also be unenforceable — shortening the note afterwards recreates the same
   * combination with no stamp in sight.
   */
  private stampTremoloAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const tremolo = armedTool(this.state, 'tremolo')?.tremolo
    if (tremolo === undefined) return false

    const nearest = registry.findClosestNoteOrRest(x, y)
    const onHead = nearest && registry.hitsNoteOrRestBody(nearest, x, y)
    // A stem carries `noteId`, never `id` (a stem must never answer a lookup for its note).
    const noteId = onHead ? nearest.id : registry.findStemAt(x, y)?.noteId
    if (!noteId) {
      dbg(`· Tremolo stamp: click not on a notehead or stem — no change`)
      return true
    }
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Tremolo stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (note.tremolo === tremolo) {
      dbg(`· Tremolo stamp: note ${noteId} already has tremolo ${tremolo} — no change`)
      return true
    }
    engine.runBatch(`Set tremolo ${tremolo}`, () => engine.setTremolo(noteId, tremolo))
    dbg(`✓ Tremolo stamped | ${tremolo} on note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Tie stamp tool: a click TIES the note clicked to the next slot in its own voice and staff (the
   * engine resolves the target — same pitch where there is one, else a let-ring tie into whatever
   * is there). Mirrors {@link stampAccidentalAtClick} — same note-body hit-test, one `runBatch` =
   * one undo, IDEMPOTENT: clicking an already-tied note does nothing, because a stamp only ever
   * ADDS (removal is Delete, or the Keypad with the tie itself selected). A note with nothing after
   * it is a no-op too — `toggleTie` finds no candidate and returns null. Consumes any click while
   * the tool is armed (returns true) so a near-miss doesn't fall through to note entry.
   */
  private stampTieAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    if (!armedTool(this.state, 'tie')) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Tie stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Tie stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (note.tiedTo) {
      dbg(`· Tie stamp: note ${noteId} is already tied — no change`)
      return true
    }
    // toggleTie commits its own undo entry; runBatch keeps the stamp's shape identical to its
    // siblings (one click = one undo) and is what marks the model dirty for the repaint.
    engine.runBatch('Add tie', () => engine.toggleTie(noteId))
    dbg(`✓ Tie stamped | from note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Dot stamp tool: a click DOTS the note clicked. Mirrors its siblings — same note-body hit-test,
   * one `runBatch` = one undo, IDEMPOTENT (an already-dotted note is a no-op, since a stamp only
   * ever adds; removal is Delete or the Keypad with the dots selected).
   *
   * The one stamp that ALSO applies to RESTS: a rest takes a dot exactly as a note does, so there is
   * no `isRest` guard here. Dotting can still be REFUSED when it does not fit (a dotted rest needs
   * 3 beats where 2 remain, and the bar reflows around what does fit) — the model coerces `dots`
   * back to 0 rather than throwing, so report what actually happened instead of assuming.
   */
  private stampDotAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    if (!armedTool(this.state, 'dot')) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Dot stamp: click not on a note or rest — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note) {
      dbg(`· Dot stamp: non-note — no change`)
      return true
    }
    if (note.dots) {
      dbg(`· Dot stamp: ${noteId} already has ${note.dots} dot(s) — no change`)
      return true
    }
    engine.runBatch('Add dot', () => engine.updateNote(noteId, { dots: 1 }))
    if (engine.getNote(noteId)?.dots) dbg(`✓ Dot stamped | on ${note.isRest ? 'rest' : 'note'} ${noteId}`)
    else dbg(`· Dot stamp: no room to dot ${noteId} — the bar cannot hold the longer value`)
    this.render.renderScore()
    return true
  }

  /**
   * Rest stamp tool: a click PLACES a rest of the armed length at that position, replacing what it
   * covers. It is note entry with `isRest`, and behaves like it — click anywhere in the bar, not on
   * a glyph. (See MusicEngine.stampRestAtPosition for why it is not a hit-test.)
   *
   * Still the odd one out among the stamps: the others ADD a mark to the note clicked and are
   * idempotent; this one replaces the slot, so clicking a note destroys it. That is the point.
   *
   * The cursor's Y picks only the STAFF — a rest has no pitch, so the click chooses a slot and the
   * rest lands at its standard height. The ghost floats with the pointer to show WHAT is being
   * placed, the same split every stamp makes (the accidental ghost hovers, then lands on a note).
   */
  private stampRestAtClick(engine: MusicEngine, x: number, y: number): boolean {
    if (!armedTool(this.state, 'rest')) return false

    const rest = engine.stampRestAtPosition(
      { x, y },
      this.state.selectedDuration,
      this.state.selectedDots,
      activeVoiceToModel(this.state.activeVoice),
    )
    if (rest) {
      dbg(`✓ Rest stamped | ${rest.duration}${'.'.repeat(rest.dots ?? 0)} at m${rest.measure} b${fracToNumber(rest.beat).toFixed(3)}`)
      // PLACING something is what ends keyboard entry — not arming the tool (see armMarkingTool).
      // The caret is `selectedNoteId` in entry mode, so dropping it takes the caret down and leaves
      // you stamping with the mouse, which is what you just did. The tool stays armed: a stamp is
      // used in runs, and you have said nothing about being finished with it.
      this.state.selectedNoteId = null
      this.render.renderScore()
    }
    return true
  }

  /** Default click action when no marking tool is armed: enter a note or tuplet. */
  private placeNoteAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number, measureNum: number): void {
    const nearestElement = registry.findNearestNoteOrRest(x, measureNum)
    const elementAt = registry.getAt(x, y)
    dbg(`Click | svg:(${x.toFixed(0)},${y.toFixed(0)}) measure:${measureNum} | nearestElement:`, nearestElement ? {
      type: nearestElement.type,
      beat: nearestElement.beat,
      bbox: `(${nearestElement.bbox.x.toFixed(0)},${nearestElement.bbox.y.toFixed(0)}) ${nearestElement.bbox.width.toFixed(0)}x${nearestElement.bbox.height.toFixed(0)}`,
    } : null, '| elementAt:', elementAt?.type || null)

    try {
      if (this.state.armedTuplet) {
        const score = engine.getScore()
        const measure = score.measures.find(m => m.number === measureNum)
        const barQuarters = measure
          ? measureCapacityQuarters(measure)
          : 4
        const position = engine.pixelToPosition({ x, y }, barQuarters)
        const existingTuplet = engine.getTupletAtBeat(measureNum, position.beat, activeVoiceToModel(this.state.activeVoice))

        if (existingTuplet) {
          dbg(`Tuplet mode: clicking inside existing tuplet at beat ${fracToNumber(position.beat).toFixed(3)}, adding note instead`)
          const note = engine.addNoteAtPosition(
            { x, y },
            this.state.selectedDuration,
            this.state.selectedAccidental || undefined,
            this.state.selectedDots || undefined,
            this.getPendingArticulations(),
            this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
            activeVoiceToModel(this.state.activeVoice),
            this.state.selectedTremolo ?? undefined,
          )

          if (note) {
            const pitch = note.isRest ? 'rest' : formatPitch(note)
            dbg(`✓ Note added to tuplet | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
            this.selection.moveCaretTo(note.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            dbg('✗ Note NOT added to tuplet (collision or invalid location)')
          }
        } else {
          // Spell the first note against the CLICKED staff's clef (bass 2nd staff ≠ treble).
          const tupletStaff = registry.staffIndexAtY(measureNum, y)
          const naturalSpelling = registry.pixelYToPitch(y, measureNum, x, tupletStaff)
          const spelling: PitchSpelling = naturalSpelling
            ? { ...naturalSpelling, alter: accidentalToAlter(this.state.selectedAccidental) }
            : { step: 'B', alter: 0, octave: 4 }

          // M is decided HERE, not when the key was pressed: `Ctrl+5` says "a 5", and what a 5 is in
          // the time of comes from the meter of the bar being clicked (see armedTupletM).
          const notesOccupied = armedTupletM(
            this.state.armedTuplet,
            this.state.selectedDuration,
            this.state.selectedDots,
            (measure ?? score.measures[0]).timeSignature,
            position.beat,
          )

          const result = engine.createTupletAtPosition(
            { x, y },
            this.state.selectedDuration,
            spelling,
            this.state.armedTuplet.numNotes,
            notesOccupied,
            activeVoiceToModel(this.state.activeVoice),
            this.state.selectedDots,
            armedNormalSide(this.state.armedTuplet),
            this.state.armedTuplet.format,
          )

          if (result) {
            const fn = result.firstNote
            const fnPitch = formatPitch(fn)
            dbg(`✓ Tuplet created | tupletId:${result.tuplet.id} firstNote:${fnPitch} measure:${fn.measure} beat:${fracToNumber(fn.beat).toFixed(3)}`)
            // The group exists now, so the ratio has been spent: the clicks that follow fill it as
            // ordinary notes (see spendArmedTuplet). Entry mode STAYS — you are still writing.
            spendArmedTuplet(this.state)
            this.selection.moveCaretTo(result.firstNote.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            dbg('✗ Tuplet NOT created (collision or invalid location)')
          }
        }
      } else {
        const note = engine.addNoteAtPosition(
          { x, y },
          this.state.selectedDuration,
          this.state.selectedAccidental || undefined,
          this.state.selectedDots || undefined,
          this.getPendingArticulations(),
          this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
          activeVoiceToModel(this.state.activeVoice),
          // The armed entry tremolo — read straight off state like the duration/accidental/dots
          // beside it, so the entered note is BORN with the mark (one undo entry, and the
          // cross-barline split carries it to every piece).
          this.state.selectedTremolo ?? undefined,
        )

        if (note) {
          const pitch = note.isRest ? 'rest' : formatPitch(note)
          dbg(`✓ Note added | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
          this.selection.moveCaretTo(note.id)
          this.state.selectedTool = 'entry'
          this.render.renderScore()
        } else {
          dbg('✗ Note NOT added (collision or invalid location)')
        }
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Cannot add note: ' + (error as Error).message)
    }
  }

  handleMouseMove(event: MouseEvent): void {
    // 🚨 **THE BUTTON CAME UP WHERE WE COULD NOT SEE IT.** A release outside the BROWSER WINDOW fires
    // no `mouseup` anywhere — not on the canvas and not on `document` — so the drag would still be
    // armed when the hand comes back, and the wedge (or note, or slur) would follow a pointer with
    // no button held. His report, 2026-08-20. `buttons` is the truth every move carries: 0 means
    // nothing is pressed, whatever we last saw.
    if (event.buttons === 0 && this.isMouseButtonDown) {
      this.isMouseButtonDown = false
      this.handleMouseUp(event)
    }
    if (this.state.editingText) return // modal: suppress ghost/preview while a text edit is open
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    this.lastCanvasMousePosition = { x, y }

    // ⭐ An armed paste draws NOTHING at the pointer — his call, 2026-08-19: *"we dont need the green
    // carret, just the arrow"*. The blue place-cursor (`scoreCursorClass`) is the whole indicator,
    // so a move costs no render at all where the caret used to force one per frame. The guard stays:
    // an armed paste must not draw a TOOL ghost underneath itself either.
    if (this.state.pastePlacementArmed) return

    // Live drag gestures — each returns true if it owns the move.
    if (this.handleBarWidthDrag(engine, x)) return
    if (this.handleNoteDrag(engine, x, y)) return
    if (this.handleSlurHandleDrag(engine, x, y)) return
    if (this.handleTempoDrag(engine, x, y)) return
    if (this.handleDynamicDrag(engine, x, y)) return
    if (this.handleHairpinEndDrag(engine, x, y)) return
    if (this.handleHairpinBodyDrag(engine, x, y)) return
    if (this.handleSlurBodyDrag(engine, x, y)) return
    if (this.handleOttavaEndDrag(engine, x, y)) return
    if (this.handleOttavaBodyDrag(engine, x, y)) return
    if (this.handlePedalEndDrag(engine, x, y)) return
    if (this.handlePedalBodyDrag(engine, x, y)) return
    if (this.handleTrillEndDrag(engine, x, y)) return
    if (this.handleTrillBodyDrag(engine, x, y)) return
    if (this.handleSlurEndpointDrag(engine, x, y)) return
    if (this.handleStaffSpacingDrag(engine, x, y)) return
    if (this.handleClefDrag(engine, x, y)) return

    // A hand/grab pan is armed: bail before the ghost/preview logic. The pan itself is
    // driven by the document-level handlers (handleDocPanMove) so it keeps working when
    // the pointer leaves the viewport — this element handler only needs to not draw a
    // ghost note underneath the gesture.
    if (this.isPanArmed) return

    if (this.state.selectedTool === 'selection') return
    if (this.isMouseButtonDown) return

    // No throttle: since P4 the ghost is an overlay, so following the cursor costs one small
    // draw rather than a re-layout of the whole score. The old 50 ms gate existed only to
    // ration that cost, and capped the preview at 20 fps (docs/render-performance-plan.md §5b).
    this.render.renderToolGhost({ x, y })
  }

  /**
   * The note/rest drag — **one press, two gestures, decided from the movement.**
   *
   * Vertical wins → re-pitch (what this always did). Horizontal wins → note spacing, the axis
   * that used to carry no meaning at all. Nothing happens until the cursor leaves a small dead
   * zone, so a click still cannot nudge anything; and because the decision reads the *shape* of
   * the movement rather than its age, a horizontal drag can wander a staff step without silently
   * committing a pitch change on the way past.
   *
   * Once decided, the axis is FIXED for the rest of the press. Re-deciding per frame would let a
   * curved drag re-pitch a note it had already started spacing — and both edits are real writes to
   * the score, not previews you can take back by moving the mouse elsewhere.
   *
   * Returns true while a note/rest drag is active (the move belongs to this gesture).
   */
  private handleNoteDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!this.isDraggingNote || !this.state.selectedNoteId || !this.noteDragStart) return false

    if (this.noteDragAxis === 'undecided') {
      const dx = x - this.noteDragStart.x
      const dy = y - this.noteDragStart.y
      if (Math.hypot(dx, dy) < this.NOTE_DRAG_THRESHOLD_PX) return true // dead zone: still a click
      this.noteDragAxis = Math.abs(dx) > Math.abs(dy) ? 'spacing' : 'pitch'
      dbg(`Note drag axis | ${this.noteDragAxis} (dx:${dx.toFixed(1)} dy:${dy.toFixed(1)})`)
    }

    if (this.noteDragAxis === 'spacing') return this.dragNoteSpacing(engine, x)
    if (this.draggedNoteOriginalPitch === null) return true // a rest: nothing to re-pitch

    // ⚠️ Through the ENGINE, not a `getMeasureNotes` walk: that walk reads `slot.notes` and so is
    // blind to a FANNED MEMBER, which would leave the drag silently doing nothing on exactly the
    // notes P3 made draggable (his report). `getNote` answers for both.
    const selectedNote = engine.getNote(this.state.selectedNoteId)

    if (selectedNote && !selectedNote.isRest) {
      const measure = engine.getScore().measures.find(m => m.number === selectedNote.measure)
      if (measure) {
        const barQuarters = measureCapacityQuarters(measure)
        const position = engine.pixelToPosition({ x, y }, barQuarters)
        const cursorSpelling = position.spelling
        const cursorMidi = spellingToMidi(cursorSpelling.step, cursorSpelling.alter, cursorSpelling.octave)
        const noteMidi = spellingToMidi(selectedNote.step!, selectedNote.alter!, selectedNote.octave!)

        if (cursorMidi !== noteMidi) {
          dbg(`Drag pitch change | midi:${noteMidi} -> ${cursorMidi}`)
          engine.updateNote(this.state.selectedNoteId, { step: cursorSpelling.step, alter: cursorSpelling.alter, octave: cursorSpelling.octave })
          this.render.renderScore()
        }
      }
    }
    return true
  }

  /**
   * Arm the horizontal half of a note/rest drag: remember which COLUMN was grabbed, the space
   * already authored there, and how far left it may go.
   *
   * The floor is measured now, once, against the picture the user grabbed — see
   * `MusicEngine.noteSpacingRoom`. `null` means the last render cannot answer, and then the
   * spacing branch simply never arms: the press stays a pitch drag rather than moving a column by
   * a made-up amount.
   */
  private armSpacingDrag(engine: MusicEngine, note: Note | undefined): void {
    this.spacingDragColumn = null
    this.spacingDragChanged = false
    if (!note) return
    // ⭐ A fanned member's own gap, not its group's — `spacingColumnOf` is the address, because the
    // flat note carries the SLOT's beat (docs/note-spacing-plan.md §7).
    const column = engine.spacingColumnOf(note.id)
    if (!column) return
    const room = engine.noteSpacingRoom(column.measure, column.beat, note.id)
    if (room === null) return
    this.spacingDragColumn = { measure: column.measure, beat: column.beat }
    this.spacingDragBaseline = engine.getNoteSpacing(column.measure, column.beat)
    this.spacingDragMinSpace = this.spacingDragBaseline - room
    this.spacingDragStaffSpacePx =
      engine.getElementRegistry().getStaffGeometry(note.measure, staffOf(note))?.lineSpacing ?? 10
  }

  /**
   * Note-spacing drag: the grabbed column follows the cursor horizontally, and everything right of
   * it slides with it. Live-updates without undo; the drop records one entry (`commitNoteSpacing`).
   *
   * The pixel delta is divided by the staff space to become staff-spaces, because the model holds
   * no pixels. No zoom division: `clientToSvg` goes through `getScreenCTM().inverse()`, so these
   * coords are already layout px with the zoom transform undone.
   * Returns true: while the axis is `spacing`, the move is ours.
   */
  private dragNoteSpacing(engine: MusicEngine, x: number): boolean {
    if (!this.spacingDragColumn || !this.noteDragStart) return true
    const dx = (x - this.noteDragStart.x) / this.spacingDragStaffSpacePx
    const { measure, beat } = this.spacingDragColumn
    if (engine.previewNoteSpacing(measure, beat, this.spacingDragBaseline + dx, this.spacingDragMinSpace)) {
      this.spacingDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a note/rest drag. A spacing drag that actually moved the column records its one undo
   *  entry here; a pitch drag already committed each change as it went. */
  private endNoteDrag(): void {
    if (this.noteDragAxis === 'spacing' && this.spacingDragChanged) {
      const engine = this.getEngine()
      if (engine && this.spacingDragColumn) {
        engine.commitNoteSpacing()
        const { measure, beat } = this.spacingDragColumn
        dbg(`Note spacing set | bar ${measure} beat ${beat.num}/${beat.den} → ${engine.getNoteSpacing(measure, beat)} ss`)
      }
    }
    this.isDraggingNote = false
    this.noteDragAxis = 'undecided'
    this.noteDragStart = null
    this.draggedNoteOriginalPitch = null
    this.spacingDragColumn = null
    this.spacingDragChanged = false
  }

  /**
   * Slur handle drag: the grabbed control point follows the cursor. Invert the
   * renderCurve math to a cps delta, hold the other control point fixed, live-update
   * (no undo) and re-render — the re-render redraws the handles at the new spots.
   * Returns true while a slur-handle drag is active.
   */
  private handleSlurHandleDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingSlurHandle && this.draggedSlurId && this.draggedCpIndex !== undefined
        && this.draggedSlurEndpoints && this.draggedSlurBaselineCps)) return false
    if (this.slurDragStartTime !== null && Date.now() - this.slurDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const { p0, p1, direction } = this.draggedSlurEndpoints
    const spacing = (p1.x - p0.x) / 4
    const dragged = this.draggedCpIndex === 0
      ? { x: x - p0.x - spacing, y: (y - p0.y) * direction }
      : { x: x - p1.x + spacing, y: (y - p1.y) * direction }
    const cps: [{ x: number; y: number }, { x: number; y: number }] = this.draggedCpIndex === 0
      ? [dragged, this.draggedSlurBaselineCps[1]]
      : [this.draggedSlurBaselineCps[0], dragged]
    // The drag math is in pixels; the override is stored in staff-spaces (resolution-
    // independent), so divide by the stave line spacing before handing it to the model.
    const ss = this.draggedStaffSpacePx
    const cpsStaffSpaces: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: cps[0].x / ss, y: cps[0].y / ss },
      { x: cps[1].x / ss, y: cps[1].y / ss },
    ]
    if (engine.previewSlurShape(this.draggedSlurId, cpsStaffSpaces, this.draggedSlurSegment, this.draggedSlurSpanCount)) {
      this.slurDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /**
   * ⭐⭐ **One frame of a DYNAMIC drag: the ink follows the hand, and the anchor comes along when the
   * ink reaches a slot of the mark's lane** (`./dynamicWalk`, his ask 2026-08-19). The arrow keys'
   * gesture with a mouse in it — same arithmetic, same module, same model state at the end of an
   * equal journey.
   *
   * ⭐ It used to SNAP: the nearest notehead of the lane within 150 px, re-anchored outright every
   * frame. That teleported the mark, could never park it between two notes, and dropped its own
   * nudge on the way past (`dynamicOps.setDynamicAtSlot`).
   *
   * ⛔ **No hold, no catch-up, no latch**, where the slur endpoint's drag has all three (snap-and-go
   * — Baudisch, CHI 2005 — sized on the gap ahead). His call: an endpoint is *aimed* at a note, so
   * offset zero has to be reachable exactly; a dynamic is a label placed by eye, and resistance
   * would be a snag with nothing to arrive at.
   *
   * ⭐ **Both axes** (his ask, mid-build): the horizontal walks the mark through the music, the
   * vertical is a plain ink offset with nothing to arrive at — one gesture, two categories, which is
   * what a drag is for. Neither axis is held.
   *
   * ⭐⭐ …except when the ink crosses ANOTHER STAFF, which is a JUMP to that system (his rule the same
   * day: *"we should take into account when it cross the pentagram"*). The module decides; this
   * hands it the cursor's x for it, since a jump has to land somewhere along the new staff.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, the hairpin body drag's rule: the
   * module accumulates rather than sets, and on a refusal (the page limit) leaving the anchor put is
   * what lets the gesture re-synchronise when the cursor comes back, instead of the mark jumping by
   * the distance it never travelled.
   *
   * ⚠️ The cursor baseline is taken on the first frame PAST the time threshold, not at the press:
   * the travel that decided this was a drag rather than a click belongs to neither, and charging it
   * would start the gesture with a jump.
   */
  /**
   * ⭐⭐ **One frame of a TEMPO MARK drag** — {@link handleDynamicDrag}'s twin, sharing its
   * arithmetic (`./markWalk`) and differing in the two ways the marks differ.
   *
   * ⭐ **It LATCHES** (his call, 2026-08-19): the ink stops dead at offset zero of the stop it is
   * nearest, so Gould's own alignment is reachable exactly rather than by luck. ⛔ Still no hold and
   * no catch-up — the slur endpoint's motor space was tuned against note spacing, and a tempo's
   * stops are onsets.
   *
   * ⚠️ The delta is measured from the last ACCEPTED frame, and the baseline is taken on the first
   * frame PAST the time threshold — the dynamic drag's two rules, for its reasons.
   */
  private handleTempoDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingTempo && this.draggedTempoId)) return false
    if (this.tempoDragStartTime !== null
        && Date.now() - this.tempoDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    if (this.tempoDragLastX === null) {
      this.tempoDragLastX = x
      this.tempoDragLastY = y
      return true
    }

    const moved = dragTempo(
      engine, this.draggedTempoId, x, x - this.tempoDragLastX, y - this.tempoDragLastY)
    if (moved === null) return true
    if (moved) {
      this.tempoDragLastX = x
      this.tempoDragLastY = y
      this.tempoDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  private handleDynamicDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingDynamic && this.draggedDynamicId)) return false
    if (this.dynamicDragStartTime !== null
        && Date.now() - this.dynamicDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    if (this.dynamicDragLastX === null) {
      this.dynamicDragLastX = x
      this.dynamicDragLastY = y
      return true
    }

    const moved = dragDynamic(
      engine, this.draggedDynamicId, x, x - this.dynamicDragLastX, y - this.dynamicDragLastY)
    if (moved === null) return true
    if (moved) {
      this.dynamicDragLastX = x
      this.dynamicDragLastY = y
      this.dynamicDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /**
   * ⭐⭐ One frame of a hairpin BODY drag: the whole wedge follows the hand, and the MUSIC comes along
   * at each boundary its ink reaches — `../hairpinWalk`'s third port (his ask, 2026-08-20).
   *
   * ⭐ **It used to move only the DRAWING**, in free pixels: the wedge's extent was musical but its
   * position was cosmetic. That split is gone — dragging a wedge now moves it through the music, as
   * dragging a dynamic does, with the ink interpolating between the notes.
   *
   * ⭐⭐ **The vertical is a JUMP, not a walk**: within a system a wedge's place is continuous, and
   * between systems there is nothing continuous to travel through. A frame that jumps ENDS there —
   * the anchor has moved, so its `dx` would be spent against a slot the hand was never near.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**: on a refusal the anchor is left where
   * it was, so the gesture re-synchronises when the cursor comes back instead of the wedge jumping by
   * the distance it never travelled.
   */
  private handleHairpinBodyDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingHairpinBody && this.draggedHairpinBodyId)) return false
    if (this.hairpinBodyDragStartTime !== null
        && Date.now() - this.hairpinBodyDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragHairpinBody(
      engine, this.draggedHairpinBodyId, x, x - this.hairpinBodyLastX, y - this.hairpinBodyLastY)
    // ⛔ null = the wedge is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      this.hairpinBodyLastX = x
      this.hairpinBodyLastY = y
      this.hairpinBodyDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a hairpin BODY drag: one undo entry if the wedge actually moved, then reset. The wedge
   *  stays selected, so the arrows can carry on from where the mouse stopped. */
  private endHairpinBodyDrag(): void {
    const engine = this.getEngine()
    if (engine && this.hairpinBodyDragChanged) {
      engine.commitHairpinOffsetDrag()
      dbg(`Hairpin moved | id:${this.draggedHairpinBodyId}`)
    }
    this.isDraggingHairpinBody = false
    this.draggedHairpinBodyId = null
    this.hairpinBodyDragChanged = false
    this.hairpinBodyDragStartTime = null
  }

  /**
   * ⭐ One frame of a slur ARC-BODY drag: the whole curve follows the cursor, live (no undo), its
   * shape untouched. `./slurBodyDrag` owns both rules — the measured scale and the anchor that does
   * NOT advance on a refusal — so this is the state around them.
   *
   * ⛔ No hold and no latch, unlike `handleSlurEndpointDrag`: those exist because an endpoint has a
   * next note to arrive at, and a whole-curve move has nothing to arrive at.
   */
  private handleSlurBodyDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingSlurBody && this.draggedSlurBodyId && this.slurBodyAnchor)) return false
    if (this.slurBodyDragStartTime !== null
        && Date.now() - this.slurBodyDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const moved = slurBodyDragStep(engine, this.draggedSlurBodyId, this.slurBodyAnchor, x, y)
    if (moved) {
      this.slurBodyAnchor = moved
      this.slurBodyDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a slur ARC-BODY drag: one undo entry if the curve actually moved, then reset. The slur
   *  stays selected, so the arrows carry on from where the mouse stopped. */
  private endSlurBodyDrag(): void {
    const engine = this.getEngine()
    if (engine && this.slurBodyDragChanged) {
      engine.commitSlurOffsetDrag()
      dbg(`Slur moved | id:${this.draggedSlurBodyId}`)
    }
    this.isDraggingSlurBody = false
    this.draggedSlurBodyId = null
    this.slurBodyAnchor = null
    this.slurBodyDragChanged = false
    this.slurBodyDragStartTime = null
  }

  /**
   * ⭐⭐ One frame of a hairpin SQUARE drag: carry that end's ink by the cursor's delta, handing the
   * wedge along at each boundary the ink reaches — `./hairpinWalk`, the same journey the arrows make
   * (his ask, 2026-08-20: *"now lets do the walk for the mouse"*).
   *
   * ⭐ **It used to SNAP** the grabbed end onto the nearest slot of the lane and write it outright,
   * so the wedge jumped a whole note at a time and could never be parked between two. The walk keeps
   * what that was right about — an end still lands only on the lane's own boundaries — and drops
   * what it was not: the model now moves when the INK arrives, so a drag and the same distance in
   * arrow presses leave one state, not two that look alike.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, the body drag's rule: a refused frame
   * (the page limit, or an end with nowhere left to go) must not be counted, or the end jumps by the
   * distance it never travelled when the hand comes back.
   *
   * ⭐⭐ **BOTH AXES** (his ask, 2026-08-20): the horizontal walks that end through the music, and the
   * vertical is a plain ink offset — a `y` on ONE end TILTS the wedge. ⚠️ Only the horizontal is held
   * back by a latch, so `y` keeps its own anchor.
   * Returns true while a drag is active.
   */
  private handleHairpinEndDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingHairpinEnd && this.draggedHairpinId && this.draggedHairpinEnd)) return false
    if (this.hairpinDragStartTime !== null
        && Date.now() - this.hairpinDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragHairpinEndpoint(
      engine, this.draggedHairpinId, this.draggedHairpinEnd,
      x, x - this.hairpinEndLastX, y - this.hairpinEndLastY)
    // ⛔ null = the wedge is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      // 🚨 …held BACK by whatever the latch dropped: those pixels were made by the hand, so the next
      // frame presents them again and the ink leaves the boundary exactly when the cursor has
      // travelled the whole distance. The debt snap-and-go famously never repays, paid here for
      // free — and `droppedPx` is 0 on an ordinary frame, so there is no special case.
      this.hairpinEndLastX = x - frame.droppedPx
      this.hairpinEndLastY = y
      this.hairpinDragChanged = true
      this.render.renderScore()
    }
    // ⭐⭐ **A WRAP ENDS THE GESTURE** — his call, 2026-08-20. That end is now on the NEXT system and
    // the hand is still on this one, so every further pixel would move it by a distance measured
    // against a system it has left. The drop is taken here: the wedge keeps its small new piece over
    // there, and carrying on means going to it with the mouse. ⚠️ The square stays ARMED, so the
    // arrows can continue from where the mouse stopped.
    if (frame.wrapped) this.endHairpinEndDrag()
    return true
  }

  /**
   * ⭐⭐ One frame of an OTTAVA square drag: carry that end's ink by the cursor's delta, handing the
   * bracket along at each onset the ink reaches — `./ottavaWalk`, the same journey the arrows make
   * (his ask, 2026-08-21: *"now lets do the drag walking"*).
   *
   * ⭐ **It used to SNAP** the grabbed end onto the nearest slot and write it outright, so the bracket
   * jumped a whole note at a time and could never be parked between two. The walk keeps what that was
   * right about — an end still lands only on the lane's own onsets — and drops what it was not.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, the family's rule: a refused frame (the
   * page limit, or an end with nowhere left to go) must not be counted, or the end jumps by the
   * distance it never travelled when the hand comes back.
   *
   * ⭐⭐ **BOTH AXES, and they are different kinds of move**: the horizontal walks that end through
   * the music, while the vertical is a plain ink lift — ⚠️ of the WHOLE bracket, whichever square is
   * under the hand, because an octave line is a straight rule with ONE stored vertical
   * ({@link dragOttavaEndpoint}, which is also where screen becomes outward-from-the-staff).
   */
  private handleOttavaEndDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingOttavaEnd && this.draggedOttavaId && this.draggedOttavaEnd)) return false
    if (this.ottavaDragStartTime !== null
        && Date.now() - this.ottavaDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragOttavaEndpoint(
      engine, this.draggedOttavaId, this.draggedOttavaEnd,
      x, x - this.ottavaEndLastX, y - this.ottavaEndLastY)
    // ⛔ null = the bracket is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      // 🚨 …held BACK by whatever the latch dropped: those pixels were made by the hand, so the next
      // frame presents them again and the ink leaves an onset exactly when the cursor has travelled
      // the whole distance (`./ottavaWalk`). `droppedPx` is 0 on an ordinary frame.
      this.ottavaEndLastX = x - frame.droppedPx
      // ⚠️ Only the horizontal is held back by the latch, so `y` keeps its own anchor.
      this.ottavaEndLastY = y
      this.ottavaDragChanged = true
      this.render.renderScore()
    }
    // ⭐⭐ A WRAP ENDS THE GESTURE — the wedge's rule: that end is now on the NEXT system and the hand
    // is still on this one. ⚠️ The square stays ARMED, so the arrows continue from where it stopped.
    if (frame.wrapped) this.endOttavaEndDrag()
    return true
  }

  /**
   * ⭐⭐ **One frame of an OTTAVA BODY drag: the whole bracket follows the hand** — sideways through
   * the music (extent and all) and, when the hand leaves its staff's room, DOWN ONTO ANOTHER SYSTEM
   * (`ottavaWalk.dragOttavaBody`, his ask 2026-08-21).
   *
   * ⚠️ The delta is measured from the last ACCEPTED frame, the family's rule: the module accumulates
   * rather than sets, so a refused frame leaves the anchor put and the gesture re-synchronises when
   * the cursor comes back.
   *
   * ⭐⭐ **A system JUMP ends the frame, ⛔ not the gesture** — unlike a square's wrap. The bracket has
   * landed where the hand is, so the hand may carry straight on down there; what must not happen is
   * spending this frame's `dx` against a slot it was never near.
   */
  private handleOttavaBodyDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingOttavaBody && this.draggedOttavaBodyId)) return false
    if (this.ottavaBodyDragStartTime !== null
        && Date.now() - this.ottavaBodyDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragOttavaBody(
      engine, this.draggedOttavaBodyId, x, x - this.ottavaBodyLastX, y - this.ottavaBodyLastY)
    // ⛔ null = the bracket is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      this.ottavaBodyLastX = x
      this.ottavaBodyLastY = y
      this.ottavaBodyDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /**
   * ⭐⭐ **One frame of a PEDAL BODY drag: the whole pedal follows the hand** — sideways through the
   * music (span and all) and, when the hand leaves its staff's room, DOWN ONTO ANOTHER SYSTEM
   * (`pedalWalk.dragPedalBody`, his ask 2026-08-21).
   *
   * ⚠️ The delta is measured from the last ACCEPTED frame, the family's rule: the module accumulates
   * rather than sets, so a refused frame leaves the anchor put and the gesture re-synchronises when
   * the cursor comes back.
   *
   * ⭐⭐ **A system JUMP ends the frame, ⛔ not the gesture** — the bracket's rule: the pedal has landed
   * where the hand is, so the hand may carry straight on down there.
   */
  private handlePedalBodyDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingPedalBody && this.draggedPedalBodyId)) return false
    if (this.pedalBodyDragStartTime !== null
        && Date.now() - this.pedalBodyDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragPedalBody(
      engine, this.draggedPedalBodyId, x, x - this.pedalBodyLastX, y - this.pedalBodyLastY)
    // ⛔ null = the pedal is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      this.pedalBodyLastX = x
      this.pedalBodyLastY = y
      this.pedalBodyDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a pedal BODY drag: one undo entry if the pedal actually moved, then reset. It stays
   *  selected, so the arrows carry on from where the mouse stopped. */
  private endPedalBodyDrag(): void {
    const engine = this.getEngine()
    if (engine && this.pedalBodyDragChanged) {
      engine.commitPedalOffsetDrag()
      dbg(`Pedal moved | id:${this.draggedPedalBodyId}`)
    }
    this.isDraggingPedalBody = false
    this.draggedPedalBodyId = null
    this.pedalBodyDragChanged = false
    this.pedalBodyDragStartTime = null
  }

  /** Finish an ottava BODY drag: one undo entry if the bracket actually moved, then reset. It stays
   *  selected, so the arrows carry on from where the mouse stopped. */
  private endOttavaBodyDrag(): void {
    const engine = this.getEngine()
    if (engine && this.ottavaBodyDragChanged) {
      engine.commitOttavaOffsetDrag()
      dbg(`Ottava moved | id:${this.draggedOttavaBodyId}`)
    }
    this.isDraggingOttavaBody = false
    this.draggedOttavaBodyId = null
    this.ottavaBodyDragChanged = false
    this.ottavaBodyDragStartTime = null
  }

  /**
   * ⭐⭐ **One frame of a TRILL BODY drag: the whole ornament follows the hand** — sideways through
   * the music (extent and all) and vertically up the LADDER (`trillWalk.dragTrillBody`).
   *
   * ⚠️ The delta is measured from the last ACCEPTED frame, the family's rule: the module accumulates
   * rather than sets, so a refused frame leaves the anchor put and the gesture re-synchronises when
   * the cursor comes back.
   */
  private handleTrillBodyDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingTrillBody && this.draggedTrillBodyId)) return false
    if (this.trillBodyDragStartTime !== null
        && Date.now() - this.trillBodyDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragTrillBody(
      engine, this.draggedTrillBodyId, x, x - this.trillBodyLastX, y - this.trillBodyLastY)
    // ⛔ null = the ornament is not drawn, so there is no scale to convert with; leave it alone.
    if (frame === null) return true
    if (frame.moved) {
      this.trillBodyLastX = x
      this.trillBodyLastY = y
      this.trillBodyDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a trill BODY drag: one undo entry if the ornament actually moved, then reset. It stays
   *  selected, so the arrows can carry on from where the mouse stopped. */
  private endTrillBodyDrag(): void {
    const engine = this.getEngine()
    if (engine && this.trillBodyDragChanged) {
      engine.commitTrillDrag('start')
      dbg(`Trill moved | id:${this.draggedTrillBodyId}`)
    }
    this.isDraggingTrillBody = false
    this.draggedTrillBodyId = null
    this.trillBodyDragChanged = false
    this.trillBodyDragStartTime = null
  }

  /**
   * ⭐⭐ **One frame of a TRILL square drag: the ink follows the hand, and the ANCHOR comes along when
   * the ink reaches the next note** (`trillWalk.dragTrillEndpoint`, his ask 2026-08-20). The arrow
   * keys' gesture with a mouse in it — same ports, same arithmetic, same model state at the end of
   * an equal journey.
   *
   * ⭐ It used to SNAP: the nearest note within 150 px, re-anchored outright every frame, so the ink
   * teleported a whole note at a time and an end could never be parked between two.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, held back by whatever the LATCH
   * dropped: those pixels were made by the hand, so the next frame presents them again and the ink
   * leaves a note exactly when the cursor has travelled the whole distance.
   */
  private handleTrillEndDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingTrillEnd && this.draggedTrillId && this.draggedTrillEnd)) return false
    if (this.trillDragStartTime !== null
        && Date.now() - this.trillDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragTrillEndpoint(
      engine, this.draggedTrillId, this.draggedTrillEnd,
      x, x - this.trillEndLastX, y - this.trillEndLastY)
    // ⛔ null = the ornament is not drawn, so there is no scale to convert with; leave it alone.
    if (frame === null) return true
    if (frame.moved) {
      this.trillEndLastX = x - frame.droppedPx
      this.trillEndLastY = y
      this.trillDragChanged = true
      this.render.renderScore()
    }
    // 🚨🚨 **A RUNG ENDS THE FRAME, ⛔ NOT THE GESTURE** — his report, 2026-08-20: *"look, I have to
    // release the mouse and click again… but not in one movement"*. I had copied the wedge's
    // ENDPOINT rule, where a horizontal WRAP really does end the drag because the tip lands on
    // another system while the hand stays on this one. ⭐ A vertical rung is the opposite: the hand
    // is travelling WITH the ornament, so the gesture goes on and the next rung comes when the hand
    // reaches it. The wedge's BODY drag has always done exactly this
    // (`handleHairpinBodyDrag`).
    // ⭐⭐ **⛔ NO WRAP, and no gesture to end** — ⚠️ the one place this drag differs from the wedge's.
    // A trill's ink is ONE RIBBON across the systems (`trillLane`), so leaving a line is not an event:
    // the hand keeps pushing the same offset and the drawing keeps folding it onward. The wedge ends
    // its drag at a wrap because its tip re-anchors onto the next system and the hand is left behind
    // on this one; nothing re-anchors here that the ink has not already reached.
    return true
  }

  /**
   * ⭐⭐ One frame of a PEDAL square drag: carry that sign's ink by the cursor's delta, handing the
   * foot along at each stop the ink reaches — `./pedalWalk`, the same journey the arrows make (his
   * ask, 2026-08-21: *"i think we should do the pedal drag walking"*).
   *
   * ⭐ **It used to SNAP** the grabbed sign onto the nearest address and write it outright, so the
   * foot jumped a whole note at a time and could never be parked between two. The walk keeps what
   * that was right about — a sign still lands only on the lane's own stops — and drops what it was
   * not, ⭐ including the whole y-translation the snap needed to tell one system from another: the
   * ink travels along its own line, and the SYSTEM is decided by the wrap.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, the family's rule: a refused frame (the
   * page limit, or a sign with nowhere left to go) must not be counted, or it jumps by the distance
   * it never travelled when the hand comes back.
   *
   * ⭐⭐ **BOTH AXES, and they are different kinds of move**: the horizontal walks that sign through
   * the music, while the vertical is a plain ink lift — ⚠️ of BOTH signs, whichever square is under
   * the hand, because a pedal and its release share ONE baseline
   * ({@link dragPedalEndpoint}; ⛔ no screen→outward conversion, a pedal has one side).
   */
  private handlePedalEndDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingPedalEnd && this.draggedPedalId && this.draggedPedalEnd)) return false
    if (this.pedalDragStartTime !== null
        && Date.now() - this.pedalDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const frame = dragPedalEndpoint(
      engine, this.draggedPedalId, this.draggedPedalEnd,
      x, x - this.pedalEndLastX, y - this.pedalEndLastY)
    // ⛔ null = the pedal is not drawn, so there is no scale to convert with; leave the anchor alone.
    if (frame === null) return true
    if (frame.moved) {
      // 🚨 …held BACK by whatever the latch dropped: those pixels were made by the hand, so the next
      // frame presents them again and the ink leaves a stop exactly when the cursor has travelled the
      // whole distance (`./pedalWalk`). `droppedPx` is 0 on an ordinary frame.
      this.pedalEndLastX = x - frame.droppedPx
      // ⚠️ Only the horizontal is held back by the latch, so `y` keeps its own anchor.
      this.pedalEndLastY = y
      this.pedalDragChanged = true
      this.render.renderScore()
    }
    // ⭐⭐ A WRAP ENDS THE GESTURE — the wedge's rule and the bracket's: that sign is now on the NEXT
    // system and the hand is still on this one. ⚠️ The square stays ARMED, so the arrows continue.
    if (frame.wrapped) this.endPedalEndDrag()
    return true
  }

  /**
   * ⭐⭐ **One frame of a slur ENDPOINT drag: the ink follows the hand, and the anchor comes along
   * when the ink reaches a note** (`slurEndpointWalk`, 2026-08-18). The arrow keys' gesture with a
   * mouse in it — same arithmetic, same module, same model state at the end of an equal journey.
   *
   * ⭐ It used to SNAP: nearest notehead within 60 px, re-anchored outright every frame. That
   * teleported the ink, could never place an end between two notes, and wiped this end's nudge and
   * the arc's shape on the way past (`slurOps.setSlurEndpoint`). The candidate tint existed to
   * explain a jump that no longer happens; what shows now is the anchor itself, tinted for as long
   * as the square is armed (`HighlightController.applyArmedSlurAnchorNote`), plus the dotted line
   * back to where the engraver would have put the end.
   *
   * ⚠️ **The delta is measured from the last ACCEPTED frame**, the hairpin body drag's rule: the
   * module accumulates rather than sets, and on a refusal (the page limit) leaving the anchor put is
   * what lets the gesture re-synchronise when the cursor comes back, instead of the ink jumping by
   * the distance it never travelled.
   */
  private handleSlurEndpointDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingSlurEndpoint && this.draggedEndpointSlurId && this.draggedEndpoint)) return false
    if (this.slurEndpointDragStartTime !== null
        && Date.now() - this.slurEndpointDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const dy = y - this.slurEndpointLastY
    const rawDx = x - this.slurEndpointLastX
    let dx = rawDx

    // ⭐⭐ THE HOLD (see {@link SLUR_ENDPOINT_HOLD_RATIO}). While a note is holding the ink, horizontal
    // travel is absorbed rather than passed on — the cursor moves, the end does not. Two rules keep
    // it from feeling like a snag: only motion CONTINUING past the note is absorbed (turn back and
    // the hold releases at once, so the note you just left is never sticky in both directions), and
    // the vertical is never held, so the hand can still lift the end while the note has it.
    if (this.slurEndpointHoldPx > 0) {
      if (Math.sign(dx) === this.slurEndpointHoldDir) {
        const absorbed = Math.min(Math.abs(dx), this.slurEndpointHoldPx)
        this.slurEndpointHoldPx -= absorbed
        this.slurEndpointDebtPx += absorbed // …to be handed back by the catch-up below
        dx -= this.slurEndpointHoldDir * absorbed
      } else if (Math.abs(dx) > 1) {
        // ⚠️ A whole pixel of it, deliberately: a hand held still still sends frames whose delta
        // wobbles either side of zero, and releasing on the first negative crumb would make a strong
        // hold feel intermittent instead of firm. Sub-pixel motion the other way is jitter, not a
        // change of mind — it neither releases the hold nor is absorbed by it.
        this.slurEndpointHoldPx = 0
        this.slurEndpointDebtPx = 0
      } else {
        dx = 0
      }
    }

    // ⭐⭐ THE CATCH-UP (see {@link slurEndpointCatchupGain}). Once the note lets go, the ink runs
    // faster than the hand until it has been given back every pixel the holds swallowed — so cursor
    // travel and score distance agree again by the time the next note is reached, and the hand never
    // has to reach further than the notes actually are.
    if (this.slurEndpointDebtPx > 0 && dx !== 0) {
      if (Math.sign(dx) === this.slurEndpointHoldDir) {
        const repaid = Math.min(Math.abs(dx) * (this.slurEndpointGain - 1), this.slurEndpointDebtPx)
        this.slurEndpointDebtPx -= repaid
        dx += this.slurEndpointHoldDir * repaid
      } else {
        this.slurEndpointDebtPx = 0 // a change of mind cancels the debt; it is not repaid backwards
      }
    }
    if (dx === 0 && dy === 0) {
      // The frame was entirely absorbed: nothing moved, but the cursor did, so the anchor for the
      // next delta has to advance or the absorbed travel would be paid out twice.
      // ⚠️ …and the CURSOR total still has to count it, or the deviation instrument below reads the
      // hold as free travel and reports a drift that is its own arithmetic (it did, 2026-08-18).
      this.slurEndpointCursorTravel += rawDx
      this.slurEndpointLastX = x
      return true
    }

    const move = dragArmedSlurEndpoint(this.state, engine, dx, dy)
    if (move !== null) {
      // ⭐ A LATCH hands the ink to the note it stopped on, for a fraction of the gap AHEAD of it, in
      // the direction it was going (the distance the debt then has to be repaid over). It fires both ways — onto the next note and back onto the one the
      // end already had (his ask, 2026-08-18) — because the module reports the event rather than the
      // cause. Several crossings in one frame (a fast sweep) leave one hold, not N: a hand moving
      // that fast is plainly not asking to be stopped at each note on the way.
      //
      // ⚠️ The latch cut the frame short, so what it dropped goes on the debt — the catch-up hands it
      // back, and the cursor stays level with the ink.
      if (move.latched) {
        this.slurEndpointHoldPx = Math.min(
          move.gapAhead * this.SLUR_ENDPOINT_HOLD_RATIO, this.SLUR_ENDPOINT_HOLD_MAX_PX)
        this.slurEndpointGain = this.catchupGainFor(this.slurEndpointHoldPx, move.gapAhead)
        this.slurEndpointHoldDir = Math.sign(dx)
        this.slurEndpointDebtPx += move.discarded
      }
      this.slurEndpointLastX = x
      this.slurEndpointLastY = y
      this.slurEndpointDragChanged = true
      // ⭐ The deviation, MEASURED rather than reasoned about: what the cursor has been asked to
      // travel against what the ink was actually given. The hold makes it non-zero mid-gap by design
      // (up to one hold's worth); the catch-up is supposed to bring it back to ~0 at every note, so a
      // value that GROWS note after note is the bug, not a value that oscillates.
      this.slurEndpointCursorTravel += rawDx
      this.slurEndpointInkTravel += dx
      dbg(`Endpoint drag | dx ${rawDx.toFixed(1)}→${dx.toFixed(1)} hold:${this.slurEndpointHoldPx.toFixed(1)} debt:${this.slurEndpointDebtPx.toFixed(1)} cursorΣ:${this.slurEndpointCursorTravel.toFixed(1)} inkΣ:${this.slurEndpointInkTravel.toFixed(1)} DEVIATION:${(this.slurEndpointCursorTravel - this.slurEndpointInkTravel).toFixed(1)}px${move.latched ? ' LATCH' : ''}${move.crossings ? ` cross×${move.crossings}` : ''}`)
      this.render.renderScore()
    }
    return true
  }

  /**
   * Clef drag: snap the cursor to a slot boundary in whatever measure it's over and
   * relocate the clef there (raw move, across measures; undo on drop). Returns true
   * while a clef drag is active.
   */
  private handleClefDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingClef && this.draggedClefMeasure !== null && this.draggedClefBeat !== null)) return false
    if (this.clefDragStartTime !== null) {
      const elapsed = Date.now() - this.clefDragStartTime
      if (elapsed < this.DRAG_TIME_THRESHOLD_MS) return true
    }
    const targetMeasure = engine.pixelToMeasure({ x, y })
    const targetBeat = this.resolveSlotBeat(engine, x, targetMeasure)
    if (targetMeasure !== this.draggedClefMeasure || !fracEq(targetBeat, this.draggedClefBeat)) {
      if (engine.moveClef(this.draggedClefMeasure, this.draggedClefBeat, targetMeasure, targetBeat)) {
        this.draggedClefMeasure = targetMeasure
        this.draggedClefBeat = targetBeat
        this.state.selectedElement = {
          kind: 'clef',
          measure: targetMeasure,
          beat: fracToNumber(targetBeat),
          // The staff does not move with the drag — a clef slides along its own staff.
          staff: selectedOf(this.state, 'clef')?.staff ?? 0,
        }
        engine.setDraggingClef({ measure: targetMeasure, beat: targetBeat })
        dbg(`Clef drag | measure:${targetMeasure} beat:${fracToNumber(targetBeat)}`)
        this.render.renderScore()
      }
    }
    return true
  }

  handleMouseLeave(): void {
    const engine = this.getEngine()
    if (!engine) return

    // A hand/grab pan must SURVIVE the pointer leaving the viewport — it's driven by the
    // document-level handlers and ends on the real mouseup wherever that happens. Bail
    // here so we don't tear it down or re-render underneath it.
    if (this.isPanArmed || this.isPanning) return

    // ⭐⭐ **…AND SO MUST EVERY OTHER DRAG** — his report, 2026-08-21: *"i move up and then i dont
    // release the mouse but went out of the viefinder and when i go back im not editing the slur…
    // this is wrong"*. The teardown below was written for a release we could not see, and that case
    // has two better answers already: {@link onDocMouseUp} settles a release wherever it happens, and
    // {@link handleMouseMove}'s `buttons === 0` catches one outside the browser window. What was left
    // of it was the harm — killing a gesture the hand is still performing.
    //
    // ⭐ With the button still down the gesture stays armed AND keeps tracking, because
    // {@link onDocMouseMove} now drives it from the document, which is the pan's own mechanism one
    // rule wider. ⛔ No re-render here either: it would draw over a live preview.
    if (this.isMouseButtonDown) return

    if (this.isDraggingNote) {
      dbg('Drag ended (mouse left canvas)')
      // Through endNoteDrag, so a spacing drag interrupted by leaving the viewport still records
      // the undo entry for the space it already moved — the score has changed either way.
      this.endNoteDrag()
    }
    if (this.isDraggingClef) {
      dbg('Clef drag ended (mouse left canvas)')
      this.endClefDrag()
    }
    if (this.isDraggingSlurHandle) {
      dbg('Slur handle drag ended (mouse left canvas)')
      this.endSlurHandleDrag()
    }
    if (this.isDraggingSlurEndpoint) {
      dbg('Slur endpoint drag ended (mouse left canvas)')
      this.endSlurEndpointDrag()
    }
    if (this.isDraggingSlurBody) {
      dbg('Slur body drag ended (mouse left canvas)')
      this.endSlurBodyDrag()
    }
    if (this.isDraggingStaffSpacing) {
      dbg('Staff-spacing drag ended (mouse left canvas)')
      this.endStaffSpacingDrag()
    }

    this.lastCanvasMousePosition = null
    this.render.renderScore()
    this.state.showCursor = true
  }
}
