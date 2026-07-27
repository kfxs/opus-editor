import { Renderer, Stave, StaveConnector, StaveNote, NoteHead, Voice, Formatter, Accidental, Articulation, Annotation, Modifier, Beam, Stem, StaveTie, Dot, Barline, ClefNote } from 'vexflow'
import { ScoreTuplet, layoutTupletMark, drawTupletMark } from './ScoreTuplet'
import { CenteredTremolo, TREMOLO_FLAG_STEM_STRETCH, TREMOLO_STROKE_CLEARANCE, usableStemSpan } from './CenteredTremolo'
import { twoNoteTremoloStrokes } from './TwoNoteTremolo'
import { TREMOLO_PAIR_GROUP, pairDrawing, pairIsJoined, pairRoleAt, pairStrokesDrawn } from '@/utils/tremoloPair'
import { fannedBeamGeometry, fanJoinQuads, fanStemExtension, FAN_MIN_HEAD_GAP_RATIO, FAN_MIN_STEM_SPACES, type FanGeometry, type FanGeometryOptions, type FanQuad } from './FannedBeam'
import { FAN_GROUP, fanMembers, fanMemberPitches, fanMemberBeats } from '@/utils/fannedBeam'
import type { SVGContext } from 'vexflow'
// Engine-owned notation styles (cursor ghosts, selection highlight). Imported here
// so they travel with the renderer — no UI-framework wiring required. See notation.css.
import './notation.css'
import type { Score, Measure, Clef, ArticulationType, Tuplet, Chord, ChordRest, Fraction, PitchStep, GhostNote, TimeSignature, Dynamic, TempoMark, NoteDuration, TremoloMark, NotePitch, Accidental as ScoreAccidental } from '@/types/music'
import { fracToNumber, fracEq, fracCompare, fracLte, fracIsZero, fracCreate, fracAdd } from '@/utils/fraction'
import { measureEndingClef, effectiveClefAt, effectiveClefBefore, middleLineDiatonicPos, staffLineForSpelling, resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { displayedAccidentals } from '@/utils/accidentalState'
import { beatToFrac, measureCapacityFrac, tupletBracketed, tupletBracketEnd, tupletMarkRuns } from '@/utils/musicUtils'
import { durationToVexflow, durationToFraction } from '@/utils/durations'
import { getMeterInfo, timeSignatureVexKey, type MeterInfo } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { computeBeamGroups, secondaryBreakIndices } from '@/utils/beaming'
import { planCrossBarBeams, laneKey, type CrossBarBeamPlan, type CrossBarJoin, type CrossBarFanJoin, type CrossBarSide, type LaneBeamPlan } from './CrossBarBeams'
import { ElementRegistry, offsetStaffGeometry, type TupletGeometry, type ClefSegment, type ElementInfo, type StaffGeometry } from '@/engine/ElementRegistry'
import { measureShapeKey } from './MeasureRedrawKey'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos, alterToString } from '@/utils/pitchSpelling'
import type { FanMemberAnchor, RenderPass } from './RenderPass'
import { renderTies, getTieDirection, TIE_BOW } from './TieRenderer'
import { drawCurveArc, CURVE_THICKNESS } from './curveArc'
import { renderSlurs } from './SlurRenderer'
import { attachDynamicsToSlots, layoutCoLocatedDynamics, applyDynamicOffsets, buildDynamicAnnotation, registerDynamics, applyMixedDynamicRuns, enlargeDynamicGlyphRuns } from './DynamicsLayout'
import { drawTempoMarks, drawTempoText } from './TempoLayout'
import {
  convertDuration,
  chooseVoiceMode,
  createStaveNotesFromSlots,
  restSupportingLedgerLine,
  makeClefResolver,
  drawsTimeSignature,
  ARTICULATION_RENDER_ORDER,
  resolveTupletLocation,
  innerFlipTupletYOffset,
  type TupletNoteStem,
} from './NoteBuilder'
import { calculateMeasureWidths } from './MeasureLayout'
import { MeasureWidthCache } from './MeasureWidthCache'
import { renderCensus } from '@/dev/renderCensus' // P0 instrument — temporary, see §8
import { restShiftOverrideOf, restHiddenOf, restPositionKey, resolveStaffSpacingAbove, measureLeadingSpaces, measureUserSpacePx, noteOffsetOverrideOf, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'
import { getStaves, staffMeasureView, firstStaffId, staffIdAtIndex, staffIndexOfId } from '@/engine/models/staffContent'
import { LAYOUT_CONFIG, VIEWPORT_HEIGHT, type MeasureWidthInfo, type ViewMode } from './layoutConfig'
import type { Rect } from '@/engine/ViewportModel'
import { dbg } from '@/utils/debug'

// Re-exported for existing importers (MusicEngine, App.ts, RenderPass) that referenced
// these from the renderer before they moved to ./layoutConfig.
export { LAYOUT_CONFIG, VIEWPORT_HEIGHT, type MeasureWidthInfo }

/** Gray a hidden rest renders in (Tailwind gray-400 family) — see docs/rest-hide-plan.md. */
const HIDDEN_REST_COLOR = '#9CA3AF'

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
const LEDGER_LINE_STYLE = { strokeStyle: '#000000', lineWidth: 1.25 }

/**
 * How far the ghost's tuplet number floats above the note, in STAFF SPACES — measured from the stem
 * tip (stem up) or the notehead (stem down) to the number's baseline.
 *
 * In spaces and not pixels so it holds at any staff size, and ONE knob because both stem directions
 * take the same gap: it is the same "clear of the note" distance, and the anchor is what differs.
 * Tune here.
 */
const GHOST_TUPLET_NUMBER_GAP = 1.5

/**
 * Apply the bar's user-authored horizontal space (client #10 — docs/note-spacing-plan.md §4) by
 * **moving the columns, never the glyphs**.
 *
 * `note.getAbsoluteX()` is `tickContext.getX() + stave.getNoteStartX()`, read lazily at draw time,
 * and `Formatter.postFormat()` runs *inside* `format()` — so shifting a TickContext after `format()`
 * returns is the last word on where everything in that column lands. Which is the whole trick:
 *
 * - every voice at that tick moves with it, because `joinVoices` gives them ONE shared TickContext;
 * - beams, tuplets and ties read note x at draw time, so they follow;
 * - `ElementRegistry` registers post-draw, so hit-testing is correct with nothing extra.
 *
 * ⛔ `note.setXShift()` is the wrong tool and must not appear in this feature: it moves the glyph
 * and leaves the column where it was — that is an *offset*, which is precisely what a space is not.
 *
 * ## The anchor is a TICK, not a slot
 *
 * The tempting version — find the `StaveNote` at that beat and take its tick context — is wrong,
 * and wrong in the way that breaks the promise the key makes. Each staff formats in its **own**
 * `Formatter`, so on a staff with no slot *starting* at the anchor beat there is no anchor
 * `StaveNote` at all and nothing would shift — while the bar was widened for every staff. Staff 1
 * `q q q q`, staff 2 `h h`, a space before beat 1: staff 2 never moves, and from beat 1 on the
 * grand staff drifts apart. Dropping `staffId` from the key exists to prevent exactly that.
 *
 * So: convert the beat to VexFlow ticks and shift the first context at or after it, plus every
 * later one. Ticks-per-quarter is *derived* from the voice (`getTotalTicks()` over the meter's
 * quarters) rather than hard-coded, because `Tables.RESOLUTION` is not on the package's public
 * entry — cf. `Glyphs`, which is CJS-only and undefined in the browser.
 */
function applyLeadingSpaces(formatter: Formatter, voices: Voice[], score: Score, measure: Measure): void {
  const spaces = measureLeadingSpaces(score, measure.id)
  if (spaces.length === 0 || voices.length === 0) return

  const contexts = formatter.getTickContexts()
  if (!contexts) return
  const { list, map, resolutionMultiplier } = contexts

  // Ticks per quarter note, asked of VexFlow rather than assumed. A Voice's total ticks is
  // numBeats/beatValue expressed in VexFlow's own resolution, so dividing by the same meter in
  // quarters cancels the resolution out — exact in 4/4, 6/8, 7/16 alike.
  const meterQuarters = (measure.timeSignature.numerator * 4) / measure.timeSignature.denominator
  if (!(meterQuarters > 0)) return
  const ticksPerQuarter = (voices[0].getTotalTicks().value() / meterQuarters) * resolutionMultiplier
  if (!(ticksPerQuarter > 0)) return

  // Half a tick: context ticks are integers, so this absorbs the float division above without ever
  // reaching a neighbouring column.
  const EPSILON = 0.5

  // `spaces` is in beat order and `list` in tick order, so one pass over the columns carries a
  // running delta: everything right of an anchor moves by the same amount, and a second anchor
  // later in the bar adds to it. An anchor past the last column contributes nothing to the shift —
  // its width still went into the bar, which is right: the column exists on some OTHER staff, and
  // this one keeps the room as a gap before the barline.
  let delta = 0
  let next = 0
  for (const tick of list) {
    while (next < spaces.length) {
      const beat = spaces[next].beat
      const anchorTick = (beat.num / beat.den) * ticksPerQuarter
      if (tick + EPSILON < anchorTick) break
      delta += spaces[next].space * VEXFLOW_DEFAULT_STAFF_SPACE_PX
      next++
    }
    if (delta === 0) continue
    const context = map[tick]
    if (context) context.setX(context.getX() + delta)
  }
}

/**
 * The authored leading space before each MEMBER of a fanned slot, in pixels — the §7 half of client
 * #10 (docs/note-spacing-plan.md). Entry k is the space before member k; entry 0 is always 0,
 * because the space before member 0 is the space before the fan's own column and
 * {@link applyLeadingSpaces} has already spent it on the tick context.
 *
 * A member's address is an ORDINARY `spacingPositionKey` at the member's own beat — the key takes
 * any rational and `fanMemberBeats` hands out exact ones — so this is a lookup, not a second
 * storage scheme. The beats are compared by cross-multiplication rather than as floats: both sides
 * come out of the same expander, and an exact match is the whole reason the address works.
 *
 * Returns an empty array when nothing in the bar is spaced, which is the ordinary case.
 */
function fanMemberSpacesPx(score: Score, measureNumber: number, slot: Chord): number[] {
  if (!slot.fan) return []
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return []
  const spaces = measureLeadingSpaces(score, measure.id)
  if (spaces.length === 0) return []

  const beats = fanMemberBeats(slot.fan, slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0), slot.beat)
  return beats.map((beat, k) => {
    if (k === 0) return 0 // member 0's space IS the column's, already applied
    const hit = spaces.find(s => s.beat.num * beat.den === beat.num * s.beat.den)
    return (hit?.space ?? 0) * VEXFLOW_DEFAULT_STAFF_SPACE_PX
  })
}

/**
 * ⭐ The authored leading space, in pixels, before the column that FOLLOWS a fanned slot — the room
 * the ramp must NOT spend (his report: *"the distance between the last element of the fan and the
 * rest should increase; instead the fan enlarges and that gap stays constant"*).
 *
 * The space is authored on the NEXT note's own column, so `applyLeadingSpaces` moved that note and
 * every tick context after it — which means `spanEndX` (the next note's head) arrives already
 * carrying it. Left in, it becomes part of `usable` and the proportional ramp shares it out among
 * every gap in the group: the fan grows, and the one gap the user was widening does not. Taken back
 * out, the ramp keeps exactly the shape it had and the whole of the space lands where it was asked
 * for — between the last member and the note after it.
 *
 * ⚠️ The same lever from the other end as {@link fanMemberSpacesPx}: a space authored INSIDE the
 * group opens one member's gap (that one comes off the top and the ramp shares what is left), a
 * space authored just AFTER it opens the gap the group does not own at all.
 *
 * The address is the group's own end — `slot.beat + its full duration`, the column the next note
 * starts at. Nothing there (the fan runs to the barline, or nothing is spaced) ⇒ 0.
 */
function fanTrailingSpacePx(score: Score, measureNumber: number, slot: Chord): number {
  if (!slot.fan) return 0
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return 0
  const spaces = measureLeadingSpaces(score, measure.id)
  if (spaces.length === 0) return 0
  const end = fracAdd(slot.beat, slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0))
  const hit = spaces.find(s => s.beat.num * end.den === end.num * s.beat.den)
  // ⚠️ The SAME px-per-staff-space `applyLeadingSpaces` shifted the context by — this undoes exactly
  // that shift, so it has to be measured in exactly that unit.
  return (hit?.space ?? 0) * VEXFLOW_DEFAULT_STAFF_SPACE_PX
}

/**
 * ⭐ The authored horizontal OFFSET of each member of a fanned slot, in pixels — the fan's half of
 * client #12 (docs/note-offset-plan.md §"Inside a FAN"). Entry k is member k's own offset, entry 0
 * the OWNER's (which `applyNoteOffsets` has already spent on the `StaveNote`, and which
 * `fannedBeamGeometry` therefore takes back OUT of `headX` to find the natural column).
 *
 * ⚠️ **The twin of {@link fanMemberSpacesPx} with the opposite arithmetic** — a space is width the
 * bar already grew for, an offset is no width at all. The keys differ for the same reason: a space is
 * addressed by the member's own BEAT (a column exists there), an offset by the member's own first
 * pitch ID (`ScoreModel.offsetTargetOf`), because it is a property of that head and not of a column.
 *
 * Returns an empty array when nothing in the group is offset, which is the ordinary case.
 */
function fanMemberOffsetsPx(score: Score, slot: Chord, stave: Stave): number[] {
  if (!slot.fan) return []
  const count = Math.max(1, Math.round(slot.fan.count))
  const out: number[] = []
  let any = false
  for (let k = 0; k < count; k++) {
    // Member 0 IS the slot; members 1…n are keyed by their own first pitch. ⚠️ A member with no
    // stored pitches (a mark that never went through `normalizeFan`) has no id to be offset by and
    // cannot be selected either — it draws on the slot's own pitch, so it answers 0 here.
    const key = k === 0 ? slot.id : slot.fan.members?.[k - 1]?.[0]?.id
    const x = key ? noteOffsetOverrideOf(score, key)?.x ?? 0 : 0
    if (x !== 0) any = true
    out.push(x === 0 ? 0 : staffSpacesToPixels(x, stave))
  }
  return any ? out : []
}

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
  /** REAL vertical span of this measure's whole system in px (staff 0's top → below the last
   *  staff), including any Client #7 per-system staff-spacing extra. Undefined until a render
   *  populates it; `pixelToMeasure` falls back to the uniform `staffHeight·numStaves` when
   *  absent, which is wrong once staves are spaced apart — hence this real height. */
  systemHeight?: number
}

/**
 * VexFlow wrapper service for rendering musical notation
 * This service abstracts VexFlow complexity and provides a clean API
 */

/**
 * The identity of one drawn measure-on-a-staff. VexFlow's `openGroup` prefixes it, so this becomes
 * `id="vf-m7-s2"` in the SVG — measure 7, staff 2.
 */
export function measureGroupKey(measureNumber: number, staffIndex: number): string {
  return `m${measureNumber}-s${staffIndex}`
}

/**
 * The stand-in a note wears while its real beam does not exist yet — a note beamed across a barline,
 * between its own bar's draw and the post-measure pass that builds the joined `Beam`
 * (docs/cross-barline-beaming-plan.md).
 *
 * It is never drawn and never asked anything: VexFlow only tests `note.beam` for *existence* when
 * deciding to draw a flag (`shouldDrawFlag`) or a stem (`draw`), and the one method it does call on
 * it — `postFormat`, forwarded by `StemmableNote.postFormat` during formatting — is the no-op below.
 * A real `Beam` cannot serve: its constructor throws on fewer than two notes, and `♪ | ♪` (one note
 * each side of the barline) is the canonical case this feature exists for.
 */
const PLACEHOLDER_BEAM = { postFormat: () => {} } as unknown as Beam

/**
 * A fanned slot JOINED to the group on its left (docs/fan-beam-join-plan.md), as INDICES into one
 * lane's parallel `slots` / `staveNotes` arrays.
 *
 * The one fact the pre-format pass ({@link VexFlowRenderer.buildBeams}) learns and the post-draw
 * pass ({@link VexFlowRenderer.drawFannedBeams}) needs: which notes the fan's beam has to reach back
 * over. Computed once, because re-deriving it in the second pass would mean re-grouping the lane and
 * two answers that could drift apart.
 */
/** One fanned slot's resolved drawing inputs — see {@link VexFlowRenderer.fanSlotDrawing}. */
interface FanSlotDrawing {
  index: number
  slot: Extract<ChordRest, { type: 'chord' }>
  note: StaveNote
  /** The note's OWN stave — a synthetic cross-barline lane (P3) has more than one. */
  stave: Stave
  /** Where this fan's members register — its own bar, which a synthetic lane does not share. */
  measureNumber: number
  staffIndex: number
  headX: number
  baseY: number
  stemDirection: number
  /** Per member, per notehead: the pitch, its staff line and the sign it displays (null for none). */
  heads: { pitch: NotePitch; line: number; sign: string | null }[][]
  /** The mark's stored member PITCHES — `stored[k - 1]` is member k's, member 0 being the note. */
  stored: NotePitch[][]
  prefixNotes: StaveNote[]
  options: FanGeometryOptions
}

interface FanJoin {
  /** The ordinary notes in front of the first fan, in order — may be empty (P2: a fan chain). */
  prefix: number[]
  /** Every fanned slot on this beam, in order. At least one, and more once fans chain (P2). */
  fans: number[]
}

/**
 * The half-beam a cross-*system* fragment hangs over its open end (docs/cross-barline-beaming-plan.md):
 * a short fixed stub past the edge note's stem, NOT a run to the system edge — a beam the width of a
 * system reads as a long empty beam, not one going somewhere. VexFlow's own `partialBeamLength` (10px)
 * is the honest floor; these are tuned by eye.
 *
 * The two ends are NOT the same. A fragment at the **end of a line** (open on its right) has to cross
 * the closing barline into the empty margin to read as "continued on the next system" — and how far
 * that is depends on where the last note sits, which justification moves bar to bar. So the line-end
 * end is **computed to the barline** (`measureX + measureWidth`) plus {@link CROSS_SYSTEM_BEAM_MARGIN}
 * into the margin, not a fixed length; the fixed `…LINE_END` is only a fallback when the measure's
 * bounds are unknown. A fragment at the **start of the next line** (open on its left) only projects a
 * little left of its first note, so that one stays the fixed `…LINE_START`. `CROSS_SYSTEM_BEAM_WIDTH`
 * mirrors VexFlow's default `beamWidth` for the lone-note fragment, which has no real `Beam` to read.
 */
const CROSS_SYSTEM_BEAM_STUB_LINE_END = 22
const CROSS_SYSTEM_BEAM_STUB_LINE_START = 12
const CROSS_SYSTEM_BEAM_MARGIN = 10
const CROSS_SYSTEM_BEAM_WIDTH = 5

/**
 * The SVG group ONE fanned member's ink is painted into — class `vf-fanhead`, id
 * `vf-fanhead-<slotId>-<k>`, nested inside the group's own `vf-fan`.
 *
 * ⭐ Cheap to open here, and it is what turns a member into a thing on the page: the head, its
 * accidental and its ledger lines land in one group, so P3 can highlight a member by an ordinary
 * recolour instead of painting a rectangle over it. (The barline's "paint, don't recolour" lesson is
 * about ink you do not own; this ink is ours.)
 *
 * ⚠️ `openGroup` PREFIXES both with `vf-`, so the bare name is what goes in, and the id carries the
 * name because `getElementById` is document-wide.
 */
const FAN_HEAD_GROUP = 'fanhead'

/** How far a member's ledger line overhangs its notehead on each side, in px (VexFlow's `strokePx`). */
const FAN_LEDGER_OVERHANG = 3

/** The gap between a member's accidental and its notehead, in px. PROVISIONAL, like every fan number. */
const FAN_ACCIDENTAL_GAP = 2


/** The stub length for an open end, by the direction it points: right (+1) runs off the line end. */
const crossSystemStub = (direction: number): number =>
  direction > 0 ? CROSS_SYSTEM_BEAM_STUB_LINE_END : CROSS_SYSTEM_BEAM_STUB_LINE_START

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
  measureNumber: number
  staffIndex: number
  line: number
  x: number
  y: number
  width: number
  isFirstInLine: boolean
  clef: Clef
  hasClefChange: boolean
  cautionaryEndClef?: Clef
  cautionaryEndTimeSig?: TimeSignature
  ghostClefBeat?: Fraction
  /** The real height of the system this measure sits on (staff-spacing aware). */
  systemHeight: number
  /** Built by tier 1 when the measure is (re)drawn; restored from the snapshot when it is reused. */
  stave: Stave
}

/**
 * Everything one drawn (measure, staff) produced, kept so the **next** render can reuse it instead
 * of drawing it again (docs/render-performance-plan.md §7a).
 *
 * Reuse is sound only because a measure is reused **only when its redraw key is identical**, and
 * that key contains its x, y and justified width — so nothing in here can be stale. The moment the
 * measure moves, re-justifies, or changes by a single glyph, the key differs and it is redrawn from
 * scratch rather than patched.
 */
/**
 * Every tie and slur in the score, in the two shapes the render loop needs them:
 *
 *  - `measures` — the bars holding an anchor. **P5.4b** may not translate one of these (see
 *    {@link VexFlowRenderer.spanAnchors}).
 *  - `list` — each span as a measure range plus its two anchor `<g>` keys. **P6** uses this to force
 *    the anchors of a window-crossing span to be drawn (see
 *    {@link VexFlowRenderer.forcedSpanGroups}).
 */
interface SpanAnchors {
  measures: Set<number>
  list: Array<{ lo: number; hi: number; groups: [string, string] }>
}

interface MeasureSnapshot {
  /** The **shape** key — what this measure looks like, independent of where it sits. */
  key: string
  measureNumber: number
  staffIndex: number
  /** Where the group was actually PAINTED. A later render that reuses it computes its transform as
   *  `current - drawn`, so a bar that moves ten times still carries one exact offset rather than ten
   *  accumulated ones. */
  drawnX: number
  drawnY: number
  group: SVGGElement | null
  stave: Stave
  /** Registry entries — tier 1 AND tier 2 — captured contiguously via `ElementRegistry.sliceFrom`. */
  elements: ElementInfo[]
  staffGeometry?: StaffGeometry
  bounds?: MeasureBounds
  staveNotes: [string, { staveNote: StaveNote; noteIndex: number }][]
  /** The FAN MEMBERS' own SVG groups — their answer to `staveNotes`, since a member has no
   *  `StaveNote`. Without them a reused measure loses every member's highlight target (his report:
   *  add a bar elsewhere, and the fan's members select but no longer light up). */
  fanMembers: [string, { group: SVGGElement; noteIndex: number }][]
  /** …and where each was DRAWN, so a reused measure can still anchor a slur to one. */
  fanMemberAnchors: [string, FanMemberAnchor][]
  tuplets: [string, ScoreTuplet][]
  dynamics: [string, Annotation][]
}

/** Every FANNED MEMBER pitch id in a measure — the ids `captureById`'s default list cannot reach,
 *  since they live inside `slot.fan` rather than in `slot.notes`. */
function fanMemberIdsOf(view: Measure): string[] {
  return view.slots.flatMap(s =>
    s.type === 'chord' ? (s.fan?.members ?? []).flat().map(p => p.id) : [])
}

/**
 * Say which bars changed SYSTEM since the last render — the one layout event that leaves no trace.
 * You see the new arrangement, never the move, and "did that bar just fall to the next system?" is
 * the question behind most width work: a bar-width nudge, a meter change, one wider accidental.
 *
 * Silent on the first render (nothing to compare against) and after a full teardown, which clears
 * the map — a bar arriving out of nowhere has not *moved*, and reporting it as such would cry wolf
 * on every reload. Only real moves are logged, one line each.
 */
function logSystemChanges(
  before: ReadonlyMap<number, MeasureWidthInfo>,
  after: ReadonlyMap<number, MeasureWidthInfo>,
): void {
  if (before.size === 0) return
  for (const [num, next] of after) {
    const prev = before.get(num)
    if (prev === undefined || prev.lineNumber === next.lineNumber) continue
    const dir = next.lineNumber > prev.lineNumber ? '↓ down to' : '↑ up to'
    dbg(`[Layout] bar ${num} jumped ${dir} system ${next.lineNumber + 1} (was ${prev.lineNumber + 1})`)
  }
}

export class VexFlowRenderer {
  private renderer: Renderer | null = null
  private context: SVGContext | null = null
  private readonly svgContainer: HTMLElement
  /** Stored bounds for each rendered measure (keyed by measure number) */
  private measureBounds: Map<number, MeasureBounds> = new Map()
  /** The drawn `<g>` per (measure, staff) — see {@link renderMeasure}. The handle by which a single
   *  measure can be redrawn, moved or dropped without touching the rest of the score. Lives and dies
   *  with the SVG, so `clear()` empties it. */
  private measureGroups: Map<string, SVGGElement> = new Map()
  /**
   * Which placements **tier 2** paints. `null` = all of them, which is what ships.
   *
   * This is §7's "tier 2 takes the measure set as a parameter" made real, and for now its only
   * caller is the test that proves tier 1 stands on its own — you cannot demonstrate that an
   * undrawn measure keeps its geometry without being able to *not draw* one.
   *
   * A **test seam**, and now only that: P6's real culling switch is {@link cullWindow}, which this
   * is ANDed with. Kept because a test that wants to cull one named measure should not have to
   * compute a rectangle that happens to miss it.
   */
  private drawFilter: ((p: Omit<MeasurePlacement, 'stave'>) => boolean) | null = null
  /**
   * **P6 — the window tier 2 paints** (docs/render-performance-plan.md §8), in layout coordinates.
   * `null` = draw the whole score, which is what every render did before P6 and what still happens
   * before the viewport has reported a size.
   *
   * It already carries its overscan: `MusicEngine.setVisibleRect` expands the visible rect and only
   * hands a *new* window down when the visible rect escapes the old one. So this rectangle changes
   * rarely — a scroll inside the overscan margin is still the free CSS scroll it always was — and
   * when it does change, it is part of {@link viewStateKey}, which is what makes the resulting
   * render happen at all.
   *
   * Culling is **tier 2 only**. Tier 1 (`layoutTier1`, `registerTier1`) still runs over every
   * measure in the score, so measure bounds, staff geometry and pixel↔position keep working
   * off-screen — see §8's "geometry consumers that read the renderer".
   */
  private cullWindow: Rect | null = null

  /** Whether the LAST system is stretched to the page width. True is Finale/Sibelius (and what
   *  this always did); false is LilyPond's `ragged-last`. View state, not a score field — see
   *  {@link layoutStateKey}. */
  private justifyLastLine = false
  /**
   * **The casting-off of the last render, kept so a scroll doesn't recompute it.**
   *
   * The P6 census exposed this: a scroll render cost 19 ms, of which **13.3 ms was
   * `calculateMeasureWidths`** — at 200 bars. Not the draw, not tier 1: the *widths*. And on a
   * scroll the score has not changed by one note, so every one of those widths came back identical.
   *
   * The cost is the width cache's own **fingerprint walk** (§9): P2 memoizes each measure's
   * intrinsic width, but it still has to walk every measure's content to build the key that finds
   * it. That walk is the 101 ms measured at 500×25, and it was being paid on every scroll.
   *
   * So the layout is cached across renders and reused when *nothing it depends on* changed:
   *   - the model didn't change ({@link layoutReusable}, which only `MusicEngine` can vouch for), and
   *   - the layout-relevant view state didn't change ({@link layoutStateKey} — the window is
   *     excluded, and that exclusion is exactly what makes a scroll free again).
   */
  private layoutCache: { key: string; widths: Map<number, MeasureWidthInfo> } | null = null
  /**
   * May this render reuse {@link layoutCache}? **Only `MusicEngine` can answer this**, because only
   * it knows whether the model changed (`modelDirty`), and it is set per-render.
   *
   * Defaults to `false`, and that default is load-bearing: a renderer driven directly (every test in
   * this directory) mutates its `ScoreModel` and re-renders with no engine in the loop, so nobody
   * would clear a stale layout. Opt in, never opt out.
   */
  private layoutReusable = false
  /** Last render's output per (measure, staff) — what P5.4 reuses instead of redrawing.
   *  See {@link MeasureSnapshot}. */
  private snapshots: Map<string, MeasureSnapshot> = new Map()
  /** Registry tracking all rendered elements and their positions */
  private elementRegistry: ElementRegistry = new ElementRegistry()
  /** Memo for each (measure, staff) lane's note-space width, keyed by that lane's content (P2).
   *  Owned here — not a module singleton — so two documents and two tests cannot share one.
   *  Survives `clear()`: the SVG is thrown away every render, the widths are not. */
  private widthCache = new MeasureWidthCache()
  /** Map of note IDs to their rendered StaveNotes (for tie rendering) */
  private staveNoteMap: Map<string, { staveNote: StaveNote; noteIndex: number }> = new Map()
  /**
   * Each FANNED MEMBER pitch id → the `<g class="vf-fanhead">` its ink was drawn into, and which
   * head inside it belongs to that pitch. The member's answer to `staveNoteMap`
   * (docs/fanned-beam-pitches-plan.md §2 P3) — a member has no `StaveNote`, so a highlight resolves
   * through here instead. Rebuilt every render, like the note map.
   */
  private fanMemberGroupMap: Map<string, { group: SVGGElement; noteIndex: number }> = new Map()
  /**
   * Each FANNED MEMBER pitch id → where its head was drawn, so a SLUR can anchor to one. Filled by
   * {@link drawFannedBeams} from the geometry it just spent; see {@link FanMemberAnchor}. Cleared,
   * captured and restored with the group map — the same three sites.
   */
  private fanMemberAnchorMap: Map<string, FanMemberAnchor> = new Map()
  /** Measured accidental glyph widths, by sign — see {@link accidentalWidth}. */
  private accidentalWidths: Map<string, number> = new Map()
  /** Map of tuplet IDs to their rendered VexFlow Tuplet objects (for scoped highlight) */
  private tupletObjectMap: Map<string, ScoreTuplet> = new Map()
  /** Map of dynamic IDs to their rendered VexFlow Annotation objects (for scoped highlight) */
  private dynamicObjectMap: Map<string, Annotation> = new Map()
  /** Map of slur IDs to their rendered SVG group (`<g class="vf-slur">`) for scoped highlight */
  private slurGroupMap: Map<string, SVGGElement> = new Map()
  /** Map of tie from-note IDs to their rendered SVG group (`<g class="vf-tie">`) for scoped highlight */
  private tieGroupMap: Map<string, SVGGElement> = new Map()
  /** Dynamic currently being edited in the in-canvas text overlay — skipped while
   *  rendering so the engraved glyph doesn't show doubled under the editor. */
  private suppressedDynamicId: string | null = null
  /** Tempo mark suppressed while its text overlay is open (mirrors suppressedDynamicId). */
  private suppressedTempoId: string | null = null
  /** Map of measure numbers to their layout info (including line number) */
  private measureLayoutInfo: Map<number, MeasureWidthInfo> = new Map()
  /** Snapshot of the layout captured when frozen. While non-null, renderScore
   *  reuses it instead of recomputing line breaks/widths — used during a clef
   *  drag to stop the score reflowing. Survives clear() (kept off measureLayoutInfo). */
  private frozenLayout: Map<number, MeasureWidthInfo> | null = null
  /** The clef currently being dragged (or null). Used to keep a dragged clef that
   *  sits in a redundant position visible during the drag (it would otherwise be
   *  hidden at beat 0), instead of disappearing under the cursor. */
  private draggingClef: { measure: number; beat: Fraction } | null = null
  /** Wrapped (stacked, justified systems) vs linear (one endless system). Owned by MusicEngine
   *  and pushed down here — this is the only place it changes anything: the break/justify policy
   *  it hands to `calculateMeasureWidths`, and the SVG width that follows from it. */
  private viewMode: ViewMode = 'wrapped'
  /** Linear view's ephemeral staff-spacing VIEW KNOB, staffId → space-above in staff-spaces.
   *  Owned by MusicEngine (it is view state, like viewMode) and pushed down here; read ONLY in
   *  linear mode. Never persisted — see MusicEngine.linearStaffSpacing. */
  private linearStaffSpacing = new Map<string, number>()

