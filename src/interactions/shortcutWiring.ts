import { dbg } from '@/utils/debug'
import { TUPLET_PRESETS, tupletPresetAction } from '@/utils/tupletPresets'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction } from '@/types/music'
import type { EditorState } from './EditorState'
import { assertNeverElement, selectedOf } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { PaletteController } from './PaletteController'
import type { KeyboardController } from './KeyboardController'
import type { RenderController } from './RenderController'
import type { ClipboardController } from './ClipboardController'
import type { ViewportHost } from './ViewportHost'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'
import { selectedArticulationNoteIds } from './selection'
import { markItems, marksLabel, removeMarks } from './enclosedMarks'
import { flipSelection } from './flipSelection'
import { reanchorArmedSlurEndpoint } from './slurReanchor'
import { walkArmedSlurEndpoint } from './slurEndpointWalk'
import { walkDynamic } from './dynamicWalk'
import { walkTempo } from './tempoWalk'
import { walkHairpinBody, walkHairpinEndpoint } from './hairpinWalk'
import { cycleSlurHandle } from './slurHandleCycle'
import { cycleHairpinEndpoint, nudgeArmedHairpinMouth, resetArmedHairpinMouth } from './elements/hairpinHandles'
import { cycleOttavaEndpoint } from './elements/ottavaHandles'
import { walkOttavaBody, walkOttavaEndpoint } from './ottavaWalk'
import { walkPedalEndpoint } from './pedalWalk'
import { cyclePedalEndpoint } from './elements/pedalHandles'
import { cycleTrillEndpoint } from './elements/trillHandles'
import { reanchorArmedTrillEndpoint } from './trillReanchor'
import { walkArmedTrillEndpoint, walkTrillBody } from './trillWalk'
import { nudgeArmedSlurControlPoint, resetArmedSlurHandle } from './slurHandleNudge'
import { windows } from '../windows'
import { openClefWindow } from '../windows/clefWindow'
import { toggleSymbolsWindow } from '../windows/symbols'
import { openTimeSignatureWindow } from '../windows/timeSignatureWindow'
import { openFeatherWindow } from '../windows/featherWindow'
import { openTupletWindow } from '../windows/tupletWindow'
import { keypadCellForCode } from '../windows/keypad/keypadLayouts'
import { pressKeypadCell } from '../windows/keypad/keypadPress'
import { keypadPageSelection } from '../windows/keypad/keypadPageSelection'

/**
 * Wires keyboard shortcuts to controller actions. Framework-agnostic: it reads and writes
 * {@link EditorState} directly and takes the engine as a getter, which is all it ever needed —
 * living in `composables/` was an accident of history (it imported Vue for a single `type Ref`).
 */
