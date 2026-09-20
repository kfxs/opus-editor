/**
 * ⭐⭐ **A CLEF ON A SCORE STAVE — a sign of ours, with no VexFlow class underneath** (S4c of
 * `docs/history/vexflow-removal-map.md`; the ink itself is `engrave/header/clef`).
 *
 * It began (P5b) as a subclass of VexFlow's `Clef` whose `draw()` moved the ink into our module. Piece
 * by piece everything else followed:
 *
 * | | ours since | where |
 * |---|---|---|
 * | the INK | P5b | `engrave/header/clef` |
 * | the GLYPH, the LINE it names, the FACE | S4b0 | `engrave/header/clefSign` — today's `Clef.types` lines and `Clef.getPoint` ⅔, as rows |
 * | the POSITION | S4b1 | {@link EngravedClef.signX}, walked by the stave (`engrave/staff/signWalk`), placed by `./headerPlacementPass`, nudged by `./clefOffsetPass` |
 * | the OBJECT | S4c | this plain class, held in `EngravedStave`'s own sign list |
 *
 * ⭐ **A clef is IN THE SCENE** — *"a clef is stamped at this x, on this line, as this codepoint"* is
 * arithmetic in jsdom.
 *
 * ⛔ **The INLINE clef is not this.** A clef change at `beat > 0` is a TICKABLE in the bar's voice —
 * `./EngravedClefChange` (S12j-e; VexFlow's `ClefNote` until then) — drawing the same rows at `'small'`.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Clef as ScoreClef } from '@/types/music'
import { clefSign, type ClefSign, type ClefSize } from '@/engine/engrave/header/clefSign'
import { clefPlacement, drawClef } from '@/engine/engrave/header/clef'
import { newSignId, type StaveSign } from './staveSign'
import { measureGlyph } from './glyphPainter'
import { STAVE_SIGN_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import type { WalkSign } from '@/engine/engrave/staff/signWalk'
import { staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'

export class EngravedClef implements StaveSign {
  readonly signKind = 'clef' as const
  readonly id = newSignId()
  /** ⭐ Where this clef stands — walked by the stave, moved by `./headerPlacementPass`. */
  signX = 0
  /** A hand offset (`./clefOffsetPass`), added when the clef is drawn. */
  signShift = 0

  /** What this clef draws — `engrave/header/clefSign`: the glyph, the line it names, its face. */
  private readonly sign: ClefSign
  /** How wide the walk counts this clef — its glyph measured in its own face, as VexFlow measured it. */
  private readonly walkWidth: number

  constructor(clef: ScoreClef, size: ClefSize) {
    this.sign = clefSign(clef, size)
    this.walkWidth = measureGlyph('EngravedClef.walk', this.sign.glyph, this.sign.font.size)
  }

  /** The walk's view of this clef. */
  walkInput(): WalkSign {
    return { kind: 'clef', padding: STAVE_SIGN_PADDING_PX, width: this.walkWidth }
  }

  /**
   * ⭐ The glyph, through our own primitives, on the line it names — that line's y is the BASELINE
   * (`engrave/header/clef`'s rule).
   */
  drawSign(surface: DrawContext, frame: StaffFrame): void {
    drawClef(
      surface,
      this.sign.glyph,
      clefPlacement({ x: this.signX + this.signShift, lineY: staffLineY(frame, this.sign.line) }),
      this.sign.font,
      this.id,
    )
  }
}
