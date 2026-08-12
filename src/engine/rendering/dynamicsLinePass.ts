/**
 * ⭐⭐ **THE DYNAMICS LINE, applied — the post-measure system pass that puts every mark on it.**
 *
 * P1 of docs/dynamics-line-and-hairpins-plan.md, and the plan's option **(c)**: the marks stay
 * exactly where they are drawn — a VexFlow `Annotation` attached to its anchor note, inside its
 * measure's group — and this pass TRANSLATES them onto the line afterwards. `engine/layout/
 * dynamicsLine.ts` decides where the line is; this decides nothing and moves everything.
 *
 * ⭐ **Why a translate rather than a placement.** A mark's y stops being a fact about its BAR and
 * becomes one about its SYSTEM — a low note in bar 3 moves bar 1's `p` — and the measure cache asks
 * "does this bar still look the same" from the bar's own content. The two other answers both cost
 * more than they are worth here: putting the line in every measure's shape key redraws a whole system
 * whenever one note moves, and lifting dynamics out of the measure group makes every dynamic-bearing
 * bar a span anchor, i.e. no longer translatable — the optimisation that measured at 53% of render
 * time. Translating costs one attribute per mark, and the mark stays a real `Annotation`: the
 * text-edit overlay, the selection hit-box and the dashed anchor line all keep working, because they
 * read the registry box that {@link placeDynamicMarkOnLine} keeps in step.
 *
 * ⚠️ **It runs over EVERY measure, drawn or reused**, and stays a post-measure pass even though the
 * local rule (below) means a mark's answer can only change when its own bar does — which the
 * measure's redraw key already covers. Two reasons to leave it out here: a HAIRPIN spans bars, so
 * its line is not a measure-local question at all; and "move the line" is a per-SYSTEM override
 * (plan §4). What makes it safe on a bar nobody re-engraved is `dynamicMarkTransform`: the
 * components are kept on the element, so a mark already on the line is left alone rather than moved
 * twice.
 *
 * ⭐⭐ **A mark clears the ink UNDER IT, not the system's lowest** (his call, 2026-08-12 — LilyPond's
 * default rather than Dorico's). Everything over ordinary music lands on the same floor and reads as
 * one line; a mark over a dip deviates, alone. `columnsUnder` is the scope, and it is why this pass
 * hands the layout module ONE column rather than the system's.
 */
import type { Stave } from 'vexflow'
import type { Measure } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { dynamicsLineAt, type DynamicMarkInk } from '@/engine/layout/dynamicsLine'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { DYNAMIC_GLYPH_INK_ABOVE, DYNAMIC_GLYPH_INK_BELOW } from './dynamicStyle'
import { dynamicMarkAnchorShift } from './dynamicMarkAnchor'
import { placeDynamicMark } from './dynamicMarkTransform'
import { staffSpacesToPixels } from './staffSpace'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement` — declared structurally rather than imported, so the
 * renderer that calls this does not have to be imported back by it.
 */
export interface DynamicsLinePlacement {
  /** This staff's own lane of the measure — so `dynamics` is already the staff's. */
  view: Measure
  /** Which system it is on: the scope of one line. */
  line: number
  staffIndex: number
  /** The measure's merged columns, shared by every staff of it (`MeasurePlacement.system`). */
  system: { columns: Column[] }
  stave: Stave
  scale: number
}

/**
 * How far a level glyph's ink reaches either side of its own text baseline, in staff spaces.
 *
 * ⭐ In the staff's OWN spaces, and that is why there is no staff size in this file: the mark is
 * drawn inside the staff's `scale(k)` group at a fixed px size, so a small staff's glyph is the same
 * number of ITS spaces as a full-size one's. The px→spaces conversion is therefore against the
 * constant, not against a scaled stave.
 *
 * ⚠️ The proportions are `dynamicStyle`'s first cut, not a measurement — a glyph measures 0×0 in
 * jsdom, so the honest measurement lives in the browser suite. They are also the numbers the tight
 * hit-box is already built from, which is what keeps the box and the line agreeing.
 */
const MARK_INK: DynamicMarkInk = {
  above: DYNAMIC_GLYPH_INK_ABOVE / STAFF_SPACE_PX,
  below: DYNAMIC_GLYPH_INK_BELOW / STAFF_SPACE_PX,
}

/**
 * Put every drawn dynamic of every system onto its line.
 *
 * `staffIds` is the score's staves in order — `staffIds[0]` is what an absent `staffId` means, both
 * in the ink boxes and in the line's key (`engine/layout/dynamicsLine.ts`).
 *
 * Pure no-op without a DOM (the marks have no `<text>` to read a baseline from), like every other
 * pass that repositions rendered SVG.
 */
export function placeDynamicsOnLine(
  pass: RenderPass,
  placements: readonly DynamicsLinePlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  for (const placement of placements) {
    const dynamics = placement.view.dynamics
    if (!dynamics?.length) continue
    const staffId = staffIds[placement.staffIndex]

    /** Marks sharing a beat are laid out as a ROW, and that row owns their x (`dynamicMarkAnchor`). */
    const atBeat = new Map<string, number>()
    for (const dyn of dynamics) {
      const key = `${dyn.beat.num}/${dyn.beat.den}`
      atBeat.set(key, (atBeat.get(key) ?? 0) + 1)
    }

    // The translate is local to the staff's scale group; the registry is told in the same units.
    pass.elementRegistry.withScale(placement.scale, () => {
      for (const dyn of dynamics) {
        if (dyn.id === pass.suppressedDynamicId) continue // drawn by the text overlay instead
        const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGraphicsElement | undefined
        const text = el?.querySelector?.('text') as SVGTextElement | null
        // ⭐ Where the mark WAS drawn, read from the one number that says so: the `<text>`'s own
        //   baseline. Not its bbox — the glyph runs are grown upward from that baseline
        //   (`applyMixedDynamicRuns`), so a bare `p` and a `p dolce` have different boxes and the
        //   same baseline, which is exactly the quantity the line is stated in.
        const drawn = parseFloat(text?.getAttribute('y') ?? '')
        if (!el || !Number.isFinite(drawn)) continue

        const baseline = dynamicsLineAt(
          placement.system.columns,
          dyn.beat,
          staffId,
          staffIds[0],
          dyn.placement === 'above' ? 'above' : 'below',
          MARK_INK,
        )

        // ⚠️ Both sides are in the STAVE's own coordinates, which is what makes this correct for a
        //    measure that merely MOVED: its stave and its ink both keep the coordinates they were
        //    drawn at, and the group's transform carries them to the new place together.
        const target = placement.stave.getYForLine(0) + staffSpacesToPixels(baseline, placement.stave)

        // ⭐ And the x: a level is CENTRED on its notehead, prose is anchored to it. Measured off the
        //   drawn `<text>` — the glyph runs are grown to music size after the annotation is built, so
        //   nothing knows the real ink before this point — and RELATIVE to the text's own x, because
        //   a Bravura dynamic overhangs its origin to the left (`dynamicMarkAnchor`).
        const box = text?.getBBox ? text.getBBox() : null
        const anchorX = parseFloat(text?.getAttribute('x') ?? '')
        const ink = box && Number.isFinite(anchorX)
          ? { left: box.x - anchorX, width: box.width }
          : { left: 0, width: 0 }
        const shared = (atBeat.get(`${dyn.beat.num}/${dyn.beat.den}`) ?? 1) > 1

        placeDynamicMark(pass, dyn.id, el, {
          line: target - drawn,
          anchor: dynamicMarkAnchorShift(dyn, ink, shared),
        })
      }
    })
  }
}
