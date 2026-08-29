/**
 * A GROUPING SIGN — the brace, bracket or sub-bracket at a system's left edge.
 *
 * 🚨 **His report, 2026-08-29**: *"i'm not able to select bracket or brace… i should be able to click
 * on it and select."*
 *
 * ⭐ **FIRST in the priority chain**, and the position is free rather than load-bearing: the sign is
 * drawn OUTSIDE the staves, in the indent it reserved for itself
 * (`layout/systemStartColumn`), where no staff, bar, note or mark has any ink. Nothing competes for
 * those pixels, so asking first costs one array scan and settles *"is this the music at all?"*
 * before any musical question — the same argument the score header's spec makes one row above.
 *
 * ⚠️ **Painted lanes only**, the clef's rule: the box is registered by the pen, so it only exists
 * for a system this render actually drew — but a system scrolled out of the cull window can still
 * leave one behind, and a press may only reach ink.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

/**
 * ⭐⭐ **HOW MUCH FORGIVENESS A PRESS GETS, in px.**
 *
 * 🚨 His report, 2026-08-29: *"it's a little difficult to select, i have to click very accurate."*
 * The registered box is the sign's own column — under a staff space wide — and a brace inside it is
 * **0.89 sp of hairline curve**, a sub-bracket **0.10 sp of stroke**. A box that tight is a box you
 * aim at rather than click.
 *
 * ⭐ **8, and it is the barline's answer scaled to a taller target.** `BARLINE_PRESS_PAD_PX` is 6 for
 * 1.6 px of ink (*"six pixels of forgiveness, both ways"*, 2026-08-28) — the same trade, and a
 * grouping sign can afford a little more because **nothing competes for these pixels**: it stands in
 * the indent it reserved for itself, outside the staves, where no note, bar or mark has ink. ⛔ The
 * pad may not reach the STAVES, which is why it is a few px and not a few staff spaces.
 */
const GROUP_SIGN_PRESS_PAD_PX = 8

export const STAFF_GROUP_ELEMENT: ClickableElementSpec = {
  kind: 'staffGroup',
  hit({ registry, x, y }, deps) {
    const pad = GROUP_SIGN_PRESS_PAD_PX
    const sign = registry.getByType('staffGroupSign').find(el => {
      const b = el.bbox
      // ⭐ Padded on BOTH axes — a press just above the top serif or below the bottom one is aimed
      //   at the sign as surely as one on its rod ({@link GROUP_SIGN_PRESS_PAD_PX}).
      return x >= b.x - pad && x <= b.x + b.width + pad
        && y >= b.y - pad && y <= b.y + b.height + pad
        && el.measure !== undefined && registry.isPainted(el.measure, el.staff ?? 0)
    }) ?? null
    if (!sign?.id) return false

    const symbol = deps.groupSymbolOf(sign.id)
    if (!symbol) return false
    dbg(`✓ Grouping sign selected | ${symbol} | group:${sign.id.slice(0, 8)}`)
    return deps.pick({ kind: 'staffGroup', groupId: sign.id, symbol })
  },

  highlight: h => h.applyStaffGroupHighlight(),
}
