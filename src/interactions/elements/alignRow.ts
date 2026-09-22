/**
 * ⭐ **ALIGN IN A ROW — `Ctrl+Shift+R` on a group of marks** puts them on ONE line: Sibelius's
 * *Layout › Align in a Row* (his ask, 2026-09-22: *"you have two hairpin that does not have the same
 * y position cause they are offseted both vertical… you press the shortcut and it makes the hairpins
 * you have selected all the same line"*).
 *
 * ⭐ **The row is the AVERAGE of where the members were drawn** — Sibelius's rule, and the one that
 * makes the verb symmetric: nobody wins, the group meets in the middle. Where a member IS, vertically,
 * is the centre of its box in the last render (the registry's), and that is not a rough choice for
 * the dynamics family: a dynamic's registered box runs `baseline − above … baseline + below`
 * (`rendering/marks/dynamics/DynamicsLayout`), so its centre is `baseline + (below − above) / 2` —
 * exactly the hairpin's axis (`HairpinRenderer.axisOffsetSpaces`). A `p` and a wedge aligned here
 * land on the same dynamics LINE, which is the alignment Sibelius's own command famously gets wrong
 * (its hairpins sit low against the letters, because it aligns a position attribute, not the line).
 *
 * ⭐ **Nothing about moving a mark is reinvented here** — `./groupKeys`'s arrangement: each member is
 * handed to ITS OWN kind's `keys.nudge` with the vertical distance to the row, in that mark's own
 * staff-spaces (`lanes/markLane.markStaffSpacePx`, so a small staff's mark travels the right number
 * of pixels), inside one `runBatch` — one undo entry, one render. A member its family refuses (the
 * page limit, the band) stays put; the others still meet.
 *
 * ⛔ **Marks ONLY, two or more, DRAWN.** A selection holding a note declines (`markGroup`'s rule). A
 * member the last render did not draw (culled, linear view) has no y to average and is left out; if
 * fewer than two remain there is no row to make and the verb declines.
 *
 * ⛔ No *Align in a Column* (`Ctrl+Shift+C`), and no reset: `Ctrl+Backspace` on the group already puts
 * every member back to the engraver's place (`./groupKeys.resetMarkGroup`), his call.
 */
import type { ElementType } from '../../engine/ElementRegistry'
import type { SelectedElement } from '../state/EditorState'
import { markStaffSpacePx } from '../lanes/markLane'
import { ELEMENT_SPECS } from './chain'
import { markGroup, overGroup } from './groupKeys'
import type { KeysCtx } from './keys'

/** A press whose whole journey is under this many staff-spaces is no press at all. */
const ALREADY_IN_ROW_SS = 1e-6

/** Where one member stands in the last render, and the scale its nudge is measured in. */
interface DrawnMember {
  key: string
  /** The centre of its drawn box, page pixels. */
  y: number
  /** Pixels per staff-space where it was drawn. */
  spacePx: number
}

/** The member's drawn position — null when the last render drew it nowhere, or drew it at a scale
 *  nobody measured (⛔ never guessed: `markStaffSpacePx`'s rule). */
function drawnMember(ctx: KeysCtx, element: SelectedElement): DrawnMember | null {
  if (!('id' in element)) return null
  const registry = ctx.engine.getElementRegistry()
  const kind = element.kind as ElementType
  const drawn = registry.getByType(kind).find(e => e.id === element.id)
  if (!drawn) return null
  const spacePx = markStaffSpacePx(registry, kind, element.id) ?? drawn.staffSpacePx ?? null
  if (spacePx === null || spacePx <= 0) return null
  return { key: `${element.kind}:${element.id}`, y: drawn.bbox.y + drawn.bbox.height / 2, spacePx }
}

/** `Ctrl+Shift+R`: every selected mark onto one line, the average of where they were drawn. */
export function alignMarkRow(ctx: KeysCtx): boolean {
  const group = markGroup(ctx)
  if (!group) return false
  const drawn = new Map<string, DrawnMember>()
  for (const item of group) {
    const member = drawnMember(ctx, item as SelectedElement)
    if (member) drawn.set(member.key, member)
  }
  if (drawn.size < 2) return false
  let sum = 0
  for (const member of drawn.values()) sum += member.y
  const row = sum / drawn.size

  return overGroup(ctx, 'Align marks in a row', (quiet, element) => {
    const member = 'id' in element ? drawn.get(`${element.kind}:${element.id}`) : undefined
    if (!member) return false
    const dy = (row - member.y) / member.spacePx // SCREEN staff-spaces: +down, the rows' convention
    if (Math.abs(dy) < ALREADY_IN_ROW_SS) return false
    return ELEMENT_SPECS[element.kind].keys?.nudge?.(quiet, element, 0, dy) ?? false
  })
}
