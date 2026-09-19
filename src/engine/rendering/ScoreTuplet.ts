import type { EngravedNote } from './EngravedNote'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { DrawGroup } from '@/engine/paint/DrawGroup'
import type { TupletMarkRun } from '@/types/music'
import { drawGlyph, measureGlyph, measureGlyphAscent, measureGlyphHeight } from './glyphPainter'
import { MUSIC_FONT_SIZE_PT } from '@/engine/engrave/inheritedFonts'
import { drawGroupOf } from './svgDrawGroup'
import { alignTupletRests } from './columnFormat'
import { TUPLET_TEXT_Y_OFFSET_PX, TUPLET_Y_OFFSET_PX } from '@/engine/engrave/inheritedDefaults'
import { tupletMarkY, type TupletNoteReach, type TupletSide } from '@/engine/engrave/marks/tupletPlacement'
import { staveFrame, staveOf } from './staveFrame'

/**
 * The tuplet mark's font size, in points — THE knob for how big the numbers are.
 *
 * VexFlow gives the `Tuplet` category no size of its own, so it fell through to the toolkit default
 * (30) — the same size a whole staff's worth of glyphs is drawn at, and too loud for a figure that
 * sits above the notes and is read at a glance. One number, one place: every run of the engraved
 * mark and of the ghost's, and VexFlow's own `textElement` ({@link ScoreTuplet}'s constructor).
 *
 * ⭐ Not per staff: a small staff gets a small number anyway, because the mark is drawn inside its
 * scale group (docs/staff-size-plan.md §10). It used to be written into VexFlow's GLOBAL
 * `MetricsDefaults.Tuplet` at import, with a `Metrics.clear` to evict the cached font — S1c of
 * `docs/vexflow-removal-map.md` made it a value handed to each drawing instead.
 */
const TUPLET_FONT_SIZE = 26

/**
 * How big the mark's note glyph is, as a fraction of the figures' font size.
 *
 * The two glyph families fill their em differently: a tuplet digit (U+E88x) is a small figure inside
 * a 30px em, a `metNote…` fills its own. Drawn at one size the note comes out roughly twice the
 * height of the numbers it belongs to. 0.55 lands it a little taller than the figures — which is
 * what a note beside a ratio should be, since its stem has to go somewhere.
 */
const NOTE_GLYPH_SCALE = 0.55

/**
 * The air a `space` run asks for, as a fraction of the figures' size — so it stays proportional when
 * {@link TUPLET_FONT_SIZE} moves. About a thin space at 24px.
 */
const MARK_SPACE_EM = 0.15

/**
 * The staff line a BELOW mark starts clear of when no modifier has claimed a lower one — the bottom
 * line. ⚠️ VexFlow spells it as the literal `4` seeded into its `lineCheck` (`tuplet.js:156`).
 */
const STAFF_BOTTOM_LINE = 4

/** Who stamps the mark's glyphs — see `./glyphPainter` (a tag of ours, so it resolves the music stack). */
const MARK_TAG = 'ScoreTuplet.mark'

/** One run of a laid-out mark: its glyphs, the size they are drawn at, and the room they take. */
interface MarkPiece {
  text: string
  sizePt: number
  /** The run's drawn width, in px. */
  width: number
  /** The air before it, in px. */
  gapBefore: number
}

/** A mark's runs, measured, with the width they come to together. */
interface LaidOutMark {
  pieces: MarkPiece[]
  width: number
}

/**
 * Lay a mark's runs out end to end — the figures at {@link TUPLET_FONT_SIZE}, the note glyphs at
 * {@link NOTE_GLYPH_SCALE} of it.
 *
 * Shared by the engraved mark and the GHOST's, so a preview cannot be drawn at sizes the page will
 * not use. Empty runs are dropped rather than measured: they would contribute a stray zero-width
 * piece to the width sum.
 */
export function layoutTupletMark(runs: TupletMarkRun[]): LaidOutMark {
  const pieces: MarkPiece[] = []
  for (const run of runs) {
    if (!run.text) continue
    // Every size and gap relative to the figures', so a retune moves the whole mark together.
    const sizePt = run.glyph ? TUPLET_FONT_SIZE * NOTE_GLYPH_SCALE : TUPLET_FONT_SIZE
    // No gap before the FIRST run whatever it asks for: that would be air outside the mark, which
    // shifts it off centre rather than separating anything.
    const gapBefore = run.space && pieces.length > 0 ? TUPLET_FONT_SIZE * MARK_SPACE_EM : 0
    pieces.push({ text: run.text, sizePt, width: measureGlyph(MARK_TAG, run.text, sizePt), gapBefore })
  }
  return { pieces, width: pieces.reduce((w, p) => w + p.gapBefore + p.width, 0) }
}

