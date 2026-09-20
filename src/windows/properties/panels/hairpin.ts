import { bus } from '@/bus'
import type { InspectedElement } from '@/interactions/selectionSnapshot'
import type { Hairpin } from '@/types/music'
import { BISHOP, buildNumberRow, buildPointRow } from '../rows'
import { liveId, type PanelRows } from './panel'

/**
 * ⭐ A selected HAIRPIN — WHICH WAY IT OPENS first, because that is the wedge's MUSIC (his ask,
 * 2026-08-22), then its two ENDS and its mouth as numbers, which are its drawing. ⛔ No box for the
 * extent: that is musical and has its own gestures (`bus/hairpinGeometrySelection` says why a
 * staff-space box is the wrong instrument for it).
 */
export const hairpinRows: PanelRows = (element) => {
  const id = liveId(element)
  if (!id) return []
  const type = (element.data as { type?: Hairpin['type'] }).type ?? 'cresc'
  return [buildHairpinTypeSelect(id, type), buildHairpinEndRows(id, element)]
}

/**
 * ⭐⭐ **WHICH WAY THE WEDGE OPENS** — his ask, 2026-08-22: *"be able in a dropdown in the property
 * to change the hairpin type"*. `crescendo` opens to the right, `diminuendo` closes to it.
 *
 * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.hairpinEdit` and never touches the engine —
 * `HairpinEditController` owns the apply, the same boundary the trill and fan rows keep.
 *
 * ⭐ **A CONTENT edit, unlike everything below it in this panel.** The end nudges and the mouth are
 * drawing, kept in the overrides compartment; which way a wedge opens is what the player is told to
 * do and playback reads it — so it goes through the model and takes an undo entry. Two questions,
 * two seams (`bus/hairpinEditSelection` states the split).
 *
 * ⭐ It CHANGES a wedge, never makes one — the Lines window and Delete own that, exactly as for the
 * trill's row. And `x` on a selected hairpin still flips it (`interactions/flipSelection`): one
 * fact, two instruments, which is this editor's ordinary shape.
 */
function buildHairpinTypeSelect(hairpinId: string, current: Hairpin['type']): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = 'Which way the wedge opens — a content edit, so it is undoable and playback reads it.'

  const caption = document.createElement('span')
  caption.textContent = 'type'
  wrap.appendChild(caption)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'

  // ⚠️ The word AND the shape: the name is what a musician says and the wedge is what is drawn, and
  //    a panel that offered only `cresc`/`dim` would make the reader translate its own model.
  const options: Array<[Hairpin['type'], string]> = [
    ['cresc', 'crescendo  <'],
    ['dim', 'diminuendo  >'],
  ]
  for (const [value, text] of options) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    if (value === current) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => {
    bus.hairpinEdit.set({ hairpinId, type: select.value as Hairpin['type'] })
  })

  wrap.appendChild(select)
  return wrap
}

/**
 * ⭐ **THE WEDGE'S TWO ENDS, AS NUMBERS** — one row each, x/y in staff-spaces plus a reset,
 * publishing to {@link bus.hairpinGeometry}; `HairpinGeometryController` applies.
 *
 * ⭐ **The RESHAPE, not the extent.** `+x` reaches that end further along the wedge and `+y` moves
 * it down, so a `y` on one end tilts the wedge and a `y` on both lifts it off the dynamics line —
 * all of it drawing, none of it music. How many notes the wedge covers is the model's, and this
 * panel deliberately offers no box for it: that quantity is measured in notes, and its instruments
 * are `Ctrl+Shift+←/→` and dragging the square.
 *
 * Blank means the engraver's own position (see {@link buildPointRow}) — not zero, which here would
 * be a hand-authored "exactly where it already was".
 */
function buildHairpinEndRows(hairpinId: string, element: InspectedElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.margin = '2px 0 4px'
  const offsets = (element.overrides?.find((o) => o.kind === 'hairpinEndpointOffset') ?? {}) as {
    start?: { x: number; y: number }
    end?: { x: number; y: number }
  }
  for (const which of ['start', 'end'] as const) {
    wrap.appendChild(buildPointRow(`${which} (sp)`, offsets[which], (value) =>
      bus.hairpinGeometry.set({ hairpinId, which, value })))
  }
  // …and the MOUTH — one number for the whole wedge, so a row of its own rather than a third point.
  //
  // ⭐⭐ **It shows the EFFECTIVE aperture, authored or not** (his correction, 2026-08-17: *"if i'm
  // in auto and increase i don't start from 0, i start from current value and increase"*). A blank
  // box would have made the first press of a spinner jump to the minimum, which is the opposite of
  // a nudge. So the number on screen is what is on the page, and `reset` is what says "go back to
  // automatic" — the distinction the model keeps (absent vs authored) is reported in the row's
  // title and in the overrides dump below, not by an empty box.
  //
  // ⚠️ Its BOUNDS come from the snapshot, not from a constant here: the upper one depends on the
  // wedge's DRAWN length through the steepness cap (`authoredApertureRange`), so on a short wedge it
  // is well under the engine's nominal maximum. Offering a number the renderer would silently pull
  // back is a control that lies about what it did.
  const mouth = element.derived?.mouth as
    { value: number; authored: boolean; min: number; max: number } | null | undefined
  if (mouth) {
    wrap.appendChild(buildNumberRow(
      // ⭐ A 0.05-space step: the whole authorable range is half a space wide (1.5–2.0 at ordinary
      // lengths), so a quarter-space step would offer three stops in it.
      'mouth (sp)', mouth.value, 0.05, mouth.min, mouth.max,
      (aperture) => bus.hairpinGeometry.set({ hairpinId, aperture }),
      mouth.authored
        ? `how far the wedge opens — yours; reset returns it to the automatic width (${mouth.min}–${mouth.max})`
        : `how far the wedge opens — currently the automatic width for its length (${mouth.min}–${mouth.max})`,
    ))
  }
  return wrap
}
