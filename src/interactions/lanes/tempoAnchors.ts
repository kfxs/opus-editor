/**
 * ⭐ **WHERE A TEMPO MARK AND ITS STOPS ARE, IN THE LAST RENDER** — the readers the two devices
 * share: `./tempoWalk` (the keys) and `./tempoDrag` (the mouse).
 *
 * They were `tempoWalk`'s private helpers until 2026-08-31, when the drag stopped being a walk (his
 * call: *"make the drag not a walk but anchor when the mouse hit the next anchor point"*) and the two
 * devices stopped sharing a mechanism. What they still share is these four questions, and they must
 * keep sharing them: two answers to *"where is that stop drawn?"* is exactly how the walk and the
 * engraver drifted apart in the first place.
 *
 * ⛔ **Nothing here writes.** Every function reads the ElementRegistry the last render published.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { Stop } from '../../engine/models/tempoOps'
import { tempoStops } from '../../engine/models/tempoOps'
import { fracCompare, fracToNumber } from '../../utils/fraction'

/** What the readers need off the engine — a Pick, so a spec can stand them up without a renderer. */
export type TempoAnchorEngine = Pick<MusicEngine, 'getScore' | 'getElementRegistry' | 'getNote'>

/** Where the mark is anchored now — its address, read from the list it is stored in (the measure is
 *  half of it, exactly as a dynamic's is). Null when the id is no longer in the score. */
export function tempoAddress(engine: TempoAnchorEngine, id: string): Stop | null {
  for (const measure of engine.getScore().measures ?? []) {
    const mark = measure.tempos?.find(t => t.id === id)
    if (mark) return { measure: measure.number, beat: mark.beat }
  }
  return null
}

/**
 * ⭐⭐ **WHERE A MARK ANCHORED AT THIS STOP IS ENGRAVED — the x, and ONLY the x.** One Map lookup on
 * the ruler the render published (`ElementRegistry.tempoAnchorX` ← `TempoLayout.anchorX`).
 *
 * 🚨🚨 **⛔ NEVER THE NOTEHEAD'S X** — his report, 2026-08-31: *"i'm moving the hand and the tempo is
 * not moving on certain occasions"*, the occasions being bars that print a meter. The engraver does
 * not put the mark on the notehead: it goes on *the first notational element at-or-after the beat*,
 * which at a downbeat that prints a meter is the TIME SIGNATURE (Gould p. 183). Measured in bar 1 of
 * the Prelude the two differ by ~45 px. ⛔ So there is no second copy of that rule up here — a second
 * copy is exactly how the two drifted apart.
 *
 * 🚨 It is also the HOT PATH (his report the same day: *"the movement is not smooth, the tempo
 * freezes while the hand is still moving"*), which is why it is a hash lookup and ⛔ not a scan of
 * the page — see {@link drawnOnsets} for what the scan cost.
 */
export function onsetAnchorX(engine: TempoAnchorEngine, stop: Stop): number | null {
  return engine.getElementRegistry().tempoAnchorX(stop.measure, fracToNumber(stop.beat))
}

/**
 * 🚨🚨 **THE NEXT ANCHOR POINT IS THE NEXT COLUMN, ⛔ NOT THE NEXT STOP** — his reports of
 * 2026-08-31, one per device, from the same emptied bar: the mouse *"does not find the next anchor
 * point in measure 3"*, and then the keys walking out of that bar for ever without re-anchoring
 * (`⛔ NO CROSSING: the gap runs the other way`, 62 presses of pure ink).
 *
 * ⭐ **Why a stop is not an anchor point.** The mark is engraved on the first element at-or-after its
 * beat *on the staff it sits above* ({@link onsetAnchorX}, Gould p. 183), so when that staff holds
 * one whole rest, every one of the bar's onsets resolves to the SAME x — measured in his log,
 * `m2: 6 of 6 beats (columns) | 0@539 0.25@539 1@539`. Several stops, ONE place to put the mark.
 * Neither device can aim inside that column: the hand has no pixel to reach and the ink has no gap to
 * cross. ⭐ So the stops sharing the current anchor's x are passed OVER, and the next anchor point is
 * the nearest stop drawn somewhere else.
 *
 * ⚠️ **What it fixes is a break that read as a stop.** Both devices ended the search at the first
 * stop whose x was not strictly ahead — which is right for the next SYSTEM (below) and fatal for a
 * shared column: the first equal x killed it, so nothing past his emptied bar was reachable at all.
 *
 * ⛔ **A stop drawn BEHIND the anchor is still the end of the road** — it is on the next system, and
 * two systems' x's are not one ruler (`./markSystemJump`). ⛔ So is one the last render drew no
 * anchor for: an x we do not have is not an x to compare.
 *
 * ⚠️ Pass `stops` when calling this in a LOOP — otherwise every turn rebuilds the score's whole onset
 * list, which is the hot path the drag pays per frame.
 */
