/**
 * ⚠️⚠️ **AN INSTRUMENT, NOT A RULE (2026-08-31)** — what the hand asked, what the ink got, and what
 * the frame COST. His ask, on the tempo drag: *"do you want to add logs to debug so we can fix it?"*.
 *
 * ⭐ It exists because two different explanations of *"the tempo some times don't move"* both fit his
 * log, and they want opposite fixes:
 *
 * 1. **The frame is slow.** A crossing makes `markPreviewPass` refuse the cheap frame, so the whole
 *    35-bar score is re-engraved inside `mousemove`; the hand keeps moving meanwhile and the next
 *    delta arrives 40–55 px wide. ⭐ `renderMs` and `sinceMs` say so or do not.
 * 2. **The LATCH eats the sweep.** On a wide frame the walk advances the ink by ONE gap and the latch
 *    throws the rest away, so the ink cannot keep up however fast the hand goes. ⭐ `ate` per frame,
 *    and the running **DEVIATION** over the gesture, say so or do not.
 *
 * ⭐⭐ **DEVIATION is the number that matters** — cursor travel minus ink travel, in pixels. It is
 * `dragHold.logHold`'s instrument, which is what caught the ratcheting debt on the slur (2026-08-18);
 * a drag with no hold ledger has nothing counting it, which is why the tempo's debt was invisible
 * until it was a whole bar wide. ⚠️ A value that OSCILLATES around zero is a latch working; one that
 * GROWS frame after frame is the bug.
 *
 * ⛔ Nothing here changes a drag. Delete it and the gesture is byte-for-byte what it was.
 */
import { dbg, debugEnabled } from '../../utils/debug'

/**
 * One gesture's running totals.
 *
 * 🚨🚨 **THE HAND'S TRAVEL IS MEASURED FROM THE CURSOR ITSELF, ⛔ NEVER FROM THE FRAME'S `dx`** —
 * and getting that wrong made this instrument lie, 2026-08-31. A caller that REPAYS a latch holds
 * its cursor baseline back, so the next frame's `dx` contains those pixels a SECOND time; summing
 * `dx` therefore counts every repaid pixel twice and reports a deviation that is exactly the latch's
 * appetite — which is what it did, and I read the artefact as a drift. Measured against the real
 * cursor the same gesture came out `cursor 781.5px → ink 781px`: the ink was exactly under the hand.
 * ⭐ An instrument that shares an assumption with the thing it measures is not an instrument.
 *
 * ⛔ Not shared between two live drags — only one runs at a time.
 */
export interface DragTrace {
  frames: number
  /** Where the cursor was on the last traced frame — the only honest baseline for its travel. */
  lastCursorX: number | null
  /**
   * ⭐⭐ **WHERE THE GLYPH ACTUALLY IS ON SCREEN**, last frame — read off the DOM, ⛔ not off the
   * model and ⛔ not off the registry.
   *
   * 🚨 His report, 2026-08-31, with a trace that had just said the drag was perfect (`hand 707px →
   * ink 714px`, every frame 1:1, repaint under a millisecond): *"not working… the tempo gets stuck"*.
   * Everything measured up to then was the MODEL's own arithmetic and the registry that follows it —
   * both of which move when the transform is written, whether or not the ink on the page did. An
   * instrument that never looks at the picture cannot contradict the picture.
   */
  lastDrawnX: number | null
  /** Pixels the HAND really travelled, signed and summed. */
  handPx: number
  /** …and what the drawn ink was actually given. */
  inkPx: number
  /** What the latch has swallowed so far, summed as a magnitude. ⚠️ Repaid pixels are still counted
   *  here — this says how much the mark was STOPPED, not how much it lost. */
  atePx: number
  /** The costliest single frame of the gesture, in ms — a full render shows up here. */
  worstMs: number
  /** …and the costliest WALK, which is the half nothing used to measure (see {@link traceFrame}). */
  worstWalkMs: number
  /** `performance.now()` of the last traced frame, for the gap between them. */
  lastAt: number
}

export function startTrace(): DragTrace {
  return {
    frames: 0, lastCursorX: null, lastDrawnX: null,
    handPx: 0, inkPx: 0, atePx: 0, worstMs: 0, worstWalkMs: 0, lastAt: 0,
  }
}

