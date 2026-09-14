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
 *
 * ## ⭐⭐ …and since 2026-09-14 it is also the RULER for its own sign (P6b)
 *
 * {@link EngravedAccidental.drawnInk} answers what the stamp covered, computed from the stamp —
 * and `VexFlowRenderer` files THAT as the accidental's hit box. ⇒ *"a click here selects that
 * sharp"* is arithmetic in jsdom for the first time.
 *
 * ⚠️ **The SIZE is ours; the PLACE is still VexFlow's, and the two now come from different
 * sources.** `accidentalOriginX(start.x, this.getWidth())` hangs the sign left by a width VexFlow
 * measured with a runtime `measureText` — 0 in jsdom, so a page-less test draws the glyph with its
 * left edge on the note's modifier-start point. `fonts/GLYPH_BOXES` holds every one of the five
 * signs' advances and could answer it instead. ⭐ That is the SIXTH *"the room and the ink come from
 * two sources"* number (beside the ledger overhang, the stem thickness, the flag reach, the notehead
 * glyph and the articulation's centring) — and like all of them it MOVES PIXELS, so it is a taste
 * call and ⛔ not this file's to make.
 */
import { Accidental } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { accidentalFont } from '@/engine/engrave/inheritedFonts'
import { accidentalOriginX, drawAccidental, type AccidentalInk } from '@/engine/engrave/notes/accidental'
import type { SceneBox } from '@/engine/scene/sceneBox'
import type { InkSurfaceAware } from './inkSurface'
import { drawnInkBoxOf } from './sceneInk'

export class EngravedAccidental extends Accidental implements InkSurfaceAware {
  /**
   * The surface this accidental's glyph draws on — the note's own, handed over by
   * {@link drawNoteInkThrough} before the voices are drawn. Null until then, and then it falls back
   * to `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedAccidental.drawnInk */
  private ink: SceneBox | null = null

  /** @see EngravedAccidental.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐⭐ **WHAT THIS SIGN'S INK COVERS — P6b's first hit box** (`docs/own-engraving-engine.md` §5 P6).
   *
   * Computed from the stamp itself ({@link drawnInkBoxOf}), so it is the glyph's own outline in the
   * coordinates the glyph was drawn in — ⛔ not `getBoundingBox()`, whose height is the FONT'S LINE
   * BOX (measured in `e2e/sceneBox.e2e.ts` at more than three times the sign) hung off this object's
   * `x`/`y` fields.
   *
   * @returns null when this accidental did not draw its own ink — a CAUTIONARY one (brackets, see
   *   {@link EngravedAccidental.draw}) hands the whole job back to VexFlow, and then the only ruler
   *   for it is VexFlow's. ⛔ Never a box "about right": an unmeasured glyph answers null too.
   */
  drawnInk(): SceneBox | null {
    return this.ink
  }

  /** ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point. */
  override draw(): void {
    const vex = this.checkContext()
    const note = this.checkAttachedNote()
    this.setRendered()

    // ⚠️ Cleared FIRST, so a draw that takes the cautionary branch below — or throws — can never
    // leave the previous render's box standing as if it were this one's.
    this.ink = null

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

    const glyph = this.getText()
    const ink: AccidentalInk = {
      glyph,
      x: this.x + this.getXShift(),
      y: this.y + this.getYShift(),
      font: accidentalFont(glyph),
      // ⭐ The sign's own id, so its GROUP can be matched back to the hit box the registry
      //   files for it — P6b's seam (`docs/own-engraving-engine.md` §5 P6).
      id: this.getAttribute('id'),
    }
    drawAccidental(this.inkSurface ?? vex, ink)
    // ⭐ THE RULER, from the same call that just painted — see {@link EngravedAccidental.drawnInk}.
    this.ink = drawnInkBoxOf(ctx => drawAccidental(ctx, ink))
  }
}
