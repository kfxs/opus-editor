/**
 * ⭐⭐ **THE SEAM WHERE AN ARTICULATION'S INK COMES BACK TO US** — the note's MODIFIERS, 2026-09-14
 * (`docs/plans/own-engraving-engine.md` P3; the ink itself is `engrave/notes/articulation`).
 * The third member of the family {@link EngravedAccidental} and {@link EngravedDot} opened — and the
 * one the CENSUS named: *"the articulation, and nothing else, is still a VexFlow modifier"*
 * (`ScoreRenderer.scene.test.ts`) was a passing assertion written so that the day it moved, it
 * failed and said so. This is that day.
 *
 * ## ⭐⭐ Why this one overrides `renderText` and its two siblings override `draw`
 *
 * `Accidental.draw()` and `Dot.draw()` are ten lines of which nine are a point they ASK the note for
 * — so taking them meant transcribing one call and one subtraction, and the rule came with it.
 * ⛔ **`Articulation.draw()` is not that shape.** It is forty lines that reach through `getTopY` /
 * `getBottomY` / `getInitialOffset`, a private `snapLineToStaff` and `setOrigin`, and only the last
 * line paints:
 *
 * ```js
 * draw() {
 *   …                                 // ← the PLACEMENT: side, distance, the snap to a line or a space
 *   this.x = x; this.y = y;
 *   this.renderText(ctx, 0, 0);       // ← the INK, and the whole of what this class takes
 * }
 * ```
 *
 * ⭐ (Which TEXT LINE each mark of a column stands on — `Articulation.format` — is ours since S9e,
 * `engrave/notes/articulationStack`; what `draw` does with that line is still VexFlow's.)
 *
 * ⭐ Overriding `draw` would mean **transcribing that placement**, and this repo has measured what
 * that costs: `./fanArticulations` hand-rolled a *"one staff space per mark"* rule for a fan's
 * members and landed a staccato 2 px off the identical mark on the next note. ⇒ ⭐⭐ **the narrowest
 * possible cut is the one that leaves the rule with ONE owner** — `own-engraving-engine.md` §3.1's
 * *"the second owner is the tell"*, applied before rather than after. It is also the seam
 * `fanArticulations` already uses from the outside: it runs `draw()` against a context that throws
 * the ink away, and then calls `renderText` itself.
 *
 * ## ⚠️ `_ctx: unknown`, and it is a statement rather than a dodge
 *
 * `renderText`'s first parameter is VexFlow's `RenderContext`, and ⛔ **naming that type outside
 * `lint:paint`'s allowlist is the one thing that check refuses** — which is why `EngravedBeam`,
 * while it was still a VexFlow `Beam`, overrode the public `draw()` rather than the
 * `protected drawBeamLines(ctx: RenderContext)` it would rather have had. ⭐ Here the honest answer is that **this file does not use VexFlow's context at
 * all**: the ink goes to our own surface, and the fallback asks `checkContext()` for the same object
 * the caller would have handed in. Every reachable caller passes exactly that — `Articulation.draw`
 * calls `this.renderText(this.checkContext(), 0, 0)`, and `fanArticulations` calls `setContext(ctx)`
 * immediately before — so the parameter is genuinely unused, and typing it as anything narrower
 * would be claiming a coupling that is not here. ⛔ The allowlist did not grow for this.
  *
 * ## ⭐⭐ S12f — and now the PLACEMENT too, transcribed, ONE owner
 *
 * No longer VexFlow's `Articulation`: it keeps the modifier contract (`./EngravedModifier`), and
 * `Articulation.draw`'s placement is `engrave/notes/articulationPlacement` — transcribed EXACTLY, and
 * proved byte-identical on the page, which is the difference from the fan's hand-rolled rule above.
 * ⚠️ `setOrigin` is VexFlow's `Element.setOrigin`, quirk and all: `draw` calls it BEFORE writing the
 * new `x`/`y`, so the centring reads the box at the mark's PREVIOUS position, and it divides by the
 * glyph's width (NaN in jsdom, where nothing measures). ⛔ Not "fixed" — it is what the page shows.
 * ⚠️ Until S12f2 the FAN's stand-in (`./fanArticulations`) still runs VexFlow's own copy.
 */