  /**
   * The preview ghosts (note / clef / time-sig / dynamic / tempo) each draw into their own
   * class-tagged `<g>`, appended last. That makes them a true **overlay**: putting one up or
   * taking one down is a DOM append/remove against the already-drawn score, never a re-layout
   * and re-draw of it (docs/render-performance-plan.md §5b).
   *
   * ⚠️ `vf-ghost-tempo`, not `ghost-tempo`. The other four ghosts build their `<g>` by hand
   * (`setAttribute('class', 'ghost-…-group')`); the tempo ghost is the one that goes through
   * VexFlow's `openGroup('ghost-tempo')` — **which prefixes the class with `vf-` itself**. The
   * selector used to say `.ghost-tempo`, matched nothing, and so never took a tempo ghost down:
   * they piled up, one per mouse position, as a permanent blue smear. (Nothing swept them either,
   * since P4 made ghosts overlays — hovering no longer forces the full render that used to hide
   * the leak.)
   */
  private static readonly GHOST_GROUP_SELECTOR =
    '.ghost-note-group, .ghost-rest-group, .ghost-clef-group, .ghost-timesig-group, .ghost-dynamic-group, .vf-ghost-articulation, .vf-ghost-accidental, .vf-ghost-tie, .vf-ghost-dot, .vf-ghost-tremolo, .vf-ghost-tempo'

  /** Take down whatever ghost is showing. O(1) in the score's size — this is the whole point
   *  of P4: hovering an invalid element, or leaving the canvas, used to cost a FULL render
   *  whose only job was to erase one translucent notehead. */
  clearGhosts(): void {
    this.getSVGElement()
      ?.querySelectorAll(VexFlowRenderer.GHOST_GROUP_SELECTOR)
      .forEach((g) => g.remove())
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode
  }

  setLinearStaffSpacing(spacing: Map<string, number>): void {
    this.linearStaffSpacing = spacing
  }

  /**
   * Everything that changes the *picture* without changing the *score* — the second half of
   * the "may we skip this render?" key (docs/render-performance-plan.md §5a). Content is the
   * first half and is answered by `MusicEngine.modelDirty`; the selection is deliberately in
   * neither, which is the whole point of P3.
   *
   * Container width is absent because it is a constant (`LAYOUT_CONFIG.CONTAINER_WIDTH`); add
   * it here the day it becomes settable, along with page dimensions (§6c).
   *
   * The **cull window** is here, and it is what makes P6 work at all: scrolling changes no content,
   * so without it `isRenderStale()` would answer "no" and the bars newly scrolled into view would
   * never be painted. It is the *expanded* (overscan-carrying) window, not the raw visible rect —
   * which is precisely why an ordinary scroll still renders nothing. `MusicEngine.setVisibleRect`
   * only hands a new window down when the visible rect escapes the old one.
   */
  viewStateKey(): string {
    const w = this.cullWindow
    return JSON.stringify([
      this.layoutStateKey(),
      w && [Math.round(w.x), Math.round(w.y), Math.round(w.width), Math.round(w.height)],
    ])
  }

  /**
   * The view state **the casting-off depends on** — `viewStateKey` minus the cull window.
   *
   * The split is the whole point: scrolling moves the window, and the window is the *one* piece of
   * view state that cannot change a single measure's width or which system it lands on. So a
   * scroll-only render may reuse the layout wholesale. See {@link layoutCache}.
   */
  private layoutStateKey(): string {
    return JSON.stringify([
      this.viewMode,
      this.justifyLastLine,
      [...this.linearStaffSpacing.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      this.suppressedDynamicId,
      this.suppressedTempoId,
      this.frozenLayout !== null,
      this.draggingClef && [this.draggingClef.measure, this.draggingClef.beat],
    ])
  }


  constructor(containerElement: HTMLElement) {
    this.svgContainer = containerElement
  }

  /**
   * Get the element registry (contains positions of all rendered elements)
   */
  getElementRegistry(): ElementRegistry {
    return this.elementRegistry
  }

  /**
   * The width/line assignment of the **last** render, read-only — every bar's `minWidth`,
   * `finalWidth`, authored slices and `lineNumber`.
   *
   * Exposed for the bar-width gesture (docs/bar-width-plan.md §4): moving a barline means solving
   * for a stretch against the line the bar is actually on, and the terms of that solution — the
   * line's membership and each bar's intrinsic width — are exactly what this map holds. Read once
   * at the grab, never recomputed mid-gesture: a stretch changes no bar's *intrinsic* width, which
   * is what makes one capture legitimate rather than merely cheap.
   *
   * Empty until the first render — the caller must treat that as "I don't know" and decline.
   */
  getMeasureLayoutInfo(): ReadonlyMap<number, MeasureWidthInfo> {
    return this.measureLayoutInfo
  }

  /**
   * Get the bounds for a specific measure (after rendering)
   */
  getMeasureBounds(measureNumber: number): MeasureBounds | undefined {
    return this.measureBounds.get(measureNumber)
  }

  /**
   * Get all measure bounds
   */
  getAllMeasureBounds(): Map<number, MeasureBounds> {
    return this.measureBounds
  }

  /**
   * The measure NUMBER that opens the system currently containing `measureNumber` (the
   * smallest number sharing its line), per the last render's layout — or undefined if that
   * measure isn't laid out. This is how a per-system staff-spacing tweak finds its durable
   * anchor (Client #7, docs/staff-spacing-plan.md option C): the caller maps this number to
   * the opening measure's id. Reflow-dependent by design — resolved fresh from `measureLayoutInfo`.
   */
  getSystemOpeningMeasureNumber(measureNumber: number): number | undefined {
    const info = this.measureLayoutInfo.get(measureNumber)
    if (!info) return undefined
    let opener = measureNumber
    for (const [num, other] of this.measureLayoutInfo) {
      if (other.lineNumber === info.lineNumber && num < opener) opener = num
    }
    return opener
  }

  /**
   * Bundle this render's per-render state into a {@link RenderPass}. The pass carries
   * **references** to the instance-field maps (not copies), so the sub-renderers that
   * consume it populate the very maps the post-render accessors later read. Call only
   * after `measureLayoutInfo` has been (re)assigned for this render.
   */
  private createRenderPass(score: Score): RenderPass {
    return {
      score,
      context: this.context!,
      staveNoteMap: this.staveNoteMap,
      fanMemberAnchorMap: this.fanMemberAnchorMap,
      tupletObjectMap: this.tupletObjectMap,
      dynamicObjectMap: this.dynamicObjectMap,
      slurGroupMap: this.slurGroupMap,
      tieGroupMap: this.tieGroupMap,
      measureLayoutInfo: this.measureLayoutInfo,
      measureBounds: this.measureBounds,
      elementRegistry: this.elementRegistry,
      suppressedDynamicId: this.suppressedDynamicId,
      suppressedTempoId: this.suppressedTempoId,
    }
  }

  /**
   * Initialize the VexFlow renderer
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   */
  initialize(width: number, height: number): void {
    // Clear any existing content
    this.svgContainer.innerHTML = ''

    // Create VexFlow SVG renderer
    this.renderer = new Renderer(this.svgContainer as HTMLDivElement, Renderer.Backends.SVG)
    this.renderer.resize(width, height)
    this.context = this.renderer.getContext() as SVGContext

    // `save()`/`restore()` are LEFT ALONE — they work, and the context depends on them.
    //
    // History, because the old shape survived long after its reason did: this used to stub both to
    // no-ops, because `SVGContext.save()` deep-clones its state with `structuredClone`, which throws
    // on a Vue reactive proxy. That could only bite if the engine were held in a deep `ref()`;
    // `App.vue` used `shallowRef`, so the hazard was already gone before Vue was, and Vue itself is
    // gone now (docs/remove-vue-plan.md). Measured after re-enabling: save → setStrokeStyle →
    // restore round-trips correctly, and `state`/`attributes` hold nothing but strings and numbers.
    //
    // What the stubs COST while they were there: VexFlow scopes a style with
    // `save() → applyStyle() → draw() → restore()`, so with restore dead every style it set was
    // permanent and global. A stem left `stroke-width: 1.5` on the shared context and a ledger line
    // left `2` (`defaultLedgerLineStyle = { strokeStyle: '#444', lineWidth: 2 }`) — for the rest of
    // that render AND every later one. `drawCurveArc` used to pin the width back by hand to survive
    // it; that workaround is gone with this.
    //
    // ⚠️ STILL TRUE, and independent of save/restore: `openGroup` stamps the context's CURRENT
    // attributes onto each new `<g>`, and children with no style of their own (staff lines carry no
    // `stroke`) inherit them. So a style set OUTSIDE a save/restore pair still leaks into later
    // groups. To colour one element, set the attribute on its SVG node AFTER drawing — what every
    // ghost and the highlight controller do, and what lets them recolour without re-engraving.
  }

  /**
   * Register every dot glyph VexFlow drew on `staveNote`, all against ONE `anchorNoteId`.
   *
   * `dots` is a property of the SLOT (`Chord` or `Rest`) — it modifies the duration — not of a
   * notehead, the way `alter` is. But VexFlow draws one dot per notehead per dot, so a
   * double-dotted three-note chord emits SIX glyphs for that one value. Registering them against a
   * shared anchor (the chord's lowest pitch, exactly as articulations anchor; a rest's own id) is
   * what makes clicking ANY of them select the slot's dots and light all of them. "Dot one head of
   * a chord" is not expressible in the model, so there is no individual dot to select.
   */
  private registerDots(
    staveNote: StaveNote,
    anchorNoteId: string,
    measureNumber: number,
    staffIndex: number,
    beat: number,
  ): void {
    try {
      for (const modifier of staveNote.getModifiers()) {
        if (modifier.getCategory() !== 'Dot') continue
        const box = modifier.getBoundingBox()
        if (!box) continue
        this.elementRegistry.add({
          type: 'dot',
          noteId: anchorNoteId,
          measure: measureNumber,
          staff: staffIndex,
          beat,
          bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
        })
      }
    } catch (_e) { /* Dot bounding box may not be available */ }
  }

  /**
   * Lengthen a tremolo note's stem — Gould's "extend a stem if necessary so that the tremolo strokes
   * are clear of tails and beams", in the TWO shapes that turn out to need it. They are separate
   * rules with opposite treatments, and conflating them is how one of them stops working:
   *
   * **FIT** — the stack is taller than the usable stem. Four or five strokes need ~33px and a plain
   * quarter's stem offers ~30 from the notehead's edge to the tip, so the strokes overflow with no
   * flag and no beam anywhere in sight. Extend by exactly the shortfall plus
   * {@link TREMOLO_STROKE_CLEARANCE} at each end, and let the strokes SPREAD into the new room: the
   * stem grew *because they did not fit*, so re-centring in the longer stem is the point. Everything
   * here is measured (`strokeStackHeight` measures the glyph, `usableStemSpan` the stem) — the only
   * chosen number is the clearance.
   *
   * **FLAG** — the stack fits, but the flag hangs into it. `drawFlag` hangs the flag DOWN from the
   * tip (`stem.getHeight()`), so on a lone eighth it lands mid-stem where the strokes now sit, while
   * a beam sits ON the tip and never crosses them. Extend by
   * {@link TREMOLO_FLAG_STEM_STRETCH} and tell the strokes to STAY
   * ({@link CenteredTremolo.setStemStretch}) — that is what turns the whole stretch into clearance,
   * where letting them re-centre would move them up half as far as the flag and gain only half.
   *
   * Both are measured against the ORIGINAL stem and added together, so a flagged note that also
   * overflows gets both, and the strokes compensate for only the flag half.
   *
   * A BEAMED note is included, and the beam follows: `Beam.postFormat` has not run yet at this point
   * (`Formatter.postFormat` is skipped — we format without a `stave` option, and beams post-format
   * inside `Beam.draw`), so `calculateSlope` reads the lengthened tip and shifts the whole beam out,
   * then `applyStemExtensions` lands every stem in the group on the new line. Moving the beam for the
   * whole group is correct: a beam is one line.
   *
   * ⚠️ Bumping the Stem's own extension rather than `setStemLength`: that one writes
   * `stemExtensionOverride`, which `StaveNote.getStemExtension()` then re-reads and ADDS its
   * octave-distance term to — so the note's own extension would be counted twice for a note far
   * from the middle line. Adding to what the Stem already resolved composes with every VexFlow rule
   * (flag height, beam, octave) instead of replacing them.
   */
  private applyTremoloStemStretch(sortedSlots: ChordRest[], staveNotes: StaveNote[]): void {
    for (let i = 0; i < sortedSlots.length && i < staveNotes.length; i++) {
      const slot = sortedSlots[i]
      if (slot.type !== 'chord' || !slot.tremolo) continue
      const staveNote = staveNotes[i]
      // ⚠️ NO `hasStem()` GUARD. A whole note has no stem to SEE, but the strokes are still placed by
      // `usableStemSpan` — off the imaginary stem VexFlow builds anyway — so it still has a span they
      // can overflow. Skipping it here is why five strokes on a whole note ran into the notehead
      // (reported by eye) while the same five on a quarter were fine: only the quarter got the fit
      // stretch. Extending an invisible stem draws nothing and moves the imaginary tip, which is
      // exactly the room the stack needs.
      const mark = staveNote.getModifiers().find(m => m instanceof CenteredTremolo)
      const stem = staveNote.getStem()
      if (!mark || !stem) continue

      const staffSpace = staveNote.getStave()?.getSpacingBetweenLines() ?? 10
      const needed = mark.strokeStackHeight() + 2 * TREMOLO_STROKE_CLEARANCE * staffSpace
      const fitStretch = Math.max(0, needed - usableStemSpan(staveNote).length)
      // A stemless note has no flag either, so this half is naturally 0 there — no case needed.
      const flagStretch = staveNote.hasFlag() ? staveNote.getStemLength() * TREMOLO_FLAG_STEM_STRETCH : 0
      // ⭐ NOTHING MOVES UNLESS IT HAS TO. Both halves are shortfalls, so a mark that already fits its
      // stem is left exactly where it was — the vertical placement everywhere else is right, and only
      // the case that would collide is adjusted (his rule).
      if (fitStretch === 0 && flagStretch === 0) continue

      stem.setExtension(stem.getExtension() + fitStretch + flagStretch)
      mark.setStemStretch(flagStretch) // the FIT half is deliberately not reported — see above
    }
  }

  /**
   * A FANNED slot's stem has to hold the beam LEVELS — the lines that fan inward from the primary
   * one toward the noteheads — so it grows by exactly the room they take
   * ({@link fanStemExtension}, VexFlow's own `beamWidth × 1.5` step, counted).
   *
   * The same window and the same mechanism as {@link applyTremoloStemStretch}: post-format,
   * post-stem-re-assert, pre-draw, bumping the `Stem`'s own extension rather than `setStemLength`
   * (which would double-count the note's octave-distance term).
   *
   * ⚠️ **It WRITES, it never READS.** Pre-draw the note's own geometry is not settled — measured
   * here, `getNoteHeadBeginX()` answers 0 and the stem extents put the tip 110px above where it
   * lands — so everything that has to *measure* waits for {@link drawFannedBeams}, after the draw.
   * The one number this pass needs (the levels' room) comes from the mark, not from the page.
   *
   * A one-beam fan asks for nothing and is left exactly where it was — the rule the tremolo stretch
   * follows too: nothing moves unless it has to.
   */
  private applyFanStemStretch(sortedSlots: ChordRest[], staveNotes: StaveNote[]): void {
    for (let i = 0; i < sortedSlots.length && i < staveNotes.length; i++) {
      const slot = sortedSlots[i]
      if (slot.type !== 'chord' || !slot.fan) continue
      const stem = staveNotes[i].getStem()
      if (!stem) continue
      const extra = fanStemExtension(slot.fan.beams, CROSS_SYSTEM_BEAM_WIDTH, slot.fan.spread)
      if (extra > 0) stem.setExtension(stem.getExtension() + extra)
    }
  }

  /**
   * One accidental glyph's width, cached by sign — what a member's sign needs to the left of its
   * head. Measured from the glyph itself rather than assumed, so it follows the font; jsdom cannot
   * measure and answers 0, which is the one environment where nothing is drawn anyway.
   */
  private accidentalWidth(sign: string): number {
    const hit = this.accidentalWidths.get(sign)
    if (hit !== undefined) return hit
    const width = new Accidental(sign).getWidth() || 0
    this.accidentalWidths.set(sign, width)
    return width
  }

  /**
   * ⛔ **A TWO-NOTE TREMOLO DOES NOT STRETCH ITS STEMS.** There was a pass here — Gould's rule 2,
   * built as a sibling of {@link applyTremoloStemStretch} — and it is deliberately gone (his call, by
   * eye, 2026-07-25): *"this is not a tremolo on stem but in between the notes, so we should skip the
   * rule here."*
   *
   * The rule it copied is about a mark that RIDES a stem: the strokes are on the stem, so the stem
   * has to be long enough to hold them clear of the flag and the notehead. A pair's strokes are not
   * on either stem — they are in the gap between the two notes, and lengthening the stems buys them
   * nothing while visibly retuning notes the reader did not ask to be retuned. What keeps the stack
   * off the noteheads here is {@link twoNoteTremoloTipOffset} being small, not the stem being long.
   *
   * If a five-stroke pair ever overruns its stems, the answer is the stroke count or the step
   * between them — NOT a stem nobody asked to grow.
   */

  /**
   * The pair's OWN beam — one `Beam` over the two notes when the DRAWN value is beamable (an eighth
   * or shorter, i.e. a pair of sixteenths or finer). P2 of docs/two-note-tremolo-plan.md §2.
   *
   * A pair is never in an automatic group (`pairRoleAt` breaks it in the pure grouper), so the meter
   * never gives it one and this is the only place it can come from. Built here, beside `buildBeams`
   * and BEFORE `formatter.format`, for the reason the cross-barline placeholders are: `preFormat`
   * reserves glyph width for a flagged stem-up note, and a beamed note must not pay for a flag it
   * will not draw.
   *
   * ⭐ Not every pair gets one. `single` authored on either note means "drawn apart" — the two keep
   * their flags and only the strokes join them, which is a legal drawing of the same mark and the
   * one the notes were already wearing if you beamed them apart first. {@link pairDrawing} owns that
   * decision; this only obeys it.
   *
   * ⚠️ The beam DOES eat into the stroke count — see {@link pairStrokesDrawn}. It is one of the
   * lines between the two notes, and it is their total that says the speed, so a three-stroke mark
   * on a beamed pair draws the beam plus two strokes.
   */
  private buildTwoNoteTremoloBeams(slots: ChordRest[], staveNotes: StaveNote[]): Beam[] {
    const beams: Beam[] = []
    for (const { first, second, beamed } of this.twoNoteTremoloPairs(slots, staveNotes)) {
      if (!beamed) continue
      try {
        beams.push(new Beam([first, second]))
      } catch (beamError) {
        console.warn(`Could not create two-note tremolo beam: ${beamError}`)
      }
    }
    return beams
  }

  /**
   * Draw each valid pair's strokes — the quads between the two stems.
   *
   * ⚠️ AFTER the voices are drawn and BEFORE `registerSlotElements`: the strokes read stem geometry
   * that is only settled once the stems (and any beam extensions) have been applied, and they belong
   * to the measure group — both notes are in one bar, unlike the cross-barline fragments, which have
   * no bar to live in.
   *
   * Each pair paints inside its OWN named group. That is the seam the highlight needs (§4):
   * `HighlightController.colorNoteTremolo` finds `<text>` nodes inside the note's `vf-stavenote`
   * group whose content is the tremolo codepoint, and these are paths outside every note group — the
   * lookup would find nothing. Paint the highlight, do not go hunting for glyphs to recolour.
   *
   * ⚠️ `openGroup` PREFIXES the class with `vf-`, so the bare name goes in, and `closeGroup()` lives
   * in a `finally` — it pushes the context's append target and an unbalanced pair swallows the rest
   * of the render.
   *
   * ⚠️ THE HEIGHT is the two STEM TIPS in all three cases, read after the beams have applied their
   * extensions (so for a beamed pair the tip IS the beam line). Including the drawn WHOLE note,
   * which has no stem to see but does have stem extents: `hasStem()` is false while VexFlow still
   * built the `Stem`, so `getStemExtents()` says exactly where the imaginary stem would run, and
   * that is where its strokes belong. Hanging them between the noteheads instead sits them far too
   * low (reported by eye).
   *
   * ⚠️ THE SPAN is NOT the same read, and that is the one place the stemless case parts company.
   * The strokes run between the two notes' facing INK: with stems, that ink is the stems, so both
   * ends are a `getStemX()`. Without them there is nothing at the stem's x to run between, and using
   * it anyway lands both ends on the RIGHT edge of each notehead (stems up) — the whole bar reads
   * shoved right of the pair. So a stemless pair spans notehead to notehead: the right edge of the
   * first, the left edge of the second (reported by eye).
   */
  private drawTwoNoteTremolos(
    pass: RenderPass,
    slots: ChordRest[],
    staveNotes: StaveNote[],
    measureNumber: number,
    staffIndex: number,
  ): void {
    for (const pair of this.twoNoteTremoloPairs(slots, staveNotes)) {
      const { first, second, strokes, anchorId, slot, joined } = pair
      const staffSpace = first.getStave()?.getSpacingBetweenLines() ?? 10
      const stemmed = first.hasStem() && second.hasStem()
      const quads = twoNoteTremoloStrokes({
        strokes,
        leftX: stemmed ? first.getStemX() : first.getAbsoluteX() + first.getGlyphWidth(),
        leftAnchorY: usableStemSpan(first).tip,
        rightX: stemmed ? second.getStemX() : second.getAbsoluteX(),
        rightAnchorY: usableStemSpan(second).tip,
        stemDirection: first.getStemDirection(),
        tipOffset: this.twoNoteTremoloTipOffset(pair),
        // A pair drawn APART hangs a FLAG off a stem tip, standing in the gap right where the
        // strokes end — the plain clearance rule knows nothing about it, so the flag's own width
        // becomes the floor. MEASURED, not chosen: `getGlyphWidth()` is the notehead's width (a
        // flag is about that), so it follows the staff size instead of pinning a pixel count that
        // would be wrong the day the scale changes.
        minClearance: !pair.beamed && pair.flags > 0 ? first.getGlyphWidth() : 0,
        joined,
        staffSpace,
        beamWidth: CROSS_SYSTEM_BEAM_WIDTH,
      })
      if (quads.length === 0) continue

      // ⚠️ `openGroup` PREFIXES both, so this lands as class `vf-tremolo-pair`, id
      // `vf-tremolo-pair-<noteId>`. The id carries the name as well as the note, because
      // `getElementById` is document-wide (reference_vexflow_getsvgelement_is_document_wide) and a
      // bare note id would collide with whatever else keys off the same note.
      pass.context.openGroup('tremolo-pair', `${TREMOLO_PAIR_GROUP}-${anchorId}`)
      try {
        for (const q of quads) {
          this.fillBeamQuad(pass.context, q.startX, q.startY, q.endX, q.endY, q.thickness)
        }
      } finally {
        pass.context.closeGroup()
      }

      // The mark's own click target, MEASURED from the quads that were just drawn — the same reason
      // `CenteredTremolo.inkRect` is measured rather than taken from `getBoundingBox()`: the code
      // that placed the ink is the only honest source for where it is.
      const left = Math.min(...quads.map(q => q.startX))
      const right = Math.max(...quads.map(q => q.endX))
      const top = Math.min(...quads.map(q => Math.min(q.startY, q.endY)))
      const bottom = Math.max(...quads.map(q => Math.max(q.startY, q.endY) + q.thickness))
      if (!Number.isFinite(left) || !Number.isFinite(top) || bottom <= top) continue
      this.elementRegistry.add({
        type: 'tremolo',
        noteId: anchorId,
        measure: measureNumber,
        staff: staffIndex,
        beat: fracToNumber(slot.beat),
        bbox: { x: left, y: top, width: right - left, height: bottom - top },
      })
    }
  }

  /**
   * Draw each fanned slot's OTHER members and its feathered beam (docs/fanned-beams-plan.md §3, P1),
   * for ONE LANE of one bar.
   *
   * ⭐ **The slot's own `StaveNote` is member 0 and is NOT suppressed** — it has already been drawn
   * by `voice.draw`, wearing a quarter's filled head (NoteBuilder swaps the drawn value). Everything
   * the outside world knows about this event hangs off that object — the registry's hit-test, the
   * `staveNoteMap`, the selection recolour's SVG group, tie and slur anchors, articulations, the
   * dynamic's anchor — so what this pass adds is the members VexFlow does not know about and
   * nothing else.
   *
   * ⚠️ AFTER the voices are drawn, like the two-note tremolo's strokes and for the same reason: the
   * stem geometry it reads (including {@link applyFanStemStretch}'s extension) is only settled then.
   * And inside the measure group, because everything it draws is inside this bar. A group that
   * CROSSES a barline belongs to no bar and is drawn by {@link drawCrossBarFanBeams} instead (P3).
   *
   * ⚠️ THE SPAN is the slot's own x-territory: from its notehead to the next note's in the SAME
   * lane, or to the end of the note area when nothing follows. That is where the width bought by
   * `laneColumns` lands — but only approximately, because inside the bar VexFlow distributes by
   * tick. A fan in a busy bar is the case to look at by eye.
   */
  private drawFannedBeams(
    pass: RenderPass,
    slots: ChordRest[],
    staveNotes: StaveNote[],
    measureNumber: number,
    staffIndex: number,
    clefForBeat: (beat: Fraction) => Clef,
    /** The fans of this lane that are JOINED to the group on their left, from `buildBeams`. */
    fanJoins: FanJoin[],
    /**
     * ⚠️ The slots of this lane whose fan belongs to a group that LEAVES the bar (P3) — skipped
     * here, because {@link drawCrossBarFanBeams} draws those and drawing one twice paints two
     * `vf-fan` groups under ONE id. `getElementById` is document-wide and the first in tree order
     * wins, so the second copy is not merely wasted ink: it steals every lookup the first one owns.
     */
    crossingFans: number[] = [],
  ): void {
    // Which sign each pitch of this lane displays — the SAME map NoteBuilder gave the StaveNotes, so
    // a member's accidental obeys one rule with the notes around it, including holding for the rest
    // of the bar (docs/fanned-beam-pitches-plan.md §2). Not free, so not walked for a lane with no
    // fan in it — which is nearly every lane.
    if (!slots.some(s => s.type === 'chord' && s.fan)) return
    const signs = displayedAccidentals(slots)

    const drawings: FanSlotDrawing[] = []
    for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
      if (crossingFans.includes(i)) continue
      const join = fanJoins.find(j => j.fans.includes(i))
      const drawing = this.fanSlotDrawing({
        index: i,
        slot: slots[i],
        score: pass.score,
        note: staveNotes[i],
        clef: clefForBeat(slots[i].beat),
        signs,
        // Only the FIRST fan of a chain has a prefix — behind any other stands a fan, and that gap
        // is `fanJoinQuads`' business.
        prefixNotes: join && join.fans[0] === i ? join.prefix.map(k => staveNotes[k]) : [],
        // Where this slot's room ends: the next note's ink in this lane, or the note area's end. The
        // next slot is the honest boundary — it is what the formatter itself spaced against.
        nextNote: staveNotes[i + 1],
        measureNumber,
        staffIndex,
        joined: !!join,
      })
      if (drawing) drawings.push(drawing)
    }
    this.drawFanGroups(pass, drawings, fanJoins)
  }

  /**
   * ⭐ **P3 — the fans whose beam LEAVES its bar** (docs/fan-beam-join-plan.md). One pass per
   * crossing group, drawn OUTSIDE every measure group, exactly as {@link drawCrossBarBeams} is and
   * for the same two reasons: top-level content is torn down and rebuilt every render while measure
   * groups are REUSED (so a beam drawn into one would vanish on any pass that reuses it), and
   * culling deletes an off-screen bar's group along with anything drawn into it.
   *
   * The whole group comes here, not just the half that reaches over the barline: the joined line's
   * height is a fact about every note on it, so the fan's own ramp and its members cannot be settled
   * inside one bar while the rest of the group lives in another.
   *
   * What it does is exactly what the in-bar pass does — the two build the same
   * {@link FanSlotDrawing}s and hand them to the same {@link drawFanGroups}. All that differs is
   * where the facts come from: the `StaveNote`s by id out of `staveNoteMap` (which is replayed for a
   * reused measure, so this can draw over bars nobody redrew), and the clef, accidental state and
   * following note per member, since a synthetic lane spanning two bars has no single answer to any
   * of them.
   */
  private drawCrossBarFanBeams(pass: RenderPass, joins: CrossBarFanJoin[]): void {
    for (const join of joins) {
      const staveNotes = join.members.map(m => pass.staveNoteMap.get(m.lookupId)?.staveNote)
      // A bar that was not painted contributes no StaveNote. The planner already refuses a group
      // whose bars are not all drawn; this is the runtime proof of it — half a joined beam would
      // draw stems in mid-air.
      if (staveNotes.some(n => n === undefined)) continue

      const drawings: FanSlotDrawing[] = []
      const fanIndices = join.members.map((m, i) => (m.fan ? i : -1)).filter(i => i >= 0)
      for (const i of fanIndices) {
        const member = join.members[i]
        const drawing = this.fanSlotDrawing({
          index: i,
          slot: member.slot,
          score: pass.score,
          note: staveNotes[i]!,
          clef: member.clef,
          // Accidental state is a fact about ONE bar, so it is read per bar and merged. Keyed by
          // pitch id, so the merge cannot conflate two bars' answers about one note.
          signs: displayedAccidentals(member.laneSlots),
          prefixNotes: i === fanIndices[0]
            ? join.members.map((m, k) => (!m.fan && k < i ? staveNotes[k]! : null))
              .filter((n): n is StaveNote => n !== null)
            : [],
          // ⚠️ The next note in the fan's OWN bar, not in the synthetic lane — the fan may be the
          // last thing on this beam while its bar carries on past it, and the ramp must not spread
          // over a note the formatter put there.
          nextNote: member.nextLookupId ? pass.staveNoteMap.get(member.nextLookupId)?.staveNote : undefined,
          measureNumber: member.measureNumber,
          staffIndex: join.staffIndex,
          joined: true,
        })
        if (drawing) drawings.push(drawing)
      }
      if (!drawings.length) continue

      const prefix = join.members.map((m, i) => (!m.fan && i < fanIndices[0] ? i : -1)).filter(i => i >= 0)
      this.drawFanGroups(pass, drawings, [{ prefix, fans: fanIndices }])
    }
  }

