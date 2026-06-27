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
    // Cursor follows the active voice's stream (matches enterNoteAtCursorPosition).
    const { allFlat, beats } = navBeatMap(score, this.state.selectedNoteId, activeVoiceToModel(this.state.activeVoice))

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

    const staffGeometry = registry.getStaffGeometry(cursorMeasure)
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
    svg.appendChild(line)
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
    svg.appendChild(line)
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
      svgEl.setAttribute('fill', SELECTION_COLOR)
      svgEl.style.fill = SELECTION_COLOR
      svgEl.classList.add('selected-note')
    }
    const colorStroke = (el: Element) => {
      const svgEl = el as SVGElement
      svgEl.setAttribute('stroke', SELECTION_STROKE)
      svgEl.style.stroke = SELECTION_STROKE
      svgEl.classList.add('selected-note')
    }

    if (isRest) {
      // A rest is a single glyph — color every glyph in its group.
      group.querySelectorAll('text, path').forEach(colorFill)
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
    // the front of its parent so its (now coloured) head is the one that shows. Safe:
    // the next render rebuilds the SVG, resetting DOM order.
    group.parentNode?.appendChild(group)
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
        el.setAttribute('fill', articulationColor)
        el.style.fill = articulationColor
        el.classList.add('selected-articulation')
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
          el.setAttribute('fill', ACCIDENTAL_COLOR)
          el.style.fill = ACCIDENTAL_COLOR
          el.classList.add('selected-accidental')
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
      const styled = el as SVGElement & { style: CSSStyleDeclaration }
      el.setAttribute('fill', tieColor)
      el.setAttribute('stroke', tieColor)
      styled.style.fill = tieColor
      styled.style.stroke = tieColor
      el.classList.add('selected-tie')
    })
  }

  applyClefSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || this.state.selectedClefMeasure === null) return

    const registry = engine.getElementRegistry()
    const targetBeat = this.state.selectedClefBeat ?? 0
    const clefEl = registry.getByType('clef').find(
      el => el.measure === this.state.selectedClefMeasure && (el.beat ?? 0) === targetBeat,
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
        if (currentFill && currentFill !== 'none') svgEl.setAttribute('fill', SELECTION_COLOR)
        svgEl.style.fill = SELECTION_COLOR
        svgEl.setAttribute('stroke', SELECTION_STROKE)
        svgEl.classList.add(className)
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
    group.parentNode?.appendChild(group)

    // Paint in the tuplet's own voice colour, matching note/cursor selection.
    const SELECTION_COLOR = voiceFillColor(engine.getTupletVoice(this.state.selectedTupletId))

    // Bracket segments: thin rects (1px in one dimension). Skip the full-size pointer
    // hit-area, which spans the whole tuplet bbox.
    group.querySelectorAll('rect').forEach(rect => {
      const w = rect.width.baseVal.value
      const h = rect.height.baseVal.value
      if (w <= 2 || h <= 2) {
        rect.setAttribute('fill', SELECTION_COLOR)
        rect.style.fill = SELECTION_COLOR
        rect.classList.add('selected-tuplet')
      }
    })

    // The tuplet number (e.g. "3").
    group.querySelectorAll('text').forEach(text => {
      text.setAttribute('fill', SELECTION_COLOR)
      text.style.fill = SELECTION_COLOR
      text.classList.add('selected-tuplet')
    })
  }

  applyDynamicSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedDynamicId) return

    // Recolor inside the dynamic's OWN <g class="vf-annotation"> group only, so it
    // can't bleed onto neighbouring marks. The group holds the glyph/text as <text>
    // and/or <path> children (level glyphs render as paths in the music font;
    // custom text renders as <text>).
    const group = engine.getDynamicSVGGroup(this.state.selectedDynamicId)
    if (!group) return

    const SELECTION_COLOR = '#F59E0B'

    group.querySelectorAll('text, path').forEach(el => {
      const currentFill = el.getAttribute('fill')
      if (currentFill !== 'none') el.setAttribute('fill', SELECTION_COLOR)
      ;(el as SVGElement & { style: CSSStyleDeclaration }).style.fill = SELECTION_COLOR
      el.classList.add('selected-dynamic')
    })
  }

  applySlurSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedSlurId) return

    // Recolor inside the slur's OWN <g class="vf-slur"> group only — never a
    // document-wide bbox path-scan, which would bleed onto beams/ties/other arcs
    // sitting inside a long slur's bounding rectangle (see docs/slur-plan.md §3).
    const group = engine.getSlurSVGGroup(this.state.selectedSlurId)
    if (!group) return

    // Paint the slur in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead/tie highlight) rather than a uniform orange. Slur.voice
    // is unreliable (created as 0), so derive it from the start-note's voice.
    const slur = engine.getScore().slurs?.find(s => s.id === this.state.selectedSlurId)
    const voice = slur ? (engine.getNote(slur.startNoteId)?.voice ?? 0) : 0
    const SELECTION_COLOR = voiceFillColor(voice)
    // Curve.renderCurve strokes AND fills, so each <path> carries both a stroke and a
    // fill — override both, or a selected slur shows an orange body with a dark outline
    // (see docs/slur-plan.md §7.3). A re-render redraws the slur black, so no explicit
    // clear is needed on deselect.
    group.querySelectorAll('path').forEach(el => {
      const styled = el as SVGElement & { style: CSSStyleDeclaration }
      el.setAttribute('fill', SELECTION_COLOR)
      el.setAttribute('stroke', SELECTION_COLOR)
      styled.style.fill = SELECTION_COLOR
      styled.style.stroke = SELECTION_COLOR
      el.classList.add('selected-slur')
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
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const registry = engine.getElementRegistry()
    const partials = registry.getByType('slur').filter(e => e.id === this.state.selectedSlurId)
    if (partials.length === 0) return

    const R = HighlightController.SLUR_HANDLE_R
    const HIT = HighlightController.SLUR_HANDLE_HIT

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
        svg.appendChild(dot)

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
      const S = R + 1 // half-side: a touch larger than the round handles so squares read clearly
      for (const { p, which } of ends) {
        const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        sq.setAttribute('x', String(p.x - S))
        sq.setAttribute('y', String(p.y - S))
        sq.setAttribute('width', String(S * 2))
        sq.setAttribute('height', String(S * 2))
        sq.setAttribute('fill', '#2563EB')
        sq.setAttribute('stroke', '#ffffff')
        sq.setAttribute('stroke-width', '1.5')
        sq.setAttribute('class', 'slur-endpoint-handle')
        ;(sq as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'grab'
        svg.appendChild(sq)

        registry.add({
          type: 'slur-endpoint',
          slurId: this.state.selectedSlurId!,
          endpoint: which,
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
