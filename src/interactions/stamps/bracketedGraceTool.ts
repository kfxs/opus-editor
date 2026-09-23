/**
 * ⭐ **The BRACKETED grace tool's PRESS and its LIGHT** (`docs/plans/bracketed-grace-plan.md` P2) — what
 * the dev toolbar's `bracket.` button does, in its own module (the palette lends it its arm/disarm,
 * {@link SpanToolHost}), as `./graceTool` is the grace buttons'.
 *
 * ⏳ A press ARMS the stamp, whatever is selected — what a press does with a NOTE selected is his to find
 * by trying it (plan P2; the graces' D6 went the same way). ⛔ Nothing is built on a guess.
 */
import { dbg } from '@/utils/debug'
import type { BracketedSide } from '@/utils/bracketedGraces'
import { armedTool, type EditorState } from '../state/EditorState'
import type { SpanToolHost } from './spanToolPress'

/** Arm the bracketed stamp for `side` — or disarm it, when the same one is armed already. */
export function pressBracketedTool(host: SpanToolHost, side: BracketedSide): void {
  const armed = armedTool(host.state, 'bracketedGrace')
  if (armed && armed.side === side) {
    host.state.selectedAccidental = null
    // Back to NOTE ENTRY, as the grace's re-press is (his report, 2026-09-22).
    host.disarmToEntry()
    dbg('[bracketed] stamp disarmed — note entry')
    return
  }
  // A stale note-entry accidental is not a choice made for it (the grace's rule).
  if (!armed) host.state.selectedAccidental = null
  host.arm({ kind: 'bracketedGrace', side })
  dbg(`[bracketed] stamp armed (${side})`)
}

/** Is the button for `side` lit? By the ARMED tool. */
export function bracketedToolLit(state: EditorState, side: BracketedSide): boolean {
  return armedTool(state, 'bracketedGrace')?.side === side
}
