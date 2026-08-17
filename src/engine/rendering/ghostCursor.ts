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

/** Px a cursor ghost is parked LEFT of the pointer. Taste, and the one number to tune. */
export const GHOST_CURSOR_GAP_PX = 10

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
