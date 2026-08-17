/**
 * ⭐ **TAB WALKS A SELECTED SLUR'S HANDLES** — his ask, 2026-08-17. Reach every grabbable point
 * without the mouse, in the order the eye reads them.
 *
 * A slur is the one element with several editable POINTS rather than one position, and until now the
 * only way to pick one was to hit it with the pointer. All three kinds are already first-class in
 * the selection (`EditorState.SelectedElement`'s slur variant: `endpoint`, `segmentEndpoint`,
 * `controlPoint`) and all three already paint as picked, so this adds no state and no drawing —
 * only a way to get there.
 *
 * ## ⭐⭐ THE REGISTRY IS THE LIST, and that is the whole design
 *
 * The handles come from `ElementRegistry.getByType(...)` — i.e. from what the last render actually
 * DREW — rather than from the model. Everything follows from that:
 *
 *  - a slur with no hand-editable shape has no round dots, and Tab visits none;
 *  - LINEAR view draws no handles at all (`HighlightController.applySlurHandles` returns early), so
 *    Tab declines there without needing to know why;
 *  - a cross-system slur's per-segment dots and open joins appear exactly as often as they are
 *    drawn — no second rule about how many segments there are.
 *
 * ⛔ It also means Tab can only ever arm something the user could have clicked. A keyboard route to a
 * point with no ink would be a way to nudge something invisible.
 *
 * ## The ORDER is structural, not geometric
 *
 * Sorting every handle by x would read correctly for a same-line slur and interleave the systems of
 * a cross-system one (the second system's leftmost handle has a smaller x than the first system's
 * rightmost). So the walk is **by segment, then left to right inside it** — with the two TRUE ends
 * pinned first and last, since they belong to the span rather than to any one segment. For the
 * ordinary same-line slur that yields exactly the reading order: **start square → first dot → second
 * dot → end square.**
 */
import type { EditorState, SelectedElement } from './EditorState'
import { selectedOf } from './EditorState'
import type { ElementInfo, ElementRegistry } from '../engine/ElementRegistry'

/** The slur-shaped members of {@link SelectedElement} — what one Tab press arms. */
type SlurSelection = Extract<SelectedElement, { kind: 'slur' }>

/** Everything but the id: the id is the slur's and never varies across the walk. */
type HandlePick = Omit<SlurSelection, 'kind' | 'id'>

/**
 * Where a handle sits in the walk. `segment` orders the systems; `x` orders within one.
 *
 * ⚠️ The two TRUE ends take ∓∞ rather than the segment they were REGISTERED on. Both blue squares
 * are pushed by whichever partial carries `slurEndpoints` — the first one — so on a cross-system
 * slur the end square would otherwise sort into the first system, which is the one place it is not.
 */
interface Ranked {
  segment: number
  x: number
  pick: HandlePick
}

/** begin → 0, middle #n → 1+n, end → last. A same-line slur has no roles and lands on 0. */
function segmentIndex(role: ElementInfo['segmentRole'], ordinal: number | undefined): number {
  if (role === 'middle') return 1 + (ordinal ?? 0)
  if (role === 'end') return Number.MAX_SAFE_INTEGER - 1
  return 0
}

/**
 * The handles of `slurId`, in walk order — the pure half, so the order can be tested without a DOM.
 * Entries that do not carry what their kind needs are dropped rather than guessed at.
 */
export function slurHandleOrder(entries: readonly ElementInfo[], slurId: string): HandlePick[] {
  const ranked: Ranked[] = []
  for (const el of entries) {
    if (el.slurId !== slurId) continue
    const x = el.bbox.x
    if (el.type === 'slur-endpoint' && el.endpoint) {
      // Pinned outside every segment: first for the start, last for the end.
      ranked.push({
        segment: el.endpoint === 'start' ? -1 : Number.MAX_SAFE_INTEGER,
        x, pick: { endpoint: el.endpoint },
      })
    } else if (el.type === 'slur-handle' && el.cpIndex !== undefined) {
      ranked.push({
        segment: segmentIndex(el.segmentRole, el.segmentOrdinal),
        x,
        pick: {
          controlPoint: {
            cpIndex: el.cpIndex,
            segmentRole: el.segmentRole,
            segmentOrdinal: el.segmentOrdinal,
          },
        },
      })
    } else if (el.type === 'slur-segment-endpoint' && el.segmentRole) {
      const role = el.segmentRole
      ranked.push({
        segment: segmentIndex(role, el.segmentOrdinal),
        x,
        pick: {
          segmentEndpoint: role === 'middle'
            ? { role: 'middle', ordinal: el.segmentOrdinal ?? 0, side: el.segmentSide ?? 'left' }
            : { role },
          segmentSpanCount: el.slurSpanCount ?? 0,
        },
      })
    }
  }
  ranked.sort((a, b) => (a.segment !== b.segment ? a.segment - b.segment : a.x - b.x))
  return ranked.map(r => r.pick)
}

/** Is `pick` the handle the selection currently has armed? */
function isArmed(pick: HandlePick, current: SlurSelection): boolean {
  if (pick.endpoint) return current.endpoint === pick.endpoint
  if (pick.controlPoint) {
    const c = current.controlPoint
    return !!c && c.cpIndex === pick.controlPoint.cpIndex
      && c.segmentRole === pick.controlPoint.segmentRole
      && c.segmentOrdinal === pick.controlPoint.segmentOrdinal
  }
  if (pick.segmentEndpoint) {
    const s = current.segmentEndpoint
    if (!s || s.role !== pick.segmentEndpoint.role) return false
    return s.role !== 'middle' || (pick.segmentEndpoint.role === 'middle'
      && s.ordinal === pick.segmentEndpoint.ordinal && s.side === pick.segmentEndpoint.side)
  }
  return false
}

/**
 * Move the armed handle one step along the walk (`+1` Tab, `−1` Shift+Tab) and return true, or
 * DECLINE with false when there is no slur selected and no handle drawn — so Tab stays the browser's
 * everywhere else.
 *
 * With the slur selected but no handle armed yet, Tab takes the FIRST and Shift+Tab the LAST, so
 * either key is a way in. The walk WRAPS: four handles and a repeated Tab is a loop, not a dead end.
 *
 * ⚠️ Reassigns `state.selectedElement` whole — the observable Proxy traps the SET, and mutating
 * `selectedElement.controlPoint` would change the value and tell nobody.
 */
export function cycleSlurHandle(
  state: EditorState,
  registry: ElementRegistry,
  step: 1 | -1,
): boolean {
  const current = selectedOf(state, 'slur')
  if (!current) return false
  const order = slurHandleOrder(
    [...registry.getByType('slur-endpoint'), ...registry.getByType('slur-handle'),
      ...registry.getByType('slur-segment-endpoint')],
    current.id,
  )
  if (!order.length) return false

  const at = order.findIndex(p => isArmed(p, current))
  const next = at === -1
    ? (step === 1 ? 0 : order.length - 1)
    : (at + step + order.length) % order.length
  // ⭐ Built from the id alone, never spread from `current` — the three handle fields are mutually
  // exclusive, and spreading would carry the old one alongside the new.
  state.selectedElement = { kind: 'slur', id: current.id, ...order[next] }
  return true
}