/** Draw a laid-out mark from `x`, on one baseline — the runs are one line of text, not a stack. */
export function drawTupletMark(ctx: DrawContext, mark: LaidOutMark, x: number, baseline: number): void {
  let cursor = x
  for (const { text, sizePt, width, gapBefore } of mark.pieces) {
    cursor += gapBefore
    drawGlyph(ctx, MARK_TAG, text, cursor, baseline, sizePt)
    cursor += width
  }
}

/** Above the notes, and below — VexFlow's `Tuplet.LOCATION_TOP` / `LOCATION_BOTTOM`. */
const LOCATION_TOP = 1
const LOCATION_BOTTOM = -1

/** The tuplet's options — VexFlow's `Tuplet.options`, the fields this editor sets and reads. */
export interface ScoreTupletOptions {
  bracketed: boolean
  /** {@link LOCATION_TOP} or {@link LOCATION_BOTTOM}. */
  location: number
  notesOccupied: number
  numNotes: number
  ratioed: boolean
  yOffset: number
  textYOffset: number
}

/** The ids our tuplets draw their group under — their own counter, as `beamN` and `signN` are. */
let nextTupletId = 0

/**
 * ⭐ **A TUPLET OF OURS — S12a** (`docs/vexflow-removal-map.md` S12): the group, its options and its
 * mark, drawn with OUR bracket. It used to `extend` VexFlow's `Tuplet`; what it still took from it is
 * transcribed here — the constructor's defaults, its rest alignment and its `attach`, the note count,
 * and the nesting count. ⚠️ The NOTES still hold it VexFlow's way: `setTuplet` pushes it on each
 * note's tuplet stack and scales the note's ticks by {@link getNoteCount}/{@link getNotesOccupied}, and
 * the stack is read back by {@link getNestedTupletCount} — so those three keep VexFlow's names.
 *
 * Two changes from VexFlow's `draw`, both things its options cannot express:
 *
 *   • **Where the bracket ends.** VexFlow always stops at the last notehead
 *     (`lastNote.getTieRightX()`). {@link TupletBracketEnd} has three answers and two of them are
 *     further right, so the end X is handed in as a number: only the renderer can work it out — it
 *     needs the formatter's x for the note AFTER the group, which the tuplet cannot see.
 *   • **A bracket with no number.** VexFlow draws the line in two halves with a gap for the text, and
 *     with the text empty (`numberStyle: 'none'`) the gap is still there: a bracket with a notch cut
 *     out of the middle for nothing. One unbroken line when there is no mark.
 *
 * ⚠️ Kept line-for-line otherwise, including the `'tuplet'` group name (the SVG context prefixes it
 * to `tuplet`, which the hit-testing looks for) and the pointer rect.
 */
export class ScoreTuplet {
  readonly options: ScoreTupletOptions
  /**
   * The width `draw()` gave the mark — bracket end minus start. The renderer reads it back for the
   * hit box. (VexFlow's `Element.width`; 0 until drawn.)
   */
  width = 0
  /**
   * Absolute X for the bracket's right end, or undefined for VexFlow's own (the last notehead).
   * Set by the renderer before `draw()`, because the answer depends on notes outside the group.
   */
  bracketEndX?: number

  private readonly notes: EngravedNote[]
  private readonly id = `tuplet${++nextTupletId}`
  /** The group `draw()` opened — what the selection highlight recolours. */
  private group: DrawGroup | null = null
  /**
   * The mark's runs — figures and note glyphs, drawn at different sizes (`tupletMarkRuns`). Until
   * {@link setMarkRuns}, the plain number (or ratio) the constructor spells.
   */
  private markRuns: TupletMarkRun[] = []
  /** The runs' text, joined — its height sets the mark's baseline. */
  private markText = ''

