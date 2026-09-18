/**
 * ⭐ **THE MARK GHOSTS — S11b** (`docs/vexflow-removal-map.md` S11): the armed articulation(s),
 * accidental, augmentation dot and tremolo, shown loose at the pointer.
 *
 * A mark stands where its NOTE puts it, so each ghost builds ONE lone note — a B4 quarter — hangs the
 * mark on it, and draws ONLY the mark. ⭐ That note is built by the SAME classes and the SAME pipeline
 * the score uses (`EngravedNote`, `Engraved*` marks, `BarVoice`, our modifier and tick columns) where a
 * bare VexFlow `StaveNote`, `Voice` and `Formatter` used to be — so a ghost stacks its marks by the
 * page's own rules. The mark is then painted on our surface (`glyphPainter.drawMarkOn`) and parked by
 * `ghostCursor.drawSignGhost`, each ghost by its own rule.
 *
 * ⚠️ Only the ink's SHAPE survives the parking — the group is moved by its ink box — so where the lone
 * note stands is irrelevant: a stand-in stave at the pointer's y, 200 px wide, no barlines, as before.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Accidental as ScoreAccidental, ArticulationType, TremoloMark } from '@/types/music'
import { EngravedNote } from './EngravedNote'
import { EngravedStave } from './EngravedStave'
import { EngravedArticulation } from './EngravedArticulation'
import { EngravedAccidental } from './EngravedAccidental'
import { EngravedDot } from './EngravedDot'
import { CenteredTremolo } from './CenteredTremolo'
import { ARTICULATION_RENDER_ORDER } from './NoteBuilder'
import { BarVoice } from './barVoice'
import { attachModifierColumns } from './modifierColumns'
import { formatColumns } from './columnFormat'
import { drawMarkOn } from './glyphPainter'
import { drawSignGhost, ghostCursorOffset } from './ghostCursor'

/** The codes an articulation is built from — the table `NoteBuilder` uses. */
const ARTICULATION_CODES: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }

/** The width the lone note is formatted into — only its x depends on it, and the parking cancels that. */
const LONE_NOTE_FORMAT_WIDTH = 150

type Box = { x: number; y: number; width: number; height: number }

/**
 * The lone B4 quarter a mark ghost hangs its mark on: built, given its marks by `attach`, and
 * formatted as a one-beat bar through our own pipeline.
 */
function loneQuarter(cursorY: number, attach: (note: EngravedNote) => void): EngravedNote {
  const stave = new EngravedStave(0, cursorY, 200).setOpeningBarline('none').setClosingBarline('none')
  const note = new EngravedNote({ keys: ['b/4'], duration: 'q' })
  note.setStave(stave) // the note's ys — what every mark's draw reads for its y
  attach(note)
  const voices = [new BarVoice({ numerator: 1, denominator: 4 }, 'soft').add(note)]
  attachModifierColumns(voices)
  formatColumns(voices, LONE_NOTE_FORMAT_WIDTH) // the note's tick x, and the marks' stacking
  note.setStave(stave)
  return note
}

/** Centre the ink on the pointer. */
const centred = (box: Box, cursorX: number, cursorY: number) => ({
  dx: cursorX - (box.x + box.width / 2),
  dy: cursorY - (box.y + box.height / 2),
})

/**
 * The armed articulation(s), stacked. ADDITIVE: several armed marks are drawn one text line apart,
 * closest to the head first ({@link ARTICULATION_RENDER_ORDER}) — what the click will stamp.
 */
export function drawArticulationGhost(ctx: DrawContext, cursorX: number, cursorY: number, types: ArticulationType[]): boolean {
  if (types.length === 0) return false
  try {
    const sorted = types.slice().sort((a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b))
    const marks = sorted.map(t => new EngravedArticulation(ARTICULATION_CODES[t]).setPosition('above'))
    loneQuarter(cursorY, note => marks.forEach(m => note.addModifier(m, 0)))
    // Lift it a few px so the lowest glyph (staccato) doesn't sit right under the pointer.
    const CURSOR_GAP_PX = 8
    return drawSignGhost(ctx, 'ghost-articulation', cursorX, cursorY,
      // An explicit text line per glyph, so the marks stack one line apart.
      () => marks.forEach((m, i) => drawMarkOn(ctx, m.setTextLine(i))),
      (box, x, y) => { const c = centred(box, x, y); return { dx: c.dx, dy: c.dy - CURSOR_GAP_PX } })
  } catch (_e) {
    return false
  }
}

/**
 * ONE accidental (♯/♭/♮). Parked LEFT of the pointer — an accidental is engraved left of its head —
 * and ⭐ that position is THE REFERENCE every sign ghost parks by (his call, 2026-08-17), which is why
 * it is `ghostCursorOffset`, the default.
 */
export function drawAccidentalGhost(ctx: DrawContext, cursorX: number, cursorY: number, accidental: ScoreAccidental): boolean {
  try {
    const sign = new EngravedAccidental(accidental) // '#' | 'b' | 'n' are the codes as-is
    loneQuarter(cursorY, note => note.addModifier(sign, 0))
    return drawSignGhost(ctx, 'ghost-accidental', cursorX, cursorY, () => drawMarkOn(ctx, sign), ghostCursorOffset)
  } catch (_e) {
    return false
  }
}

/**
 * The tremolo STROKES — the real mark: N strokes, or the single Penderecki sign. Centred on the
 * pointer: the strokes ride the stem, so there is no side of the head for them to sit off.
 */
export function drawTremoloGhost(ctx: DrawContext, cursorX: number, cursorY: number, mark: TremoloMark): boolean {
  try {
    const tremolo = new CenteredTremolo(mark)
    loneQuarter(cursorY, note => note.addModifier(tremolo, 0))
    return drawSignGhost(ctx, 'ghost-tremolo', cursorX, cursorY, () => drawMarkOn(ctx, tremolo), centred)
  } catch (_e) {
    return false
  }
}

/**
 * ONE augmentation dot. Parked RIGHT of the pointer and a little up — the dot is ~3 px and the arrow
 * would cover it, and it lands right of the head.
 */
export function drawDotGhost(ctx: DrawContext, cursorX: number, cursorY: number): boolean {
  try {
    const dot = new EngravedDot()
    loneQuarter(cursorY, note => note.addModifier(dot, 0))
    const GAP_X = 10
    const LIFT_Y = 4
    return drawSignGhost(ctx, 'ghost-dot', cursorX, cursorY, () => drawMarkOn(ctx, dot),
      (box, x, y) => ({ dx: x + GAP_X - (box.x + box.width / 2), dy: y - LIFT_Y - (box.y + box.height / 2) }))
  } catch (_e) {
    return false
  }
}
