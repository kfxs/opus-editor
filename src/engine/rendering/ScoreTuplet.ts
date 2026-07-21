import { Tuplet } from 'vexflow'

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
    const textWidth = this.textElement.getWidth()
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

    this.textElement.renderText(
      ctx,
      notationStartX,
      yPos + this.textElement.getHeight() / 2 + (location === Tuplet.LOCATION_TOP ? -1 : 1) * textYOffset,
    )

    const bb = this.getBoundingBox()
    ctx.pointerRect(bb.getX(), bb.getY(), bb.getW(), bb.getH())
    ctx.closeGroup()
    this.setRendered()
  }
}
