import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { activeVoiceToModel } from '../state/EditorState'
import { keyboardCaretAt } from './keyboardCaret'
import { voiceFillColor } from '../../utils/voiceColors'
import type { HighlightContext } from '../elements/highlightContext'

/**
 * Applies SVG highlight classes/colors after each render.
 * Framework-agnostic: operates on standard DOM APIs, no Vue/React/Angular imports.
 */
export class HighlightController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
  ) {}

  /**
   * The inverse of everything the last highlight pass did to the DOM, newest last.
   *
   * Highlights used to reset themselves by being wiped along with the SVG — the code said so
   * out loud: *"Safe: the next render rebuilds the SVG."* Once a selection change stops
   * redrawing the score (docs/history/render-performance-plan.md §5a) that reset is gone, so every
   * mutation needs a real inverse. Nothing here touches the DOM directly any more; it goes
   * through the helpers below, and each records how to undo itself.
   */
  private undoLog: Array<() => void> = []

  /** Set an attribute, remembering its PREVIOUS value — not "remove it on clear". Voice 2's
   *  noteheads are green by default, so a naive `removeAttribute('fill')` would blacken them. */
  private setAttr(el: Element, name: string, value: string): void {
    const prev = el.getAttribute(name)
    this.undoLog.push(() => (prev === null ? el.removeAttribute(name) : el.setAttribute(name, prev)))
    el.setAttribute(name, value)
  }

  /** The same, for an inline style property — the colours are set both ways (attribute and
   *  `style`), because the two have different precedence against the stylesheet. */
  private setStyleProp(el: SVGElement, name: string, value: string): void {
    const prev = el.style.getPropertyValue(name)
    this.undoLog.push(() => (prev ? el.style.setProperty(name, prev) : el.style.removeProperty(name)))
    el.style.setProperty(name, value)
  }

  private addClass(el: Element, cls: string): void {
    if (el.classList.contains(cls)) return
    this.undoLog.push(() => el.classList.remove(cls))
    el.classList.add(cls)
  }

  /** Append a node the highlight layer OWNS (keyboard cursor, paste caret, measure box, slur
   *  handle) — as opposed to recolouring an engraved one. */
  private addNode(parent: Element, node: Element): void {
    this.undoLog.push(() => node.remove())
    parent.appendChild(node)
  }

  /** Raise a group above a coincident sibling so the recoloured glyph is the one that paints:
   *  unison noteheads, two voices' rests nudged to the same spot, overlapping tuplet brackets.
   *  Restores the original sibling position on clear — the reorder only means anything while
   *  the element is selected, and leaving it would slowly permute the SVG. */
  private raiseToFront(group: Element): void {
    const parent = group.parentNode
    if (!parent || parent.lastChild === group) return
    const next = group.nextSibling
    this.undoLog.push(() => { parent.insertBefore(group, next) })
    parent.appendChild(group)
  }

  /**
   * ⭐ What a kind's `highlight` row is handed (`elements/highlightContext`): the toolkit above, bound
   * to THIS layer's undo log, plus what every painter began by fetching. Null when there is nothing
   * to paint on — no engine, or no score SVG yet.
   */
  context(): HighlightContext | null {
    const engine = this.getEngine()
    const svg = this.getScoreCanvas()?.querySelector('svg')
    if (!engine || !svg) return null
    return {
      engine,
      svg,
      state: this.state,
      registry: engine.getElementRegistry(),
      setAttr: (el, name, value) => this.setAttr(el, name, value),
      setStyleProp: (el, name, value) => this.setStyleProp(el, name, value),
      addClass: (el, cls) => this.addClass(el, cls),
      addNode: (parent, node) => this.addNode(parent, node),
      raiseToFront: group => this.raiseToFront(group),
    }
  }

  /**
   * Undo the last highlight pass **in place**. This is what a skipped render calls instead of
   * rebuilding the SVG: the engraving underneath is already correct, so only the highlight
   * layer has to be taken back off before the new selection is painted on.
   */
  clearHighlights(): void {
    for (let i = this.undoLog.length - 1; i >= 0; i--) this.undoLog[i]()
    this.undoLog.length = 0
    // Slur handles register their own hit-boxes after the render, and a skipped render no
    // longer clears the registry for them — so the highlight pass removes its own entries.
    const registry = this.getEngine()?.getElementRegistry()
    registry?.removeByType('slur-handle')
    registry?.removeByType('slur-endpoint')
    registry?.removeByType('slur-segment-endpoint')
    registry?.removeByType('hairpin-endpoint')
    registry?.removeByType('ottava-endpoint')
    registry?.removeByType('pedal-endpoint')
    registry?.removeByType('pedal-tether')
    registry?.removeByType('trill-endpoint')
    registry?.removeByType('barline-join')
    registry?.removeByType('staff-group-handle')
  }

  /** A full redraw already threw the old SVG away, so the log's targets are detached nodes:
   *  drop it WITHOUT running it. (Running it would be harmless but pointless work.) */
  discardHighlights(): void {
    this.undoLog.length = 0
  }

  /**
   * Draw a vertical cursor line on the staff AFTER the currently selected note,
   * indicating where the next keyboard entry will land (like Sibelius's blue cursor).
   */
  applyKeyboardCursor(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (this.state.selectedTool !== 'entry' || !this.state.selectedNoteId || !engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const registry = engine.getElementRegistry()
    const caret = keyboardCaretAt(engine, this.state.selectedNoteId, activeVoiceToModel(this.state.activeVoice), this.state.activeStaff)
    if (!caret) return
    const { x: cursorX, measure: cursorMeasure } = caret

    // The cursor draws on the active staff's lines (the note it advances from lives there).
    const staffGeometry = registry.getStaffGeometry(cursorMeasure, this.state.activeStaff)
    if (!staffGeometry) return

    const topY = staffGeometry.lineYPositions[0]
    const bottomY = staffGeometry.lineYPositions[4]

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(cursorX))
    line.setAttribute('y1', String(topY - 6))
    line.setAttribute('x2', String(cursorX))
    line.setAttribute('y2', String(bottomY + 6))
    // Cursor paints in the active voice's colour (V1 blue, V2 green).
    line.setAttribute('stroke', voiceFillColor(activeVoiceToModel(this.state.activeVoice)))
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('class', 'keyboard-cursor')
    this.addNode(svg, line)
  }

}
