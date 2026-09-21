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
import { compose, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { placementAt } from '@/engine/engrave/staff/staffSpine'
import { drawSpineLines } from '@/engine/engrave/staff/spineLines'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import { staveLineWidthPx } from '@/engine/engrave/staff/staffLines'
import type { Clef, NoteDuration, PitchAlter, PitchStep, TimeSignature } from '@/types/music'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import { spellingDiatonicPos, spellingToNoteKey } from '@/utils/pitchSpelling'
import { EngravedClef } from '../engraved/EngravedClef'
import { EngravedNote, drawNoteInkThrough } from '../engraved/EngravedNote'
import { EngravedStave } from '../engraved/EngravedStave'
import { EngravedTimeSignature } from '../engraved/EngravedTimeSignature'
import { noteRuler } from '../engraved/noteRuler'
import { formatLoneNote } from '../ghosts/loneNote'
import { drawGroupOf } from '../painter/svgDrawGroup'
import { ledgerLineStyle } from '@/engine/layout/layoutConfig'
import { staveFrame } from '../staff/staveFrame'
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
 * A plain BARLINE across the staff at `s` — a rigid block too: one straight stroke from the top line
 * to the bottom one, square to the spine there. ⚠️ Plain only; WHICH sign a boundary carries
 * (`models/boundarySign`) is plan B's to bring here.
 */
export function drawSpineBarline(ctx: DrawContext, spine: Spine, s: number, thickness: number): void {
  const frame = blockFrame()
  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  try {
    ctx.setLineWidth(thickness)
    ctx.beginPath()
    ctx.moveTo(0, staffLineY(frame, 0))
    ctx.lineTo(0, staffLineY(frame, frame.lineCount - 1) + staveLineWidthPx())
    ctx.stroke()
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
