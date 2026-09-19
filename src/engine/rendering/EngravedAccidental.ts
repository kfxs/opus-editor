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
 * ⛔ **`getModifierStartXY`** — where the note offers its modifiers a place to stand. This class asks
 * the note; the answer has been ours since S5a (`engrave/notes/modifierStart`).
 *
 * ⛔ **Which column of a chord's accidental stack this one stands in** — ours since S9d, but not
 * here: `engrave/notes/accidentalStack` (VexFlow's `Accidental.format`, transcribed), run by
 * `rendering/modifierColumns`. The FAN packs its own members by `chordAccidentalColumns` (Gould's rule).
 *
 * ## ⭐⭐ …and since 2026-09-14 it is also the RULER for its own sign (P6b)
 *
 * {@link EngravedAccidental.drawnInk} answers what the stamp covered, computed from the stamp —
 * and `ScoreRenderer` files THAT as the accidental's hit box. ⇒ *"a click here selects that
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
 *
 * ## ⭐ S12e — no longer VexFlow's `Accidental`
 *
 * It keeps the modifier contract (`./EngravedModifier`) and what `Accidental` added: LEFT of its
 * note, its sign `type` (read by the column rule and the slur), the glyph (`accidentalGlyph` — the five
 * signs this editor writes; any other is refused), and the WIDTH — the glyph measured in the
 * `Accidental` category's face at `Accidental.fontSize` (the root 30). ⛔ VexFlow's two other branches
 * are REFUSED, not transcribed: a CAUTIONARY sign (brackets, 20 pt) and a GRACE note's (20 pt) —
 * neither is ever built here, and a refusal keeps that a fact rather than a silent wrong size.
 */
import type { EngravedNote } from './EngravedNote'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_FONT_SIZE_PT, accidentalFont } from '@/engine/engrave/inheritedFonts'
import { accidentalOriginX, drawAccidental, type AccidentalInk } from '@/engine/engrave/notes/accidental'
import { accidentalGlyph } from '@/engine/fonts/fontMetrics'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import type { SceneBox } from '@/engine/scene/sceneBox'
import type { InkSurfaceAware } from './inkSurface'
import { drawnInkBoxOf } from './sceneInk'
import { measureGlyphMetrics } from './glyphPainter'
import { EngravedModifier, MODIFIER_POSITION, type ModifierMetrics } from './EngravedModifier'

/** The category whose face a sign is measured in — `Accidental`, which walks up to the root. */
const SIGN_TAG = 'Accidental'

export class EngravedAccidental extends EngravedModifier implements InkSurfaceAware {
  static override get CATEGORY(): string {
    return 'Accidental'
  }

  /** The sign as written — `'#'`, `'##'`, `'b'`, `'bb'`, `'n'`. */
  readonly type: string

  /** Its SMuFL glyph. */
  private readonly glyph: string

  /**
   * The surface this accidental's glyph draws on — the note's own, handed over by
   * {@link drawNoteInkThrough} before the voices are drawn. Null until then, and then it falls back
   * to `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedAccidental.drawnInk */
  private ink: SceneBox | null = null

  constructor(type: string) {
    super()
    const name = accidentalGlyph(type)
    if (!name) throw new Error(`EngravedAccidental: no glyph for the sign "${type}" — only # ## b bb n are written here.`)
    this.type = type
    this.glyph = String.fromCodePoint(GLYPH_CODEPOINTS[name])
    this.position = MODIFIER_POSITION.LEFT
  }

  /** `Accidental.setNote`: its `reset` picks a grace note's size — refused, as no grace note is built. */
  override setNote(note: EngravedNote): this {
    if (note.getCategory() === 'GraceNote') throw new Error('EngravedAccidental: a grace note\'s accidental is not transcribed.')
    return super.setNote(note)
  }

  /** @see EngravedAccidental.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /** The glyph it stamps. */
  getText(): string {
    return this.glyph
  }

  /** How much room it takes — the glyph's advance at the sign's size. */
  getWidth(): number {
    return this.measured().width
  }

  /** Move it by `px` on top of the shift it has — the note offset's nudge (`ScoreRenderer`). */
  nudgeX(px: number): this {
    this.xShift += px
    return this
  }

  private measured() {
    return measureGlyphMetrics(SIGN_TAG, this.glyph, MUSIC_FONT_SIZE_PT)
  }

  protected inkMetrics(): ModifierMetrics {
    const { width, ascent, descent } = this.measured()
    return { width, ascent, descent }
  }

  /**
   * ⭐⭐ **WHAT THIS SIGN'S INK COVERS — P6b's first hit box** (`docs/own-engraving-engine.md` §5 P6).
   *
   * Computed from the stamp itself ({@link drawnInkBoxOf}), so it is the glyph's own outline in the
   * coordinates the glyph was drawn in — ⛔ not `getBoundingBox()`, whose height is the FONT'S LINE
   * BOX (measured in `e2e/sceneBox.e2e.ts` at more than three times the sign) hung off this object's
   * `x`/`y` fields.
   *
   * @returns null before the sign has drawn. ⛔ Never a box "about right": an unmeasured glyph
   *   answers null too.
   */
  drawnInk(): SceneBox | null {
    return this.ink
  }

  /** ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point. */
  draw(): void {
    const vex = this.checkContext()
    const note = this.checkAttachedNote() as EngravedNote
    this.setRendered()

    this.ink = null

    const start = note.getModifierStartXY(this.position, this.checkIndex())
    this.x = accidentalOriginX(start.x, this.getWidth())
    this.y = start.y

    const ink: AccidentalInk = {
      glyph: this.glyph,
      x: this.x + this.xShift,
      y: this.y + this.yShift,
      font: accidentalFont(this.glyph),
      id: this.getAttribute('id')!,
    }
    drawAccidental(this.inkSurface ?? vex, ink)
    this.ink = drawnInkBoxOf(ctx => drawAccidental(ctx, ink))
  }
}

/** The accidentals hung on `note`, in the order they were attached. */
export function accidentalsOn(note: EngravedNote): EngravedAccidental[] {
  return (note.getModifiers() as unknown[]).filter((m): m is EngravedAccidental => m instanceof EngravedAccidental)
}