import type { EngravedNote } from './EngravedNote'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_FONT_SIZE_PT, musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { drawArticulation, type ArticulationInk } from '@/engine/engrave/notes/articulation'
import { ARTICULATION_OUTSIDE_ROW, placeArticulation } from '@/engine/engrave/notes/articulationPlacement'
import { textRowAboveY, textRowBelowY } from '@/engine/engrave/staff/staffFrame'
import { GLYPH_CODEPOINTS, type GlyphName } from '@/engine/fonts/bravuraMetrics'
import type { InkSurfaceAware } from '../painter/inkSurface'
import { measureGlyphMetrics } from '../painter/glyphPainter'
import { requireNoteFrame } from '../staff/staveFrame'
import { noteRuler } from './noteRuler'
import { EngravedModifier, MODIFIER_POSITION, type ModifierMetrics } from './EngravedModifier'

/**
 * The marks this editor writes — VexFlow's `Tables.articulationCodes` rows for them: the glyph above
 * and below the note, and whether it may sit between the staff lines (all three may).
 */
const ARTICULATION_ROWS: Readonly<Record<string, { above: GlyphName; below: GlyphName; betweenLines: boolean }>> = {
  'a.': { above: 'augmentationDot', below: 'augmentationDot', betweenLines: true },
  'a>': { above: 'articAccentAbove', below: 'articAccentBelow', betweenLines: true },
  'a-': { above: 'articTenutoAbove', below: 'articTenutoBelow', betweenLines: true },
}

/** The category whose face a mark is measured in — `Articulation`, which walks up to the root. */
const MARK_TAG = 'Articulation'

export class EngravedArticulation extends EngravedModifier implements InkSurfaceAware {
  static override get CATEGORY(): string {
    return 'Articulation'
  }

  /** The code it was built from — `'a.'`, `'a>'`, `'a-'`. */
  readonly type: string

  private readonly row: { above: GlyphName; below: GlyphName; betweenLines: boolean }

  /**
   * The surface this mark's glyph draws on — the note's own, handed over by `drawNoteInkThrough`
   * before the voices are drawn. Null until then, and then it falls back to VexFlow's context: an
   * unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  constructor(type: string) {
    super()
    const row = ARTICULATION_ROWS[type]
    if (!row) throw new Error(`EngravedArticulation: no row for "${type}" — only a. a> a- are written here.`)
    this.type = type
    this.row = row
    this.position = MODIFIER_POSITION.ABOVE
  }

  /** @see EngravedArticulation.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * Whether this mark may sit between the staff lines — read by the column rule
   * (`engrave/notes/articulationStack`, S9e) and by the placement.
   */
  /** The opt-in scale of the step out from the note — a GRACE's size (`articulationPlacement.outwardScale`). */
  private outwardScale = 1

  setOutwardScale(scale: number): this {
    this.outwardScale = scale
    return this
  }

  canSitBetweenLines(): boolean {
    return this.row.betweenLines
  }

  /** The glyph it stamps — its row's ABOVE glyph when above, else its BELOW one (`Articulation.reset`). */
  getText(): string {
    return String.fromCodePoint(GLYPH_CODEPOINTS[this.position === MODIFIER_POSITION.ABOVE ? this.row.above : this.row.below])
  }

  private measured() {
    return measureGlyphMetrics(MARK_TAG, this.getText(), MUSIC_FONT_SIZE_PT)
  }

  getWidth(): number {
    return this.measured().width
  }

  /** The glyph's ink height — what the column steps the next mark by (`Element.height`). */
  get height(): number {
    const { ascent, descent } = this.measured()
    return ascent + descent
  }

