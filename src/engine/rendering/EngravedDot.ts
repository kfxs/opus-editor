/**
 * ⭐⭐ **THE SEAM WHERE AN AUGMENTATION DOT'S INK COMES BACK TO US** — the note's MODIFIERS,
 * 2026-09-14 (`docs/own-engraving-engine.md` P3; the ink is `engrave/notes/augmentationDot`).
 * The accidental's twin — see {@link EngravedAccidental} for the shape and for the write-back rule.
 *
 * `Dot.draw()` is thirteen lines, and only the last one paints:
 *
 * ```js
 * draw() {
 *   const stave = note.checkStave();
 *   const lineSpace = stave.getSpacingBetweenLines();
 *   const start = note.getModifierStartXY(this.position, this.index, { forceFlagRight: true });
 *   this.x = start.x;
 *   this.y = start.y + this.dotShiftY * lineSpace;   // ← the RULE: out of the line, half a space
 *   this.renderText(ctx, 0, 0);                      // ← the INK
 * }
 * ```
 *
 * ## ⚠️ `forceFlagRight`, and why it is transcribed rather than reasoned about
 *
 * A dot asks the note for its modifier point with that flag set; an accidental does not. It is what
 * pushes a dot clear of a stem-up flag, and it is the source of the *"a beamed eighth gets the flag
 * shift with no flag to clear"* quirk `rendering/dotPlacement` records as known-and-left-alone. ⛔ It
 * is VexFlow's argument, passed through unchanged: this class asks the same question at the same
 * moment and gets the same answer.
 *
 * ## ⛔ What this does NOT take
 *
 * ⭐ **`Dot.format` is ours since S9c** — which way a dot dodges its staff line when a chord stacks
 * them is `engrave/notes/dotStack`, VexFlow's rule transcribed; the survey that would let us choose
 * another is `docs/accidental-dot-research.md`.
 *
 * ⛔ **The GAP from the notehead** — `rendering/dotPlacement` already owns it (half a staff space,
 * edge to edge, his report of a dot standing too close). It moves the dot by `setXShift`, and this
 * class draws whatever x that left behind.
 *
 * ⚠️ **The TAB branch is not transcribed.** VexFlow's `draw` re-reads `start.y` from
 * `note.getStemExtents().baseY` when the note is a `TabNote`; this editor has no tablature and no
 * `TabNote` is constructed anywhere in it. ⭐ Stated so the omission is a fact about this repo rather
 * than an oversight — and guarded below, so it can never become a silently missing dot.
 */
import { Dot, isTabNote, type StaveNote } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_GLYPH_FONT } from '@/engine/engrave/inheritedFonts'
import { dotBaselineY, drawAugmentationDot } from '@/engine/engrave/notes/augmentationDot'
import type { InkSurfaceAware } from './inkSurface'
import { requireNoteFrame } from './staveFrame'

export class EngravedDot extends Dot implements InkSurfaceAware {
  /**
   * The surface this dot's glyph draws on — the note's own, handed over by `drawNoteInkThrough`
   * before the voices are drawn. Null until then, and then it falls back to `checkContext()`: an
   * unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedDot.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * The dot's vertical shift, in staff spaces (negative is up) — VexFlow's protected `dotShiftY`,
   * read and written by the column rule (`engrave/notes/dotStack`, S9c) and read by {@link draw}.
   */
  getShiftY(): number {
    return this.dotShiftY
  }

  setShiftY(spaces: number): void {
    this.dotShiftY = spaces
  }

  /** ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point. */
  override draw(): void {
    const vex = this.checkContext()
    const note = this.checkAttachedNote()
    this.setRendered()

    // ⚠️ Tablature and a cautionary dot's children are both VexFlow's paths, neither reachable in
    // this repo today (see the header). Handing them back keeps "not transcribed" honest.
    if (isTabNote(note) || this.children.length > 0) {
      super.draw()
      return
    }

    const start = note.getModifierStartXY(this.position, this.checkIndex(), { forceFlagRight: true })
    // ⚠️ THE WRITE-BACK: `this.x`/`this.y` are what anything asking this dot where it landed reads.
    this.x = start.x
    this.y = dotBaselineY(start.y, this.dotShiftY, requireNoteFrame(note).spacePx)

    drawAugmentationDot(this.inkSurface ?? vex, {
      glyph: this.getText(),
      x: this.x + this.getXShift(),
      y: this.y + this.getYShift(),
      font: MUSIC_GLYPH_FONT,
      // ⭐ The sign's own id, so its GROUP can be matched back to the hit box the registry
      //   files for it — P6b's seam (`docs/own-engraving-engine.md` §5 P6).
      id: this.getAttribute('id'),
    })
  }
}

/**
 * ⭐ Attach one dot per notehead — `Dot.buildAndAttach(notes, { all: true })`, with OUR dot.
 *
 * 🚨 **It has to be a function of ours**: VexFlow's builder is a STATIC that says `new Dot()` inside
 * itself, so substituting the class means substituting the builder. ⛔ There is nothing else in it —
 * `buildAndAttach`'s `all` branch is this loop, and the two branches this repo never uses (a single
 * index, and the default index 0) are left where they are rather than transcribed unused.
 */
export function attachEngravedDots(note: StaveNote): void {
  for (let i = 0; i < note.getKeys().length; i++) note.addModifier(new EngravedDot(), i)
}
