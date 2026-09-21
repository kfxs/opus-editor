/**
 * ⭐⭐ **A STAFF ON A SPINE — lines drawn FROM the path, notes placed ON it**
 * (`docs/plans/bent-staff-plan.md` A4). The first ink in this engine whose placement is not a scale
 * or a translation.
 *
 * Each note is a RIGID BLOCK: built and formatted ALONE, upright, by the score's own classes
 * (`ghosts/loneNote` — the pipeline every cursor ghost already uses), drawn into its OWN group, and
 * that group placed by ONE affine from `engrave/staff/staffSpine.placementAt`. That call is *Belle,
 * Bonne, Sage*'s `belle-placement.h:354` as ours — the one line where a musical position becomes a
 * page position — and ⛔ nothing here deforms a glyph, a stem or a ledger line: the *Bike Ride* plate
 * deforms none.
 *
 * ⚠️ **This is the machinery's own small drawing, ⛔ not the score's render path**: it reads no
 * `Score`, registers nothing in the `ElementRegistry`, and knows no bars, beams, ties or spans. Those
 * are plan B — the real score asking the spine, one reader at a time.
 *
 * The spine is the staff's TOP line (`StaffFrame.topLineY`'s convention), and a note's `s` is where
 * its notehead's centre stands along it.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { compose, rotationAbout, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { placementAt, pointAt } from '@/engine/engrave/staff/staffSpine'
import { drawSpineLines } from '@/engine/engrave/staff/spineLines'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import { staveLineWidthPx } from '@/engine/engrave/staff/staffLines'
import type { Clef, NoteDuration, PitchAlter, PitchStep, TimeSignature } from '@/types/music'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import { spellingDiatonicPos, spellingToNoteKey } from '@/utils/pitchSpelling'
import { EngravedClef } from '../engraved/EngravedClef'
import { EngravedBeam, drawBeamInkThrough } from '../engraved/EngravedBeam'
import { EngravedNote, drawNoteInkThrough } from '../engraved/EngravedNote'
import { EngravedStave } from '../engraved/EngravedStave'
import { EngravedTimeSignature } from '../engraved/EngravedTimeSignature'
import { noteRuler } from '../engraved/noteRuler'
import { BarVoice } from '../format/barVoice'
import { formatColumns } from '../format/columnFormat'
import { attachModifierColumns } from '../format/modifierColumns'
import { formatLoneNote } from '../ghosts/loneNote'
import { drawGroupOf } from '../painter/svgDrawGroup'
import type { BarlineSignKind } from '@/engine/layout/barlineSign'
import { ledgerLineStyle } from '@/engine/layout/layoutConfig'
import { paintBarlineSign } from '../staff/BarlineRenderer'
import { standOn, staveFrame } from '../staff/staveFrame'
import type { StaveSign } from '../staff/staveSign'

/** One note to stand on a spine — a pitch, a length, and where along the spine its head is. */
export interface SpineNote {
  step: PitchStep
  alter: PitchAlter
  octave: number
  duration: NoteDuration
  /** Distance along the spine of the notehead's centre. */
  s: number
}

/** The class of a placed block's group — what a scene reader (and the spec) finds them by. */
export const SPINE_BLOCK_CLASS = 'spine-block'

/** The class of one note's own ink INSIDE a beamed block — the group the local tilt turns. */
export const SPINE_NOTE_CLASS = 'spine-note'

/** The stand-in stave a lone note is formatted on. Only the block's SHAPE survives the placement. */
const BLOCK_STAVE_WIDTH = 200
const BLOCK_FORMAT_WIDTH = 150

/**
 * ⭐ **ANY built note as a rigid block** — formatted ALONE and upright on a stand-in stave, drawn into
 * its own group, and that group placed so the head's centre, on the stave's top line, lands on the
 * spine at `s`. The note may be the score's own (`engraved/NoteBuilder`) — chord, rest, accidentals,
 * dots and all: the block is whatever the note draws.
 */