  protected inkMetrics(): ModifierMetrics {
    const { width, ascent, descent } = this.measured()
    return { width, ascent, descent }
  }

  getX(): number {
    return this.x
  }

  getY(): number {
    return this.y
  }

  /**
   * `Element.setOrigin`, transcribed: re-express the shifts so the point `(x, y)` of the box — as a
   * fraction of its width and height — is where it is drawn from. ⚠️ Reads the box at the CURRENT
   * `x`/`y` (see the header).
   */
  setOrigin(x: number, y: number): this {
    const bx = this.getBoundingBox()
    const originX = Math.abs((bx.getX() - this.xShift) / bx.getW())
    this.xShift = -((x - originX) * bx.getW())
    const by = this.getBoundingBox()
    const originY = Math.abs((by.getY() - this.yShift) / by.getH())
    this.yShift = -((y - originY) * by.getH())
    return this
  }

  /**
   * ⭐ **WHERE IT STANDS** — `Articulation.draw` up to its ink: the placement
   * (`engrave/notes/articulationPlacement`), the centring, and the write-back of `x`/`y`. Called by
   * {@link draw}, and alone by the fan's stand-in (`./fanArticulations`), which paints the ink itself.
   */
  place(): void {
    const note = this.checkAttachedNote() as EngravedNote
    const index = this.checkIndex()
    if (note.getCategory() === 'TabNote') throw new Error('EngravedArticulation: a mark on a TabNote is not transcribed.')
    const side = this.position === MODIFIER_POSITION.ABOVE ? 'above' : this.position === MODIFIER_POSITION.BELOW ? 'below' : null
    // VexFlow's draw looked the side up in a two-row table — any other position threw there too.
    if (!side) throw new Error('EngravedArticulation: a mark must stand above or below its note.')

    const frame = requireNoteFrame(note)
    const ruler = noteRuler(note)
    const { x } = note.getModifierStartXY(this.position, index)
    const { y, centred } = placeArticulation({
      side,
      textLine: this.textLine,
      canSitBetweenLines: this.row.betweenLines,
      staffSpace: frame.spacePx,
      hasStem: ruler.hasStem,
      stemDirection: ruler.stemDirection,
      stemTipY: ruler.stemTipY,
      stemBaseY: ruler.stemBaseY,
      headYs: ruler.headYs,
      headY: ruler.headYs[index],
      headLine: Number(note.getKeyProps()[index].line),
      outsideStaffY: side === 'above' ? textRowAboveY(frame, ARTICULATION_OUTSIDE_ROW) : textRowBelowY(frame, ARTICULATION_OUTSIDE_ROW),
      ...(this.outwardScale !== 1 && { outwardScale: this.outwardScale }),
    })
    // ⚠️ BEFORE the new x/y, as VexFlow ordered it (see the header).
    if (centred) this.setOrigin(0.5, 0.5)
    this.x = x
    this.y = y
  }

  /** Move the placed mark along the staff — the fan's stand-in, carried onto the head it stands for. */
  moveX(dx: number): this {
    this.x += dx
    return this
  }

  /** The ink the mark makes where it was placed — the stamp point with its shifts folded in. */
  inkAt(): ArticulationInk {
    return {
      glyph: this.getText(),
      x: this.x + this.xShift,
      y: this.y + this.yShift,
      font: musicGlyphFont(),
      id: this.getAttribute('id')!,
    }
  }

  /** ⭐ **OURS** — `Articulation.draw`: {@link place}, then the ink in a group of its own. */
  draw(): void {
    const context = this.checkContext()
    this.setRendered()
    this.place()
    drawArticulation(this.inkSurface ?? context, this.inkAt())
  }
}

/** Whether `note` carries an articulation — asked of its modifier list. */
export function hasArticulation(note: { getModifiers(): unknown[] }): boolean {
  return note.getModifiers().some(m => m instanceof EngravedArticulation)
}