  /**
   * VexFlow's `Tuplet` constructor, transcribed: the options' defaults, the rest alignment over the
   * group, the spelled number, and the notes told they are in it.
   */
  constructor(notes: EngravedNote[], options: Partial<ScoreTupletOptions> = {}) {
    if (!notes.length) throw new Error('ScoreTuplet: no notes provided for tuplet.')
    this.notes = notes
    const numNotes = options.numNotes !== undefined ? options.numNotes : notes.length
    const notesOccupied = options.notesOccupied || 2
    this.options = {
      bracketed: options.bracketed !== undefined ? options.bracketed : notes.some(note => !note.hasBeam()),
      location: options.location || LOCATION_TOP,
      notesOccupied,
      numNotes,
      ratioed: options.ratioed !== undefined ? options.ratioed : Math.abs(notesOccupied - numNotes) > 1,
      yOffset: options.yOffset || TUPLET_Y_OFFSET_PX,
      textYOffset: options.textYOffset || TUPLET_TEXT_Y_OFFSET_PX,
    }
    if (this.options.location !== LOCATION_TOP && this.options.location !== LOCATION_BOTTOM) {
      console.warn(`Invalid tuplet location [${this.options.location}]. Using Tuplet.LOCATION_TOP.`)
      this.options.location = LOCATION_TOP
    }
    alignTupletRests(notes)
    this.markText = this.spelledNumber()
    // `attach`: each note scales its ticks by this tuplet and keeps it on its stack.
    for (const note of notes) note.setTuplet(this)
  }

  /** VexFlow's `resolveGlyphs`: the count in SMuFL tuplet digits, `:` and the occupied count when ratioed. */
  private spelledNumber(): string {
    const digits = (n: number): string => {
      let out = ''
      while (n >= 1) {
        out = String.fromCharCode(0xe880 + (n % 10)) + out
        n = Math.floor(n / 10)
      }
      return out
    }
    const { numNotes, notesOccupied, ratioed } = this.options
    return digits(numNotes) + (ratioed ? '\uE88A' + digits(notesOccupied) : '')
  }

  setMarkRuns(runs: TupletMarkRun[]): void {
    this.markRuns = runs
    this.markText = runs.map(r => r.text).join('')
  }

  getNotes(): EngravedNote[] {
    return this.notes
  }

  /** How many notes are squeezed in — read by each note's `setTuplet` to scale its ticks. */
  getNoteCount(): number {
    return this.options.numNotes
  }

  /** How many they replace — read by each note's `setTuplet` to scale its ticks. */
  getNotesOccupied(): number {
    return this.options.notesOccupied
  }

  /**
   * How many tuplets on this side some notes of the group are nested in and others are not —
   * VexFlow's `getNestedTupletCount`, read off each note's tuplet stack.
   */
  getNestedTupletCount(): number {
    const { location } = this.options
    const count = (note: EngravedNote): number =>
      (note.getTupletStack() as unknown as ScoreTuplet[]).filter(t => t.options.location === location).length
    const counts = this.notes.map(count)
    return Math.max(...counts) - Math.min(...counts)
  }

  /** The group this tuplet drew — null before a draw. */
  drawnGroup(): DrawGroup | null {
    return this.group
  }

  /**
   * ⭐⭐ **OURS as of S8** — how far out the bracket and numeral stand. The rule is
   * `engrave/marks/tupletPlacement`: *outside everything on one side, pushed by whichever note reaches
   * furthest*. Everything here is the adapter's half — the reaches only a formatted note can report.
   *
   * ⚠️ **Above and below read DIFFERENT counters of the modifier context**, and that is VexFlow's, not
   * a slip: above asks `topTextLine` and turns it into a y through the note's own `getYForTopText`;
   * below asks `textLine + 1` and uses it as a staff LINE NUMBER. ⛔ Not symmetrised — see the module.
   *
   * ⚠️ Read on every call, ⛔ never cached: the stem extents are only final once the beams have applied
   * their extensions, and this is asked during `draw()` precisely because that is when they are.
   */
  getYPosition(): number {
    const side = this.options.location as TupletSide
    const notes = this.notes
    return tupletMarkY({
      side,
      frame: staveFrame(staveOf(notes[0])),
      notes: notes.map(note => this.reachOf(note, side)),
      nestedDepth: this.getNestedTupletCount(),
      yOffset: this.options.yOffset ?? 0,
      lowestTextLine: notes.reduce(
        (line, note) => Math.max(line, (note.getModifierContext()?.getState().textLine ?? -1) + 1),
        STAFF_BOTTOM_LINE,
      ),
    })
  }

  /** What one note of the group contributes — see `engrave/marks/tupletPlacement`. */
  private reachOf(note: EngravedNote, side: TupletSide): TupletNoteReach {
    // ⚠️ VexFlow's own predicate: a whole note has no stem but does have extents, and a rest counts too.
    const reaches = note.hasStem() || note.isRest()
    if (!reaches) {
      return { reaches, stemDirection: 1, stemTipY: 0, stemBaseY: 0, textLines: 0, textTopY: 0 }
    }
    const { topY, baseY } = note.getStemExtents()
    const textLines = side === 1 ? note.getModifierContext()?.getState().topTextLine ?? 0 : 0
    return {
      reaches,
      stemDirection: note.getStemDirection(),
      stemTipY: topY,
      stemBaseY: baseY,
      textLines,
      // ⚠️ Asked only when there IS text — `getYForTopText` reads the stem extents again, and on a
      // note with nothing stacked over it the answer is never used.
      textTopY: textLines > 0 ? note.getYForTopText(textLines) : 0,
    }
  }