export function drawNoteBlock(ctx: DrawContext, spine: Spine, engraved: EngravedNote, s: number): void {
  const stave = new EngravedStave(0, 0, BLOCK_STAVE_WIDTH).setOpeningBarline('none').setClosingBarline('none')
  stave.setDefaultLedgerLineStyle(ledgerLineStyle())
  formatLoneNote(engraved, stave, { numerator: 1, denominator: 4 }, BLOCK_FORMAT_WIDTH)

  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  try {
    drawNoteInkThrough([engraved], ctx)
    engraved.setContext(ctx).draw()
  } finally {
    ctx.closeGroup()
  }
  const ruler = noteRuler(engraved)
  const headCentreX = (ruler.headLeftX + ruler.headRightX) / 2
  group?.setPlacement(compose(
    translation(-headCentreX, -staveFrame(stave).topLineY),
    placementAt(spine, s),
  ))
}

/** Draw ONE pitch as a rigid block on `spine` — {@link drawNoteBlock} for a caller with no score. */
/** How far into its block stave a beamed group's first column stands — room for an accidental in front. */
const BLOCK_LEAD_IN_PX = 40

/**
 * ⭐⭐ **A BEAMED GROUP IS ONE RIGID BLOCK** (`docs/plans/bent-staff-plan.md` §6): its notes are formatted
 * TOGETHER on one straight stave, each column set to its distance along the path from the group's
 * first note; the page's own `EngravedBeam` — slope, stem lengths, secondary and fractional beams —
 * is drawn inside; and the block is placed by ONE affine at the group's MIDDLE (a wide block placed by
 * an end leaves the curved lines at the other — the header's lesson). Beams straight, stems parallel:
 * what the *Bike Ride* plate draws.
 *
 * ⭐ Option (b) of the plan — the HEADS RIDE THE PATH: a purely rigid block (option a) leaves its END
 * heads off their lines by the sagitta `L² / 8R`, and once the spine took the page's real spacing a
 * group of four sixteenths was 130 px long on a radius of 160 — 1.3 sp adrift (seen, 2026-09-21). So
 * each note is lowered to where the path is under it; stems stay parallel, the beam straight.
 * ⚠️ What is left: the end heads are upright in the BLOCK's frame, so they are tilted against the
 * lines under them by `L / 2R` — the plate's look, and the price of a straight beam.
 *
 * `notes[i]` stands at `ss[i]` along the spine; `beam` was built over exactly these notes
 * (`beams/beamGroups.buildBeams`), BEFORE this runs, so no note reserves room for a flag.
 */
