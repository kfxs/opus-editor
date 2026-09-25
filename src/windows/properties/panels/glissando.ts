import { bus } from '@/bus'
import { buildSelect } from '../rows'
import type { PanelRows } from './panel'

/**
 * ⭐ A selected GLISSANDO's panel (docs/plans/glissando-plan.md, the later list). Three choices, each its own
 * row and its own publish (a PARTIAL request, the tuplet's shape):
 *   • **side** — AFTER (it leaves the note) or BEFORE (it comes INTO the note from nothing — a scoop, a plop);
 *   • **goes to** — the next note (found every time, G4) or nothing (a fall, a doit — G5). ⛔ Not for a line
 *     into the note: its far end is always free;
 *   • **direction** — ⭐ ONLY when an end is free (his ask, 2026-09-25: *"for gliss post with no target or for
 *     pre gliss we should be able to make also the direction"*): up or down.
 * A DUMB PUBLISHER: it writes to `bus.glissandoEdit` and never touches the engine.
 * ⏳ Not yet: the `gliss.` text and the wavy style — the drawing has neither, so the panel offers neither.
 */
export const glissandoRows: PanelRows<'glissandoLine'> = (element) => {
  const glissando = element.data.glissando
  if (!glissando) return []
  const publish = (edit: Omit<Parameters<typeof bus.glissandoEdit.set>[0], 'glissandoId'>) =>
    bus.glissandoEdit.set({ glissandoId: glissando.id, ...edit })
  const before = glissando.side === 'before'
  const free = before || glissando.end === 'none' || element.derived?.targetNoteId == null
  const rows: HTMLElement[] = [
    buildSelect('side', SIDES, before ? 'before' : 'after',
      'After: the line leaves the note. Before: it comes INTO the note from nothing (a scoop, a plop). Undoable.',
      value => publish({ side: value })),
  ]
  if (!before) {
    rows.push(buildSelect('goes to', ENDS, glissando.end === 'none' ? 'none' : 'next',
      'The next note (found again whenever the music changes), or nothing — a fall or a doit, even with a note after it. Undoable.',
      value => publish({ end: value })))
  }
  if (free) {
    const usual = before ? 'up' : 'down'
    rows.push(buildSelect('direction', DIRECTIONS, glissando.direction ?? usual,
      'Which way the free end goes — up or down. Undoable.',
      value => publish({ direction: value })))
  }
  return rows
}

const SIDES: Array<['after' | 'before', string]> = [
  ['after', 'after the note'],
  ['before', 'before the note (into it)'],
]
const ENDS: Array<['next' | 'none', string]> = [
  ['next', 'the next note'],
  ['none', 'nothing (free end)'],
]
const DIRECTIONS: Array<['up' | 'down', string]> = [
  ['up', 'up'],
  ['down', 'down'],
]
