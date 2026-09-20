/**
 * ⏱ **THE TRILL WALK'S TRACING — TEMPORARY, and kept apart so it can be deleted as one file**
 * (docs/code-shape-plan-2026-09-19.md, Phase 5). `./trillWalk` decides; this only REPORTS, and only
 * while `debugEnabled()`: the per-frame line, and the cumulative hand-vs-ink comparison a drag runs
 * after each draw.
 *
 * ⛔ It imports nothing of `./trillWalk`'s at runtime. What only the walk can build — the body's port
 * and the staff the ornament is on — arrives as a {@link TrillFrameProbe}, so the walk may import
 * this file and the two never form a cycle.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction } from '../types/music'
import { fracToNumber } from '../utils/fraction'
import { measureStartQuarters } from '../utils/measureCapacity'
import { voiceOf } from '../utils/lanes'
import { dbg, debugEnabled } from '../utils/debug'
import { lastMeasureNumber, systemInkAt } from './markBreakWrap'
import type { MarkWalkPort } from './markWalk'
import type { TrillAnchorStop } from './trillReanchor'
import { trillInkX, trillLane } from './trillLane'

/** What the tracing reads off the engine. */
type TrillTraceEngine = Pick<MusicEngine, 'getTrillById' | 'getNote' | 'getScore' | 'getElementRegistry'>

/** What only the walk can build, handed to {@link traceTrillFrame}. */
export interface TrillFrameProbe {
  /** The body's walk port — the offset, the ribbon x and the next stop are read off it. */
  port: MarkWalkPort
  /** The staff the ornament is on, null when it cannot be told. */
  staff: number | null
}

/**
 * ⏱ TEMPORARY (2026-08-30) — **DID THE DRAWN ORNAMENT GO AS FAR AS THE HAND DID?** His report:
 * *"it is not moving with my hand"*.
 *
 * 🚨 **Why the existing `[Trill frame]` line CANNOT answer that**, and why I read his log wrongly
 * once already: its `ink x` is fetched at the TOP of `trillWalk.dragTrillBody` — before the frame writes
 * anything and before the preview redraws. Every line therefore reports the PREVIOUS frame's
 * drawing, so laying its ink deltas beside its cursor deltas compares two different moments and
 * always looks like it tracks. ⭐ This one runs AFTER the render, in the same mouse event, so `ink`
 * is what his eye is actually looking at.
 *
 * ⭐ **Cumulative, ⛔ not per-frame.** A drift of half a pixel a frame is invisible one line at a time
 * and is the whole complaint after two hundred of them, so the number that settles it is
 * `RESIDUAL` — how far the hand has gone since the grab, minus how far the ink has. Constant ⇒ the
 * grab offset and nothing is wrong; growing ⇒ the ornament is falling behind, and the ratio says
 * whether it is a scale (a fixed fraction) or a stall (whole frames lost).
 *
 * ⭐ And it counts the frames where **the hand moved and the ink did not** — a refused frame is
 * invisible in a per-frame trace and is exactly what "not moving" feels like.
 */
let handVsInk: {
  id: string
  hand0: number; ink0: number
  hand: number; ink: number
  frames: number; still: number
  span0: string; span: string; spanChanges: number
} | null = null

/**
 * ⏱ TEMPORARY (2026-08-30) — **HOW MUCH MUSIC THE ORNAMENT COVERS**, the axis {@link handVsInk}
 * could not see and the one his *"the trill is not moving correctly"* most likely means.
 *
 * 🚨 Every walk step re-derives the far end (`trillWalk.extentFrom` through `previewTrillMove`), and that
 * derivation CLAMPS — it takes the last stop still inside the span, so it can only ever come back
 * the same or SHORTER (`d5d61d1`: *"the degradation is a SHORTER trill, ⛔ never a longer one"*). One
 * step loses at most a rounding; his last gesture took ~20 steps left and ~20 back, and nothing in
 * any trace says what the span was at either end of that.
 *
 * ⚠️ Reported in QUARTERS and in STOPS, because the two disagree exactly where the bug would live: a
 * span held in quarters lands on a different NUMBER of notes wherever the note values change.
 */
function trillSpanOf(engine: TrillTraceEngine, id: string): string {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  if (!start) return '—'
  const end = trill.endNoteId ? engine.getNote(trill.endNoteId) : null
  if (!end) return 'single'
  const ms = engine.getScore().measures
  const at = (n: { measure: number; beat: Fraction }) =>
    measureStartQuarters(ms, n.measure) + fracToNumber(n.beat)
  const lane = trillLane(engine, start).filter(n => !n.isRest)
  const stops = lane.findIndex(n => n.id === end.id) - lane.findIndex(n => n.id === start.id)
  return `${(at(end) - at(start)).toFixed(2)}q/${stops < 0 ? '?' : stops} stops`
}

