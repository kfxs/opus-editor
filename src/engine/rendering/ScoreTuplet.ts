import { Tuplet } from 'vexflow'
import type { Note } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { TupletMarkRun } from '@/types/music'
import { drawGlyph, measureGlyph } from './glyphPainter'
import { tupletMarkY, type TupletNoteReach, type TupletSide } from '@/engine/engrave/marks/tupletPlacement'
import { staveFrame } from './staveFrame'

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

/**
 * VexFlow's `Tuplet` with OUR bracket: it decides where the bracket ends, and it does not cut a hole
 * in the line for a mark that isn't there.
 *
 * A subclass and not a rewrite. ⭐ **As of S8 how far OUT the mark stands is ours too** —
 * `engrave/marks/tupletPlacement`, answered by {@link ScoreTuplet.getYPosition} below; what stays
 * VexFlow's is the note graph the rule reads (which tuplets are nested, what the modifier context has
 * stacked). `draw()` has been ours since the mark was built, and it is VexFlow's own draw with two
 * changes, both of them things its options cannot express:
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
 * to `vf-tuplet`, which the hit-testing looks for) and the pointer rect. When VexFlow's own `draw()`
 * changes, this is the file that has to be re-read against it.
 */
export class ScoreTuplet extends Tuplet {
  /**
   * Absolute X for the bracket's right end, or undefined for VexFlow's own (the last notehead).
   * Set by the renderer before `draw()`, because the answer depends on notes outside the group.
   */
  bracketEndX?: number

  constructor(...args: ConstructorParameters<typeof Tuplet>) {
    super(...args)
    // ⚠️ VexFlow's own `textElement` still sets the mark's BASELINE (its height, in `draw`) and the
    // pointer rect's box. It is built as `new Element('Tuplet')`, which resolves the root size (30),
    // so it is given the figures' size here — per tuplet, where it used to be a global write.
    this.textElement.setFontSize(TUPLET_FONT_SIZE)
  }

  /**
   * The mark's runs — figures and note glyphs, drawn at different sizes (`tupletMarkRuns`).
   *
   * Set through {@link setMarkRuns}, which also puts the joined string into VexFlow's own
   * `textElement`: nothing renders that element any more, but its height still sets the baseline and
   * its box is what the pointer rect is built from.
   */
  private markRuns: TupletMarkRun[] = []

  setMarkRuns(runs: TupletMarkRun[]): void {
    this.markRuns = runs
    this.textElement.setText(runs.map(r => r.text).join(''))
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
      frame: staveFrame(notes[0].checkStave()),
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
  private reachOf(note: Note, side: TupletSide): TupletNoteReach {
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

  draw(): void {
    const { location, bracketed, textYOffset } = this.options
    const ctx = this.checkContext()
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
    const mark = layoutTupletMark(
      this.markRuns.length ? this.markRuns : [{ text: this.textElement.getText() }],
    )
    const textWidth = mark.width
    const notationStartX = xPos + this.width / 2 - textWidth / 2

    ctx.openGroup('tuplet', this.getAttribute('id'))
    if (bracketed) {
      const legY = yPos + (location === Tuplet.LOCATION_BOTTOM ? 1 : 0)
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

    // One baseline for every run — the mark is a line of text, not a stack. The height is still the
    // figures' (`textElement`), so a note glyph beside them cannot shift the whole mark.
    const baseline =
      yPos + this.textElement.getHeight() / 2 + (location === Tuplet.LOCATION_TOP ? -1 : 1) * textYOffset
    drawTupletMark(ctx, mark, notationStartX, baseline)

    const bb = this.getBoundingBox()
    ctx.pointerRect(bb.getX(), bb.getY(), bb.getW(), bb.getH())
    ctx.closeGroup()
    this.setRendered()
  }
}