export function drawBeamedBlock(
  ctx: DrawContext, spine: Spine, notes: readonly EngravedNote[], beam: EngravedBeam, ss: readonly number[],
): void {
  if (notes.length === 0) return
  const middle = (ss[0] + ss[ss.length - 1]) / 2
  // ⭐ Option (b): WHERE the path puts each note, seen from the block — the block's frame is the
  //    path's tangent at the group's middle, so on a straight spine every `y` is 0 and every `x` the
  //    plain distance, and on a curve the ends fall away toward the centre by the sagitta.
  // ⚠️ …asked at each note's OWN DEPTH, not on the top line (his report, 2026-09-21: adjacent blocks
  //    collided). A low head hangs spaces below the spine, and inside the block it hangs along the
  //    BLOCK's down — which at the block's ends is not the path's own down, so deep heads swung
  //    outward by `depth × tilt`, into the next block. So the question is where the path puts the
  //    HEAD, and the note's stave is set so the head lands there.
  const depths = notes.map(headDepth)
  const local = ss.map((s, i) => {
    const head = toBlockSpace(spine, middle, s, depths[i])
    return { x: head.x, y: head.y - depths[i] }
  })
  const span = local[local.length - 1].x - local[0].x

  const voice = new BarVoice({ numerator: 1, denominator: 4 }, 'soft')
  for (const note of notes) voice.add(note)
  attachModifierColumns([voice])
  const columns = formatColumns([voice], span + BLOCK_FORMAT_WIDTH)
  // ⭐ The model's x's, post-format — the same last word `format/spacingPass` has on the page.
  columns.list.forEach((tick, i) => columns.map[tick].setX(BLOCK_LEAD_IN_PX + (local[i].x - local[0].x)))
  // ⭐ Each note stands on ITS OWN stave, lowered by where the path is under it — so every head sits
  //    on its line while the stems stay parallel and the beam, which reads the stems' tips, straight.
  //    None of these staves is drawn: the lines are the path's (`spineLines`).
  notes.forEach((note, i) => {
    const stave = new EngravedStave(0, local[i].y, span + 2 * BLOCK_STAVE_WIDTH)
      .setOpeningBarline('none').setClosingBarline('none')
    stave.setDefaultLedgerLineStyle(ledgerLineStyle())
    standOn(note, stave)
  })

  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  // ⭐ Each note's OWN ink — heads, accidentals, dots, articulations, ledger lines — in a group of its
  //    own, turned below to the path's LOCAL angle. A beamed note draws no stem (the beam draws them
  //    all, `EngravedBeam.drawStems`), so what `note.draw()` paints is exactly what must turn, and the
  //    stems and the beam stay in the block's frame: parallel, and straight.
  const noteGroups: (ReturnType<typeof drawGroupOf>)[] = []
  try {
    drawNoteInkThrough([...notes], ctx)
    for (const note of notes) {
      noteGroups.push(drawGroupOf(ctx.openGroup(SPINE_NOTE_CLASS)))
      try {
        note.setContext(ctx).draw()
      } finally {
        ctx.closeGroup()
      }
    }
    drawBeamInkThrough([beam], ctx)
    beam.setContext(ctx).draw()
  } finally {
    ctx.closeGroup()
  }
  // ⭐⭐ THE LOCAL TILT (plan §8.3). The block stands on the tangent at its MIDDLE, so toward its ends
  //    "beside the head" along the block is not beside it along the ARC: an accidental stood up-left
  //    of its head by `L / 2R` — ≈ 17° for four sixteenths on R ≈ 175 (seen, 2026-09-21). So each
  //    note's ink is turned about the CENTRE of its heads by how far the path has turned between the
  //    block's middle and the note. ⚠️ About the heads' centre and nothing else: that point is where
  //    `local` put the note ON the path (its own depth), and a turn about it moves it nowhere — the
  //    heads stay on their lines. The stem meets a head turned by a few degrees a fraction of a
  //    pixel off its edge, inside the overlap the two already have.
  //    On a straight spine every tilt is 0 and the placement is the identity.
  const blockAngle = spine.at(middle).angle
  notes.forEach((note, i) => {
    const tilt = spine.at(ss[i]).angle - blockAngle
    if (tilt === 0) return
    const ruler = noteRuler(note)
    if (ruler.headYs.length === 0) return
    const cx = (ruler.headLeftX + ruler.headRightX) / 2
    const cy = (Math.min(...ruler.headYs) + Math.max(...ruler.headYs)) / 2
    noteGroups[i]?.setPlacement(rotationAbout(tilt, cx, cy))
  })
  // The block's own point that goes to the group's middle `s`: the first head's centre is `local[0].x`
  // from it along the tangent, and a stave at y = 0 has its top line at `blockFrame().topLineY`… = 0.
  const first = noteRuler(notes[0])
  const middleX = (first.headLeftX + first.headRightX) / 2 - local[0].x
  group?.setPlacement(compose(
    translation(-middleX, -staveFrame(new EngravedStave(0, 0, BLOCK_STAVE_WIDTH)).topLineY),
    placementAt(spine, middle),
  ))
}

/**
 * How far below its stave's top line a note's head stands, px — the middle of a chord's heads. Asked
 * of the note on a stave at y = 0, before it is given the stave it will be drawn on.
 */
function headDepth(note: EngravedNote): number {
  const probe = new EngravedStave(0, 0, BLOCK_STAVE_WIDTH)
  standOn(note, probe)
  const ys = noteRuler(note).headYs
  if (ys.length === 0) return 0
  return (Math.min(...ys) + Math.max(...ys)) / 2 - staveFrame(probe).topLineY
}

/**
 * The path's point at `s` and `depth` below it, in the frame of the block placed at `middle`: x along
 * that block's tangent, y across it.
 */
function toBlockSpace(spine: Spine, middle: number, s: number, depth: number = 0): { x: number; y: number } {
  const origin = spine.at(middle)
  const point = pointAt(spine, s, depth)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const cos = Math.cos(origin.angle)
  const sin = Math.sin(origin.angle)
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
}