/** ⏱ TEMPORARY — call AFTER the preview has drawn. See {@link handVsInk}. */
export function traceTrillHandVsInk(engine: TrillTraceEngine, id: string, cursorX: number): void {
  if (!debugEnabled()) return
  const ink = trillInkX(engine.getElementRegistry(), id)
  if (ink === null) {
    dbg(`[Trill hand] ⛔ nothing drawn for ${id.slice(0, 8)} — the ink cannot be compared this frame`)
    return
  }
  const span = trillSpanOf(engine, id)
  if (!handVsInk || handVsInk.id !== id) {
    handVsInk = {
      id, hand0: cursorX, ink0: ink, hand: cursorX, ink, frames: 0, still: 0,
      span0: span, span, spanChanges: 0,
    }
    dbg(`[Trill hand] gesture starts | hand ${cursorX.toFixed(1)} ink ${ink.toFixed(1)}`
      + ` | the grab holds them ${(cursorX - ink).toFixed(1)}px apart — that gap is what must NOT change`
      + ` | it covers ${span}`)
    return
  }
  const s = handVsInk
  if (span !== s.span) {
    s.spanChanges++
    dbg(`[Trill span] ⚠️ ${s.span} → ${span} (change #${s.spanChanges} this gesture,`
      + ` it started at ${s.span0}) — the walk re-derives the far end on every step`)
    s.span = span
  }
  const dHand = cursorX - s.hand
  const dInk = ink - s.ink
  s.frames++
  if (dHand !== 0 && dInk === 0) s.still++
  const hand = cursorX - s.hand0
  const moved = ink - s.ink0
  dbg(`[Trill hand] hand ${cursorX.toFixed(1)} (${dHand >= 0 ? '+' : ''}${dHand.toFixed(1)} now,`
    + ` ${hand >= 0 ? '+' : ''}${hand.toFixed(1)} since the grab)`
    + ` | ink ${ink.toFixed(1)} (${dInk >= 0 ? '+' : ''}${dInk.toFixed(1)} now,`
    + ` ${moved >= 0 ? '+' : ''}${moved.toFixed(1)} since the grab)`
    + ` | covers ${span}`
    + ` | RESIDUAL ${(hand - moved).toFixed(1)}px`
    + `${hand !== 0 ? ` (the ink went ${((moved / hand) * 100).toFixed(0)}% of the way)` : ''}`
    + ` | ${s.still}/${s.frames} frames moved the HAND and not the INK`)
  s.hand = cursorX
  s.ink = ink
}

/** ⏱ TEMPORARY — the drop ends the comparison, so the next gesture measures its own grab. */
export function endTrillHandTrace(): void {
  if (handVsInk && debugEnabled()) {
    const s = handVsInk
    dbg(`[Trill hand] gesture ends | hand ${(s.hand - s.hand0).toFixed(1)}px,`
      + ` ink ${(s.ink - s.ink0).toFixed(1)}px, RESIDUAL ${((s.hand - s.hand0) - (s.ink - s.ink0)).toFixed(1)}px`
      + ` over ${s.frames} frames, ${s.still} of which moved the hand alone`)
  }
  handVsInk = null
}

/** ⏱ TEMPORARY — see the call site in `trillWalk.dragTrillBody`. ⛔ Not on the hot path: the caller
 *  guards it with `debugEnabled()`, because everything below walks the registry. */
export function traceTrillFrame(
  engine: TrillTraceEngine,
  id: string,
  { cursorX, dxPx, dyPx, staffSpacePx }: { cursorX: number; dxPx: number; dyPx: number; staffSpacePx: number },
  { port, staff }: TrillFrameProbe,
): void {
  const trill = engine.getTrillById(id)
  const drawn = engine.getElementRegistry().getByType('trill').find(e => e.id === id)
  const anchor = engine.getNote(trill?.startNoteId ?? '')
  const here = staff === null || anchor?.measure === undefined ? null
    : systemInkAt(engine.getElementRegistry(), staff, anchor.measure,
      lastMeasureNumber(engine.getScore()))
  const stop = port.nextStop(dxPx > 0 ? 1 : -1)
  const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1))
  dbg(`[Trill frame] cursor x${cursorX.toFixed(0)} dx${dxPx.toFixed(1)} dy${dyPx.toFixed(1)}`
    + ` | ink x${num(drawn?.bbox.x)} y${num(drawn ? drawn.bbox.y + drawn.bbox.height / 2 : null)}`
    + ` drawnInBar ${drawn?.measure ?? '—'}`
    + ` | anchor ${trill?.startNoteId.slice(0, 8) ?? '—'} bar ${anchor?.measure ?? '—'}`
    // ⚠️ The VOICE is here since 2026-08-30, on his report *"it seems that the trill just get
    // reanchor to voice 1 but it should not be"*: the lane holds the voice by construction
    // (`trillLane.trillLaneOnStaff` = `buildBeatMap(score, voiceOf(start), staff)`), so the trace
    // has to say which voice the anchor is actually IN before anything is changed. ⛔ Never leave an
    // axis out of the one line per frame.
    + ` staff ${staff ?? '—'} voice ${anchor ? voiceOf(anchor) : '—'}`
    + ` placement:${trill?.placement ?? 'auto'}`
    + ` | offset ${num(port.offsetX())}ss anchorX ${num(port.anchorX())} ss ${staffSpacePx.toFixed(2)}`
    + ` | system ${here ? `bar${here.key} ink ${here.min.toFixed(0)}…${here.max.toFixed(0)}` : '—'}`
    + ` | nextStop ${stop ? JSON.stringify((stop as TrillAnchorStop).note.id.slice(0, 8)) : 'none'}`
    + ` stopX ${num(stop ? port.stopX(stop) : null)}`)
}
