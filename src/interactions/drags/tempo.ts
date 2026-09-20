/**
 * The drag that moves a TEMPO MARK — the mark is its own handle, so the gesture arms on the very
 * press that selects it. ⛔ NOT the dynamic's twin: this one family is a SNAP from anchor to anchor
 * (`../tempoDrag`), decided, where the dynamic is an interpolating walk.
 *
 * ⭐⭐ **THE HAND CARRIES THE ANCHOR POINT.** The horizontal baseline is not a delta to accumulate
 * but a fixed reference: the GRAB is how far the pointer sat from the mark's anchor when the drag
 * began, so `x − grab` is where that anchor would be if it had followed the hand. The snap is
 * tested against THAT, ⛔ never against a running sum — an absolute reference cannot drift. The
 * press lands anywhere inside `Allegro (♩ = 120)`, typically some way right of the anchor; without
 * the grab the mark would re-anchor the moment the pointer passed the next onset, which on a wide
 * mark is before the hand has travelled anywhere.
 *
 * ⚠️ The VERTICAL is still a delta from the last ACCEPTED frame — a refused frame leaves it where
 * it was, so the mark picks the hand up again at the page limit. And the baseline (the grab
 * included) is taken on the first frame PAST the time threshold: the travel that decided this was
 * a drag rather than a click is charged to neither.
 *
 * ⭐ A frame MOVES the glyph rather than redrawing it: a tempo mark lives inside its measure's
 * group, so the preview re-applies its composed transform (`engine/rendering/markPreviewPass`, the
 * `tempo` row). ⚠️ It is the one family whose full render really does re-engrave a bar — the nudge
 * is applied at draw time and folded into that bar's shape key — so the preview saves the
 * whole-score passes AND the bar, and the drop pays both once.
 *
 * ⚠️ EXPLORATORY INSTRUMENT (`../dragTrace`): the frames are timed (the model half AND the repaint)
 * and traced against where the glyph really is on the page. ⛔ It reads nothing back into the
 * gesture; it only prints.
 */
import { dbg } from '../../utils/debug'
import { startTrace, traceFrame } from '../dragTrace'
import { dragTempo, tempoAnchorXOf } from '../tempoDrag'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

/**
 * @param drawnMarkX Where the mark's glyph really is on the page, in the viewport's own pixels —
 *   straight off the DOM, for the trace. Every other number in it is the model's or the registry's,
 *   and both move when a transform is written whether or not the ink did. ⛔ null when the glyph is
 *   not in this render's SVG, which is itself an answer.
 */
export function beginTempoDrag(host: DragHost, id: string, drawnMarkX: (id: string) => number | null): Gesture {
  /** The last ACCEPTED cursor, null until the first frame past the threshold. */
  let last: { x: number; y: number } | null = null
  /** How far the pointer sat from the mark's ANCHOR when the drag began. */
  let grabDx = 0
  let changed = false
  let trace = startTrace()
  const pressedAt = Date.now()

  return {
    kind: 'tempo',

    move(engine, x, y) {
      const heldMs = Date.now() - pressedAt
      if (heldMs < DRAG_TIME_THRESHOLD_MS) {
        // The held frames are logged too: a gesture that "does nothing at first" is this threshold,
        // and a reader who cannot see these frames cannot tell that from a refusal further in.
        dbg(`[TempoDrag] mouse (${x.toFixed(1)}, ${y.toFixed(1)}) — held (${heldMs}ms of ${DRAG_TIME_THRESHOLD_MS}ms)`)
        return
      }
      if (last === null) {
        last = { x, y }
        // ⚠️ 0 when the last render could not say where the anchor is — the frames then measure
        //    from the pointer itself, which is wrong by the grab and never by more.
        grabDx = x - (tempoAnchorXOf(engine, id) ?? x)
        trace = startTrace()
        dbg(`[TempoDrag] mouse (${x.toFixed(1)}, ${y.toFixed(1)}) — baseline taken`
          + ` | the hand sits ${grabDx.toFixed(1)}px right of the anchor | id:${id}`)
        return
      }

      // Where the mark's ANCHOR would be if it had followed the hand — absolute, so it cannot drift.
      const handX = x - grabDx
      // ⚠️ From the last ACCEPTED frame, not the last mousemove — which is why the `dy` this logs
      //    can be larger than one mouse step while the hand is against the page limit.
      const dy = y - last.y
      const walkStartedAt = performance.now()
      const frame = dragTempo(engine, id, handX, dy)
      const walkMs = performance.now() - walkStartedAt
      if (frame === null) return
      if (!frame.moved) {
        dbg(`[TempoDrag] mouse (${x.toFixed(1)}, ${y.toFixed(1)}) → hand ${handX.toFixed(1)}`
          + ` dy=${dy.toFixed(1)}px from the last ACCEPTED frame`
          + ` — nothing written (the hand has not reached the next anchor, or a limit refused the ink)`)
        return
      }
      last = { x, y }
      changed = true
      // A frame `markPreviewPass` REFUSED re-engraves the whole score here, so this call is where
      // the ms go — and the line beneath it says whether the ink kept up with the hand.
      const startedAt = performance.now()
      host.render.previewMarks('tempo', id)
      // `askedPx` is what the DRAWN mark got — anchor plus offset. The offset trails the hand
      // (`tempoDrag.trailTheHand`), so hand and ink should read 1:1 on every frame; a deviation
      // that GROWS is the bug (an empty bar, where the snap had nothing to reach and the ink stopped).
      traceFrame('TempoDrag', trace, {
        cursorX: x, askedPx: frame.inkPx, droppedPx: 0, renderMs: performance.now() - startedAt,
        walkMs, drawnX: drawnMarkX(id),
      })
    },

    end() {
      const engine = host.getEngine()
      if (engine && changed) {
        engine.tempo.commitTempoDrag()
        // ⛔ THE DROP RENDERS FOR REAL — see `./bodyDrag`. Here it also re-engraves the mark's bar,
        // which the preview frames deliberately did not. ⚠️ Traced either side: a difference is the
        // DROP moving the mark, which no other line in the trace can see.
        const previewed = drawnMarkX(id)
        host.render.renderScore()
        const rendered = drawnMarkX(id)
        dbg(`Tempo mark dragged | id:${id}`
          + ` | 🖉 the drop redrew it ${previewed === null || rendered === null
            ? '(not on screen)' : `${(rendered - previewed).toFixed(1)}px from where the drag left it`}`)
        // ⚠️ For a SNAP the deviation is the distance to the nearest anchor at the drop, ⛔ not a
        //    debt: the mark has no in-between to be behind in. It should end well under one gap.
        dbg(`[TempoDrag] GESTURE | ${trace.frames} frames`
          + ` | hand ${trace.handPx.toFixed(0)}px → anchor ${trace.inkPx.toFixed(0)}px`
          + ` | worst frame ${trace.worstWalkMs.toFixed(1)}ms`
          + ` | worst repaint ${trace.worstMs.toFixed(1)}ms`
          + ` | DEVIATION ${(trace.handPx - trace.inkPx).toFixed(0)}px`)
      }
      host.release()
    },
  }
}