  /**
   * The shared body of both fan passes: settle each joined group's ONE line, then draw every fan —
   * its prefix's stems, its members, its ramp, and the gap back to the fan behind it.
   *
   * ⚠️ `openGroup` PREFIXES the class with `vf-`, so the bare name goes in, and `closeGroup()` lives
   * in a `finally` — an unbalanced pair swallows the rest of the render.
   */
  private drawFanGroups(pass: RenderPass, drawings: FanSlotDrawing[], fanJoins: FanJoin[]): void {
    this.reconcileFanJoinLines(drawings, fanJoins)

    const geometries = new Map<number, FanGeometry>()
    for (const drawing of drawings) {
      const { index: i, slot, note, stave, headX, baseY, stemDirection, heads, stored, prefixNotes, options } = drawing
      const { measureNumber, staffIndex } = drawing
      const geometry = fannedBeamGeometry(options)
      geometries.set(i, geometry)

      // ⭐ P2 — THE GAP TO THE FAN BEHIND IT. Only the lines both ramps have cross it; the rest stop
      // at their own stem, which is what a partial beam looks like anywhere else.
      const join = fanJoins.find(j => j.fans.includes(i))
      const at = join ? join.fans.indexOf(i) : -1
      const behind = at > 0 ? geometries.get(join!.fans[at - 1]) : undefined
      const joinQuads = behind && geometry.stems.length
        ? fanJoinQuads({
            left: behind,
            right: geometry,
            toX: geometry.stems[0].stemX,
            thickness: CROSS_SYSTEM_BEAM_WIDTH * stemDirection,
            // THIS fan's spread — the crossing lines land on its stems, so they keep its gap.
            spread: slot.fan?.spread,
          })
        : []

      if (geometry.beams.length === 0) {
        // The fan had no room to draw at all (a collapsed span). Its prefix is still wearing the
        // PLACEHOLDER beam, so `StaveNote.draw` skipped those stems and nobody else is coming for
        // them — put them back at their natural length rather than leave a row of stemless heads.
        // Degraded either way (the flag is suppressed too), but a stem is not missing ink.
        this.drawFanPrefixStems(pass.context, prefixNotes, [])
        continue
      }

      // ⚠️ The group's own ink rect goes in FIRST, before the member heads — `getAt` returns the
      // LAST matching element, so whatever is registered later wins the click. The rect spans the
      // whole fan, so registering it after the heads would swallow every one of them and a member
      // could never be selected. The heads are added in the draw loop below.
      this.registerFanInk(geometry, headX, baseY, measureNumber, staffIndex, prefixNotes, joinQuads)

      const ctx = pass.context
      ctx.openGroup('fan', `${FAN_GROUP}-${slot.id}`)
      try {
        // ⭐ THE REAL NOTE'S STEM, TOPPED UP. When a member's pitch pushes the beam line away, the
        // line leaves member 0's own tip behind — and that stem is VexFlow's, already drawn.
        // Extending it would mean deciding the geometry BEFORE the draw, where the note's x and stem
        // extents are not yet settled (they answer 0 and a tip 110px too high). So the missing piece
        // is simply drawn here, from the tip VexFlow gave it to the line. Never a shortening: the
        // line only ever moves AWAY from the heads.
        if (geometry.stemLift > 0) {
          ctx.beginPath()
          ctx.setLineWidth(Stem.WIDTH)
          ctx.moveTo(geometry.stems[0].stemX, note.getStemExtents().topY)
          ctx.lineTo(geometry.stems[0].stemX, geometry.stems[0].tipY)
          ctx.stroke()
        }
        // The joined group's own stems, re-aimed onto the line.
        this.drawFanPrefixStems(ctx, prefixNotes, geometry.prefixStems)
        // The members VexFlow did not draw — member 0 is the real note, already on the page.
        for (let k = 1; k < geometry.stems.length; k++) {
          const member = geometry.stems[k]
          // ⭐ ONE GROUP PER MEMBER, so a member is a thing on the page and not a rectangle of
          // painted ink: the head, its sign and its ledger lines land inside it together, which is
          // what lets P3 highlight one by an ordinary recolour. ⚠️ `openGroup` prefixes `vf-`.
          const memberGroup = ctx.openGroup(FAN_HEAD_GROUP, `${FAN_HEAD_GROUP}-${slot.id}-${k}`)
          try {
            const memberHeads = heads[k] ?? []
            for (let h = 0; h < memberHeads.length; h++) {
              const { pitch, line, sign } = memberHeads[h]
              const y = stave.getYForNote(line)
              // 🚨 LEDGER LINES BY HAND. `drawLedgerLines` belongs to `StaveNote`; a bare `NoteHead`
              // only swaps to the ledger glyph. Members off the staff drew as floating heads before
              // they had their own pitches — a bug then, the ordinary case now.
              this.drawFanLedgerLines(ctx, member.headX, line, note.getGlyphWidth(), stave)
              const head = new NoteHead({ duration: 'q', line, stemDirection, x: member.headX })
              head.setStave(stave) // resolves y from the line, and hands it the context
              head.setContext(ctx).draw()
              // ⭐ P3: the member becomes CLICKABLE and HIGHLIGHTABLE — but only when it is a member
              // of its own (a fallback head is the slot's pitch, and that id is already the real
              // note's). Registered as a `note` because that is what it is; ⚠️ it carries the SLOT's
              // beat, which is what keeps `pixelXToBeat` unmoved — that walk dedups anchors by beat
              // and keeps the leftmost x, so the members collapse onto the note's own column.
              if (stored[k - 1]) {
                this.addGlyphElement(head, {
                  type: 'note',
                  id: pitch.id,
                  measure: measureNumber,
                  staff: staffIndex,
                  beat: fracToNumber(slot.beat),
                  pitch: spellingToMidi(pitch.step, pitch.alter, pitch.octave),
                  duration: slot.duration,
                  headX: member.headX + note.getGlyphWidth() / 2,
                })
                // The group is this member's whole ink — head, sign, ledgers, stem — so the highlight
                // is an ordinary recolour of ink we own, not a rectangle painted over someone else's.
                this.fanMemberGroupMap.set(pitch.id, { group: memberGroup as unknown as SVGGElement, noteIndex: h })
                // …and WHERE it landed, so a slur can spring from it. Measured from the geometry that
                // placed the head, not re-derived — the same rule the ink rect follows.
                this.fanMemberAnchorMap.set(pitch.id, {
                  staveNote: note,
                  leftX: member.headX,
                  rightX: member.headX + note.getGlyphWidth(),
                  headY: y,
                  tipY: member.tipY,
                  stemDirection,
                })
              }
              if (sign) {
                // Hand-placed for the same reason the head is: there is no `StaveNote` here to hang
                // a modifier on, and a `Modifier` drawn at explicit coordinates without its own x/y
                // set drags a note's bbox to zero (reference_vexflow_modifier_bbox_needs_x_y).
                const acc = new Accidental(sign)
                acc.setContext(ctx)
                acc.setX(member.headX - this.accidentalWidth(sign) - FAN_ACCIDENTAL_GAP).setY(y)
                acc.renderText(ctx, 0, 0)
              }
            }
            ctx.beginPath()
            ctx.setLineWidth(Stem.WIDTH)
            ctx.moveTo(member.stemX, member.baseY)
            ctx.lineTo(member.stemX, member.tipY)
            ctx.stroke()
          } finally {
            ctx.closeGroup()
          }
        }
        // The gap to the fan behind belongs to THIS fan's ink — it is the one wearing the `continue`.
        for (const q of [...joinQuads, ...geometry.beams]) {
          this.fillBeamQuad(ctx, q.startX, q.startY, q.endX, q.endY, q.thickness)
        }
      } finally {
        ctx.closeGroup()
      }
    }
  }

