/**
 * A CLEF CHANGE — the glyph at the start of a bar, or mid-bar where one was dropped.
 *
 * First in the priority chain: it is a big glyph in its own column, so nothing else competes for
 * those pixels, and asking it first costs one array scan.
 */
import { dbg } from '@/utils/debug'
import { staffOf } from '@/utils/lanes'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../EditorState'
import { paintGlyphsInBBox } from './headerGlyphs'
import { beginClefDrag } from '../drags/clef'
import { CLEF_KEYS } from './clefKeys'

export const CLEF_ELEMENT: ClickableElementSpec = {
  kind: 'clef',
  /** Select a clef glyph for removal, and arm a horizontal drag for movable clefs. */
  hit({ event, registry, x, y }, deps) {
    // Clef change selection — click a clef glyph to select it for removal.
    //
    // ⭐ Painted lanes only. An opening clef is registered by TIER 1, which runs for every bar in
    // the score, so a bar scrolled out of the cull window keeps a clef box with no glyph under it —
    // the same trap the barline had (`ElementRegistry.painted`). A press may only reach ink.
    const clefAt = registry.getByType('clef').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
        && el.measure !== undefined && registry.isPainted(el.measure, staffOf(el))
    }) ?? null
    if (clefAt?.measure === undefined) return false

    const isProtected = clefAt.measure === 1 && (clefAt.beat ?? 0) === 0
    dbg(`✓ Clef selected | measure:${clefAt.measure} beat:${clefAt.beat ?? 0}${isProtected ? ' (measure 1 opening: change only, cannot remove)' : ''}`)

    return deps.pick(
      { kind: 'clef', measure: clefAt.measure, beat: clefAt.beat ?? 0, staff: staffOf(clefAt) },
      () => deps.arm(door => beginClefDrag(door.host, door.state, clefAt, door.slotBeatAt), event),
    )
  },

  highlight: paintSelectedClef,
  keys: CLEF_KEYS,
}

export function paintSelectedClef(ctx: HighlightContext): void {
  const engine = ctx.engine
  const selected = selectedOf(ctx.state, 'clef')
  if (!selected) return

  const registry = engine.getElementRegistry()
  const targetBeat = selected.beat
  // Scope by staff — clef is per-staff, so at (measure, beat) each stacked staff has
  // its own opening-clef element. Matching on measure+beat alone highlights the first
  // (staff 0) regardless of which staff's clef was actually selected.
  const clefEl = registry.getByType('clef').find(
    el => el.measure === selected.measure && (el.beat ?? 0) === targetBeat
      && staffOf(el) === selected.staff,
  )
  if (!clefEl) return

  const svg = ctx.svg

  // Scope the scan to the selected measure's own group so the recolor can't reach a
  // neighbour's clef; fall back to the whole SVG only if the group can't be resolved.
  const root = engine.getMeasureSVGGroup(clefEl.measure ?? 0, staffOf(clefEl)) ?? svg
  // The clef glyph is a filled path/text near the measure's left edge.
  paintGlyphsInBBox(ctx, root, clefEl.bbox, 'selected-clef')
}
