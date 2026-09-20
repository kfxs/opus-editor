import { bus } from '@/bus'
import type { InspectedOf } from '@/interactions/state/inspectedElement'
import { wingsAllowed, type BarlineSignKind } from '@/engine/models/boundarySign'
import { BISHOP } from '../rows'
import type { PanelRows } from './panel'

/** The two kinds that name a LINE. */
type Line = 'barline' | 'repeatStart'

/**
 * ⭐⭐ A selected BARLINE or OPEN REPEAT gets the sign at its LINE — his ask, 2026-08-26: *"I was
 * expecting to change the type there"*, then *"since we can just select one barline there should be
 * an option for close+open case"*. Both selections name the same kind of thing (a line), so BOTH
 * kinds' rows in the table are this one panel; {@link boundaryOf} turns each into its boundary.
 */
export const barlineRows: PanelRows<Line> = (element) => {
  const boundary = boundaryOf(element)
  const sign = currentBarlineSign(element)
  return [
    buildBarlineSignSelect(boundary, sign),
    buildBarlineWingsCheckbox(boundary, sign, currentBarlineWinged(element)),
  ]
}

/**
 * ⭐⭐ **WHAT STANDS ON THIS LINE** — the barline chooser, and the only instrument that can reach the
 * back-to-back `:||:`.
 *
 * 🚨 **HIS ASK, 2026-08-26:** *"what about the properties when I selected a barline? I was expecting
 * to change the type there"*, then the shape of it: *"since we can just select one barline, there
 * should be an option for close+open case."* ⭐ That second sentence is the whole design. `:||:` is
 * two statements stored on two bars (ONE OWNER PER LINE, `barlineOps`), and a selection of one side
 * owns only its own half — so no per-bar control could ever offer it. This one names the **LINE**,
 * and `setBoundarySign` writes both owners as ONE undoable edit.
 *
 * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.barlineEdit` and never touches the engine —
 * `BarlineEditController` owns the apply, the same boundary every row in this panel keeps.
 *
 * ⭐ **A CONTENT edit**, like the hairpin's type and unlike the offsets below it: a repeat changes
 * what the player is told to do. The line's WIDTH and its gap are drawing, and keep their own
 * gestures (`Ctrl+←/→`, `Shift+←/→`).
 *
 * ⛔ **At the score's opening edge the list is TWO items**, not five greyed ones: nothing ends there,
 * so `|:` and "nothing" are the only statements sayable — a final bar at the start of a piece is not
 * a thing the model can hold, and offering it disabled would suggest it were merely unavailable.
 */
function buildBarlineSignSelect(endsMeasure: number | null, current: BarlineSignKind): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = endsMeasure === null
    ? 'What stands at the start of the score — a content edit, so it is undoable.'
    : 'What stands on this line — a content edit, so it is undoable.'

  const caption = document.createElement('span')
  caption.textContent = 'sign'
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'

  // ⚠️ The NAME and the SHAPE, like the hairpin's rows: the words are what a musician says and the
  //    ASCII is what is drawn. ⛔ `plain` reads "none", not "plain barline" — a bar always ends in a
  //    line, and what this list picks is the STATEMENT made on it, of which there may be none.
  const all: Array<[BarlineSignKind, string]> = [
    ['plain', 'none  |'],
    // ⭐ Between `none` and the signs, because that is what it is: an ordinary line, not engraved.
    ['invisible', 'invisible  ¦'],
    ['final', 'final  ‖'],
    ['repeatEnd', 'end repeat  :|'],
    ['repeatStart', 'open repeat  |:'],
    ['repeatBoth', 'end + open  :||:'],
  ]
  const options = endsMeasure === null
    ? all.filter(([value]) => value === 'plain' || value === 'repeatStart')
    : all
  for (const [value, text] of options) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    if (value === current) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    bus.barlineEdit.set({ endsMeasure, sign: select.value as BarlineSignKind })
  })

  wrap.appendChild(select)
  return wrap
}

