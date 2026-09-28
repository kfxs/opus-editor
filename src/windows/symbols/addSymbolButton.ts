import { bus } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'
import { CHROME } from '../../utils/chromeColors'

/**
 * ⭐ **ADD SYMBOL — the Symbols window's one control that touches the score** (docs/plans/symbol-plan.md P2).
 * It is live when two things hold: a glyph is picked in the chart, and the score's selection is exactly
 * ONE note or rest. A click publishes *"this glyph onto that event"* on `bus.glyphMarkAdd`; the controller
 * that holds the engine applies it (`GlyphMarkController`), so the window stays a dumb publisher — and
 * then the window CLOSES (his call, 2026-09-28): a second symbol is a second `z`.
 *
 * ⚠️ It reads the selection from `bus.inspection` — the snapshot the Properties window paints — so it
 * agrees with what that window shows. A note is any head of a chord: the symbol is the chord's.
 */

/** The note or rest a symbol would go on, or null when the selection is not exactly one of them. */
export function symbolTarget(elements: readonly InspectedElement[]): string | null {
  if (elements.length !== 1) return null
  const [el] = elements
  if (el.kind !== 'note' && el.kind !== 'rest') return null
  if ('missing' in el.data) return null
  return el.data.id
}

/** Why the button is off — its tooltip, so a greyed button never reads as broken. Null when it is on. */
export function whyDisabled(glyph: string | null, target: string | null): string | null {
  if (glyph === null) return 'Pick a glyph in the chart first'
  if (smuflGlyph(glyph) === null) return 'This glyph draws no ink in the music font, so it cannot be placed'
  if (target === null) return 'Select one note or rest in the score to put the symbol on'
  return null
}

export class AddSymbolButton {
  /** @param onAdded runs after a click has published its request — the window closes on it (his call,
   *  2026-09-28: *"after pushing the button the symbol window must close"*). */
  constructor(private readonly onAdded: () => void = () => {}) {}

  private button: HTMLButtonElement | null = null
  private glyph: string | null = null
  private target: string | null = null
  private unsubscribe: (() => void) | null = null

  mount(host: HTMLElement): void {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Add symbol'
    button.style.padding = '5px 10px'
    button.style.borderRadius = '4px'
    button.style.border = `1px solid ${CHROME.edge}`
    button.style.background = 'transparent'
    button.style.color = CHROME.ink
    button.style.font = 'inherit'
    button.style.fontSize = '12px'
    button.addEventListener('click', () => {
      if (this.glyph === null || this.target === null || whyDisabled(this.glyph, this.target) !== null) return
      bus.glyphMarkAdd.set({ noteId: this.target, glyph: this.glyph })
      this.onAdded()
    })
    host.appendChild(button)
    this.button = button
    this.target = symbolTarget(bus.inspection.get())
    this.unsubscribe = bus.inspection.onChange(elements => {
      this.target = symbolTarget(elements)
      this.paint()
    })
    this.paint()
  }

  /** The glyph picked in the chart — null when none is. */
  setGlyph(name: string | null): void {
    this.glyph = name
    this.paint()
  }

  destroy(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.button = null
  }

  private paint(): void {
    const button = this.button
    if (!button) return
    const reason = whyDisabled(this.glyph, this.target)
    button.disabled = reason !== null
    button.title = reason ?? 'Put this symbol above the selected note or rest'
    button.style.opacity = reason === null ? '1' : '0.45'
    button.style.cursor = reason === null ? 'pointer' : 'default'
  }
}