  draw(ctx: DrawContext): void {
    const { location, bracketed, textYOffset } = this.options
    const firstNote = this.notes[0]
    const lastNote = this.notes[this.notes.length - 1]

    // Left end and VexFlow's own right end, exactly as it computes them: an unbracketed tuplet is
    // measured stem to stem (the number sits over the middle of the group), a bracketed one from the
    // outer edge of the first notehead to the outer edge of the last, with 5px of air each side.
    let xPos: number
    let defaultEndX: number
    if (!bracketed) {
      // `getStemX` is on StemmableNote, which every note VexFlow puts in a tuplet is — but the
      // declared element type here is the base `Note`, so it is asked for rather than assumed.
      const stemX = (n: typeof firstNote): number =>
        (n as unknown as { getStemX?: () => number }).getStemX?.() ?? n.getAbsoluteX()
      xPos = stemX(firstNote)
      defaultEndX = stemX(lastNote)
    } else {
      xPos = firstNote.getTieLeftX() - 5
      defaultEndX = lastNote.getTieRightX() + 5
    }
    // Never LEFT of the last notehead: a bracket that stopped short of its own final note would be
    // describing a group that isn't the one underneath it. A bad hand-in shortens nothing.
    const endX = Math.max(this.bracketEndX ?? defaultEndX, defaultEndX)
    this.width = endX - xPos

    const yPos = this.getYPosition()
    // The MARK, laid out: its width is what the bracket makes room for and what the centring is
    // measured from — all the runs, not just the figures. With no runs set (nothing but VexFlow's
    // own construction has happened) its text is drawn as one, which is VexFlow's own behaviour.
    const mark = layoutTupletMark(this.markRuns.length ? this.markRuns : [{ text: this.markText }])
    const textWidth = mark.width
    const notationStartX = xPos + this.width / 2 - textWidth / 2

    this.group = drawGroupOf(ctx.openGroup('tuplet', this.id))
    if (bracketed) {
      const legY = yPos + (location === LOCATION_BOTTOM ? 1 : 0)
      if (textWidth <= 0) {
        // Nothing to make room for — one line, and it reads as a span rather than as two dashes.
        ctx.fillRect(xPos, yPos, this.width, 1)
      } else {
        const lineWidth = this.width / 2 - textWidth / 2 - 5
        if (lineWidth > 0) {
          ctx.fillRect(xPos, yPos, lineWidth, 1)
          ctx.fillRect(xPos + this.width / 2 + textWidth / 2 + 5, yPos, lineWidth, 1)
        }
      }
      // The legs hang toward the notes. Drawn whatever the line came to, so a bracket too narrow for
      // its own number is still two legs and not nothing.
      ctx.fillRect(xPos, legY, 1, location * 10)
      ctx.fillRect(xPos + this.width, legY, 1, location * 10)
    }

    // One baseline for every run — the mark is a line of text, not a stack. Its height is the joined
    // text's, measured in the mark's face at the figures' size (VexFlow's `textElement`), so a note
    // glyph beside them is measured WITH them, exactly as before.
    const baseline =
      yPos + this.markHeight() / 2 + (location === LOCATION_TOP ? -1 : 1) * textYOffset
    drawTupletMark(ctx, mark, notationStartX, baseline)

    // ⚠️ VexFlow's pointer rect is `Element.getBoundingBox()` of the TUPLET itself — which never has an
    // x, a y, a shift or a text: so it stands at the origin, `width` wide, and as tall as an EMPTY
    // string measures in the root music face (`Tuplet` sets no font of its own). Kept as it was
    // drawn, ⛔ not "fixed" — the hit box is the registry's.
    const emptyAscent = measureGlyphAscent('Tuplet', '', MUSIC_FONT_SIZE_PT)
    ctx.pointerRect(0, -emptyAscent, this.width, measureGlyphHeight('Tuplet', '', MUSIC_FONT_SIZE_PT))
    ctx.closeGroup()
  }

  /** The figures' height at {@link TUPLET_FONT_SIZE} — what sets the mark's baseline. */
  markHeight(): number {
    return measureGlyphHeight(MARK_TAG, this.markText, TUPLET_FONT_SIZE)
  }
}
