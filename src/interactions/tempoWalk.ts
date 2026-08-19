/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A TEMPO MARK** — ←/→ and Ctrl+←/→ move a selected tempo mark's
 * INK, and once that ink reaches the next onset the ANCHOR goes with it (his ask, 2026-08-19).
 *
 * The arithmetic is `./markWalk`'s, shared with the dynamic's; this file is the PORT — where a tempo
 * mark's stops are and which model ops move it. What differs from the dynamic is only what the two
 * marks are attached to:
 *
 * ⭐⭐ **A tempo mark has no lane**: its stops are every ONSET in the score, whatever staff or voice
 * sounds it (`engine/models/tempoOps`), because what it governs is the clock. The dynamic walks one
 * voice on one staff.
 *
 * ⚠️ **The gap is measured NOTE to NOTE, and a downbeat anchor is not always a note.** Gould p. 183
 * puts a downbeat mark on the bar's TIME SIGNATURE when it prints one (`rendering/TempoLayout`), so
 * crossing onto such a stop re-bases by the note delta while the drawn base moves by the
 * timesig-to-first-note distance — the crossing is then visible by that much, on opening bars and
 * meter changes only. ⛔ The exact re-base needs the new anchor's base, which only exists after a
 * layout; `./slurEndpointWalk` hit the same wall and took the same approximation, as MuseScore's
 * lines do (`line.cpp:750-754`). ⏭️ The honest fix is to register each measure's tempo-anchor x.
 *
 * ⛔ **The vertical is not in here** — ↑/↓ stay a pure offset. ⚠️ And note that this mark's `y` is
 * OUTWARD (+up), unlike every sibling ({@link TempoOffsetOverride}); nothing in the walk touches it.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Stop } from '../engine/models/tempoOps'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCompare } from '../utils/fraction'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TempoWalkEngine = Pick<MusicEngine,
  'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextTempoSlot' | 'moveTempoToSlotKeepingOffset' | 'nudgeTempoOffset'>

/** Where the mark is anchored now — its address, read from the list it is stored in (the measure is
 *  half of it, exactly as a dynamic's is). Null when the id is no longer in the score. */
function tempoAddress(engine: TempoWalkEngine, id: string): Stop | null {
  for (const measure of engine.getScore().measures ?? []) {
    const mark = measure.tempos?.find(t => t.id === id)
    if (mark) return { measure: measure.number, beat: mark.beat }
  }
  return null
}

/**
 * Where an onset was DRAWN, in pixels — the centre of its ink.
 *
 * ⭐ **The TOP staff's element wins**, because that is the staff the mark is engraved above and the
 * one `TempoLayout.anchorX` measures against. A stop that exists only lower down (a left-hand attack
 * under a right-hand rest) still answers, with that staff's x — the two staves share a column, so the
 * number is the same to within the column's own spread.
 */
function onsetX(engine: TempoWalkEngine, stop: Stop): number | null {
  const registry = engine.getElementRegistry()
  let best: { x: number; staff: number } | null = null
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note || note.measure !== stop.measure || fracCompare(note.beat, stop.beat) !== 0) continue
    const staff = el.staff ?? 0
    if (best && best.staff <= staff) continue
    best = { x: el.bbox.x + el.bbox.width / 2, staff }
  }
  return best?.x ?? null
}

/** The port: everything `./markWalk` needs of this mark, and the whole of what is tempo-specific. */
function tempoPort(
  engine: TempoWalkEngine,
  id: string,
  write: {
    reanchor: (id: string, target: Stop) => boolean
    nudge: (id: string, dx: number, dy: number) => boolean
  },
): MarkWalkPort {
  return {
    label: 'Tempo',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the same key landing the mark on a different onset depending on how far you had
    // nudged. ⚠️ It does not skip an onset another mark sits on — the model refuses the write, and
    // the walk then stops there, which is the same answer as the end of the score.
    nextStop: (direction) => engine.nextTempoSlot(id, direction),
    stopX: (stop) => onsetX(engine, stop as Stop),
    anchorX: () => {
      const here = tempoAddress(engine, id)
      return here ? onsetX(engine, here) : null
    },
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN mark.
    staffSpacePx: () =>
      engine.getElementRegistry().getByType('tempo').find(el => el.id === id)?.staffSpacePx ?? null,
    offsetX: () => tempoOffsetOverrideOf(engine.getScore(), id)?.x ?? 0,
    reanchor: (stop) => write.reanchor(id, stop as Stop),
    nudge: (dx, dy) => write.nudge(id, dx, dy),
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
    reanchor: (i, target) => engine.moveTempoToSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.nudgeTempoOffset(i, ddx, ddy),
  })
  // ⛔ No batch when nothing crosses: `runBatch` costs a snapshot per press, and the ordinary nudge
  // records its own single entry.
  if (!markWalkCrosses(port, dx)) return port.nudge(dx, 0)

  let moved = false
  engine.runBatch('Move tempo mark', () => { moved = carryMark(port, dx).moved })
  return moved
}
