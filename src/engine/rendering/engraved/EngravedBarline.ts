/**
 * ⭐⭐ **A STAVE'S OWN BARLINE — a sign of ours, with no VexFlow class underneath** (S4c of
 * `docs/history/vexflow-removal-map.md`; the ink itself is `engrave/staff/openingBarline`).
 *
 * Every stave has one at each end, as VexFlow's `Stave` constructor gave it. It began (P5b) as a
 * subclass of VexFlow's `Barline` whose `draw()` moved the plain line's ink into our module:
 *
 * | | ours since | where |
 * |---|---|---|
 * | the INK of a plain line — 0.16 sp wide, spanning the staff's full ink | P5b | `engrave/staff/openingBarline` (it also DELETED the DOM repair `barlineInk.inkBarlines`) |
 * | the ROOM each kind takes in the walk | S4b1 | `engrave/staff/barlineMetrics` |
 * | the POSITION | S4b1 | {@link EngravedBarline.signX}, set by the stave's walk |
 * | the OBJECT and its KIND | S4c | this plain class; the stave sets the kind directly |
 *
 * ⛔ **Only two kinds are drawn here, and that is a statement about the page, not a gap.** A score
 * stave's opening barline is plain or none and its closing one is always none — `BarlineRenderer`
 * draws every line that ENDS a bar, and every repeat, double and final bar, by rules that replaced
 * VexFlow's. So a stave asked to draw any other kind refuses loudly instead of importing rules this
 * repo has already overruled.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawOpeningBarline, openingBarlineInk } from '@/engine/engrave/staff/openingBarline'
import { THIN_BARLINE_PX, staffBarlineExtent } from '../staff/barlineInk'
import { newSignId, type StaveSign } from '../staff/staveSign'
import { BARLINE_ROWS, type BarlineKind } from '@/engine/engrave/staff/barlineMetrics'
import type { WalkSign } from '@/engine/engrave/staff/signWalk'
import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'

export class EngravedBarline implements StaveSign {
  readonly signKind = 'barline' as const
  readonly id = newSignId()
  /** ⭐ Where this line stands — set by the stave's walk. */
  signX = 0
  /** A hand offset — nothing offsets a barline today; every stave sign has one. */
  signShift = 0

  private kind: BarlineKind

  constructor(kind: BarlineKind) {
    this.kind = kind
  }

  /** The stave changes which barline this is (`EngravedStave.setOpeningBarline` / `setClosingBarline`). */
  setKind(kind: BarlineKind): void {
    this.kind = kind
  }

  /** The walk's view of this line — `engrave/staff/barlineMetrics`' row for its kind. */
  walkInput(): WalkSign {
    const row = BARLINE_ROWS[this.kind]
    return { kind: 'barline', barline: this.kind, padding: row.padding, width: row.width, layout: row.layout }
  }

  /**
   * ⭐ A plain line, through our own primitives, inside the `stavebarline` group it has always had.
   *
   * ⚠️ **The thickness is in the STAVE's own space by inheritance, ⛔ not by conversion**: the rect lands
   * inside the bar's `<g>`, which carries the staff's scale, so a cue-size staff gets a proportionally
   * thinner opening line — `BarlineRenderer.drawSign`'s note is the argument for keeping it so.
   *
   * ⚠️ **A `none` line still opens and closes its group, on the PAGE's context**: VexFlow's `Barline.draw`
   * did exactly that — an empty `<g class="stavebarline">` on the context it painted with — so the SVG
   * keeps that group where it has always been, and the scene records nothing it never recorded.
   */
  drawSign(surface: DrawContext, frame: StaffFrame, page: DrawContext): void {
    if (this.kind === 'single') {
      const extent = staffBarlineExtent(frame)
      drawOpeningBarline(surface, openingBarlineInk(this.signX, extent.topY, extent.bottomY, THIN_BARLINE_PX), this.id)
      return
    }
    if (this.kind === 'none') {
      page.openGroup('stavebarline', this.id)
      page.closeGroup()
      return
    }
    throw new Error(`EngravedBarline: a '${this.kind}' barline is drawn by BarlineRenderer, never by the stave`)
  }
}
