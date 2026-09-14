/**
 * ⭐⭐ **THE SEAM WHERE THE TIME SIGNATURE'S INK COMES BACK TO US — P5b**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/header/meter`).
 *
 * `TimeSignature.draw()` is a group around `drawAt()`, and `drawAt()` is a fork:
 *
 * ```js
 * draw()  { ctx.openGroup('timesignature', id); this.drawAt(ctx, stave, this.x); ctx.closeGroup() }
 * drawAt(ctx, stave, x) {
 *   if (this.isNumeric) {
 *     let y = this.botText.getText().length > 0
 *       ? stave.getYForLine(this.topLine - this.lineShift)          // ← the RULE, as a side effect
 *       : (stave.getYForLine(this.topLine) + stave.getYForLine(this.bottomLine)) / 2
 *     this.topText.renderText(ctx, x + this.topStartX, y)           // ← the INK
 *     this.botText.renderText(ctx, x + this.botStartX, stave.getYForLine(this.bottomLine + this.lineShift))
 *   } else {
 *     this.renderText(ctx, x - this.x, stave.getYForLine(this.line))
 *   }
 * }
 * ```
 *
 * ⭐ **So this is the same shape P5a, P3b and `EngravedClef` were**: the ink moves to a module of
 * ours, the object keeps answering every question it answered before, and **no pixel moves**. What is
 * bought is that a meter is now IN THE SCENE — *"a 3 is stamped at this x on the second line down, a
 * 4 on the fourth"* is arithmetic in jsdom, where before it needed a browser and a font.
 *
 * ⭐⭐ **And it closes a real second-owner risk rather than only a stylistic one.** `drawAt` is
 * reachable by two paths — the stave modifier (`draw`) and a `TimeSigNote`'s mid-bar meter change —
 * so overriding `draw` alone would have left the SAME placement arithmetic in two bodies, one of them
 * ours. ⛔ *"The second owner is the tell"* (`own-engraving-engine.md` §3.1), which this migration has
 * now met in the ledger line, the stem and the staff line. Both overrides below build their rows from
 * {@link EngravedTimeSignature.meterRows}, so there is exactly one.
 *
 * ⚠️ `TimeSigNote` is **not used in this repo today** (an inline meter change is drawn by
 * `VexFlowRenderer`'s own pass), so that path is transcribed and unexercised — ⭐ which is precisely
 * why it must not be allowed to drift from the one that runs.
 *
 * ## ⛔ What this does NOT take
 *
 * ✅ **The PLACEMENT is ours since S4b1** — {@link EngravedTimeSignature.signX}, walked by the stave
 * (`engrave/staff/signWalk`) and placed by `./headerPlacementPass`.
 *
 * ✅ **The ROWS are ours since S4b0** — `engrave/header/meterSign` composes them from the score's own
 * `TimeSignature`: the numerals, the lines they stand on, the half-line shift, and the centring of the
 * shorter row over the wider, from widths measured here through `./glyphPainter` (the same
 * `measureText` VexFlow used). 🚨 The ROW GAP stays today's 2 sp: it is ⛔ **UNKNOWN in every treatise**
 * (`docs/header-spacing-research.md` row **H**), so a migration is the last place it may be chosen.
 *
 * ⚠️ **A subclass, for the reason `EngravedStave`, `EngravedClef`, `EngravedBeam` and `EngravedNote`
 * are ones.** Nothing positional is read off it any more (S4b1).
 */
