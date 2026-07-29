import type { RenderPass } from './RenderPass'

/**
 * **Ink that belongs to one staff but is drawn outside its measure groups** — the ties, slurs and
 * cross-barline beams of docs/staff-size-plan.md §4.3.
 *
 * A bar's own glyphs are drawn inside a `<g transform="scale(k)">` (§4.1), so on a staff drawn
 * small everything VexFlow has stored about them — stem tips, notehead edges, beam slopes — is in
 * that group's own space. These passes run after the measure loop, at the SVG's top level, and
 * build their geometry out of exactly those numbers. Drawn as-is they land full size in the wrong
 * place: right where the *unscaled* notes would have been.
 *
 * ⭐ **So put them back in the staff's space rather than converting their coordinates.** Each of
 * these passes already opens one group of its own (per tie, per slur), for the selection
 * highlight's sake; giving that group the same scale makes the whole pass correct at once —
 * geometry, curve thickness, beam width — with no arithmetic to get wrong and none to forget when
 * a new kind of ink is added. It is the same mechanism as the measure group, and it works for the
 * same reason.
 *
 * ⛔ **Not for ink that spans two staves.** A stave connector runs from one staff's top line to
 * another's bottom line, and those two may be drawn at different sizes — there is no single scale
 * for it. That one maps its coordinates explicitly instead.
 */
/**
 * The class of the wrapper {@link inScaledStaffGroup} opens — `vf-scaled` once VexFlow's
 * `openGroup` has prefixed it. Exported because it changes the DOM's shape for a small staff, and
 * anything that identifies top-level ink by being a direct child of the `<svg>` (the cross-barline
 * beams, in the tests and the e2e harness) has to look one level deeper for it.
 */
export const STAFF_SCALE_GROUP = 'scaled'

/**
 * {@link inStaffSpace} for a pass with no group of its own to hang the scale on — it opens one.
 *
 * ⭐ **Only when the staff is not full size.** At size 1 the drawing comes out byte-identical to
 * what it always was, wrapper and all: the cross-barline beams are identified by being direct
 * children of the `<svg>`, and a `<g>` that exists only to carry `scale(1)` would move every one
 * of them for nothing.
 */
export function inScaledStaffGroup<T>(
  pass: RenderPass,
  staffIndex: number,
  /** Distinguishes this pass's wrapper in the DOM; prefixed `vf-` by `openGroup`. */
  id: string,
  draw: () => T,
): T {
  const k = pass.staffScale(staffIndex)
  if (k === 1) return draw()

  const group = pass.context.openGroup?.(STAFF_SCALE_GROUP, id) as SVGGElement | undefined
  try {
    return inStaffSpace(pass, staffIndex, group, draw)
  } finally {
    // ALWAYS close: an open group swallows the whole rest of the render (see `renderMeasure`).
    pass.context.closeGroup?.()
  }
}

export function inStaffSpace<T>(
  pass: RenderPass,
  /** 0-based index of the staff this ink belongs to. */
  staffIndex: number,
  /** The pass's own group, if it opened one — the thing that carries the scale. */
  group: SVGGElement | null | undefined,
  draw: () => T,
): T {
  const k = pass.staffScale(staffIndex)
  // The registry too: what these passes register (a tie's box, a slur's handles and sampled arc)
  // is read off the same local geometry, and hit-testing works in the SVG's coordinates.
  if (k !== 1 && group) group.setAttribute('transform', `scale(${k})`)
  return pass.elementRegistry.withScale(k, draw)
}
