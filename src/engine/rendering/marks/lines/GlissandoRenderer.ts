/**
 * ⭐ **GLISSANDO DRAWING** — one straight stroke from a head to the head its glissando derives
 * (docs/plans/glissando-plan.md P1). The GEOMETRY is `engrave/marks/glissandoLine` (named rows, Gould
 * armed); the TARGET is `models/glissandoOps.glissandoTarget` (asked every render — a slot filled since
 * the last one connects). This file reads the drawn notes and strokes.
 *
 * Drawn through `pass.context`, so the SCENE records it: its geometry is a unit test
 * (`ScoreRenderer.recordScene`).
 *
 * ⏳ **Not yet:** a target on the next SYSTEM (P2 — skipped today), a free end when there is no target
 * (P3 — nothing drawn), selection (P4).
 */
import type { NotePitch, Score } from '@/types/music'
import type { RenderPass } from '../../RenderPass'
import { getGlissandi, glissandoTarget } from '@/engine/models/glissandoOps'
import { findSlot } from '@/engine/models/slotLookup'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { glissandoStroke, glissandoThicknessSpaces, type GlissandoFrom, type GlissandoTo } from '@/engine/engrave/marks/glissandoLine'
import { LEDGER_OVERHANG_PX } from '@/engine/engrave/inheritedDefaults'
import { staffBottomLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { drawGroupOf } from '../../painter/svgDrawGroup'
import { inStaffSpace } from '../../staff/staffScaleGroup'
import { noteFrame } from '../../staff/staveFrame'
import { noteRuler } from '../../engraved/noteRuler'
import { dotsOn } from '../../engraved/EngravedDot'
import { accidentalsOn } from '../../engraved/EngravedAccidental'
import type { EngravedNote } from '../../engraved/EngravedNote'

/** Every glissando whose far end is on the SAME system. */
export function renderGlissandi(pass: RenderPass, score: Score): void {
  const ctx = pass.context
  if (!ctx) return
  for (const glissando of getGlissandi(score)) {
    const targetId = glissandoTarget(score, glissando)
    if (!targetId) continue // ⏳ P3: the free end
    const from = pass.staveNoteMap.get(glissando.noteId)
    const to = pass.staveNoteMap.get(targetId)
    if (!from || !to) continue // not drawn (culled, or the anchor dangles)
    const fromSlot = findSlot(score, glissando.noteId)
    const toSlot = findSlot(score, targetId)
    if (fromSlot?.type !== 'chord' || toSlot?.type !== 'chord') continue
    const fromLine = pass.measureLayoutInfo.get(fromSlot.chord.measure)?.lineNumber ?? 0
    const toLine = pass.measureLayoutInfo.get(toSlot.chord.measure)?.lineNumber ?? 0
    if (fromLine !== toLine) continue // ⏳ P2: the system break

    const frame = noteFrame(from.staveNote)
    if (!frame) continue
    const space = frame.spacePx
    const source = leaving(from.staveNote, from.noteIndex, frame)
    const target = arriving(to.staveNote, to.noteIndex, noteFrame(to.staveNote) ?? frame)
    if (!source || !target) continue
    const stroke = glissandoStroke(source, target, space, direction(fromSlot.pitch, toSlot.pitch))
    if (!stroke) continue

    const group = drawGroupOf(ctx.openGroup?.('glissando', `glissando-${glissando.id}`))
    inStaffSpace(pass, staffIndexOfId(score, fromSlot.chord.staffId), group, () => {
      ctx.save()
      ctx.setLineWidth(glissandoThicknessSpaces() * space)
      ctx.beginPath()
      ctx.moveTo(stroke.x1, stroke.y1)
      ctx.lineTo(stroke.x2, stroke.y2)
      ctx.stroke()
      ctx.restore()
    })
    ctx.closeGroup?.()
  }
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
  return { y, inkRightX: right }
}

/** The target note as the line arrives: its head's height, its left ink, and its accidental. */
function arriving(note: EngravedNote, index: number, frame: StaffFrame): GlissandoTo | null {
  const ruler = noteRuler(note)
  const y = ruler.headYs[index]
  if (y === undefined || isNaN(y)) return null
  let left = ruler.headLeftX
  if (onLedger(y, frame)) left -= ledgerOverhang(frame)
  const accidental = accidentalsOn(note).find(a => a.getIndex() === index)
  return accidental ? { y, inkLeftX: left, accidentalLeftX: accidental.getBoundingBox().x } : { y, inkLeftX: left }
}

