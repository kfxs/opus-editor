/**
 * ⭐⭐ **WHERE A CURSOR GHOST SITS — one position, taken from the ACCIDENTAL ghost, for every ghost
 * that is simply a SIGN.**
 *
 * > **HIS RULE, 2026-08-17, stated when the pedal ghost got it wrong:** *"the position of the ghost
 * > ped is wrong, the pointer covers [it]; the position should be normal ghost position like tr and
 * > 8va and 8vb — this is a sign for the user, of course a ghost [does] not take into account the
 * > position of the real sign in the score."* …and then, on which position that is: *"maybe you
 * > should take the position of the ghost accidental as reference."*
 *
 * ⭐⭐ **THE PRINCIPLE, which settles a question answered wrong twice in one day.** A ghost is not a
 * rehearsal of the engraving: it exists so the user can see WHAT the next click makes. Where the
 * finished mark lands is the renderer's answer, computed from ink the click has not picked yet — so
 * borrowing it at the pointer buys nothing and costs the two things that matter:
 *
 *  - the glyph goes UNDER the arrow (`Ped.` dropped below the pointer because a pedal is engraved
 *    below the staff — his report above), and
 *  - it MOVES between two tools of one family (`8va` above, `8vb` below — his report earlier that
 *    day), so the eye has to re-find it on every switch.
 *
 * ⭐ **The accidental's is the reference because it was the one that already read right**: the glyph
 * sits just LEFT of the pointer and CENTRED on it vertically, so the arrow — whose body extends
 * down-right from its tip — never covers it, and the ghost is always in the same place relative to
 * the hand. ⚠️ The accidental ghost draws it through here too, so "the reference" is a single
 * definition rather than a number two files agree about today.
 *
 * ⛔ The DOT ghost is the one deliberate mirror (it parks RIGHT), and it is not an exception to the
 * rule above: a dot is engraved to the right of the notehead the click will land on and an
 * accidental to its left, so that pair says which side of a NOTEHEAD the gesture works on — about
 * the gesture, never about a rung above or below the staff.
 */

import type { DrawContext } from '@/engine/paint/DrawContext'
import { translation } from '@/engine/paint/Affine'
import { drawGroupOf, svgNode } from '../painter/svgDrawGroup'

/** Px a cursor ghost is parked LEFT of the pointer. Taste, and the one number to tune. */
const GHOST_CURSOR_GAP_PX = 10

/** Ghost blue at 0.7 opacity — a preview, not yet content. One definition for every ghost. */
const GHOST_BLUE = '#3B82F6'

/**
 * The translate that puts `gbox` in the standard ghost position for a pointer at (`cursorX`,
 * `cursorY`): its right edge a gap short of the pointer, its middle on the pointer's line.
 *
 * @param gbox the group's own bounding box, AFTER drawing (a caller with an unmeasurable one has no
 *   ghost to place — see any of the drawers' early return).
 */
export function ghostCursorOffset(
  gbox: { x: number; y: number; width: number; height: number },
  cursorX: number,
  cursorY: number,
): { dx: number; dy: number } {
  return {
    dx: cursorX - GHOST_CURSOR_GAP_PX - (gbox.x + gbox.width / 2),
    dy: cursorY - (gbox.y + gbox.height / 2),
  }
}

/**
 * ⭐⭐ **DRAW ONE SIGN-SHAPED GHOST** — open a group, let `drawSign` paint into it, then measure it,
 * paint it ghost blue and park it at the pointer.
 *
 * Everything but that one call was written out identically in `PedalGhost`, `OttavaGhost` and
 * `TrillGhost` — measure, bail if unmeasurable, recolour, translate, swallow. ⭐ A ghost drawer is
 * now its SIGN and nothing else, which is the part that is genuinely per-mark.
 *
 * ⚠️ **The sign is drawn at x = 0** and translated into place below, once its real size is known —
 * which is why the group is opened before anything is painted, and why a drawer must not park its
 * own glyph.
 *
 * @param groupName the `openGroup` class
 *   (`reference_vexflow_opengroup_prefix`) — so the constant a drawer exports for
 *   `GHOST_GROUP_SELECTOR` carries that prefix and this argument does not. Get it wrong and the
 *   ghost smears one copy per mouse position, because `clearGhosts` never sweeps it.
 * @returns false when nothing MEASURABLE was drawn — which is what jsdom always answers, since a
 *   glyph there has no size (`reference_jsdom_cannot_measure_glyphs`); the caller treats that as
 *   "no ghost", ⛔ never as an error.
 */