/**
 * ⭐⭐ **WINGS** — the flared tips at the top and bottom of the sign's thick line, as a checkbox.
 *
 * 🚨 **HIS ASK, 2026-08-26, and the second half of it is the whole design:** *"the wings on
 * properties should be a checkbox, but the important thing is it should only be checkable when
 * wings are allowed — this is for open repeat, for end repeat and for final; other barlines do not
 * allow wings."*
 *
 * ⭐ **DISABLED rather than hidden**, and that is the difference from the chooser next door, which
 * drops its two impossible rows at the score's opening edge. A row that vanishes says *"this is not
 * a thing"*; a row that greys says *"this is a thing, but not for what you have selected"* — and
 * wings ARE a thing on three of the five signs, so the control has to stay where the eye last found
 * it while you change the sign above it. The `title` says why it is grey.
 *
 * ⚠️ The rule itself is `barlineSign.wingsAllowed`, read off the sign's PARTS: a sign with a thick
 * line can be winged, and a plain or invisible line has nothing to flare. ⛔ Not a list of sign
 * names here — that would be the same rule written twice, in the layer that draws none of it.
 *
 * The window stays a DUMB PUBLISHER: it writes to `bus.barlineEdit` and never touches the engine.
 */
function buildBarlineWingsCheckbox(
  endsMeasure: number | null, sign: BarlineSignKind, current: boolean,
): HTMLElement {
  const allowed = wingsAllowed(sign)
  const row = document.createElement('label')
  const rs = row.style
  rs.display = 'flex'
  rs.alignItems = 'center'
  rs.gap = '6px'
  rs.color = BISHOP
  rs.margin = '2px 0 4px'
  rs.cursor = allowed ? 'pointer' : 'default'
  // ⭐ Greyed as well as disabled: `:disabled` styles the box, not the word beside it.
  rs.opacity = allowed ? '1' : '0.45'
  row.title = allowed
    ? 'Flared tips at the top and bottom of the thick line — a house style, drawn on every staff.'
    : 'Only a sign with a thick line can be winged: a plain or invisible line has nothing to flare.'

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = current
  input.disabled = !allowed
  input.style.accentColor = BISHOP
  input.addEventListener('change', () => bus.barlineEdit.set({ endsMeasure, winged: input.checked }))
  row.appendChild(input)

  const label = document.createElement('span')
  label.textContent = 'wings'
  row.appendChild(label)
  return row
}

/**
 * ⭐ **WHICH BOUNDARY a barline selection names** — the bar whose ENDING line it is, or `null` for the
 * score's opening edge.
 *
 * The two selections are the same line seen from either side: `barline` already IS that measure, and
 * a `repeatStart` opening bar *M* stands on the line ending bar *M−1*. Total over the two kinds:
 * every barline selection resolves to a line, and the union is what says so.
 */
function boundaryOf(element: InspectedOf<Line>): number | null {
  if (element.kind === 'barline') return element.data.endsMeasure
  return element.data.opensMeasure > 1 ? element.data.opensMeasure - 1 : null
}

/**
 * The sign standing on the selected line, for the chooser to show as current.
 *
 * ⭐ Read from `derived.sign` — `selectionSnapshot` asks the DRAWING's own `signAtBoundary`, so the
 * panel and the page cannot disagree about what is there. ⛔ Not re-derived from `data`'s two stored
 * fields: that would be a third place computing the same precedence, and the one that would drift.
 *
 * ⚠️ A `repeatStart` selection has no `derived` — it is one stored statement and nothing is computed
 * from it — so the fallback is its own sign, which is what it is by definition.
 */
function currentBarlineSign(element: InspectedOf<Line>): BarlineSignKind {
  const derived = element.derived?.sign
  if (derived) return derived
  return element.kind === 'repeatStart' ? 'repeatStart' : 'plain'
}

/** Whether the sign on the selected line is drawn with wings — `derived`, like the sign itself, and
 *  for the same reason: the flag rides whichever statements are standing there, so it is a fact about
 *  the LINE that no single stored field answers. */
function currentBarlineWinged(element: InspectedOf<Line>): boolean {
  return element.derived?.winged === true
}
