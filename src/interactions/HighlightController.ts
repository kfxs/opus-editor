import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, selectedOf } from './EditorState'
import { navBeatMap } from '../utils/beatMap'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'
import { ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_STROKE } from '../utils/selectionColors'
import { tremoloGlyph } from '../utils/tremoloGlyphs'
import { TREMOLO_PAIR_GROUP } from '../utils/tremoloPair'
import { staffOf } from '@/utils/lanes'

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
   * Draw the Sibelius-style blue box around the selected `measureRange`.
   * In first-voice blue with no fill; the box's own `boxStyle` picks the look:
   *   - `'single'` — ONE rectangle: the plain-click passage selection, whose contents
   *     (notes/rests + enclosed dynamics/slurs) ARE selected and highlighted separately.
   *   - `'double'` — two nested rectangles: the Ctrl+Shift+click marker (visual only, NO
   *     objects selected).
   * Redrawn every render and wiped with the SVG on the next one.
   */
  applyMeasureBox(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const range = selectedOf(this.state, 'measureRange')
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
    //     landed on (the box's own `staff`); a content selection on that staff.
    //   - 'double' (Ctrl+Shift measure select) → the whole measure COLUMN across EVERY
    //     staff (staff 0's top → the last staff's bottom), because add/remove-measure is a
    //     system-wide edit that hits all staves. At N=1 both collapse to the single staff.
    const isSingle = range.boxStyle === 'single'
    const staffCount = engine.getScore().staves?.length ?? 1
    const lines = new Map<number, { left: number; right: number; top: number; bottom: number }>()
    for (let m = lo; m <= hi; m++) {
      const rect = engine.getMeasureRect(m)
      if (!rect) continue
      const topGeo = isSingle
        ? (registry.getStaffGeometry(m, range.staff) ?? registry.getStaffGeometry(m, 0))
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
    const insets = isSingle ? [0] : [0, GAP]
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
   *  Every real caller passes the note's VOICE colour (voiceColors); the default here is only a
   *  fallback and uses the generic element-selection colour, never the voice-3 orange. */
  private highlightNote(
    noteId: string,
    fillColor = ELEMENT_SELECTION_FILL,
    strokeColor = ELEMENT_SELECTION_STROKE,
  ): void {
    const engine = this.getEngine()
    if (!engine) return

    // Recolor the note's OWN rendered SVG group, never a document-wide region. VexFlow
    // draws each StaveNote's ledger lines, stem and noteheads inside one
    // `<g class="vf-stavenote">`, so confining the recolor to that group makes the
    // selection highlight bleed-free in both directions (the old approach scanned a
    // synthetic band that overlapped the staff line above or below).
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

    // ⭐ A FANNED MEMBER has no `StaveNote`, so its ink lives in the group the fan renderer drew it
    // into (docs/fanned-beam-pitches-plan.md §2 P3) — head, accidental, ledger lines and stem, all
    // ours, all in one place. The shared beam is untouched because it is drawn OUTSIDE that group.
    //
    // ⚠️ **A GLYPH IS FILLED, NEVER STROKED.** Handing the accidental a stroke as well as a fill
    // outlines it, and an outlined glyph reads as BOLD — the first thing he noticed. Same split as
    // everywhere else here: `text` glyphs take `colorFill`, the drawn lines (stem, ledgers) take
    // `colorStroke`.
    const memberInfo = engine.getFanMemberSVGGroup(noteId)
    if (memberInfo) {
      const heads = memberInfo.group.querySelectorAll('g.vf-notehead')
      // A member with several pitches shares one stem, exactly as a chord does: this pitch's head,
      // plus the ink that belongs to the member as a whole.
      const head = heads[memberInfo.noteIndex] ?? heads[0]
      head?.querySelectorAll('text, path').forEach(colorFill)
      for (const el of memberInfo.group.children) {
        if (el.tagName === 'g') continue // another head of this member — not this pitch
        if (el.tagName === 'text') colorFill(el) // the accidental
        else colorStroke(el)                     // the stem and its ledger lines
      }
      this.raiseToFront(memberInfo.group)
      return
    }

    const groupInfo = engine.getStaveNoteSVGGroup(noteId)
    if (!groupInfo) return
    const { group, noteIndex, stem } = groupInfo

    const isRest = engine.getElementById(noteId)?.type === 'rest'

    if (isRest) {
      // A rest is a single glyph — color every glyph in its group, EXCEPT a dynamic attached to
      // this rest: an Annotation modifier renders its `<g class="vf-annotation">` glyph NESTED
      // inside the rest's `vf-stavenote` group, so the broad `text, path` sweep would recolor the
      // (unselected) dynamic too — the bleed the user saw when selecting a rest that carries a
      // dynamic. The dynamic owns its own selection highlight (applyDynamicSelectionHighlight).
      group.querySelectorAll('text, path').forEach(el => {
        if (el.closest('.vf-annotation')) return
        colorFill(el)
      })
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

    // Also light this note's accidental (♯/♭/♮), articulations, dots, tie and tremolo, so a selected
    // note reads as fully selected — head + stem + accidental + articulations + dots + tie + mark.
    this.highlightNoteAccidental(noteId, group, SELECTION_COLOR)
    this.colorNoteArticulations(noteId, SELECTION_COLOR)
    this.colorNoteDots(noteId, SELECTION_COLOR)
    this.colorNoteTie(noteId, SELECTION_COLOR)
    this.colorNoteTremolo(noteId, SELECTION_COLOR)

    // Multi-voice unison: the other voice draws a notehead at the SAME pixel spot in a
    // sibling `vf-stavenote` group. Whichever is later in the DOM paints on top, so the
    // recolored head can be hidden behind the other voice. Raise this note's group to
    // the front of its parent so its (now coloured) head is the one that shows;
    // clearHighlights restores the original sibling order.
    this.raiseToFront(group)
  }

  /**
   * Colour the accidental(s) belonging to a selected note in the note's selection colour. The
   * accidental glyph lives inside the note's own `vf-stavenote` group, so we scope the search there
   * (cheaper than a full-SVG scan) and match it to the registered `accidental` element by bbox on
   * BOTH axes — an X-only match would catch a chord neighbour's accidental or a notehead sharing the
   * column (same reasoning as {@link applyAccidentalHighlight}). Uses the logged setAttr/addClass, so
   * {@link clearHighlights} reverts it with the rest of the note highlight.
   */
  private highlightNoteAccidental(noteId: string, group: Element, color: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const accElements = engine.getElementRegistry().getByType('accidental').filter(el => el.noteId === noteId)
    if (!accElements.length) return

    const textEls = group.querySelectorAll('text')
    for (const accEl of accElements) {
      const bbox = accEl.bbox
      const centerX = bbox.x + bbox.width / 2
      const centerY = bbox.y + bbox.height / 2
      for (const svgEl of textEls) {
        const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
        if (!elBBox) continue
        const elX = elBBox.x + elBBox.width / 2
        const elY = elBBox.y + elBBox.height / 2
        if (Math.abs(elX - centerX) < 1.0 && Math.abs(elY - centerY) < bbox.height / 2 + 1.0) {
          const el = svgEl as SVGElement
          this.setAttr(el, 'fill', color)
          this.setStyleProp(el, 'fill', color)
          this.addClass(el, 'selected-note')
        }
      }
    }
  }

  applyArticulationHighlight(): void {
    const engine = this.getEngine()
    if (!engine) return

    // Selected articulation groups live in the multi-select set (Ctrl-click adds more);
    // fall back to the element ANCHOR for safety. Each group covers EVERY articulation on
    // its note (Sibelius-style), so highlight all of them, each in its note's voice colour.
    const selectedNoteIds = new Set<string>()
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'articulation') selectedNoteIds.add(item.noteId)
    }
    const anchor = selectedOf(this.state, 'articulation')?.noteId
    if (anchor) selectedNoteIds.add(anchor)

    for (const noteId of selectedNoteIds) {
      const voice = engine.getNote(noteId)?.voice ?? 0
      this.colorNoteArticulations(noteId, voiceFillColor(voice))
    }
  }

  /**
   * Colour every articulation glyph on `noteId` in `color`. Shared by the articulation-GROUP
   * highlight ({@link applyArticulationHighlight}) and the selected-NOTE highlight
   * ({@link highlightNote}), so a note reads as fully selected (head + stem + accidental +
   * articulations). Uses the logged setAttr so {@link clearHighlights} reverts it.
   *
   * KEY DOM FACT: VexFlow renders a note's articulation glyphs INSIDE that note's own
   * `vf-notehead` group — NoteHead.draw() opens the group, draws the head, then calls
   * stavenote.drawModifiers(this) before closing it. So an articulation lives at
   * `vf-stavenote > vf-notehead[noteIndex] > <text>`, scoped to the very note it belongs to;
   * searching ONLY within that notehead sub-group avoids grabbing a stacked voice's glyph (a
   * document-wide nearest-glyph scan was the old bug). Within the group, the notehead glyph is
   * drawn FIRST (skip index 0); geometry then picks the glyph whose centre is closest to the
   * registered articulation bbox — robust for a note carrying several stacked marks.
   */
  private colorNoteArticulations(noteId: string, color: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const artElements = engine.getElementRegistry().getByType('articulation').filter(el => el.noteId === noteId)
    if (!artElements.length) return

    // ⭐ A FANNED MEMBER's marks are not in a `vf-notehead` at all — VexFlow never drew that head, so
    // `FanPass` paints the whole member (head, sign, ledgers, stem AND its articulations) into its
    // own `vf-fanhead` group. Same search, one group over; without this a member's mark was drawn
    // and registered and selectable but never lit up.
    const memberGroup = engine.getFanMemberSVGGroup(noteId)?.group
    let scope: Element | null = memberGroup ?? null
    if (!scope) {
      const groupInfo = engine.getStaveNoteSVGGroup(noteId)
      if (!groupInfo) return
      const noteheadGroups = groupInfo.group.querySelectorAll('g.vf-notehead')
      scope = noteheadGroups[groupInfo.noteIndex] ?? noteheadGroups[0] ?? null
    }
    if (!scope) return

    const glyphEls = scope.querySelectorAll<SVGGraphicsElement>('text, path')
    // In a `vf-notehead` the head is drawn FIRST and is skipped by index; a member's group has its
    // ledgers before the head, so there is no fixed index to skip and the nearest-centre match below
    // does the work on its own (a mark sits a staff space clear of the head it belongs to).
    const skipFirst = !memberGroup
    for (const artEl of artElements) {
      const cx = artEl.bbox.x + artEl.bbox.width / 2
      const cy = artEl.bbox.y + artEl.bbox.height / 2
      let best: SVGGraphicsElement | null = null
      let bestDist = Infinity
      glyphEls.forEach((svgEl, i) => {
        if (skipFirst && i === 0) return // the notehead glyph itself
        const bb = svgEl.getBBox?.()
        if (!bb || bb.width === 0 || bb.height === 0) return
        const dx = bb.x + bb.width / 2 - cx
        const dy = bb.y + bb.height / 2 - cy
        const dist = dx * dx + dy * dy
        if (dist < bestDist) { bestDist = dist; best = svgEl }
      })
      if (best) {
        const el = best as SVGGraphicsElement
        this.setAttr(el, 'fill', color)
        this.setStyleProp(el, 'fill', color)
        this.addClass(el, 'selected-articulation')
      }
    }
  }

  /**
   * Colour every augmentation-dot glyph of the slot anchored at `noteId`. Shared by the selected-DOT
   * highlight ({@link applyDotHighlight}) and the selected-NOTE highlight ({@link highlightNote}),
   * exactly as {@link colorNoteArticulations} is shared — so a dotted note reads as fully selected
   * and clicking one dot lights them all.
   *
   * Scoped to the whole `vf-stavenote` group, NOT to one `vf-notehead` like articulations are: a
   * chord's dots are spread across EVERY notehead group (VexFlow attaches one Dot per head, drawn
   * inside that head's group), yet they are one model value on the slot. Each registered dot bbox
   * then claims the nearest glyph in the group; a dot sits clear to the right of the head it belongs
   * to, so nearest is unambiguous, and requiring the glyph's centre to fall inside the (slightly
   * grown) bbox keeps a notehead from ever being picked when a dot glyph is missing.
   */
  private colorNoteDots(noteId: string, color: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const dotElements = engine.getElementRegistry().getByType('dot').filter(el => el.noteId === noteId)
    if (!dotElements.length) return
    const groupInfo = engine.getStaveNoteSVGGroup(noteId)
    if (!groupInfo) return

    const glyphEls = groupInfo.group.querySelectorAll<SVGGraphicsElement>('text')
    for (const dotEl of dotElements) {
      const cx = dotEl.bbox.x + dotEl.bbox.width / 2
      const cy = dotEl.bbox.y + dotEl.bbox.height / 2
      let best: SVGGraphicsElement | null = null
      let bestDist = Infinity
      glyphEls.forEach(svgEl => {
        const bb = svgEl.getBBox?.()
        if (!bb || bb.width === 0 || bb.height === 0) return
        const ex = bb.x + bb.width / 2
        const ey = bb.y + bb.height / 2
        if (Math.abs(ex - cx) > dotEl.bbox.width / 2 + 1.0) return
        if (Math.abs(ey - cy) > dotEl.bbox.height / 2 + 1.0) return
        const dist = (ex - cx) ** 2 + (ey - cy) ** 2
        if (dist < bestDist) { bestDist = dist; best = svgEl }
      })
      if (best) {
        const el = best as SVGGraphicsElement
        this.setAttr(el, 'fill', color)
        this.setStyleProp(el, 'fill', color)
        this.addClass(el, 'selected-dot')
      }
    }
  }

  /** Highlight the dots selected on the score (a click on any one of them). Paints in the slot's
   *  voice colour, like every other sub-element highlight. */
  applyDotHighlight(): void {
    const engine = this.getEngine()
    const noteId = selectedOf(this.state, 'dot')?.noteId
    if (!engine || !noteId) return
    const voice = engine.getNote(noteId)?.voice ?? 0
    this.colorNoteDots(noteId, voiceFillColor(voice))
  }

  /**
   * Highlight the selected STEM — its own paths inside the note's `vf-stavenote` group, in the
   * slot's voice colour like every other sub-element highlight.
   *
   * Resolved by IDENTITY (`getStaveNoteSVGGroup` hands back the stem element), so it works whether
   * the note drew its own stem or the beam drew it — the same lookup {@link highlightNote} uses for
   * the head+stem case. Nothing else in the group is touched: the point of selecting a stem is that
   * it is not the note.
   */
  applyStemHighlight(): void {
    const engine = this.getEngine()
    const noteId = selectedOf(this.state, 'stem')?.noteId
    if (!engine || !noteId) return
    const stem = engine.getStaveNoteSVGGroup(noteId)?.stem
    if (!stem) return

    const color = voiceStrokeColor(engine.getNote(noteId)?.voice ?? 0)
    stem.querySelectorAll('path, line').forEach(el => {
      const svgEl = el as SVGElement
      this.setAttr(svgEl, 'stroke', color)
      this.setStyleProp(svgEl, 'stroke', color)
      this.addClass(svgEl, 'selected-stem')
    })
  }

  /**
   * Colour the tremolo mark on `noteId` — every stroke of the stack, or the Penderecki sign.
   *
   * Shared by the selected-TREMOLO highlight ({@link applyTremoloHighlight}) and the selected-NOTE
   * highlight ({@link highlightNote}), exactly as {@link colorNoteDots} and
   * {@link colorNoteArticulations} are shared: selecting the note lights everything that belongs to
   * it, and selecting the mark lights just the mark. No-op on a note without one.
   *
   * Found by GLYPH, not by geometry: the strokes are `<text>` elements inside the note's own
   * `vf-stavenote` group whose content is the tremolo codepoint, so matching the character picks all
   * N of them and nothing else. The nearest-glyph matching the accidental and the articulations use
   * would be wrong here — the stack sits along the stem, where a chord's upper noteheads are, and it
   * is one registered rect covering N glyphs rather than one box per glyph.
   *
   * ⚠️ A TWO-NOTE PAIR takes the other branch entirely — see {@link colorTremoloPairGroup}. Its
   * strokes are not glyphs and not inside any note group, so the search above finds nothing.
   */
  private colorNoteTremolo(noteId: string, color: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const note = engine.getNote(noteId)
    const mark = note?.tremolo
    if (mark === undefined) return
    if (note?.tremoloPair) {
      this.colorTremoloPairGroup(noteId, color)
      return
    }
    const group = engine.getStaveNoteSVGGroup(noteId)?.group
    if (!group) return

    const glyph = tremoloGlyph(mark)
    group.querySelectorAll('text').forEach(el => {
      if (el.textContent !== glyph) return
      const svgEl = el as SVGElement
      this.setAttr(svgEl, 'fill', color)
      this.setStyleProp(svgEl, 'fill', color)
      this.addClass(svgEl, 'selected-tremolo')
    })
  }

  /**
   * Colour a TWO-NOTE tremolo's strokes — the one selection seam the pair could not inherit.
   *
   * Its strokes are our own beam quads (`<path>`s), drawn outside every note group, so
   * {@link colorNoteTremolo}'s glyph search has nothing to match: no `<text>`, no codepoint, and not
   * in the note's `vf-stavenote` group to begin with. So the renderer PAINTS them into a named group
   * (`TREMOLO_PAIR_GROUP`) and this colours that group whole — the barline lesson again: paint a
   * highlight, do not go hunting for glyphs to recolour.
   *
   * ⚠️ Matched on the id ATTRIBUTE, not `getElementById` and not a `#id` selector: the id is
   * document-wide (reference_vexflow_getsvgelement_is_document_wide) and a note id is a uuid that may
   * start with a digit, which is not a legal CSS id selector. Scoped to the score canvas and read off
   * the class, so both problems go away.
   *
   * Fills AND strokes, because `fillBeamQuad` fills a path — a stroke-only recolour would leave the
   * strokes black.
   */
  private colorTremoloPairGroup(noteId: string, color: string): void {
    const scoreCanvas = this.getScoreCanvas()
    if (!scoreCanvas) return
    const wanted = `vf-${TREMOLO_PAIR_GROUP}-${noteId}`
    for (const group of scoreCanvas.querySelectorAll(`.vf-${TREMOLO_PAIR_GROUP}`)) {
      if (group.getAttribute('id') !== wanted) continue
      group.querySelectorAll('path').forEach(el => {
        const svgEl = el as SVGElement
        this.setAttr(svgEl, 'fill', color)
        this.setStyleProp(svgEl, 'fill', color)
        this.addClass(svgEl, 'selected-tremolo')
      })
    }
  }

  /** Highlight the tremolo selected on the score (a click on its strokes). Paints in the slot's
   *  voice colour, like every other sub-element highlight. */
  applyTremoloHighlight(): void {
    const engine = this.getEngine()
    const noteId = selectedOf(this.state, 'tremolo')?.noteId
    if (!engine || !noteId) return
    this.colorNoteTremolo(noteId, voiceFillColor(engine.getNote(noteId)?.voice ?? 0))
  }

  applyAccidentalHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const selected = selectedOf(this.state, 'accidental')
    if (!engine || !scoreCanvas || !selected) return

    const registry = engine.getElementRegistry()
    const accElements = registry.getByType('accidental').filter(
      el => el.noteId === selected.noteId && el.accidentalType === selected.type,
    )
    if (!accElements.length) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // Paint the accidental in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead/tie highlight) rather than a uniform orange.
    const voice = engine.getNote(selected.noteId)?.voice ?? 0
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
    const fromNoteId = selectedOf(this.state, 'tie')?.fromNoteId
    if (!engine || !fromNoteId) return

    // Paint the tie in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
    // matches the notehead highlight) rather than a uniform orange.
    const voice = engine.getNote(fromNoteId)?.voice ?? 0
    this.colorNoteTie(fromNoteId, voiceFillColor(voice))
  }

  /**
   * Colour the tie `noteId` OWNS — its forward (`tiedTo`) arc. Shared by the selected-NOTE highlight
   * ({@link highlightNote}, so a tied note reads as fully selected) and the selected-TIE highlight
   * ({@link applyTieHighlight}), exactly as {@link colorNoteArticulations} is shared.
   *
   * The FORWARD tie only, which is precisely what the Keypad's Enter key lights and removes
   * (`PaletteController.noteHasTie` reads `tiedTo`) — so score and Keypad always agree. Select the
   * far end of a tie and neither lights: that note owns no tie, it is only tied INTO.
   *
   * No lookup of `tiedTo` is needed: `tieGroupMap` is keyed by the FROM note, so a note that ties to
   * nothing simply has no group and this is a no-op.
   */
  private colorNoteTie(noteId: string, color: string): void {
    const group = this.getEngine()?.getTieSVGGroup(noteId)
    if (!group) return
    this.colorTieGroup(group, color)
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
    const selected = selectedOf(this.state, 'clef')
    if (!engine || !scoreCanvas || !selected) return

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

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // Scope the scan to the selected measure's own group so the recolor can't reach a
    // neighbour's clef; fall back to the whole SVG only if the group can't be resolved.
    const root = engine.getMeasureSVGGroup(clefEl.measure ?? 0, staffOf(clefEl)) ?? svg
    // The clef glyph is a filled path/text near the measure's left edge.
    this.highlightGlyphsInBBox(root, clefEl.bbox, 'selected-clef')
  }

  /**
   * Recolor every glyph (`<path>`/`<text>`) whose center sits inside `bbox`, skipping
   * wide elements (the staff lines that also intersect the region). Shared by the clef
   * and time-signature selection highlights, which scan for the narrow glyph column near
   * a measure's left edge.
   *
   * `root` scopes the scan: the callers pass the selected measure's own `<g>` so the
   * recolor cannot reach a neighbouring system's clef/TS (which lives in a different
   * group), falling back to the whole SVG only if the group can't be resolved.
   */
  private highlightGlyphsInBBox(
    root: ParentNode,
    bbox: { x: number; y: number; width: number; height: number },
    className: string,
  ): void {
    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
    const SELECTION_STROKE = ELEMENT_SELECTION_STROKE
    const elements = root.querySelectorAll('path, text')
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
        // Only recolor the stroke if the glyph already had one. TS digits and clef
        // glyphs are fill-only paths; adding a stroke draws a darker outline that
        // makes them look bold/doubled (the fill and outline don't coincide).
        const currentStroke = svgEl.getAttribute('stroke')
        if (currentStroke && currentStroke !== 'none') this.setAttr(svgEl, 'stroke', SELECTION_STROKE)
        this.addClass(svgEl, className)
      }
    }
  }

  applyTimeSignatureSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const selectedTs = selectedOf(this.state, 'timeSignature')
    if (!engine || !scoreCanvas || !selectedTs) return

    const registry = engine.getElementRegistry()
    // A time signature is system-wide: it applies to every staff and is drawn once
    // per staff, so highlight the TS glyph in ALL staves of the measure, not just the
    // one that was clicked. Each staff has its own timeSignature element at this measure.
    const tsEls = registry.getByType('timeSignature').filter(
      el => el.measure === selectedTs.measure,
    )
    if (tsEls.length === 0) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    for (const tsEl of tsEls) {
      // Scope each staff's recolor to that staff's own group (see applyClefSelectionHighlight).
      const root = engine.getMeasureSVGGroup(tsEl.measure ?? 0, staffOf(tsEl)) ?? svg
      // The TS glyph is filled number paths/text in a narrow column after the clef.
      this.highlightGlyphsInBBox(root, tsEl.bbox, 'selected-timesig')
    }
  }

  /**
   * Highlight the selected barline — the line that ends the selected `barline`'s measure.
   *
   * ⭐ **PAINTED, not recoloured** — and that distinction is the whole history of this method.
   * Recolouring means drawing the score black, then hunting down VexFlow's own `<rect>`s and
   * changing their `fill`. Every failure it had was a *finding* failure, never a painting one:
   *
   *  - One barline on screen is TWO drawn rects (bar N's end and bar N+1's begin at the same x),
   *    so colouring one left the other black, painting over the orange.
   *  - Reaching into bar N+1's group for the second half does not always find it there.
   *  - ⚠️ And the coordinates lie. A render that REUSES a measure it did not redraw moves it with
   *    a `translate` on the group (`VexFlowRenderer.replaySnapshot`); the rects keep the numbers
   *    they were drawn with. So the two halves of one barline could compare hundreds of pixels
   *    apart — which is why this only misbehaved on bars whose width had been changed (exactly when
   *    neighbours move without being redrawn), and why an export/import round-trip "fixed" it: a
   *    fresh score redraws everything, so nothing carries a transform.
   *
   * Painting sidesteps all of it. The registry knows where the barline is — `noteEndX`, offset-
   * corrected when a measure was moved (`addAll(elements, dx, dy)`), which is precisely the number
   * the DOM attributes get wrong — so we draw our own mark there and never touch VexFlow's nodes.
   * Removal is deleting a node (`addNode` logs it), not replaying a colour.
   *
   * Drawn on EVERY staff of that measure, like the time signature's highlight and for the same
   * reason: one barline, stated once for the system, drawn once per staff. (The staves are joined
   * only at the left edge of a system, so these per-staff segments are all the ink there is.)
   */
  applyBarlineSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const measure = selectedOf(this.state, 'barline')?.measure ?? null
    if (!engine || !scoreCanvas || measure === null) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const registry = engine.getElementRegistry()
    const staffCount = engine.getScore().staves?.length ?? 1
    // Just wide enough to cover the engraved line under it (1.6px — `rendering/barlineInk.ts` —
    // and 3 for a thick end bar, which this deliberately does not fully cover), so the
    // result reads as an orange barline rather than an orange fringe around a black one. Any wider
    // and the selected barline looks heavier than every other line on the page, which reads as the
    // music changing rather than as a selection.
    const WIDTH = 2
    const SELECTION_COLOR = ELEMENT_SELECTION_FILL

    for (let staff = 0; staff < staffCount; staff++) {
      // ⚠️ Geometry is NOT the test for "is this bar on screen". Tier 1 registers a staff geometry
      // for every bar in the score, culled or not, so this loop used to paint an orange mark across
      // a bar that had scrolled out of the window — a selection highlight with no barline under it.
      // `isPainted` is the narrower question, and the right one (`ElementRegistry.painted`).
      if (!registry.isPainted(measure, staff)) continue
      const geometry = registry.getStaffGeometry(measure, staff)
      if (!geometry) continue

      const top = geometry.lineYPositions[0]
      const bottom = geometry.lineYPositions[4]
      const mark = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      mark.setAttribute('x', String(geometry.noteEndX - (WIDTH - 1) / 2))
      mark.setAttribute('y', String(top))
      mark.setAttribute('width', String(WIDTH))
      mark.setAttribute('height', String(Math.max(0, bottom - top)))
      mark.setAttribute('fill', SELECTION_COLOR)
      // ⚠️ **`stroke: none`, stated — not left unsaid.** An SVG element INHERITS `stroke`, and the
      // score's root carries a black one, so a rect that declares only its fill comes out orange
      // inside a black outline. Painting the stroke orange instead fixes the colour but not the
      // weight: a stroke straddles the edge, adding half its width to each side, which made the
      // selected barline visibly fatter than every other line on the page. The mark's width is the
      // whole of its geometry this way, and `WIDTH` means what it says.
      mark.setAttribute('stroke', 'none')
      mark.setAttribute('class', 'selected-barline')
      this.addNode(svg, mark)
    }
  }


  applyTupletSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const tupletId = selectedOf(this.state, 'tuplet')?.id
    if (!engine || !scoreCanvas || !tupletId) return

    // Recolor inside the tuplet's OWN group only — never a document-wide region — so it
    // cannot bleed onto a neighbouring system (the old bbox scan did exactly that).
    // The group holds the bracket (thin filled <rect>s), the number (<text>), and a
    // transparent pointer-rect hit-area (opacity 0 — leave it alone).
    const group = engine.getTupletSVGGroup(tupletId)
    if (!group) return


    // Float the selected tuplet to the front of its siblings. Two voices' tuplets can
    // sit at the exact same pixels (e.g. a flipped voice-2 bracket landing on top of
    // voice 1); whichever is drawn last wins, so without this the unselected bracket
    // would paint over the recoloured one and the selection would be invisible.
    this.raiseToFront(group)

    // Paint in the tuplet's own voice colour, matching note/cursor selection.
    const SELECTION_COLOR = voiceFillColor(engine.getTupletVoice(tupletId))

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
    const tempoId = selectedOf(this.state, 'tempo')?.id
    if (!engine || !tempoId) return

    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
    const group = engine.getTempoSVGGroup(tempoId)
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

    // Highlight every selected dynamic: the single-click element selection AND any dynamics
    // pulled into a Shift-click box (kind 'dynamic' items in selectedItems).
    const ids = new Set<string>()
    const singleId = selectedOf(this.state, 'dynamic')?.id
    if (singleId) ids.add(singleId)
    for (const item of this.state.selectedItems.values()) {
      if (item.kind === 'dynamic') ids.add(item.id)
    }
    if (ids.size === 0) return

    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
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

  /**
   * Draw the dashed ATTACHMENT LINE from a selected dynamic to the rhythmic anchor it hangs off
   * (Dorico/MuseScore style — the mark to the note/beat it belongs to). It is a pure VISUALIZATION,
   * never part of the score: not engraved, not hit-tested, not serialized — just a hint that reads
   * "this dynamic is attached HERE", which matters once the mark has been nudged away from its note
   * (docs/dynamic-offset-plan.md). The anchor point is captured at render (DynamicsLayout) and
   * shifted with the bar (offsetElement), so the line tracks a translated measure. Cleared by the
   * next render like every other decoration.
   *
   * Only the single-click element selection gets the line — a Shift-box that swept up several
   * dynamics would otherwise draw a fan of lines. This is the first of what may become a family of
   * toggleable "guide" overlays (rulers, markers…); keeping it its own method keeps that door open.
   */
  applyDynamicAnchorLine(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const dynamicId = selectedOf(this.state, 'dynamic')?.id
    if (!engine || !scoreCanvas || !dynamicId) return
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const entry = engine.getElementRegistry().getById(dynamicId)
    if (entry?.type !== 'dynamic' || !entry.anchor) return

    // From the TOP-RIGHT corner of the dynamic's box up to its note anchor point.
    const fromX = entry.bbox.x + entry.bbox.width
    const fromY = entry.bbox.y
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(fromX))
    line.setAttribute('y1', String(fromY))
    line.setAttribute('x2', String(entry.anchor.x))
    line.setAttribute('y2', String(entry.anchor.y))
    line.setAttribute('stroke', '#2563EB')
    line.setAttribute('stroke-width', '2')
    // Dotted, not dashed: a near-zero dash with a ROUND linecap renders each segment as a round
    // dot of diameter = stroke-width, spaced by the gap.
    line.setAttribute('stroke-dasharray', '0.1 6')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('stroke-opacity', '0.75')
    line.setAttribute('class', 'dynamic-anchor-line')
    // A guide never eats a click meant for the music underneath it.
    ;(line as SVGElement & { style: CSSStyleDeclaration }).style.pointerEvents = 'none'
    this.addNode(svg, line)
  }

  /**
   * Paint the selected hairpin in the voice's colour, inside its OWN `<g class="vf-hairpin">` group.
   *
   * ⭐ Simpler than the slur's twin above in exactly two ways, both of them real rather than
   * accidental. There is no multi-select branch: a Shift-click box pulls dynamics and slurs into
   * `selectedItems`, and a hairpin is not among them yet — when it is, this grows the same loop.
   * And there are no HANDLES: a slur's endpoints are draggable because its shape is cosmetic, while
   * a hairpin's extent is musical and moves with `Ctrl+←/→` on the model
   * (docs/dynamics-line-and-hairpins-plan.md §4).
   */
  applyHairpinSelectionHighlight(): void {
    const engine = this.getEngine()
    const id = selectedOf(this.state, 'hairpin')?.id
    if (!engine || !id) return
    const group = engine.getHairpinSVGGroup(id)
    if (!group) return

    const hairpin = engine.getHairpinById(id)
    const SELECTION_COLOR = voiceFillColor(hairpin?.voice ?? 0)
    // The wedge is STROKED, never filled (two open polylines — see `HairpinRenderer`), so unlike the
    // slur only the stroke needs overriding. Setting `fill` as well would paint the triangle the
    // two arms enclose, which is not ink the score has.
    group.querySelectorAll('path').forEach(el => {
      this.setAttr(el, 'stroke', SELECTION_COLOR)
      this.setStyleProp(el, 'stroke', SELECTION_COLOR)
    })
  }

  /**
   * A selected TRILL, recoloured.
   *
   * ⚠️ **The trill is drawn as TEXT, not as paths** — the `tr` and every wiggle repeat are `<text>`
   * glyphs (`TrillRenderer`) — so unlike the hairpin beside it, `fill` is what carries the colour
   * and `stroke` would do nothing. Getting this backwards fails silently: the selection simply
   * would not show.
   *
   * ⭐ Every fragment lives in the SAME group even when the ornament repeats on a later system
   * (`trillGroupMap`), so colouring the group colours the whole trill — which is right, because the
   * repeat is one ornament and selecting either piece selects it.
   */
  /**
   * ⭐ **The one selected element drawn in BOTH kinds of ink**, and the reason this cannot be either
   * neighbour's function: the numeral (and its continuation parens) are `<text>` that must be
   * FILLED, while the dashed line and the hook are `<path>`s that must be STROKED. The trill
   * recolours text only (its wiggle is glyphs); the hairpin recolours stroke only (its wedge is two
   * open polylines, and filling them would paint the triangle they enclose — ink the score does not
   * have). An octave line is both at once, so it sets each on the elements that carry it.
   *
   * ⚠️ The colour is voice 0's rather than the object's, because an ottava HAS no voice: it governs
   * the staff, whose music may be in any of them (see `Ottava.staffId`). Colouring it by the voice
   * of whatever happened to be under it would say something the model does not.
   */
  applyOttavaSelectionHighlight(): void {
    const engine = this.getEngine()
    const id = selectedOf(this.state, 'ottava')?.id
    if (!engine || !id) return
    const group = engine.getOttavaSVGGroup(id)
    if (!group) return

    const SELECTION_COLOR = voiceFillColor(0)
    group.querySelectorAll('text').forEach(el => {
      this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el, 'fill', SELECTION_COLOR)
    })
    group.querySelectorAll('path').forEach(el => {
      this.setAttr(el, 'stroke', SELECTION_COLOR)
      this.setStyleProp(el, 'stroke', SELECTION_COLOR)
    })
  }

  applyTrillSelectionHighlight(): void {
    const engine = this.getEngine()
    const id = selectedOf(this.state, 'trill')?.id
    if (!engine || !id) return
    const group = engine.getTrillSVGGroup(id)
    if (!group) return

    const trill = engine.getTrillById(id)
    const SELECTION_COLOR = voiceFillColor(trill?.voice ?? 0)
    group.querySelectorAll('text').forEach(el => {
      this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el, 'fill', SELECTION_COLOR)
    })
  }

  applySlurSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Highlight every selected slur: the single-click element selection (which also gets
    // draggable handles) AND any slur fully covered by a Shift-click box (kind 'slur' items in
    // selectedItems, colour only — no handles).
    const ids = new Set<string>()
    const singleSlurId = selectedOf(this.state, 'slur')?.id
    if (singleSlurId) ids.add(singleSlurId)
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
    const slur = selectedOf(this.state, 'slur')
    if (!engine || !scoreCanvas || !slur) return
    // No slur geometry editing in linear view. A slur's control points are a 2-D shape relative
    // to endpoints whose horizontal span differs between the views, so a curve tuned against
    // unjustified linear spacing looks wrong once the line is justified — read-only here is the
    // end state, not a phase-1 shortcut (docs/linear-view-plan.md §4.2–4.3). Drawing no handles
    // is also what keeps them out of the registry, so there is nothing to grab.
    if (engine.getViewMode() === 'linear') return
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const registry = engine.getElementRegistry()
    const partials = registry.getByType('slur').filter(e => e.id === slur.id)
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
          slurId: slur.id,
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
        const selected = which === slur.endpoint
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
          slurId: slur.id,
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
    const armed = slur.segmentEndpoint
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
          slurId: slur.id,
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