export function drawSignGhost(
  ctx: DrawContext,
  groupName: string,
  cursorX: number,
  cursorY: number,
  drawSign: () => void,
  /**
   * Where the measured ghost goes — the offset that moves its ink box into place. Defaults to
   * {@link ghostCursorOffset} (left of the pointer, the accidental's reference). ⭐ The mark ghosts
   * each keep their own (S11b): a dot parks RIGHT, an articulation lifts, a tremolo centres.
   */
  park: (box: { x: number; y: number; width: number; height: number }, cursorX: number, cursorY: number) => { dx: number; dy: number } = ghostCursorOffset,
): boolean {
  try {
    const group = drawGroupOf(ctx.openGroup(groupName))
    try {
      drawSign()
    } finally {
      ctx.closeGroup()
    }
    if (!group) return false

    // 🚨 The box BEFORE the placement — the sign is drawn at x = 0 and parked below, so measuring
    // after moving it would measure the answer we are still computing ({@link DrawGroup.inkBox}).
    const gbox = group.inkBox()
    if (!gbox) {
      group.discard()
      return false
    }

    group.tag('opacity', '0.7')
    // ⛔ The NODE: recolouring the drawn shapes is DOM work on ink, not a placement — the counted
    //   escape (`npm run lint:paint`). ⏭️ In a SCENE a ghost is the same scene with a STYLE, and
    //   this sweep stops existing (`docs/plans/own-engraving-engine.md` §7.2).
    const node = svgNode(group)!
    // ⚠️ `text, path` — a GLYPH's two shapes, which is what every sign ghost draws. It is also a
    // constraint on drawers: ink of any other kind comes out BLACK. The barline ghost's first build
    // painted its strokes with `ctx.fillRect` and reported itself — *"why the only thing is blue in
    // the ghost is the dots?"* — and the answer was to stamp the precomposed glyph instead, which is
    // what a ghost should have been doing anyway (see `./BarlineGhost`).
    node.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', GHOST_BLUE)
    })

    const { dx, dy } = park(gbox, cursorX, cursorY)
    group.setPlacement(translation(dx, dy))
    return true
  } catch (_e) {
    return false
  }
}

/**
 * ⭐ **SWEEP WHAT `draw` PAINTED INTO ONE CLASS-TAGGED GROUP** — the wrapper the older cursor ghosts
 * (clef, meter, rest, fan, dynamic) each wrote out for themselves: remember how many children the
 * `<svg>` had, let `draw` paint, then move everything new into `<g class="{cls}">`, appended last.
 *
 * The class is set by hand — `.ghost-clef-group` and its
 * siblings are named that way in `GHOST_GROUP_SELECTOR` and styled that way in `notation.css`. Placing
 * the group is the caller's: each of these ghosts parks itself its own way.
 *
 * @returns the group, or null when `draw` painted nothing (nothing is added then).
 */
export function sweepIntoGhostGroup(svg: SVGElement, cls: string, draw: () => void): SVGGElement | null {
  const childrenBefore = svg.children.length
  draw()
  const drawn: Element[] = []
  for (let i = childrenBefore; i < svg.children.length; i++) drawn.push(svg.children[i])
  if (drawn.length === 0) return null
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.setAttribute('class', cls)
  for (const el of drawn) svg.removeChild(el)
  for (const el of drawn) group.appendChild(el)
  svg.appendChild(group)
  return group
}

/**
 * Park a swept ghost group with its ink box's CENTRE on the pointer — the clef's and the meter's
 * placement. ⚠️ No box (jsdom, or nothing measurable) leaves it where it was drawn, as before.
 */
export function centreGhostOnCursor(group: SVGGElement, cursorX: number, cursorY: number): void {
  const box = (group as unknown as SVGGraphicsElement).getBBox?.()
  if (!box || box.width <= 0) return
  const dx = cursorX - (box.x + box.width / 2)
  const dy = cursorY - (box.y + box.height / 2)
  group.setAttribute('transform', `translate(${dx}, ${dy})`)
}
