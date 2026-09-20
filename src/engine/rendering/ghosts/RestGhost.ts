/**
 * ⭐ **THE REST STAMP'S GHOST — S11d** (`docs/history/vexflow-removal-map.md` S11): a free-floating rest of the
 * armed duration + dots, following the cursor. Its own module rather than a function in
 * {@link GhostRenderer}, per CLAUDE.md's rule: the table there has a ROW and the drawing lives here.
 *
 * A real rest NOTE and not a bare glyph, because the ghost must answer "how long, and dotted?" — the
 * two things a rest IS — and the note places its dots at the right offset for each duration; hand-
 * placing them would be inventing a rule the note already knows. ⭐ That note is the score's own
 * (`EngravedNote` + `EngravedDot`, formatted by `./loneNote` and drawn on our surface) where a VexFlow
 * `StaveNote` + `Voice` + `Formatter` stood on a line-less VexFlow `Stave`.
 *
 * THE ATTACH LINE. A whole and a half rest are the same rectangle: what tells them apart is that a
 * whole rest HANGS from a line and a half rest SITS on one. Floating at the cursor, the ghost touches
 * no line at all, so both would read the same — a coin-flip on the most basic choice the tool offers.
 * So for the line-attached rests (whole/half, dotted or not) the ghost draws the ONE line it attaches
 * to, exactly as the score does for a rest a shift has pushed off the staff (drawRestLedgerLines /
 * restSupportingLedgerLine). Shorter rests are not line-attached and get nothing — an eighth rest is
 * unmistakable on its own.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { NoteDuration } from '@/types/music'
import type { GhostColor } from './ghostTypes'
import { EngravedNote, drawNoteInkThrough } from '../EngravedNote'
import { EngravedStave } from '../EngravedStave'
import { attachEngravedDots } from '../EngravedDot'
import { convertDuration, restKey, restSupportingLedgerLine } from '../NoteBuilder'
import { formatLoneNote } from './loneNote'
import { sweepIntoGhostGroup } from './ghostCursor'
import { noteRuler } from '../noteRuler'
import { staveFrame, standOn } from '../staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'

/** The class `clearGhosts` sweeps this ghost by — bare, as `notation.css` styles it. */
export const REST_GHOST_GROUP_CLASS = 'ghost-rest-group'

/**
 * Draw the armed rest at the cursor, in the active voice's `color`.
 * @returns true if the ghost rest was drawn
 */
export function drawRestGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, duration: NoteDuration, dots: number, color: GhostColor,
): boolean {
  try {
    // A stand-in stave, never drawn — it gives the rest something to be positioned against.
    const stave = new EngravedStave(0, cursorY, 120).setOpeningBarline('none').setClosingBarline('none')

    // ⭐ Placed by `restKey`, the same rule NoteBuilder uses — a whole rest on the fourth line,
    //   everything shorter on the middle one: the NEUTRAL position, Gould p. 34.
    // ⚠️ ⛔ It does NOT follow that the ghost lands where the real rest will, and the claim that it
    //   did is withdrawn. In a multi-voice staff the real rest is DISPLACED from this line by what
    //   else is in the bar (`engine/layout/restVoicePlacement.ts`), and this preview knows none of
    //   it — it never knew about the old fixed lanes either, so the gap is older than the derived
    //   rule and merely wider now. Not fixed here (the plan's §9), but a preview that lies about
    //   where the mark lands is the same family of fault as a rest the user has to drag.
    //   (docs/plans/multi-voice-rest-position-plan.md §8.)
    const rest = new EngravedNote({ keys: [restKey(duration)], duration: convertDuration(duration, dots) + 'r' })
    for (let d = 0; d < dots; d++) attachEngravedDots(rest)
    standOn(rest, stave)
    formatLoneNote(rest, stave, { numerator: 4, denominator: 4 }, 100)

    const group = sweepIntoGhostGroup(svg, REST_GHOST_GROUP_CLASS, () => {
      drawNoteInkThrough([rest], ctx)
      rest.setContext(ctx).draw()

      // The attach line, for the two rests that have one — drawn with the glyph so it travels with
      // it under the transform below.
      const line = restSupportingLedgerLine(duration, false, rest.getLineForRest())
      if (line !== null || duration === 'w' || duration === 'h') {
        const ruler = noteRuler(rest)
        const PAD = 3 // px the line overhangs the glyph on each side — reads as a staff line, not a strike-through
        const y = noteLineY(staveFrame(stave), rest.getLineForRest())
        ctx.beginPath()
        ctx.moveTo(ruler.headLeftX - PAD, y)
        ctx.lineTo(ruler.headRightX + PAD, y)
        ctx.stroke()
      }
    })
    if (!group) return false

    // ⭐ The ACTIVE VOICE's colour, handed down as two CUSTOM PROPERTIES rather than painted onto
    // each node: `notation.css` already owns this ghost's appearance with `!important` rules (it has
    // to — the painter writes its own fill onto every path it draws), and an inline attribute would
    // lose to them. A variable the stylesheet reads means the CSS keeps saying WHAT gets coloured and
    // the caller says WITH WHAT, which is the same split the ghost NOTE has. Absent = the family blue.
    group.style.setProperty('--ghost-fill', color.fill)
    group.style.setProperty('--ghost-stroke', color.stroke)

    // Park it clear of the pointer — LEFT and UP — rather than centred on it, which buries the
    // glyph under the arrow (whose body extends down-right from its tip). The same reason the
    // accidental ghost parks left and the dot ghost right-and-up: a ghost you cannot see is not a
    // preview. Up matters more here than for those two, because the rest is a solid block and the
    // arrow sits squarely on it.
    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const GAP_X = 5
      const LIFT_Y = 10
      const dx = cursorX - GAP_X - (gbox.x + gbox.width / 2)
      const dy = cursorY - LIFT_Y - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}
