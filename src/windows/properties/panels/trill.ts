import { bus } from '@/bus'
import type { InspectedElement } from '@/interactions/selectionSnapshot'
import type { TrillContinuationLabel } from '@/types/music'
import { BISHOP, scalarOffsetRow } from '../rows'
import { liveId, type PanelRows } from './panel'

/**
 * A selected TRILL — its three ink offsets (the BRACKET's vertical rather than the pedal's, since
 * `x` flips a trill's side), then its one stored choice: how it labels a continuation system.
 */
export const trillRows: PanelRows = (element) => {
  const id = liveId(element)
  if (!id) return []
  const label = (element.data as { continuationLabel?: TrillContinuationLabel }).continuationLabel
  return [buildTrillOffsetRows(id, element), buildTrillLabelSelect(id, label ?? 'parenthesised')]
}

/**
 * ⭐⭐ **A TRILL'S INK: two horizontals and ONE vertical.** His ask, 2026-08-18 — the typed twin of
 * the arrows on the ornament's two squares.
 *
 * ⛔ **Not two point rows**, the family's rule: the `tr` and its wavy line are drawn on one
 * baseline, so two height boxes would offer two answers to a question the notation has one of.
 *
 * ⭐⭐ **The store is `outward` and the box speaks SCREEN** — the BRACKET's arrangement, ⛔ not the
 * pedal's. A trill's side is stored and `x` flips it, so a screen-signed field would turn a nudge
 * that meant *clear of the music* into a shove toward it; the model therefore keeps the intent and
 * this line converts. ⚠️ So the displayed number FLIPS SIGN when the ornament is flipped, which is
 * honest — the ink genuinely moved to the other side of the staff.
 */
function buildTrillOffsetRows(trillId: string, element: InspectedElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.margin = '2px 0 4px'
  const off = (element.overrides?.find((o) => o.kind === 'trillOffset') ?? {}) as {
    startX?: number
    endX?: number
    outward?: number
  }

  wrap.appendChild(scalarOffsetRow(
    'start x (sp)', off.startX ?? 0,
    'the tr sign, and the wavy line leaving it — + reaches right; the far end stays put',
    (x) => bus.trillGeometry.set({ trillId, which: 'start', x })))
  wrap.appendChild(scalarOffsetRow(
    'end x (sp)', off.endX ?? 0,
    'where the wavy line stops — + reaches right; the sign stays put',
    (x) => bus.trillGeometry.set({ trillId, which: 'end', x })))
  // ⭐ `+` is UP on screen whichever side the ornament is on — his standing rule for every offset
  // box. `toScreen` is its own inverse (a negation), so one helper does both directions.
  const above = ((element.data as { placement?: 'above' | 'below' }).placement ?? 'above') === 'above'
  const toScreen = (n: number) => (above ? n : -n)
  wrap.appendChild(scalarOffsetRow(
    'vertical (sp)', toScreen(off.outward ?? 0),
    'the WHOLE ornament — + moves it UP on screen and − moves it down, whichever side of the staff '
    + 'it is on. One number, because the sign and its line share a baseline',
    (up) => bus.trillGeometry.set({ trillId, outward: toScreen(up) })))
  return wrap
}

/**
 * ⭐ **How a trill labels itself on a CONTINUATION system** — the three real behaviours in the
 * field, offered as a choice because there is no single right one (see
 * {@link Trill.continuationLabel} for who does which, and docs/trill-plan.md §1 rule 6).
 *
 * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.trillEdit` and never touches the engine —
 * `TrillEditController` owns the apply, the same boundary the fan inputs keep.
 *
 * ⭐ It CHANGES a trill, never makes one. The row appears only on a selected trill; creating and
 * removing them is the Lines window and Delete.
 */
function buildTrillLabelSelect(trillId: string, current: TrillContinuationLabel): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = 'What a new system shows when this trill carries over from the previous one.'

  const caption = document.createElement('span')
  caption.textContent = 'on a new system'
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'

  // ⚠️ The labels say what is DRAWN, not who does it — a user picking one is choosing a picture,
  // not siding with a publisher. The provenance belongs in the docs, and is in them.
  const options: Array<[TrillContinuationLabel, string]> = [
    ['parenthesised', '(tr)'],
    ['plain', 'tr'],
    ['none', 'line only'],
  ]
  for (const [value, text] of options) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    if (value === current) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    bus.trillEdit.set({ trillId, continuationLabel: select.value as TrillContinuationLabel })
  })

  wrap.appendChild(select)
  return wrap
}
