/**
 * ⭐ **THE ARROWS ON A GROUP OF MARKS** — several Ctrl-clicked hairpins, dynamics, trills, slurs,
 * ottavas, pedals, tempo marks or ties, moved together.
 *
 * 🚨 His report, 2026-09-21: *"i have two hairpin selected im pressing arrow up or ctrl arrow and i
 * can not move them"*. The arrows ask the ONE `selectedElement`'s row (`./keys`) — and a group is not
 * one element: `SelectionController.toggleMark` files the marks in `selectedItems` and CLEARS
 * `selectedElement`, so the key reached nobody and fell through to a pitch edit with no note to edit.
 *
 * ⭐ **Nothing about moving a mark is reinvented here.** Each member is handed to ITS OWN kind's row
 * — the same `keys.nudge` a lone selection runs, with nothing armed, so it is the whole-mark nudge
 * with that family's own limits — inside one `runBatch`, so the press is ONE undo entry and one
 * render. A member its family refuses (the page limit, the band) stays put; the others still move.
 *
 * ⛔ **The VERTICAL only.** A mark's horizontal arrow is an interpolating WALK that can re-anchor it
 * in the music, previewed frame by frame as a key RUN keyed to one id (`../keyRun`). Running several
 * of those at once is a different feature with its own questions (do they all re-anchor? against
 * whose lane?), so ←/→ on a group DECLINE and fall through, as they did before.
 *
 * ⛔ **Marks ONLY.** A selection holding a NOTE declines: ↑/↓ then re-pitch the notes, which is what a
 * boxed passage — notes with the marks that ride along — has always meant.
 */
import type { SelectedElement } from '../state/EditorState'
import type { SelectionItem } from '../state/selection'
import { ELEMENT_SPECS } from './chain'
import type { KeysCtx } from './keys'

/** The group's members that have a row to ask — or null when this selection is not a group of marks. */
function markGroup(ctx: KeysCtx): SelectionItem[] | null {
  const items = [...ctx.state.selectedItems.values()]
  if (items.length < 2 || items.some(item => item.kind === 'note')) return null
  // `note` is excluded above; every other item kind is a row of the table.
  const answering = items.filter(item => ELEMENT_SPECS[item.kind as SelectedElement['kind']]?.keys)
  return answering.length ? answering : null
}

/** One verb over the group, as ONE undo entry and one render. @returns whether any member answered. */
function overGroup(
  ctx: KeysCtx,
  description: string,
  run: (quiet: KeysCtx, element: SelectedElement) => boolean,
): boolean {
  const group = markGroup(ctx)
  if (!group) return false
  // ⚠️ A member's row renders (and may start a key run) when it moves; in a group that is the
  //    batch's job, once, at the end.
  const quiet: KeysCtx = { ...ctx, render: () => {}, afterMarkPress: () => {} }
  let any = false
  ctx.engine.runBatch(description, () => {
    // A `SelectionItem` of a mark IS that kind's `SelectedElement` with nothing armed.
    for (const item of group) any = run(quiet, item as SelectedElement) || any
  })
  if (any) ctx.render()
  return any
}

/** ↑/↓ (fine) and `Ctrl+↑/↓` (coarse) on a group of marks. `dx`/`dy` are SCREEN staff-spaces. */
export function nudgeMarkGroup(ctx: KeysCtx, _dx: number, dy: number): boolean {
  if (dy === 0) return false // ←/→ decline — see the header
  return overGroup(ctx, 'Move marks', (quiet, element) =>
    ELEMENT_SPECS[element.kind].keys?.nudge?.(quiet, element, 0, dy) ?? false)
}

/** `Ctrl+Backspace` on a group: every member back to the engraver's place. */
export function resetMarkGroup(ctx: KeysCtx): boolean {
  return overGroup(ctx, 'Reset marks', (quiet, element) =>
    ELEMENT_SPECS[element.kind].keys?.reset?.(quiet, element) ?? false)
}