export function wireShortcuts(
  state: EditorState,
  getEngine: () => MusicEngine | null,
  selection: SelectionController,
  palette: PaletteController,
  keyboard: KeyboardController,
  renderer: RenderController,
  clipboard: ClipboardController,
  viewport: ViewportHost,
  getLastMousePosition: () => { x: number; y: number } | null,
  insertExpression: () => void,
  insertTempo: () => void,
  editSelectedDynamic: () => boolean,
  /** Start playback, or stop it if it is running — the SAME toggle the dev shell's ▶ button runs
   *  (`App.togglePlayback`), so one gesture cannot drift from the other. */
  togglePlayback: () => void,
): { enable: () => void; disable: () => void; run: (action: string) => void } {
  const shortcutManager = new ShortcutManager()

  // Focal point for keyboard zoom = the viewport center (screen coords); the keys carry no
  // cursor position, so the center is the natural anchor (the wheel uses the cursor instead).
  const viewportCenter = () => {
    const { w, h } = viewport.model.getViewportSize()
    return { x: w / 2, y: h / 2 }
  }

  // Slur endpoint keyboard nudge step (staff-spaces; see docs/slur-endpoint-offset-plan.md):
  // a plain arrow is fine, Ctrl+arrow is coarse.
  const NUDGE_FINE_SS = 0.25
  const NUDGE_COARSE_SS = 1.0

  // Staff-spacing nudge step (staff-spaces; docs/staff-spacing-plan.md §8). Shift+↑/↓ moves by
  // one, Alt+↑/↓ by four — starting conservative (rest-shift shipped too large), tune live.
  const STAFF_SPACING_FINE_SS = 1
  const STAFF_SPACING_COARSE_SS = 4

  // Note-spacing nudge step (staff-spaces; docs/note-spacing-plan.md §5). A quarter of a space per
  // press — small enough that Shift+Alt+→ reads as fine positioning rather than a jump, and it is
  // the same step the slur endpoints already use.
  const NOTE_SPACING_STEP_SS = 0.25

  // Bar-width nudge step (PIXELS of barline movement; docs/bar-width-plan.md §6). One staff-space,
  // so a step means the same distance whether it arrives from the keyboard or (P2) from the mouse —
  // rather than the keyboard nudging an abstract ratio, which would move a dense bar and a sparse
  // one by different amounts under the same key.
  const BAR_WIDTH_STEP_PX = 10

  // Barline-gap step (staff-spaces). The same quarter-space as the note-spacing nudge, because it
  // is the same quantity at a different address — and because Shift+arrows are the FINE chord here.
  const BARLINE_GAP_STEP_SS = 0.25

  // ⭐ Hairpin MOUTH step (staff-spaces). Small on purpose: the whole authorable range is about one
  // space wide (`authoredApertureRange`), so a quarter-space step would offer four stops in it. The
  // Properties input uses the same number.
  const MOUTH_STEP_SS = 0.05

  // Nudge the armed slur endpoint by a staff-space delta (screen-down is +y, so "up arrow
  // lifts the point" passes a negative dy). Returns true when it consumed the key (an
  // endpoint was armed), false to DECLINE so the key falls through to its normal action.
  //
  // ⭐⭐ The HORIZONTAL goes through the INTERPOLATING WALK (`./slurEndpointWalk`): the same ink
  // nudge, except that reaching the next note takes the anchor along with it. Vertical stays a pure
  // offset — an endpoint's y has no anchor to arrive at. See the walk's header for the arithmetic
  // and `ctrlArrowLeft` below for why this key is allowed to end in a model write at all.
  const nudgeArmedEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur?.endpoint) return false
    if (dy === 0 && dx !== 0) walkArmedSlurEndpoint(state, eng, dx)
    else eng.nudgeSlurEndpoint(slur.id, slur.endpoint, dx, dy)
    renderer.renderScore()
    return true
  }

  // Same, but for an armed OPEN join (orange square) of a cross-system slur. Passes the
  // captured spanCount as the override's reset signature. See
  // docs/multisystem-slur-segment-endpoint-offset-plan.md.
  const nudgeArmedSegmentEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur?.segmentEndpoint) return false
    eng.nudgeSlurSegmentEndpoint(slur.id, slur.segmentEndpoint, dx, dy, slur.segmentSpanCount ?? 0)
    renderer.renderScore()
    return true
  }

  // Tab / Shift+Tab: walk the selected slur's drawn handles. The registry is the list, so this
  // declines wherever none are drawn (no slur selected, or linear view) — see `slurHandleCycle`.
  const walkSlurHandles = (step: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !cycleSlurHandle(state, eng.getElementRegistry(), step)) return false
    renderer.renderScore()
    return true
  }

  // …and the same key walks a selected HAIRPIN's two endpoint squares (`elements/hairpinHandles`).
  // Chained rather than merged: the two kinds are mutually exclusive in `selectedElement`, so each
  // walk declines whenever the other's element is the one selected.
  const walkHairpinHandles = (step: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !cycleHairpinEndpoint(state, eng.getElementRegistry(), step)) return false
    renderer.renderScore()
    return true
  }

  // …and a selected OTTAVA's two endpoint squares (`elements/ottavaHandles`). Chained on for the
  // hairpin's reason: `selectedElement` is ONE thing, so each walk declines whenever another kind
  // is what is selected.
  const walkOttavaHandles = (step: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !cycleOttavaEndpoint(state, eng.getElementRegistry(), step)) return false
    renderer.renderScore()
    return true
  }

  // …and a selected PEDAL's squares (`elements/pedalHandles`), chained on for the same reason.
  // ⚠️ This walk can have ONE stop rather than two — a pedal whose release was not drawn — which the
  // module's wrap arithmetic already answers.
  const walkPedalHandles = (step: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !cyclePedalEndpoint(state, eng.getElementRegistry(), step)) return false
    renderer.renderScore()
    return true
  }

  // …and a selected TRILL's squares (`elements/trillHandles`), chained on for the same reason.
  const walkTrillHandles = (step: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !cycleTrillEndpoint(state, eng.getElementRegistry(), step)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+←/→ on an armed TRUE endpoint: walk the anchor one note, instead of nudging it by
  // pixels. The module owns every reason it can decline (no armed end, off the lane, at the other
  // end); this just repaints on a yes. See `slurReanchor`.
  const reanchorArmedEndpoint = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !reanchorArmedSlurEndpoint(state, eng, direction)) return false
    renderer.renderScore()
    return true
  }

  // Same again for an armed round SHAPE handle (the amber arc dot) — the module owns the whole
  // conversion, because unlike the two offsets above its baseline is the DRAWN arc rather than the
  // stored value. See `slurHandleNudge`.
  const nudgeArmedControlPoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    if (!eng || !nudgeArmedSlurControlPoint(state, eng, dx, dy)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **The arrows move the WHOLE CURVE when nothing of the slur is armed** (his ask, 2026-08-18:
   * *"what we dont have is total slur offset (similar to the hairpin)… and the arc conserve the same
   * shape, so we dont recalculate"*) — the family's rule, which a hairpin, a bracket, a pedal and a
   * trill already followed and the slur was the one kind missing from.
   *
   * ⚠️ It DECLINES whenever any of the three handle families is armed, so it can only ever run after
   * `nudgeArmedSlurPoint` has passed: one selection, one meaning per key.
   *
   * ⭐ Screen-signed straight through, no conversion — unlike the trill beside it. The offset it writes
   * is added to the same two endpoints as the per-end nudges, and those speak screen (see
   * `SlurOffsetOverride`).
   */
  const nudgeSelectedSlur = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur || slur.endpoint || slur.segmentEndpoint || slur.controlPoint) return false
    if (!eng.nudgeSlur(slur.id, dx, dy)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` with a slur selected and nothing armed: the whole curve back where the engraver
   *  put it. ⚠️ It leaves the per-end nudges and the arc's shape — three statements, three resets. */
  const resetSelectedSlur = (): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur || slur.endpoint || slur.segmentEndpoint || slur.controlPoint) return false
    if (!eng.resetSlurOffset(slur.id)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Backspace on ANY armed slur handle — arc dot, true end or open join: back to the automatic
  // engraving, the reset half of the three nudges above. Chains ahead of the note-spacing /
  // bar-width resets on the same key — disjoint, since arming a slur handle clears the note
  // selection those need — and DECLINEs when there is nothing authored to reset.
  const resetArmedSlurPoint = (): boolean => {
    const eng = getEngine()
    if (!eng || !resetArmedSlurHandle(state, eng)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Nudge the armed HAIRPIN end — the wedge's RESHAPE** (his ask, 2026-08-17: *"when an
   * endpoint is selected and i ctrl+arrow i want to be able to offset, so is an override, and that
   * means the user is able to reshape the hairpin"*). Plain arrow fine, `Ctrl`+arrow coarse —
   * the slur endpoint's own pair, on the same squares that already resize with `Ctrl+Shift`.
   *
   * ⭐ **Two chords, two CATEGORIES, one pair of handles.** `Ctrl+Shift+←/→` says which notes get
   * louder (the model); this says where the ink goes (an override). Getting them onto separate keys
   * is what lets the second exist at all — §4 refused a cosmetic write while the only horizontal
   * gesture was the extent's.
   *
   * ⚠️ Screen-down is +y, so "up lifts this end" passes a negative dy. A `y` on ONE end tilts the
   * wedge; on both, it lifts it off the dynamics line.
   *
   * ⭐⭐ **The horizontal goes through the INTERPOLATING WALK, on EITHER square** (`./hairpinWalk`,
   * his ask 2026-08-20): the same ink nudge, except that reaching the next boundary of the lane takes
   * that end of the WEDGE along with it — the dynamic's and the tempo mark's gesture, sharing their
   * arithmetic (`./markWalk`). ⚠️ So this key can end in a MODEL write, which is the crossing and
   * nothing else; every press either side of it is ink.
   *
   * ⭐ **Both ends, because both have a re-anchor AND an offset** — his correction the same day, once
   * the left one shipped: *"we are using reanchor also for the duration endpoint, and offset, that
   * means that the duration endpoint should walk too"*. A square where the two gestures do not meet
   * is the odd one out, not the safe one.
   */
  const nudgeArmedHairpinEnd = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || !hairpin?.endpoint) return false
    const moved = dy === 0 && dx !== 0
      ? walkHairpinEndpoint(eng, hairpin.id, hairpin.endpoint, dx)
      : eng.nudgeHairpinEndpoint(hairpin.id, hairpin.endpoint, dx, dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Nudge the armed OTTAVA end — the bracket's own INK** (his ask, 2026-08-17: *"the square
   * points offset"*). Plain arrow fine, `Ctrl`+arrow coarse — `nudgeArmedHairpinEnd`'s pair, on the
   * squares that already re-anchor with `Ctrl+Shift`. Two chords, two categories, one pair of
   * handles: the harder chord says which notes are DISPLACED, this one says where the ink goes.
   *
   * ⭐⭐ **The horizontal goes through the INTERPOLATING WALK, on EITHER square** (`./ottavaWalk`,
   * his ask 2026-08-21): the same ink nudge, except that reaching the next onset of the lane takes
   * that end of the BRACKET along with it — the wedge's and the trill's gesture, sharing their
   * arithmetic (`./markWalk`). ⚠️ So this key can end in a MODEL write, which is the crossing and
   * nothing else; every press either side of it is ink. ⭐ Both squares, because both have a
   * re-anchor AND an offset.
   *
   * ⭐⭐ **`↑`/`↓` move the WHOLE bracket, whichever square is armed** — his rule, *"ottava is a
   * straight line, so offset in y should result in offset the two points in y"*. Nothing here
   * enforces it: `OttavaOffsetOverride` has ONE vertical, so there is no second height to write. ⛔ Do
   * not "fix" this into a per-end pair to match the hairpin — a tilted octave bracket is not a shape.
   *
   * ⭐⭐ **This is the one place that converts screen to OUTWARD-from-the-staff**, and it converts
   * because a KEY is a screen direction: `↑` must lift the bracket on both sides of the staff, while
   * the stored number means "further from the staff" so that flipping 8va↔8vb cannot invert a nudge
   * the user already made (see `OttavaOffsetOverride`). Above the staff the two agree up to a sign.
   *
   * ⚠️ Screen-down is +dy, so "up" arrives negative and becomes a POSITIVE outward for an 8va.
   */
  const nudgeArmedOttavaEnd = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || !ottava?.endpoint) return false
    const above = (eng.getOttavaById(ottava.id)?.shift ?? 1) > 0
    const moved = dy === 0 && dx !== 0
      ? walkOttavaEndpoint(eng, ottava.id, ottava.endpoint, dx)
      : eng.nudgeOttavaEndpoint(ottava.id, ottava.endpoint, dx, above ? -dy : dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **The arrows move the WHOLE bracket when no square is armed** (his ask, 2026-08-17) — plain
   * arrow fine, `Ctrl`+arrow coarse, the same pair that moves ONE end when one is armed. The wedge's
   * `nudgeSelectedHairpin` verbatim, and for its reason: **something armed → that end; nothing armed
   * → the whole thing**, one chord read by what you picked.
   *
   * ⚠️ Screen → OUTWARD, the same conversion the armed version makes and for the same reason: a key
   * is a screen direction, the stored number is a distance from the staff.
   *
   * ⭐⭐ **And the horizontal WALKS, exactly as an armed square's does** (`./ottavaWalk.walkOttavaBody`,
   * his ask 2026-08-21) — the ink moves, and when it reaches the next onset the WHOLE bracket goes
   * with it, length and all. ⚠️ So this key too can end in a MODEL write, which is the crossing and
   * nothing else; ⭐ the far end is NOT held here, which is the whole difference between moving a
   * mark and reshaping it.
   */
  const nudgeSelectedOttava = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || !ottava || ottava.endpoint) return false
    const above = (eng.getOttavaById(ottava.id)?.shift ?? 1) > 0
    const moved = dy === 0 && dx !== 0
      ? walkOttavaBody(eng, ottava.id, dx)
      : eng.nudgeOttava(ottava.id, dx, above ? -dy : dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Nudge the armed PEDAL sign — its INK** (his ask, 2026-08-18: *"now lets do the arrow ctr
   * arrow offset similar to ottava"*). Plain arrow fine, `Ctrl`+arrow coarse — the squares that
   * already move the press and the lift with `Ctrl+Shift`. Two chords, two categories, one pair of
   * handles: the harder chord says when the damper moves (audible), this one says where the glyph
   * sits.
   *
   * ⭐⭐ **`↑`/`↓` move BOTH signs, whichever square is armed** — the bracket's rule arriving for a
   * different reason: an octave line's vertical is shared because a straight line cannot tilt, while
   * a pedal's is shared because *an individual pedal-and-release instruction should always align*
   * (Gould p. 333). Nothing here enforces it; `PedalOffsetOverride` has ONE vertical.
   *
   * ⚠️ **And no screen→outward conversion, unlike the ottava's** — this is the whole of what the two
   * families disagree about. A pedal has one side permanently, so `↑` is up wherever it is drawn.
   *
   * ⭐⭐ **The horizontal goes through the INTERPOLATING WALK, on EITHER square** (`./pedalWalk`, his
   * ask 2026-08-21): the same ink nudge, except that reaching the next stop of the lane takes the
   * FOOT along with it — the wedge's, the trill's and the bracket's gesture, sharing their arithmetic
   * (`./markWalk`). ⚠️ So this key can end in a MODEL write, which is the crossing and nothing else,
   * and on a pedal that write is AUDIBLE: it says how long the notes ring. ⭐ Both squares, because
   * both have a re-anchor AND an offset.
   */
  const nudgeArmedPedalEnd = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || !pedal?.endpoint) return false
    const moved = dy === 0 && dx !== 0
      ? walkPedalEndpoint(eng, pedal.id, pedal.endpoint, dx)
      : eng.nudgePedalEndpoint(pedal.id, pedal.endpoint, dx, dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /** ⭐⭐ **The arrows move the WHOLE pedal when no square is armed** — the bracket's and the wedge's
   *  rule: **something armed → that sign; nothing armed → the pair.** One chord read by what you
   *  picked. */
  const nudgeSelectedPedal = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || !pedal || pedal.endpoint) return false
    if (!eng.nudgePedal(pedal.id, dx, dy)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` with a pedal selected and nothing armed: every nudge dropped. DECLINEs when it
   *  carries none — ⚠️ which is the ordinary case, since a pedal's EXTENT edits are model writes
   *  with nothing to reset. */
  /**
   * ⭐⭐ **RE-ANCHOR THE ARMED TRILL SQUARE BY ONE NOTE** — `Ctrl+Shift+←/→` (his ask, 2026-08-18).
   * The armed square is the gate, exactly as it is for the other four spans; ⭐ what differs is the
   * STEP: a trill's anchors are NOTES, so this walks its lane one note at a time where the pedal and
   * the bracket walk slots. The module owns every reason it can decline. See `trillReanchor`.
   */
  const reanchorArmedTrill = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !reanchorArmedTrillEndpoint(state, eng, direction)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedPedal = (): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || !pedal || pedal.endpoint) return false
    if (!eng.resetPedalOffset(pedal.id)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` on an armed pedal square: that sign's `x` and the pair's shared `y` back to the
   *  engraver's own. DECLINEs when it was never nudged, so the key falls through. */
  const resetArmedPedalEnd = (): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || !pedal?.endpoint) return false
    if (!eng.resetPedalEndpointOffset(pedal.id, pedal.endpoint)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Nudge the armed TRILL end — the ornament's INK** (his ask, 2026-08-18). Plain arrow fine,
   * `Ctrl`+arrow coarse, on the squares that already re-anchor with `Ctrl+Shift`. Two chords, two
   * categories: the harder one says which notes are TRILLED (audible — the repeats come from the
   * span), this one says where the ink goes.
   *
   * ⭐⭐ **`↑`/`↓` move the WHOLE ornament, whichever square is armed** — the sign and the wiggle sit
   * on one baseline, so `TrillOffsetOverride` has ONE vertical and there is no second height to
   * write.
   *
   * ⭐⭐ **It converts SCREEN → OUTWARD-from-the-staff, the bracket's rule and ⛔ not the pedal's.** A
   * trill's side is stored and `x` FLIPS it, so a screen-signed field would turn a nudge that meant
   * "clear of the music" into a shove toward it. ⚠️ Screen-down is +dy, so `↑` arrives negative and
   * becomes a POSITIVE outward for an `above` trill.
   *
   * ⭐⭐ **The horizontal goes through the INTERPOLATING WALK** (`./trillWalk`, his ask 2026-08-20):
   * the same ink nudge, except that reaching the next note of the lane takes that end of the
   * ORNAMENT along with it — the wedge's gesture on the squares that already re-anchor with
   * `Ctrl+Shift`, by the rule that square set: a handle with BOTH a re-anchor and an offset owes the
   * walk that joins them. ⚠️ So this key can end in a MODEL write, which is the crossing and nothing
   * else; every press either side of it is ink.
   */
  const nudgeArmedTrillEnd = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const trill = selectedOf(state, 'trill')
    if (!eng || !trill?.endpoint) return false
    const above = (eng.getTrillById(trill.id)?.placement ?? 'above') === 'above'
    const moved = dy === 0 && dx !== 0
      ? walkArmedTrillEndpoint(state, eng, dx)
      : eng.nudgeTrillEndpoint(trill.id, trill.endpoint, dx, above ? -dy : dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **The arrows move the WHOLE ornament when no square is armed** — the family's rule:
   * something armed → that end; nothing armed → the whole mark. Same screen→outward conversion.
   *
   * ⭐⭐ **…and the horizontal WALKS, exactly as an armed square's does** (`./trillWalk`, his ask
   * 2026-08-20: *"now we should do the `tr` shape walking — trill selected but not endpoints"*). The
   * ornament's ink moves by the step, and when it reaches the next note the ORNAMENT goes with it,
   * EXTENT AND ALL. ⚠️ So this key can end in a MODEL write, which is AUDIBLE; every press either
   * side of the crossing is ink.
   */
  const nudgeSelectedTrill = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const trill = selectedOf(state, 'trill')
    if (!eng || !trill || trill.endpoint) return false
    const above = (eng.getTrillById(trill.id)?.placement ?? 'above') === 'above'
    const moved = dy === 0 && dx !== 0
      ? walkTrillBody(eng, trill.id, dx)
      : eng.nudgeTrill(trill.id, dx, above ? -dy : dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` with a trill selected and nothing armed: every nudge dropped. */
  const resetSelectedTrill = (): boolean => {
    const eng = getEngine()
    const trill = selectedOf(state, 'trill')
    if (!eng || !trill || trill.endpoint) return false
    if (!eng.resetTrillOffset(trill.id)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` on an armed trill square: that end's `x` and the ornament's shared vertical
   *  back to the engraver's own. DECLINEs when it was never nudged, so the key falls through. */
  const resetArmedTrillEnd = (): boolean => {
    const eng = getEngine()
    const trill = selectedOf(state, 'trill')
    if (!eng || !trill?.endpoint) return false
    if (!eng.resetTrillEndpointOffset(trill.id, trill.endpoint)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` with a bracket selected and nothing armed: every nudge dropped. DECLINEs when
   *  it carries none. */
  const resetSelectedOttava = (): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || !ottava || ottava.endpoint) return false
    if (!eng.resetOttavaOffset(ottava.id)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` on an armed ottava square: that end's `x` and the bracket's shared `y` back to
   *  the engraver's own. DECLINEs when it was never nudged, so the key falls through. */
  const resetArmedOttavaEnd = (): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || !ottava?.endpoint) return false
    if (!eng.resetOttavaEndpointOffset(ottava.id, ottava.endpoint)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **The arrows move the WHOLE wedge when no square is armed** (his ask, 2026-08-17) — plain
   * arrow fine, `Ctrl`+arrow coarse, the same pair that moves ONE end when one is armed.
   *
   * ⭐ So the armed square is the whole of the difference: **something armed → that end moves; nothing
   * armed → the wedge does.** One chord, read by what you picked, which is the same arrangement the
   * slur's handles use and the reason both gestures can share the plain arrows at all.
   *
   * ⚠️ It writes the two END offsets by the same delta rather than a field of its own — see
   * `hairpinOps.setHairpinOffset` for why a separate "whole wedge" number would be two places the same
   * pixels come from.
   *
   * ⭐⭐ **And the HORIZONTAL goes through the WALK** (`./hairpinWalk`, 2026-08-20): the ink moves,
   * and at each boundary of the lane the WHOLE wedge moves with it, length unchanged — so the arrows
   * and the body DRAG land in one state rather than two that look alike. ⛔ The vertical stays a
   * plain lift: the wedge's SYSTEM JUMP is a mouse gesture, needing a hand to say which staff.
   */
  const nudgeSelectedHairpin = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || !hairpin || hairpin.endpoint) return false
    const moved = dy === 0 && dx !== 0
      ? walkHairpinBody(eng, hairpin.id, dx)
      : eng.nudgeHairpin(hairpin.id, dx, dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` with a wedge selected and nothing armed: both ends back to the engraver's own
   *  positions. DECLINEs when neither carries a nudge. */
  const resetSelectedHairpin = (): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || !hairpin || hairpin.endpoint) return false
    if (!eng.resetHairpinOffset(hairpin.id)) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` on an armed hairpin end: back to the engraver's own position. DECLINEs when
   *  that end was never nudged, so the key falls through to the note-spacing / bar-width resets. */
  const resetArmedHairpinEnd = (): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || !hairpin?.endpoint) return false
    if (!eng.resetHairpinEndpointOffset(hairpin.id, hairpin.endpoint)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Shift+↑/↓ opens and closes the MOUTH** of the selected wedge, with its mouth-bearing square
   * armed — the right-hand one on a crescendo, the left on a diminuendo (his ask, 2026-08-17).
   * `Shift+Backspace` puts it back to automatic, the matching backspace every arrow-chord here has.
   *
   * ⚠️ It rode `Shift+←/→` for an hour first, on an argument about the mouth being a symmetric spread
   * that no vertical direction describes. He tried it: *"i test it and is not intuitive, lets try
   * arrow up down instead"* — and in the hand ↑ = wider is immediate, because what you are reaching
   * for is the ARM, not the pair. The reasoning was sound and the hand still won; see
   * `elements/hairpinHandles`.
   *
   * ⭐ Disjoint on both keys: `Shift+↑/↓`'s other tenant is the fine STAFF-SPACING nudge, which needs a
   * selected measure box, and `Shift+Backspace`'s is the barline gap, which needs a selected barline.
   * The module owns every reason this can decline.
   */
  const nudgeArmedMouth = (delta: number): boolean => {
    const eng = getEngine()
    if (!eng || !nudgeArmedHairpinMouth(state, eng, delta)) return false
    renderer.renderScore()
    return true
  }

  const resetArmedMouth = (): boolean => {
    const eng = getEngine()
    if (!eng || !resetArmedHairpinMouth(state, eng)) return false
    renderer.renderScore()
    return true
  }

  // The arrow keys serve ANY armed slur handle — blue true end, orange open join, or amber arc dot.
  // The three are mutually exclusive (one `selectedElement`, one field set), so they chain in the
  // order they were built. Returns true if one consumed the key (so the caller skips its default
  // action / DECLINEs).
  const nudgeArmedSlurPoint = (dx: number, dy: number): boolean =>
    nudgeArmedEndpoint(dx, dy) || nudgeArmedSegmentEndpoint(dx, dy) || nudgeArmedControlPoint(dx, dy)

  // ↑/↓ on a SINGLE selected rest = nudge its vertical shift by one staff-step (+up), instead
  // of the pitch edit (which skips rests anyway). One undo per press. See docs/rest-shift-plan.md.
  const nudgeSelectedRest = (delta: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    const note = eng.getNote(item.id)
    if (!note || !note.isRest) return false
    if (!eng.nudgeRestShift(item.id, delta)) return false
    renderer.renderScore()
    return true
  }

  // ←→↑↓ (fine) / Ctrl+arrow (coarse) on a selected DYNAMIC = nudge its position offset by a
  // staff-space delta (screen-down is +y, so "up arrow lifts the mark" passes a negative dy),
  // instead of the pitch/nav edit (which no-ops on a dynamic anyway). Disjoint from the
  // slur/rest/box selections, so it just adds another modal branch. One undo per press. Returns
  // true when it consumed the key, false to DECLINE so it falls through. See docs/dynamic-offset-plan.md.
  //
  // ⭐⭐ The HORIZONTAL goes through the INTERPOLATING WALK (`./dynamicWalk`), his ask of 2026-08-19:
  // the same ink nudge, except that reaching the next slot of the mark's lane takes the anchor along
  // with it — the slur endpoint's gesture, on the letters. Vertical stays a pure offset (a dynamic's
  // lane runs sideways, so there is no anchor above to arrive at). See the walk's header for the
  // arithmetic and `ctrlArrowLeft` below for why this key is allowed to end in a model write.
  const nudgeSelectedDynamic = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const dynamicId = selectedOf(state, 'dynamic')?.id
    if (!eng || !dynamicId) return false
    const moved = dy === 0 && dx !== 0
      ? walkDynamic(eng, dynamicId, dx)
      : eng.nudgeDynamicOffset(dynamicId, dx, dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  // ←→↑↓ (fine) / Ctrl+arrow (coarse) on a selected TEMPO MARK = nudge its position offset by a
  // staff-space delta (his ask, 2026-08-19). `nudgeSelectedDynamic`'s twin one branch up, and the
  // twin is the point: the two marks differ in what they hang off, not in how a hand moves them.
  //
  // 🚨 **Its `dy` is OUTWARD (+up), the one offset in the compartment that is** — see
  // `TempoOffsetOverride`. So ↑ passes a POSITIVE dy here where every branch above passes a negative
  // one, and that asymmetry is the point rather than a slip: a tempo mark is always above the staff,
  // so a number about it means *how far from the staff*.
  //
  // ⭐⭐ The HORIZONTAL goes through the INTERPOLATING WALK (`./tempoWalk`, 2026-08-19): the same ink
  // nudge, except that reaching the next ONSET takes the anchor along with it. The dynamic's gesture
  // on the words, sharing its arithmetic (`./markWalk`) and differing only in where the stops are —
  // a tempo has no lane, it governs the clock.
  //
  // One undo per press. Returns true when it consumed the key, false to DECLINE so it falls through.
  const nudgeSelectedTempo = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const tempoId = selectedOf(state, 'tempo')?.id
    if (!eng || !tempoId) return false
    const moved = dy === 0 && dx !== 0
      ? walkTempo(eng, tempoId, dx)
      : eng.nudgeTempoOffset(tempoId, dx, dy)
    if (!moved) return false
    renderer.renderScore()
    return true
  }

  /** `Ctrl+Backspace` on a selected DYNAMIC or TEMPO mark: its hand nudge back to the engraver's own
   *  (his report, 2026-08-19). Both DECLINE when the mark was never nudged, so the key falls through
   *  to the note spacing / bar width behind them — the chain's standing rule. */
  const resetSelectedDynamic = (): boolean => {
    const eng = getEngine()
    const id = selectedOf(state, 'dynamic')?.id
    if (!eng || !id || !eng.resetDynamicOffset(id)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedTempo = (): boolean => {
    const eng = getEngine()
    const id = selectedOf(state, 'tempo')?.id
    if (!eng || !id || !eng.resetTempoOffset(id)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **RE-ANCHOR THE SELECTED TEMPO MARK BY ONE ONSET** — `Ctrl+Shift+←/→` (his ask, 2026-08-19).
   *
   * ⭐ The musical half the mark did not have, and the same two-chord split the dynamics line already
   * reads: the plain and `Ctrl` arrows own the INK, this chord means *move it through the music* —
   * and here it is AUDIBLE, since a tempo applies from the beat it sits on.
   *
   * ⚠️ It DECLINES at either end of the score and on a beat another tempo mark already holds (one
   * mark per beat, `engine/models/tempoOps`), so the chord falls through to the note offset behind it.
   */
  const reanchorSelectedTempo = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const tempoId = selectedOf(state, 'tempo')?.id
    if (!eng || !tempoId) return false
    if (!eng.moveTempoBySlot(tempoId, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **RE-ANCHOR THE SELECTED DYNAMIC BY ONE SLOT** — `Ctrl+Shift+←/→` (his ask, 2026-08-18).
   * The mark walks its own lane and takes the beat it lands on, re-filing across a barline.
   *
   * ⭐ **Two chords, two categories — the last family on the dynamics line to get its musical
   * half.** `nudgeSelectedDynamic` above owns the plain and `Ctrl` arrows and writes only INK; this
   * chord means *move it through the music* on the wedge, the bracket, the pedal and the trill, and
   * now says the same thing about the letters. ⛔ No armed-square gate, unlike those four: a
   * dynamic is a point, so there is no end to be pointing at.
   *
   * ⚠️ The MODEL, and audible — the level applies from the beat this writes. The engine owns the
   * undo entry and the model drops the mark's own nudge; this only repaints on a yes.
   */
  const reanchorSelectedDynamic = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const dynamicId = selectedOf(state, 'dynamic')?.id
    if (!eng || !dynamicId) return false
    if (!eng.moveDynamicBySlot(dynamicId, direction)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+←/→ (wide) / Shift+Alt+←/→ (fine) on a SINGLE selected note or rest = nudge its
  // horizontal offset by a staff-space delta (+right), an OFFSET off its natural column (NOT
  // spacing — the bar keeps its width). Rides the deliberate chords, not the easy key: a note's
  // plain ←/→ is navigation and the easy Ctrl+←/→ is the MOVE (spacing/bar width). Returns true
  // when it consumed the key, false to DECLINE so it falls through. One undo per press. The engine
  // keys the override by SLOT, so a chord (and a rest) moves as a unit. See docs/note-offset-plan.md §C.
  const nudgeSelectedNoteOffset = (dx: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    if (!eng.nudgeNoteOffset(item.id, dx)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+Backspace / Shift+Alt+Backspace on a SINGLE selected note/rest = reset it to its
  // natural column outright (drop the offset entry, the first-class reset every override client gets
  // — not a walk back to 0). DECLINEs (false) when there is nothing to reset, keeping the key free.
  const resetSelectedNoteOffset = (): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    if (!eng.resetNoteOffset(item.id)) return false
    renderer.renderScore()
    return true
  }

  // Shift+↑/↓ (fine) / Alt+↑/↓ (coarse) on a plain-click SINGLE measure box = Sibelius
  // "space above staff": nudge the clicked staff's vertical spacing by `delta` staff-spaces
  // (+down). Gated to the single-box selection — disjoint from the chord-nav that Alt+↑/↓
  // otherwise drives (see docs/staff-spacing-plan.md §6). One undo per press. Returns true
  // when it consumed the key, false to DECLINE so it falls through to its normal action.
  const nudgeStaffSpacingIfBoxSelected = (delta: number): boolean => {
    const eng = getEngine()
    const box = selectedOf(state, 'measureRange')
    if (!eng || !box || box.boxStyle !== 'single') return false
    // Per-system (plan option C): the tweak targets the system the selected bar sits on.
    if (!eng.nudgeStaffSpacing(box.staff, box.anchor, delta)) return false
    renderer.renderScore()
    return true
  }

  // Shift+Alt+←/→ on a SINGLE selected note or rest = change the space allocated BEFORE its column
  // (Sibelius note spacing). Unlike every other nudge wired here this one has WIDTH: the bar grows
  // or shrinks and everything right of the column slides, so it re-runs the casting-off rather than
  // just repainting. The engine DECLINES (null) when it cannot measure how far left the column may
  // go — an unrendered bar has no gaps to read — and we decline with it rather than guessing.
  // One undo per press. See docs/note-spacing-plan.md §5.
  // ⭐ The address comes from `spacingColumnOf`, NOT from `getNote().beat`: a fanned member's flat
  // note carries the SLOT's beat, so reading it there spaced the whole fan whichever member was
  // selected (docs/note-spacing-plan.md §7). The id travels with the column so the engine can floor
  // a member's nudge against the head behind it.
  const selectedColumn = (): { measure: number; beat: Fraction; noteId: string } | null => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return null
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return null
    const column = eng.spacingColumnOf(item.id)
    return column ? { measure: column.measure, beat: column.beat, noteId: item.id } : null
  }

  const nudgeSelectedNoteSpacing = (delta: number): boolean => {
    const eng = getEngine()
    const column = selectedColumn()
    if (!eng || !column) return false
    if (eng.nudgeNoteSpacing(column.measure, column.beat, delta, column.noteId) === null) return false
    renderer.renderScore()
    return true
  }

  // Shift+Alt+←/→ on a selected BARLINE = move that barline: the bar it ends gets roomier or
  // tighter, its music re-spaced proportionally, and the room comes from its neighbours on the line.
  // Same keys and same axis as the note-spacing nudge above, dispatched on WHAT IS SELECTED — a
  // note is note spacing, a barline is bar width. That is Sibelius's own behaviour, not a collision
  // being papered over, and it costs nothing: the note-spacing branch already declines when no
  // single note is selected, so this is a `||` onto it. The engine DECLINES (null) when the last
  // render cannot say how far the barline may go — including the barline that ENDS a system, which
  // justification pins to the right margin and no stretch can move. One undo per press.
  // See docs/bar-width-plan.md §4–§6.
  const nudgeSelectedBarWidth = (deltaPx: number): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarWidth(measure, deltaPx) === null) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Lengthen / shorten the selected hairpin by one SLOT**, on `Ctrl+Shift+←/→` and only while
   * its RIGHT-HAND square is armed (his call, 2026-08-17).
   *
   * ⭐ **Both halves of that come from the slur.** The chord, because `Ctrl+Shift+←/→` already means
   * "stop nudging, move the anchor" there (`slurReanchor`) and this is the same sentence about a
   * different span — the widest step on the horizontal, above the ¼-space plain arrows and the
   * 1-space Ctrl pair. And the GATE, because a wedge now has two grabbable ends: the key edits the
   * end you are pointing at, so with nothing (or the left square) armed it declines and the wedge is
   * not silently resized from the other end. It used to ride the bare `Ctrl+←/→` with no gate at all,
   * which meant a selected hairpin ate that chord outright.
   *
   * ⚠️ It is the END that grows, whichever direction is pressed — `→` lengthens, `←` shortens. There
   * is no "resize from the left" yet; a start-anchored version would move the wedge's beat, which is
   * a different edit from its length.
   *
   * ⚠️ **On a hairpin this key writes the MODEL, where one branch over (a slur endpoint, a dynamic)
   * it writes a cosmetic override.** That is not an inconsistency to tidy away — it is §4's rule:
   * a hairpin's EXTENT is musical (it says which notes get louder) and its height is not. Letting
   * this write an offset instead would give us two ways to say "three beats long" that can
   * disagree, with playback believing the one the eye does not. ⚠️ What DOES write a cosmetic
   * override is the plain / `Ctrl` arrow on the same square (`nudgeArmedHairpinEnd`, 2026-08-17) —
   * two chords, two categories — so `Ctrl+Backspace` now has something to reset on a hairpin, which
   * this comment used to say it never would.
   *
   * ⭐ **By a SLOT, not by a fixed fraction.** The step is the duration of the note the wedge
   * currently ends on (growing) or the one it would end on after shrinking — so the end always
   * lands on a notehead, which is the only place a wedge can honestly stop. A fixed step of, say,
   * a quarter would leave the end mid-triplet.
   *
   * DECLINEs (false) when no hairpin is selected, when its right-hand square is not the armed one,
   * or when the edit would make the wedge non-positive — `setHairpinLength` refuses that rather than
   * deleting the thing being shortened.
   */
  const resizeSelectedHairpin = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || hairpin?.endpoint !== 'end') return false
    if (!eng.resizeHairpinBySlot(hairpin.id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Move the selected hairpin's START by one slot, WITHOUT moving its end** — the same chord
   * with the wedge's LEFT square armed (his ask, 2026-08-17: *"we don't move the endpoint position,
   * we just move the first position"*).
   *
   * The gate is the whole point of the pair: one chord, and WHICH END IS ARMED decides which end it
   * moves. `←` reaches the start back a slot (the wedge grows at the front), `→` steps it in (the
   * wedge shrinks from the front) — in both cases the right-hand end stays exactly where it is,
   * which the model does by writing `beat` and `length` together (`hairpinOps`).
   *
   * DECLINEs (false) when the left square is not the armed one, when there is no earlier slot to
   * reach, or when the start would reach the end.
   */
  const moveSelectedHairpinStart = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const hairpin = selectedOf(state, 'hairpin')
    if (!eng || hairpin?.endpoint !== 'start') return false
    if (!eng.moveHairpinStartBySlot(hairpin.id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐ **Move a selected pedal's LIFT by one slot** — `resizeSelectedHairpin`'s twin, and it is a
   * separate branch rather than a shared one because the two step through different lanes: a wedge
   * walks its own VOICE, a pedal walks its whole STAFF (one damper — `pedalOps.resizePedalBySlot`).
   *
   * ⚠️ It writes the MODEL, like the hairpin's and for a sharper reason: how long the damper is down
   * is what the notes SOUND (docs/pedal-plan.md §9), so a cosmetic offset would leave playback
   * believing a lift the eye does not see. `Ctrl+Backspace` therefore has nothing to reset here.
   *
   * 🚨 **IT MOVED OFF `Ctrl+←/→` ONTO `Ctrl+Shift+←/→`, AND GAINED THE ARMED-SQUARE GATE
   * (his call, 2026-08-18).** It shipped on the plain `Ctrl` chord in P3, when a pedal had no
   * endpoint squares and nothing else to bind — and that put a MODEL write on the chord this editor
   * reserves for nudging INK. On every other span `Ctrl+arrow` moves the drawing and
   * `Ctrl+Shift+arrow` moves the end through the music; the pedal had the pair inverted, so the one
   * family whose "resize" is audible was the one you could trigger by reaching for a cosmetic nudge.
   * ⭐ It also frees `Ctrl+arrow` on a pedal for the ink offset it does not have yet — the day a
   * hand-moved `✻` arrives (docs/pedal-plan.md §6.3) there is a key waiting and no collision.
   *
   * DECLINEs (false) when no pedal is selected, when its END square is not the armed one, or when
   * the edit would leave it holding no music — `setPedalLength` refuses that rather than deleting
   * the thing being shortened.
   */
  const resizeSelectedPedal = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || pedal?.endpoint !== 'end') return false
    if (!eng.resizePedalBySlot(pedal.id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Move the selected pedal's PRESS by one slot, WITHOUT moving its lift** — the same chord
   * with the START square armed (his ask, 2026-08-18), and `moveSelectedOttavaStart`'s twin down to
   * the shape of the function.
   *
   * The gate is the whole point of the pair: one chord, and WHICH SQUARE IS ARMED decides which end
   * it moves. `←` reaches the press back a slot, `→` steps it in; the lift holds either way, which
   * the model does by writing `beat` and `length` together (`pedalOps`).
   *
   * ⚠️ **A press that crosses a barline re-files the pedal under the bar it now starts in**, same
   * object and same id — otherwise the selection this gesture is driven from would evaporate
   * mid-press. `movePedalStartBySlot` owns that; this only repaints.
   *
   * DECLINEs (false) when the start square is not the armed one, when there is no slot to step to,
   * or when the press would reach the lift.
   */
  const moveSelectedPedalStart = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const pedal = selectedOf(state, 'pedal')
    if (!eng || pedal?.endpoint !== 'start') return false
    if (!eng.movePedalStartBySlot(pedal.id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **RE-ANCHOR THE SELECTED OTTAVA'S END by one slot** — the same chord with the bracket's END
   * square armed (his ask, 2026-08-17: *"lets add ctrl shift arrow to the last point for change
   * anchoring"*).
   *
   * ⭐ **The armed square is the GATE, exactly as it is for the hairpin's pair** — which is what
   * makes one chord able to mean "this end" at all: the same keys, and WHICH SQUARE IS ARMED decides
   * which end of the bracket they move.
   *
   * ⚠️ It walks the whole STAFF, not a voice — the pedal's lane and for its reason, spelled out in
   * `ottavaOps.resizeOttavaBySlot`: an octave line has no voice, so a step that skipped the other
   * voice's onsets would displace notes the key never passed.
   *
   * DECLINEs (false) when no ottava is selected, when its end square is not the armed one, when
   * there is nothing further on the staff, or when shrinking would leave it covering no music —
   * refused rather than deleting the line.
   */
  const resizeSelectedOttava = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || ottava?.endpoint !== 'end') return false
    if (!eng.resizeOttavaBySlot(ottava.id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Move the selected ottava's BEGINNING by one slot, WITHOUT moving its end** — the same chord
   * with the bracket's LEFT square armed (his ask, 2026-08-17: *"now lets do the same reanchor with
   * the left square"*). `←` reaches the beginning back a slot, `→` steps it in; the far end holds,
   * which the model does by writing `beat` and `length` together (`ottavaOps`).
   *
   * ⚠️ **A beginning that crosses a barline re-files the line under the bar it now starts in**, same
   * object and same id — otherwise the selection this gesture is being driven from would evaporate
   * mid-press. `moveOttavaStartBySlot` owns that; this only repaints.
   *
   * DECLINEs (false) when the left square is not the armed one, when there is no slot to step to, or
   * when the beginning would reach the end.
   */
  const moveSelectedOttavaStart = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const ottava = selectedOf(state, 'ottava')
    if (!eng || ottava?.endpoint !== 'start') return false
    if (!eng.moveOttavaStartBySlot(ottava.id, direction)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarWidth = (): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (!eng.resetBarWidth(measure)) return false
    renderer.renderScore()
    return true
  }

  /**
   * The BARLINE GAP — the space between the bar's last element and the line that ends it.
   *
   * The third thing you can do to a selected barline, and deliberately the smallest: bar width
   * (Ctrl+←/→) re-spaces the bar's whole music, this moves the line alone and leaves every note
   * where it was. It rides Shift+←/→ because Shift+↑/↓ is already the fine staff-spacing nudge.
   *
   * DECLINEs (false) when no barline is selected, so the key falls through, and when the engine
   * cannot measure the floor from the last render — the same "I don't know" contract as every
   * other measured gesture.
   */
  const nudgeSelectedBarlineGap = (deltaSs: number): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarlineSpace(measure, deltaSs) === null) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarlineGap = (): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (!eng.resetBarlineSpace(measure)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedNoteSpacing = (): boolean => {
    const eng = getEngine()
    const column = selectedColumn()
    if (!eng || !column) return false
    if (!eng.resetNoteSpacing(column.measure, column.beat)) return false
    renderer.renderScore()
    return true
  }

  shortcutManager.registerActions({
    setEntryMode: () => {
      state.selectedTool = 'entry'
      state.selectedNoteId = null
      palette.resetToDefaults()
      const pos = getLastMousePosition()
      if (pos) renderer.renderPreview(pos)
    },
    pressSpace: () => {
      // The typewriter: in keyboard entry, SPACE types a rest of the current duration and moves the
      // caret on — armed or not (the rest tool need not be selected first). It DECLINES (returns
      // false) in every other case, so the key keeps its original job below (start entry) untouched.
      if (keyboard.enterRestAtCursor()) return
      if (state.selectedTool !== 'selection' || !state.selectedNoteId) return
      state.selectedTool = 'entry'
      renderer.renderScore()
    },
    togglePlayback: () => togglePlayback(),
    setActiveVoice1: () => palette.setActiveVoice(1),
    setActiveVoice2: () => palette.setActiveVoice(2),
    setActiveVoice3: () => palette.setActiveVoice(3),
    setActiveVoice4: () => palette.setActiveVoice(4),
    // ⭐ Alt+5 — the MARK half alone: `'all'` returns before touching the entry voice, so this key
    // is inert unless a dynamic or a hairpin is selected (`interactions/markVoiceScope`).
    setMarkScopeAllVoices: () => palette.setActiveVoice('all'),
    copySelection: () => clipboard.copy(),
    pasteClipboard: () => clipboard.paste(),
    // Ctrl+E — the same action as Insert ▸ Text ▸ Expression. The branch (attach-and-edit vs
    // arm the click-to-type tool) lives in MouseController.insertExpression, one source for both.
    editDynamicOnSelection: () => insertExpression(),
    // Enter — edit the selected dynamic inline (twin of double-click). Returns false to DECLINE
    // (keep Enter free) when no dynamic is selected. MouseController.editSelectedDynamic.
    editSelectedDynamic: () => editSelectedDynamic(),
    // Q — the same action as Insert ▸ Clef. Opening a window needs no controller, so this reaches
    // the window layer directly rather than taking a callback through App.ts.
    // (Braces, not a concise body: the handler's return value is the manager's DECLINE signal, and
    // the opened Window is not an answer to that question.)
    openClefWindow: () => {
      openClefWindow(windows)
    },
    // T — the same action as Insert ▸ Time Signature; reaches the window layer directly, like Q.
    openTimeSignatureWindow: () => {
      openTimeSignatureWindow(windows)
    },
    // U — the same action as Insert ▸ Tuplet; reaches the window layer directly, like Q and T.
    openTupletWindow: () => {
      openTupletWindow(windows)
    },
    // Ctrl+F — the same action as Insert ▸ Feathered Beam; reaches the window layer directly, like Q.
    openFeatherWindow: () => {
      openFeatherWindow(windows)
    },
    // Z — the Symbols chart. A TOGGLE, not an open: it is a panel you consult and dismiss with the
    // same key, and it has nothing to commit, so there is no dialog verdict to make Escape mean.
    openSymbolsWindow: () => {
      toggleSymbolsWindow(windows)
    },
    // Ctrl+Alt+T — the tempo twin; branch lives in MouseController.insertTempo.
    insertTempoOnSelection: () => insertTempo(),
    zoomIn: () => viewport.zoomToStop(1, viewportCenter()),
    zoomOut: () => viewport.zoomToStop(-1, viewportCenter()),
    zoomReset: () => {
      const z = viewport.model.getZoom()
      if (z === 1) return
      // factor 1/z lands exactly on 100%, anchored at the viewport center.
      viewport.zoomAt(1 / z, viewportCenter())
    },
    toggleViewMode: () => palette.toggleViewMode(),
    setSelectionMode: () => {
      // ⭐ Esc STOPS PLAYBACK, before anything else it might mean. It is the universal "stop what
      // is happening" key, and while music is playing that is what is happening — `p` toggles, but
      // reaching for Escape is the reflex. Nothing is lost by taking the key here: starting
      // playback clears the selection (`App.togglePlayback`), so there is nothing left for Esc's
      // other duties to clear, and a second press does them anyway.
      if (state.playbackState === 'playing') {
        togglePlayback() // toggling WHILE PLAYING is a stop — one seam, so the two cannot drift
        return
      }
      // Esc then cancels a pending (armed) paste, if any.
      if (state.pastePlacementArmed) {
        clipboard.cancelArmedPaste()
        return
      }
      // Drop focus from the last-clicked toolbar button. Without this it keeps a focus
      // ring — and the Esc keypress itself marks it as keyboard-focused (:focus-visible),
      // so it shows even after the armed tool is disarmed below.
      if (typeof document !== 'undefined') (document.activeElement as HTMLElement | null)?.blur()
      // Leaving entry mode disarms the entry-only positional tools (clef / time
      // signature / dynamic) so the palette stops showing them as selected.
      palette.disarmPositionalTools()
      // …and drops the accent/staccato/tenuto armed for the next note: that note is not coming, and
      // an articulation left armed would ride the next note entered in some later session. The
      // duration and accidental DO carry over — see clearArmedArticulations for why they differ.
      palette.clearArmedArticulations()
      // Esc returns entry to the default voice 1 / staff 0 (Sibelius-style); the
      // selection-mode branch resets them via deselectAll() below, entry needs it explicitly.
      state.activeVoice = 1
      state.activeStaff = 0
      if (state.selectedTool === 'entry') {
        // Entry → selection: keep the cursor note as the selected note.
        state.selectedTool = 'selection'
        selection.selectNote(state.selectedNoteId)
      } else {
        // Already in selection mode: Esc clears the whole current selection — the notes AND
        // the one selected element (dynamic, clef, tie, slur, accidental, tuplet, meter, …).
        selection.deselectAll()
      }
      renderer.renderScore()
    },
    deleteSelected: () => {
      const eng = getEngine()
      if (!eng) return
      const element = state.selectedElement

      // ⭐ A `switch` over the ONE selected element, not a chain of `else if`s over a dozen
      // independent fields. The chain's ORDER used to be load-bearing (several could be set at
      // once, so the first match won); with one field they are mutually exclusive by construction,
      // and `assertNeverElement` makes a fifteenth kind impossible to add without deciding what
      // Delete does to it — which is the one thing you must not forget for a selectable element.
      if (element) {
        switch (element.kind) {
          case 'measureRange': {
            const { anchor, focus, staff, boxStyle } = element
            if (boxStyle === 'double') {
              // A measure span is box-selected via Ctrl+Shift+click (the DOUBLE box, extendable) —
              // Delete removes every WHOLE bar in the span and its contents (Sibelius-style),
              // pulling later bars back and renumbering, all as one undo step. Removing the actual
              // bar is reserved for this gesture; the plain-click box only clears content (below).
              const removed = eng.removeMeasureRange(anchor, focus)
              dbg(`✓ Removed ${removed} measure(s) in span ${Math.min(anchor, focus)}–${Math.max(anchor, focus)}`)
              state.selectedElement = null
            } else {
              // A single bar is plain-click-selected (the SINGLE box) — Delete CLEARS its content
              // rather than removing the bar: the clicked staff's notes/rests reset to the default
              // rest fill (one measure rest, not a per-gap recompute) and the dynamics/slurs the box
              // pulled in are removed, all as ONE undo step (runBatch coalesces).
              const measure = anchor // single box: anchor === focus
              // ⭐ Every mark the box dragged in goes with it — the dynamics and slurs it always
              // took, and (2026-08-19) the four SPANS it now also highlights. Delete takes what the
              // highlight showed, or the highlight is a promise the editor does not keep.
              const marks = markItems(state.selectedItems.values())
              eng.runBatch(`Clear measure ${measure}`, () => {
                eng.clearMeasureStaff(measure, staff)
                removeMarks(eng, marks)
              })
              dbg(`✓ Cleared measure ${measure} (staff ${staff}) to default rest`)
              selection.deselectAll()
            }
            renderer.renderScore()
            return
          }
          case 'articulation': {
            // Group selection: Delete removes every articulation on every selected note,
            // as ONE undoable action (a single Ctrl-Z restores them all). The SET is authoritative
            // (Ctrl-click adds groups); the element is its anchor, and the fallback for safety.
            const ids = selectedArticulationNoteIds(state.selectedItems.values())
            const artNoteIds = ids.length ? ids : [element.noteId]
            eng.runBatch(`Clear articulations on ${artNoteIds.length} note(s)`, () => {
              for (const noteId of artNoteIds) eng.clearArticulations(noteId)
            })
            selection.selectNote(null)
            renderer.renderScore()
            return
          }
          case 'accidental': {
            const noteId = element.noteId
            // Remove the accidental by reverting the note to the measure's prevailing
            // alteration, then clearing any forced sign. This makes the glyph disappear in
            // every case: a lone sharp/flat → natural (prevailing 0); a required natural
            // (♮ cancelling an earlier sharp) → back to that sharp (prevailing ±1).
            eng.updateNote(noteId, { alter: eng.getPrevailingAlter(noteId), forceAccidental: undefined })
            state.selectedElement = null
            selection.selectNote(noteId)
            renderer.renderScore()
            return
          }
          case 'dot': {
            // Removes ALL of the slot's dots at once (`dots` is one value on the chord/rest),
            // including both of a double dot — there is no half-undotting. Keeps the note selected
            // to keep editing, like the accidental above.
            const noteId = element.noteId
            eng.updateNote(noteId, { dots: 0 })
            state.selectedElement = null
            selection.selectNote(noteId)
            renderer.renderScore()
            return
          }
          case 'tremolo': {
            // The whole mark goes, whatever it was: a tremolo is ONE value on the slot, so there is
            // no "remove a stroke" here — that is a different edit (change the mark), and it belongs
            // to the palette/Keypad rather than to Delete. Keeps the note selected afterwards, like
            // the accidental and the dot above, so the obvious next thing (stamp a different mark)
            // is one press away. Until this landed, a stamped tremolo could only be taken off with
            // Ctrl+Z (docs/tremolo-plan.md §2).
            const noteId = element.noteId
            eng.setTremolo(noteId, null)
            state.selectedElement = null
            selection.selectNote(noteId)
            dbg(`✓ Tremolo removed | noteId:${noteId}`)
            renderer.renderScore()
            return
          }
          case 'tie':
            eng.toggleTie(element.fromNoteId)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'slur':
            eng.removeSlur(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'hairpin':
            // The wedge only — never the notes it spans, the slur's rule exactly.
            eng.removeHairpin(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'trill':
            // The ornament only — never the notes it covers, the hairpin's rule exactly.
            eng.removeTrill(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'ottava':
            // The bracket only — never the notes it governs. ⚠️ Deleting it CHANGES WHAT THEY
            // SOUND (the written pitch stays, so the passage drops back an octave), which is the
            // one Delete here whose audible effect is bigger than its visible one. That is the
            // whole point of storing written pitch, not a surprise to guard against.
            eng.removeOttava(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'pedal':
            // The pedal only — never the notes it holds. ⚠️ Like the ottava above, deleting it
            // CHANGES WHAT THEY SOUND: the notes stop ringing to the lift and fall back to their own
            // written lengths (docs/pedal-plan.md §9). Visible and audible, and both intended.
            eng.removePedal(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'tuplet':
            eng.deleteTuplet(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'clef': {
            const removed = eng.removeClefAt(element.measure, beatToFrac(element.beat), element.staff)
            if (!removed) {
              dbg(`Cannot remove clef at measure ${element.measure} beat ${element.beat} (measure 1 opening clef can only be changed)`)
            }
            state.selectedElement = null
            renderer.renderScore()
            return
          }
          case 'timeSignature': {
            const measureNum = element.measure
            if (measureNum === 1) {
              // Measure 1 carries the score's default meter and can't be removed — hide
              // the glyph instead (the 4/4 meter / bar sizing is kept).
              eng.setTimeSignatureHidden(measureNum, true)
            } else {
              // A mid-score change: revert this region to the prior meter and rebar.
              eng.removeTimeSignatureChange(measureNum)
            }
            state.selectedElement = null
            renderer.renderScore()
            return
          }
          case 'dynamic':
            eng.removeDynamic(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'tempo':
            // Removing the mark reverts the score to the previous mark's tempo (or
            // DEFAULT_TEMPO if it was the only one) — there is no global to fall back to.
            eng.removeTempoMark(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'barline':
          case 'stem':
            // Nothing to delete. A barline is a BOUNDARY, not an object — the measures array is the
            // spine, so "delete this barline" would mean merging two bars, a different edit. A stem
            // is a property every non-rest note has; removing it is not a thing you can do to a
            // note. Both are selectable so they can be nudged/dragged, and Delete declines rather
            // than falling through to something else's meaning.
            return
          default:
            assertNeverElement(element)
        }
      }

      if (state.selectedItems.size > 0) {
        // Delete the whole selection as ONE undoable action so a single Ctrl-Z restores the
        // group. The set holds notes plus every mark a box pulled in (`./enclosedMarks`).
        const items = [...state.selectedItems.values()]
        const noteIds = items.filter(i => i.kind === 'note').map(i => i.id)
        const marks = markItems(items)
        const extra = marksLabel(marks)
        const label = `Delete ${noteIds.length} note(s)${extra ? ` + ${extra}` : ''}`
        eng.runBatch(label, () => {
          for (const id of noteIds) eng.deleteNote(id)
          removeMarks(eng, marks)
        })
        selection.selectNote(null)
        renderer.renderScore()
      }
    },
    // EVERY numpad key, through one handler — the pad IS the Keypad panel, so a key press is the
    // press of the cell it sits under ON THE PAGE THAT IS SHOWING, and it runs the same
    // `pressKeypadCell` a click on that cell runs. The panel does not have to be open: the page lives
    // on its own seam, and the presses go out through the palette stores either way.
    //
    // The `code` is the only thing the handler needs, which is why this action serves 16 keys: the
    // meaning is the LAYOUT's to know, never this table's. A code the pad doesn't define declines
    // (`false`), leaving the key to the browser.
    keypadKey: (event) => {
      // No event = invoked from a menu (`ShortcutManager.run`), which cannot name a cell. Decline:
      // this action's whole input IS the key code.
      if (!event) return false
      const cell = keypadCellForCode(keypadPageSelection.get(), event.code)
      if (!cell) return false
      pressKeypadCell(cell)
    },
    // Straight to a NAMED Keypad page, rather than stepping the `+` ring to reach it. The seam is
    // the same one the panel and the numpad read, so the pad follows whether or not it is open.
    keypadNoteEntryPage: () => keypadPageSelection.set('noteEntry'),
    createSlur: () => palette.createSlur(),
    createCrescendo: () => palette.createCrescendo(),
    createDiminuendo: () => palette.createDiminuendo(),
    // Ctrl+Shift+B: keyboard accelerator for the "Add Measure" button — inserts one bar
    // after the Ctrl+Shift-selected measure span (Sibelius's single-bar shortcut). No-op
    // (logged) unless a measure box is selected; PaletteController owns the gating.
    addMeasureAfter: () => palette.addMeasureAfter(),
    toggleRestHidden: () => {
      // Sibelius-style hide/show: toggle every selected REST's own hidden state, all in one
      // undo step (mirrors how deleteSelected batches articulations). Non-rest selections are
      // ignored (notes/text not supported yet). See docs/rest-hide-plan.md.
      const eng = getEngine()
      if (!eng) return
      const restIds = [...state.selectedItems.values()]
        .filter((i) => i.kind === 'note')
        .map((i) => i.id)
        .filter((id) => eng.getNote(id)?.isRest)
      if (!restIds.length) return
      eng.runBatch(`Hide/Show ${restIds.length} rest(s)`, () => {
        for (const id of restIds) eng.toggleRestHidden(id)
      })
      renderer.renderScore()
    },
    // ⭐ Tab walks the selected slur's handles. Returning the DECLINE straight through is what keeps
    // Tab the browser's focus key when no slur is selected — the manager only calls preventDefault
    // when a handler does not answer false.
    nextHandle: () => walkSlurHandles(1) || walkHairpinHandles(1) || walkOttavaHandles(1)
      || walkPedalHandles(1) || walkTrillHandles(1),
    previousHandle: () => walkSlurHandles(-1) || walkHairpinHandles(-1) || walkOttavaHandles(-1)
      || walkPedalHandles(-1) || walkTrillHandles(-1),
    selectNextNote: () => {
      // Armed slur point / selected dynamic → fine nudge right instead of navigating.
      if (nudgeArmedSlurPoint(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedSlur(NUDGE_FINE_SS, 0)) return
      if (nudgeArmedHairpinEnd(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedHairpin(NUDGE_FINE_SS, 0)) return
      if (nudgeArmedOttavaEnd(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedOttava(NUDGE_FINE_SS, 0)) return
      if (nudgeArmedPedalEnd(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedPedal(NUDGE_FINE_SS, 0)) return
      if (nudgeArmedTrillEnd(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedTrill(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedDynamic(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedTempo(NUDGE_FINE_SS, 0)) return
      // A selected BARLINE walks to the next one — same dispatch-on-selection as Shift+Alt+←/→.
      if (selection.navigateBarline(1)) return
      if (state.selectedTool === 'entry') {
        dbg(`[Nav] ArrowRight in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        selection.navigateSelection(1)
      } else {
        selection.navigateSelection(1)
      }
    },
    selectPreviousNote: () => {
      // Armed slur point / selected dynamic → fine nudge left instead of navigating.
      if (nudgeArmedSlurPoint(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedSlur(-NUDGE_FINE_SS, 0)) return
      if (nudgeArmedHairpinEnd(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedHairpin(-NUDGE_FINE_SS, 0)) return
      if (nudgeArmedOttavaEnd(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedOttava(-NUDGE_FINE_SS, 0)) return
      if (nudgeArmedPedalEnd(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedPedal(-NUDGE_FINE_SS, 0)) return
      if (nudgeArmedTrillEnd(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedTrill(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedDynamic(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedTempo(-NUDGE_FINE_SS, 0)) return
      if (selection.navigateBarline(-1)) return
      if (state.selectedTool === 'entry') {
        dbg(`[Nav] ArrowLeft in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        renderer.renderScore()
      } else {
        selection.navigateSelection(-1)
      }
    },
    // Alt+↑/↓ modally overloads by selection kind: a single measure box → nudge staff spacing
    // by the COARSE step (↑ lifts the staff = less space above = negative delta); otherwise →
    // chord navigation. The two selection states are disjoint (plan §6, the `pitchUp` precedent).
    chordNoteUp: () => { if (nudgeStaffSpacingIfBoxSelected(-STAFF_SPACING_COARSE_SS)) return; selection.navigateChord(1) },
    chordNoteDown: () => { if (nudgeStaffSpacingIfBoxSelected(STAFF_SPACING_COARSE_SS)) return; selection.navigateChord(-1) },
    // Shift+↑/↓ fine staff-spacing (only fires on a single measure box → no fallthrough
    // needed; Shift+Arrow is otherwise unbound).
    // ⭐ Shift+↑/↓ = OPEN / close the armed wedge's mouth, else the fine staff-spacing nudge on a
    //   selected measure box. Disjoint selections, so it is one more branch and no reordering.
    staffSpacingFineUp: () => nudgeArmedMouth(MOUTH_STEP_SS) || nudgeStaffSpacingIfBoxSelected(-STAFF_SPACING_FINE_SS),
    staffSpacingFineDown: () => nudgeArmedMouth(-MOUTH_STEP_SS) || nudgeStaffSpacingIfBoxSelected(STAFF_SPACING_FINE_SS),
    // Shift+←/→ = the barline gap, the fine horizontal partner of Shift+↑/↓ above.
    barlineGapTighten: () => { nudgeSelectedBarlineGap(-BARLINE_GAP_STEP_SS) },
    barlineGapWiden: () => { nudgeSelectedBarlineGap(BARLINE_GAP_STEP_SS) },
    resetBarlineGap: () => resetArmedMouth() || resetSelectedBarlineGap(),
    voiceNavUp: () => selection.navigateVoice(1),
    voiceNavDown: () => selection.navigateVoice(-1),
    // Vertical arrows: nudge the armed slur endpoint, else the normal pitch/octave edit.
    // (These keys are already bound, so they always consume — the nudge branch returns void
    // via the early return, so preventDefault still fires.)
    pitchUp: () => { if (nudgeArmedSlurPoint(0, -NUDGE_FINE_SS) || nudgeSelectedSlur(0, -NUDGE_FINE_SS) || nudgeArmedHairpinEnd(0, -NUDGE_FINE_SS) || nudgeSelectedHairpin(0, -NUDGE_FINE_SS) || nudgeArmedOttavaEnd(0, -NUDGE_FINE_SS) || nudgeSelectedOttava(0, -NUDGE_FINE_SS) || nudgeArmedPedalEnd(0, -NUDGE_FINE_SS) || nudgeSelectedPedal(0, -NUDGE_FINE_SS) || nudgeArmedTrillEnd(0, -NUDGE_FINE_SS) || nudgeSelectedTrill(0, -NUDGE_FINE_SS) || nudgeSelectedRest(1) || nudgeSelectedDynamic(0, -NUDGE_FINE_SS) || nudgeSelectedTempo(0, NUDGE_FINE_SS)) return; selection.adjustPitch(1) },
    pitchDown: () => { if (nudgeArmedSlurPoint(0, NUDGE_FINE_SS) || nudgeSelectedSlur(0, NUDGE_FINE_SS) || nudgeArmedHairpinEnd(0, NUDGE_FINE_SS) || nudgeSelectedHairpin(0, NUDGE_FINE_SS) || nudgeArmedOttavaEnd(0, NUDGE_FINE_SS) || nudgeSelectedOttava(0, NUDGE_FINE_SS) || nudgeArmedPedalEnd(0, NUDGE_FINE_SS) || nudgeSelectedPedal(0, NUDGE_FINE_SS) || nudgeArmedTrillEnd(0, NUDGE_FINE_SS) || nudgeSelectedTrill(0, NUDGE_FINE_SS) || nudgeSelectedRest(-1) || nudgeSelectedDynamic(0, NUDGE_FINE_SS) || nudgeSelectedTempo(0, -NUDGE_FINE_SS)) return; selection.adjustPitch(-1) },
    octaveUp: () => { if (!(nudgeArmedSlurPoint(0, -NUDGE_COARSE_SS) || nudgeSelectedSlur(0, -NUDGE_COARSE_SS) || nudgeArmedHairpinEnd(0, -NUDGE_COARSE_SS) || nudgeSelectedHairpin(0, -NUDGE_COARSE_SS) || nudgeArmedOttavaEnd(0, -NUDGE_COARSE_SS) || nudgeSelectedOttava(0, -NUDGE_COARSE_SS) || nudgeArmedPedalEnd(0, -NUDGE_COARSE_SS) || nudgeSelectedPedal(0, -NUDGE_COARSE_SS) || nudgeArmedTrillEnd(0, -NUDGE_COARSE_SS) || nudgeSelectedTrill(0, -NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, -NUDGE_COARSE_SS) || nudgeSelectedTempo(0, NUDGE_COARSE_SS))) selection.adjustOctave(1) },
    octaveDown: () => { if (!(nudgeArmedSlurPoint(0, NUDGE_COARSE_SS) || nudgeSelectedSlur(0, NUDGE_COARSE_SS) || nudgeArmedHairpinEnd(0, NUDGE_COARSE_SS) || nudgeSelectedHairpin(0, NUDGE_COARSE_SS) || nudgeArmedOttavaEnd(0, NUDGE_COARSE_SS) || nudgeSelectedOttava(0, NUDGE_COARSE_SS) || nudgeArmedPedalEnd(0, NUDGE_COARSE_SS) || nudgeSelectedPedal(0, NUDGE_COARSE_SS) || nudgeArmedTrillEnd(0, NUDGE_COARSE_SS) || nudgeSelectedTrill(0, NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, NUDGE_COARSE_SS) || nudgeSelectedTempo(0, -NUDGE_COARSE_SS))) selection.adjustOctave(-1) },
    // ── Ctrl+←/→ = MOVE: change the space before a selected note's column, or a selected barline's
    //    bar width — "move a lot" gets the easy key (docs/note-offset-plan.md §C swap). Joins the
    //    slur-endpoint / dynamic COARSE nudge that already owned Ctrl+←/→ (all selections disjoint).
    //    Left = tighten/narrow, right = widen. DECLINEs (false) when nothing applicable is selected,
    //    keeping the key free. One undo per press.
    //    ⭐⭐ EVERY BRANCH HERE WRITES AN OFFSET — this chord moves INK, and the model write that
    //    moves a span through the music is `Ctrl+Shift+←/→` below. Two families have been moved out
    //    of here to keep that true: the HAIRPIN's resize (2026-08-17) and the PEDAL's lift
    //    (2026-08-18), both ungated, so a selected wedge or pedal ate this chord outright and did
    //    something AUDIBLE with it. ⛔ Do not put a model write back on this key.
    //
    //    ⭐⭐ **ONE EXCEPTION, his call (2026-08-18): the armed slur ENDPOINT.** Its offset now
    //    carries the anchor along once the ink reaches the next note (`./slurEndpointWalk`), which
    //    is a model write on this key and IS audible — a slur's span is what `legatoChordIds`
    //    lengthens. It is allowed because it is not the failure the rule was written about: the two
    //    evicted families ate the chord OUTRIGHT and changed the music on the first press with
    //    nothing on screen to say so. This one moves ink press after press, re-anchors only on
    //    arrival at a note the user has steered the ink onto, and the note it lands on is TINTED
    //    throughout (`applyArmedSlurAnchorNote`) — so the change is asked for, visible, and one
    //    undo press away. *"a shortcut is for making the live easy to the user"*. ⛔ The rule still
    //    stands for everything else: an ungated model write here is still the bug it was.
    //    ⭐ The pedal came BACK to it the same day as its ink offsets — as an offset this time, and
    //    gated: armed square → that sign, nothing armed → both. It is the fourth family to read the
    //    same way here (slur point, wedge, bracket, pedal).
    //    ⭐⭐ …and the DYNAMIC is the second exception, his ask of 2026-08-19 (`./dynamicWalk`): the
    //    same interpolating walk, on a mark whose anchor is a SLOT rather than a note. It is allowed
    //    for the slur endpoint's reason and no other — ink press after press, a re-anchor only on
    //    arrival at a slot the user has steered the ink onto, and the mark's own guide line drawn to
    //    its anchor throughout, so the change is asked for, visible, and one undo press away.
    ctrlArrowLeft: () =>
      nudgeArmedSlurPoint(-NUDGE_COARSE_SS, 0) || nudgeSelectedSlur(-NUDGE_COARSE_SS, 0) || nudgeArmedHairpinEnd(-NUDGE_COARSE_SS, 0)
      || nudgeSelectedHairpin(-NUDGE_COARSE_SS, 0) || nudgeArmedOttavaEnd(-NUDGE_COARSE_SS, 0) || nudgeSelectedOttava(-NUDGE_COARSE_SS, 0)
      || nudgeSelectedDynamic(-NUDGE_COARSE_SS, 0) || nudgeSelectedTempo(-NUDGE_COARSE_SS, 0)
      || nudgeArmedPedalEnd(-NUDGE_COARSE_SS, 0) || nudgeSelectedPedal(-NUDGE_COARSE_SS, 0)
      || nudgeArmedTrillEnd(-NUDGE_COARSE_SS, 0) || nudgeSelectedTrill(-NUDGE_COARSE_SS, 0)
      || nudgeSelectedNoteSpacing(-NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(-BAR_WIDTH_STEP_PX),
    ctrlArrowRight: () =>
      nudgeArmedSlurPoint(NUDGE_COARSE_SS, 0) || nudgeSelectedSlur(NUDGE_COARSE_SS, 0) || nudgeArmedHairpinEnd(NUDGE_COARSE_SS, 0)
      || nudgeSelectedHairpin(NUDGE_COARSE_SS, 0) || nudgeArmedOttavaEnd(NUDGE_COARSE_SS, 0) || nudgeSelectedOttava(NUDGE_COARSE_SS, 0)
      || nudgeSelectedDynamic(NUDGE_COARSE_SS, 0) || nudgeSelectedTempo(NUDGE_COARSE_SS, 0)
      || nudgeArmedPedalEnd(NUDGE_COARSE_SS, 0) || nudgeSelectedPedal(NUDGE_COARSE_SS, 0)
      || nudgeArmedTrillEnd(NUDGE_COARSE_SS, 0) || nudgeSelectedTrill(NUDGE_COARSE_SS, 0)
      || nudgeSelectedNoteSpacing(NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(BAR_WIDTH_STEP_PX),
    // Ctrl+Backspace = reset the MOVE (the space before the note / the bar's width).
    resetMove: () => resetArmedSlurPoint() || resetSelectedSlur() || resetArmedHairpinEnd() || resetSelectedHairpin()
      || resetArmedOttavaEnd() || resetSelectedOttava() || resetArmedPedalEnd() || resetSelectedPedal()
      || resetArmedTrillEnd() || resetSelectedTrill()
      || resetSelectedDynamic() || resetSelectedTempo()
      || resetSelectedNoteSpacing() || resetSelectedBarWidth(),

    // ── Note OFFSET (the small, deliberate nudge off the natural column) rides the harder chords:
    //    Ctrl+Shift+←/→ = WIDE (1 space), Shift+Alt+←/→ = FINE (¼ space). "Should not offset that
    //    much" → the deliberate chords, not the easy key. Each DECLINEs when no single note/rest is
    //    selected. See docs/note-offset-plan.md §C.
    //    ⭐ An armed slur ENDPOINT gets the chord first: it re-anchors one note left/right instead
    //    (Ctrl+←/→ already nudges that point by pixels, so Shift on the same axis means "move the
    //    anchor" — see `slurReanchor`). Disjoint from the offset, which needs a selected NOTE.
    //    ⭐ …and an armed hairpin square moves ITS OWN end by a slot on the same chord (his call,
    //    2026-08-17): the same sentence — "move this end of the span" — about the other kind of
    //    spanner. The RIGHT square resizes; the LEFT one moves the start and holds the end. Two
    //    branches rather than one because they are two model writes, and both DECLINE unless their
    //    square is the armed one. Disjoint from the note offset: one `selectedElement`, one kind.
    //    ⭐ …and the same pair again for an armed OTTAVA square, his ask of the same day: the RIGHT
    //    square re-anchors the end, the LEFT one moves the beginning and holds the end. Two branches
    //    for the hairpin's reason (two model writes), and both walk the whole STAFF rather than a
    //    voice, because an octave line has none.
    //    ⭐ …and a fourth family, the TRILL (2026-08-18) — ⭐⭐ but ONE branch, not a pair, and by
    //    NOTE rather than by slot: a trill's anchors are notes, and the same module answers for both
    //    of its squares because the walk is one lane either way (`trillReanchor`).
    //    ⭐ …and the same pair a third time for an armed PEDAL square (2026-08-18): the RIGHT one
    //    moves the LIFT, the LEFT one moves the press and holds the lift. 🚨 The lift move ARRIVED
    //    HERE FROM `Ctrl+←/→`, where it had been ungated since P3 — the pedal was the family whose
    //    "resize" is audible sitting on the chord that nudges ink. The three pairs now read the
    //    same, which is the point: one sentence, one chord, whichever spanner is selected.
    ctrlShiftArrowLeft: () =>
      reanchorArmedEndpoint(-1) || resizeSelectedHairpin(-1) || moveSelectedHairpinStart(-1)
      || resizeSelectedOttava(-1) || moveSelectedOttavaStart(-1)
      || resizeSelectedPedal(-1) || moveSelectedPedalStart(-1) || reanchorArmedTrill(-1)
      || reanchorSelectedDynamic(-1) || reanchorSelectedTempo(-1)
      || nudgeSelectedNoteOffset(-NUDGE_COARSE_SS),
    ctrlShiftArrowRight: () =>
      reanchorArmedEndpoint(1) || resizeSelectedHairpin(1) || moveSelectedHairpinStart(1)
      || resizeSelectedOttava(1) || moveSelectedOttavaStart(1)
      || resizeSelectedPedal(1) || moveSelectedPedalStart(1) || reanchorArmedTrill(1)
      || reanchorSelectedDynamic(1) || reanchorSelectedTempo(1)
      || nudgeSelectedNoteOffset(NUDGE_COARSE_SS),
    nudgeNoteOffsetFineLeft: () => nudgeSelectedNoteOffset(-NUDGE_FINE_SS),
    nudgeNoteOffsetFineRight: () => nudgeSelectedNoteOffset(NUDGE_FINE_SS),
    // Ctrl+Shift+Backspace AND Shift+Alt+Backspace both reset the offset — it is one value, and each
    // of its two arrow-chords gets a matching backspace. DECLINEs when nothing to reset.
    resetNoteOffset: () => resetSelectedNoteOffset(),
    undo: () => {
      const eng = getEngine()
      if (eng?.undo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    redo: () => {
      const eng = getEngine()
      if (eng?.redo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    // `x` = turn the selected thing around. WHICH thing, and what "around" means for it, is
    // `interactions/flipSelection.ts`'s table — it used to be a six-branch chain here, and the
    // octave line would have made it seven. ⚠️ The repaint is conditional: a decline means the key
    // did nothing, and rendering to show no change is the reflex to avoid.
    flipStemDirection: () => {
      const eng = getEngine()
      if (eng && flipSelection(state, eng)) renderer.renderScore()
    },
    toggleDot: () => palette.toggleDot(),
    // One handler per preset, generated from the SAME table the keys are — see tupletPresets. The M
    // is worked out from the METER where the click lands (armTupletPreset), with the table's own M
    // as the fallback for a meter that has no tuplet of that N. Pressing the armed one disarms it.
    ...Object.fromEntries(
      TUPLET_PRESETS.map(preset => [
        tupletPresetAction(preset),
        () => palette.armTupletPreset(preset.n, preset.m),
      ]),
    ),
    enterNoteA: () => keyboard.enterNoteByLetter('a'),
    enterNoteB: () => keyboard.enterNoteByLetter('b'),
    enterNoteC: () => keyboard.enterNoteByLetter('c'),
    enterNoteD: () => keyboard.enterNoteByLetter('d'),
    enterNoteE: () => keyboard.enterNoteByLetter('e'),
    enterNoteF: () => keyboard.enterNoteByLetter('f'),
    enterNoteG: () => keyboard.enterNoteByLetter('g'),
    addChordA: () => keyboard.addChordNoteByLetter('a'),
    addChordB: () => keyboard.addChordNoteByLetter('b'),
    addChordC: () => keyboard.addChordNoteByLetter('c'),
    addChordD: () => keyboard.addChordNoteByLetter('d'),
    addChordE: () => keyboard.addChordNoteByLetter('e'),
    addChordF: () => keyboard.addChordNoteByLetter('f'),
    addChordG: () => keyboard.addChordNoteByLetter('g'),
  })

  return {
    enable: () => shortcutManager.enable(),
    disable: () => shortcutManager.disable(),
    // A MENU ROW runs its command through here — the same handler the accelerator runs, never a
    // copy of it. See `ShortcutManager.run`.
    run: (action: string) => shortcutManager.run(action),
  }
}
