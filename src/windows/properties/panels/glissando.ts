import { bus } from '@/bus'
import { BISHOP, buildSelect } from '../rows'
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
 * ⭐ And **text** — the word along the line (`gliss.`, `port.`, free text), off by default, drawn only where it fits.
 * ⏳ Not yet: the wavy style — the drawing has none, so the panel offers none.
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
  // ⭐ The WORD along the line — off by default (his brief); presets offered, anything may be typed. Drawn
  //   only where the line is long enough to hold it.
  rows.push(buildTextRow('text', glissando.text ?? '', TEXT_PRESETS,
    'The word along the line — gliss., port., or anything you type; empty for none. Drawn only where the line is long enough. Undoable.',
    value => publish({ text: value })))
  if (free) {
    const usual = before ? 'up' : 'down'
    rows.push(buildSelect('direction', DIRECTIONS, glissando.direction ?? usual,
      'Which way the free end goes — up or down. Undoable.',
      value => publish({ direction: value })))
  }
  return rows
}

/** The words the books and the engines use (Gould p. 140, Stone p. 296 — `port.` is the same line). */
const TEXT_PRESETS = ['gliss.', 'port.', 'glissando']

let datalistCount = 0

/** A captioned free-text row with SUGGESTIONS (a `<datalist>`), committed on Enter or when it loses focus. */
function buildTextRow(
  caption: string, current: string, suggestions: string[], title: string, onCommit: (value: string) => void,
): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = title
  const label = document.createElement('span')
  label.textContent = caption
  wrap.appendChild(label)
  const input = document.createElement('input')
  input.type = 'text'
  input.value = current
  input.placeholder = 'none'
  const is = input.style
  is.font = 'inherit'
  is.color = BISHOP
  is.background = 'transparent'
  is.border = `1px solid ${BISHOP}`
  is.borderRadius = '2px'
  is.padding = '1px 4px'
  is.width = '9em'
  const list = document.createElement('datalist')
  list.id = `glissando-text-presets-${++datalistCount}`
  for (const word of suggestions) {
    const option = document.createElement('option')
    option.value = word
    list.appendChild(option)
  }
  input.setAttribute('list', list.id)
  let committed = current
  const commit = () => {
    if (input.value === committed) return
    committed = input.value
    onCommit(input.value)
  }
  input.addEventListener('change', commit)
  input.addEventListener('keydown', event => { if (event.key === 'Enter') commit() })
  wrap.appendChild(input)
  wrap.appendChild(list)
  return wrap
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