import { TimeSignature, type Stave } from 'vexflow'
import type { TimeSignature as Meter } from '@/types/music'
import { timeSignatureVexKey } from '@/utils/meter'
import { meterLayout, type MeterLayout, type MeterRowLine } from '@/engine/engrave/header/meterSign'
import { measureGlyph } from './glyphPainter'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_GLYPH_FONT } from '@/engine/engrave/inheritedFonts'
import { drawMeter, stampMeter, type MeterRow } from '@/engine/engrave/header/meter'
import type { InkSurfaceAware } from './inkSurface'
import type { StaveSign } from './staveSign'
import { METER_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import type { WalkSign } from '@/engine/engrave/staff/signWalk'
import { staveFrame } from './staveFrame'
import { staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'

export class EngravedTimeSignature extends TimeSignature implements InkSurfaceAware, StaveSign {
  /**
   * The surface this meter's glyphs draw on — the stave's own, handed over by `EngravedStave` a line
   * before it draws its modifiers. Null until then, and then the meter falls back to the stave's
   * `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   * (`EngravedStave.inkSurface` and `EngravedClef.inkSurface` carry the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedTimeSignature.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **What this meter draws, as ours** — S4b0 (`engrave/header/meterSign`), laid out once here, where
   * VexFlow's constructor measured its own rows.
   */
  private readonly layout: MeterLayout

  readonly signKind = 'meter' as const
  /** ⭐ S4b1 — where this meter stands, OURS: walked by the stave, placed by `./headerPlacementPass`. */
  signX = 0
  /** A hand offset, added to a symbol meter when it is drawn. */
  signShift = 0
  /** The padding the walk gives this meter — `customPadding`, or the constructor's own 15. */
  private readonly walkPadding: number

  constructor(meter: Meter, customPadding?: number) {
    super(timeSignatureVexKey(meter), customPadding)
    this.layout = meterLayout(meter, glyphs => measureGlyph('EngravedTimeSignature.row', glyphs, MUSIC_GLYPH_FONT.size))
    this.walkPadding = customPadding ?? METER_PADDING_PX
  }

  /** The walk's view of this meter — as wide as its wider row. */
  walkInput(): WalkSign {
    return { kind: 'meter', padding: this.walkPadding, width: this.layout.width }
  }

  /**
   * ⭐ **OURS as of P5b** — the glyphs, through our own primitives, inside the group they have always
   * been drawn in.
   */
  override draw(): void {
    const stave = this.checkStave()
    this.setRendered()
    drawMeter(
      this.inkSurface ?? stave.checkContext(),
      this.meterRows(staveFrame(stave), this.signX),
      this.getAttribute('id'),
    )
  }

  /**
   * ⭐ The ungrouped entry point — a `TimeSigNote`'s mid-bar meter change, which draws inside the
   * NOTE's group and so must open none of its own.
   *
   * ⭐⭐ **It takes OUR surface, and the override still satisfies VexFlow's signature** — because
   * `DrawContext` is an interface VexFlow's own context satisfies structurally. That inversion is the
   * whole point of P1b (*"declaring our own interface and letting `SVGContext` satisfy it
   * structurally inverts the dependency while implementing nothing"*), and this is the first place it
   * pays literally rather than in principle: a VexFlow method is overridden with a signature that
   * names nothing of VexFlow's, so `npm run lint:paint` sees a file that draws only through us.
   * ⛔ Widening it to `RenderContext` to match the parent letter-for-letter would have put the
   * migration's own gauge up by one for a path nothing calls.
   *
   * ⚠️ An `inkSurface` is deliberately NOT preferred here: this path's caller owns the group the ink
   * lands in, so taking a different surface would split one sign's ink across two contexts.
   */
  override drawAt(ctx: DrawContext, stave: Stave, x: number): void {
    this.setRendered()
    stampMeter(ctx, this.meterRows(staveFrame(stave), x))
  }

  /**
   * ⭐ The rows this meter stamps at `x` — laid out by `engrave/header/meterSign` from the MODEL (S4b0),
   * ⛔ no longer read off VexFlow's `topText`/`botText`/`topStartX`/`lineShift`.
   *
   * ⚠️ A SYMBOL meter (`C`, `C|`) adds the sign's own hand shift, as VexFlow's `renderText` added its
   * `xShift`; the numeral rows were bare elements VexFlow never positioned, so theirs is 0. Nothing gives
   * a meter a y of its own.
   */
  private meterRows(frame: StaffFrame, x: number): MeterRow[] {
    const own = this.layout.numeric ? { x: 0, y: 0 } : { x: this.signShift, y: 0 }
    return this.layout.rows.map(row => ({
      glyph: row.glyph,
      x: x + row.dx + own.x,
      lineY: rowLineY(frame, row.line) + own.y,
      font: MUSIC_GLYPH_FONT,
    }))
  }
}

/** A row's baseline y — on its line, or midway between the placements of its two. */
function rowLineY(frame: StaffFrame, line: MeterRowLine): number {
  return typeof line === 'number' ? staffLineY(frame, line) : (staffLineY(frame, line[0]) + staffLineY(frame, line[1])) / 2
}
