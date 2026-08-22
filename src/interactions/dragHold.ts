/**
 * ⭐⭐ **THE HOLD AND ITS CATCH-UP, ONCE** — the motor-space ledger a snapping drag keeps, extracted
 * from the slur endpoint's drag on 2026-08-22 when he asked for the same feel on the marks: *"we
 * should make the latch stronger"*.
 *
 * ## What it is
 *
 * A LATCH (`./markWalk`, `./slurEndpointWalk`) stops the ink dead on an anchor for ONE frame, and the
 * next frame moves freely again. That is a snap you can barely feel — his report, the same day, once
 * the render lag was gone: *"i almost dont feel the latch now with the preview"*. A HOLD is the other
 * half: while the anchor has the ink, horizontal travel is **absorbed** rather than passed on — the
 * cursor moves, the mark does not — until the hand has spent the hold, and then a **catch-up** hands
 * every absorbed pixel back at a gain.
 *
 * ⭐ Snap-and-go (Baudisch, Cutrell, Hinckley & Eversole, CHI 2005) is the first half: ⛔ never
 * teleport the ink within a radius — that is traditional snapping and it makes the band either side
 * of every anchor physically unreachable. Insert motor space at the anchor instead.
 *
 * 🚨 **Snap-and-go itself never gives the swallowed distance back** — it resyncs the POINTER to the
 * object, which a web page cannot do. So the catch-up is not optional here: Fernquist, Shoemaker &
 * Booth, *Oh Snap* (INTERACT 2011) §3 is this gesture exactly, and both papers are on disk
 * (`reference/`).
 *
 * 🚨🚨 **AND THE GAIN IS NOT A FREE PARAMETER.** Their published 1.5 is self-consistent only with
 * THEIR hold (10 px against a spacing of 30+). With a hold of `r·gap`, repaying it over the ONE gap
 * available needs `G = 1/(1 − r)`; anything slower leaves a permanent drift per anchor crossed — his
 * report, 2026-08-18: *"the far i go the far the x position of the mouse deviate more and more"*.
 * {@link catchupGain} derives it, so the ratio is the only dial.
 *
 * ⚠️ **It is MOTOR distance, not model distance**, which is why this lives with the gesture and not
 * in a walk: a walk knows staff spaces, and this is a fact about hands. Everything here is PIXELS.
 */
import { dbg } from '../utils/debug'

/**
 * ⭐⭐ **How far the cursor travels while the ink stays on the anchor it just reached**, as a fraction
 * of the gap AHEAD of it.
 *
 * ⭐⭐ **0.8 is HIS, found by hand and not by argument** (2026-08-18, on the slur). The whole sweep,
 * since a later reader will otherwise "improve" it: **24 px flat** → asked for stronger; **0.75** →
 * *"i think can be stronger"*; **1.0** → *"now is too much"*; **0.85** → *"is too much already"*.
 * ⛔ Do not round it. Nothing in the papers picks between these — Baudisch's own preference study
 * landed on a RANGE (18–34 px), not a number, and for exactly this reason.
 */
export const HOLD_RATIO = 0.8

/**
 * 🚨 **THE CAP, and it is not a detail** — his logs, 2026-08-18. A fraction of the gap is right for
 * dense music and absurd for sparse: a whole-note gap measures ~220 px, so 0.8 of it is a **176 px
 * hold**, and mid-hold the cursor sits 176 px past the note the ink rests on. A hold is a HAND-scale
 * distance (Baudisch tested 18–34 px), so the ratio governs dense music and this governs the rest.
 */
export const HOLD_MAX_PX = 30

/**
 * ⭐⭐ The gain that repays a hold over the gap it has to be repaid in: `G = 1/(1 − h/gap)`.
 *
 * Derived per latch rather than fixed, because the hold is capped: `h/gap` is 0.8 between two quavers
 * and 0.14 between two whole notes, so one gain cannot serve both. Cursor travel per gap then comes
 * to exactly the gap, at any spacing, with the debt back at zero on arrival at the next anchor.
 *
 * ⚠️ 1 (no amplification) when there is no room to repay: nothing ahead, or a hold that swallowed the
 * whole gap. Better to leave a small debt standing than to divide by zero.
 */
export function catchupGain(holdPx: number, gapPx: number): number {
  if (gapPx <= 0 || holdPx <= 0 || holdPx >= gapPx) return 1
  return 1 / (1 - holdPx / gapPx)
}

/** One gesture's ledger. ⛔ Not shared between two live drags — only one runs at a time, and
 *  {@link releaseHold} is what a new gesture starts from. */