export function drawSpineNote(ctx: DrawContext, spine: Spine, note: SpineNote, clef: Clef): void {
  const engraved = new EngravedNote({
    keys: [spellingToNoteKey(note.step, note.alter, note.octave)],
    duration: note.duration,
    clef,
    autoStem: false,
  })
  // The page's own rule for one note: down from the middle line up, up below it.
  engraved.setStemDirection(spellingDiatonicPos(note.step, note.octave) >= middleLineDiatonicPos(clef) ? -1 : 1)
  drawNoteBlock(ctx, spine, engraved, note.s)
}

/** The frame a block is drawn against: the page's own staff, its top line ON the spine. */
const blockFrame = () => ({ ...staveFrame(new EngravedStave(0, 0, BLOCK_STAVE_WIDTH)), topLineY: 0 })

/**
 * ⭐ A header SIGN — a clef, a meter — is a rigid block like a note: the score's own sign class draws
 * it upright at its own origin, and the group is placed so the sign runs from `s` along the spine.
 * Answers how far along the spine it reaches, so the next block knows where it may start.
 */
function drawSpineSign(ctx: DrawContext, spine: Spine, sign: StaveSign, s: number): number {
  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  try {
    sign.drawSign(ctx, blockFrame(), ctx)
  } finally {
    ctx.closeGroup()
  }
  // ⭐ Placed by its MIDDLE, like a note by its head's centre: a straight block on a curved staff
  // leaves its lines toward both ends, and the middle is where that error is halved.
  const width = sign.walkInput().width
  group?.setPlacement(compose(translation(-width / 2, 0), placementAt(spine, s + width / 2)))
  return s + width
}

/**
 * The staff's HEADER from `s` on — the clef, then the meter — and where along the spine it ends.
 * ⚠️ Each sign is preceded by its own walk padding, the page's inherited row; ⛔ not the header
 * PLACEMENT's researched gaps (`staff/headerPlacementPass`), which are plan B's to bring here.
 */
export function drawSpineHeader(
  ctx: DrawContext, spine: Spine, s: number, header: { clef: Clef; meter?: TimeSignature },
): number {
  const signs: StaveSign[] = [new EngravedClef(header.clef, 'default')]
  if (header.meter) signs.push(new EngravedTimeSignature(header.meter))
  let at = s
  for (const sign of signs) at = drawSpineSign(ctx, spine, sign, at + sign.walkInput().padding)
  return at
}

/**
 * A BARLINE SIGN across the staff at `s` — a rigid block too, square to the spine there: the page's
 * own sign (`staff/BarlineRenderer.paintBarlineSign` — strokes, repeat dots, wings) painted at the
 * block's origin, so `s` is the BOUNDARY and the ink falls either side of it as it does on the page.
 * ⭐ WHICH sign stands there is the score's (`models/boundarySign`), asked by the caller.
 * ⚠️ An `invisible` line draws nothing here: the panel is not the editor, which greys it instead.
 */
export function drawSpineBarline(
  ctx: DrawContext, spine: Spine, s: number, kind: BarlineSignKind = 'plain', wings = false,
): void {
  if (kind === 'invisible') return
  const frame = blockFrame()
  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  try {
    paintBarlineSign(ctx, kind, 0, {
      space: frame.spacePx,
      topY: staffLineY(frame, 0),
      botY: staffLineY(frame, frame.lineCount - 1) + staveLineWidthPx(),
      numLines: frame.lineCount,
      yForLine: line => staffLineY(frame, line),
    }, group, wings)
  } finally {
    ctx.closeGroup()
  }
  group?.setPlacement(placementAt(spine, s))
}

/** The five lines along all of `spine`. */
export function drawSpineStaffLines(ctx: DrawContext, spine: Spine): void {
  drawSpineLines(ctx, spine, blockFrame(), staveLineWidthPx())
}

/** A whole staff on `spine`: its lines along all of it, then each note as its own placed block. */
export function drawSpineStaff(ctx: DrawContext, spine: Spine, notes: readonly SpineNote[], clef: Clef = 'treble'): void {
  drawSpineStaffLines(ctx, spine)
  for (const note of notes) drawSpineNote(ctx, spine, note, clef)
}
