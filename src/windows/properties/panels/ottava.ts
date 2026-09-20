import { bus } from '@/bus'
import type { InspectedOf } from '@/interactions/state/inspectedElement'
import type { Ottava, OttavaOffsetOverride } from '@/types/music'
import { scalarOffsetRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/** A selected OTTAVA — its ink offsets as numbers, the typed twin of the arrows on its two squares. */
export const ottavaRows: PanelRows<'ottava'> = (element) => {
  const ottava = live(element.data)
  return ottava ? [buildOttavaOffsetRows(ottava, element)] : []
}

/**
 * ⭐⭐ **AN OCTAVE BRACKET'S INK, AS THE MODEL SHAPES IT: two horizontals and ONE height.**
 * His ask, 2026-08-17 — the typed twin of the arrows on the bracket's two endpoint squares.
 *
 * ⛔ **Not two point rows.** The obvious layout — copy the hairpin's `start (x, y)` / `end (x, y)`
 * — would offer two heights for a mark that has one, and the two boxes could then disagree about
 * it. A bracket is a straight horizontal rule: `OttavaOffsetOverride` carries `startX`, `endX` and
 * a single `y`, and the panel showing exactly that is how a reader learns the rule. The keyboard
 * says the same thing in its own way — ↑ from EITHER square lifts the whole line.
 *
 * ⭐ **0 is the automatic position**, so the boxes show `0` rather than a blank "auto" — unlike the
 * wedge's mouth, whose automatic is a computed width that no number stands for. `reset` therefore
 * publishes 0 through the same seam, and the model's zero-pruning drops the entry.
 *
 * ⚠️ Every box commits through {@link commitOnFirstStep} and puts itself back on commit — the two
 * rules the page limit forced on this panel (docs/plans/engraving-overrides-plan.md §8.6).
 */
function buildOttavaOffsetRows(ottava: Ottava, element: InspectedOf<'ottava'>): HTMLElement {
  const ottavaId = ottava.id
  const wrap = document.createElement('div')
  wrap.style.margin = '2px 0 4px'
  const off = overrideOf<OttavaOffsetOverride>(element, 'ottavaOffset')


  wrap.appendChild(scalarOffsetRow(
    'start x (sp)', off?.startX ?? 0,
    'the numeral and the line leaving it — + reaches right; the far end stays put',
    (x) => bus.ottavaGeometry.set({ ottavaId, which: 'start', x })))
  wrap.appendChild(scalarOffsetRow(
    'end x (sp)', off?.endX ?? 0,
    'the closing hook — + reaches right; the numeral stays put',
    (x) => bus.ottavaGeometry.set({ ottavaId, which: 'end', x })))
  // ⭐⭐ **THE BOX SPEAKS SCREEN: + IS UP, ALWAYS.** His rule, 2026-08-17, after trying both:
  // *"for me, increasing the number is go up and decreasing go down always… the arrow of the
  // properties should reflect the movement on screen — intuitive UX."*
  //
  // ⭐ The MODEL stores `outward` — a distance from the staff — for a reason that is not about the
  // UI at all: `x` flips an ottava's direction, and a screen-signed field would turn a nudge that
  // meant "clear of the music" into a shove toward it (see `OttavaOffsetOverride`). Both facts are
  // true at once, and this line is where they meet: the store keeps the intent, the box shows the
  // movement. ⚠️ So the displayed number FLIPS SIGN when the bracket is flipped — which is honest,
  // because the ink genuinely moved to the other side of the staff.
  const above = ottava.shift > 0
  const toScreen = (n: number) => (above ? n : -n)
  wrap.appendChild(scalarOffsetRow(
    // ⚠️ Named for the AXIS, not the direction — his call: *"instead of up, better something like
    // vertical position."* `up` read as a verb, and it sits beside two rows named for an axis.
    // Which way `+` goes is the tooltip's job, and the tooltip is unambiguous.
    'vertical (sp)', toScreen(off?.outward ?? 0),
    'the WHOLE bracket — + moves it UP on screen and − moves it down, whichever side of the staff '
    + 'it is on. One number, because an octave line is a straight rule',
    // ⭐ `toScreen` is its own inverse (a negation), so one helper does both directions.
    (up) => bus.ottavaGeometry.set({ ottavaId, outward: toScreen(up) })))
  return wrap
}
