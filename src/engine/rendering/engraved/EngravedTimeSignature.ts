/**
 * ⭐⭐ **A TIME SIGNATURE ON A SCORE STAVE — a sign of ours, with no VexFlow class underneath** (S4c of
 * `docs/history/vexflow-removal-map.md`; the ink itself is `engrave/header/meter`).
 *
 * It began (P5b) as a subclass of VexFlow's `TimeSignature` whose `draw()` moved the ink into our
 * module. Piece by piece everything else followed:
 *
 * | | ours since | where |
 * |---|---|---|
 * | the INK | P5b | `engrave/header/meter` |
 * | the ROWS — numerals, lines, half-line shift, centring | S4b0 | `engrave/header/meterSign`, from the score's own `TimeSignature` |
 * | the POSITION | S4b1 | {@link EngravedTimeSignature.signX}, walked by the stave (`engrave/staff/signWalk`), placed by `./headerPlacementPass` |
 * | the OBJECT | S4c | this plain class, held in `EngravedStave`'s own sign list |
 *
 * 🚨 The ROW GAP stays today's 2 sp: it is ⛔ **UNKNOWN in every treatise**
 * (`docs/research/header-spacing-research.md` row **H**), so a migration is the last place it may be chosen.
 *
 * ⚠️ VexFlow's `drawAt` — the ungrouped path a `TimeSigNote` took — is gone with the subclass: nothing
 * in this repo makes a `TimeSigNote` (a mid-bar meter change is the renderer's own pass).
 * `engrave/header/meter.stampMeter` keeps that shape for the day something does.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { TimeSignature as Meter } from '@/types/music'
import { meterLayout, type MeterLayout, type MeterRowLine } from '@/engine/engrave/header/meterSign'
import { measureGlyph } from '../painter/glyphPainter'
import { musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { drawMeter, type MeterRow } from '@/engine/engrave/header/meter'
import { newSignId, type StaveSign } from '../staff/staveSign'
import { METER_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import type { WalkSign } from '@/engine/engrave/staff/signWalk'
import { staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'

export class EngravedTimeSignature implements StaveSign {
  readonly signKind = 'meter' as const
  readonly id = newSignId()
  /** ⭐ Where this meter stands — walked by the stave, placed by `./headerPlacementPass`. */
  signX = 0
  /** A hand offset, added to a symbol meter when it is drawn. */
  signShift = 0

  /** What this meter draws — `engrave/header/meterSign`, laid out once, where VexFlow measured its rows. */
  private readonly layout: MeterLayout

  constructor(meter: Meter) {
    this.layout = meterLayout(meter, glyphs => measureGlyph('EngravedTimeSignature.row', glyphs, musicGlyphFont().size))
  }

  /** The walk's view of this meter — as wide as its wider row, with the meter's own padding. */
  walkInput(): WalkSign {
    return { kind: 'meter', padding: METER_PADDING_PX, width: this.layout.width }
  }

  /** ⭐ The rows, through our own primitives, inside the `timesignature` group they have always had. */
  drawSign(surface: DrawContext, frame: StaffFrame): void {
    drawMeter(surface, this.meterRows(frame), this.id)
  }

  /**
   * The rows this meter stamps.
   *
   * ⚠️ A SYMBOL meter (`C`, `C|`) adds the sign's own hand shift, as VexFlow's `renderText` added its
   * `xShift`; the numeral rows were bare elements VexFlow never positioned, so theirs is 0.
   */
  private meterRows(frame: StaffFrame): MeterRow[] {
    const shift = this.layout.numeric ? 0 : this.signShift
    return this.layout.rows.map(row => ({
      glyph: row.glyph,
      x: this.signX + row.dx + shift,
      lineY: rowLineY(frame, row.line),
      font: musicGlyphFont(),
    }))
  }
}

/** A row's baseline y — on its line, or midway between the placements of its two. */
function rowLineY(frame: StaffFrame, line: MeterRowLine): number {
  return typeof line === 'number' ? staffLineY(frame, line) : (staffLineY(frame, line[0]) + staffLineY(frame, line[1])) / 2
}
