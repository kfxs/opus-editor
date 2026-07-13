import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import { navBeatMap } from '../utils/beatMap'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'

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
   * redrawing the score (docs/render-performance-plan.md §5a) that reset is gone, so every
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

    const score = engine.getScore()
    const registry = engine.getElementRegistry()
    // Cursor follows the active voice's stream ON the active staff (matches
    // enterNoteAtCursorPosition).
    const { allFlat, beats } = navBeatMap(score, this.state.selectedNoteId, activeVoiceToModel(this.state.activeVoice), this.state.activeStaff)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    const nextBeat = beats[currentIndex + 1]

    let cursorX: number
    let cursorMeasure: number

    if (nextBeat) {
      const nextInfo = engine.getElementById(nextBeat.id)
      if (!nextInfo) return
      cursorX = nextInfo.bbox.x
      cursorMeasure = nextBeat.measureNumber
    } else {
      const currentInfo = engine.getElementById(this.state.selectedNoteId)
      if (!currentInfo) return
      cursorX = currentInfo.bbox.x + currentInfo.bbox.width
      cursorMeasure = currentNote.measureNumber
    }

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

  /**
   * Draw a colored caret at the hovered position while a paste is armed (no
   * selection): a dashed green vertical line spanning the hovered measure's staff,
   * signalling "click here to drop the pasted material". Cleared by the next render.
   */
  drawPasteCaret(coords: { x: number; y: number }): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const measure = engine.pixelToMeasure(coords)
    const geometry = engine.getElementRegistry().getStaffGeometry(measure)
    if (!geometry) return

    const topY = geometry.lineYPositions[0]
    const bottomY = geometry.lineYPositions[4]

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(coords.x))
    line.setAttribute('y1', String(topY - 10))
    line.setAttribute('x2', String(coords.x))
    line.setAttribute('y2', String(bottomY + 10))
    line.setAttribute('stroke', '#10B981')
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-dasharray', '4 3')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('class', 'paste-caret')
    this.addNode(svg, line)
  }

  /**
   * Draw the Sibelius-style blue box around the measure span in state.selectedMeasureRange.
   * In first-voice blue with no fill; `state.selectedMeasureBoxStyle` picks the look:
   *   - `'single'` — ONE rectangle: the plain-click passage selection, whose contents
   *     (notes/rests + enclosed dynamics/slurs) ARE selected and highlighted separately.
   *   - `'double'` — two nested rectangles: the Ctrl+Shift+click marker (visual only, NO
   *     objects selected).
   * Redrawn every render and wiped with the SVG on the next one.
   */
  applyMeasureBox(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const range = this.state.selectedMeasureRange
    if (range == null || !engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const lo = Math.min(range.anchor, range.focus)
    const hi = Math.max(range.anchor, range.focus)
    const registry = engine.getElementRegistry()

    // Group the span's measures by system line (shared measureY) so a passage that wraps
    // across a line break draws one box per line — the box ends at the line edge and
    // resumes on the next, exactly like Sibelius. Each line's box hugs min→max x and a
    // little above/below the staff so it clears ledger-heavy notes.
    //
    // Vertical extent depends on the box style (they are different operations):
    //   - 'single' (plain-click passage select) → ONE staff's band, the staff the click
    //     landed on (`selectedMeasureStaff`); a content selection on that staff.
    //   - 'double' (Ctrl+Shift measure select) → the whole measure COLUMN across EVERY
    //     staff (staff 0's top → the last staff's bottom), because add/remove-measure is a
    //     system-wide edit that hits all staves. At N=1 both collapse to the single staff.
    const isSingle = this.state.selectedMeasureBoxStyle === 'single'
    const staffCount = engine.getScore().staves?.length ?? 1
    const lines = new Map<number, { left: number; right: number; top: number; bottom: number }>()
    for (let m = lo; m <= hi; m++) {
      const rect = engine.getMeasureRect(m)
      if (!rect) continue
      const topGeo = isSingle
        ? (registry.getStaffGeometry(m, this.state.selectedMeasureStaff) ?? registry.getStaffGeometry(m, 0))
        : registry.getStaffGeometry(m, 0)
      const bottomGeo = isSingle
        ? topGeo
        : (registry.getStaffGeometry(m, staffCount - 1) ?? registry.getStaffGeometry(m, 0))
      if (!topGeo || !bottomGeo) continue
      const top = topGeo.lineYPositions[0] - 12
      const bottom = bottomGeo.lineYPositions[4] + 12
      const key = Math.round(rect.y)
      const seg = lines.get(key)
      if (seg) {
        seg.left = Math.min(seg.left, rect.x)
        seg.right = Math.max(seg.right, rect.x + rect.width)
        seg.top = Math.min(seg.top, top)
        seg.bottom = Math.max(seg.bottom, bottom)
      } else {
        lines.set(key, { left: rect.x, right: rect.x + rect.width, top, bottom })
      }
    }

    const color = voiceFillColor(0) // first-voice blue (#3B82F6)
    const GAP = 3 // inset between the two nested rectangles = the "double box"
    // A plain-click passage selection draws ONE rectangle (Sibelius's single light-blue
    // box); the Ctrl+Shift+click visual marker draws two nested ones (the "double box").
    const insets = this.state.selectedMeasureBoxStyle === 'single' ? [0] : [0, GAP]
    for (const seg of lines.values()) {
      for (const inset of insets) {
        const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        box.setAttribute('x', String(seg.left + inset))
        box.setAttribute('y', String(seg.top + inset))
        box.setAttribute('width', String(Math.max(0, seg.right - seg.left - inset * 2)))
        box.setAttribute('height', String(Math.max(0, seg.bottom - seg.top - inset * 2)))
        box.setAttribute('fill', 'none')
        box.setAttribute('stroke', color)
        box.setAttribute('stroke-width', '1.5')
        box.setAttribute('class', 'measure-box')
        this.addNode(svg, box)
      }
    }
  }

  applySelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Highlight every selected note in ITS voice's colour (V1 blue, V2 green —
    // Sibelius-style; replaces the old uniform orange for notes/rests). Each is
    // recolored inside its own SVG group, so N highlights is the single-note
    // highlight applied N times (no cross-bleed).
    for (const item of this.state.selectedItems.values()) {
      if (item.kind !== 'note') continue
      const voice = engine.getNote(item.id)?.voice ?? 0
      this.highlightNote(item.id, voiceFillColor(voice), voiceStrokeColor(voice))
    }
  }

  /** Recolor one note's notehead + stem (or a rest's glyph) inside its own SVG group.
   *  Colors default to the selection orange; callers (e.g. a slur-endpoint snap target)
   *  may pass distinct fill/stroke to mark a different intent. */
  private highlightNote(
    noteId: string,
    fillColor = '#F59E0B',
    strokeColor = '#D97706',
  ): void {
    const engine = this.getEngine()
    if (!engine) return

    // Recolor the note's OWN rendered SVG group, never a document-wide region. VexFlow
    // draws each StaveNote's ledger lines, stem and noteheads inside one
    // `<g class="vf-stavenote">`, so confining the recolor to that group makes the
    // selection highlight bleed-free in both directions (the old approach scanned a
    // synthetic band that overlapped the staff line above or below).
    const groupInfo = engine.getStaveNoteSVGGroup(noteId)
    if (!groupInfo) return
    const { group, noteIndex, stem } = groupInfo

    const isRest = engine.getElementById(noteId)?.type === 'rest'

    const SELECTION_COLOR = fillColor
    const SELECTION_STROKE = strokeColor

    const colorFill = (el: Element) => {
      const svgEl = el as SVGElement
      this.setAttr(svgEl, 'fill', SELECTION_COLOR)
      this.setStyleProp(svgEl, 'fill', SELECTION_COLOR)
      this.addClass(svgEl, 'selected-note')
    }
    const colorStroke = (el: Element) => {
      const svgEl = el as SVGElement
      this.setAttr(svgEl, 'stroke', SELECTION_STROKE)
      this.setStyleProp(svgEl, 'stroke', SELECTION_STROKE)
      this.addClass(svgEl, 'selected-note')
    }

    if (isRest) {
      // A rest is a single glyph — color every glyph in its group.
      group.querySelectorAll('text, path').forEach(colorFill)
      // Two voices' rests can be vertically nudged to the same spot; whichever group
      // is later in the DOM paints on top, so the recolored rest can be hidden behind
      // the other voice. Raise this rest's group to the front (same reasoning as the
      // unison-notehead case below); clearHighlights puts it back where it was.
      this.raiseToFront(group)
      return
    }

    // Rule: color what belongs solely to this note — its notehead and stem — and never
    // shared structure (the beam bar, staff lines, barlines).
    //
    // The flag (the hook on an unbeamed 8th/16th) is intentionally NOT highlighted: it
    // is reserved to become its own selectable element later, like accidentals and ties.
    // Do not add it here without revisiting that decision.

    // Stem: resolved by identity, so it works whether the note drew its own stem
    // (unbeamed) or the beam drew it (beamed). A chord's single stem is shared by its
    // noteheads, which is correct — it is still this note's stem.
    if (stem) stem.querySelectorAll('path, line').forEach(colorStroke)

    // Notehead: noteheads draw in key order (low→high), matching the stored noteIndex,
    // so in a chord we color exactly the selected head. Color only its first glyph (the
    // head), not any accidental/dots drawn in the same group.
    const noteheads = group.querySelectorAll('g.vf-notehead')
    const target = noteheads[noteIndex] ?? (noteheads.length === 1 ? noteheads[0] : null)
    const head = target
      ? target.querySelector('text, path')
      : group.querySelector('g.vf-notehead text, g.vf-notehead path')
    if (head) colorFill(head)

    // Multi-voice unison: the other voice draws a notehead at the SAME pixel spot in a
    // sibling `vf-stavenote` group. Whichever is later in the DOM paints on top, so the
    // recolored head can be hidden behind the other voice. Raise this note's group to
    // the front of its parent so its (now coloured) head is the one that shows;
    // clearHighlights restores the original sibling order.
    this.raiseToFront(group)
  }

  applyArticulationHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Selected articulation groups live in the multi-select set (Ctrl-click adds more);
    // fall back to the scalar anchor for safety. Each group covers EVERY articulation on
    // its note (Sibelius-style), so highlight all of them.
    const selectedNoteIds = new Set<string>()
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'articulation') selectedNoteIds.add(item.noteId)
    }
    if (this.state.selectedArticulationNoteId) selectedNoteIds.add(this.state.selectedArticulationNoteId)
    if (!selectedNoteIds.size) return

    const registry = engine.getElementRegistry()
    const artElements = registry.getByType('articulation').filter(
      el => el.noteId !== undefined && selectedNoteIds.has(el.noteId),
    )
    if (!artElements.length) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // KEY DOM FACT: VexFlow renders a note's articulation glyphs INSIDE that note's
    // own `vf-notehead` group — NoteHead.draw() opens the group, draws the head, then
    // calls stavenote.drawModifiers(this) before closing it (notehead.js). So an
    // articulation lives at `vf-stavenote > vf-notehead[noteIndex] > <text>`, scoped to
    // the very note it belongs to. We register articulations on the lowest-pitch note
    // (noteIndex 0), so we look up that note's group and search ONLY within its notehead
    // sub-group. A document-wide nearest-glyph scan was the bug: with two voices stacked
    // at the same beat it could grab the OTHER voice's notehead, which lives in a
    // different group — impossible once the search is scoped here.
    for (const artEl of artElements) {
      // Paint each articulation in ITS note's voice colour (V1 blue, V2 green —
      // Sibelius-style; matches the notehead highlight) rather than a uniform orange.
      const voice = engine.getNote(artEl.noteId!)?.voice ?? 0
      const articulationColor = voiceFillColor(voice)

      const groupInfo = engine.getStaveNoteSVGGroup(artEl.noteId!)
      if (!groupInfo) continue
      const noteheadGroups = groupInfo.group.querySelectorAll('g.vf-notehead')
      const noteheadGroup = noteheadGroups[groupInfo.noteIndex] ?? noteheadGroups[0]
      if (!noteheadGroup) continue

      // The notehead glyph itself is drawn FIRST (before its modifiers), so it's the
      // first text/path in the group; skip it. The remaining glyphs are this note's
      // modifiers (accidental/dots/articulations). Geometry then picks the one whose
      // centre is closest to the articulation's registered bbox — robust against a note
      // carrying several stacked marks (staccato + accent), each with a distinct centre.
      const glyphEls = noteheadGroup.querySelectorAll<SVGGraphicsElement>('text, path')
      const cx = artEl.bbox.x + artEl.bbox.width / 2
      const cy = artEl.bbox.y + artEl.bbox.height / 2
      let best: SVGGraphicsElement | null = null
      let bestDist = Infinity
      glyphEls.forEach((svgEl, i) => {
        if (i === 0) return // the notehead glyph itself
        const bb = svgEl.getBBox?.()
        if (!bb || bb.width === 0 || bb.height === 0) return
        const dx = bb.x + bb.width / 2 - cx
        const dy = bb.y + bb.height / 2 - cy
        const dist = dx * dx + dy * dy
        if (dist < bestDist) { bestDist = dist; best = svgEl }
      })
      if (best) {
        const el = best as SVGGraphicsElement
        this.setAttr(el, 'fill', articulationColor)
        this.setStyleProp(el, 'fill', articulationColor)
        this.addClass(el, 'selected-articulation')
      }
    }
  }

  applyAccidentalHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedAccidentalNoteId) return

    const registry = engine.getElementRegistry()
    const accElements = registry.getByType('accidental').filter(
      el => el.noteId === this.state.selectedAccidentalNoteId &&
            el.accidentalType === this.state.selectedAccidentalType,
    )
    if (!accElements.length) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // Paint the accidental in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead/tie highlight) rather than a uniform orange.
    const voice = engine.getNote(this.state.selectedAccidentalNoteId)?.voice ?? 0
    const ACCIDENTAL_COLOR = voiceFillColor(voice)

    for (const accEl of accElements) {
      const bbox = accEl.bbox
      const centerX_bbox = bbox.x + bbox.width / 2
      const centerY_bbox = bbox.y + bbox.height / 2
      const textEls = svg.querySelectorAll('text')
      for (const svgEl of textEls) {
        const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
        if (!elBBox) continue

        const centerX_el = elBBox.x + elBBox.width / 2
        const centerY_el = elBBox.y + elBBox.height / 2
        // Match on BOTH axes: an X-only match paints every glyph in the accidental
        // column — the other voice's accidental and any notehead sharing that X —
        // when stacked voices put a sharp and flat in the same column.
        if (Math.abs(centerX_el - centerX_bbox) < 1.0 &&
            Math.abs(centerY_el - centerY_bbox) < bbox.height / 2 + 1.0) {
          const el = svgEl as SVGElement
          this.setAttr(el, 'fill', ACCIDENTAL_COLOR)
          this.setStyleProp(el, 'fill', ACCIDENTAL_COLOR)
          this.addClass(el, 'selected-accidental')
        }
      }
    }
  }

  applyTieHighlight(): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedTieFromNoteId) return

    const fromNoteId = this.state.selectedTieFromNoteId
    const group = engine.getTieSVGGroup(fromNoteId)
    if (!group) return

    // Paint the tie in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead highlight) rather than a uniform orange.
    const voice = engine.getNote(fromNoteId)?.voice ?? 0
    this.colorTieGroup(group, voiceFillColor(voice))
  }

  /**
   * Highlight the tie ARC for any selected tie chain. A range selection adds both
   * tied notes to the set (their noteheads light up via applySelectionHighlight),
   * but the connecting arc is a separate SVG path — colour it too when BOTH its
   * endpoints are selected, so a held (tied) note reads as fully selected.
   */
  applySelectionTieHighlight(): void {
    const engine = this.getEngine()
    if (!engine || this.state.selectedItems.size < 2) return

    const selected = new Set<string>()
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'note') selected.add(item.id)
    }

    for (const tieEl of engine.getElementRegistry().getByType('tie')) {
      if (tieEl.fromNoteId && tieEl.toNoteId
        && selected.has(tieEl.fromNoteId) && selected.has(tieEl.toNoteId)) {
        const group = engine.getTieSVGGroup(tieEl.fromNoteId)
        if (!group) continue
        const voice = engine.getNote(tieEl.fromNoteId)?.voice ?? 0
        this.colorTieGroup(group, voiceFillColor(voice))
      }
    }
  }

  /** Colour the tie inside its OWN `<g class="vf-tie">` group — never a document-wide
   *  bbox path-scan, which bled onto staff lines whose bbox fell inside the tie's
   *  rectangle (mirrors the slur fix). Curve.renderCurve strokes AND fills, so each
   *  `<path>` carries both — override both, or a selected tie shows a coloured body
   *  with a black outline (see curveArc.ts). */
  private colorTieGroup(group: SVGGElement, tieColor: string): void {
    group.querySelectorAll('path').forEach(el => {
      this.setAttr(el, 'fill', tieColor)
      this.setAttr(el, 'stroke', tieColor)
      this.setStyleProp(el, 'fill', tieColor)
      this.setStyleProp(el, 'stroke', tieColor)
      this.addClass(el, 'selected-tie')
    })
  }

  applyClefSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || this.state.selectedClefMeasure === null) return

    const registry = engine.getElementRegistry()
    const targetBeat = this.state.selectedClefBeat ?? 0
    // Scope by staff — clef is per-staff, so at (measure, beat) each stacked staff has
    // its own opening-clef element. Matching on measure+beat alone highlights the first
    // (staff 0) regardless of which staff's clef was actually selected.
    const clefEl = registry.getByType('clef').find(
      el => el.measure === this.state.selectedClefMeasure && (el.beat ?? 0) === targetBeat
        && (el.staff ?? 0) === this.state.selectedClefStaff,
    )
    if (!clefEl) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // The clef glyph is a filled path/text near the measure's left edge.
    this.highlightGlyphsInBBox(svg, clefEl.bbox, 'selected-clef')
  }

  /**
   * Recolor every glyph (`<path>`/`<text>`) whose center sits inside `bbox`, skipping
   * wide elements (the staff lines that also intersect the region). Shared by the clef
   * and time-signature selection highlights, which scan the SVG for the narrow glyph
   * column near a measure's left edge.
   */
  private highlightGlyphsInBBox(
    svg: SVGSVGElement,
    bbox: { x: number; y: number; width: number; height: number },
    className: string,
  ): void {
    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'
    const elements = svg.querySelectorAll('path, text')
    for (const el of elements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue
      if (elBBox.width > 40) continue // skip staff lines / wide elements

      const cx = elBBox.x + elBBox.width / 2
      const cy = elBBox.y + elBBox.height / 2
      if (cx >= bbox.x && cx <= bbox.x + bbox.width && cy >= bbox.y && cy <= bbox.y + bbox.height) {
        const svgEl = el as SVGElement
        const currentFill = svgEl.getAttribute('fill')
        if (currentFill && currentFill !== 'none') this.setAttr(svgEl, 'fill', SELECTION_COLOR)
        this.setStyleProp(svgEl, 'fill', SELECTION_COLOR)
        this.setAttr(svgEl, 'stroke', SELECTION_STROKE)
        this.addClass(svgEl, className)
      }
    }
  }

  applyTimeSignatureSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || this.state.selectedTimeSignatureMeasure === null) return

    const registry = engine.getElementRegistry()
    const tsEl = registry.getByType('timeSignature').find(
      el => el.measure === this.state.selectedTimeSignatureMeasure,
    )
    if (!tsEl) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // The TS glyph is filled number paths/text in a narrow column after the clef.
    this.highlightGlyphsInBBox(svg, tsEl.bbox, 'selected-timesig')
  }

  applyTupletSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedTupletId) return

    // Recolor inside the tuplet's OWN group only — never a document-wide region — so it
    // cannot bleed onto a neighbouring system (the old bbox scan did exactly that).
    // The group holds the bracket (thin filled <rect>s), the number (<text>), and a
    // transparent pointer-rect hit-area (opacity 0 — leave it alone).
    const group = engine.getTupletSVGGroup(this.state.selectedTupletId)
    if (!group) return


    // Float the selected tuplet to the front of its siblings. Two voices' tuplets can
    // sit at the exact same pixels (e.g. a flipped voice-2 bracket landing on top of
    // voice 1); whichever is drawn last wins, so without this the unselected bracket
    // would paint over the recoloured one and the selection would be invisible.
    this.raiseToFront(group)

    // Paint in the tuplet's own voice colour, matching note/cursor selection.
    const SELECTION_COLOR = voiceFillColor(engine.getTupletVoice(this.state.selectedTupletId))

    // Bracket segments: thin rects (1px in one dimension). Skip the full-size pointer
    // hit-area, which spans the whole tuplet bbox.
    group.querySelectorAll('rect').forEach(rect => {
      const w = rect.width.baseVal.value
      const h = rect.height.baseVal.value
      if (w <= 2 || h <= 2) {
        this.setAttr(rect, 'fill', SELECTION_COLOR)
        this.setStyleProp(rect, 'fill', SELECTION_COLOR)
        this.addClass(rect, 'selected-tuplet')
      }
    })

    // The tuplet number (e.g. "3").
    group.querySelectorAll('text').forEach(text => {
      this.setAttr(text, 'fill', SELECTION_COLOR)
      this.setStyleProp(text, 'fill', SELECTION_COLOR)
      this.addClass(text, 'selected-tuplet')
    })
  }

  /**
   * Highlight the selected tempo mark. Recolors inside the mark's OWN `<g>` — the one
   * TempoLayout opens (`#vf-<id>`), since VexFlow's StaveTempo opens none — so the colour
   * can't bleed onto neighbouring marks. DOM `fill`, never VexFlow `setStyle`: setStyle
   * leaks the colour into the shared draw context and grays the rest of the score.
   */
  applyTempoSelectionHighlight(): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedTempoId) return

    const SELECTION_COLOR = '#F59E0B'
    const group = engine.getTempoSVGGroup(this.state.selectedTempoId)
    if (!group) return
    group.querySelectorAll('text, path').forEach(el => {
      const currentFill = el.getAttribute('fill')
      if (currentFill !== 'none') this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el as SVGElement, 'fill', SELECTION_COLOR)
      this.addClass(el, 'selected-tempo')
    })
  }

  applyDynamicSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Highlight every selected dynamic: the scalar single-click selection (selectedDynamicId)
    // AND any dynamics pulled into a Shift-click box (kind 'dynamic' items in selectedItems).
    const ids = new Set<string>()
    if (this.state.selectedDynamicId) ids.add(this.state.selectedDynamicId)
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'dynamic') ids.add(item.id)
    }
    if (ids.size === 0) return

    const SELECTION_COLOR = '#F59E0B'
    for (const id of ids) {
      // Recolor inside the dynamic's OWN <g class="vf-annotation"> group only, so it
      // can't bleed onto neighbouring marks. The group holds the glyph/text as <text>
      // and/or <path> children (level glyphs render as paths in the music font;
      // custom text renders as <text>).
      const group = engine.getDynamicSVGGroup(id)
      if (!group) continue
      group.querySelectorAll('text, path').forEach(el => {
        const currentFill = el.getAttribute('fill')
        if (currentFill !== 'none') this.setAttr(el, 'fill', SELECTION_COLOR)
        this.setStyleProp(el as SVGElement, 'fill', SELECTION_COLOR)
        this.addClass(el, 'selected-dynamic')
      })
    }
  }

  applySlurSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Highlight every selected slur: the scalar single-click selection (selectedSlurId, which
    // also gets draggable handles) AND any slur fully covered by a Shift-click box (kind 'slur'
    // items in selectedItems, colour only — no handles).
    const ids = new Set<string>()
    if (this.state.selectedSlurId) ids.add(this.state.selectedSlurId)
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'slur') ids.add(item.id)
    }
    for (const id of ids) this.recolorSlur(id)
  }

  /** Paint one slur in its voice's colour, inside its OWN `<g class="vf-slur">` group only. */
  private recolorSlur(slurId: string): void {
    const engine = this.getEngine()
    if (!engine) return
    // Recolor inside the slur's OWN <g class="vf-slur"> group only — never a
    // document-wide bbox path-scan, which would bleed onto beams/ties/other arcs
    // sitting inside a long slur's bounding rectangle (see docs/slur-plan.md §3).
    const group = engine.getSlurSVGGroup(slurId)
    if (!group) return

    // Paint the slur in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead/tie highlight) rather than a uniform orange. Slur.voice
    // is unreliable (created as 0), so derive it from the start-note's voice.
    const slur = engine.getScore().slurs?.find(s => s.id === slurId)
    const voice = slur ? (engine.getNote(slur.startNoteId)?.voice ?? 0) : 0
    const SELECTION_COLOR = voiceFillColor(voice)
    // Curve.renderCurve strokes AND fills, so each <path> carries both a stroke and a
    // fill — override both, or a selected slur shows an orange body with a dark outline
    // (see docs/slur-plan.md §7.3). A re-render redraws the slur black, so no explicit
    // clear is needed on deselect.
    group.querySelectorAll('path').forEach(el => {
      this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setAttr(el, 'stroke', SELECTION_COLOR)
      this.setStyleProp(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el, 'stroke', SELECTION_COLOR)
      this.addClass(el, 'selected-slur')
    })
  }

  /** Radius of a slur control-point handle dot (px) and its hit half-extent. */
  private static readonly SLUR_HANDLE_R = 5
  private static readonly SLUR_HANDLE_HIT = 9

  /**
   * Draw draggable handles for the selected slur and register them for hit-testing.
   * Two independent kinds: **round** control-point handles that reshape the arc, and
   * **square** endpoint handles that re-anchor the slur onto a different note.
   *
   * A same-line slur is ONE partial carrying `controlPoints` + `slurEndpoints` → one
   * round-handle pair + squares. A cross-system slur is N partials (BEGIN/MIDDLE…/END),
   * EACH carrying its own `controlPoints` + `segmentEndpoints` → a round-handle pair per
   * segment; the squares are the slur's TRUE ends, carried as `slurEndpoints` on a single
   * partial. So we loop ALL partials for round handles and pick the one true-ends partial
   * for squares (the §4a fix — a single `.find` would have served only the first segment).
   * Each round handle carries its OWN segment's drag context (endpoints, control points,
   * staff spacing, segment address, span count) so the drag reads everything off the picked
   * handle without re-resolving which segment it belongs to. Handles are added to the
   * (post-render) registry so the next render clears them.
   */
  applySlurHandles(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedSlurId) return
    // No slur geometry editing in linear view. A slur's control points are a 2-D shape relative
    // to endpoints whose horizontal span differs between the views, so a curve tuned against
    // unjustified linear spacing looks wrong once the line is justified — read-only here is the
    // end state, not a phase-1 shortcut (docs/linear-view-plan.md §4.2–4.3). Drawing no handles
    // is also what keeps them out of the registry, so there is nothing to grab.
    if (engine.getViewMode() === 'linear') return
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const registry = engine.getElementRegistry()
    const partials = registry.getByType('slur').filter(e => e.id === this.state.selectedSlurId)
    if (partials.length === 0) return

    const R = HighlightController.SLUR_HANDLE_R
    const HIT = HighlightController.SLUR_HANDLE_HIT
    const S = R + 1 // square half-side: a touch larger than the round handles so squares read clearly

    // Round handles: one pair per shape-bearing partial (a same-line slur has one; a
    // cross-system slur has one per segment). The drag endpoints are the segment's own
    // ends (`segmentEndpoints`), falling back to `slurEndpoints` for a same-line arc.
    for (const partial of partials) {
      if (!partial.controlPoints) continue
      const dragEnds = partial.segmentEndpoints ?? partial.slurEndpoints
      if (!dragEnds) continue
      partial.controlPoints.forEach((cp, i) => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', String(cp.x))
        dot.setAttribute('cy', String(cp.y))
        dot.setAttribute('r', String(R))
        dot.setAttribute('fill', '#F59E0B')
        dot.setAttribute('stroke', '#ffffff')
        dot.setAttribute('stroke-width', '1.5')
        dot.setAttribute('class', 'slur-handle')
        ;(dot as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'grab'
        this.addNode(svg, dot)

        registry.add({
          type: 'slur-handle',
          slurId: this.state.selectedSlurId!,
          cpIndex: i as 0 | 1,
          // This segment's full drag context, read straight off the handle on mousedown.
          controlPoints: partial.controlPoints,
          slurEndpoints: dragEnds,
          staffSpacePx: partial.staffSpacePx,
          segmentRole: partial.segmentRole,
          segmentOrdinal: partial.segmentOrdinal,
          slurSpanCount: partial.slurSpanCount,
          bbox: { x: cp.x - HIT, y: cp.y - HIT, width: HIT * 2, height: HIT * 2 },
        })
      })
    }

    // Square handles: the two TRUE endpoints (in/out) — these re-anchor the whole slur
    // onto a different note. Carried as `slurEndpoints` on exactly one partial (same-line:
    // the single arc; cross-system: the first registered segment).
    const trueEnds = partials.find(e => e.slurEndpoints)?.slurEndpoints
    if (trueEnds) {
      const ends: { p: { x: number; y: number }; which: 'start' | 'end' }[] = [
        { p: trueEnds.p0, which: 'start' },
        { p: trueEnds.p1, which: 'end' },
      ]
      for (const { p, which } of ends) {
        // The point armed for keyboard nudging reads as "selected": larger, a darker fill
        // and a thicker white ring versus the plain re-anchor squares. Pure cosmetic — the
        // hit-box (registry bbox) is unchanged (slur-endpoint-offset-plan).
        const selected = which === this.state.selectedSlurEndpoint
        const half = selected ? S + 2 : S
        const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        sq.setAttribute('x', String(p.x - half))
        sq.setAttribute('y', String(p.y - half))
        sq.setAttribute('width', String(half * 2))
        sq.setAttribute('height', String(half * 2))
        sq.setAttribute('fill', selected ? '#1D4ED8' : '#2563EB')
        sq.setAttribute('stroke', '#ffffff')
        sq.setAttribute('stroke-width', selected ? '2.5' : '1.5')
        sq.setAttribute('class', selected ? 'slur-endpoint-handle slur-endpoint-handle--selected' : 'slur-endpoint-handle')
        ;(sq as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'grab'
        this.addNode(svg, sq)

        registry.add({
          type: 'slur-endpoint',
          slurId: this.state.selectedSlurId!,
          endpoint: which,
          bbox: { x: p.x - HIT, y: p.y - HIT, width: HIT * 2, height: HIT * 2 },
        })
      }
    }

    // Orange squares: the OPEN join points of a cross-system slur (where it leaves one
    // system and resumes on the next) — keyboard-nudge-only (no note to re-anchor onto).
    // One on the BEGIN segment's right end, one on the END segment's left end, two on each
    // MIDDLE. Same color as the round angle handles (same family — layout-ephemeral, resets
    // with the span count); square shape marks it a position handle, not a curve bend. A
    // same-line slur has no segments → no orange squares.
    const armed = this.state.selectedSlurSegmentEndpoint
    for (const partial of partials) {
      if (!partial.segmentRole || !partial.segmentEndpoints) continue
      const role = partial.segmentRole
      const ends = partial.segmentEndpoints
      const opens: { p: { x: number; y: number }; side: 'left' | 'right' }[] =
        role === 'begin' ? [{ p: ends.p1, side: 'right' }]          // p0 is the true start
        : role === 'end' ? [{ p: ends.p0, side: 'left' }]           // p1 is the true end
        : [{ p: ends.p0, side: 'left' }, { p: ends.p1, side: 'right' }] // middle: both open
      for (const { p, side } of opens) {
        const isSel = !armed ? false
          : role === 'middle'
            ? armed.role === 'middle' && armed.ordinal === partial.segmentOrdinal && armed.side === side
            : armed.role === role
        const half = isSel ? S + 2 : S
        const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        sq.setAttribute('x', String(p.x - half))
        sq.setAttribute('y', String(p.y - half))
        sq.setAttribute('width', String(half * 2))
        sq.setAttribute('height', String(half * 2))
        sq.setAttribute('fill', '#F59E0B')
        sq.setAttribute('stroke', '#ffffff')
        sq.setAttribute('stroke-width', isSel ? '2.5' : '1.5')
        sq.setAttribute('class', isSel ? 'slur-segment-endpoint-handle slur-segment-endpoint-handle--selected' : 'slur-segment-endpoint-handle')
        ;(sq as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'grab'
        this.addNode(svg, sq)

        registry.add({
          type: 'slur-segment-endpoint',
          slurId: this.state.selectedSlurId!,
          segmentRole: role,
          segmentOrdinal: partial.segmentOrdinal,
          segmentSide: role === 'middle' ? side : undefined,
          slurSpanCount: partial.slurSpanCount,
          bbox: { x: p.x - HIT, y: p.y - HIT, width: HIT * 2, height: HIT * 2 },
        })
      }
    }
  }

  /** While dragging a slur endpoint, tint the note it would snap onto (the candidate
   *  anchor) a distinct blue so it's clear where the end will land on release. */
  applySlurEndpointCandidate(): void {
    if (!this.state.slurEndpointCandidateNoteId) return
    this.highlightNote(this.state.slurEndpointCandidateNoteId, '#2563EB', '#1D4ED8')
  }
}