  /**
   * ONE fanned slot, resolved: its note, its members' heads and signs, its prefix, and the full
   * option set its geometry is computed from. Null for anything that is not a fanned chord.
   *
   * Split out because P2 has to spend it TWICE — once to ask what line this fan would want, and once
   * to draw it at the line the whole joined group agreed on — and because P3 builds the same thing
   * from a group that has no single bar to read its clef, its accidentals or its next note from.
   *
   * ⭐ The STAVE comes from the note itself. It is the one source that is right in both passes: a
   * synthetic lane spanning two bars has two staves, and each fan belongs to its own.
   */
  private fanSlotDrawing(input: {
    index: number
    slot: ChordRest
    /** The score being drawn — read for the members' own authored spaces (client #10, §7). */
    score: Score
    note: StaveNote | undefined
    /** The clef this member's pitches are read against — its own bar's. */
    clef: Clef
    /** `displayedAccidentals` for this member's own bar: which pitch ids show a sign. */
    signs: Map<string, string | null>
    /** The group this fan is joined to on its left; empty for anything but a chain's first fan. */
    prefixNotes: StaveNote[]
    /** The next note in the fan's OWN bar — where its room ends. Absent ⇒ the note area's end. */
    nextNote: StaveNote | undefined
    measureNumber: number
    staffIndex: number
    /** This fan is on a joined beam, so its line is flat even where it has no prefix (a chain). */
    joined: boolean
  }): FanSlotDrawing | null {
    const { index, slot, score, note, clef, signs, nextNote, measureNumber, staffIndex, joined } = input
    if (slot.type !== 'chord' || !slot.fan) return null
    if (!note) return null
    const stave = note.getStave()
    if (!stave) return null

    const headX = note.getNoteHeadBeginX()
    const { topY, baseY } = note.getStemExtents()
    const stemDirection = note.getStemDirection()

    const stored = slot.fan.members ?? []
    const heads = fanMemberPitches(slot.notes, slot.fan).map((pitches, k) => pitches.map(p => ({
      pitch: p,
      line: staffLineForSpelling(p.step, p.octave, clef),
      // ⚠️ Only a member with a pitch of its OWN can carry a sign. A member falling back to the
      // slot's pitches (a mark that never went through `normalizeFan`) is the same note, whose
      // sign the real notehead has already shown — looking its id up would re-draw it on every
      // head in the group.
      sign: k > 0 && stored[k - 1] ? signs.get(p.id) ?? null : null,
    })))
    // An accidental hangs to the LEFT of its head, and the width pass could not know about it (it
    // counts head columns and cannot measure glyphs), so the group buys the room out of its own
    // span. Member 0's sign is VexFlow's business — a real modifier on a real note.
    const accidentalRoom = heads.map((pitches, k) => (k === 0 ? 0 : Math.max(
      0, ...pitches.map(h => (h.sign ? this.accidentalWidth(h.sign) : 0)),
    )))

    // ⭐ THE PREFIX — the group this fan is JOINED to on its left (docs/fan-beam-join-plan.md P1).
    // Their x's and head y's are the FORMATTER's, settled and read here like everything else in this
    // pass; what the join changes is only where their stems end.
    const prefixNotes = input.prefixNotes.filter(n => !!n && !!n.getStem())
    // The lines they ask for: the count their own duration carries, the MINIMUM across them so a
    // mixed prefix draws only what they all agree on.
    const prefixBeams = prefixNotes.length ? Math.min(...prefixNotes.map(n => n.getBeamCount())) : 0

    return {
      index, slot, note, stave, measureNumber, staffIndex,
      headX, baseY, stemDirection, heads, stored, prefixNotes,
      options: {
        members: fanMembers(slot.fan, slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)),
        memberSpaces: fanMemberSpacesPx(score, measureNumber, slot),
        // ⚠️ Same array shape as the spaces above, opposite arithmetic — the geometry SUBTRACTS entry
        // 0 (already inside `headX`) and adds the rest without touching the span. See
        // `FanGeometryOptions.memberOffsets`.
        memberOffsets: fanMemberOffsetsPx(score, slot, stave),
        memberHeadYs: heads.map(pitches => pitches.map(h => stave.getYForNote(h.line))),
        direction: slot.fan.direction,
        beams: slot.fan.beams,
        // The wedge's own ends, RAW — `fannedBeamGeometry` clamps them against the member list it
        // will index, which is the array that actually has to be in range.
        rampFrom: slot.fan.rampFrom,
        rampTo: slot.fan.rampTo,
        spread: slot.fan.spread,
        headX,
        // Where the ramp's room ends — the next note's ink, MINUS whatever space the user authored
        // before that note. Its px are already in the head x (the tick context moved), and spending
        // them on the ramp is what made the fan grow instead of the gap after it.
        spanEndX: (nextNote ? nextNote.getNoteHeadBeginX() : stave.getNoteEndX())
          - fanTrailingSpacePx(score, measureNumber, slot),
        stemOffset: note.getStemX() - headX,
        // MEASURED from the notehead itself, like the two-note tremolo's flag clearance: heads a
        // whole glyph apart cannot touch, and the number follows the staff size instead of pinning
        // a pixel count that would be wrong the day the scale changes. The bar has already been
        // asked for the room this implies (`fanColumns`); this is what SPENDS it.
        minHeadGap: note.getGlyphWidth() * FAN_MIN_HEAD_GAP_RATIO,
        accidentalRoom,
        prefix: prefixNotes.map(n => ({ stemX: n.getStemX(), headYs: n.getYs() })),
        prefixBeams,
        // Every fan on a joined beam draws flat, prefix or no prefix — a chain's FIRST fan has none.
        joined,
        tipY: topY,
        // ⚠️ The LARGER of the two extensions: the beam levels eat into every stem in the group, and
        // a 32nd prefix joined to a one-beam fan is the case that under-reserves otherwise.
        minStemLength: stave.getSpacingBetweenLines() * FAN_MIN_STEM_SPACES
          + Math.max(
            fanStemExtension(slot.fan.beams, CROSS_SYSTEM_BEAM_WIDTH, slot.fan.spread),
            // ⚠️ No spread: the prefix's levels are ORDINARY beams at the ordinary gap.
            fanStemExtension(prefixBeams, CROSS_SYSTEM_BEAM_WIDTH),
          ),
        stemDirection,
        beamWidth: CROSS_SYSTEM_BEAM_WIDTH,
      },
    }
  }

  /**
   * ⭐ P2 — ONE LINE FOR THE WHOLE JOINED GROUP. A beam is one straight edge, so two fans sharing one
   * cannot each decide their own height.
   *
   * Asked, not restated: each fan is run through {@link fannedBeamGeometry} exactly as it would be
   * alone, and the OUTERMOST answer wins — the same "largest ask wins, the whole line moves" the
   * floor pass already applies within one fan, one level up. Nothing about the rule is duplicated
   * here, which is the point of doing it by a second call rather than by arithmetic of its own.
   *
   * ⚠️ The outermost is also what keeps every owner's stem GROWABLE: each fan's own answer is at or
   * beyond its own natural tip (the floor only pushes away), so the outermost is beyond all of them
   * — and a fan's owner stem is VexFlow's, which `stemLift` can only lengthen.
   *
   * Only for a joined group: a fan standing alone keeps the lean its members earned.
   */
  private reconcileFanJoinLines(drawings: FanSlotDrawing[], fanJoins: FanJoin[]): void {
    for (const join of fanJoins) {
      const members = drawings.filter(d => join.fans.includes(d.index))
      if (members.length < 2) continue // one fan settles its own line; the floor already heard the prefix
      const tentative = members
        .map(d => fannedBeamGeometry(d.options))
        .filter(geometry => geometry.beams.length > 0)
      if (!tentative.length) continue
      const up = members[0].stemDirection > 0
      const lineY = up
        ? Math.min(...tentative.map(geometry => geometry.lineY))
        : Math.max(...tentative.map(geometry => geometry.lineY))
      for (const d of members) d.options.lineY = lineY
    }
  }

  /**
   * 🚨 The PREFIX's stems — the notes a fan is joined to — drawn as each note's OWN `Stem` object,
   * never as a hand-drawn line whatever it costs: the selection highlight resolves a stem by that
   * object's SVG element ({@link getStaveNoteSVGGroup}), so ink drawn any other way could never be
   * selected. `StaveNote.draw` skipped them (they wear the placeholder beam), so this is their only
   * drawing — the same pattern {@link drawCrossBarLoneFragment} spells out.
   *
   * With `tips`, each stem is re-aimed onto the joined line first. Without (the fan drew nothing),
   * they keep the length they were formatted with.
   */
  private drawFanPrefixStems(ctx: SVGContext, prefixNotes: StaveNote[], tips: { tipY: number }[]): void {
    for (let k = 0; k < prefixNotes.length; k++) {
      const prefixNote = prefixNotes[k]
      const stem = prefixNote.getStem()
      if (!stem) continue
      const target = tips[k]
      if (target) {
        // Signed by the stem direction, so it reads the same either way up: positive GROWS the stem.
        // The line is flat and its floor is a minimum rather than a natural length, so a note that
        // already reached past it shrinks to meet it — which is what a beam does to its notes.
        const grow = prefixNote.getStemDirection() * (prefixNote.getStemExtents().topY - target.tipY)
        stem.setExtension(stem.getExtension() + grow)
      }
      stem.adjustHeightForBeam() // the flag's height fudge swapped for the beam's; the tip stays put.
      stem.setContext(ctx).drawWithStyle()
    }
  }

  /**
   * The fanned group's ink as ONE hit rect, MEASURED from the geometry that placed it — the same
   * rule the two-note tremolo's click target follows: the code that put the ink there is the only
   * honest source for where it is. Filed as a `beam`, which is what the reader sees and what the fan
   * mostly is.
   *
   * Every member's noteheads count, not just the real note's: with pitches of their own the group's
   * ink reaches wherever they went.
   */
  private registerFanInk(
    geometry: FanGeometry,
    headX: number,
    baseY: number,
    measureNumber: number,
    staffIndex: number,
    /** The joined group in front of it, if any — the rect reaches back over their stems too. */
    prefixNotes: StaveNote[] = [],
    /** The quads bridging the gap to the fan behind it (P2) — its ink as much as the ramp is. */
    joinQuads: FanQuad[] = [],
  ): void {
    const quads = [...geometry.beams, ...joinQuads]
    const ys = [
      ...quads.flatMap(q => [q.startY, q.endY, q.startY + q.thickness, q.endY + q.thickness]),
      ...geometry.stems.map(s => s.baseY),
      ...prefixNotes.map(n => n.getStemExtents().baseY),
    ]
    const top = Math.min(...ys, baseY)
    const bottom = Math.max(...ys, baseY)
    // ⚠️ LEFT to the first prefix stem, not merely taller: the joined beam is the fan's ink, so
    // clicking any of it must still select the fan. Its ORDER is already right — this runs before
    // `registerSlotElements` and `getAt` returns the LAST match, so the prefix noteheads still win
    // their own clicks.
    // ⚠️ EVERY member's own x on both edges, not `headX`-to-the-last-stem: a member offset by hand
    // (client #12) can sit left of the note that was typed or right of the member after it, and the
    // ramp's own order stops being the ink's order the moment one is nudged.
    const left = Math.min(
      headX,
      ...geometry.stems.map(s => s.headX),
      ...geometry.prefixStems.map(p => p.stemX),
      ...joinQuads.map(q => q.startX),
    )
    const right = Math.max(...geometry.stems.map(s => s.stemX))
    this.elementRegistry.add({
      type: 'beam',
      measure: measureNumber,
      staff: staffIndex,
      bbox: { x: left, y: top, width: right - left, height: bottom - top },
    })
  }

  /**
   * 🚨 The ledger lines of a hand-drawn member head — the ones `StaveNote.drawLedgerLines` would
   * have drawn if this head belonged to one.
   *
   * A bare `NoteHead` off the staff only swaps to the LEDGER glyph (a slightly wider head); the
   * lines themselves are `StaveNote`'s job, so a fan on a note above or below the staff drew
   * floating heads. Per-note pitch makes that the ordinary case rather than the exception, which is
   * why it is fixed here (docs/fanned-beam-pitches-plan.md §2).
   *
   * VexFlow's own bounds and its own loop: staff lines are 1–5, so a head needs lines from 6 up to
   * its own, or from 0 down to it, at the INTEGER lines only (a head in a space hangs off the last
   * one). The line is drawn a glyph wide plus a little each side — `strokePx`, VexFlow's default.
   */
  private drawFanLedgerLines(
    ctx: SVGContext,
    headX: number,
    line: number,
    glyphWidth: number,
    stave: Stave,
  ): void {
    if (line < 6 && line > 0) return
    const x1 = headX - FAN_LEDGER_OVERHANG
    const x2 = headX + glyphWidth + FAN_LEDGER_OVERHANG
    // The stave's own ledger style, so these are the same ink as every other ledger on the page —
    // save/restore keeps it local (the rest ledgers do exactly this).
    ctx.save()
    stave.applyStyle(ctx, stave.getDefaultLedgerLineStyle())
    const stroke = (l: number): void => {
      const y = stave.getYForNote(l)
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
    }
    for (let l = 6; l <= line; l++) stroke(l)
    for (let l = 0; l >= line; l--) stroke(l)
    ctx.restore()
  }

  /**
   * How much of the stem's TOP END is already spoken for, in pixels — what the strokes must start
   * below.
   *
   * ONE answer for both spellings, and that is the point: the drawn value's beam LINES occupy the
   * tip whether they are drawn as a beam over the pair or as a flag on each note. So the strokes
   * land in the same place either way, and pressing `single` moves the flags in and the beam out
   * without the strokes shifting under your eye.
   *
   * ⚠️ It does NOT fully clear a flag, which hangs further down the stem than one beam line does —
   * and cannot, now that a pair no longer stretches its stems (see above): a natural stem has room
   * for the stack or for a flag's worth of gap, not both. Nothing here is a chosen number, so if the
   * top stroke reads too close to the first note's flag, THIS is the one line to turn.
   */
  private twoNoteTremoloTipOffset(pair: { flags: number }): number {
    return pair.flags * CROSS_SYSTEM_BEAM_WIDTH * 1.5
  }

  /**
   * The valid pairs of ONE LANE, with both StaveNotes and the stroke count — the shared read the two
   * passes above make, so "which slots are a pair" is answered once.
   *
   * ⚠️ ONE LANE: `slots` must be one voice group's slots, not the measure's flattened list.
   * `pairRoleAt` looks at the NEXT slot, and across a group boundary that is another voice's first
   * note. (This is why both callers loop `groups` rather than the combined arrays.)
   *
   * `flags` is how many beam lines the DRAWN value carries (0 for a drawn whole/half/quarter, 1 for
   * a drawn eighth, …) and `beamed` says whether they are drawn as ONE BEAM over the pair or as each
   * note's own flag — the note's authored `single` chooses (see {@link pairDrawing}). Together they
   * decide whether the pair builds a `Beam`, how far past it the strokes start, and whether the
   * stems need the flag out of the way.
   *
   * The stroke count comes from the FIRST slot's `tremolo`; `pairIsValid` has already refused the
   * Penderecki sign, so it is a number here.
   */
  private twoNoteTremoloPairs(slots: ChordRest[], staveNotes: StaveNote[]): Array<{
    first: StaveNote; second: StaveNote; strokes: number; anchorId: string; slot: ChordRest
    flags: number; beamed: boolean; joined: boolean
  }> {
    const pairs: Array<{
      first: StaveNote; second: StaveNote; strokes: number; anchorId: string; slot: ChordRest
      flags: number; beamed: boolean; joined: boolean
    }> = []
    for (let i = 0; i + 1 < slots.length && i + 1 < staveNotes.length; i++) {
      const slot = slots[i]
      if (slot.type !== 'chord' || pairRoleAt(slots, i) !== 'first') continue
      const mark = slot.tremolo
      if (typeof mark !== 'number') continue
      const drawing = pairDrawing(slots, i)
      pairs.push({
        first: staveNotes[i],
        second: staveNotes[i + 1],
        // What is DRAWN, not what was marked: the pair's own beam is one of the lines and spends
        // one of the count (pairStrokesDrawn).
        strokes: pairStrokesDrawn(mark, drawing),
        anchorId: slot.notes[0]?.id ?? slot.id,
        slot,
        joined: pairIsJoined(slots, i),
        ...drawing,
      })
    }
    return pairs
  }

  /**
   * Register the STEM of `staveNote` as its own ink rect, anchored on `anchorNoteId`.
   *
   * WHY IT IS ITS OWN ELEMENT. The note registers a box that spans head + stem + beam on purpose
   * (docs/tight-bbox-plan.md §4a keeps that "semantic" box), which means the stem's own geometry —
   * which side of the head it is on, how far it reaches — is not readable from outside: only
   * guessable. VexFlow knows it exactly, so the answer is written down here rather than inferred at
   * hit-test time. First caller is the tremolo stamp (the strokes ride the stem, so that is where
   * the pointer goes — {@link ElementRegistry.findStemAt}); stem-length drag and stem selection
   * want the same rect.
   *
   * ONE per slot, on the chord's lowest pitch — a chord has one stem, exactly as it has one set of
   * dots and one set of articulations.
   *
   * `getStemX()` is the x the stem is DRAWN at (head's right edge for stem-up, left for stem-down,
   * and it already includes the note-offset `xShift`), and `getStemExtents()` gives tip → notehead
   * end. Called after the beams are drawn (see the draw order in `drawMeasureContent`), so a beamed
   * stem's extension is already applied and the rect is the real length, not the default one.
   *
   * A stemless note registers nothing: `hasStem()` is false for a whole note, and a stem you cannot
   * see is not a thing to click.
   */
  private registerStem(
    staveNote: StaveNote,
    anchorNoteId: string,
    measureNumber: number,
    staffIndex: number,
    beat: number,
  ): void {
    try {
      if (!staveNote.hasStem()) return
      const x = staveNote.getStemX()
      const { topY, baseY } = staveNote.getStemExtents()
      const y = Math.min(topY, baseY)
      const height = Math.abs(baseY - topY)
      if (!Number.isFinite(x) || !Number.isFinite(y) || height <= 0) return
      this.elementRegistry.add({
        type: 'stem',
        noteId: anchorNoteId,
        measure: measureNumber,
        staff: staffIndex,
        beat,
        // The drawn line is Stem.WIDTH wide, centred on x. Clicking it is padded by the registry
        // (STEM_CLICK_PAD) rather than here, so what is stored stays the ink and not a target.
        bbox: { x: x - Stem.WIDTH / 2, y, width: Stem.WIDTH, height },
      })
    } catch (_e) { /* stem geometry may not be available pre-draw */ }
  }

  /**
   * Register the TREMOLO mark of `staveNote` as its own ink rect, anchored on `anchorNoteId` — the
   * companion to {@link registerStem}, and one per slot for the same reason (a slot carries one
   * tremolo, as it carries one stem).
   *
   * The rect comes from the modifier's own {@link CenteredTremolo.inkRect}, recorded while it drew:
   * this is the one mark whose placement is ours rather than VexFlow's (centred on the stem, minus
   * whatever stem stretch it must not follow), so the only honest source for "where are the strokes"
   * is the code that put them there. `getBoundingBox()` — what the articulations register through —
   * describes one glyph anchored on the stem and extending a full advance-width to its right, which
   * is neither the stack nor where the ink is.
   *
   * Nothing is registered before the mark has drawn, which is the same reason this runs in the
   * post-draw registration pass rather than at build time.
   */
  private registerTremolo(
    staveNote: StaveNote,
    anchorNoteId: string,
    measureNumber: number,
    staffIndex: number,
    beat: number,
  ): void {
    try {
      const mark = staveNote.getModifiers().find(m => m instanceof CenteredTremolo)
      const rect = mark?.inkRect()
      if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || rect.height <= 0) return
      this.elementRegistry.add({
        type: 'tremolo',
        noteId: anchorNoteId,
        measure: measureNumber,
        staff: staffIndex,
        beat,
        bbox: rect,
      })
    } catch (_e) { /* tremolo geometry may not be available pre-draw */ }
  }

  /**
   * Interleave inline ClefNotes (for mid-measure clef changes) among the slot
   * StaveNotes. Each change is inserted before the first slot at/after its beat.
   * ClefNotes ignore ticks, so the voice's tick total is unaffected.
   * @returns the combined tickable list and a map of beat→ClefNote for registration
   */
  private interleaveClefNotes(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    midChanges: { beat: Fraction; clef: Clef }[],
  ): { tickables: (StaveNote | ClefNote)[]; clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> } {
    const tickables: (StaveNote | ClefNote)[] = []
    const clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> = []
    const remaining = [...midChanges]

    const emit = (change: { beat: Fraction; clef: Clef }) => {
      const clefNote = new ClefNote(change.clef, 'small')
      tickables.push(clefNote)
      clefNoteByBeat.push({ beat: change.beat, clef: change.clef, clefNote })
    }

    for (let i = 0; i < sortedSlots.length; i++) {
      const slotBeat = sortedSlots[i].beat
      // Emit any pending clef change whose beat is at/before this slot's beat.
      while (remaining.length && fracLte(remaining[0].beat, slotBeat)) {
        emit(remaining.shift()!)
      }
      tickables.push(staveNotes[i])
    }
    // Any leftover changes (beat past all slots) append at the end.
    for (const change of remaining) emit(change)

    return { tickables, clefNoteByBeat }
  }

  /**
   * Register rendered inline clef glyphs as 'clef' elements (with measure + beat)
   * for hit detection (mid-measure clef removal) and clef-segment lookup.
   */
  private registerMidMeasureClefs(
    clefNoteByBeat: Array<{ beat: Fraction; clefNote: ClefNote }>,
    measure: Measure,
    staffIndex: number = 0,
  ): void {
    for (const { beat, clefNote } of clefNoteByBeat) {
      try {
        const box = clefNote.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'clef',
            measure: measure.number,
            beat: fracToNumber(beat),
            // Attribute the glyph to its staff — clef is per-staff, so removal/selection
            // must target the right one. Without this, a mid-measure clef on staff 1+
            // defaulted to staff 0 and couldn't be removed (matchesStaff never matched).
            staff: staffIndex,
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (_e) { /* getBoundingBox may fail */ }
    }
  }


  /**
   * Calculate the stem direction for an entire beam group.
   * Uses the pitch furthest from the middle line across all slots.
   * @param slots - ChordRest slots in the beam group
   * @param clef - Clef type for middle line reference
   * @returns VexFlow stem direction value (1 = UP, -1 = DOWN)
   */
  private calculateBeamGroupStemDirection(slots: ChordRest[], clef: Clef = 'treble', forcedStemDirection?: number): number {
    // Explicit override on any note in the group takes priority over pitch calculation
    for (const slot of slots) {
      if (slot.type === 'chord' && slot.stemDirection === 'up') return 1
      if (slot.type === 'chord' && slot.stemDirection === 'down') return -1
    }

    // Multi-voice default (V1 up / V2 down) wins over the pitch calculation.
    if (forcedStemDirection !== undefined) return forcedStemDirection

    // No override — use the pitch furthest from the middle line
    const middleDiatonic = middleLineDiatonicPos(clef)
    let maxDistance = 0
    let furthestDiatonic = middleDiatonic
    let hasPitch = false

    for (const slot of slots) {
      if (slot.type === 'rest') continue
      for (const p of slot.notes) {
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const distance = Math.abs(dPos - middleDiatonic)
        if (!hasPitch || distance > maxDistance) {
          maxDistance = distance
          furthestDiatonic = dPos
          hasPitch = true
        }
      }
    }

    return furthestDiatonic >= middleDiatonic ? -1 : 1
  }

  /**
   * Calculate the optimal location (above or below) for a tuplet bracket
   * Based on the stem direction of the notes in the tuplet
   * @param staveNotes - The VexFlow StaveNotes in the tuplet
   * @param clef - The clef type for pitch reference
   * @returns VexFlow.Tuplet.LOCATION_TOP (1) or VexFlow.Tuplet.LOCATION_BOTTOM (-1)
   */
  private calculateTupletLocation(staveNotes: StaveNote[], _clef: Clef): number {
    // VexFlow constants: LOCATION_TOP = 1, LOCATION_BOTTOM = -1
    const LOCATION_TOP = 1
    const LOCATION_BOTTOM = -1

    if (staveNotes.length === 0) return LOCATION_TOP

    // Check if all notes have stems down (then bracket goes above)
    // or if all notes have stems up (then bracket goes below)
    // Mixed directions: use majority or default to above
    let stemsUp = 0
    let stemsDown = 0

    for (const note of staveNotes) {
      try {
        const stem = note.getStem()
        if (stem) {
          // getStemDirection returns 1 for up, -1 for down
          const direction = note.getStemDirection()
          if (direction === 1) stemsUp++
          else if (direction === -1) stemsDown++
        } else {
          // No stem (whole note or rest) - use default
          stemsDown++
        }
      } catch (_e) {
        // getStem may fail for rests
        stemsDown++
      }
    }

    // Bracket goes opposite to stem direction:
    // - Stems up → bracket below
    // - Stems down → bracket above
    if (stemsUp > stemsDown) {
      return LOCATION_BOTTOM
    } else {
      return LOCATION_TOP
    }
  }

  /**
   * Resolve the opening clef of every measure (the clef drawn at its barline /
   * line start). Mid-measure changes are handled per-slot during rendering.
   * @returns Map of measure number → opening clef
   */
  /** Per-measure opening clef for one staff (multi-staff: clef is per-staff). `staffId`
   *  absent resolves to staff 0 / the single staff at N=1 — identical to the old map. */
  private computeEffectiveClefs(score: Score, staffId?: string): Map<number, Clef> {
    return resolveStaffClefs(score, staffId).opening
  }

  /**
   * Render a single measure
   * @param measure - Measure to render
   * @param x - X position on canvas
   * @param y - Y position on canvas
   * @param width - Width of the measure
   * @param isFirstInLine - Whether this is the first measure in a line
   * @param clef - Effective clef for this measure (rendering and stem direction)
   * @param hasClefChange - Whether this measure's clef differs from the previous measure
   * @param cautionaryEndClef - Clef to draw at the measure end as a cautionary warning
   *   (set when this is a line's last measure and the next line opens with a new clef)
   * @param ghostClefBeat - Beat of a dragged-redundant clef in this measure to keep
   *   visible during the drag even at beat 0, where it would otherwise be hidden
   * @param cautionaryEndTimeSig - Time signature to draw (full size) at the measure
   *   end as a courtesy warning (set when the next line opens with a meter change)
   */
  /**
   * The addressable unit of the drawn score (docs/render-performance-plan.md §7).
   *
   * One `<g class="vf-measure" id="vf-m{n}-s{i}">` per **(measure, staff)** — not per measure. The
   * staff axis is addressable because P6 must cull **vertically** too: you cannot see forty staves
   * at once, so a bar of the piccolo line must be droppable without dropping the same bar of the
   * cellos.
   *
   * Everything drawn between open and close lands inside the group, which is what later lets one
   * measure be re-drawn, moved or dropped on its own. Tier-1 work (`buildStave`,
   * `recordMeasureBounds`) deliberately happens *outside* it: it emits no DOM, and it must keep
   * working for measures that are never drawn at all.
   */
  /**
   * **Tier 1** (docs/render-performance-plan.md §7) — place every (measure, staff) in the score and
   * register its geometry. **Draws nothing.**
   *
   * This is the pass that has to run for the WHOLE score even once P6 only draws a window of it —
   * so it is deliberately kept to things a measure can know without being painted:
   *
   * - `measureBounds` — the measure's box (what `CoordinateMapper` maps pixels through);
   * - `staffGeometry` — the five line Y positions, note start/end X, the governing clef (what
   *   pixel↔pitch resolves against);
   * - the hit-boxes for the staff, the opening clef, the meter and the barline.
   *
   * What it deliberately does NOT register is anything whose position only exists once the voice is
   * formatted and drawn: noteheads, accidentals, beams, tuplets, dynamics, and the inline-clef
   * segments. Those are tier 2 (`drawMeasureContent`), and a measure nobody can see does not need
   * them — see the note there.
   */
  private layoutTier1(
    score: Score,
    staffList: { id?: string }[],
    clefsByStaff: Map<string | undefined, StaffClefs>,
    measureWidths: Map<number, MeasureWidthInfo>,
    spacing: { lineTopPx: number[]; cumPx: number[][]; lineHeightPx: number[] },
    staffStride: number,
    margin: number,
  ): Omit<MeasurePlacement, 'stave'>[] {
    const placements: Omit<MeasurePlacement, 'stave'>[] = []
    let currentLine = -1
    let currentX = margin

    for (const measure of score.measures) {
      const widthInfo = measureWidths.get(measure.number)
      if (!widthInfo) {
        console.error(`No width info for measure ${measure.number}`)
        continue
      }

      if (widthInfo.lineNumber !== currentLine) {
        currentLine = widthInfo.lineNumber
        currentX = margin
      }

      // Top of this system (line): margin + the stacked heights of every system above it, each
      // grown by its own per-system staff-spacing extra (precomputed in `spacing.lineTopPx`).
      const systemTop = spacing.lineTopPx[currentLine]
      const isFirstInLine = currentX === margin

      // Each staff of this measure sits at its own Y with its own clef and its own slice of the
      // content (staffMeasureView filters slots/clefs/dynamics/tuplets to the staff). Barlines
      // align because every staff shares this measure's x/width.
      staffList.forEach((staff, staffIndex) => {
        // `spacing.cumPx[line][i]` already includes this staff's own space-above plus every
        // staff above it on THIS system (inclusive prefix) — push it and everything below down.
        const y = systemTop + staffIndex * staffStride + spacing.cumPx[currentLine][staffIndex]
        const staffClefs = clefsByStaff.get(staff.id)
        const clef = (staffClefs?.opening.get(measure.number) || 'treble') as Clef
        const prevEndClef = measure.number > 1 ? staffClefs?.ending.get(measure.number - 1) : undefined
        const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
        // The clef-drag ghost is still the primary staff's concern (drag has no staff axis yet).
        // The cautionary end-clef is NOT: a clef is per staff, so each staff reads its own — a
        // change on staff 2 warns on staff 2 and nowhere else. The cautionary end time-sig stays
        // shared, because a meter is.
        const ghostClefBeat = staffIndex === 0 ? this.ghostClefBeatFor(score, measure.number) : undefined
        const cautionaryEndClef = widthInfo.cautionaryEndClefs?.[staffIndex]
        const view = staffMeasureView(measure, staff.id, score)

        placements.push({
          view,
          measureNumber: measure.number,
          staffIndex,
          line: currentLine,
          x: currentX,
          y,
          width: widthInfo.finalWidth,
          isFirstInLine,
          clef,
          hasClefChange,
          cautionaryEndClef,
          cautionaryEndTimeSig: widthInfo.cautionaryEndTimeSig,
          ghostClefBeat,
          systemHeight: spacing.lineHeightPx[currentLine],
        })
      })

      currentX += widthInfo.finalWidth
    }

    return placements
  }

  /**
   * The measures that a tie or slur is **anchored in** — the ones P5.4b may NOT move by transform.
   *
   * Ties and slurs live outside the measure groups and are redrawn from scratch every render, by
   * asking `staveNoteMap` where their endpoint notes are. A transform-reused measure keeps its
   * *previous* `StaveNote` objects, and those still report the coordinates they were **drawn** at —
   * so a span anchored in one would be drawn back at the bar's old position, detached from its
   * notes.
   *
   * Rather than teach every span renderer to add an offset (many call sites, easy to miss one), the
   * rule is blunt and provably safe:
   *
   * > **A measure holding a span anchor is redrawn whenever it moves.** Its `StaveNote`s are then
   * > fresh, so no offset is ever needed anywhere.
   *
   * The cost is small and bounded: only the two *endpoint* bars of a span, never the bars it merely
   * crosses. A slur over bars 4–15 redraws 4 and 15; 5–14 still just translate.
   *
   * A **cross-barline beam** is a span in exactly this sense and joins the same list: it is drawn
   * outside every measure group, from its notes' drawn coordinates, so none of its bars may be
   * translated. But the forcing is **per SIDE**, not per join (docs/cross-barline-beaming-plan.md
   * P4): a same-line side pins its bars together — when it crosses the window both must be painted, or
   * half the fragment has no `StaveNote` — while the two sides of a group split across a system break
   * are independent, so seeing one system never forces the other's bar to be painted for nothing. A
   * one-bar side pins nothing (no pair) but still keeps its own bar from being translated.
   */
  private spanAnchors(score: Score, joins: CrossBarJoin[], fanJoins: CrossBarFanJoin[] = []): SpanAnchors {
    const measures = new Set<number>()
    const list: SpanAnchors['list'] = []

    // Where every pitch sits — the (measure, staff) a span endpoint resolves to. One walk; both
    // ties and slurs read it.
    const homeOfPitch = new Map<string, { measure: number; staffIndex: number }>()
    for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        const staffIndex = staffIndexOfId(score, slot.staffId)
        for (const pitch of slot.notes) {
          homeOfPitch.set(pitch.id, { measure: measure.number, staffIndex })
        }
      }
    }

    const add = (
      from: { measure: number; staffIndex: number } | undefined,
      to: { measure: number; staffIndex: number } | undefined,
    ) => {
      // Each END that resolves is marked, independently — a half-resolvable span still pins the bar
      // it can find. Only the (from, to) PAIR needs both, since a span with one end missing has no
      // range to intersect the window with and draws nothing anyway.
      if (from) measures.add(from.measure)
      if (to) measures.add(to.measure)
      if (!from || !to) return
      list.push({
        lo: Math.min(from.measure, to.measure),
        hi: Math.max(from.measure, to.measure),
        groups: [
          measureGroupKey(from.measure, from.staffIndex),
          measureGroupKey(to.measure, to.staffIndex),
        ],
      })
    }

    // Ties are carried on the pitches themselves.
    for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        for (const pitch of slot.notes) {
          // The no-translate mark is taken from the FLAG, not from a resolved pair. A tie whose
          // counterpart cannot be found (a dangling `tiedTo`, a `tiedFrom` whose source is gone)
          // still has to keep its bar from being translated — a translated bar hands the span
          // renderers stale StaveNote coordinates, and the tie is drawn detached from its notes.
          // Resolution is allowed to fail; the protection is not allowed to depend on it.
          if (pitch.tiedTo || pitch.tiedFrom) measures.add(measure.number)
          if (pitch.tiedTo) add(homeOfPitch.get(pitch.id), homeOfPitch.get(pitch.tiedTo))
        }
      }
    }

    // Slurs name their endpoints by note id.
    for (const slur of score.slurs ?? []) {
      add(homeOfPitch.get(slur.startNoteId), homeOfPitch.get(slur.endNoteId))
    }

    // Cross-barline beams. Their bars are known directly (the plan resolved them against this
    // render's own layout), so they are added by number rather than looked up by note id.
    // One anchor group per SIDE — a split join pins each system's fragment independently — and one
    // list entry per BARLINE a side opens: a side spanning two barlines has a middle bar, dragged in
    // by either neighbour being on screen. A one-bar side adds its measure but forces no pair.
    for (const join of joins) {
      for (const side of join.sides) {
        for (let i = 0; i < side.measures.length; i++) {
          measures.add(side.measures[i])
          if (i === 0) continue
          const before = side.measures[i - 1]
          const after = side.measures[i]
          list.push({
            lo: before,
            hi: after,
            groups: [measureGroupKey(before, join.staffIndex), measureGroupKey(after, join.staffIndex)],
          })
        }
      }
    }

    // …and the fans whose beam crosses one (docs/fan-beam-join-plan.md P3), on the same terms. No
    // `sides` to walk: such a join is refused outright unless every member landed on ONE system, so
    // its bars are always one pinned set. Without this, culling would delete the bar holding the
    // prefix and the joined beam would draw its line to stems that are no longer there.
    for (const join of fanJoins) {
      const barsTouched = [...new Set(join.members.map(m => m.measureNumber))].sort((a, b) => a - b)
      for (let i = 0; i < barsTouched.length; i++) {
        measures.add(barsTouched[i])
        if (i === 0) continue
        list.push({
          lo: barsTouched[i - 1],
          hi: barsTouched[i],
          groups: [
            measureGroupKey(barsTouched[i - 1], join.staffIndex),
            measureGroupKey(barsTouched[i], join.staffIndex),
          ],
        })
      }
    }

    return { measures, list }
  }

  /**
   * **P6, the cross-measure-span rule** (docs/render-performance-plan.md §8).
   *
   * Ties and slurs are drawn in a post-measure pass that asks `staveNoteMap` where their endpoint
   * notes are — and only a *drawn* measure puts anything in `staveNoteMap`. So a slur over bars 3–9
   * with only 5–7 on screen would find neither endpoint and silently vanish, even though most of its
   * arc crosses the window.
   *
   * §8 says spans must be selected "by intersection with the window, not by whether their anchors
   * happen to be drawn". The way to honour that without teaching every span renderer to work from
   * tier-1 geometry is to make the second thing imply the first:
   *
   * > **A span that intersects the window forces its two anchor bars to be drawn**, wherever they
   * > are. They may land far off-screen; that is harmless (the SVG is scrolled, not clipped), and it
   * > means the span renderers keep resolving endpoints exactly as they do today.
   *
   * The cost is two bars per crossing span, and only for spans that actually straddle the window
   * edge — a tie into the next bar is inside the overscan and pays nothing.
   */
  private forcedSpanGroups(spans: SpanAnchors, visibleMeasures: Set<number>): Set<string> {
    const forced = new Set<string>()
    for (const span of spans.list) {
      let intersects = false
      for (let m = span.lo; m <= span.hi && !intersects; m++) {
        if (visibleMeasures.has(m)) intersects = true
      }
      if (!intersects) continue
      forced.add(span.groups[0])
      forced.add(span.groups[1])
    }
    return forced
  }

  /**
   * **Tier 1, per measure** — build the Stave and register the geometry of one (measure, staff).
   * Draws nothing. Run only for measures this render is actually rebuilding; a reused measure
   * replays its snapshot instead, which is the same thing at zero cost.
   */
  private registerTier1(p: Omit<MeasurePlacement, 'stave'>): Stave {
    const stave = this.buildStave(p.view, p.x, p.y, p.width, p.isFirstInLine, p.clef, p.hasClefChange, p.cautionaryEndClef, p.cautionaryEndTimeSig)

    this.recordMeasureBounds(stave, p.view, p.x, p.y, p.width, p.staffIndex)
    // Per-measure geometry is keyed by (measure, staffIndex), so every stacked staff registers its
    // own — pitch↔y resolves against each staff's real clef + line Y positions, and a click is
    // attributed to a staff by its y-band (ElementRegistry.staffIndexAtY).
    this.registerStaffAndGeometry(stave, p.view, p.x, p.width, p.isFirstInLine, p.clef, p.hasClefChange, p.staffIndex)

    // This measure's REAL system height, so pixelToMeasure's vertical band matches the drawn layout
    // — the uniform fallback under-covers once a staff is spaced far down
    // (docs/staff-spacing-plan.md §3). Written by staff 0, which owns measureBounds.
    const bounds = this.measureBounds.get(p.measureNumber)
    if (bounds) bounds.systemHeight = p.systemHeight

    return stave
  }

  /**
   * Plan this render's cross-barline beams (docs/cross-barline-beaming-plan.md). `isDrawn` says
   * whether tier 2 is painting the plan at that index — an unpainted bar closes its barline.
   *
   * The stem direction is resolved HERE, over the whole group, because the rule needs the clef at
   * the group's first note and clefs are the renderer's business. Same precedence as an ordinary
   * beam group's: an explicit override on any note, then the multi-voice lane, then the pitch
   * furthest from the middle line — so in a two-voice bar the answer equals the direction the note
   * was already built with, and the post-format multi-voice re-assert stays a no-op.
   */
  private planCrossBarBeams(
    plans: Omit<MeasurePlacement, 'stave'>[],
    isDrawn: (index: number) => boolean,
  ): CrossBarBeamPlan {
    return planCrossBarBeams(
      plans.map((p, i) => ({
        measureNumber: p.measureNumber,
        staffIndex: p.staffIndex,
        line: p.line,
        drawn: isDrawn(i),
        view: p.view,
        clef: p.clef,
      })),
      (unionSlots, first, forced) => {
        const clef = makeClefResolver(first.bar.view, first.bar.clef)(first.slot.beat)
        return this.calculateBeamGroupStemDirection(unionSlots, clef, forced)
      },
    )
  }

  renderMeasure(pass: RenderPass, placement: MeasurePlacement, beamPlan?: CrossBarBeamPlan): Stave {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    const key = measureGroupKey(placement.measureNumber, placement.staffIndex)
    const group = this.context.openGroup('measure', key) as SVGGElement
    this.measureGroups.set(key, group)
    try {
      return this.drawMeasureContent(pass, placement, beamPlan)
    } finally {
      // ALWAYS close, even if the draw threw. VexFlow's openGroup pushes the context's append
      // target; leaving it open would nest the entire rest of the score — every later measure, the
      // ties, the slurs, the ghosts — inside this one measure's group (cf. TempoLayout's own note).
      this.context.closeGroup()
    }
  }

  private drawMeasureContent(pass: RenderPass, placement: MeasurePlacement, beamPlan?: CrossBarBeamPlan): Stave {
    const { view: measure, x, clef, ghostClefBeat, staffIndex, stave } = placement

    // The stave was BUILT by tier 1 (`layoutTier1`); tier 2 only paints it.
    this.drawStave(stave)

    // Resolve the clef in effect at any beat within this measure: starts from the
    // opening clef and applies each clef change at/after its beat.
    const clefForBeat = makeClefResolver(measure, clef)
    // Mid-measure changes (beat > 0) render as inline ClefNotes before their slot.
    const midChanges: { beat: Fraction; clef: Clef }[] = (measure.clefs ?? [])
      .filter(c => !fracIsZero(c.beat))
      .sort((a, b) => fracCompare(a.beat, b.beat))
      .map(c => ({ beat: c.beat, clef: c.clef }))

    // If the dragged-redundant clef sits at beat 0, the opening clef is suppressed
    // (redundant), so render it as an inline clef at the measure start to keep it
    // visible during the drag (it's removed on drop by commitClefMove).
    if (ghostClefBeat !== undefined && fracIsZero(ghostClefBeat)) {
      const opening = (measure.clefs ?? []).find(c => fracIsZero(c.beat))
      if (opening) midChanges.unshift({ beat: opening.beat, clef: opening.clef })
    }

    // Clef regions for pixel↔pitch lookup; opening clef covers the whole measure,
    // each inline clef (added after draw) starts a new region at its X.
    const clefSegments: ClefSegment[] = [{ fromX: x, clef }]

    if (measure.slots.length > 0) {
      const sortedAll = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))

      // Group slots by model voice (0 = primary). With more than one voice, engrave
      // them as independent streams (Sibelius-style) by voice PARITY: odd voices
      // (V1/V3, model 0/2) stems up, even voices (V2/V4, model 1/3) stems down.
      //
      // Rests get their OWN vertical lane per voice so same-parity voices never overlap
      // (each entry × REST_LINE_STEP lines, + = up): a top-to-bottom ladder V3 / V1 / V2 / V4
      // — V1 centred like a single voice, V3 above it, V2 below it, V4 below V2. REST_LINE_STEP
      // is the one knob to retune the spread by eye. (docs/multi-voice-plan.md §13.)
      const REST_LINE_STEP = 3
      const REST_LANE = [0, -1, 1, -2] // × REST_LINE_STEP, indexed by 0-based model voice
      const voiceIds = [...new Set(sortedAll.map(s => s.voice ?? 0))].sort((a, b) => a - b)
      const multiVoice = voiceIds.length > 1
      // Our intended rest line / stem direction / horizontal shift per StaveNote, captured
      // BEFORE formatting. VexFlow's StaveNote.format rewrites all three for same-tick
      // multi-voice collisions — it nudges rests apart (can lift V1's centred rest off the
      // middle line), REASSIGNS stem directions (a 3rd voice forced up gets flipped down, and
      // the user's `x` override with it), and X-SHIFTS a colliding notehead sideways (a voice
      // pushed right of the others). None is right for our voice model — we want the voices
      // stacked and under our control — so we re-assert all three after format.
      const intendedRestLine = new Map<StaveNote, number>()
      const intendedStemDir = new Map<StaveNote, number>()
      const intendedXShift = new Map<StaveNote, number>()
      const groups = voiceIds.map(v => {
        const slots = sortedAll.filter(s => (s.voice ?? 0) === v)
        const stemUp = v % 2 === 0
        const forcedStem = multiVoice ? (stemUp ? 1 : -1) : undefined
        const restShift = multiVoice ? (REST_LANE[v] ?? 0) * REST_LINE_STEP : 0
        // notesOnly: one StaveNote per slot (used for beams, tuplets, registration). The
        // resolver adds each rest's manual vertical shift (if any) on top of the voice base.
        const restShiftFor = (slot: ChordRest): number =>
          restShift + (restShiftOverrideOf(pass.score, restPositionKey(measure.id, slot.voice ?? 0, slot.beat, slot.staffId))?.steps ?? 0)
        const staveNotes = createStaveNotesFromSlots(slots, clefForBeat, forcedStem, restShiftFor)
        for (const sn of staveNotes) {
          // Non-measure rests only: measure (whole-bar) rests are centred separately and
          // reset() would disturb that. Their lane line is what draw must honour.
          if (sn.isRest()) {
            if (!sn.isCenterAligned()) intendedRestLine.set(sn, sn.getKeyLine(0))
          } else if (multiVoice) {
            // The stem we set from voice parity or the `x` override — VexFlow must not flip it.
            intendedStemDir.set(sn, sn.getStemDirection())
          }
          // Keep every voice at the shared X (no auto sideways offset). Measure rests carry
          // their centring in a separate centerXShift, so restoring xShift here is harmless.
          if (multiVoice) intendedXShift.set(sn, sn.getXShift())
        }
        return { voice: v, slots, staveNotes, forcedStem }
      })

      // Combined parallel arrays (group order) for the once-per-measure passes that
      // already key on voice / tupletId internally — dynamics, tuplets, registration.
      const sortedSlots = groups.flatMap(g => g.slots)
      const staveNotes = groups.flatMap(g => g.staveNotes)

      // Attach dynamics as Annotation modifiers BEFORE formatting so they reserve
      // vertical space and stack with articulations. Co-located marks (stacked at
      // one beat) come back as id-groups, repositioned onto one row after drawing.
      const dynamicGroups = attachDynamicsToSlots(pass, sortedSlots, staveNotes, measure)

      // Tuplets must be created BEFORE adding notes to voice — VexFlow adjusts tick
      // values. A tuplet belongs to one voice, so grouping by tupletId is voice-safe.
      const { vexTuplets, tupletStaveNoteMap } = this.buildVexTuplets(sortedSlots, staveNotes, measure, clef, multiVoice)

      const meter = getMeterInfo(measure.timeSignature)
      const capacity = measureCapacityFrac(measure)

      // One VexFlow Voice per group. Mid-measure clef glyphs are staff-wide, so only
      // the primary voice carries the inline ClefNotes (they're tickless, so the
      // voices still share a tick total and Formatter.joinVoices won't mismatch).
      const built = groups.map((g, gi) => {
        let tickables: (StaveNote | ClefNote)[]
        let clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> = []
        if (gi === 0) {
          const r = this.interleaveClefNotes(g.slots, g.staveNotes, midChanges)
          tickables = r.tickables
          clefNoteByBeat = r.clefNoteByBeat
        } else {
          tickables = g.staveNotes
        }
        const voice = new Voice({
          numBeats: measure.timeSignature.numerator,
          beatValue: measure.timeSignature.denominator,
        }).setMode(chooseVoiceMode(g.slots, capacity))
        voice.addTickables(tickables)
        // This lane's beams. When a cross-barline plan owns the lane it decides BOTH halves: which
        // groups this bar builds itself, and which of its notes are waiting for a beam that spans
        // the barline (docs/cross-barline-beaming-plan.md).
        const lane = beamPlan?.lanes.get(laneKey(measure.number, staffIndex, g.voice))
        const { beams, fanJoins } = this.buildBeams(g.staveNotes, g.slots, meter, clefForBeat, g.forcedStem, lane?.inBar)
        // A two-note tremolo whose DRAWN value is beamable owns its own beam — the meter never gives
        // it one (`pairRoleAt` breaks the group in the pure grouper), so without this the pair draws
        // with flags. Built here, with the others, because it must exist BEFORE the format pass.
        beams.push(...this.buildTwoNoteTremoloBeams(g.slots, g.staveNotes))
        if (lane?.crossing.length) this.applyCrossBarPlaceholders(g.staveNotes, lane.crossing)
        // ⚠️ A crossing FAN group's owners take the direction and NOTHING ELSE — no placeholder, or
        // `StaveNote.draw` would skip the very stem the joined line is anchored to (P3, and P1's
        // reason). `setStemDirection` clears any beam, which is exactly right here: they have none.
        for (const owners of lane?.fanned ?? []) {
          for (const i of owners.slots) g.staveNotes[i]?.setStemDirection(owners.stemDirection)
        }

        // ⚠️ A BEAM GROUP HAS ONE STEM DIRECTION — so the multi-voice re-assert below must be told
        // what the beam decided, not what the note was built with.
        //
        // `intendedStemDir` was captured before the beams existed, from each note's own override or
        // the voice's forced side. A beam then gives its whole group ONE direction (an `x` flip on
        // any member flips the beam, which is the only thing a beam can mean). Leave the map stale
        // and the re-assert drags the other members back — and `setStemDirection` CLEARS `note.beam`
        // on the way, so they draw their own stem AND a flag while the beam keeps drawing a stem for
        // them. Doubled stems on a beamed group, from one `x` press.
        //
        // ⚠️ …and the JOINED FAN'S OWNER is the one note that needs telling twice. It takes the
        // group's direction like everyone else, but it carries NO beam (see `buildBeams`), so
        // `hasBeam()` skips it here and the re-assert then drags it back to the voice's own side —
        // leaving it disagreeing with the beam it is joined to.
        const joinedFanOwners = new Set([
          ...fanJoins.flatMap(join => join.fans.map(i => g.staveNotes[i])),
          ...(lane?.fanned ?? []).flatMap(owners => owners.slots.map(i => g.staveNotes[i])),
        ])
        for (const staveNote of g.staveNotes) {
          if (intendedStemDir.has(staveNote) && (staveNote.hasBeam() || joinedFanOwners.has(staveNote))) {
            intendedStemDir.set(staveNote, staveNote.getStemDirection())
          }
        }
        return { voice, beams, clefNoteByBeat, fanJoins }
      })

      try {
        const vexVoices = built.map(b => b.voice)
        const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX()
        // Format into the note area MINUS whatever space the user authored into this bar — the
        // stave was already widened by it (MeasureLayout). Without the subtraction the notes
        // spread across the widened bar and the shift below pushes the last one through the
        // barline. Subtract BEFORE the 50px floor, or a large space clamps the music into the
        // left edge and then shifts it.
        const userSpacePx = measureUserSpacePx(pass.score, measure.id)
        const formatWidth = Math.max(noteAreaWidth - 15 - userSpacePx, 50)
        const formatter = new Formatter().joinVoices(vexVoices)
        formatter.format(vexVoices, formatWidth)
        applyLeadingSpaces(formatter, vexVoices, pass.score, measure)
        this.centerMeasureRests(vexVoices, stave)

        // VexFlow's StaveNote.format() rewrites same-tick multi-voice notes: it hides one
        // of two same-duration rests (renderOptions.draw = false), vertically nudges rests
        // that collide, REASSIGNS stem directions, and X-shifts a colliding notehead. All
        // fight our voice model, so undo them — re-enable every rest, restore each rest to its
        // captured lane line, restore each note's captured stem, and clear the auto X-shift.
        // setKeyLine/setStemDirection refresh the note (reset() rebuilds the notehead); the
        // corrections all land at draw time.
        if (multiVoice) {
          for (const sn of staveNotes) {
            if (sn.isRest()) {
              (sn.renderOptions as { draw?: boolean }).draw = true
              const line = intendedRestLine.get(sn)
              if (line !== undefined && sn.getKeyLine(0) !== line) sn.setKeyLine(0, line)
            } else {
              const dir = intendedStemDir.get(sn)
              if (dir !== undefined && sn.getStemDirection() !== dir) sn.setStemDirection(dir)
            }
            const xShift = intendedXShift.get(sn)
            if (xShift !== undefined && sn.getXShift() !== xShift) sn.setXShift(xShift)
          }
        }

        // Hand-nudged note offsets (client #12 — docs/note-offset-plan.md), AFTER the multi-voice
        // re-assert above: that loop restores each note's xShift to its captured pre-format value,
        // so an offset applied before it is wiped (gotcha 2). Here — post-re-assert, pre-draw — is
        // the one window that survives, and it covers BOTH the multi-voice and single-voice paths.
        this.applyNoteOffsets(sortedSlots, staveNotes, pass.score, stave)

        // Lengthen the stem of a FLAGGED tremolo note so its flag clears the strokes. Here for the
        // same reason the note offsets are: post-format and post-stem-re-assert (which re-runs
        // `setStemDirection` and would reset the extension), pre-draw. And it CANNOT be done at
        // build time — `hasFlag()` reads `!this.beam`, and the Beam objects do not exist yet when
        // NoteBuilder attaches the modifier, so every note about to be beamed still claims a flag.
        this.applyTremoloStemStretch(sortedSlots, staveNotes)
        // (No stem stretch for a TWO-NOTE tremolo — its strokes are not on a stem. See the note
        // where that pass used to be, above `buildTwoNoteTremoloBeams`.)
        // A FANNED slot's stem holds the beam levels, so it grows here — a WRITE, pre-draw; every
        // measurement the fan needs waits for `drawFannedBeams`, below.
        this.applyFanStemStretch(sortedSlots, staveNotes)

        for (const b of built) {
          b.voice.draw(this.context!, stave)
          for (const beam of b.beams) {
            beam.setContext(this.context!).draw()
          }
        }

        // Two-note tremolo strokes: after the stems and beams are drawn (the geometry they read is
        // only settled then), before registerSlotElements.
        for (const g of groups) this.drawTwoNoteTremolos(pass, g.slots, g.staveNotes, measure.number, staffIndex)

        // The fanned members and their feathered beam — same window, same reason (the stem geometry
        // is settled only once the stems and beams are drawn), and per LANE because the span reaches
        // to the next note in the SAME voice.
        for (let gi = 0; gi < groups.length; gi++) {
          const laneOfGroup = beamPlan?.lanes.get(laneKey(measure.number, staffIndex, groups[gi].voice))
          this.drawFannedBeams(
            pass, groups[gi].slots, groups[gi].staveNotes, measure.number, staffIndex,
            clefForBeat, built[gi].fanJoins,
            (laneOfGroup?.fanned ?? []).flatMap(owners => owners.slots),
          )
        }

        // Supporting ledger line for any whole/half rest a shift pushed off the staff
        // (VexFlow skips ledgers for rests — see drawRestLedgerLines).
        this.drawRestLedgerLines(sortedSlots, staveNotes, stave, measure, pass.score)

        // The voices' notes and the stave travel with it because the bracket's END is a fact about
        // what comes AFTER the group: where the next note in the same voice was formatted, or the end
        // of the bar when nothing follows. A tuplet cannot see either.
        this.drawAndRegisterTuplets(
          vexTuplets, tupletStaveNoteMap, measure, multiVoice,
          new Map(groups.map(g => [g.voice, g.staveNotes])), stave,
        )
        this.registerSlotElements(sortedSlots, staveNotes, measure, staffIndex)
        // Hidden rests (client #6) render gray. Recolor them via the DOM AFTER draw/register —
        // the established pattern (ghost notes, selection highlight). NOT VexFlow setStyle: that
        // leaks the stroke colour into the shared context and grays the rest of the score.
        this.recolorHiddenRests(sortedSlots, measure, pass.score)
        // Mixed dynamics (glyph + words): re-lay as per-run <tspan>s so the glyph keeps the big
        // music size and the words the text size. BEFORE registerDynamics so the bbox includes it.
        applyMixedDynamicRuns(pass, measure)
        registerDynamics(pass, measure)
        // Co-located dynamics: reposition onto one row (placement order, newest
        // right) AFTER registration so their bboxes are present to update.
        layoutCoLocatedDynamics(pass, dynamicGroups)
        // Hand-nudged dynamic offsets (client #8) LAST, so they compose on top of the
        // co-location row layout — see applyDynamicOffsets.
        applyDynamicOffsets(pass, measure, stave)
        // Tempo marks: system-level, so drawn once above the scope's top staff (NOT per
        // staff). Must come after the voices are drawn — a mark anchors to a note's
        // absolute X, which does not exist before formatting.
        drawTempoMarks(pass, measure, stave, staffIndex, sortedSlots, staveNotes)
        for (const b of built) this.registerBeams(b.beams, measure)

        // Mid-measure clefs are carried by the primary voice only.
        const primaryClefNotes = built[0]?.clefNoteByBeat ?? []
        this.registerMidMeasureClefs(primaryClefNotes, measure, staffIndex)

        // Extend clef regions with each inline clef's actual X position.
        for (const { clef: segClef, clefNote } of primaryClefNotes) {
          try {
            const box = clefNote.getBoundingBox()
            if (box) clefSegments.push({ fromX: box.x, clef: segClef })
          } catch (_e) { /* getBoundingBox may fail */ }
        }
        clefSegments.sort((a, b) => a.fromX - b.fromX)
      } catch (error) {
        console.error(`  ❌ Could not render measure ${measure.number}: ${error}`)
        console.error(`  - Measure data:`, JSON.stringify(measure, null, 2))
      }
    }

    // **Tier 2 geometry.** The staff's own geometry was registered by tier 1, which cannot know
    // this: an inline clef's X comes from the FORMATTED voice, and formatting is part of the draw.
    //
    // That is the right place for it. `clefSegments` exist solely to answer "which clef governs
    // this PIXEL?" (ElementRegistry.clefAtX → pixelToPitch), and pixels only exist where you can
    // look. A culled measure is never under the mouse, and the registry already falls back to the
    // measure's opening clef when the segments are absent.
    if (clefSegments.length > 1) {
      this.elementRegistry.setClefSegments(measure.number, staffIndex, clefSegments)
    }

    return stave
  }

  /**
   * Draw the supporting ledger line for any WHOLE or HALF rest (incl. dotted / whole-measure)
   * that a manual vertical shift (engraving client #5) pushed outside the staff. Those rests
   * are line-attached (hang from / sit on a line), so off-staff they need the ONE line they
   * attach to — at their key line. Shorter rests are not line-attached and get nothing.
   * VexFlow's `StaveNote.drawLedgerLines()` hard-returns for rests (no noteheads → no anchor
   * X), so we draw it ourselves, centred on the rest glyph and styled like VexFlow's ledgers.
   * `slots` and `staveNotes` are parallel (same order). See docs/rest-shift-plan.md §10.
   */
  private drawRestLedgerLines(slots: ChordRest[], staveNotes: StaveNote[], stave: Stave, measure: Measure, score: Score): void {
    const ctx = this.context
    if (!ctx) return
    const PAD = 2 // px the ledger overhangs the rest glyph on each side
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const sn = staveNotes[i]
      if (!slot || slot.type !== 'rest' || !sn) continue
      // Skip rests VexFlow merged away (renderOptions.draw=false on a co-located duplicate).
      if ((sn.renderOptions as { draw?: boolean }).draw === false) continue
      const line = restSupportingLedgerLine(slot.duration, !!slot.isMeasureRest, sn.getKeyLine(0))
      if (line === null) continue

      // Span only the rest GLYPH (head begin→end), NOT the note's bounding box — the latter
      // includes the augmentation dot, which would stretch the ledger out under the dot.
      const xBegin = sn.getNoteHeadBeginX()
      const xEnd = sn.getNoteHeadEndX()
      const cx = (xBegin + xEnd) / 2
      const halfW = (xEnd - xBegin) / 2 + PAD

      // Keep the ledger in lockstep with a hidden rest: tint it the same gray. The save/restore
      // around the stroke keeps this style local — it does NOT leak into later drawing.
      const hidden = restHiddenOf(score, restPositionKey(measure.id, slot.voice ?? 0, slot.beat, slot.staffId))
      const ledgerStyle = hidden
        ? { ...stave.getDefaultLedgerLineStyle(), strokeStyle: HIDDEN_REST_COLOR }
        : stave.getDefaultLedgerLineStyle()
      ctx.save()
      stave.applyStyle(ctx, ledgerStyle)
      const y = stave.getYForNote(line)
      ctx.beginPath()
      ctx.moveTo(cx - halfW, y)
      ctx.lineTo(cx + halfW, y)
      ctx.stroke()
      ctx.restore()
    }
  }

  /**
   * Apply each note's hand-nudged horizontal offset (client #12 — docs/note-offset-plan.md) as a
   * post-format / pre-draw `StaveNote.setXShift`, which moves the note's *reported geometry* so its
   * beam, stem, ties, slurs, dots and hit-testing (`headX`) all recompute around the new position —
   * the reason we shift the note and not the SVG group (a translate would leave the beam and tie
   * anchors behind). `slots` and `staveNotes` are parallel (same order).
   *
   * The offset is **added** to the note's current xShift, not set absolutely: the multi-voice
   * re-assert has already restored it to the captured value (0 for a normal note), and a measure
   * rest carries its centring here too — adding preserves both. An OFFSET must not change spacing,
   * so this runs after `format()` has already reserved the column at the un-shifted position.
   *
   * VexFlow's `getModifierStartXY` folds `xShift` into the note's dots (RIGHT branch) but NOT its
   * accidental (LEFT) or articulations (ABOVE/BELOW), so those two are handled explicitly below.
   *
   * ⚠️ **NOT via `Modifier.setXShift`** — it is not the plain setter `StaveNote` inherits from
   * `Element`; it **resets `xShift` to 0 and NEGATES it for a LEFT modifier** (a semantic "shift away
   * from the note" helper). Feeding it an accidental sent the glyph the OPPOSITE way and wiped its
   * formatted left-stacking. For the accidental we set the raw `xShift` field, which `Element.renderText`
   * draws at `x + xShift`.
   *
   * Articulations, however, cannot be moved via `xShift` at all: `Articulation.draw()` re-centers any
   * within-staff mark with `setOrigin(0.5, 0.5)`, and `Element.setOriginX` OVERWRITES `xShift`
   * (recomputed from `this.x`) — so a manual shift is silently discarded (the old bug: an ABOVE accent,
   * which snaps inside the staff, never followed; a BELOW one, outside, did). We instead fold the
   * offset into the value both the placement and the re-centering read: this note's ABOVE/BELOW
   * `getModifierStartXY` base x. See docs/note-offset-plan.md.
   */
  private applyNoteOffsets(slots: ChordRest[], staveNotes: StaveNote[], score: Score, stave: Stave): void {
    const { ABOVE, BELOW } = Modifier.Position
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const off = noteOffsetOverrideOf(score, slot.id)
      const px = off && off.x !== 0 ? staffSpacesToPixels(off.x, stave) : 0
      // Stem-side articulations align to the stem (modern) rather than the notehead (default).
      const stemAlign = slot.type === 'chord' && slot.articulationStemAlign === true && !!slot.articulations?.length
      if (px === 0 && !stemAlign) continue
      const sn = staveNotes[i]
      if (px !== 0) {
        sn.setXShift(sn.getXShift() + px) // StaveNote: Element.setXShift is a plain additive setter
        // Accidentals sit LEFT; VexFlow's getModifierStartXY does not fold xShift into the LEFT
        // branch, so shift the accidental glyph directly (this path works — the glyph has no
        // draw-time re-centering to fight).
        for (const mod of sn.getModifiers()) {
          if (mod instanceof Accidental) {
            (mod as unknown as { xShift: number }).xShift += px
          }
        }
      }
      // Articulations sit ABOVE/BELOW. Two VexFlow facts make shifting THEIR xShift useless:
      //   1. getModifierStartXY's ABOVE/BELOW branch returns `getAbsoluteX() + glyphWidth/2` and
      //      does NOT add the note's xShift (unlike the dots' RIGHT branch), so the base is the
      //      UNshifted note center.
      //   2. Articulation.draw() re-centers any within-staff mark with `setOrigin(0.5, 0.5)`, and
      //      Element.setOriginX OVERWRITES xShift (recomputed from this.x) — discarding a manual
      //      shift (repro: an ABOVE accent never followed; a BELOW one did — docs/note-offset-plan.md).
      // So we drive both effects through the value both reads — this note's ABOVE/BELOW base x:
      //   • note offset  → add `px` (match the px the notehead moved by), for BOTH sides.
      //   • stem-align   → for the STEM side only, snap to `getStemX()` (the stem centerline, which
      //                    already includes xShift, so the offset is folded in there too).
      // Fresh StaveNote per render ⇒ no accumulation.
      if ((px !== 0 || stemAlign) && sn.getModifiers().some(m => m instanceof Articulation)) {
        const origStartXY = sn.getModifierStartXY.bind(sn)
        ;(sn as unknown as { getModifierStartXY: typeof origStartXY }).getModifierStartXY = (position, index, options) => {
          const r = origStartXY(position, index, options)
          if (position === ABOVE || position === BELOW) {
            const stemDir = sn.getStemDirection()
            const isStemSide = (position === ABOVE && stemDir === 1) || (position === BELOW && stemDir === -1)
            // A stemless note (whole note) has no stem to align to — keep notehead alignment there.
            if (stemAlign && isStemSide && sn.hasStem()) r.x = sn.getStemX()
            else r.x += px
          }
          return r
        }
      }
      if (px !== 0 || stemAlign) dbg(`[NoteOffset] slot ${slot.id} px=${px.toFixed(1)} stemAlign=${stemAlign}`)
    }
  }

  /**
   * Recolor hidden rests (client #6) gray by editing their rendered SVG, the same post-draw
   * DOM approach as the ghost note and the selection highlight — NOT VexFlow `setStyle`, which
   * mutates the shared drawing context and leaks the color onto everything drawn afterwards.
   * Each rest is a single glyph in its own `vf-stavenote` group, so coloring every `text`/`path`
   * in the group tints the whole rest (incl. augmentation dots) and nothing else. The rest stays
   * registered/hit-testable; the selection highlight (voice color) runs later and overrides this.
   * Must be called after `registerSlotElements` (the staveNoteMap drives `getStaveNoteSVGGroup`).
   */
  private recolorHiddenRests(slots: ChordRest[], measure: Measure, score: Score): void {
    for (const slot of slots) {
      if (slot.type !== 'rest') continue
      if (!restHiddenOf(score, restPositionKey(measure.id, slot.voice ?? 0, slot.beat, slot.staffId))) continue
      const groupInfo = this.getStaveNoteSVGGroup(slot.id)
      if (!groupInfo) continue
      groupInfo.group.querySelectorAll('text, path').forEach((el) => {
        const svgEl = el as SVGElement
        svgEl.setAttribute('fill', HIDDEN_REST_COLOR)
        svgEl.style.fill = HIDDEN_REST_COLOR
      })
    }
  }

  /**
   * **Tier 1** (docs/render-performance-plan.md §7) — construct the Stave and its modifiers.
   *
   * Nothing here touches the drawing context, and that is the point, not an accident: the returned
   * Stave already knows its full geometry (`getNoteStartX`, `getYForLine`, `getBoundingBox`) purely
   * from the modifiers added below. That is what will let P6 cull a measure's **draw** without
   * losing its **position** — the registry can be populated for a measure nobody paints.
   *
   * The property belongs to VexFlow, not to us, so it is pinned by `staveGeometry.test.ts` rather
   * than trusted.
   */
  private buildStave(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    cautionaryEndTimeSig?: TimeSignature,
  ): Stave {
    const stave = new Stave(x, y, width)
    stave.setDefaultLedgerLineStyle(LEDGER_LINE_STYLE)

    if (measure.number === 1 || isFirstInLine) {
      // Line start: full-size clef showing the effective clef for this measure
      stave.addClef(clef)
    } else if (hasClefChange) {
      // Mid-line clef change: smaller clef at the start of the measure it applies to
      stave.addClef(clef, 'small')
    }
    if (drawsTimeSignature(measure)) {
      stave.addTimeSignature(timeSignatureVexKey(measure.timeSignature))
    }
    if (cautionaryEndClef) {
      // Cautionary clef before a line break: warns of the next line's new clef.
      stave.addEndClef(cautionaryEndClef, 'small')
    }
    if (cautionaryEndTimeSig) {
      // Cautionary time signature before a line break: warns of the next line's new
      // meter. Drawn full size (no 'small') and placed after the final barline.
      stave.addEndTimeSignature(timeSignatureVexKey(cautionaryEndTimeSig))
    }

    return stave
  }

  /**
   * **Tier 1** — the measure's box: where it is, not what is in it.
   *
   * Reads only the Stave, so it is correct for a measure that is never drawn.
   *
   * measureBounds stays keyed by measure.number (multi-staff Phase 2 deliberately did NOT split it
   * per staff): its X fields are shared across staves (barlines align) and its measureY is the
   * system top (staff 0). That's exactly what beatToPixelX (X only) and pixelToMeasure (which
   * measure/system) need — per-staff Y lives in staffGeometries instead. So only staff 0 writes it,
   * leaving the systemTop reference Y intact for the whole system.
   */
  private recordMeasureBounds(
    stave: Stave,
    measure: Measure,
    x: number,
    y: number,
    width: number,
    staffIndex: number,
  ): void {
    if (staffIndex !== 0) return
    this.measureBounds.set(measure.number, {
      measureX: x,
      measureY: y,
      measureWidth: width,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
    })
  }

  /**
   * Re-centre a whole-bar rest on the bar's **note area** — VexFlow centres it on the box the
   * formatter was handed, and that box is not the bar.
   *
   * `alignCenter` (NoteBuilder) makes VexFlow put the rest at `noteStartX + Stave.padding +
   * formatWidth/2`. The bar's real centre is `noteStartX + noteAreaWidth/2`, and `formatWidth` is
   * deliberately NOT the note area — it is `noteAreaWidth − 15 − userSpace`, floored at 50, so the
   * music has room to breathe inside the barlines. The two centres therefore differ by
   * `Stave.padding + (formatWidth − noteAreaWidth)/2` ≈ **4px to the right**, at every bar width.
   *
   * That was always there and never showed: 4px in a 300px bar is nothing. It became visible the
   * moment empty bars got narrow enough to shrink out of a neighbour's way (~87px and below), where
   * the same 4px reads as "the bar shrank from the right". Below a 65px note area the `Math.max(…,
   * 50)` floor takes over and the error grows without limit.
   *
   * Corrected against the note's OWN reported position rather than by subtracting the constants
   * back out — self-checking, and it stays right if the format box or the padding metric ever
   * changes. `getAbsoluteX()` excludes `xShift`, so an authored leading space still pushes the rest
   * along on top of the centring instead of being cancelled by it.
   *
   * Centred on the note area, i.e. AFTER any clef/meter — a line-opening empty bar centres its rest
   * in the space left over, not between the barlines. That is what VexFlow was already aiming at
   * and what Gould describes; the alternative (centre between the barlines) would push the rest
   * left, under the clef, on every system-opening bar.
   */
  private centerMeasureRests(voices: Voice[], stave: Stave): void {
    const areaCenter = (stave.getNoteStartX() + stave.getNoteEndX()) / 2
    for (const voice of voices) {
      for (const tickable of voice.getTickables()) {
        if (!tickable.isCenterAligned()) continue
        const note = tickable as StaveNote
        // `getAbsoluteX()` reads the stave, and the voice does not set it on its tickables until
        // draw time. Setting it here is what draw would do a moment later, verbatim.
        note.setStave(stave)
        const center = note.getAbsoluteX() + note.getGlyphWidth() / 2
        note.setCenterXShift(note.getCenterXShift() + (areaCenter - center))
      }
    }
  }

  /** **Tier 2** — paint the staff lines. The only part of a stave that a culled measure skips. */
  private drawStave(stave: Stave): void {
    // VexFlow's Stem.draw() leaves ctx.lineWidth at Stem.WIDTH (1.5) and Stave.draw()
    // strokes its lines with whatever width is current — so a prior measure's stems
    // would thicken this staff. Pin it back to 1 before drawing the staff lines.
    this.context!.setLineWidth?.(1)
    stave.setContext(this.context!).draw()
  }

  private buildVexTuplets(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
    clef: Clef,
    multiVoice: boolean,
  ): { vexTuplets: ScoreTuplet[]; tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }> } {
    const tupletStaveNoteMap = new Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }>()

    for (let idx = 0; idx < sortedSlots.length && idx < staveNotes.length; idx++) {
      const slot = sortedSlots[idx]
      if (slot.tupletId) {
        const tupletData = (measure.tuplets || []).find(t => t.id === slot.tupletId)
        if (tupletData) {
          if (!tupletStaveNoteMap.has(slot.tupletId)) {
            // A tuplet lives in exactly one voice, so the first slot's voice is the
            // tuplet's voice (0 = primary).
            tupletStaveNoteMap.set(slot.tupletId, { staveNotes: [], tuplet: tupletData, voice: slot.voice ?? 0 })
          }
          tupletStaveNoteMap.get(slot.tupletId)!.staveNotes.push(staveNotes[idx])
        }
      }
    }

    const vexTuplets: ScoreTuplet[] = []
    for (const [_tupletId, { staveNotes: tupletStaveNotes, tuplet: tupletData, voice }] of tupletStaveNoteMap) {
      if (tupletStaveNotes.length >= 2) {
        try {
          // An explicit placement override (e.g. from the `x` flip) always wins.
          // Otherwise: with multiple voices the bracket follows the voice's stem
          // side (V1 stems up → above, lower voices stems down → below) so the two
          // voices' brackets spread to the outer edges instead of colliding in the
          // middle. With a single voice, fall back to the stem-derived default.
          const location = resolveTupletLocation(
            tupletData.placement,
            multiVoice,
            voice,
            this.calculateTupletLocation(tupletStaveNotes, clef)
          )
          // `bracketed` is NOT decided here: the rule asks whether the group is beamed, and the beams
          // do not exist yet at construction time (a note's `hasBeam()` is false until its Beam is
          // built). It is set in the pre-draw pass below, which runs after they are — and VexFlow
          // reads the option at draw time, so setting it late is not a workaround, it is when the
          // answer becomes knowable. Same for the mark's text.
          const vexTuplet = new ScoreTuplet(tupletStaveNotes, {
            numNotes: tupletData.numNotes,
            notesOccupied: tupletData.notesOccupied,
            location,
          })
          vexTuplets.push(vexTuplet)
        } catch (tupletError) {
          console.warn(`Could not create tuplet: ${tupletError}`)
        }
      }
    }

    return { vexTuplets, tupletStaveNoteMap }
  }

  /**
   * This lane's beams — plus the JOINED FAN GROUPS, which get no `Beam` at all.
   *
   * ⭐ A group holding a fanned slot is the fan's (docs/fan-beam-join-plan.md P1): its beam is drawn
   * by hand from end to end, because "VexFlow's beam meets our ramp at the shared stem" would be a
   * polyline of three slopes where a beam group must be one straight edge, and it would put two
   * owners on one stem tip. One line, one owner, one pass. So all this does for such a group is
   * settle the stem direction and suppress the prefix's own stems and flags; {@link drawFannedBeams}
   * draws it once the geometry is real.
   */
  private buildBeams(
    staveNotes: StaveNote[],
    sortedSlots: ChordRest[],
    meter: MeterInfo,
    clefForBeat: (beat: Fraction) => Clef,
    forcedStemDirection?: number,
    /** This lane's groups, when a cross-barline plan owns them (docs/cross-barline-beaming-plan.md).
     *  A lane whose barline is open cannot be grouped from its own slots alone — a leading
     *  `continue` reads as an orphan — so the plan's answer replaces the per-bar one. */
    inBarGroups?: number[][],
  ): { beams: Beam[]; fanJoins: FanJoin[] } {
    const groupIndices = inBarGroups ?? computeBeamGroups(sortedSlots, meter)
    const beams: Beam[] = []
    const fanJoins: FanJoin[] = []

    for (const indices of groupIndices) {
      try {
        const groupSlots = indices.map(i => sortedSlots[i])
        // A beam group lies within one clef region; use the clef at its first slot.
        const groupClef = groupSlots.length ? clefForBeat(groupSlots[0].beat) : 'treble'

        // ⭐ THE JOINED FAN — or fanS: P2 puts a whole CHAIN of them on one beam, each joined to the
        // one before it, and the fans are always the group's TAIL (nothing but a fan may follow a
        // fan), so everything in front of the first one is the prefix.
        const fans = indices.filter(i => { const slot = sortedSlots[i]; return slot.type === 'chord' && !!slot.fan })
        if (fans.length) {
          // Rests are dropped: a `beamOver` rest is inside the span but has no stem to aim, and the
          // line simply runs over it.
          const prefix = indices.filter(i => i < fans[0] && sortedSlots[i].type === 'chord')
          // A group of one is not a beam. The grouper drops those already; this is the same rule for
          // a group the renderer sees through the cross-barline plan's own `inBarGroups`.
          if (prefix.length + fans.length < 2) continue
          // Every fan's OWNER votes on the direction with its own notes — they are members of this
          // group, and a beam group has one direction.
          // ⏭ Open: whether the fans' MEMBER pitches vote too. They are not in `slot.notes`, so
          // `calculateBeamGroupStemDirection` cannot see them today.
          const stemDirection = this.calculateBeamGroupStemDirection(groupSlots, groupClef, forcedStemDirection)
          for (const i of prefix) {
            // The placeholder goes on AFTER the direction — `setStemDirection` CLEARS `note.beam`.
            staveNotes[i].setStemDirection(stemDirection)
            staveNotes[i].setBeam(PLACEHOLDER_BEAM)
          }
          // ⚠️ THE OWNERS ARE LEFT ALONE, and that is not a shortcut. `StaveNote.draw` skips the stem
          // whenever `note.beam` is set, so a placeholder there would delete the one stem this whole
          // feature anchors its line to; and `getStemExtension()` answers `stemBeamExtension` once
          // `beam` is set, which MOVES the tip and would make a joined fan sit at a different height
          // from an unjoined one. Nothing is bought either way — `NoteBuilder` already builds a
          // fanned slot as a plain quarter, so there is no flag to suppress.
          for (const i of fans) staveNotes[i].setStemDirection(stemDirection)
          fanJoins.push({ prefix, fans })
          continue
        }

        const beamStemDirection = this.calculateBeamGroupStemDirection(groupSlots, groupClef, forcedStemDirection)
        const groupNotes = indices.map(i => staveNotes[i])
        for (const staveNote of groupNotes) {
          staveNote.setStemDirection(beamStemDirection)
        }
        const beam = new Beam(groupNotes)
        // Secondary beam breaks — VexFlow's own primitive, no geometry of ours. The index translation
        // (our flag is on the note the break is IN FRONT OF; VexFlow wants the note the beam ends
        // AFTER) lives in the pure module beside the grouping.
        const breaks = secondaryBreakIndices(groupSlots)
        if (breaks.length) beam.breakSecondaryAt(breaks)
        beams.push(beam)
      } catch (beamError) {
        console.warn(`Could not create beam: ${beamError}`)
      }
    }

    return { beams, fanJoins }
  }

  /**
   * The notes of this bar that are beamed **across a barline**: give them the group's shared stem
   * direction and a placeholder beam, so they format and draw with no flag and no stem. The real
   * `Beam` is built over both bars in {@link drawCrossBarBeams}, once every bar has been drawn.
   *
   * Order matters twice, and both are silent if got wrong:
   *  - `setStemDirection` **clears** `note.beam` (VexFlow's `StemmableNote`), so the direction goes
   *    on first and the placeholder second;
   *  - this runs BEFORE `formatter.format`, because `preFormat` reserves a glyph-width for a flagged
   *    stem-up note, and a beamed note must not pay for a flag it will not draw.
   */
  private applyCrossBarPlaceholders(staveNotes: StaveNote[], crossing: LaneBeamPlan['crossing']): void {
    for (const group of crossing) {
      for (const i of group.slots) {
        const staveNote = staveNotes[i]
        if (!staveNote) continue
        staveNote.setStemDirection(group.stemDirection)
        staveNote.setBeam(PLACEHOLDER_BEAM)
      }
    }
  }

  /**
   * **The post-measure pass** — one fragment per {@link CrossBarSide}, drawn outside every measure
   * group. It belongs to no bar, exactly as a tie or a slur does.
   *
   * Here and not in a bar's own render, because top-level content is torn down every render
   * (`clearForRender`) while measure groups are **reused**: a beam rebuilt only when its bars are
   * re-engraved would vanish on any pass that reuses them — an edit ten bars away, a scroll, a
   * staff-spacing drag — leaving both bars' notes standing flagless *and* stemless. `staveNoteMap` is
   * replayed for a reused measure, so this pass can rebuild a beam over bars nobody redrew.
   *
   * A same-line side is one whole `Beam`, as before. A side open at a system break also hangs a
   * half-beam stub over its open end; a side of a single note has no `Beam` at all (the constructor
   * throws on one note) and draws the note's own stem plus the stub (docs/cross-barline-beaming-plan.md).
   */
  private drawCrossBarBeams(pass: RenderPass, joins: CrossBarJoin[]): void {
    for (const join of joins) {
      for (const side of join.sides) {
        const staveNotes = side.members
          .map(member => pass.staveNoteMap.get(member.lookupId)?.staveNote)
          .filter((staveNote): staveNote is StaveNote => staveNote !== undefined)
        // A bar that was not painted contributes no StaveNote. A side draws iff all its own bars are
        // drawn (`side.drawable`), and this is the runtime proof of it — a fragment over half a side
        // would draw stems in mid-air.
        if (staveNotes.length !== side.members.length) continue

        try {
          if (staveNotes.length >= 2) this.drawCrossBarSideBeam(pass, side, staveNotes)
          else this.drawCrossBarLoneFragment(pass, side, staveNotes[0])
        } catch (beamError) {
          console.warn(`Could not draw cross-barline beam: ${beamError}`)
        }
      }
    }
  }

  /** A side of two or more notes: the real `Beam` (VexFlow draws stems, slope and beam), plus a
   *  half-beam stub past the edge note's stem at each open end. */
  private drawCrossBarSideBeam(pass: RenderPass, side: CrossBarSide, staveNotes: StaveNote[]): void {
    const beam = new Beam(staveNotes)
    if (side.secondaryBreaks.length) beam.breakSecondaryAt(side.secondaryBreaks)
    beam.setContext(pass.context).draw()

    // The overhang continues the group's own slope and levels — `drawBeamLines`' arithmetic, with the
    // line's `end` a fixed stub instead of the next notehead (beam.js:583-612). Every method it reads
    // is public. `getStemX() - Stem.WIDTH / 2` is the x VexFlow itself ends a beam line at (beam.js:515).
    const firstStemX = staveNotes[0].getStemX()
    const beamThickness = beam.renderOptions.beamWidth * beam.getStemDirection()
    const beamY0 = beam.getBeamYToDraw()
    const overhang = (edge: StaveNote, direction: number, levels: number) => {
      const startX = edge.getStemX() - Stem.WIDTH / 2
      const endX = this.crossSystemOverhangEndX(side, startX, direction)
      for (let k = 0; k < levels; k++) {
        const beamY = beamY0 + k * beamThickness * 1.5
        const startY = beam.getSlopeY(startX, firstStemX, beamY, beam.slope)
        const endY = beam.getSlopeY(endX, firstStemX, beamY, beam.slope)
        this.fillBeamQuad(pass.context, startX, startY, endX, endY, beamThickness)
      }
    }
    if (side.openLeft) overhang(staveNotes[0], -1, side.crossingLeft ?? 0)
    if (side.openRight) overhang(staveNotes[staveNotes.length - 1], 1, side.crossingRight ?? 0)

    this.registerCrossBarBeam(beam, side.measures[0])
  }

  /**
   * Where a cross-system overhang ends, in x. Left (line start, `direction < 0`) is a short fixed stub
   * projecting from the first note. Right (line end, `direction > 0`) must **cross the closing barline
   * into the margin**, and how far that is varies with justification — so it is computed to the side's
   * last measure's barline (`measureX + measureWidth`) plus a margin overshoot, not a fixed length; a
   * fixed stub is the fallback only when that measure's bounds are unavailable.
   */
  private crossSystemOverhangEndX(side: CrossBarSide, startX: number, direction: number): number {
    if (direction < 0) return startX - crossSystemStub(-1)
    const lastMeasure = side.measures[side.measures.length - 1]
    const bounds = this.measureBounds.get(lastMeasure)
    if (!bounds) return startX + crossSystemStub(1)
    const barlineX = bounds.measureX + bounds.measureWidth
    return Math.max(barlineX, startX) + CROSS_SYSTEM_BEAM_MARGIN
  }

  /**
   * A side of exactly one note — `♪ | ♪`, the case `new Beam()` throws on. Its placeholder already
   * suppressed the flag and the stem, so we draw the note's OWN `Stem` (never a hand-drawn line: the
   * selection highlight resolves a beamed stem by the `Stem` object's SVG group, `getStaveNoteSVGGroup`),
   * flat at its natural tip, plus a flat stub of the note's own beam count pointing at the break.
   */
  private drawCrossBarLoneFragment(pass: RenderPass, side: CrossBarSide, note: StaveNote): void {
    const stem = note.getStem()
    if (!stem) return
    stem.adjustHeightForBeam() // swap the flag's height fudge for the beam's; the tip does not move.
    stem.setContext(pass.context).drawWithStyle()

    const levels = side.members[0].beamCount
    const beamThickness = CROSS_SYSTEM_BEAM_WIDTH * note.getStemDirection()
    const beamY0 = stem.getExtents().topY // the stem tip, flat — a lone note has no slope to continue.
    const startX = note.getStemX() - Stem.WIDTH / 2
    // Left is the short fixed stub; right runs to the barline (see crossSystemOverhangEndX).
    const leftEndX = this.crossSystemOverhangEndX(side, startX, -1)
    const rightEndX = this.crossSystemOverhangEndX(side, startX, 1)
    let minY = Infinity, maxY = -Infinity
    const stub = (endX: number) => {
      for (let k = 0; k < levels; k++) {
        const beamY = beamY0 + k * beamThickness * 1.5
        this.fillBeamQuad(pass.context, startX, beamY, endX, beamY, beamThickness)
        minY = Math.min(minY, beamY, beamY + beamThickness)
        maxY = Math.max(maxY, beamY, beamY + beamThickness)
      }
    }
    if (side.openLeft) stub(leftEndX)
    if (side.openRight) stub(rightEndX)

    // A lone side has no `Beam` to ask for a bbox — build it from the stub ends. (x spans both
    // directions if the note is open on both, which only a middle-of-three-systems lone note is.)
    const left = side.openLeft ? leftEndX : startX
    const right = side.openRight ? rightEndX : startX
    if (minY <= maxY) {
      this.elementRegistry.add({
        type: 'beam',
        measure: side.measures[0],
        bbox: { x: left, y: minY, width: right - left, height: maxY - minY },
      })
    }
  }

  /** One beam quad, from `drawBeamLines`' vertices (beam.js:596-604): top edge start→end, thickness down. */
  private fillBeamQuad(ctx: SVGContext, startX: number, startY: number, endX: number, endY: number, thickness: number): void {
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(startX, startY + thickness)
    ctx.lineTo(endX, endY + thickness)
    ctx.lineTo(endX, endY)
    ctx.closePath()
    ctx.fill()
  }

  /** Hit-testing entry for a joined beam, filed under the bar its side starts in. Added after every
   *  measure's registry slice was captured, so it is re-added fresh each render and never lands in
   *  a snapshot that could replay it twice. */
  private registerCrossBarBeam(beam: Beam, measure: number): void {
    try {
      const box = beam.getBoundingBox()
      if (box) {
        this.elementRegistry.add({
          type: 'beam',
          measure,
          bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
        })
      }
    } catch (_e) { /* getBoundingBox may fail */ }
  }

  private drawAndRegisterTuplets(
    vexTuplets: ScoreTuplet[],
    tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }>,
    measure: Measure,
    multiVoice: boolean,
    /** Every voice's notes, in engraved order — for finding what follows a tuplet. */
    voiceNotes: Map<number, StaveNote[]>,
    stave: Stave,
  ): void {
    /**
     * Where the bracket's right end goes, or undefined to leave it at the last notehead.
     *
     * `division` — the default — ends the bracket where the group's TIME ends, which on a formatted
     * stave is where the next note was placed: the formatter has already turned "the end of this
     * duration" into an x, and reading it back is more honest than re-deriving it from beats. Nothing
     * following in this voice means the group runs to the end of the bar, so the bracket does too.
     *
     * `beforeNext` stops a little short of that note, which is the same line with a gap in it.
     */
    const BRACKET_END_GAP = 6
    const bracketEndX = (tupletData: Tuplet, voice: number, lastNote: StaveNote): number | undefined => {
      const mode = tupletBracketEnd(tupletData)
      if (mode === 'lastNote') return undefined
      const lane = voiceNotes.get(voice) ?? []
      const next = lane[lane.indexOf(lastNote) + 1]
      if (!next) return stave.getNoteEndX() - BRACKET_END_GAP
      return mode === 'division' ? next.getAbsoluteX() : next.getAbsoluteX() - BRACKET_END_GAP
    }

    for (const vexTuplet of vexTuplets) {
      try {
        const tupletNotes = vexTuplet.getNotes() as StaveNote[]
        if (tupletNotes.length === 0) continue

        for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData, voice }] of tupletStaveNoteMap) {
          if (!tStaveNotes.includes(tupletNotes[0])) continue

          const vt = vexTuplet as unknown as {
            notes: StaveNote[]
            options: { location?: number; bracketed?: boolean; yOffset?: number; textYOffset?: number }
            textElement?: { getHeight?: () => number; setText?: (text: string) => void }
          }
          const notes = vt.notes
          const firstNote = notes?.[0]
          const lastNote = notes?.[notes.length - 1]
          if (!firstNote || !lastNote) break

          const location = (vt.options?.location ?? 1) as 1 | -1

          // THE FORMAT, applied — the first two of its three fields (bracketEnd still to come).
          //
          // Both answers come from the model via a resolver, never from the field: a tuplet that
          // stores no format is the ordinary case, and "absent" is an instruction (engrave by the
          // rules), not a gap. `Ctrl+3` and the dialog therefore arrive at the same code.
          //
          // The bracket's rule needs the beams, which is why this is here and not at construction:
          // `hasBeam()` only answers once the Beam objects exist. VexFlow's own default happens to be
          // the same rule; we state it ourselves so the model's `always`/`never` can override it and
          // so the rule lives in one place we own.
          const beamed = notes.every(n => n.hasBeam?.() ?? false)
          const bracketed = tupletBracketed(tupletData, beamed)
          vt.options.bracketed = bracketed

          // The MARK is ours, not VexFlow's: it can print a bare number or a ratio, but not "ratio +
          // note" and not nothing at all, and its automatic choice is a heuristic we replaced
          // (autoNumberStyle). Same string the GHOST draws — one function, so a preview cannot
          // promise a mark the page will not print.
          // The bar's meter and the group's start go WITH the mark: with no stored style the rule is
          // "a bare number when the meter already says what it is in the time of", so the same
          // tuplet prints `2` in 6/8 and `2:3` in 4/4 — and the ghost, asking the same function with
          // the hovered bar, showed exactly that before the click.
          vexTuplet.setMarkRuns(
            tupletMarkRuns(tupletData, tupletData.numberStyle, {
              meter: measure.timeSignature,
              beat: tupletData.startBeat,
            }),
          )

          // …and where the bracket stops. Only meaningful with a bracket, but set either way: an
          // unbracketed tuplet's width still centres the number, and a number that drifted when the
          // bracket was switched off would be a second rule nobody asked for.
          vexTuplet.bracketEndX = bracketed ? bracketEndX(tupletData, voice, lastNote) : undefined

          // A bracket flipped to the INNER side (toward the other voice) would be shoved
          // to the far edge of the system by VexFlow's staff-edge clamp; nudge it back
          // next to its own notes via yOffset. Must be set BEFORE draw(), which reads it.
          const stems: TupletNoteStem[] = notes.map(n => {
            const ext = (n.getStemExtents?.() ?? { topY: 0, baseY: 0 }) as { topY: number; baseY: number }
            return { stemUp: n.getStemDirection?.() === 1, topY: ext.topY, baseY: ext.baseY }
          })
          const flipOffset = innerFlipTupletYOffset(
            stems, location, voice, multiVoice, vexTuplet.getYPosition()
          )
          if (flipOffset !== 0) vt.options.yOffset = (vt.options.yOffset ?? 0) + flipOffset

          vexTuplet.setContext(this.context!).draw()

          // Use VexFlow's OWN post-draw geometry so the registered hit-box matches the
          // drawn bracket exactly. VexFlow draws the horizontal bracket line at
          // getYPosition(), the legs hanging toward the notes (length location*10), and
          // the number on the outer side. Our previous stem-extent estimate (fixed
          // gap/height) drifted off the real bracket — badly in multi-voice / flipped
          // tuplets, where VexFlow anchors a top bracket above the whole system.
          const bracketPadding = 5
          const xStart = bracketed ? firstNote.getTieLeftX() - bracketPadding : firstNote.getStemX()
          // The END is read back off the tuplet, not recomputed from the last note: with a
          // `division` or `beforeNext` bracket the line runs PAST that note, and a hit-box measured
          // from the notehead would stop where the ink does not. `width` is what draw() just used.
          const xEnd = xStart + vexTuplet.width
          const tupletWidth = xEnd - xStart

          const bracketLineY = vexTuplet.getYPosition() // the horizontal bracket line
          const bracketLegLength = 10
          const numberHeight = vt.textElement?.getHeight?.() ?? 14
          // The number sits on the outer side of the line, the legs hang inward. Cover
          // both (plus a little padding) so a click anywhere on the visible bracket or
          // its number registers.
          const vPad = 6
          const bboxY = location === 1
            ? bracketLineY - numberHeight - vPad
            : bracketLineY - bracketLegLength - vPad
          const bboxHeight = numberHeight + bracketLegLength + 2 * vPad

          const tupletGeometry: TupletGeometry = {
            x: xStart,
            y: bracketLineY,
            width: tupletWidth,
            bracketed,
            location,
            bracketLegLength,
            bracketThickness: 1,
            bracketPadding,
            notationCenterX: xStart + tupletWidth / 2,
            textYOffset: vt.options?.textYOffset ?? 0,
            yOffset: vt.options?.yOffset ?? 0,
          }

          this.elementRegistry.add({
            type: 'tuplet',
            tupletId,
            measure: measure.number,
            startBeat: fracToNumber(tupletData.startBeat),
            numNotes: tupletData.numNotes,
            bbox: { x: xStart, y: bboxY, width: tupletWidth, height: bboxHeight },
            tupletGeometry,
          })
          // Keep the VexFlow Tuplet so its own SVG group can be recolored for selection
          // (avoids a document-wide scan that bleeds into neighbouring systems).
          this.tupletObjectMap.set(tupletId, vexTuplet)
          break
        }
      } catch (_e) {
        // Drawing or getBoundingBox may fail
      }
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
   * @returns whether an element was registered (false when the glyph has no box yet — pre-draw).
   */
  private addGlyphElement(
    glyph: { getBoundingBox(): { x: number; y: number; w: number; h: number } | undefined },
    info: Omit<ElementInfo, 'bbox'>,
  ): boolean {
    const b = glyph.getBoundingBox()
    if (!b) return false
    this.elementRegistry.add({ ...info, bbox: { x: b.x, y: b.y, width: b.w, height: b.h } })
    return true
  }

  private registerSlotElements(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
    staffIndex: number = 0,
  ): void {
    for (let si = 0; si < sortedSlots.length && si < staveNotes.length; si++) {
      const slot = sortedSlots[si]
      const staveNote = staveNotes[si]

      if (slot.type === 'rest') {
        try {
          // Register the rest by its OWN glyph's ink box (its single notehead), NOT the StaveNote
          // container box — the container unions attached modifiers, so a rest carrying a dynamic
          // would register a box reaching down to the dynamic (docs/tight-bbox-plan.md §3, §6a).
          // A rest StaveNote has exactly one notehead (the rest glyph); fall back to the StaveNote
          // if it isn't available yet (pre-draw), which preserves the old behaviour.
          const glyph = staveNote.noteHeads[0] ?? staveNote
          const registered = this.addGlyphElement(glyph, {
            type: 'rest',
            id: slot.id,
            measure: measure.number,
            staff: staffIndex,
            beat: fracToNumber(slot.beat),
            duration: slot.duration,
            tupletId: slot.tupletId,
          })
          if (registered) {
            // Add rest to staveNoteMap so ties pointing to this rest can be rendered
            this.staveNoteMap.set(slot.id, { staveNote, noteIndex: 0 })
            // A rest carries its dots on its own id — it IS the slot, so it is its own anchor.
            // Rest dots are AUTHORED, not just auto-fill: you can enter a dotted rest outright, or
            // dot an existing one (the bar reflows around it — a dotted quarter rest in 4/4 leaves
            // q + 8 behind it). They are also what `restFill` picks for a compound beat, so 6/8 is
            // full of them. Only ONE dot glyph either way: a rest has a single "notehead".
            if (slot.dots) {
              this.registerDots(staveNote, slot.id, measure.number, staffIndex, fracToNumber(slot.beat))
            }
          }
        } catch (_e) { /* getBoundingBox may fail */ }
      } else {
        try {
          const box = staveNote.getBoundingBox()
          if (box) {
            // Sort pitches low→high by MIDI to match VexFlow's internal key ordering
            const sortedPitches = [...slot.notes].sort(
              (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
            )

            // True notehead-center X (excludes accidentals/dots, unlike the full bbox
            // whose center skews left when an accidental hangs off the head). Used to
            // place the head hit-box so the click target lands ON the notehead.
            let headCenterX: number | undefined
            try {
              headCenterX = (staveNote.getNoteHeadBeginX() + staveNote.getNoteHeadEndX()) / 2
            } catch (_e) { /* not available before draw */ }

            for (let keyIndex = 0; keyIndex < sortedPitches.length; keyIndex++) {
              const pitch = sortedPitches[keyIndex]
              const pitchMidi = spellingToMidi(pitch.step, pitch.alter, pitch.octave)

              this.elementRegistry.add({
                type: 'note',
                id: pitch.id,
                measure: measure.number,
                staff: staffIndex,
                beat: fracToNumber(slot.beat),
                pitch: pitchMidi,
                duration: slot.duration,
                tupletId: slot.tupletId,
                bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                headX: headCenterX,
              })

              // keyIndex matches VexFlow's sorted pitch order
              this.staveNoteMap.set(pitch.id, { staveNote, noteIndex: keyIndex })

              // Articulations: register on the lowest-pitch note (index 0); data lives on chord
              if (keyIndex === 0 && slot.articulations?.length) {
                try {
                  const modifiers = staveNote.getModifiers()
                  // Modifiers were added in ARTICULATION_RENDER_ORDER, NOT slot order — so
                  // index the same sorted list, or the type↔glyph labels get swapped when a
                  // note has multiple articulations (breaking highlight, delete and flip).
                  const sortedArticulations = (slot.articulations ?? []).slice().sort(
                    (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
                  )
                  let articulationIndex = 0
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Articulation') {
                      const artBox = modifier.getBoundingBox()
                      if (artBox) {
                        this.elementRegistry.add({
                          type: 'articulation',
                          noteId: pitch.id,
                          articulationType: sortedArticulations[articulationIndex],
                          measure: measure.number,
                          staff: staffIndex,
                          beat: fracToNumber(slot.beat),
                          bbox: { x: artBox.x, y: artBox.y, width: artBox.w, height: artBox.h },
                        })
                      }
                      articulationIndex++
                    }
                  }
                } catch (_e) { /* Articulation bounding box may not be available */ }
              }

              // Dots: chord-level data like articulations, so anchor them on the lowest pitch too.
              if (keyIndex === 0 && slot.dots) {
                this.registerDots(staveNote, pitch.id, measure.number, staffIndex, fracToNumber(slot.beat))
              }

              // The STEM as its own ink rect — chord-level, so anchored on the lowest pitch like the
              // articulations and dots above. The TREMOLO rides that stem and is anchored the same.
              if (keyIndex === 0) {
                this.registerStem(staveNote, pitch.id, measure.number, staffIndex, fracToNumber(slot.beat))
                if (slot.tremolo) {
                  this.registerTremolo(staveNote, pitch.id, measure.number, staffIndex, fracToNumber(slot.beat))
                }
              }

              // Register whatever accidental VexFlow actually drew — including a
              // courtesy/auto natural (alter 0, not forced) that shows because an
              // earlier note in the measure altered this pitch. The inner loop only
              // acts when an Accidental modifier exists, so no guard on alter/force.
              {
                try {
                  const modifiers = staveNote.getModifiers()
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Accidental') {
                      const accidental = modifier as Accidental
                      const accInternal = accidental as unknown as { index?: number; note_index?: number }
                      if (accInternal.index === keyIndex ||
                          accInternal.note_index === keyIndex ||
                          modifiers.filter(m => m.getCategory() === 'Accidental').indexOf(modifier) === keyIndex) {
                        const accBox = accidental.getBoundingBox()
                        if (accBox) {
                          const accStr = pitch.alter === 2 ? '##' : pitch.alter === 1 ? '#'
                            : pitch.alter === -1 ? 'b' : pitch.alter === -2 ? 'bb' : 'n'
                          this.elementRegistry.add({
                            type: 'accidental',
                            noteId: pitch.id,
                            measure: measure.number,
                            staff: staffIndex,
                            beat: fracToNumber(slot.beat),
                            pitch: pitchMidi,
                            accidentalType: accStr,
                            bbox: { x: accBox.x, y: accBox.y, width: accBox.w, height: accBox.h },
                          })
                        }
                        break
                      }
                    }
                  }
                } catch (_e) { /* Accidental bounding box may not be available */ }
              }
            }
          }
        } catch (_e) { /* getBoundingBox may fail */ }
      }
    }
  }

  private registerBeams(beams: Beam[], measure: Measure): void {
    for (const beam of beams) {
      try {
        const box = beam.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'beam',
            measure: measure.number,
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (_e) { /* getBoundingBox may fail */ }
    }
  }

  /**
   * **Tier 1** — everything a measure knows about itself without being painted: its staff box, its
   * five line Y positions, its note start/end X, and the hit-boxes for the staff, the opening clef,
   * the meter and the barline.
   *
   * Every value below comes off the `Stave` or off plain layout arithmetic, so this is correct for a
   * measure that is never drawn. The mid-measure clef segments used to be registered here too; they
   * are tier 2 now (see `drawMeasureContent`), because an inline clef's X only exists once the voice
   * is formatted.
   */
  private registerStaffAndGeometry(
    stave: Stave,
    measure: Measure,
    x: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    staffIndex: number = 0,
  ): void {
    try {
      const staveBox = stave.getBoundingBox()
      if (staveBox) {
        this.elementRegistry.add({
          type: 'staff',
          measure: measure.number,
          staff: staffIndex,
          bbox: { x: staveBox.x, y: staveBox.y, width: staveBox.w, height: staveBox.h },
        })
      }

      const lineYPositions: [number, number, number, number, number] = [
        stave.getYForLine(0),
        stave.getYForLine(1),
        stave.getYForLine(2),
        stave.getYForLine(3),
        stave.getYForLine(4),
      ]
      this.elementRegistry.setStaffGeometry({
        measure: measure.number,
        staff: staffIndex,
        lineYPositions,
        lineSpacing: lineYPositions[1] - lineYPositions[0],
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        clef,
      })
    } catch (_e) { /* getBoundingBox or getYForLine may fail */ }

    // Region hit-boxes (clef/TS/barline) span the staff's five lines, not the
    // STAVE_HEIGHT layout stride — that constant is the per-line vertical
    // allocation (staff + gap to the next system) and would leave the box hanging
    // ~80px below the bottom line. Anchor to the actual line Y's instead. The clef
    // gets a half-staff-space pad top and bottom so a treble clef's overhanging
    // curl (below the bottom line) and top (above the top line) still register
    // clicks; the TS and barline sit within the lines and hug them exactly.
    const lineTop = stave.getYForLine(0)
    const staffSpan = stave.getYForLine(4) - lineTop
    const clefPad = (stave.getYForLine(1) - lineTop) / 2

    // Register the opening clef (beat 0) when a clef glyph is drawn at the
    // measure start: at line starts (full clef) or mid-line clef changes (smaller
    // clef). Mid-measure (inline) clefs are registered separately after drawing.
    // beat 0 lets clef removal target the opening clef specifically.
    if (measure.number === 1 || isFirstInLine) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        staff: staffIndex,
        beat: 0,
        // The big line-start clef is anchored to the line and cannot be dragged.
        immovable: true,
        bbox: { x, y: lineTop - clefPad, width: LAYOUT_CONFIG.CLEF_WIDTH, height: staffSpan + 2 * clefPad },
      })
    } else if (hasClefChange) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        staff: staffIndex,
        beat: 0,
        bbox: { x, y: lineTop - clefPad, width: LAYOUT_CONFIG.CLEF_CHANGE_WIDTH, height: staffSpan + 2 * clefPad },
      })
    }

    if (drawsTimeSignature(measure)) {
      // Position after whatever clef glyph (if any) was drawn at the measure start.
      const clefOffset =
        measure.number === 1 || isFirstInLine
          ? LAYOUT_CONFIG.CLEF_WIDTH
          : hasClefChange
            ? LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
            : 0
      // Clamp the TS hit-box so its right edge never crosses noteStartX. The
      // approximate TIME_SIG_WIDTH over-estimates the real glyph and would
      // otherwise bleed into the note-entry zone, swallowing clicks that land
      // just right of the glyph (rejected as "clicked on timeSignature").
      const tsX = x + clefOffset
      const tsWidth = Math.min(LAYOUT_CONFIG.TIME_SIG_WIDTH, stave.getNoteStartX() - tsX)
      if (tsWidth > 0) {
        this.elementRegistry.add({
          type: 'timeSignature',
          measure: measure.number,
          staff: staffIndex,
          bbox: {
            x: tsX,
            y: lineTop,
            width: tsWidth,
            height: staffSpan,
          },
        })
      }
    }

    this.elementRegistry.add({
      type: 'barline',
      measure: measure.number,
      staff: staffIndex,
      bbox: { x: x + width - 2, y: lineTop, width: 4, height: staffSpan },
    })
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview (rawX for smooth cursor following)
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  /**
   * Freeze/unfreeze the line layout. Freezing snapshots the current measure
   * widths and line assignments; while frozen, renderScore reuses that snapshot
   * so dragging a clef redraws the notes (re-pitched by the moved clef) without
   * reflowing the score. The snapshot is taken here (not in renderScore) because
   * clearCanvas() wipes measureLayoutInfo before each render.
   */
  setLayoutFrozen(frozen: boolean): void {
    this.frozenLayout = frozen && this.measureLayoutInfo.size > 0
      ? new Map(this.measureLayoutInfo)
      : null
  }

  /** Set/clear the clef currently being dragged (to keep a redundant one visible). */
  setDraggingClef(info: { measure: number; beat: Fraction } | null): void {
    this.draggingClef = info
  }

  /**
   * If a clef is being dragged within this measure AND it's redundant (equals the
   * clef in effect just before it, so it'll be removed on drop), return its beat
   * so it can be force-rendered while dragging. Otherwise undefined.
   */
  private ghostClefBeatFor(score: Score, measureNumber: number): Fraction | undefined {
    if (!this.draggingClef || this.draggingClef.measure !== measureNumber) return undefined
    const beat = this.draggingClef.beat
    const measure = score.measures.find(m => m.number === measureNumber)
    const change = measure?.clefs?.find(c => fracEq(c.beat, beat))
    if (!change) return undefined
    return change.clef === effectiveClefBefore(score, measureNumber, beat) ? beat : undefined
  }

  /**
   * PER-SYSTEM vertical push-down from Client #7 staff-spacing overrides (Sibelius "space above
   * staff" — docs/staff-spacing-plan.md, option C). Each *system* (line) can carry a different
   * amount, so this resolves the spacing per line and returns:
   *  - `cumPx[line][staffIndex]` — INCLUSIVE prefix sum (px) of the resolved space-above of every
   *    staff at/above index `i` on that line (a staff's own space-above pushes it and everything
   *    below it in its system down);
   *  - `lineTopPx[line]` — the system's top Y (margin + the stacked heights of every earlier
   *    system, each grown by its own extra), so systems with different spacing still abut cleanly;
   *  - `contentHeightPx` — Σ over lines of (numStaves·stride + that line's extra), for `totalHeight`.
   * The opening measure id per line (the durable per-system anchor) comes from `measureWidths`:
   * the first measure seen for each `lineNumber`. Converts with the constant default line spacing
   * (this editor never builds a stave with custom spacing — zoom is a CSS transform), so no live
   * stave is needed before Y is computed.
   */
  private staffSpacingLayout(score: Score, measureWidths: Map<number, MeasureWidthInfo>): {
    lineTopPx: number[]
    cumPx: number[][]
    lineHeightPx: number[]
    contentHeightPx: number
  } {
    const staves = getStaves(score)
    const staffList = staves.length > 0 ? staves : [{ id: firstStaffId(score) }]
    const numStaves = staffList.length
    const staffStride = LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING
    const margin = LAYOUT_CONFIG.MARGIN

    let numLines = 0
    for (const info of measureWidths.values()) numLines = Math.max(numLines, info.lineNumber + 1)

    // The measure that OPENS each line (first one encountered in score order) is the per-system
    // anchor a spacing override is keyed to.
    const openingMeasureId = new Map<number, string>()
    for (const m of score.measures) {
      const info = measureWidths.get(m.number)
      if (info && !openingMeasureId.has(info.lineNumber)) openingMeasureId.set(info.lineNumber, m.id)
    }

    const cumPx: number[][] = []
    const lineTopPx: number[] = []
    const lineHeightPx: number[] = []
    let top = margin
    let contentHeightPx = 0
    for (let line = 0; line < numLines; line++) {
      // A per-system spacing override is keyed to the system's opening measure — a LAYOUT
      // artifact, meaningful only inside the casting-off that produced it. Linear view has one
      // system opening at measure 1, so honouring the key here would silently show (and, via a
      // drag, overwrite) wrapped view's FIRST-SYSTEM spacing. Pass no opener instead: the
      // resolver falls back to the per-staff GLOBAL value, which is keyed to a content entity
      // and so travels between views exactly as it should. (docs/linear-view-plan.md §4)
      const openId = this.viewMode === 'linear' ? undefined : openingMeasureId.get(line)
      const cum: number[] = []
      let acc = 0
      for (const staff of staffList) {
        // Linear view's view knob wins over the global value when set — it is what the user is
        // looking at right now. It is never written to the score (§4.2b), so this read is the
        // only place it exists.
        const knob = this.viewMode === 'linear' && staff.id
          ? this.linearStaffSpacing.get(staff.id)
          : undefined
        const above = knob ?? (staff.id ? resolveStaffSpacingAbove(score, staff.id, openId) : 0)
        acc += above * VEXFLOW_DEFAULT_STAFF_SPACE_PX
        cum.push(acc)
      }
      cumPx.push(cum)
      lineTopPx.push(top)
      const systemHeight = numStaves * staffStride + acc
      lineHeightPx.push(systemHeight)
      top += systemHeight
      contentHeightPx += systemHeight
    }
    return { lineTopPx, cumPx, lineHeightPx, contentHeightPx }
  }

  renderScore(score: Score, ghostNote?: GhostNote): boolean {
    if (!this.context || !this.renderer) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }
    renderCensus.beginRender() // P0 instrument — remove with docs/render-performance-plan.md §8

    // NOTE: no unconditional `clear()` here any more. The SVG is torn down *selectively*, below,
    // once we know which measures actually changed — see `clearForRender`.

    // Use layout configuration
    const margin = LAYOUT_CONFIG.MARGIN
    const staveHeight = LAYOUT_CONFIG.STAVE_HEIGHT
    const verticalSpacing = LAYOUT_CONFIG.VERTICAL_SPACING

    // The staff axis (multi-staff): staves stack vertically within each system, sharing
    // barlines. N = 1 is the single-staff default. Each system now holds N staves, so the
    // per-line vertical stride is multiplied by N; a staff's own offset within a system is
    // `staffIndex * staffStride`. At N=1 this reduces exactly to the old `line * stride`.
    // A live model always has ≥1 staff (constructor seeds it, fromJSON defaults it), but a
    // hand-built staveless score still renders as one staff (undefined staffId → matches all
    // absent-staffId content) rather than drawing nothing.
    const staves = getStaves(score)
    const staffList = staves.length > 0 ? staves : [{ id: firstStaffId(score) }]
    const staffStride = staveHeight + verticalSpacing

    // Resolve the clef in effect at each measure (handles per-measure changes). Clef is
    // per-staff, so compute one map per staff — and hand the whole thing to the width calc,
    // which now takes each staff's own lane and clefs and maxes over them (P1). Widths are
    // still shared across staves (barlines align); what changed is how they are derived.
    // ONE forward pass per staff (resolveStaffClefs). The per-measure helpers inherit by scanning
    // backwards over every earlier measure, so calling them per measure per staff — as this and the
    // draw loop below both used to — was cubic over the score, and dominated a cached layout.
    const clefsByStaff = new Map<string | undefined, StaffClefs>()
    for (const staff of staffList) {
      clefsByStaff.set(staff.id, resolveStaffClefs(score, staff.id))
    }

    // Calculate proportional widths for all measures — or reuse a layout we already have.
    //
    // Three sources, cheapest first:
    //   1. the frozen layout (a clef drag: don't reflow while dragging). Copy it, so the next
    //      clear() doesn't wipe it (same Map ref).
    //   2. `layoutCache` — the last render's casting-off, when neither the model nor the
    //      layout-relevant view state changed. This is what makes SCROLLING free again: the cull
    //      window moved, and the window cannot change a single width. (See `layoutCache`.)
    //   3. compute it.
    renderCensus.beginLayout()
    const layoutKey = this.layoutStateKey()
    const cachedLayout =
      this.layoutReusable && this.layoutCache?.key === layoutKey ? this.layoutCache.widths : null
    const measureWidths = this.frozenLayout
      ? new Map(this.frozenLayout)
      : cachedLayout ?? calculateMeasureWidths(score, clefsByStaff, this.viewMode, this.widthCache, this.justifyLastLine)
    if (!this.frozenLayout) this.layoutCache = { key: layoutKey, widths: measureWidths }
    renderCensus.endLayout()
    // A bar changing SYSTEM is the one layout event with no trace in the score and none in the
    // picture either (you see the new arrangement, never the move). It is also what half the
    // width work is trying to cause or avoid — a bar width nudge, a meter change, a wider
    // accidental — so say it out loud, once per bar that actually moved.
    logSystemChanges(this.measureLayoutInfo, measureWidths)
    // Store for use in tie rendering (to determine which line each measure is on)
    this.measureLayoutInfo = measureWidths

    // Wrapped view justifies every line to one fixed page width, so the surface is that width.
    // Linear view has no line to justify to: the music runs off to the right and the surface has
    // to grow with it — 2·margin + the intrinsic widths, floored at the wrapped width so a short
    // fragment doesn't render on a stub of a page. (docs/linear-view-plan.md §P1)
    const contentWidth = this.viewMode === 'linear'
      ? Math.max(
          LAYOUT_CONFIG.CONTAINER_WIDTH,
          margin * 2 + [...measureWidths.values()].reduce((sum, m) => sum + m.finalWidth, 0),
        )
      : LAYOUT_CONFIG.CONTAINER_WIDTH

    // Client #7 staff-spacing (per-system): resolve each line's own per-staff push-down and
    // system top from the overrides + this render's line assignment (needs `measureWidths`).
    const spacing = this.staffSpacingLayout(score, measureWidths)

    // Bundle this render's per-render state (references to the instance-field maps —
    // see RenderPass for the lifetime contract). Created here, before the measure loop,
    // so the per-measure sub-renderers (dynamics) and the post-measure ones (ties/slurs)
    // share one pass.
    const pass = this.createRenderPass(score)

    // Each system stacks N staves (N=1 → unchanged); its span grows by that system's own
    // staff-spacing extra, summed across all systems (in `staffSpacingLayout`) so the SVG fits
    // the pushed-down staves.
    const totalHeight = spacing.contentHeightPx + margin * 2

    // Check if SVG exists (should always exist after initialization)
    const svg = this.getSVGElement()
    if (!svg) {
      throw new Error('SVG element not found. Renderer may not be properly initialized.')
    }

    // Get current SVG size
    const currentWidth = parseInt(svg.getAttribute('width') || '0')
    const currentHeight = parseInt(svg.getAttribute('height') || '0')

    // Only resize if dimensions changed (following VexFlow best practice)
    if (currentWidth !== contentWidth || currentHeight !== totalHeight) {
      this.renderer!.resize(contentWidth, totalHeight)
    }

    // ---- TIER 1 (§7): place every measure. Pure arithmetic over the casting-off; draws nothing. ----
    // Runs over the WHOLE score, and must keep doing so once P6 draws only a window of it.
    const plans = this.layoutTier1(score, staffList, clefsByStaff, measureWidths, spacing, staffStride, margin)

    // ---- The redraw decision (§7a). Three outcomes, not two. ----
    //
    //   SAME     — same shape, same place  → touch nothing at all.
    //   MOVED    — same shape, new place   → **translate** the group. No re-engraving. (P5.4b)
    //   REDRAW   — different shape         → re-engrave it.
    //
    // The middle case is the one that matters. Before it existed, a bar that had merely *slid* was
    // treated as a bar that had *changed*: dragging a staff down re-engraved 66% of the score on
    // every mouse-move frame, and that single gesture was 53% of all render time. Nothing about
    // those bars was different — they had moved.
    // ---- Cross-barline beams (docs/cross-barline-beaming-plan.md), planned in two passes ----
    //
    // The first pass is drawn-blind (`() => true`), so it sees every join and every SIDE regardless of
    // culling — the spans machinery then pins each side's bars together and forces them drawn as a set.
    // Across a system break the two sides are independent and NOT cross-pinned (cross-system-beam-
    // fragments-plan P4). The second pass re-plans against the actual draw decision: within a line a bar
    // tier 2 is not painting closes its barline, because a placeholder beam whose partner has no
    // StaveNotes would leave a note with no flag AND no stem; across a break an undrawn side just skips
    // itself. Within a line the two passes agree by construction — the forcing is what makes them.
    const provisionalBeams = this.planCrossBarBeams(plans, () => true)

    const spans = this.spanAnchors(score, provisionalBeams.joins, provisionalBeams.fanJoins)
    // A span's endpoint bar must be REDRAWN when it moves, never translated — see spanAnchors.
    const anchors = spans.measures
    // A system connector is drawn from the Stave of the line's first measure, and a translated
    // measure's Stave still reports its old coordinates. Only relevant with a staff axis.
    const multiStaff = staffList.length > 1

    // ---- P6: WHICH bars does tier 2 paint at all? (§8) ----
    // The window first, then the spans that cross it drag their off-screen anchors in with them.
    // `drawFilter` is the test seam, ANDed on top.
    const visibleMeasures = new Set<number>()
    const windowed = plans.map(p => {
      const inside = this.inCullWindow(p, staveHeight)
      if (inside) visibleMeasures.add(p.measureNumber)
      return inside
    })
    const forced = this.cullWindow ? this.forcedSpanGroups(spans, visibleMeasures) : null
    const groupKeys = plans.map(p => measureGroupKey(p.measureNumber, p.staffIndex))
    const draws = plans.map((plan, i) =>
      (windowed[i] || (forced?.has(groupKeys[i]) ?? false)) &&
      (!this.drawFilter || this.drawFilter(plan)),
    )

    // The beams as they will actually be engraved, and with them each bar's share of the answer:
    // which of its slots draw flagless, at which stem direction. That is a difference in the
    // PICTURE, so it goes in the shape key — leave it out and a bar keeps its old flags forever the
    // first time its neighbour's mark changes.
    const beamPlan = this.planCrossBarBeams(plans, i => draws[i])
    const keys = plans.map(p => measureShapeKey(
      score,
      { ...p, crossBarBeams: beamPlan.descriptorFor(p.measureNumber, p.staffIndex) },
      this.suppressedDynamicId,
      this.suppressedTempoId,
    ))

    type Reuse = { snapshot: MeasureSnapshot; dx: number; dy: number }
    const reuse = new Map<string, Reuse>()

    plans.forEach((plan, i) => {
      const groupKey = groupKeys[i]
      const prev = this.snapshots.get(groupKey)
      if (!prev || prev.key !== keys[i]) return

      const dx = plan.x - prev.drawnX
      const dy = plan.y - prev.drawnY

      // ---- The culled case: reuse the GEOMETRY, with no picture attached. ----
      //
      // Tier 1 still runs for every bar in the score (that is what keeps hit-testing and
      // pixel↔position honest off-screen), and at 200 bars that is 200 `Stave`s rebuilt on every
      // render — including every scroll, for bars nobody can see and nothing has touched. A bar that
      // was already culled last render has an unchanged tier-1 snapshot and no `<g>` at all, so
      // replaying it is exactly equivalent and free.
      //
      // The `group === null` test is the safety: it says *this bar was culled last time too*. A bar
      // that is only NOW leaving the window still has a `<g>` standing in the DOM, and must fall
      // through to a rebuild — staying out of `reuse` is precisely what makes `clearForRender` take
      // that `<g>` back out. Culling is a *removal*, not a skipped repaint: leave the group up and a
      // scrolled-past bar lingers, and a stale one is still standing when the score changes under it.
      if (!draws[i]) {
        if (prev.group !== null) return
        reuse.set(groupKey, { snapshot: prev, dx, dy })
        return
      }

      // ---- The drawn case. `isConnected` guards something else tearing the SVG down under us. ----
      if (!prev.group?.isConnected) return

      if (dx === 0 && dy === 0) {
        reuse.set(groupKey, { snapshot: prev, dx: 0, dy: 0 })
        return
      }

      // It moved. May it be translated rather than re-engraved?
      if (anchors.has(plan.measureNumber)) return
      if (multiStaff && plan.isFirstInLine) return
      reuse.set(groupKey, { snapshot: prev, dx, dy })
    })

    // Take down everything this render is responsible for rebuilding — but leave the reused measure
    // groups standing. This is what replaces the old unconditional `clear()`. (`reuse` already holds
    // the snapshots it needs, so wiping `this.snapshots` here is safe.)
    this.clearForRender(new Set(reuse.keys()))

    const placements: MeasurePlacement[] = []
    let redrawn = 0

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]
      const groupKey = groupKeys[i]

      const reused = reuse.get(groupKey)
      if (reused) {
        this.replaySnapshot(groupKey, reused.snapshot, plan, reused.dx, reused.dy)
        placements.push({ ...plan, stave: reused.snapshot.stave })
        continue
      }

      // ---- Rebuild: tier 1 always, tier 2 only inside the window. ----
      // Registry entries are captured contiguously, so `sliceFrom` gets exactly this measure's.
      const registryStart = this.elementRegistry.count
      const stave = this.registerTier1(plan)
      const placement: MeasurePlacement = { ...plan, stave }
      placements.push(placement)

      // Which measures get painted is a *choice*, not an assumption — §7's `draw(measures, surface)`.
      const draw = draws[i]
      if (draw) {
        this.renderMeasure(pass, placement, beamPlan)
        redrawn++
      }

      this.snapshots.set(groupKey, {
        key: keys[i],
        measureNumber: plan.measureNumber,
        staffIndex: plan.staffIndex,
        // Where it was actually painted — the origin every later translation is measured from.
        drawnX: plan.x,
        drawnY: plan.y,
        group: draw ? this.measureGroups.get(groupKey) ?? null : null,
        stave,
        elements: this.elementRegistry.sliceFrom(registryStart),
        staffGeometry: this.elementRegistry.getStaffGeometry(plan.measureNumber, plan.staffIndex),
        bounds: plan.staffIndex === 0 ? this.measureBounds.get(plan.measureNumber) : undefined,
        staveNotes: this.captureById(plan.view, this.staveNoteMap),
        // ⚠️ EXPLICIT ids: `captureById`'s default list is slot ids + `slot.notes`, and a fanned
        // member is in neither — it lives inside the slot's `fan`.
        fanMembers: this.captureById(plan.view, this.fanMemberGroupMap, fanMemberIdsOf(plan.view)),
        fanMemberAnchors: this.captureById(plan.view, this.fanMemberAnchorMap, fanMemberIdsOf(plan.view)),
        tuplets: this.captureById({ ...plan.view, slots: [] }, this.tupletObjectMap, plan.view.tuplets?.map(t => t.id)),
        dynamics: this.captureById({ ...plan.view, slots: [] }, this.dynamicObjectMap, plan.view.dynamics?.map(d => d.id)),
      })
    }

    renderCensus.measuresRedrawn(redrawn, plans.length)

    // Join the stacked staves into one system with a vertical line at the left edge of each line's
    // first measure (grand-staff look). A single connecting line only — the brace/bracket grouping
    // symbol (StaffGroup) is deferred (docs/multi-staff-plan.md §0). Connectors live at the SVG's
    // top level, not inside a measure group, so they are torn down and redrawn every render — which
    // is why a REUSED measure still has to keep its `Stave` around (see MeasureSnapshot).
    if (staffList.length > 1) {
      const byKey = new Map(placements.map(p => [measureGroupKey(p.measureNumber, p.staffIndex), p]))
      const drawnKeys = new Set(groupKeys.filter((_, i) => draws[i]))
      const bottomStaff = staffList.length - 1
      for (const p of placements) {
        if (!p.isFirstInLine || p.staffIndex !== 0) continue
        const bottom = byKey.get(measureGroupKey(p.measureNumber, bottomStaff))
        if (!bottom) continue
        // A connector joins the TOP and BOTTOM staves of a system. Under vertical culling neither
        // may be on screen while the middle of the system is, so it is drawn whenever *any* staff of
        // its opening measure is — not when its own two endpoints happen to be.
        if (this.cullWindow && !this.systemIsDrawn(p.measureNumber, staffList.length, drawnKeys)) continue
        new StaveConnector(p.stave, bottom.stave)
          .setType('singleLeft')
          .setContext(this.context!)
          .draw()
      }
    }

    // Beams that run through a barline: one `Beam` over both bars, drawn outside either measure
    // group now that every bar has been painted. Before the ties, as a bar's own beams are.
    this.drawCrossBarBeams(pass, beamPlan.joins)
    // …and the fans whose beam does the same (docs/fan-beam-join-plan.md P3). Here for both of
    // `drawCrossBarBeams`' reasons — a measure group is REUSED, and culling deletes an off-screen
    // bar's group with everything drawn into it — and after it, so a fan joined behind an ordinary
    // cross-barline beam finds its neighbour's stems already settled.
    this.drawCrossBarFanBeams(pass, beamPlan.fanJoins)

    // Render ties between measures after all measures are drawn
    renderTies(pass, score)

    // Render phrasing slurs (top-level spans) after ties, in the same post-measure pass
    renderSlurs(pass, score)

    // Render ghost note AFTER all measures (as an overlay)
    let ghostNoteRendered = false
    if (ghostNote) {
      // For ghost note, we need to find the measure's actual position
      const ghostMeasureInfo = measureWidths.get(ghostNote.measure)
      if (ghostMeasureInfo) {
        ghostNoteRendered = this.renderGhostNoteWithDynamicWidths(
          ghostNote,
          score,
          measureWidths,
          margin,
          staveHeight,
          verticalSpacing
        )
      }
    }

    renderCensus.endRender() // P0 instrument
    return ghostNoteRendered
  }

  private renderGhostNoteWithDynamicWidths(
    ghostNote: GhostNote,
    score: Score,
    measureWidths: Map<number, MeasureWidthInfo>,
    margin: number,
    staveHeight: number,
    verticalSpacing: number
  ): boolean {
    try {
      const measure = score.measures.find(m => m.number === ghostNote.measure)
      if (!measure) {
        console.warn('Measure not found for ghost note:', ghostNote.measure)
        return false
      }

      const widthInfo = measureWidths.get(ghostNote.measure)
      if (!widthInfo) {
        console.warn('Width info not found for ghost note measure:', ghostNote.measure)
        return false
      }

      // Guard against a malformed spelling (no step) — skip the preview rather
      // than crash the whole score render.
      if (ghostNote.step === undefined) {
        return false
      }

      // Calculate X position by summing widths of previous measures on the same line
      let measureX = margin
      for (const m of score.measures) {
        if (m.number === ghostNote.measure) break
        const mInfo = measureWidths.get(m.number)
        if (mInfo && mInfo.lineNumber === widthInfo.lineNumber) {
          measureX += mInfo.finalWidth
        } else if (mInfo && mInfo.lineNumber < widthInfo.lineNumber) {
          measureX = margin
        }
      }

      // The ghost previews entry on the staff the cursor is over (multi-staff): its Y is that
      // staff's row within the system (systemTop + staffIndex*stride) and its clef is that
      // staff's own clef — so the preview lands exactly where the click will place the note.
      const staffIndex = ghostNote.staff ?? 0
      const staffId = staffIdAtIndex(score, staffIndex)
      // Match the real render's PER-SYSTEM staff-spacing push-down (Client #7) so the
      // translucent ghost lands exactly where the committed note will, on any staff/system
      // with spacing ≠ 0. Resolve against this ghost's own line.
      const spacing = this.staffSpacingLayout(score, measureWidths)
      const line = widthInfo.lineNumber
      const systemTop = spacing.lineTopPx[line] ?? margin
      const measureY = systemTop + staffIndex * (staveHeight + verticalSpacing) + (spacing.cumPx[line]?.[staffIndex] ?? 0)
      const staveWidth = widthInfo.finalWidth
      const effectiveClefs = this.computeEffectiveClefs(score, staffId)
      const openingClef: Clef = effectiveClefs.get(ghostNote.measure) || 'treble'
      // Match the real stave: only redraw the clef when it changes across the
      // barline (vs the previous measure's ending clef), not opening-to-opening.
      const prevEndClef = ghostNote.measure > 1 ? measureEndingClef(score, ghostNote.measure - 1, staffId) : undefined
      const hasClefChange = prevEndClef !== undefined && openingClef !== prevEndClef
      // The ghost note must be positioned by the clef in effect at its beat
      // (mid-measure changes), not just the measure's opening clef.
      const clef: Clef = effectiveClefAt(score, ghostNote.measure, beatToFrac(ghostNote.beat), staffId)

      // The ghost sits at a real pitch, so it gets real ledger lines — same ink as the engraved ones.
      const tempStave = new Stave(measureX, measureY, staveWidth)
      tempStave.setDefaultLedgerLineStyle(LEDGER_LINE_STYLE)
      const isFirstInLine = measureX === margin
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(openingClef)
      } else if (hasClefChange) {
        tempStave.addClef(openingClef, 'small')
      }
      if (drawsTimeSignature(measure)) {
        tempStave.addTimeSignature(timeSignatureVexKey(measure.timeSignature))
      }
      // Match the real stave's note area so the ghost note aligns with where the committed note
      // will land (a cautionary end clef narrows the note area) — and match it on THIS staff, since
      // the courtesy is per staff now and only some staves may carry one.
      const ghostCautionaryClef = widthInfo.cautionaryEndClefs?.[staffIndex]
      if (ghostCautionaryClef) {
        tempStave.addEndClef(ghostCautionaryClef, 'small')
      }
      if (widthInfo.cautionaryEndTimeSig) {
        tempStave.addEndTimeSignature(timeSignatureVexKey(widthInfo.cautionaryEndTimeSig))
      }
      tempStave.setContext(this.context!)

      const vexNote = spellingToVexflowKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
      const vexDuration = convertDuration(ghostNote.duration as NoteDuration, ghostNote.dots || 0)

      // Stem direction — same diatonic approach as createStaveNotesFromSlots.
      // Include any existing notes at the same beat so the ghost matches the chord's stem.
      const middleDiatonic = middleLineDiatonicPos(clef)
      let stemDirection = -1  // default down; middle-line notes follow this convention
      let maxDist = 0
      const checkDiatonic = (step: PitchStep, octave: number) => {
        const dPos = spellingDiatonicPos(step, octave)
        const dist = Math.abs(dPos - middleDiatonic)
        if (dist > maxDist) { maxDist = dist; stemDirection = dPos >= middleDiatonic ? -1 : 1 }
      }
      // Only this staff's chords at the beat influence the ghost's stem (a chord on another
      // staff at the same beat is an independent stream).
      for (const slot of staffMeasureView(measure, staffId, score).slots) {
        if (slot.type === 'chord' && Math.abs(fracToNumber(slot.beat) - ghostNote.beat) < 0.001) {
          for (const p of slot.notes) checkDiatonic(p.step, p.octave)
        }
      }
      checkDiatonic(ghostNote.step, ghostNote.octave)

      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
        clef,
        autoStem: false,
      })
      staveNote.setStemDirection(stemDirection)

      const dots = ghostNote.dots || 0
      for (let d = 0; d < dots; d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }

      if (ghostNote.alter !== 0) {
        const sign = alterToString(ghostNote.alter)
        staveNote.addModifier(new Accidental(sign), 0)
      } else if (ghostNote.forceAccidental) {
        // Armed natural: alter 0 has no sign of its own, so draw the ♮ explicitly.
        staveNote.addModifier(new Accidental('n'), 0)
      }

      // The armed entry tremolo, through the SAME modifier the engraved mark uses — so the ghost
      // wears its strokes exactly where the committed note will, stem stretches and all. Added
      // before the articulations for no reason but reading order; a tremolo is one modifier and
      // stacks with nothing.
      if (ghostNote.tremolo !== undefined) {
        staveNote.addModifier(new CenteredTremolo(ghostNote.tremolo), 0)
      }

      if (ghostNote.articulations?.length) {
        const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
        const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
        const sortedGhostArticulations = ghostNote.articulations.slice().sort(
          (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
        )
        for (const art of sortedGhostArticulations) {
          staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
        }
      }

      // Meter-aware rest fill around the ghost note (same engine as the model).
      // Positions are exact Fractions in quarter-note beats.
      const meter = getMeterInfo(measure.timeSignature)
      const noteStart = beatToFrac(ghostNote.beat)
      const noteEnd = fracAdd(noteStart, durationToFraction(ghostNote.duration, ghostNote.dots || 0))

      const makeRest = (r: RestSlot) => {
        const sn = new StaveNote({ keys: ['b/4'], duration: durationToVexflow(r.duration, r.dots) + 'r' })
        if (r.dots) Dot.buildAndAttach([sn], { all: true })
        return sn
      }

      const tickables: StaveNote[] = []
      for (const r of fillRests(fracCreate(0, 1), noteStart, meter)) tickables.push(makeRest(r))
      tickables.push(staveNote)
      for (const r of fillRests(noteEnd, measureCapacityFrac(measure), meter)) tickables.push(makeRest(r))

      // VexFlow wants the literal time signature, not quarter-beats.
      const voice = new Voice({
        numBeats: measure.timeSignature.numerator,
        beatValue: measure.timeSignature.denominator,
      }).setMode(Voice.Mode.SOFT)
      voice.addTickables(tickables)

      const noteAreaWidth = tempStave.getNoteEndX() - tempStave.getNoteStartX()
      const rightPadding = 15
      const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
      new Formatter().joinVoices([voice]).format([voice], formatWidth)

      const svg = this.getSVGElement()
      if (!svg) {
        console.error('SVG element not found for ghost note')
        return false
      }

      staveNote.setStave(tempStave)

      let targetShiftX: number | null = null
      if (ghostNote.rawX !== undefined) {
        try {
          const noteX = staveNote.getAbsoluteX()
          targetShiftX = ghostNote.rawX - noteX
        } catch (_e) {
          // getAbsoluteX might not be available before draw
        }
      }

      const childrenBefore = svg.children.length
      staveNote.setContext(this.context!).draw()

      // The armed tuplet's number, over the ghost — "this click STARTS a 5:4", which a notehead
      // alone cannot say. Drawn the way VexFlow draws a real one: a `new Element('Tuplet')`, so the
      // font is whatever `Metrics` says the Tuplet category is (Bravura at its own size) rather
      // than a hardcoded stack that goes stale the day VexFlow retunes, and the text is SMuFL
      // tuplet digits (see tupletMarkText). Same geometry too — VexFlow puts the number a line and
      // a half above the top staff line, less its own textYOffset.
      //
      // Drawn INSIDE the childrenBefore window on purpose: it is then swept into `.ghost-note-group`
      // and tinted with the rest of the ghost by the code below, instead of needing its own
      // teardown. NO bracket: a tuplet's bracket spans notes that do not exist until the click.
      if (ghostNote.tupletLabel?.length) {
        // Laid out by the SAME function the engraved mark uses, so the preview's runs are the page's
        // runs at the page's sizes — a ghost drawn any other way previews a different mark.
        const mark = layoutTupletMark(ghostNote.tupletLabel)
        for (const { el } of mark.pieces) el.setContext(this.context!)
        // The number rides the NOTE, not the staff: it floats a fixed gap above whatever the note's
        // highest point is — the stem TIP when the stem is up, the NOTEHEAD when it hangs down.
        //
        // Deliberately NOT VexFlow's own rule, which then clamps the result to at least 1.5 lines
        // above the top staff line: that clamp is right for a real tuplet (a bracket spanning several
        // notes needs one height for all of them) and wrong for a ghost, which is ONE note following
        // the cursor — clamped, the number stops tracking and drifts away from the notehead as you
        // move down the staff.
        const stem = staveNote.getStemExtents()
        const anchorY = !staveNote.hasStem()
          ? Math.min(...staveNote.getYs()) // a whole note: the notehead is the whole of it
          : stemDirection === 1
            ? stem.topY // stem up — the tip is the highest point
            : stem.baseY // stem down — the stem hangs below, so the notehead is
        // Centred on the NOTEHEAD, not on the note's origin: `getAbsoluteX()` is where the note
        // attaches (accidentals and dots push it around), so a number centred there sits off to one
        // side of the head it belongs to. The head's own two edges say where it actually is.
        const headCenterX = (staveNote.getNoteHeadBeginX() + staveNote.getNoteHeadEndX()) / 2
        // Every run centred as ONE mark, on one baseline — see ScoreTuplet.draw.
        drawTupletMark(
          this.context!,
          mark,
          headCenterX - mark.width / 2,
          anchorY - GHOST_TUPLET_NUMBER_GAP * tempStave.getSpacingBetweenLines(),
        )
      }

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      if (newElements.length > 0) {
        // ALWAYS wrap, even with no shift to apply: the group is what makes the ghost an
        // overlay — loose elements in the SVG could never be taken down again (P4).
        const ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ghostGroup.setAttribute('class', 'ghost-note-group')
        if (targetShiftX !== null) {
          ghostGroup.setAttribute('transform', `translate(${targetShiftX}, 0)`)
        }
        for (const element of newElements) {
          svg.removeChild(element)
        }
        for (const element of newElements) {
          ghostGroup.appendChild(element)
        }
        svg.appendChild(ghostGroup)
      }

      // Ghost paints in the active voice's colour (V1 blue / V2 green); default blue.
      const ghostFill = ghostNote.fillColor ?? '#3B82F6'
      const ghostStroke = ghostNote.strokeColor ?? '#2563EB'
      const applyGhostStyle = (element: Element) => {
        const tagName = element.tagName.toLowerCase()
        if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
          element.setAttribute('fill', ghostFill)
          element.setAttribute('stroke', ghostStroke)
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + `; fill: ${ghostFill} !important; stroke: ${ghostStroke} !important; opacity: 0.7 !important;`)
        } else if (tagName === 'text') {
          element.setAttribute('fill', ghostFill)
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + `; fill: ${ghostFill} !important; opacity: 0.7 !important;`)
        } else if (tagName === 'line') {
          element.setAttribute('stroke', ghostStroke)
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + `; stroke: ${ghostStroke} !important; opacity: 0.7 !important;`)
        }
        for (let i = 0; i < element.children.length; i++) {
          applyGhostStyle(element.children[i])
        }
      }

      for (let i = childrenBefore; i < svg.children.length; i++) {
        applyGhostStyle(svg.children[i])
      }

      return true
    } catch (error) {
      console.error('Could not render ghost note with dynamic widths:', error)
      return false
    }
  }

  /** The drawn `<g>` for one (measure, staff) — the handle P5's incremental redraw and P6's culling
   *  address a single measure by. Null for a measure that was not drawn. Must be called after a
   *  render. See {@link renderMeasure}. */
  getMeasureSVGGroup(measureNumber: number, staffIndex: number): SVGGElement | null {
    return this.measureGroups.get(measureGroupKey(measureNumber, staffIndex)) ?? null
  }

  /** Restrict tier 2 to a subset of the score, by predicate. A test seam — the shipping culling
   *  switch is {@link setCullWindow}, and the two are ANDed. */
  setDrawFilter(filter: ((p: Omit<MeasurePlacement, 'stave'>) => boolean) | null): void {
    this.drawFilter = filter
  }

  /** P6: the window tier 2 paints, overscan already included, in layout coords. `null` draws the
   *  whole score. See {@link cullWindow}. */
  setCullWindow(window: Rect | null): void {
    this.cullWindow = window
  }

  /** Stretch the last system to the page width (Finale/Sibelius) or leave it ragged (LilyPond).
   *  In {@link layoutStateKey}, so flipping it invalidates the cached casting-off. */
  setJustifyLastLine(justify: boolean): void {
    this.justifyLastLine = justify
  }

  getJustifyLastLine(): boolean {
    return this.justifyLastLine
  }

  /** Tell the renderer whether this render may reuse the last one's casting-off. Only `MusicEngine`
   *  knows (it owns `modelDirty`); see {@link layoutReusable} for why the default is `false`. */
  setLayoutReusable(reusable: boolean): void {
    this.layoutReusable = reusable
  }

  /** Is any staff of this measure being painted? (The system connector's own two staves may both be
   *  culled while the system is on screen — see the call site.) */
  private systemIsDrawn(measureNumber: number, numStaves: number, drawnKeys: Set<string>): boolean {
    for (let s = 0; s < numStaves; s++) {
      if (drawnKeys.has(measureGroupKey(measureNumber, s))) return true
    }
    return false
  }

  /** Is this measure inside the window this render is painting? Tier 1 runs for it either way. */
  private inCullWindow(p: Omit<MeasurePlacement, 'stave'>, staveHeight: number): boolean {
    const w = this.cullWindow
    if (!w) return true
    // The box is the staff's own rectangle. Anything hanging off it — ledger lines, a dynamic
    // below, a slur arching above — is covered by the overscan the window already carries, which
    // is a whole fraction of a viewport and dwarfs a few staff-spaces of overhang.
    return (
      p.x < w.x + w.width &&
      p.x + p.width > w.x &&
      p.y < w.y + w.height &&
      p.y + staveHeight > w.y
    )
  }

  /**
   * Take down everything this render will rebuild, and **leave the reused measure groups standing**
   * (docs/render-performance-plan.md §7a). The incremental replacement for the old unconditional
   * `clear()`.
   *
   * What survives: measure `<g>`s whose redraw key is unchanged. What does not, and why:
   *
   * - **Ties and slurs.** They span measures, so they belong to no measure's group and sit at the
   *   SVG's top level. They are cheap (a handful of curves against ~35 DOM nodes per bar per staff),
   *   so they are simply redrawn every render rather than tracked. Under P6 a span that crosses the
   *   window forces its anchor bars to be drawn, which is what keeps them resolvable (§8.2).
   * - **System connectors.** Same reason — they belong to a system, not a measure.
   * - **Ghosts and highlight nodes.** Overlays; they are re-applied after the render.
   *
   * The maps are cleared wholesale and then *replayed* for reused measures, rather than being
   * selectively pruned. Replay is O(what a measure holds); a selective prune would be O(everything)
   * per measure, which is quadratic over the score.
   */
  private clearForRender(reusable: Set<string>): void {
    const svg = this.getSVGElement()
    if (svg) {
      for (const child of Array.from(svg.children)) {
        const id = child.getAttribute('id') ?? ''
        // `openGroup` prefixed it: 'vf-m7-s2' → 'm7-s2'.
        const groupKey = id.startsWith('vf-m') ? id.slice(3) : null
        if (groupKey && reusable.has(groupKey)) continue
        svg.removeChild(child)
      }
    }

    this.resetPerRenderState()
    // NOT measureLayoutInfo. It is ASSIGNED (`this.measureLayoutInfo = measureWidths`) earlier in
    // this same render, so clearing it here would empty the very layout we just computed — and the
    // ghost note, which is an overlay drawn against the last render's layout (P4), would find an
    // empty map and silently draw nothing. The old `clear()` ran BEFORE that assignment; this runs
    // after it. Every render reassigns it, so there is nothing to clear.
    // Cleared, not merely overwritten: a DELETED measure's bounds used to linger here for the life
    // of the renderer, because nothing ever removed them.
    this.measureBounds.clear()
    this.snapshots = new Map()
  }

  /**
   * The per-render bookkeeping BOTH clear paths ({@link clear} and {@link clearForRender}) wipe:
   * the element registry and every object map keyed by the SVG nodes being torn down. Extracted
   * so adding a map means remembering ONE site, not two. Each caller then handles its own genuine
   * differences — SVG teardown policy, `measureLayoutInfo`, `measureBounds`, `snapshots`.
   *
   * ⚠️ **A map cleared here has THREE sites, not one.** Measures are REUSED: a bar whose shape key
   * is unchanged is not redrawn, so whatever this wipes must also be captured into its
   * {@link MeasureSnapshot} and restored by {@link restoreMeasureFromSnapshot} — or it is simply
   * gone for every bar that did not repaint, and only for those. That is what happened to the fan
   * members' groups: selection kept working (the registry slice IS restored) while the highlight
   * silently stopped.
   */
  private resetPerRenderState(): void {
    this.elementRegistry.clear()
    this.staveNoteMap.clear()
    this.fanMemberGroupMap.clear()
    this.fanMemberAnchorMap.clear()
    this.tupletObjectMap.clear()
    this.dynamicObjectMap.clear()
    this.slurGroupMap.clear()
    this.tieGroupMap.clear()
    this.measureGroups.clear()
  }

  /**
   * Restore one measure that this render chose NOT to redraw. Its `<g>` is already in the DOM, so
   * only the bookkeeping the wholesale clear just wiped has to come back — and, if the measure
   * **moved**, the group is translated into its new place rather than re-engraved (P5.4b).
   *
   * `(dx, dy)` is measured from where the group was *painted*, never from where it was last seen, so
   * the `transform` is always absolute and a bar that moves on every frame of a drag accumulates no
   * drift. The snapshot itself is never mutated: its coordinates stay the drawn ones.
   *
   * Every consumer of geometry must see the moved coordinates, not the drawn ones — the registry
   * (hit-testing), the staff geometry (pixel↔pitch) and the measure bounds (CoordinateMapper). Miss
   * one and the glyph and its hit-box part company. See `offsetElement` for why that is guarded by a
   * test rather than by care.
   */
  private replaySnapshot(
    groupKey: string,
    snapshot: MeasureSnapshot,
    plan: Omit<MeasurePlacement, 'stave'>,
    dx: number,
    dy: number,
  ): void {
    const moved = dx !== 0 || dy !== 0

    if (moved && snapshot.group) {
      snapshot.group.setAttribute('transform', `translate(${dx}, ${dy})`)
    } else if (snapshot.group) {
      // Back at its drawn position (a drag returning to baseline) — drop any stale transform.
      snapshot.group.removeAttribute('transform')
    }

    this.elementRegistry.addAll(snapshot.elements, dx, dy)

    if (snapshot.staffGeometry) {
      this.elementRegistry.setStaffGeometry(
        moved ? offsetStaffGeometry(snapshot.staffGeometry, dx, dy) : snapshot.staffGeometry,
      )
    }

    if (snapshot.bounds) {
      const bounds = snapshot.bounds
      this.measureBounds.set(snapshot.measureNumber, {
        ...bounds,
        measureX: bounds.measureX + dx,
        measureY: bounds.measureY + dy,
        noteStartX: bounds.noteStartX + dx,
        noteEndX: bounds.noteEndX + dx,
        // NOT from the snapshot. The system's height is not part of a measure's SHAPE, so a
        // staff-spacing drag changes it while every bar reuses its group — and a stale height would
        // leave pixelToMeasure's vertical band describing the layout as it used to be.
        systemHeight: plan.systemHeight,
      })
    }

    // The VexFlow objects keep their DRAWN coordinates. That is safe because a measure holding a
    // span anchor is never translated (see spanAnchorMeasures) — nothing reads these for a moved
    // measure's absolute position.
    for (const [id, value] of snapshot.staveNotes) this.staveNoteMap.set(id, value)
    for (const [id, value] of snapshot.fanMembers) this.fanMemberGroupMap.set(id, value)
    for (const [id, value] of snapshot.fanMemberAnchors) this.fanMemberAnchorMap.set(id, value)
    for (const [id, value] of snapshot.tuplets) this.tupletObjectMap.set(id, value)
    for (const [id, value] of snapshot.dynamics) this.dynamicObjectMap.set(id, value)

    if (snapshot.group) this.measureGroups.set(groupKey, snapshot.group)
    this.snapshots.set(groupKey, snapshot)
  }

  /**
   * The entries a measure contributed to an id-keyed map. Driven by the measure's OWN ids (its
   * slots, its pitches, or an explicit list) rather than by diffing the map — a diff is O(map) per
   * measure, and the map holds the whole score.
   */
  private captureById<T>(view: Measure, map: Map<string, T>, explicitIds?: string[]): [string, T][] {
    const ids = explicitIds ?? [
      ...view.slots.map(s => s.id),
      ...view.slots.flatMap(s => (s.type === 'chord' ? s.notes.map(n => n.id) : [])),
    ]
    const captured: [string, T][] = []
    for (const id of ids) {
      const value = map.get(id)
      if (value !== undefined) captured.push([id, value])
    }
    return captured
  }

  /** The rendered SVG group (`<g class="vf-slur">`) for a slur, or null. Scoped
   *  highlight uses this to recolor exactly one slur. Must be called after a render. */
  getSlurSVGGroup(slurId: string): SVGGElement | null {
    return this.slurGroupMap.get(slurId) ?? null
  }

  /** The rendered SVG group (`<g class="vf-tie">`) for a tie, keyed by its from-note id,
   *  or null. Scoped highlight uses this to recolor exactly one tie without a document-wide
   *  bbox path-scan (which bled onto staff lines). Must be called after a render. */
  getTieSVGGroup(fromNoteId: string): SVGGElement | null {
    return this.tieGroupMap.get(fromNoteId) ?? null
  }

  /**
   * Render a dangling (pending) tie from a note with no target yet.
   * Draws a partial arc extending to the right — same as the first half of a cross-barline tie.
   */
  renderPendingTie(noteId: string, score: Score): void {
    if (!this.context) return
    const info = this.staveNoteMap.get(noteId)
    if (!info) return

    // Find the NotePitch and its containing chord/measure
    let foundNotePitch: import('@/types/music').NotePitch | undefined
    let foundBeat: Fraction | undefined
    let foundMeasure: Measure | undefined

    outer: for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'chord') {
          const p = slot.notes.find(n => n.id === noteId)
          if (p) {
            foundNotePitch = p
            foundBeat = slot.beat
            foundMeasure = measure
            break outer
          }
        }
      }
    }

    if (!foundNotePitch || !foundBeat || !foundMeasure) return

    const tieDirection = getTieDirection(foundNotePitch, foundBeat, foundMeasure)
    const pendingTie = new StaveTie({
      firstNote: info.staveNote,
      firstIndexes: [info.noteIndex],
    })
    if (tieDirection !== undefined) {
      pendingTie.setDirection(tieDirection)
    }
    pendingTie.setContext(this.context).draw()
  }

  /**
   * Clear the canvas content without removing the SVG element
   */
  clear(): void {
    // According to VexFlow best practices, we should keep the SVG element
    // and only clear its contents, not remove the element itself
    const svg = this.getSVGElement()
    if (svg) {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild)
      }
    }
    // The registry + object maps (the measure groups just went with the SVG above).
    this.resetPerRenderState()
    // Full teardown clears the layout too — unlike clearForRender, nothing has reassigned
    // measureLayoutInfo mid-render here.
    this.measureLayoutInfo.clear()
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }

  /**
   * Get the rendered SVG nodes for a note/rest needed to recolor exactly this note
   * (the basis for a bleed-free selection highlight). Must be called after a render
   * (the map and DOM ids are rebuilt each render).
   *
   * - `group`: the note's `<g class="vf-stavenote">` — VexFlow draws its ledger lines,
   *   noteheads and flag inside it (and its stem too, when the note is NOT beamed).
   * - `noteIndex`: the selected pitch's key index within the chord (low→high), matching
   *   the DOM order of the notehead subgroups.
   * - `stem`: the note's stem group, resolved by identity via the Stem object. A beamed
   *   note's stem is drawn by the Beam (inside `<g class="vf-beam">`, NOT the note's
   *   group), so this is the only reliable way to recolor a beamed note's stem.
   */
  /**
   * The SVG group holding ONE FANNED MEMBER's ink — its head, its accidental, its ledger lines and
   * its stem — plus which head inside it belongs to this pitch id. Null for anything that is not a
   * member (see {@link getStaveNoteSVGGroup} for those).
   *
   * ⭐ A member's whole picture is drawn by us into one group, so a selected member recolours the
   * ordinary way. The "paint a highlight, don't recolour it" lesson (the barline) is about ink you
   * do NOT own; this ink is ours.
   */
  getFanMemberSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number } | null {
    return this.fanMemberGroupMap.get(noteId) ?? null
  }

  getStaveNoteSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number; stem: SVGGElement | null } | null {
    const info = this.staveNoteMap.get(noteId)
    if (!info) return null
    const group = info.staveNote.getSVGElement?.()
    if (!group) return null
    const stem = info.staveNote.getStem?.()?.getSVGElement?.() ?? null
    return {
      group: group as unknown as SVGGElement,
      noteIndex: info.noteIndex,
      stem: (stem as unknown as SVGGElement) ?? null,
    }
  }

  /**
   * Get the rendered SVG group (`<g class="vf-tuplet">`) for a tuplet, containing its
   * bracket and number. Lets the selection highlight recolor exactly this tuplet
   * without a document-wide scan (which bled into neighbouring systems).
   * Must be called after a render.
   */
  getTupletSVGGroup(tupletId: string): SVGGElement | null {
    const group = this.tupletObjectMap.get(tupletId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /**
   * Get the rendered SVG group (`<g class="vf-annotation">`) for a dynamic, so the
   * selection highlight (Phase 6) can recolor exactly this dynamic without a
   * document-wide scan. Must be called after a render. Mirrors getTupletSVGGroup.
   */
  getDynamicSVGGroup(dynamicId: string): SVGGElement | null {
    const group = this.dynamicObjectMap.get(dynamicId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /** Suppress one dynamic from the next renders (pass null to restore). Used by the
   *  in-canvas text editor so the engraved glyph isn't drawn under the overlay. The
   *  caller must trigger a re-render for this to take effect. */
  /** The `<g>` a tempo mark was drawn into (see TempoLayout — we open it ourselves;
   *  StaveTempo opens none). Used by the selection highlight. */
  getTempoSVGGroup(tempoId: string): SVGGElement | null {
    const svg = this.context?.svg as SVGSVGElement | undefined
    return (svg?.querySelector(`#vf-${tempoId}`) as SVGGElement | null) ?? null
  }

  /** Suppress one tempo mark from the next renders (pass null to restore) — the text-edit
   *  overlay's twin of {@link setSuppressedDynamicId}. */
  setSuppressedTempoId(tempoId: string | null): void {
    this.suppressedTempoId = tempoId
  }

  setSuppressedDynamicId(dynamicId: string | null): void {
    this.suppressedDynamicId = dynamicId
  }

  /**
   * Render score with an optional ghost note overlay (preview note during mouse hover)
   * Returns true if ghost note was rendered
   */
  /**
   * Draw the note ghost as an **overlay** on the already-rendered score (P4). The layout it
   * needs — `measureLayoutInfo` — is still sitting on the renderer from the last real render,
   * so following the cursor costs one small draw, not a re-layout of every bar.
   *
   * The caller (MusicEngine) guarantees the score underneath is current; if nothing has ever
   * been rendered there is no layout to place the ghost against, so it declines to draw.
   */
  drawGhostNote(score: Score, ghostNote: GhostNote): boolean {
    this.clearGhosts()
    if (this.measureLayoutInfo.size === 0) return false
    return this.renderGhostNoteWithDynamicWidths(
      ghostNote,
      score,
      this.measureLayoutInfo,
      LAYOUT_CONFIG.MARGIN,
      LAYOUT_CONFIG.STAVE_HEIGHT,
      LAYOUT_CONFIG.VERTICAL_SPACING,
    )
  }

  /**
   * Render the score, then overlay a free-floating translucent ghost clef that
   * follows the cursor (like the ghost note). The clef glyph is drawn alone (via
   * a 0-line stave so no staff lines appear), wrapped in a `.ghost-clef-group`
   * for CSS tinting, and translated so its center sits at the cursor.
   * @returns true if the ghost clef was drawn
   */
  /**
   * Overlay a free-floating translucent ghost REST that follows the cursor — the preview for the
   * armed rest stamp. Drawn as a real rest {@link StaveNote} of the armed duration + dots, on a
   * 0-line stave (so no staff lines come with it), then translated to the cursor: the same trick
   * the clef ghost uses, because both are one glyph shown loose rather than engraved in a bar.
   *
   * A real StaveNote and not a bare glyph, because the ghost must answer "how long, and dotted?" —
   * the two things a rest IS. VexFlow draws the dots at the right offset for each duration; hand-
   * placing them would be inventing a rule the font already knows.
   *
   * THE ATTACH LINE. A whole and a half rest are the same rectangle: what tells them apart is that
   * a whole rest HANGS from a line and a half rest SITS on one. Floating at the cursor, the ghost
   * touches no line at all, so both would read the same — a coin-flip on the most basic choice the
   * tool offers. So for the line-attached rests (whole/half, dotted or not) the ghost draws the ONE
   * line it attaches to, exactly as the score does for a rest a shift has pushed off the staff
   * (drawRestLedgerLines / restSupportingLedgerLine). Shorter rests are not line-attached and get
   * nothing — an eighth rest is unmistakable on its own.
   *
   * @returns true if the ghost rest was drawn
   */
  renderScoreWithRestGhost(cursorX: number, cursorY: number, duration: NoteDuration, dots: number): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false

    try {
      const childrenBefore = svg.children.length

      // A 0-line stave draws nothing itself, and gives the rest something to be positioned against.
      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context)

      // 'b/4' anchors a rest to the middle line under the default clef — the same key NoteBuilder
      // uses, so the ghost is positioned by the same rule as the real thing.
      const rest = new StaveNote({ keys: ['b/4'], duration: convertDuration(duration, dots) + 'r' })
      for (let d = 0; d < dots; d++) Dot.buildAndAttach([rest], { all: true })
      rest.setStave(tempStave)
      rest.setContext(this.context)

      // A voice+formatter gives the note a tickcontext (it will not draw without one).
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickable(rest)
      new Formatter().joinVoices([voice]).format([voice], 100)
      rest.draw()

      // The attach line, for the two rests that have one — drawn with the glyph so it travels with
      // it under the transform below.
      const line = restSupportingLedgerLine(duration, false, rest.getLineForRest())
      if (line !== null || duration === 'w' || duration === 'h') {
        const xBegin = rest.getNoteHeadBeginX()
        const xEnd = rest.getNoteHeadEndX()
        const PAD = 3 // px the line overhangs the glyph on each side — reads as a staff line, not a strike-through
        const y = tempStave.getYForNote(rest.getLineForRest())
        this.context.beginPath()
        this.context.moveTo(xBegin - PAD, y)
        this.context.lineTo(xEnd + PAD, y)
        this.context.stroke()
      }

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) newElements.push(svg.children[i])
      if (newElements.length === 0) return false

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-rest-group')
      for (const el of newElements) svg.removeChild(el)
      for (const el of newElements) group.appendChild(el)
      svg.appendChild(group)

      // Park it clear of the pointer — LEFT and UP — rather than centred on it, which buries the
      // glyph under the arrow (whose body extends down-right from its tip). The same reason the
      // accidental ghost parks left and the dot ghost right-and-up: a ghost you cannot see is not a
      // preview. Up matters more here than for those two, because the rest is a solid block and the
      // arrow sits squarely on it.
      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const GAP_X = 5
        const LIFT_Y = 10
        const dx = cursorX - GAP_X - (gbox.x + gbox.width / 2)
        const dy = cursorY - LIFT_Y - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (_e) {
      return false
    }
  }

  renderScoreWithClefGhost(cursorX: number, cursorY: number, clef: Clef): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw just the clef glyph: a stave with 0 lines and no barlines renders
      // only the clef modifier. Initial position is arbitrary — we reposition below.
      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addClef(clef)
      tempStave.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }
      if (newElements.length === 0) return false

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-clef-group')
      for (const el of newElements) svg.removeChild(el)
      for (const el of newElements) group.appendChild(el)
      svg.appendChild(group)

      // Center the glyph on the cursor so it tracks the mouse freely.
      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost time signature that
   * follows the cursor (mirrors {@link renderScoreWithClefGhost}). Draws just the
   * TS glyph on a 0-line stave, wrapped in a `.ghost-timesig-group` for CSS
   * tinting, translated so its centre sits at the cursor.
   * @returns true if the ghost time signature was drawn
   */
  renderScoreWithTimeSignatureGhost(cursorX: number, cursorY: number, ts: TimeSignature): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addTimeSignature(timeSignatureVexKey(ts))
      tempStave.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }
      if (newElements.length === 0) return false

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-timesig-group')
      for (const el of newElements) svg.removeChild(el)
      for (const el of newElements) group.appendChild(el)
      svg.appendChild(group)

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost dynamic that follows
   * the cursor (mirrors {@link renderScoreWithClefGhost}). Builds the real dynamic
   * Annotation (level glyph in the music font, or custom italic text) on a
   * throwaway note, then keeps only the annotation's SVG group — discarding the
   * temp stave/notehead — wrapped in a `.ghost-dynamic-group` and centred on the
   * cursor. On click the mark is applied to the clicked slot (see MouseController).
   *
   * GOTCHA (font-size inheritance): a dynamic level glyph's `<text>` is emitted
   * with NO explicit `font-size` — VexFlow lets it inherit the size from its
   * ancestors in the score's SVG tree. Re-parenting that `<text>` to a group at
   * the SVG root (as we do here) breaks the inheritance chain, so the glyph would
   * collapse to the browser default (~16px) and look tiny next to a placed mark.
   * We therefore re-apply the annotation's resolved font on the wrapper group
   * below. This is a pure SVG/VexFlow behaviour, unrelated to the UI framework.
   * @returns true if the ghost dynamic was drawn
   */
  /**
   * Render the score with a GHOST tempo mark following the cursor — the preview for the
   * armed tempo tool, mirroring the clef / time-signature / dynamic ghosts. Without it the
   * note-entry ghost is shown while a tempo tool is armed, which says the wrong thing about
   * what the next click will do.
   *
   * Simpler than the dynamic ghost: a dynamic must be hung off a throwaway StaveNote (it is a
   * note modifier), whereas a tempo mark is text painted straight onto the context — so there are
   * no leftover notehead/stem elements to discard afterwards, and no stave is needed at all. It
   * is drawn by the same `drawTempoText` the score uses, so the preview cannot drift from it.
   */
  renderScoreWithTempoGhost(cursorX: number, cursorY: number, mark: TempoMark): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false
    if (!mark.text) return false // nothing to preview (a mark that only sounds)

    try {
      const group = this.context.openGroup('ghost-tempo') as SVGGElement
      try {
        // Drawn at the origin and translated into place below, once its real size is known.
        drawTempoText(this.context, mark.text, 0, cursorY)
      } finally {
        this.context.closeGroup()
      }

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (!gbox || gbox.width === 0) {
        group.remove()
        return false
      }

      // Paint it in the ghost blue (the same colour the ghost note uses) at 0.7 opacity —
      // it is a preview, not yet content.
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('text, path').forEach(el => {
        if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
      })

      // Start at the cursor horizontally (that is where the mark will anchor) and center
      // it vertically on the pointer, so the preview reads as "this lands here".
      const dx = cursorX - gbox.x
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
      return true
    } catch {
      return false
    }
  }

  renderScoreWithDynamicGhost(cursorX: number, cursorY: number, dynamic: Dynamic): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw the annotation on a throwaway quarter note. The note/stave glyphs are
      // discarded below; we keep only the annotation's SVG group.
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context!)

      const annotation = buildDynamicAnnotation(dynamic)
      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave)
      note.addModifier(annotation, 0)

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150)
      voice.draw(this.context!, tempStave)

      const annoEl = annotation.getSVGElement?.() as SVGGElement | undefined
      // Enlarge the glyph run(s) just like the score pass does (the annotation is drawn at the
      // small text size for a shared baseline), so the ghost matches what will be placed.
      const annoText = annoEl?.querySelector?.('text') as SVGTextElement | null
      if (annoText) enlargeDynamicGlyphRuns(annoText, dynamic)

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('class', 'ghost-dynamic-group')
      // The dynamic glyph's <text> carries no explicit font-size — it inherits it
      // from its ancestors in the score. Extracting it to the SVG root breaks that
      // chain (the glyph would shrink to the browser default), so re-apply the
      // annotation's resolved font on the group for the <text> to inherit.
      const f = annotation.fontInfo
      if (f) {
        group.setAttribute('font-family', f.family)
        group.setAttribute('font-size', typeof f.size === 'number' ? `${f.size}pt` : String(f.size))
        if (f.style) group.setAttribute('font-style', f.style)
      }
      // Move just the annotation group out (detaches it from the note's group)…
      if (annoEl) group.appendChild(annoEl)
      // …then discard the leftover temp stave/notehead/stem elements.
      for (const el of newElements) {
        if (el.parentNode === svg) svg.removeChild(el)
      }
      if (!annoEl) return false

      svg.appendChild(group)

      // Centre the glyph on the cursor so it tracks the mouse freely.
      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (gbox && gbox.width > 0) {
        const dx = cursorX - (gbox.x + gbox.width / 2)
        const dy = cursorY - (gbox.y + gbox.height / 2)
        group.setAttribute('transform', `translate(${dx}, ${dy})`)
      }

      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost articulation (accent/staccato/tenuto
   * glyph) that follows the cursor — the preview for the armed articulation stamp tool. On click the
   * articulation is added to the clicked note (see MouseController).
   *
   * Unlike the dynamic ghost, we do NOT keep the modifier's own SVG group and discard a temp note:
   * an Articulation's `draw()` opens no group of its own (it renders straight onto the context via
   * `renderText`, and normally lands INSIDE the note's `vf-stavenote` group), so there is nothing to
   * extract. Instead — like the tempo ghost — we open OUR group, draw ONLY the articulation into it,
   * and close: `note.setStave()` populates the note's Y-values and `Formatter.format()` its tick
   * position, which is everything `Articulation.draw()` reads, so it renders standalone without the
   * note ever being drawn. The group carries VexFlow's `vf-` prefix (→ `.vf-ghost-articulation`,
   * registered in {@link GHOST_GROUP_SELECTOR}).
   *
   * ADDITIVE: `types` may hold more than one armed articulation; they are drawn STACKED (sorted by
   * {@link ARTICULATION_RENDER_ORDER}, an explicit `textLine` per glyph) exactly as a real note with
   * several articulations engraves — so the ghost reads as everything the click will stamp.
   * @returns true if a ghost articulation was drawn
   */
  renderScoreWithArticulationGhost(cursorX: number, cursorY: number, types: ArticulationType[]): boolean {
    this.clearGhosts() // P4: an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context || types.length === 0) return false

    try {
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context)

      const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      const sorted = types.slice().sort(
        (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
      )
      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave) // populates note.ys (what Articulation.draw reads for its Y)
      const articulations = sorted.map(t => {
        const art = new Articulation(articulationVexCodes[t]).setPosition(Modifier.Position.ABOVE)
        note.addModifier(art, 0) // attaches the note to the modifier (checkAttachedNote)
        return art
      })

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
      note.setStave(tempStave)

      const group = this.context.openGroup('ghost-articulation') as SVGGElement
      try {
        // Stack them: an explicit textLine per glyph so multiple armed articulations don't overlap
        // (we draw the modifiers by hand, so the note's ModifierContext isn't doing the spacing).
        articulations.forEach((art, i) => art.setTextLine(i).setContext(this.context!).draw())
      } finally {
        this.context.closeGroup()
      }

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (!gbox || gbox.width === 0) {
        group.remove()
        return false
      }

      // Paint it the ghost blue at 0.7 opacity — a preview, not yet content (mirrors the tempo ghost).
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('text, path').forEach(el => {
        if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
      })

      // Centre the glyph on the cursor horizontally, but lift it a few px so the lowest glyph
      // (staccato) doesn't sit right under the pointer — a small breathing gap reads cleaner.
      const CURSOR_GAP_PX = 8
      const dx = cursorX - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2) - CURSOR_GAP_PX
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Draw ONE translucent ghost accidental (♯/♭/♮) following the cursor — the preview for the armed
   * accidental stamp tool. Same standalone-draw approach as {@link renderScoreWithArticulationGhost}:
   * an `Accidental`'s `draw()` reads its note's stave-Y (`setStave`) and formatted tick-X
   * (`Formatter.format`) but opens no group of its own, so we attach it to a throwaway note, format,
   * then draw ONLY the accidental into OUR `vf-`-prefixed group (`.vf-ghost-accidental`, in
   * {@link GHOST_GROUP_SELECTOR}) — the note itself is never drawn. Single-valued: a note has one
   * accidental, so there is nothing to stack.
   * @returns true if a ghost accidental was drawn
   */
  renderScoreWithAccidentalGhost(cursorX: number, cursorY: number, accidental: ScoreAccidental): boolean {
    this.clearGhosts() // an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false

    try {
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context)

      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave) // populates note.ys (what Accidental.draw reads for its Y)
      const acc = new Accidental(accidental) // '#' | 'b' | 'n' are VexFlow accidental codes as-is
      note.addModifier(acc, 0) // attaches the note to the modifier (checkAttachedNote)

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
      note.setStave(tempStave)

      const group = this.context.openGroup('ghost-accidental') as SVGGElement
      try {
        acc.setContext(this.context).draw()
      } finally {
        this.context.closeGroup()
      }

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (!gbox || gbox.width === 0) {
        group.remove()
        return false
      }

      // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('text, path').forEach(el => {
        if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
      })

      // Park it to the LEFT of the pointer rather than centred on it — an accidental is engraved to
      // the left of its notehead, so this reads as where the sign will land (the mirror of the dot
      // ghost, which sits right for the same reason), and the arrow stops covering the very glyph
      // it is previewing. Covers all three signs: ♯ ♭ ♮ share this one draw.
      const GAP_X = 10
      const dx = cursorX - GAP_X - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Draw the translucent ghost tremolo STROKES following the cursor — the preview for the armed
   * tremolo stamp. Same standalone-draw recipe as {@link renderScoreWithArticulationGhost}: a
   * throwaway note + stave, `setStave` then `Formatter.format` (between them they populate
   * everything the modifier's `draw()` reads), then draw ONLY the modifier into OUR `vf-`-prefixed
   * group (`.vf-ghost-tremolo`, registered in {@link GHOST_GROUP_SELECTOR} — a group missing from
   * that list is never taken down, and the ghost smears a trail across the score).
   *
   * The ghost is the **real mark**, not the palette's picture: the dev palette draws a note wearing
   * its strokes because a button has to be recognisable, while this draws exactly what the click
   * adds — N copies of `tremolo1`, or the single Penderecki sign. It takes the {@link TremoloMark}
   * rather than a count precisely so those two cannot diverge: one modifier, one placement.
   *
   * ⚠️ Where this differs from every sibling ghost: an `Articulation` positions itself off the
   * NOTEHEAD, but `Tremolo` positions itself off `note.getStemExtents().topY` — so the strokes land
   * far above the throwaway note's origin. The bbox-centring below absorbs that on purpose: it
   * measures where the glyphs ACTUALLY landed and moves the whole group from there, so the offset
   * never has to be known.
   * @returns true if a ghost tremolo was drawn
   */
  renderScoreWithTremoloGhost(cursorX: number, cursorY: number, mark: TremoloMark): boolean {
    this.clearGhosts() // an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false

    try {
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context)

      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave) // populates the note's Y values (Tremolo.draw reads its stem extents)
      const tremolo = new CenteredTremolo(mark)
      note.addModifier(tremolo, 0) // attaches the note to the modifier (checkAttachedNote)

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
      note.setStave(tempStave)

      const group = this.context.openGroup('ghost-tremolo') as SVGGElement
      try {
        tremolo.setContext(this.context).draw()
      } finally {
        this.context.closeGroup()
      }

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (!gbox || gbox.width === 0) {
        group.remove()
        return false
      }

      // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('text, path').forEach(el => {
        if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
      })

      // Centred on the pointer: the strokes ride the STEM, so there is no notehead side for them to
      // sit off — unlike the accidental (left) and dot (right) ghosts, which preview a horizontal
      // relationship to the note they will join.
      const dx = cursorX - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Draw ONE translucent ghost tie following the cursor — the preview for the armed tie stamp tool.
   * A tie is a RELATION between two notes, not a glyph, so there is no `draw()` to borrow the way
   * the articulation/accidental ghosts borrow theirs. Instead it is engraved as a REAL tie: the same
   * {@link drawCurveArc} primitive, with the same {@link TIE_BOW} / {@link CURVE_THICKNESS} an
   * engraved tie uses — a proper cubic that swells at the belly and pinches to a point at each tip.
   * Change those constants and the ghost follows. It says "tie tool armed" and no more: WHICH note
   * ties to WHICH is resolved at click time by {@link MusicEngine.toggleTie} (and logged there),
   * never previewed.
   *
   * `Curve.renderCurve` reads only its params and `renderOptions` — `from`/`to` are used by `draw()`
   * alone, which we never call — so one throwaway note satisfies the constructor without touching
   * the arc. It bows DOWNWARD (direction +1), matching the Keypad's tie key, so the armed tool and
   * the lit key read as one thing, and it STARTS at the cursor rather than straddling it: a tie
   * begins at the note you click and reaches forward, so its head is the part that follows the mouse.
   *
   * STROKED, not filled — so it paints `stroke` where the other ghosts paint `fill`. But like them
   * it paints through the **DOM, after the draw, never the context**. `save()`/`restore()` do work
   * now (they were stubbed for years — see {@link initialize}), so a scoped `setStrokeStyle` would
   * no longer leak; the DOM is still the right answer here, because `openGroup` stamps the context's
   * attributes onto the `<g>` at the moment it opens, and because painting the node afterwards is
   * what lets a ghost recolour without re-engraving.
   * Positioned by absolute path coordinates, so it needs no bbox measure or `translate` either.
   * @returns true if a ghost tie was drawn
   */
  renderScoreWithTieGhost(cursorX: number, cursorY: number): boolean {
    this.clearGhosts() // an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false

    try {
      // The arc BEGINS at the cursor and runs to the right, rather than being centred on it — a tie
      // starts at the note you click and reaches forward to the next, so its head belongs where the
      // click will land. Nudged clear of the pointer on both axes so the arrow doesn't cover it.
      const WIDTH = 20      // a short tie — roughly the span between two adjacent noteheads
      const START_GAP_PX = 4
      const LIFT_PX = 4
      const DIRECTION = 1   // +1 = below/sagging, like the Keypad's tie key
      const x0 = cursorX + START_GAP_PX
      const y = cursorY - LIFT_PX

      // Throwaway anchor: renderCurve never reads it (see above), it only satisfies the ctor.
      const anchor = new StaveNote({ keys: ['b/4'], duration: 'q' })
      const cps: [{ x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: TIE_BOW },
        { x: 0, y: TIE_BOW },
      ]

      const group = this.context.openGroup('ghost-tie') as SVGGElement
      try {
        drawCurveArc(
          { context: this.context },
          { x: x0, y }, { x: x0 + WIDTH, y },
          cps, DIRECTION, CURVE_THICKNESS, anchor, anchor,
        )
      } finally {
        this.context.closeGroup()
      }

      // Paint it ghost blue at 0.7 opacity through the DOM — a preview, not yet content (mirrors
      // the other ghosts), and never through the context: see the note above. `renderCurve` strokes
      // AND fills, so each emitted path carries both and both must be overridden, or the ghost shows
      // a blue body with a black outline (the same rule as HighlightController.colorTieGroup).
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('path').forEach(p => {
        p.setAttribute('fill', '#3B82F6')
        p.setAttribute('stroke', '#3B82F6')
      })
      return true
    } catch (_e) {
      return false
    }
  }

  /**
   * Draw ONE translucent ghost augmentation dot at the cursor — the preview for the armed dot stamp
   * tool. Same standalone-draw approach as {@link renderScoreWithAccidentalGhost}: a `Dot` is a
   * Modifier whose `draw()` reads its note's stave-Y (`setStave`) and formatted tick-X
   * (`Formatter.format`) but opens no group of its own, so we attach it to a throwaway note, format,
   * then draw ONLY the dot into OUR `vf-`-prefixed group (`.vf-ghost-dot`, in
   * {@link GHOST_GROUP_SELECTOR}) — the note itself is never drawn. Valueless: the dot is on or off,
   * so there is nothing to stack or swap.
   * @returns true if a ghost dot was drawn
   */
  renderScoreWithDotGhost(cursorX: number, cursorY: number): boolean {
    this.clearGhosts() // an overlay — take the old ghost down, leave the score alone

    const svg = this.getSVGElement()
    if (!svg || !this.context) return false

    try {
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context)

      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave) // populates note.ys (what Dot.draw reads for its Y)
      Dot.buildAndAttach([note], { all: true })
      const dot = note.getModifiers().find(m => m.getCategory() === 'Dot')
      if (!dot) return false

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
      note.setStave(tempStave)

      const group = this.context.openGroup('ghost-dot') as SVGGElement
      try {
        dot.setContext(this.context).draw()
      } finally {
        this.context.closeGroup()
      }

      const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
      if (!gbox || gbox.width === 0) {
        group.remove()
        return false
      }

      // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
      group.setAttribute('opacity', '0.7')
      group.querySelectorAll('text, path').forEach(el => {
        if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
      })

      // Park it clear of the pointer, to the RIGHT and slightly up, rather than centred on it: a dot
      // is ~3px, so the arrow would simply cover it (the arrow's body extends down-right from its
      // tip). Same reason the articulation ghost lifts by CURSOR_GAP_PX and the tie starts right of
      // the cursor. It also reads the way the stamp works — the dot lands to the right of the head.
      const GAP_X = 10
      const LIFT_Y = 4
      const dx = cursorX + GAP_X - (gbox.x + gbox.width / 2)
      const dy = cursorY - LIFT_Y - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
      return true
    } catch (_e) {
      return false
    }
  }
}
