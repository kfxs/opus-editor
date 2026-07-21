import { Element, Tuplet } from 'vexflow'

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
 * VexFlow's `Tuplet` with OUR bracket: it decides where the bracket ends, and it does not cut a hole
 * in the line for a mark that isn't there.
 *
 * A subclass and not a rewrite. Everything hard about a tuplet mark — which side it goes on, how high
 * above the stems, how it stacks when tuplets nest, how it is clamped to the staff — is
 * `getYPosition()`, and that stays VexFlow's. Only `draw()` is ours, and it is VexFlow's own draw with
 * two changes, both of them things its options cannot express:
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

  /**
   * The note glyph that follows the figures in *Ratio + note* (`3:2♪`), or empty.
   *
   * A run of its own, not part of `textElement`'s string, because it is drawn at
   * {@link NOTE_GLYPH_SCALE} of the figures' size — see there. Set by the renderer from
   * `tupletMarkParts`, whose other half is the text.
   */
  noteGlyph = ''

  /** The glyph run's own element: it carries the smaller font and measures itself, which is how the
   *  mark's total width — and so the bracket's gap and the centring — stays right. */
  private readonly glyphElement = new Element()

  /** The mark's two runs, laid end to end: total width, and the glyph element ready to draw. */
  private markWidth(): number {
    const textWidth = this.textElement.getWidth()
    if (!this.noteGlyph) return textWidth
    // `size` is typed as string | number (VexFlow accepts '30pt' as well as 30); the figures' font
    // comes from Metrics as a number, and anything else is left at the toolkit default rather than
    // parsed — a size we cannot read is not a size to do arithmetic on.
    const { family, size, weight, style } = this.textElement.fontInfo
    const scaled = typeof size === 'number' ? size * NOTE_GLYPH_SCALE : undefined
    this.glyphElement.setFont(family, scaled, weight, style)
    this.glyphElement.setText(this.noteGlyph)
    return textWidth + this.glyphElement.getWidth()
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
    // The MARK's width, figures plus glyph — what the bracket makes room for and what the centring
    // is measured from. VexFlow uses the text element's width alone, which is only the first run.
    const textWidth = this.markWidth()
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

    const baseline =
      yPos + this.textElement.getHeight() / 2 + (location === Tuplet.LOCATION_TOP ? -1 : 1) * textYOffset
    this.textElement.renderText(ctx, notationStartX, baseline)
    // The glyph follows the figures on the SAME baseline — both runs are text, and a note that sat
    // on its own line would read as a different mark rather than part of this one.
    if (this.noteGlyph) {
      this.glyphElement.renderText(ctx, notationStartX + this.textElement.getWidth(), baseline)
    }

    const bb = this.getBoundingBox()
    ctx.pointerRect(bb.getX(), bb.getY(), bb.getW(), bb.getH())
    ctx.closeGroup()
    this.setRendered()
  }
}
