/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A TEMPO MARK** — ←/→ and Ctrl+←/→ move a selected tempo mark's
 * INK, and once that ink reaches the next onset the ANCHOR goes with it (his ask, 2026-08-19).
 *
 * ⚠️⚠️ **THE KEYS ONLY, since 2026-08-31.** The mouse used to run this same mechanism with pixels in
 * place of a step; his call that day — *"make the drag not a walk but anchor when the mouse hit the
 * next anchor point"* — moved it to `./tempoDrag`, which is a SNAP and shares none of the
 * arithmetic below. The two devices still share their readers (`./tempoAnchors`), and they must:
 * two answers to *"where is that stop drawn?"* is how the walk and the engraver drifted apart.
 *
 * The arithmetic is `./markWalk`'s, shared with the dynamic's; this file is the PORT — where a tempo
 * mark's stops are and which model ops move it. What differs from the dynamic is only what the two
 * marks are attached to:
 *
 * ⭐⭐ **A tempo mark has no lane**: its stops are every ONSET in the score, whatever staff or voice
 * sounds it (`engine/models/tempoOps`), because what it governs is the clock. The dynamic walks one
 * voice on one staff.
 *
 * ⭐⭐ **THE GAP IS MEASURED WHERE THE ENGRAVER PUTS THE MARK — and until 2026-08-31 it was not.**
 * This header used to end *"⏭️ the honest fix is to register each measure's tempo-anchor x"*, and
 * that is now done: `TempoLayout` publishes {@link ElementRegistry.tempoAnchorX} for every onset it
 * draws, and `./tempoAnchors.onsetAnchorX` asks it. What the approximation cost, in his words:
 * *"i'm moving the hand and the tempo is not moving on certain occasions"* — the gap used to be
 * measured NOTE to NOTE while Gould p. 183 puts a downbeat mark on the bar's TIME SIGNATURE when it
 * prints one, so the offset was written from an origin the drawing never used.
 *
 * ⛔ **The vertical is not in here** — ↑/↓ stay a pure offset. ⚠️ And note that this mark's `y` is
 * OUTWARD (+up), unlike every sibling ({@link TempoOffsetOverride}); nothing in the walk touches it.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Stop } from '../engine/models/tempoOps'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { type MarkWalkPort } from './markWalk'
import { lastMeasureNumber, systemInkAt, type BreakWrapPort } from './markBreakWrap'
import { walkPress } from './markDrive'
import { withoutAnEntry } from './keyRun'
import { nextAnchorPoint, onsetAnchorX, staffSpacePxOf, tempoAddress } from './tempoAnchors'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type TempoWalkEngine = Pick<MusicEngine,
  'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nudgeTempoOffset'
  | 'previewTempoOffsetRebase'
  | 'previewTempoSlotKeepingOffset' | 'previewTempoOffset' | 'previewTempoSlot'>

/** The port: everything `./markWalk` needs of this mark, and the whole of what is tempo-specific. */
function tempoPort(
  engine: TempoWalkEngine,
  id: string,
  write: {
    reanchor: (id: string, target: Stop) => boolean
    nudge: (id: string, dx: number, dy: number) => boolean
    /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged
     *  by the page limit (2026-08-21, with the cross-system wrap). ⚠️ `dx` only: this mark's `y` is
     *  OUTWARD and no walk touches it. */
    rebase: (id: string, dx: number) => boolean
  },
): MarkWalkPort {
  return {
    label: 'Tempo',
    // ⭐ The SAME candidate rule the DRAG uses (`./tempoAnchors.nextAnchorPoint`): the next place the
    // mark can be DRAWN, which is the next stop whose x differs — a bar whose top staff holds one
    // whole rest draws all six of its onsets on one x, and neither device can address them apart.
    // 🚨 His report, 2026-08-31, is what put it here: without it the walk left such a bar for ever
    // (`⛔ NO CROSSING: the gap runs the other way`, 62 presses and not one re-anchor), because a
    // zero gap is not a gap the ink can cross. ⚠️ It does not skip an onset another mark sits on —
    // the model refuses the write, and the walk stops there as it does at the end of the score.
    // ⚠️ `Ctrl+Shift+←/→` keeps the model's own step (`tempoOps.nextTempoSlot`): a whole-stop press
    // is about the MUSIC and may land on a beat that shares its neighbour's ink.
    nextStop: (direction) => {
      const here = tempoAddress(engine, id)
      return here ? nextAnchorPoint(engine, here, direction)?.stop ?? null : null
    },
    stopX: (stop) => onsetAnchorX(engine, stop as Stop),
    anchorX: () => {
      const here = tempoAddress(engine, id)
      return here ? onsetAnchorX(engine, here) : null
    },
    staffSpacePx: () => staffSpacePxOf(engine, id),
    offsetX: () => tempoOffsetOverrideOf(engine.getScore(), id)?.x ?? 0,
    reanchor: (stop) => write.reanchor(id, stop as Stop),
    nudge: (dx, dy) => write.nudge(id, dx, dy),
    rebase: (dx) => write.rebase(id, dx),
  }
}

/**
 * ⭐ **THE MARK'S ANSWERS TO {@link BreakWrapPort}** — where THIS mark's system runs out, and where a
 * candidate stop's system begins (his ask, 2026-08-21: *"and the tempo cross system"*).
 *
 * ⭐⭐ **STAFF 0, and that is this mark's whole difference from its siblings**: a tempo mark has no
 * staff of its own — it is engraved above the TOP one, which is also the staff
 * `./tempoAnchors.drawnOnsets` prefers and the one `TempoLayout.anchorX` measures against. ⛔ Not the
 * staff the sounding note happens to be on.
 */
function wrapPort(engine: TempoWalkEngine, id: string): BreakWrapPort {
  const limitOf = (at: Stop | null) =>
    at ? systemInkAt(engine.getElementRegistry(), 0, at.measure, lastMeasureNumber(engine.getScore())) : null
  return {
    here: () => limitOf(tempoAddress(engine, id)),
    there: (stop) => limitOf(stop as Stop),
    address: (stop) => stop,
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON A SELECTED TEMPO MARK** — nudge the ink by `dx` staff-spaces
 * (¼ space plain, 1 space with Ctrl), and hand the anchor along if the ink has arrived at the next
 * onset.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the mark somewhere the user never put it.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such mark, or the page limit refused the ink.
 */
export function walkTempo(engine: TempoWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = tempoPort(engine, id, {
    reanchor: (i, target) => engine.previewTempoSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.previewTempoOffset(i, ddx, ddy),
    rebase: (i, ddx) => engine.previewTempoOffsetRebase(i, ddx),
  })

  // ⭐ THE SECOND POINT MARK ON THE SHARED DRIVER (`./markDrive`), and with the dynamic the pair that
  // keeps it honest: neither has a length or an armed end, so a driver they can both call is a driver
  // about the WALK. ⛔ No crossing bound, for the dynamic's reason.
  return walkPress({
    port,
    wrap: wrapPort(engine, id),
    label: 'Move tempo mark',
    runBatch: withoutAnEntry,
  }, dx)
}
