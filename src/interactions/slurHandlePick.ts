/**
 * ⭐⭐ **WHICH SLUR HANDLE A PRESS TAKES** — the nearest one, not the first one found.
 *
 * His report, 2026-08-18: *"sometimes while interacting im trying to get the endpoint but i'm
 * getting the control point, this is not gut for ux"*. The press path tested the round ARC dots
 * first and took the first whose box contained the cursor, so wherever two hit boxes overlapped the
 * dot won — however much closer the square was. The boxes are 18 px wide and a short slur puts its
 * second control point about 20 px from its end square, so they overlap for a good part of the
 * repertoire.
 *
 * ⭐ **The rule is DISTANCE, and that is why it is a module rather than a re-ordering.** Putting the
 * squares first would only move the unfairness to the other family: aim at a dot beside a square and
 * you would get the square instead. What the hand means is *the handle it is nearest to*, so this
 * measures to each candidate's centre and takes the minimum — the same answer whichever family the
 * cursor is between, and one that stays correct if either glyph's size ever changes.
 *
 * ⭐ Order survives only as the TIE-BREAK, and it is the {@link ELEMENT_HIT_ORDER} question in
 * miniature (`interactions/elements/chain.ts`: *that array's ORDER is the answer to "who wins a press
 * two glyphs both cover"*). Dead-heats go to the POSITION handles — the blue true ends, then the
 * orange open joins — over the SHAPE dots: a square moves where the slur attaches and a dot only
 * bends it, so the square is the more consequential thing to have grabbed by accident.
 */
import type { ElementInfo, ElementRegistry } from '../engine/ElementRegistry'

/** Which family of handle a press resolved to, and the registry entry it landed on. */
export type SlurHandlePick =
  | { kind: 'endpoint'; entry: ElementInfo }
  | { kind: 'segmentEndpoint'; entry: ElementInfo }
  | { kind: 'control'; entry: ElementInfo }

/** ⚠️ Not a hit test — the CALLER's box test has already passed. This is the distance used to choose
 *  BETWEEN boxes that both contain the cursor, so it is measured to the centre. */
function distanceToCentre(el: ElementInfo, x: number, y: number): number {
  const cx = el.bbox.x + el.bbox.width / 2
  const cy = el.bbox.y + el.bbox.height / 2
  return Math.hypot(x - cx, y - cy)
}

function covers(el: ElementInfo, x: number, y: number): boolean {
  const b = el.bbox
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
}

/**
 * The handle of `slurId` a press at (`x`, `y`) should take, or null when it touched none.
 *
 * Candidates are the three drawn families, filtered to this slur and to entries carrying the fields
 * their gesture needs — an entry missing them could never have been dispatched anyway, and letting it
 * win the distance contest would silently swallow the press.
 */
export function pickSlurHandleAt(
  registry: ElementRegistry,
  slurId: string,
  x: number,
  y: number,
): SlurHandlePick | null {
  const candidates: SlurHandlePick[] = [
    ...registry.getByType('slur-endpoint')
      .filter(el => el.slurId === slurId && el.endpoint && covers(el, x, y))
      .map((entry): SlurHandlePick => ({ kind: 'endpoint', entry })),
    ...registry.getByType('slur-segment-endpoint')
      .filter(el => el.slurId === slurId && el.segmentRole && covers(el, x, y))
      .map((entry): SlurHandlePick => ({ kind: 'segmentEndpoint', entry })),
    ...registry.getByType('slur-handle')
      .filter(el => el.slurId === slurId && el.cpIndex !== undefined
        && el.slurEndpoints && el.controlPoints && covers(el, x, y))
      .map((entry): SlurHandlePick => ({ kind: 'control', entry })),
  ]
  if (candidates.length === 0) return null

  // ⚠️ The list is already in tie-break order, and `reduce` keeps the incumbent on an exact tie — so
  // "strictly nearer to win" is what makes the ordering above mean anything.
  return candidates.reduce((best, next) =>
    distanceToCentre(next.entry, x, y) < distanceToCentre(best.entry, x, y) ? next : best)
}
