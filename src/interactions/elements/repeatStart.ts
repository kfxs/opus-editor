/**
 * ⭐⭐ **THE OPEN REPEAT** (`|:`) — the line that OPENS a measure, and the one barline sign that is
 * not selected as a boundary.
 *
 * 🚨 **HIS REPORT, 2026-08-26** — *"I can not highlight open repeat on the beginning of the score"*.
 * `./barline` names *the line that ENDS bar N*, which cannot reach two signs:
 *
 *  - **the one opening bar 1**, since there is no bar 0 to name it by — and that sign is not even at
 *    a boundary: a bar with a header displaces its repeat past the clef/meter (Gould p. 234,
 *    `BarlineRenderer.displacedRepeatX`), and bar 1 always has one;
 *  - **the right half of a `:||:`**, where two statements meet on one line and only one of them
 *    belongs to the bar that ends there (*"when we have open+end and I choose it, it highlights
 *    everything but it should highlight just the part that was clicked"*).
 *
 * ⭐ So this is the model's ONE OWNER PER LINE rule, as a selection: the sign is owned by the bar it
 * OPENS, and that measure number IS its identity.
 *
 * ## 🚨 BEFORE the barline in {@link ELEMENT_HIT_ORDER} — a press resolves to the SIGN it landed on
 *
 * ⚠️ **This was the other way round for an hour, and his report overturned it:** *"I click on a repeat
 * bar and sometimes it shows me repeat start and sometimes it shows me barline, like we have two
 * barlines… the user is clicking the special barline, and that is what the properties should refer
 * to."* A lone `|:` REPLACES the previous bar's plain line (`signAtBoundary`) — there is ONE sign at
 * that boundary, not a sign with a line underneath it — so a press on it must not answer differently
 * depending on which stroke it hit.
 *
 * ⭐ The box already says which sign a press is on, so the order was the only thing wrong: it is this
 * sign's own ink from the boundary rightward, which for a lone `|:` is the WHOLE sign (all of it grows
 * into the bar it opens, `docs/barline-types-plan.md` §6.1) and for a `:||:` is exactly its right
 * half. The barline keeps everything left of the boundary — the end repeat's half, or the line itself.
 *
 * ⚠️ **The bar-width gestures are not lost where this takes the ink.** The boundary is still grabbable
 * in the pad just left of the sign, and `shortcutWiring.selectedBoundaryMeasure` resolves the keyboard
 * width/gap nudges from EITHER selection: a `|:` opening bar *M* stands on the line ending bar *M−1*.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const REPEAT_START_ELEMENT: ClickableElementSpec = {
  kind: 'repeatStart',
  /**
   * Select the `|:` that opens a measure.
   *
   * ⭐ **No `isPainted` filter, unlike the barline's** — and it is not an omission. Tier 1 registers a
   * barline box for every bar in the SCORE, drawn or not, so a press there can land on a line that is
   * not on the page (docs/barline-selection.md §1a). This box is registered by the DRAWING pass
   * (`BarlineRenderer.registerRepeatStart`), so its existence already IS the proof that the sign was
   * painted.
   */
  hit({ registry, x, y, closestElement }, deps) {
    // ⛔ No horizontal pad: the box is the sign's own ink, 1.5 staff spaces of it, which is a real
    // target — where a plain barline's 4 px is not. Padding it would only take presses from the
    // divider on its left and the first note on its right, both of which have a better claim.
    const inRange = registry.getByType('repeatStart').filter(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    })

    // NEAREST, for `./barline`'s reason: two systems' signs can both answer a press near a break, and
    // registration order is by bar rather than by distance.
    const centre = (el: { bbox: { x: number; width: number } }) => el.bbox.x + el.bbox.width / 2
    const signAt = inRange.reduce<typeof inRange[number] | null>(
      (best, el) => (best === null || Math.abs(centre(el) - x) < Math.abs(centre(best) - x) ? el : best),
      null,
    )
    if (signAt?.measure === undefined) return false

    // Never steal a click that lands on a note body — a displaced `|:` stands between the header and
    // the first note of its bar, so its box is right beside one.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    const measure = signAt.measure
    dbg(`✓ Open repeat selected | opens measure:${measure} · staff ${signAt.staff ?? 0} · `
      + `box @${signAt.bbox.x.toFixed(1)}–${(signAt.bbox.x + signAt.bbox.width).toFixed(1)} · press @${x.toFixed(1)}`)
    return deps.pick({ kind: 'repeatStart', measure })
  },

  highlight: h => h.applyRepeatStartSelectionHighlight(),
}