/**
 * One line per accepted frame.
 *
 * @param cursorX where the pointer is, in the score's own pixels — ⚠️ the POSITION, so the hand's
 *   travel can be measured without the frame's own arithmetic in it (see {@link DragTrace}).
 * @param askedPx what the walk was given this frame: the hand's travel PLUS anything a previous
 *   latch is repaying.
 * @param droppedPx what the LATCH cut short, signed, so the ink moved `askedPx − droppedPx`.
 * @param walkMs how long the frame's WALK took — the model half, before any drawing.
 *   🚨 **The blind spot this instrument had**, 2026-08-31: every repaint measured 0.4 ms while the
 *   frames arrived 24–27 ms apart, so a trace made entirely of repaint times said the drag was free
 *   and the hand said otherwise. ⭐ A frame is `walk + repaint + whatever the browser owes`; print
 *   the first two and the third is what is left of `sinceMs`.
 * @param renderMs how long the frame's repaint took — a frame the preview REFUSED re-engraves the
 *   score and shows up here at tens of ms, while a cheap one is about one.
 * @param drawnX where the glyph's INK is on the page, straight from the DOM and measured AFTER the
 *   repaint — ⭐ the only line here that can contradict the other three (see {@link DragTrace}).
 *   Null when the caller could not find it, which is itself worth reading.
 */
export function traceFrame(
  label: string,
  trace: DragTrace,
  frame: { cursorX: number; askedPx: number; droppedPx: number; renderMs: number
    walkMs?: number; drawnX: number | null },
): void {
  const now = performance.now()
  const since = trace.lastAt ? now - trace.lastAt : 0
  const hand = trace.lastCursorX === null ? 0 : frame.cursorX - trace.lastCursorX
  const ink = frame.askedPx - frame.droppedPx
  const drew = frame.drawnX === null || trace.lastDrawnX === null
    ? null : frame.drawnX - trace.lastDrawnX
  trace.frames++
  trace.lastCursorX = frame.cursorX
  if (frame.drawnX !== null) trace.lastDrawnX = frame.drawnX
  trace.handPx += hand
  trace.inkPx += ink
  trace.atePx += Math.abs(frame.droppedPx)
  trace.worstMs = Math.max(trace.worstMs, frame.renderMs)
  trace.worstWalkMs = Math.max(trace.worstWalkMs, frame.walkMs ?? 0)
  trace.lastAt = now
  if (!debugEnabled()) return
  dbg(`[${label}] TRACE #${trace.frames} | +${since.toFixed(0)}ms since the last frame`
    + ` | hand ${hand.toFixed(1)}px → ink ${ink.toFixed(1)}px`
    // 🚨 A RATIO, ⛔ not pixels: the DOM answers in SCREEN px and everything else here is in the
    //    score's own, so the two differ by the viewport's zoom and a raw difference reads as a fault
    //    that is not there (2026-08-31, measured as a flat 0.70 — the zoom, and nothing else).
    //    ⭐ A CONSTANT ratio is the glyph tracking perfectly; one that VARIES is the picture failing.
    + ` → 🖉 DREW ×${drew === null || ink === 0 ? '—' : (drew / ink).toFixed(2)}`
    // 🚨🚨 **FROZEN — the hand moved, the model moved, and the PICTURE did not** (his report,
    //    2026-08-31: *"i'm moving my hand and i see the tempo freeze in a position"*). It was already
    //    readable as a ×0.00 in the ratio above, which is exactly the kind of thing nobody reads: it
    //    is one character different from a frame that worked. ⛔ Not a judgement about WHY — the
    //    frame that prints this is the one to look at, and the lines around it say which pass wrote.
    + (drew !== null && ink !== 0 && Math.abs(drew) < 0.5 ? ' 🧊 FROZEN (the ink did not move)' : '')
    + (frame.askedPx !== hand ? ` (asked ${frame.askedPx.toFixed(1)}, a repayment in it)` : '')
    + (frame.droppedPx ? ` (the latch STOPPED it, ${Math.abs(frame.droppedPx).toFixed(1)}px)` : '')
    + (frame.walkMs === undefined ? '' : ` | walk ${frame.walkMs.toFixed(1)}ms`)
    + ` | repaint ${frame.renderMs.toFixed(1)}ms (worst ${trace.worstMs.toFixed(1)})`
    // ⭐ What the frame did NOT spend on itself: the gap since the last frame minus the work above.
    //   A drag that stutters with both halves under a millisecond is being starved from outside.
    + (since && frame.walkMs !== undefined
      ? ` | idle ${(since - frame.walkMs - frame.renderMs).toFixed(0)}ms` : '')
    + ` | handΣ ${trace.handPx.toFixed(0)} inkΣ ${trace.inkPx.toFixed(0)}`
    + ` stoppedΣ ${trace.atePx.toFixed(0)}`
    + ` DEVIATION ${(trace.handPx - trace.inkPx).toFixed(0)}px`)
}
