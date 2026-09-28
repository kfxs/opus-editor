/**
 * ⭐ **THE USER'S SYMBOLS, DRAWN IN THEIR BAR** — the render side of {@link GlyphMark}
 * (docs/plans/symbol-plan.md P1). Called once per measure and staff from the measure loop, after the
 * voices are drawn (a note's x does not exist before), exactly where the tempo marks are.
 *
 * ⚠️ **The y drawn here is NOT the symbol's row — it is an ORIGIN**, the staff's near line. Where the
 * row is depends on the SYSTEM (the music under the mark, and every family placed before it), so
 * `./glyphMarkLinePass` translates each symbol onto its row afterwards — the tempo mark's arrangement,
 * and for its reason: a system-scope y computed here would have to join the bar's shape key
 * (`rendering/MeasureRedrawKey`), and every bar would re-engrave whenever one note moved.
 *
 * Horizontally a symbol is CENTRED on the notehead of the event it was added to — its glyph's own
 * centre (`smuflGlyph.centerX`) over the head's centre (plan §4 (f)).
 */
import type { EngravedNote } from '../../engraved/EngravedNote'
import type { EngravedStave } from '../../engraved/EngravedStave'
import type { ChordRest, GlyphMark, Measure } from '@/types/music'
import { fracCompare, fracToNumber } from '@/utils/fraction'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import type { RenderPass } from '../../RenderPass'
import { drawGlyph } from '../../painter/glyphPainter'
import { barFrame, staveFrame } from '../../staff/staveFrame'
import { noteRuler } from '../../engraved/noteRuler'
import { GLYPH_MARK_SIZE_PT } from './glyphMarkStyle'

/** The staff line (on `InkBox`'s axis) a symbol is drawn on before its row is known — the near line. */
export function glyphMarkOriginLine(mark: GlyphMark): number {
  return mark.placement === 'below' ? 4 : 0
}

/**
 * The index of the slot a symbol belongs to: the one at its beat in its voice; else any at its beat
 * (the voice emptied under it); else the first after it (a re-bar clamped its beat between onsets).
 * -1 when the bar has nothing at or after the beat.
 */
function slotIndexFor(mark: GlyphMark, slots: readonly ChordRest[]): number {
  const voice = mark.voice ?? 0
  const at = (s: ChordRest): boolean => fracCompare(s.beat, mark.beat) === 0
  const exact = slots.findIndex(s => at(s) && (s.voice ?? 0) === voice)
  if (exact !== -1) return exact
  const any = slots.findIndex(at)
  if (any !== -1) return any
  return slots.findIndex(s => fracCompare(s.beat, mark.beat) > 0)
}

/** The x of the centre of the head this symbol stands over, in the stave's own coordinates. */
function headCentreX(mark: GlyphMark, slots: readonly ChordRest[], notes: readonly EngravedNote[], stave: EngravedStave): number {
  const i = slotIndexFor(mark, slots)
  if (i !== -1 && notes[i]) {
    try {
      const ruler = noteRuler(notes[i])
      return ruler.originX + ruler.glyphWidth / 2
    } catch {
      // not formatted — fall through to the bar's opening
    }
  }
  return barFrame(stave).noteStartX
}

/**
 * Draw every symbol of this staff's lane of the bar, each in its own group carrying the mark's id
 * (`'#<id>'` — what the line pass, and later the registry and the highlight, address it by).
 *
 * @param view this staff's lane of the measure (`staffMeasureView`), so `glyphMarks` is already this
 *   staff's alone.
 * @param slots / notes the lane's slots and their drawn notes, index for index.
 * @param staffIndex which staff this lane is — what the registry files the symbol's box under.
 */
export function drawGlyphMarks(
  pass: RenderPass,
  view: Measure,
  stave: EngravedStave,
  slots: readonly ChordRest[],
  notes: readonly EngravedNote[],
  staffIndex: number,
): void {
  if (!view.glyphMarks?.length) return
  const frame = staveFrame(stave)
  const ctx = pass.context
  for (const mark of view.glyphMarks) {
    const glyph = smuflGlyph(mark.glyph)
    if (!glyph) continue // an unknown name draws nothing — ⛔ never a stand-in glyph
    const x = headCentreX(mark, slots, notes, stave) - glyph.centerX * frame.spacePx
    const y = staffLineY(frame, glyphMarkOriginLine(mark))
    ctx.openGroup('glyphMark', mark.id)
    try {
      drawGlyph(ctx, 'glyphMarkLayout.glyph', glyph.char, x, y, GLYPH_MARK_SIZE_PT)
    } finally {
      ctx.closeGroup() // never leave the group open — everything after would nest inside it
    }
    // ⭐ Its box, for the press and the highlight (P3) — the glyph's INK from the table, placed where it
    //   was just stamped: data, so it is the same box in jsdom as in the browser, and ⛔ never the
    //   `<text>`'s em box, which is taller than any glyph in it. The line pass moves it with the ink.
    const sp = frame.spacePx
    pass.elementRegistry.add({
      type: 'glyphMark',
      id: mark.id,
      measure: view.number,
      staff: staffIndex,
      beat: fracToNumber(mark.beat),
      bbox: {
        x: x - glyph.box.left * sp,
        y: y - glyph.box.up * sp,
        width: (glyph.box.left + glyph.box.right) * sp,
        height: (glyph.box.up + glyph.box.down) * sp,
      },
    })
  }
}
