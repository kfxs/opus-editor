/**
 * ⭐⭐ **THE SEAM WHERE AN ACCIDENTAL'S INK COMES BACK TO US** — the note's MODIFIERS, 2026-09-14
 * (`docs/own-engraving-engine.md` P3; the ink itself is `engrave/notes/accidental`).
 *
 * `Accidental.draw()` is ten lines, and only the last one paints:
 *
 * ```js
 * draw() {
 *   const ctx = this.checkContext();
 *   const note = this.checkAttachedNote();
 *   this.setRendered();
 *   const start = note.getModifierStartXY(position, index);   // ← the PLACEMENT, VexFlow's
 *   this.x = start.x - this.width;                            // ← the RULE: it hangs LEFT
 *   this.y = start.y;
 *   this.renderText(ctx, 0, 0);                               // ← the INK
 * }
 * ```
 *
 * ⭐ Same shape as `EngravedClef`, `EngravedStem` and `EngravedNote`: the ink moves to a module of
 * ours, the object keeps answering everything it answered before, **and no pixel moves**.
 *
 * ## 🚨 The write-back is load-bearing — ⛔ do not "tidy" it into the ink module
 *
 * `this.x`/`this.y` are not scratch variables: they are what `renderText` adds its shifts to, and
 * what anything asking this accidental where it landed reads afterwards (`getBoundingBox`, the
 * accidental's own hit box, `accidentalCutOut`'s obstacle). ⭐ It is the same warning `NoteHead.draw`
 * carries and that `EngravedNote` repeats for the head's `x` — a mutation of a VexFlow object, which
 * therefore ⛔ cannot live in `engrave/` (no vexflow there: `lint:boundary`). It happens here, once.
 *
 * ## ⛔ What this does NOT take
 *
 * ⛔ **`getModifierStartXY`** — where the note offers its modifiers a place to stand. That is
 * VexFlow's, and it is this repo's one live monkeypatch (`docs/own-engraving-engine.md` §2.4 calls it
 * *"the shape of the whole problem"*), so taking the ink deliberately leaves it untouched: this class
 * asks the same question at the same moment and gets the same answer.
 *
 * ⛔ **`Accidental.format`** — which column of a chord's accidental stack this one stands in. Porting
 * it drags 1,813 LOC for an opinion we do not have; our own `chordAccidentalColumns` already owns the
 * part we DO have an opinion about (Gould's ORDER).
 */
import { Accidental } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { accidentalOriginX, drawAccidental } from '@/engine/engrave/notes/accidental'
import type { InkSurfaceAware } from './inkSurface'

export class EngravedAccidental extends Accidental implements InkSurfaceAware {
  /**
   * The surface this accidental's glyph draws on — the note's own, handed over by
   * {@link drawNoteInkThrough} before the voices are drawn. Null until then, and then it falls back
   * to `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedAccidental.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /** ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point. */
  override draw(): void {
    const vex = this.checkContext()
    const note = this.checkAttachedNote()
    this.setRendered()

    const start = note.getModifierStartXY(this.position, this.checkIndex())
    // ⚠️ THE WRITE-BACK, and it must happen before the stamp reads these — see the header.
    this.x = accidentalOriginX(start.x, this.getWidth())
    this.y = start.y

    // ⚠️ A cautionary accidental's brackets are `children`, which `renderText` stamps after the
    // sign itself. Nothing in this repo makes one (no `setAsCautionary` call anywhere), so the
    // child loop is ⛔ NOT transcribed — and this guard is what keeps that a statement about today
    // rather than a silent loss the day somebody adds one.
    if (this.children.length > 0) {
      super.draw()
      return
    }

    drawAccidental(this.inkSurface ?? vex, {
      glyph: this.getText(),
      x: this.x + this.getXShift(),
      y: this.y + this.getYShift(),
      font: this.fontInfo,
    })
  }
}
