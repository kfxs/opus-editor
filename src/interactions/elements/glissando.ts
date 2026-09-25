/**
 * ⭐ A GLISSANDO's LINE as a selectable element (docs/plans/glissando-plan.md P4): a press on the stroke
 * selects it, the selection paints it, Delete removes it (`shortcutWiring.deleteSelected`).
 *
 * Hit-tested against the drawn STROKE — each registered piece's two ends (`GlissandoRenderer`), like the
 * tie's sampled arc: ⛔ not its box, which for a steep line is mostly air beside the notes.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import { distToSegment } from './slur'

/**
 * How near the stroke a press must land, px — WIDE along the line (his ask, 2026-09-25: *"the user has to be
 * very precise"*), NARROW near its two ends, where the line stands a fraction of a space from a notehead and a
 * wide catch would steal a press meant for the note.
 */
const PAD = 8
const PAD_AT_ENDS = 4

export const GLISSANDO_ELEMENT: ClickableElementSpec = {
  kind: 'glissandoLine',
  hit({ registry, x, y }, deps) {
    const hit = registry.getByType('glissando').find(el => {
      const [a, b] = el.points ?? []
      if (!a || !b) return false
      const nearEnd = Math.hypot(x - a.x, y - a.y) < PAD || Math.hypot(x - b.x, y - b.y) < PAD
      return distToSegment(x, y, a, b) <= (nearEnd ? PAD_AT_ENDS : PAD)
    })
    if (!hit?.id) return false
    dbg(`✓ Glissando selected | id:${hit.id}`)
    return deps.pick({ kind: 'glissandoLine', id: hit.id })
  },
  highlight: paintSelectedGlissando,
}

/** Colour the selected glissando's own group — every piece — in its anchor note's voice colour. */
export function paintSelectedGlissando(ctx: HighlightContext): void {
  const id = selectedOf(ctx.state, 'glissandoLine')?.id
  if (!id) return
  const anchor = ctx.engine.glissando.byId(id)?.noteId
  paintGlissandoGroup(ctx, id, voiceFillColor((anchor && ctx.engine.getNote(anchor)?.voice) || 0))
}

/**
 * ⭐ Colour the glissando a selected NOTE carries (his ask, 2026-09-25: *"if a note that has a gliss is selected
 * we have to highlight the gliss too"*) — the tie's arrangement (`paintNoteTie`): called by the note's own
 * highlight (`./notePaint`), so a selected note reads as fully selected. No-op for a note without one.
 */
export function paintNoteGlissando(ctx: HighlightContext, noteId: string, color: string): void {
  // ⚠️ `?.`: the note-highlight specs stand up hand-made engine stubs that carry no glissando family (the
  //   `commandContext` `registry?.()` precedent) — and "no glissando here" is exactly their answer.
  const glissando = ctx.engine.glissando?.on(noteId)
  if (glissando) paintGlissandoGroup(ctx, glissando.id, color)
}

/** Colour one glissando's drawn group — every stroke, both pieces of a broken one. */
function paintGlissandoGroup(ctx: HighlightContext, id: string, color: string): void {
  const group = ctx.svg.querySelector(`[id="glissando-${id}"]`)
  if (!group) return
  group.querySelectorAll('path').forEach(path => {
    ctx.setAttr(path, 'stroke', color)
    ctx.setStyleProp(path as SVGElement, 'stroke', color)
  })
}