export function nextAnchorPoint(
  engine: TempoAnchorEngine,
  from: Stop,
  direction: 1 | -1,
  stops: Stop[] = tempoStops(engine.getScore()),
): { stop: Stop; x: number } | null {
  const fromX = onsetAnchorX(engine, from)
  if (fromX === null) return null
  let i = stops.findIndex(s => s.measure === from.measure && fracCompare(s.beat, from.beat) === 0)
  if (i === -1) return null
  for (i += direction; i >= 0 && i < stops.length; i += direction) {
    const x = onsetAnchorX(engine, stops[i])
    if (x === null) return null
    const sign = Math.sign(x - fromX)
    if (sign === -direction) return null
    if (sign === direction) return { stop: stops[i], x }
    // sign 0 — the same column, which neither device can address separately. Keep looking.
  }
  return null
}

/**
 * Every onset the last render DREW, once each, at the centre of its ink.
 *
 * ⭐ **The TOP staff's element wins**, because that is the staff the mark is engraved above and the
 * one `TempoLayout.anchorX` measures against. A stop that exists only lower down (a left-hand attack
 * under a right-hand rest) still answers, with that staff's point — the two staves share a column,
 * so the x is the same to within the column's own spread.
 *
 * ⚠️ **It rebuilds the score's whole onset list from every drawn note and rest**, with a `getNote`
 * per row and a linear de-duplication, so ⛔ it is not for the frame's hot path: {@link onsetAnchorX}
 * answers *"where is that stop's x?"* in a hash lookup. The ONE caller that needs this is the system
 * jump, which asks *"which staff row is this stop on"* — a question about the music's ink.
 */
export function drawnOnsets(engine: TempoAnchorEngine): Array<{ x: number; y: number; stop: Stop }> {
  const registry = engine.getElementRegistry()
  const out: Array<{ x: number; y: number; stop: Stop; staff: number }> = []
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    const staff = el.staff ?? 0
    const found = out.find(o => o.stop.measure === note.measure && fracCompare(o.stop.beat, note.beat) === 0)
    if (found && found.staff <= staff) continue
    const point = {
      x: el.bbox.x + el.bbox.width / 2,
      y: el.bbox.y + el.bbox.height / 2,
      stop: { measure: note.measure, beat: note.beat },
      staff,
    }
    if (found) Object.assign(found, point)
    else out.push(point)
  }
  return out
}

/**
 * Where one onset was drawn, or null when the last render drew none there.
 *
 * ⚠️ The X is the ENGRAVER's ({@link onsetAnchorX}) and the Y is the ONSET's ink: the y answers
 * *"which staff/system is this stop on"* for the jump, which is a question about the music and ⛔ not
 * about where a mark would be engraved.
 */
export function onsetPoint(engine: TempoAnchorEngine, stop: Stop): { x: number; y: number } | null {
  const ink = drawnOnsets(engine).find(o =>
    o.stop.measure === stop.measure && fracCompare(o.stop.beat, stop.beat) === 0)
  if (!ink) return null
  const x = onsetAnchorX(engine, stop)
  return x === null ? null : { x, y: ink.y }
}

/** The vertical centre of the mark's own ink in the last render, or null if it drew none. */
export function markInkY(engine: TempoAnchorEngine, id: string): number | null {
  const el = engine.getElementRegistry().getByType('tempo').find(e => e.id === id)
  return el ? el.bbox.y + el.bbox.height / 2 : null
}

/** The mark's drawn ink box in the LAST RENDER — the picture's own answer to *"where is it now?"*. */
export function markInkBox(
  engine: TempoAnchorEngine, id: string,
): { x: number; y: number; width: number } | null {
  const el = engine.getElementRegistry().getByType('tempo').find(e => e.id === id)
  return el ? { x: el.bbox.x, y: el.bbox.y, width: el.bbox.width } : null
}

/** Pixels per staff-space at the drawn mark. ⛔ Never a constant — `./markWalk`'s no-guessing rule. */
export function staffSpacePxOf(engine: TempoAnchorEngine, id: string): number | null {
  return engine.getElementRegistry().getByType('tempo').find(el => el.id === id)?.staffSpacePx ?? null
}