export interface DragHold {
  /** Cursor pixels the anchor will still absorb before it lets go. */
  holdPx: number
  /** The direction the hold was taken in; travel the other way RELEASES rather than being absorbed. */
  dirSign: number
  /** Absorbed pixels the catch-up still owes back. */
  debtPx: number
  /** …and the gain that repays them, fixed when the hold was taken (it depends on that gap). */
  gain: number
  /** ⚠️ MEASURED, not reasoned about: what the cursor has been asked to travel against what the ink
   *  was given. The hold makes it non-zero mid-gap by design; a value that GROWS anchor after anchor
   *  is the bug (his 2026-08-18 report), a value that oscillates is the design working. */
  cursorTravel: number
  inkTravel: number
}

export function releaseHold(): DragHold {
  return { holdPx: 0, dirSign: 0, debtPx: 0, gain: 1, cursorTravel: 0, inkTravel: 0 }
}

/**
 * ⭐⭐ **SPEND ONE FRAME'S TRAVEL AGAINST THE LEDGER** — absorb it into a live hold, then amplify what
 * is left until the debt is paid. Returns the pixels the drag may actually move.
 *
 * ⚠️ **Two rules keep the hold from feeling like a snag**, and both are his:
 *  - only motion CONTINUING past the anchor is absorbed, so the anchor just left is never sticky in
 *    both directions;
 *  - a whole pixel of counter-motion is needed to release — a hand held still still sends frames whose
 *    delta wobbles either side of zero, and releasing on the first negative crumb makes a strong hold
 *    feel intermittent. Sub-pixel motion the other way is jitter, not a change of mind.
 *
 * ⚠️ Turning back CANCELS the debt rather than repaying it backwards: the hold was a statement about
 * travel in one direction, and a change of mind is not the place to hand back distance the hand never
 * asked for.
 */
export function spendHold(hold: DragHold, dxPx: number): number {
  let dx = dxPx

  if (hold.holdPx > 0) {
    if (Math.sign(dx) === hold.dirSign) {
      const absorbed = Math.min(Math.abs(dx), hold.holdPx)
      hold.holdPx -= absorbed
      hold.debtPx += absorbed // …to be handed back by the catch-up below
      dx -= hold.dirSign * absorbed
    } else if (Math.abs(dx) > 1) {
      hold.holdPx = 0
      hold.debtPx = 0
    } else {
      dx = 0
    }
  }

  if (hold.debtPx > 0 && dx !== 0) {
    if (Math.sign(dx) === hold.dirSign) {
      const repaid = Math.min(Math.abs(dx) * (hold.gain - 1), hold.debtPx)
      hold.debtPx -= repaid
      dx += hold.dirSign * repaid
    } else {
      hold.debtPx = 0
    }
  }
  return dx
}

/**
 * ⭐⭐ **TAKE A HOLD, because the ink latched.**
 *
 * ⭐ Sized on the gap **AHEAD**, ⛔ never the one just crossed. 🚨 That distinction was a real bug (his
 * logs, 2026-08-18): the debt has to be given back over the journey ahead, and with uneven spacing
 * the two differ wildly — crossing 21.98 sp to land 11.09 sp from the next note left a debt the
 * following gap could not repay, and it ratcheted (−80 px, −175 px, −258 px, note after note).
 *
 * ⚠️ `discardedPx` is what the LATCH cut off this frame; it goes straight on the debt, so the
 * catch-up hands it back and the cursor stays level with the ink. ⛔ A caller that also holds its
 * cursor anchor back by the same pixels would pay it out twice.
 *
 * ⚠️ Several crossings in one frame (a fast sweep) leave ONE hold, not N: a hand moving that fast is
 * plainly not asking to be stopped at each anchor on the way.
 */
export function takeHold(
  hold: DragHold,
  input: { gapAheadPx: number; discardedPx: number; dirSign: number; ratio?: number; maxPx?: number },
): void {
  const gap = Math.abs(input.gapAheadPx)
  hold.holdPx = Math.min(gap * (input.ratio ?? HOLD_RATIO), input.maxPx ?? HOLD_MAX_PX)
  hold.gain = catchupGain(hold.holdPx, gap)
  hold.dirSign = input.dirSign
  hold.debtPx += Math.abs(input.discardedPx)
}

/** One line per frame: what the hand asked, what the ink got, and the deviation between them — the
 *  instrument that caught the ratcheting debt, kept for the same reason. */
export function logHold(label: string, hold: DragHold, rawDx: number, dx: number, latched: boolean): void {
  hold.cursorTravel += rawDx
  hold.inkTravel += dx
  dbg(`[${label}] hold | dx ${rawDx.toFixed(1)}→${dx.toFixed(1)}px`
    + ` hold:${hold.holdPx.toFixed(1)} debt:${hold.debtPx.toFixed(1)} gain:${hold.gain.toFixed(2)}`
    + ` | cursorΣ:${hold.cursorTravel.toFixed(1)} inkΣ:${hold.inkTravel.toFixed(1)}`
    + ` DEVIATION:${(hold.cursorTravel - hold.inkTravel).toFixed(1)}px${latched ? ' LATCH' : ''}`)
}
