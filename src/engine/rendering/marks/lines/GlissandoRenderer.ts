/**
 * ⭐ **GLISSANDO DRAWING** — one straight stroke from a head to the head its glissando derives
 * (docs/plans/glissando-plan.md P1). The GEOMETRY is `engrave/marks/glissandoLine` (named rows, Gould
 * armed); the TARGET is `models/glissandoOps.glissandoTarget` (asked every render — a slot filled since
 * the last one connects). This file reads the drawn notes and strokes.
 *
 * Drawn through `pass.context`, so the SCENE records it: its geometry is a unit test
 * (`ScoreRenderer.recordScene`).
 *
 * ⭐ A target on the next SYSTEM draws TWO pieces (P2, `glissandoLine.glissandoPieces` — Gould's
 * whole-interval pieces armed); a FREE end (P3) draws into or out of nothing ({@link renderFreeEnd}).
 * ⏳ Not yet: selection (P4); a piece whose other system is culled (skipped: its note is not drawn to ask).
 */
import type { Glissando, NotePitch, Score } from '@/types/music'
import type { RenderPass } from '../../RenderPass'
import { getGlissandi, glissandoDirection, glissandoTarget } from '@/engine/models/glissandoOps'
import { findSlot } from '@/engine/models/slotLookup'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { spellingToMidi } from '@/utils/pitchSpelling'
import {
  armedGlissandoBreakRule, glissandoFreeStroke, glissandoPieces, glissandoStroke, glissandoThicknessSpaces, type GlissandoFrom, type GlissandoStroke, type GlissandoTo, type Ledger,
} from '@/engine/engrave/marks/glissandoLine'
import { lineEndBarlineX, lineHeaderInkX } from '../../staff/systemEdges'
import { LEDGER_OVERHANG_PX } from '@/engine/engrave/inheritedDefaults'
import { staffBottomLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { drawGroupOf } from '../../painter/svgDrawGroup'
import { inStaffSpace } from '../../staff/staffScaleGroup'
import { noteFrame } from '../../staff/staveFrame'
import { noteRuler } from '../../engraved/noteRuler'
import { dotsOn } from '../../engraved/EngravedDot'
import { accidentalsOn } from '../../engraved/EngravedAccidental'
import type { EngravedNote } from '../../engraved/EngravedNote'
import { glyphBox, glyphNameOf, type GlyphName } from '@/engine/fonts/fontMetrics'
import { glyphOutline } from '@/engine/fonts/glyphOutline'
import { glyphInkShape } from '@/engine/engrave/glyphInkShape'

/** Every glissando with a note to go to — on its own system, or across a break in two pieces (P2). */
export function renderGlissandi(pass: RenderPass, score: Score): void {
  const ctx = pass.context
  if (!ctx) return
  for (const glissando of getGlissandi(score)) {
    const targetId = glissandoTarget(score, glissando)
    if (!targetId) {
      renderFreeEnd(pass, score, glissando)
      continue
    }
    const from = pass.staveNoteMap.get(glissando.noteId)
    const to = pass.staveNoteMap.get(targetId)
    if (!from || !to) continue // not drawn (culled, or the anchor dangles)
    const fromSlot = findSlot(score, glissando.noteId)
    const toSlot = findSlot(score, targetId)
    if (fromSlot?.type !== 'chord' || toSlot?.type !== 'chord') continue
    const fromLine = pass.measureLayoutInfo.get(fromSlot.chord.measure)?.lineNumber ?? 0
    const toLine = pass.measureLayoutInfo.get(toSlot.chord.measure)?.lineNumber ?? 0

    const fromFrame = noteFrame(from.staveNote)
    const toFrame = noteFrame(to.staveNote)
    if (!fromFrame || !toFrame) continue
    const space = fromFrame.spacePx
    const source = leaving(from.staveNote, from.noteIndex, fromFrame)
    const target = arriving(to.staveNote, to.noteIndex, toFrame)
    if (!source || !target) continue
    const rising = direction(fromSlot.pitch, toSlot.pitch)
    const staffIndex = staffIndexOfId(score, fromSlot.chord.staffId)

    let strokes: Array<GlissandoStroke | null>
    if (fromLine === toLine) {
      strokes = [glissandoStroke(source, target, space, rising)]
    } else {
      // ⭐ ACROSS A BREAK (P2): the system edges are page distances — into the staff's own space, once
      //   (the tie's conversion, `TieRenderer`).
      const scale = pass.staffScale(staffIndex)
      const barlineX = lineEndBarlineX(pass, fromLine)
      const headerInkX = lineHeaderInkX(pass, toLine)
      if (barlineX === undefined || headerInkX === undefined) continue
      strokes = glissandoPieces(source, target, {
        fromTopY: fromFrame.topLineY, toTopY: toFrame.topLineY,
        barlineX: barlineX / scale, headerInkX: headerInkX / scale,
      }, space, rising)
    }
    if (!strokes.some(Boolean)) continue
    drawStrokes(pass, ctx, staffIndex, glissando.id, strokes, space)
  }
}

/**
 * ⭐ P3 — a glissando with a FREE end: a line INTO its note from nothing (`side: 'before'` — a scoop, a lift, a
 * plop) or OUT of it into nothing (no note to go to, or `end: 'none'` — a fall, a doit, a bend). Drawn by
 * `glissandoLine.glissandoFreeStroke` against a virtual point, so the note's side keeps every rule the armed row
 * keeps; its size is the free-end row's (`GLISSANDO_FREE_END_RULES`), its direction the model's.
 */
function renderFreeEnd(pass: RenderPass, score: Score, glissando: Glissando): void {
  const ctx = pass.context
  const at = pass.staveNoteMap.get(glissando.noteId)
  const slot = findSlot(score, glissando.noteId)
  if (!ctx || !at || slot?.type !== 'chord') return
  const frame = noteFrame(at.staveNote)
  if (!frame) return
  const leave = leaving(at.staveNote, at.noteIndex, frame)
  const arrive = arriving(at.staveNote, at.noteIndex, frame)
  if (!leave || !arrive) return
  const staffIndex = staffIndexOfId(score, slot.chord.staffId)
  const side = glissando.side === 'before' ? 'before' : 'after'
  // An `after` end stops short of the system's closing barline — P2's own gap there.
  const line = pass.measureLayoutInfo.get(slot.chord.measure)?.lineNumber ?? 0
  const barline = lineEndBarlineX(pass, line)
  const limitX = barline === undefined ? Infinity : barline / pass.staffScale(staffIndex) - armedGlissandoBreakRule().beforeBarline * frame.spacePx
  const stroke = glissandoFreeStroke(side, { ...leave, ...arrive }, glissandoDirection(glissando), frame.spacePx, undefined, limitX)
  if (stroke) drawStrokes(pass, ctx, staffIndex, glissando.id, [stroke], frame.spacePx)
}

/** One glissando's group: its strokes, at the armed weight, in its staff's own space. */
function drawStrokes(
  pass: RenderPass,
  ctx: NonNullable<RenderPass['context']>,
  staffIndex: number,
  id: string,
  strokes: ReadonlyArray<GlissandoStroke | null>,
  space: number,
): void {
  const group = drawGroupOf(ctx.openGroup?.('glissando', `glissando-${id}`))
  inStaffSpace(pass, staffIndex, group, () => {
    ctx.save()
    ctx.setLineWidth(glissandoThicknessSpaces() * space)
    for (const stroke of strokes) {
      if (!stroke) continue
      ctx.beginPath()
      ctx.moveTo(stroke.x1, stroke.y1)
      ctx.lineTo(stroke.x2, stroke.y2)
      ctx.stroke()
    }
    ctx.restore()
  })
  ctx.closeGroup?.()
}

/** +1 when the target sounds higher, −1 lower, 0 the same. */
function direction(a: NotePitch, b: NotePitch): -1 | 0 | 1 {
  return Math.sign(spellingToMidi(b.step, b.alter, b.octave) - spellingToMidi(a.step, a.alter, a.octave)) as -1 | 0 | 1
}

/** Does a head at `y` stand on or beyond the first ledger line? */
function onLedger(y: number, frame: StaffFrame): boolean {
  const eps = frame.spacePx / 4
  return y <= frame.topLineY - frame.spacePx + eps || y >= staffBottomLineY(frame) + frame.spacePx - eps
}

/** The overhang a ledger line reaches past its head, in this staff's px. */
const ledgerOverhang = (frame: StaffFrame): number => LEDGER_OVERHANG_PX * (frame.spacePx / STAFF_SPACE_PX)

/** The source note as the line leaves it: its head's height, and the rightmost ink to clear. */
function leaving(note: EngravedNote, index: number, frame: StaffFrame): GlissandoFrom | null {
  const ruler = noteRuler(note)
  const y = ruler.headYs[index]
  if (y === undefined || isNaN(y)) return null
  let right = ruler.headRightX
  if (onLedger(y, frame)) right += ledgerOverhang(frame)
  for (const dot of dotsOn(note)) {
    if (dot.isDropped()) continue
    const box = dot.getBoundingBox()
    right = Math.max(right, box.x + box.w)
  }
  const headOutline = headOutlineOf(note, index)
  const ledgers = ledgersOf(y, ruler.headLeftX, ruler.headRightX, frame)
  return {
    y, inkRightX: right, centreX: (ruler.headLeftX + ruler.headRightX) / 2, staffLines: linesOf(frame),
    ...(headOutline && { headOutline }),
    ...(ledgers.length && { ledgers }),
    ...(ruler.hasStem && { hasStem: true }),
    ...(ruler.hasStem && ruler.stemDirection === -1 && { stemDown: true }),
  }
}

/** The target note as the line arrives: its head's height, its left ink, and its accidental. */
function arriving(note: EngravedNote, index: number, frame: StaffFrame): GlissandoTo | null {
  const ruler = noteRuler(note)
  const y = ruler.headYs[index]
  if (y === undefined || isNaN(y)) return null
  let left = ruler.headLeftX
  if (onLedger(y, frame)) left -= ledgerOverhang(frame)
  const centreX = (ruler.headLeftX + ruler.headRightX) / 2
  const headOutline = headOutlineOf(note, index)
  const stem = ruler.hasStem
    ? { stem: { x: ruler.stemX, top: Math.min(ruler.stemTipY, ruler.stemBaseY), bottom: Math.max(ruler.stemTipY, ruler.stemBaseY) } }
    : {}
  const ledgers = ledgersOf(y, ruler.headLeftX, ruler.headRightX, frame)
  const head = { ...(headOutline && { headOutline }), ...stem, ...(ledgers.length && { ledgers }), staffLines: linesOf(frame) }
  const accidental = accidentalsOn(note).find(a => a.getIndex() === index)
  if (!accidental) return { y, inkLeftX: left, centreX, ...head }
  // ⭐ The sign's OWN ink, computed from its stamp (`drawnInk`, P6b's ruler — ⛔ not asked of a
  //   `getBoundingBox()`). Null before it drew: then only its left edge.
  const ink = accidental.drawnInk()
  if (!ink) return { y, inkLeftX: left, centreX, ...head, accidentalLeftX: accidental.getBoundingBox().x }
  // ⭐ …and its SHAPE: that box less the corners the font says are empty (`engrave/glyphInkShape`), and
  //   ⭐⭐ its REAL OUTLINE once the face has loaded (`fonts/glyphOutline`), placed where the box stands.
  const name = glyphNameOf(accidental.getText())
  const outline = name ? placedOutline(name, ink) : null
  return {
    y, inkLeftX: left, centreX, ...head,
    accidentalLeftX: ink.x, accidentalTopY: ink.y, accidentalBottomY: ink.y + ink.height,
    ...(name && { accidentalInk: glyphInkShape(name, ink) }),
    ...(outline && { accidentalOutline: outline }),
  }
}

/**
 * The glyph's real outline (`fonts/glyphOutline`, staff spaces, y UP) placed on the page where its drawn
 * ink box stands: the box fixes the scale (its height is the glyph's `up + down`) and the origin.
 */
function placedOutline(
  name: GlyphName,
  ink: { x: number; y: number; width: number; height: number },
): Array<Array<readonly [number, number]>> | null {
  const contours = glyphOutline(name)
  const g = glyphBox(name)
  if (!contours || !(g.up + g.down > 0)) return null
  const sp = ink.height / (g.up + g.down)
  const originX = ink.x - g.left * sp
  const baselineY = ink.y + g.up * sp
  return contours.map(c => c.map(([x, y]) => [originX + x * sp, baselineY - y * sp] as const))
}

/**
 * A head's real outline (`fonts/glyphOutline`) placed where the head is drawn: its glyph from the drawn
 * head, its origin at the heads' left edge on the head's own line, its scale from the drawn width.
 * Null until the face has loaded, or for a head we cannot name.
 */
function headOutlineOf(note: EngravedNote, index: number): Array<Array<readonly [number, number]>> | null {
  const ruler = noteRuler(note)
  const head = note.noteHeads[index] ?? note.noteHeads[0]
  const name = head ? glyphNameOf(head.getText()) : null
  const y = ruler.headYs[index]
  if (!name || y === undefined || isNaN(y)) return null
  const contours = glyphOutline(name)
  const g = glyphBox(name)
  const width = ruler.headRightX - ruler.headLeftX
  if (!contours || !(g.right - g.left > 0) || !(width > 0)) return null
  const sp = width / (g.right - g.left)
  const originX = ruler.headLeftX - g.left * sp
  return contours.map(c => c.map(([x, gy]) => [originX + x * sp, y - gy * sp] as const))
}

/**
 * The ledger lines a head at `y` stands on or beyond — one per staff-line position between the staff and
 * the head — each reaching the ledger overhang past the head on either side (`inheritedDefaults`).
 */
function ledgersOf(y: number, headLeftX: number, headRightX: number, frame: StaffFrame): Ledger[] {
  const space = frame.spacePx
  const over = ledgerOverhang(frame)
  const eps = space / 4
  const out: Ledger[] = []
  for (let ly = frame.topLineY - space; ly >= y - eps; ly -= space) out.push({ y: ly, left: headLeftX - over, right: headRightX + over })
  for (let ly = staffBottomLineY(frame) + space; ly <= y + eps; ly += space) out.push({ y: ly, left: headLeftX - over, right: headRightX + over })
  return out
}

/** The y of each of the staff's own lines. */
function linesOf(frame: StaffFrame): number[] {
  return Array.from({ length: frame.lineCount }, (_, i) => frame.topLineY + i * frame.spacePx)
}
