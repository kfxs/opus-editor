/**
 * ⭐⭐ **THE SEAM WHERE AN AUGMENTATION DOT'S INK COMES BACK TO US** — the note's MODIFIERS,
 * 2026-09-14 (`docs/plans/own-engraving-engine.md` P3; the ink is `engrave/notes/augmentationDot`).
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
 * shift with no flag to clear"* quirk `rendering/format/dotPlacement` records as known-and-left-alone. ⛔ It
 * is VexFlow's argument, passed through unchanged: this class asks the same question at the same
 * moment and gets the same answer.
 *
 * ## ⛔ What this does NOT take
 *
 * ⭐ **`Dot.format` is ours since S9c** — which way a dot dodges its staff line when a chord stacks
 * them is `engrave/notes/dotStack`, VexFlow's rule transcribed; the survey that would let us choose
 * another is `docs/research/accidental-dot-research.md`.
 *
 * ⛔ **The GAP from the notehead** — `rendering/format/dotPlacement` already owns it (half a staff space,
 * edge to edge, his report of a dot standing too close). It moves the dot by `setXShift`, and this
 * class draws whatever x that left behind.
 *
 * ⚠️ **The TAB branch is not transcribed.** VexFlow's `draw` re-reads `start.y` from
 * `note.getStemExtents().baseY` when the note is a `TabNote`; this editor has no tablature and no
 * `TabNote` is constructed anywhere in it. ⭐ Stated so the omission is a fact about this repo rather
 * than an oversight — and REFUSED below, so it can never become a silently misplaced dot.
 *
 * ## ⭐ S12c — no longer VexFlow's `Dot`
 *
 * It keeps the modifier contract (`./EngravedModifier`) and what `Dot` itself added: RIGHT of its
 * note, the SMuFL `augmentationDot`, `dotShiftY`, and the WIDTH. ⚠️ The width is the glyph measured
 * in the NOTE's face (`Dot.setNote` copies `note.font`), and it can be WRITTEN — `dotPlacement` widens
 * every dot after it is attached, and VexFlow kept that width until the dot's font changed, which only
 * `setNote` does. So: an explicit width that `setNote` clears.
 */
import type { EngravedNote } from './EngravedNote'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_FONT_SIZE_PT, musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { NOTE_GLYPH_SCALE } from '@/engine/engrave/inheritedDefaults'
import { dotBaselineY, drawAugmentationDot } from '@/engine/engrave/notes/augmentationDot'
import type { InkSurfaceAware } from '../painter/inkSurface'
import { requireNoteFrame } from '../staff/staveFrame'
import { measureGlyphMetrics } from '../painter/glyphPainter'
import { EngravedModifier, MODIFIER_POSITION, attachModifier, type ModifierMetrics } from './EngravedModifier'

/** SMuFL `augmentationDot` — VexFlow's `Glyphs.augmentationDot`. */
const AUGMENTATION_DOT = '\uE1E7'

/** The note's own category, whose face a dot is measured in (`Dot.setNote` copies `note.font`). */
const NOTE_FACE_TAG = 'EngravedNote'

export class EngravedDot extends EngravedModifier implements InkSurfaceAware {
  static override get CATEGORY(): string {
    return 'Dot'
  }

  /**
   * The surface this dot's glyph draws on — the note's own, handed over by `drawNoteInkThrough`
   * before the voices are drawn. Null until then, and then it falls back to `checkContext()`: an
   * unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** The vertical shift, in staff spaces (negative is up) — `Dot`'s `dotShiftY`. */
  private dotShiftY = 0

  /** A width written over the measured one — see the header. Cleared by {@link setNote}. */
  private widthOverride: number | null = null

  constructor() {
    super()
    this.position = MODIFIER_POSITION.RIGHT
  }

  /** @see EngravedDot.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /** `Dot.setNote`: the note, whose face the dot is now measured in — so a written width is dropped. */
  override setNote(note: EngravedNote): this {
    this.widthOverride = null
    return super.setNote(note)
  }

  /**
   * The dot's vertical shift, in staff spaces (negative is up) — read and written by the column rule
   * (`engrave/notes/dotStack`, S9c) and read by {@link draw}.
   */
  getShiftY(): number {
    return this.dotShiftY
  }

  setShiftY(spaces: number): void {
    this.dotShiftY = spaces
  }

  /** The glyph it stamps. */
  getText(): string {
    return AUGMENTATION_DOT
  }

  /** How much room it takes — the glyph's advance in the note's face, unless {@link setWidth} wrote one. */
  getWidth(): number {
    return this.widthOverride ?? this.measured().width
  }

  setWidth(width: number): this {
    this.widthOverride = width
    return this
  }

  private measured() {
    return measureGlyphMetrics(NOTE_FACE_TAG, AUGMENTATION_DOT, MUSIC_FONT_SIZE_PT * NOTE_GLYPH_SCALE * this.noteScale())
  }

  protected inkMetrics(): ModifierMetrics {
    const { ascent, descent } = this.measured()
    return { width: this.getWidth(), ascent, descent }
  }

  /** ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point. */
  draw(): void {
    const context = this.checkContext()
    const note = this.checkAttachedNote() as EngravedNote
    this.setRendered()

    // ⚠️ Tablature is VexFlow's path and unreachable in this repo (see the header) — refused, never guessed.
    if (note.getCategory() === 'TabNote') throw new Error('EngravedDot: a dot on a TabNote is not transcribed.')

    const start = note.getModifierStartXY(this.position, this.checkIndex(), { forceFlagRight: true })
    // ⚠️ THE WRITE-BACK: `this.x`/`this.y` are what anything asking this dot where it landed reads.
    this.x = start.x
    this.y = dotBaselineY(start.y, this.dotShiftY, requireNoteFrame(note).spacePx)

    drawAugmentationDot(this.inkSurface ?? context, {
      glyph: AUGMENTATION_DOT,
      x: this.x + this.getXShift(),
      y: this.y + this.yShift,
      font: musicGlyphFont(this.noteScale()),
      // ⭐ The sign's own id, so its GROUP can be matched back to the hit box the registry
      //   files for it — P6b's seam (`docs/plans/own-engraving-engine.md` §5 P6).
      id: this.getAttribute('id')!,
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
export function attachEngravedDots(note: EngravedNote): void {
  for (let i = 0; i < note.getKeys().length; i++) attachModifier(note, new EngravedDot(), i)
}

/** The dots hung on `note`, in the order they were attached — `Dot.getDots`. */
export function dotsOn(note: EngravedNote): EngravedDot[] {
  return (note.getModifiers() as unknown[]).filter((m): m is EngravedDot => m instanceof EngravedDot)
}
