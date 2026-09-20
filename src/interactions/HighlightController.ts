import { passageOf } from './measurePassage'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { keySignatureStavesAt } from './keySignatureScope'
import { activeVoiceToModel, selectedIdsOf, selectedOf } from './EditorState'
import { navBeatMap } from '../utils/beatMap'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'
import { ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_STROKE, markSelectionColor } from '../utils/selectionColors'
import { tremoloGlyph } from '../utils/tremoloGlyphs'
import { TREMOLO_PAIR_GROUP } from '../utils/tremoloPair'
import { staffOf } from '@/utils/lanes'
import { HANDLE_HIT, HANDLE_R } from './elements/handleSquare'
import type { HighlightContext } from './elements/highlightContext'
import { pedalTethers, tetherDashArray, TETHER_HIT } from './elements/pedalTether'
import { pedalStaffSpacePx } from './pedalLane'
import type { MarkKind } from './enclosedMarks'
import type { SignHalf } from '@/engine/layout/barlineSign'
import { scoreTextClass } from '@/engine/rendering/ScoreHeaderPass'

/**
 * ⭐ **The weight a selected line is drawn at, in px** — the width the barline highlight has had
 * since it shipped (`docs/barline-selection.md`), kept when it became a recolour. Thin ink reads
 * paler than a filled glyph at the same hue, and 2 px is what made a selected barline read as
 * selected. See {@link HighlightController.thickenToHighlightWeight}.
 */
const HIGHLIGHT_WEIGHT_PX = 2

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
      controller: this,
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
    // ⭐⭐ **A `single` passage spans a RANGE of staves, not one** — his report of 2026-08-29, where a
    //   shift-click onto the staff below had to select *"the measure but in both staves"*. The two
    //   ends are normalised by `interactions/measurePassage`, the same call the selection itself
    //   makes, so ⭐ **the box and the selected ids cannot disagree** — the highlight promises the copy.
    const passage = passageOf(range)
    const lines = new Map<number, { left: number; right: number; top: number; bottom: number }>()
    for (let m = lo; m <= hi; m++) {
      const rect = engine.getMeasureRect(m)
      if (!rect) continue
      const topGeo = isSingle
        ? (registry.getStaffGeometry(m, passage.fromStaff) ?? registry.getStaffGeometry(m, 0))
        : registry.getStaffGeometry(m, 0)
      const bottomGeo = isSingle
        ? (registry.getStaffGeometry(m, passage.toStaff) ?? topGeo)
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
    // `<g class="stavenote">`, so confining the recolor to that group makes the
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
      const heads = memberInfo.group.querySelectorAll('g.notehead')
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
      // this rest: an Annotation modifier renders its `<g class="annotation">` glyph NESTED
      // inside the rest's `stavenote` group, so the broad `text, path` sweep would recolor the
      // (unselected) dynamic too — the bleed the user saw when selecting a rest that carries a
      // dynamic. The dynamic owns its own selection highlight (applyDynamicSelectionHighlight).
      group.querySelectorAll('text, path').forEach(el => {
        if (el.closest('.annotation')) return
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
    const noteheads = group.querySelectorAll('g.notehead')
    const target = noteheads[noteIndex] ?? (noteheads.length === 1 ? noteheads[0] : null)
    const head = target
      ? target.querySelector('text, path')
      : group.querySelector('g.notehead text, g.notehead path')
    if (head) colorFill(head)

    // Also light this note's accidental (♯/♭/♮), articulations, dots, tie and tremolo, so a selected
    // note reads as fully selected — head + stem + accidental + articulations + dots + tie + mark.
    this.highlightNoteAccidental(noteId, group, SELECTION_COLOR)
    this.colorNoteArticulations(noteId, SELECTION_COLOR)
    this.colorNoteDots(noteId, SELECTION_COLOR)
    this.colorNoteTie(noteId, SELECTION_COLOR)
    this.colorNoteTremolo(noteId, SELECTION_COLOR)

    // Multi-voice unison: the other voice draws a notehead at the SAME pixel spot in a
    // sibling `stavenote` group. Whichever is later in the DOM paints on top, so the
    // recolored head can be hidden behind the other voice. Raise this note's group to
    // the front of its parent so its (now coloured) head is the one that shows;
    // clearHighlights restores the original sibling order.
    this.raiseToFront(group)
  }

  /**
   * Colour the accidental(s) belonging to a selected note in the note's selection colour. The
   * accidental glyph lives inside the note's own `stavenote` group, so we scope the search there
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
   * `notehead` group — NoteHead.draw() opens the group, draws the head, then calls
   * stavenote.drawModifiers(this) before closing it. So an articulation lives at
   * `stavenote > notehead[noteIndex] > <text>`, scoped to the very note it belongs to;
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

    // ⭐ A FANNED MEMBER's marks are not in a `notehead` at all — VexFlow never drew that head, so
    // `FanPass` paints the whole member (head, sign, ledgers, stem AND its articulations) into its
    // own `fanhead` group. Same search, one group over; without this a member's mark was drawn
    // and registered and selectable but never lit up.
    const memberGroup = engine.getFanMemberSVGGroup(noteId)?.group
    let scope: Element | null = memberGroup ?? null
    if (!scope) {
      const groupInfo = engine.getStaveNoteSVGGroup(noteId)
      if (!groupInfo) return
      const noteheadGroups = groupInfo.group.querySelectorAll('g.notehead')
      scope = noteheadGroups[groupInfo.noteIndex] ?? noteheadGroups[0] ?? null
    }
    if (!scope) return

    const glyphEls = scope.querySelectorAll<SVGGraphicsElement>('text, path')
    // In a `notehead` the head is drawn FIRST and is skipped by index; a member's group has its
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
   * Scoped to the whole `stavenote` group, NOT to one `notehead` like articulations are: a
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
   * Highlight the selected STEM — its own paths inside the note's `stavenote` group, in the
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
   * `stavenote` group whose content is the tremolo codepoint, so matching the character picks all
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
   * in the note's `stavenote` group to begin with. So the renderer PAINTS them into a named group
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
    const wanted = `${TREMOLO_PAIR_GROUP}-${noteId}`
    for (const group of scoreCanvas.querySelectorAll(`.${TREMOLO_PAIR_GROUP}`)) {
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

  /** Colour the tie inside its OWN `<g class="tie">` group — never a document-wide
   *  bbox path-scan, which bled onto staff lines whose bbox fell inside the tie's
   *  rectangle (mirrors the slur fix). An arc emits TWO paths — a stroke-only outline
   *  and a fill-only body (`engrave/curves/curveInk`) — so set fill AND stroke on each,
   *  or a selected tie shows a coloured body with a black outline (see curveArc.ts). */
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

      // 🚨🚨 **THROUGH THE CTM, because a SMALL staff draws inside `scale(k)`** — his report,
      //    2026-08-28: *"on small staff the time signature is not highlited."* `getBBox()` answers in
      //    the element's OWN user space, which for a 0.7 staff is 1/0.7 of the page, while the
      //    registry's box is SVG space (the registry scales its records out — `ElementRegistry.
      //    withScale`). Comparing the two directly is `docs/staff-size-plan.md`'s named bug class:
      //    "visual coords in a scaled scope".
      //
      // ⚠️ It went unseen because it was HIDDEN BY A LOOSE BOX: the meter's hit box used to be a
      //    30 px region and overlapped the mis-mapped centre anyway. The moment that box became the
      //    digits' own ink (17 px, 2026-08-28) the mismatch had nowhere to hide — a tighter box makes
      //    a wrong coordinate visible, which is worth remembering as a pair.
      //
      // ⭐ `getCTM()` is the element→viewport matrix, so this is the e2e suite's own rule (⛔ never
      //    compare an untransformed `getBBox()` across a scaled group) applied in app code. jsdom
      //    answers null and cannot measure glyphs at all, so the fallback is the raw box.
      const ctm = (el as SVGGraphicsElement).getCTM?.()
      const rawX = elBBox.x + elBBox.width / 2
      const rawY = elBBox.y + elBBox.height / 2
      const cx = ctm ? ctm.a * rawX + ctm.c * rawY + ctm.e : rawX
      const cy = ctm ? ctm.b * rawX + ctm.d * rawY + ctm.f : rawY
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
   * Highlight the selected barline — the sign at the boundary that ENDS the selected measure.
   *
   * ⭐⭐ **IT COLOURS THE SIGN WE DREW, whatever that sign is.** 🚨 **His report, 2026-08-26** —
   * *"when i select a barline the highlight is a little bit confusing… are we overlapping the blue
   * to another black barline?"*, and then *"why was the highlight before starting this project
   * better than now?"* Both were right, and the second names the cause exactly.
   *
   * This used to PAINT one 2 px rect at `noteEndX`, which was correct while every barline was
   * VexFlow's 1.6 px line — the rect covered it, and the line read blue. P2 made us draw the signs
   * ourselves, and a sign is much more ink: a final bar is thin (0.16) + gap (0.32) + THICK (0.50),
   * all of it to the LEFT of the boundary, and an end repeat adds two dots 1.5 spaces out. The 2 px
   * rect then covered the last half-pixel of the thick line and laid the rest of itself on blank
   * staff to the RIGHT of the sign — a blue sliver beside a black sign, which is what he saw.
   *
   * ⚠️ **This is a RECOLOUR, and the rule it looks like it breaks does not apply to it.**
   * `docs/barline-selection.md` §3 says PAINT, don't RECOLOUR — but read what that rule is about:
   * recolouring **VexFlow's** nodes. Every failure it lists is a *finding* failure of that DOM (one
   * barline was two rects, the second not always in the group you expect, and the coordinates lie on
   * a bar that was reused and translated). None of it survives P2:
   *
   *  - the sign is ONE group of ours, `barline-<measure>-<staff>-<side>`, with an id we chose;
   *  - the pass is rebuilt from scratch every render, from the PLACEMENT and not from a stale stave
   *    ({@link BarlinePlacement}), so there is nothing stale to find and no coordinate to trust —
   *    this method reads no geometry at all now;
   *  - and colouring the group's own ink cannot miss a half of the sign, because the sign IS the
   *    group. The dots come with it, still drawn by the font.
   *
   * ⭐ **Which group.** A boundary carries ONE sign (`signAtBoundary`): normally the one bar *N*
   * draws at its end, but when bar *N+1* opens a repeat there, bar *N* draws nothing and the sign is
   * the neighbour's `-start`. So: bar *N*'s end group, else bar *N+1*'s start group. ⛔ Never both —
   * a displaced `|:` (one pushed past a clef, `BarlineRenderer.displacedRepeatX`) is not at this
   * boundary at all, and bar *N* keeps its own line there, which the first branch already found.
   *
   * Drawn on EVERY staff of that measure, like the time signature's highlight and for the same
   * reason: one barline, stated once for the system, drawn once per staff.
   */
  applyBarlineSelectionHighlight(): void {
    const measure = selectedOf(this.state, 'barline')?.measure ?? null
    if (measure === null) return
    // The END half: the sign's ink LEFT of the divider, plus the divider itself — on the staff, and
    // in the gap below it when the two are joined.
    this.recolourBarlineHalf('end', (svg, staff) => [
      this.barlineSignGroup(svg, measure, staff),
      this.barlineGapGroup(svg, measure, staff),
    ])
  }

  /**
   * ⭐⭐ **THE OPEN REPEAT'S OWN HIGHLIGHT** — the `|:` that opens a bar, lit without lighting the
   * end repeat it may be standing back-to-back with.
   *
   * ⭐ **WHICH GROUP.** The sign is drawn by whichever bar owns the pen at that spot, which is not
   * always the bar it belongs to: a displaced `|:` (pushed past its own clef/meter) and a
   * system-opening one are drawn by their OWN bar as its `-start` group; a `|:` standing on an
   * ordinary boundary is drawn by the PREVIOUS bar, inside that bar's `-end` group, either alone or
   * as the right half of a `:||:`. So: this bar's start group, else the previous bar's end group —
   * the mirror of {@link barlineSignGroup}, and `data-half` is what keeps the second case honest.
   */
  applyRepeatStartSelectionHighlight(): void {
    const measure = selectedOf(this.state, 'repeatStart')?.measure ?? null
    if (measure === null) return
    this.recolourBarlineHalf('start', (svg, staff) => [
      this.signGroupById(svg, `${measure}-${staff}-start`) ?? this.signGroupById(svg, `${measure - 1}-${staff}-end`),
      // …and the same line's ink in the gap below that staff, filed by the bar that drew it.
      this.signGroupById(svg, `gap-${measure}-${staff}-start`) ?? this.signGroupById(svg, `gap-${measure - 1}-${staff}-end`),
    ])
  }

  /**
   * ⭐ **THE KEY SIGNATURE, LIT** — the row of signs at the head of the selected bar, on the staff it
   * was clicked on.
   *
   * ⭐ **It recolours OUR OWN GROUP's ink**, the barline's treatment and not the clef's: `keysig-<measure>-<staff>`
   * is a group this repo's own pass opened, rebuilt from scratch every render, holding exactly the
   * signs of one signature and nothing else. So there is no bbox scan to mis-aim and no neighbour to
   * bleed onto — the two failure modes {@link applyClefSelectionHighlight}'s glyph scan has to guard
   * against by scoping itself to a measure group.
   *
   * ⭐⭐ **EVERY STAFF THAT SAYS THE SAME THING — his report, 2026-08-28:** *"the key is for all the
   * staves in this case however when i selected it only select the first stave."* Dead right. A key is
   * STORED per staff (that is what lets Bartók's two hands differ), but a plain drop writes them all,
   * so what stands at that bar is normally ONE statement drawn N times — exactly the time signature's
   * and the barline's case, and both of those light every staff.
   *
   * ⭐ **So the scope is READ FROM THE MODEL rather than assumed either way**
   * ({@link keySignatureStavesAt}): every staff whose signature at this bar IS the selected one. Two
   * staves in different keys light separately, because they are two statements; two staves in the same
   * key light together, because they are one. ⛔ Not "all staves" and ⛔ not "the clicked staff".
   *
   * ⚠️ Delete reads the SAME predicate, which is the rule that makes this honest — the highlight
   * promises what the edit does (`shortcutWiring`'s `keySignature` case).
   *
   * ⛔ FILL only, no stroke: these are glyphs, and an outlined glyph reads as bold (the note
   * highlight's own rule).
   */
  applyKeySignatureSelectionHighlight(): void {
    const engine = this.getEngine()
    const selected = selectedOf(this.state, 'keySignature')
    const svg = this.getScoreCanvas()?.querySelector('svg')
    if (!engine || !selected || !svg) return
    for (const staff of keySignatureStavesAt(engine, selected.measure, selected.staff)) {
      // ⭐⭐ **BOTH PIECES OF ITS INK.** A change that lands on a system break is engraved twice — the
      //    CAUTIONARY at the end of the previous line and the signature at the head of the new one
      //    (Gould p. 93) — and they are ONE statement, so selecting it lights both. His report,
      //    2026-08-28: *"the cautionary is not clickable and neither selectable."*
      //
      // ⚠️ The caution group is filed under the bar that DRAWS it, which is the bar BEFORE the change
      //    — that asymmetry is the pass's (`KeySignaturePass.drawCautionary`), and it is why this is
      //    two lookups rather than one id built from the selection.
      //
      // ⭐ The group's existence IS the "was this painted?" test — the pass draws one only for ink it
      //    actually put on the page (`ElementRegistry`'s `keySignature` note).
      const groups = [
        svg.querySelector<SVGGElement>(`[id="keysig-${selected.measure}-${staff}"]`),
        svg.querySelector<SVGGElement>(`[id="keysig-caution-${selected.measure - 1}-${staff}"]`),
      ]
      for (const group of groups) {
        if (!group) continue
        // ⛔ `text` only, never `rect`: the caution group also holds the five rects of the OPEN STAFF
        //    TAIL it draws, and recolouring the staff would paint a blue box under the signs.
        for (const el of group.querySelectorAll('text, path')) {
          this.setAttr(el as SVGElement, 'fill', ELEMENT_SELECTION_FILL)
          this.setStyleProp(el as SVGElement, 'fill', ELEMENT_SELECTION_FILL)
          this.addClass(el as SVGElement, 'selected-keysig')
        }
      }
    }
  }

  /**
   * 🚧 **THE SKETCHED HEADER LINE, LIT** — the title or the composer at the head of the first page,
   * recoloured in the element-selection ink (`engine/rendering/ScoreHeaderPass`; ⛔ read its note
   * before building on it).
   *
   * ⭐ It lights only the line that was SELECTED, which is what makes the two separable at all: the
   * class the pass wrote onto each `<text>` names its field, so the selection's own `field` finds
   * exactly one of them.
   *
   * ⭐ FILL only, never a stroke. It is text: an outlined glyph reads as BOLD, which is the mistake
   * the note highlight names out loud, and it would be worse on a 4.4-space title than anywhere.
   */
  applyScoreTextSelectionHighlight(): void {
    const selected = selectedOf(this.state, 'scoreText')
    if (!selected) return
    const text = this.getScoreCanvas()
      ?.querySelector('svg')
      ?.querySelector(`.${scoreTextClass(selected.field)}`) as SVGElement | null
    if (!text) return
    this.setAttr(text, 'fill', ELEMENT_SELECTION_FILL)
    this.setStyleProp(text, 'fill', ELEMENT_SELECTION_FILL)
  }

  /**
   * ⭐⭐ **PAINT ONE HALF OF A SIGN** — the shared body of the two highlights above, and the answer
   * to *"when we have open+end and I choose it, it highlights everything but it should highlight just
   * the part that was clicked"* (his report, 2026-08-26).
   *
   * ⭐ **The rule is `SignHalf`'s, read off the ink and not re-derived here:** every rect and glyph the
   * pass drew carries a `data-half` saying whose statement it is — `end` left of the divider, `start`
   * right of it, `shared` for the divider itself. This lights `half` **plus `shared`**, so each
   * selection at a `:||:` gets a COMPLETE repeat sign: its dots, its thin stroke, and the thick line
   * the two designs share (Gould p. 234's design (A) is one shared divider, not two whole signs).
   *
   * ⭐⭐ **AND NEVER A FRAGMENT OF ONE — his correction, 2026-08-26:** *"I can highlight on an open or
   * on a close just the thick part or the thick with the points… this is incorrect, we should always
   * highlight the music semantic and no part of it."* The first draft of this could show a bare thick
   * line, in the one case where a bar OWNS NO INK at the boundary it ends: bar *N+1*'s `|:` replaces
   * bar *N*'s plain line entirely (`signAtBoundary`), so all that was left to light was the divider.
   *
   * ⭐ So: **a selection with no ink of its own here lights the WHOLE sign standing on its line.** Bar
   * *N* said nothing, and the honest answer to "what is drawn at the line you picked?" is the whole
   * `|:` — not the 0.5 spaces of it that happen to sit on the boundary. ⚠️ It changes nothing in the
   * other three cases: a plain line and a bar's own `:|`/final already light in full, because a sign
   * nobody shares is entirely its owner's.
   *
   * ⚠️ Untagged ink lights with either half, deliberately: a fallback that shows too much is a
   * selection you can see, where one that shows too little is the bug being fixed.
   *
   * Drawn on EVERY staff of that measure, like the time signature's highlight and for the same
   * reason: one barline, stated once for the system, drawn once per staff.
   */
  private recolourBarlineHalf(
    half: SignHalf,
    groupFor: (svg: Element, staff: number) => (SVGGElement | null)[],
  ): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const staffCount = engine.getScore().staves?.length ?? 1
    for (let staff = 0; staff < staffCount; staff++) {
      // The group's existence IS the "is this bar on screen" test — the pass draws one only for a
      // boundary it actually painted, which is what `registry.isPainted` used to be asked here.
      //
      // ⭐⭐ **SEVERAL GROUPS, because one line is now drawn in several pieces.** A joined barline is
      // this staff's own sign PLUS the segment crossing the gap below it, which cannot be drawn in
      // the staff's scale group and so is a group of its own (`engine/rendering/barlineGap`). They
      // are one line to the eye and must be one line to the selection: lighting only the sign leaves
      // black ink between the staves, which is his *"are we overlapping the blue to another black
      // barline?"* report arriving in a new place.
      const groups = groupFor(svg, staff).filter((g): g is SVGGElement => g !== null)
      if (groups.length === 0) continue
      const ink = groups.flatMap(g => [...g.querySelectorAll('rect, text')]) as SVGElement[]
      const halfOf = (el: SVGElement) => el.closest('[data-half]')?.getAttribute('data-half')
      // ⭐ Whether this selection owns any of the sign at all — see the header. When it does not, the
      // whole sign is what stands on its line, and lighting the divider alone would be the fragment.
      const ownsInk = ink.some(el => halfOf(el) === half)
      for (const el of ink) {
        const own = halfOf(el)
        if (ownsInk && own !== null && own !== undefined && own !== half && own !== 'shared') continue
        // Both ways, like every other recolour here: the attribute is what VexFlow's own context
        // wrote, and the style property is what wins if a rule ever sets one.
        this.setAttr(el, 'fill', ELEMENT_SELECTION_FILL)
        this.setStyleProp(el, 'fill', ELEMENT_SELECTION_FILL)
        this.addClass(el, 'selected-barline')
        if (el.tagName === 'rect') this.thickenToHighlightWeight(el)
      }
    }
  }

  /**
   * ⭐⭐ **NO PART OF A SELECTED SIGN IS THINNER THAN {@link HIGHLIGHT_WEIGHT_PX} of blue** — grown
   * symmetrically, so the stroke stays where it is drawn.
   *
   * ⭐ **HIS CALL, and it is the right reading of the old rule:** *"why not make the highlight 2px
   * again? what was wrong was the black, correct?"* Yes. The 2 px was never the problem — the old
   * mark was a SEPARATE rect that missed the sign and left black beside it, and the note that said a
   * selected barline must not look heavier was answering *"should we paint a fatter line ON TOP of
   * the engraved one?"*. This is a different question: the drawn stroke itself is the blue, and 1.6
   * px of blue on white paper simply reads paler than the meter's big filled glyph beside it — his
   * report, twice.
   *
   * ⛔ Only ever GROWS, and only what is thinner: a final bar's 0.5-space thick line is already
   * heavier than this and must not be touched, or the sign's own proportions change under selection.
   * ⚠️ The width goes back on `clearHighlights` like every other attribute here ({@link setAttr}),
   * and the next render redraws the sign from the pass anyway.
   */
  private thickenToHighlightWeight(rect: SVGElement): void {
    const width = Number(rect.getAttribute('width'))
    if (!Number.isFinite(width) || width >= HIGHLIGHT_WEIGHT_PX) return
    const grow = HIGHLIGHT_WEIGHT_PX - width
    this.setAttr(rect, 'x', String(Number(rect.getAttribute('x')) - grow / 2))
    this.setAttr(rect, 'width', String(HIGHLIGHT_WEIGHT_PX))
  }

  /** The `<g>` holding the sign drawn at the boundary that ends `measure` on `staff` — bar N's own
   *  end sign, or the start repeat its neighbour drew there instead. Null when nothing was drawn
   *  (the bar is culled, or off the last system). The ids are `BarlineRenderer`'s. */
  private barlineSignGroup(svg: Element, measure: number, staff: number): SVGGElement | null {
    return this.signGroupById(svg, `${measure}-${staff}-end`)
      ?? this.signGroupById(svg, `${measure + 1}-${staff}-start`)
  }

  /**
   * {@link barlineSignGroup}'s twin for the ink BELOW that staff — the piece of the same line
   * crossing into the gap, when the two staves are joined (docs/barline-join-plan.md).
   *
   * ⭐ Deliberately the same two-lookup rule and the same order, because it is the same question:
   * a boundary carries one sign, drawn either by the bar that ends there or by the bar that opens a
   * repeat there, and the gap segment is filed under whichever of the two put the pen down. Null
   * whenever the gap is not joined, the staves are not drawn, or this is the bottom staff — the
   * group's existence is the whole test, exactly as above.
   */
  private barlineGapGroup(svg: Element, measure: number, staff: number): SVGGElement | null {
    return this.signGroupById(svg, `gap-${measure}-${staff}-end`)
      ?? this.signGroupById(svg, `gap-${measure + 1}-${staff}-start`)
  }

  /** One drawn sign's `<g>` by the tail of its id. The ids are `BarlineRenderer`'s.
   *
   *  ⚠️ `[id="…"]`, not `#…`: an id SELECTOR takes a `getElementById` fast path that answers for the
   *  FIRST match in the DOCUMENT and then checks containment — so with two scores mounted (or two
   *  test fixtures left in the body) it returns null for a group that is right here. */
  private signGroupById(svg: Element, id: string): SVGGElement | null {
    return svg.querySelector<SVGGElement>(`[id="barline-${id}"]`)
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
   * TempoLayout opens (`#<id>`), since VexFlow's StaveTempo opens none — so the colour
   * can't bleed onto neighbouring marks. DOM `fill`, never VexFlow `setStyle`: setStyle
   * leaks the colour into the shared draw context and grays the rest of the score.
   */
  applyTempoSelectionHighlight(): void {
    for (const id of this.selectedIdsOf('tempo')) this.recolorTempo(id)
  }

  /** Paint one tempo mark — its whole drawn text — inside its own group. */
  private recolorTempo(id: string): void {
    const engine = this.getEngine()
    if (!engine) return

    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
    const group = engine.getTempoSVGGroup(id)
    if (!group) return
    group.querySelectorAll('text, path').forEach(el => {
      const currentFill = el.getAttribute('fill')
      if (currentFill !== 'none') this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el as SVGElement, 'fill', SELECTION_COLOR)
      this.addClass(el, 'selected-tempo')
    })
  }

  /**
   * ⭐ **EVERY id of `kind` that is SELECTED** — the ONE element a click picked, plus every one a
   * passage box dragged into `selectedItems` (`./enclosedMarks`). Seven kinds ask this exact
   * question here, and `markVoiceScope` asks it too, which is why the answer now lives on
   * `EditorState` beside `selectedOf`; this stays as the local name the recolours read.
   *
   * ⚠️ The box members get COLOUR only. Handles (a slur's endpoints, a span's two squares) stay on
   * the single-click selection: they are for editing ONE mark, and a bar's worth of squares would
   * be unreadable — and unclickable, since they overlap.
   */
  private selectedIdsOf(kind: MarkKind): Set<string> {
    return selectedIdsOf(this.state, kind)
  }

  applyDynamicSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    // Highlight every selected dynamic: the single-click element selection AND any dynamics
    // pulled into a box ({@link selectedIdsOf}).
    const ids = this.selectedIdsOf('dynamic')
    if (ids.size === 0) return

    for (const id of ids) {
      // ⭐ THE COLOUR IS THE MARK'S OWN, asked per id rather than hoisted out of the loop: a box can
      // sweep up a staff-wide `p` and a voice-2 `f` together, and they do not paint alike
      // (`markSelectionColor`, P2 of docs/dynamic-voice-scope-plan.md).
      const SELECTION_COLOR = markSelectionColor(engine.getDynamicById(id) ?? {})
      // Recolor inside the dynamic's OWN <g class="annotation"> group only, so it
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
   * Draw the dashed ATTACHMENT LINE from the selected element to the rhythmic anchor it hangs off
   * (Dorico/MuseScore style — the mark to the note/beat it belongs to). It is a pure VISUALIZATION,
   * never part of the score: not engraved, not hit-tested, not serialized — just a hint that reads
   * "this is attached HERE", which matters once the mark has been nudged away from its note
   * (docs/dynamic-offset-plan.md). Both endpoints are captured at render and shifted with the bar
   * (`offsetElement`), so the line tracks a translated measure. Cleared by the next render like
   * every other decoration.
   *
   * ⭐⭐ **KIND-AGNOSTIC, and that is the 2026-08-17 change** — his question: *"what about the rest
   * of the elements? the anchor line is not just for dynamic."* It was `applyDynamicAnchorLine` and
   * asked the state for a selected DYNAMIC. It now asks for whatever is selected and draws the line
   * if the render captured a pair of endpoints for it, so a second kind is TWO edits and neither is
   * here: the renderer that draws it captures `anchor` (+ `guideFrom`) into its registry entry, and
   * the kind's row in `ELEMENT_SPECS` calls this from its `highlight`. ⛔ Not a per-kind method
   * each, and ⛔ not a switch — the two families of guide MuseScore has (to the staff at the
   * segment's x, or to the parent chord) are a choice made where the points are measured.
   *
   * ⏭️ What is still dynamic-only is the SUPPLY: only `DynamicsLayout` captures the points today.
   *
   * Only the single-click element selection gets the line — a Shift-box that swept up several
   * dynamics would otherwise draw a fan of lines. This is the first of what may become a family of
   * toggleable "guide" overlays (rulers, markers…); keeping it its own method keeps that door open.
   */
  applyAnchorGuideLine(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    const selected = this.state.selectedElement
    // ⚠️ `id` rather than a kind: most members of the union carry one, and the ones that do not (a
    // measure range, a tie keyed by its start note) simply never register an anchor, so they fall
    // out here without this having to know which they are.
    const id = selected && 'id' in selected ? selected.id : null
    if (!engine || !scoreCanvas || !id) return
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    // ⭐ EVERY entry registered under this id, not just the first: a SPAN is registered per system
    // fragment, and each fragment's guides are in that system's own coordinates. A fragment with
    // nothing attached simply carries none.
    // ⚠️ The gate is the DATA, not the kind — an element whose render measured no guide has nothing
    // to point at, and a guide is never a guess.
    const guides = engine.getElementRegistry().getAll()
      .filter(el => el.id === id)
      .flatMap(el => el.guides ?? [])
    if (guides.length === 0) return

    // From the START of the mark's INK up to its note anchor point.
    //
    // ⭐ **THE ENDS ARE THE RENDER'S ANSWER, not this method's**, and that is what makes the guide
    // kind-agnostic: `from` is a point on the element's own INK (measured per letter off the font
    // for a dynamic, from the tight extents for a tempo mark, from the drawn tip for a wedge) and
    // `to` is whatever it hangs off (a notehead for a dynamic or a trill, a beat's column at the
    // staff's edge for a tempo mark or a hairpin). Both were his corrections, 2026-08-17: *"change
    // that point to the beginning of the expression"* and *"the anchor line should be measuring ink
    // and not bbox"* — see `docs/dynamic-offset-plan.md` for which kind attaches to what.
    for (const guide of guides) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(guide.from.x))
      line.setAttribute('y1', String(guide.from.y))
      line.setAttribute('x2', String(guide.to.x))
      line.setAttribute('y2', String(guide.to.y))
      line.setAttribute('stroke', '#2563EB')
      line.setAttribute('stroke-width', '2')
      // Dotted, not dashed: a near-zero dash with a ROUND linecap renders each segment as a round
      // dot of diameter = stroke-width, spaced by the gap.
      line.setAttribute('stroke-dasharray', '0.1 6')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('stroke-opacity', '0.75')
      // ⚠️ Still `dynamic-anchor-line`, though four kinds draw it now: it is the class the sweep and
      // the specs already know, and renaming it is a rename in three places for no behaviour.
      line.setAttribute('class', 'dynamic-anchor-line')
      // A guide never eats a click meant for the music underneath it.
      ;(line as SVGElement & { style: CSSStyleDeclaration }).style.pointerEvents = 'none'
      this.addNode(svg, line)
    }
  }

  /**
   * Paint the selected hairpin in the voice's colour, inside its OWN `<g class="hairpin">` group.
   *
   * ⭐ Simpler than the slur's twin above in exactly two ways, both of them real rather than
   * accidental. There is no multi-select branch: a Shift-click box pulls dynamics and slurs into
   * `selectedItems`, and a hairpin is not among them yet — when it is, this grows the same loop.
   * And there are no HANDLES: a slur's endpoints are draggable because its shape is cosmetic, while
   * a hairpin's extent is musical and moves with `Ctrl+←/→` on the model
   * (docs/dynamics-line-and-hairpins-plan.md §4).
   */
  applyHairpinSelectionHighlight(): void {
    for (const id of this.selectedIdsOf('hairpin')) this.recolorHairpin(id)
  }

  /**
   * Paint one hairpin inside its OWN `<g class="hairpin">` group, **in the colour its SCOPE
   * says**: the element ink for a wedge governing the whole staff, that voice's colour for one
   * narrowed to a voice (`utils/selectionColors.markSelectionColor`, P2 of
   * docs/dynamic-voice-scope-plan.md).
   *
   * ⭐ It was the element ink unconditionally (his call, 2026-08-19), and that was right at the
   * time: `Hairpin.voice` answered 0 for a wedge that had never been narrowed at all, so painting
   * by it said "this belongs to voice 1" about a mark that shapes them all. The field now tells
   * those two apart — absent means every voice of the staff — so the SAME rule reads off the data
   * instead of off the kind: **a voice colour is for ink that BELONGS to one voice's notes**, and a
   * wedge scoped to voice 2 is exactly that.
   */
  private recolorHairpin(id: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const group = engine.getHairpinSVGGroup(id)
    if (!group) return

    const SELECTION_COLOR = markSelectionColor(engine.getHairpinById(id) ?? {})
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
   * ⭐ The colour is the ELEMENT ink, not a voice's (his call, 2026-08-19): an ottava HAS no voice —
   * it governs the staff, whose music may be in any of them (see `Ottava.staffId`) — and voice 0's
   * blue was still a VOICE colour, which said "this belongs to voice 1" about a mark that transposes
   * every note under it. See `utils/selectionColors`.
   */
  applyOttavaSelectionHighlight(): void {
    for (const id of this.selectedIdsOf('ottava')) this.recolorOttava(id)
  }

  /** Paint one octave line — its `8va` and its bracket — inside its own group. */
  private recolorOttava(id: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const group = engine.getOttavaSVGGroup(id)
    if (!group) return

    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
    group.querySelectorAll('text').forEach(el => {
      this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el, 'fill', SELECTION_COLOR)
    })
    group.querySelectorAll('path').forEach(el => {
      this.setAttr(el, 'stroke', SELECTION_COLOR)
      this.setStyleProp(el, 'stroke', SELECTION_COLOR)
    })
  }

  /**
   * A SUSTAIN PEDAL — `Ped.`, any `(Ped.)` resumption, and the `✻`, coloured together.
   *
   * ⭐ **TEXT only**, which is the simplest case on this wall and worth saying why: the pedal draws no
   * `path` at all (docs/pedal-plan.md — the two-glyph dress), so unlike the ottava's neighbour above
   * there is no stroke half. ⚠️ The day the bracket style arrives this needs the ottava's second
   * loop, and the `PedalRenderer` change that brings the line is what will make it necessary.
   *
   * ⭐ One group holds every sign the pedal drew, including the ones on other systems, so a broken
   * pedal lights up whole — `pedalGroupMap`'s arrangement.
   *
   * ⭐ The colour is the ELEMENT ink, for the ottava's reason: a pedal HAS no voice — one damper
   * serves the staff, whose music may be in any of them — so a voice colour would say something the
   * model does not. See `utils/selectionColors`.
   */
  applyPedalSelectionHighlight(): void {
    for (const id of this.selectedIdsOf('pedal')) this.recolorPedal(id)
  }

  /** Paint one pedal — its two signs — inside its own group. */
  private recolorPedal(id: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const group = engine.getPedalSVGGroup(id)
    if (!group) return

    const SELECTION_COLOR = ELEMENT_SELECTION_FILL
    group.querySelectorAll<SVGElement>('text').forEach(el => {
      this.setAttr(el, 'fill', SELECTION_COLOR)
      this.setStyleProp(el, 'fill', SELECTION_COLOR)
    })
  }

  /**
   * ⭐⭐ **THE SELECTED PEDAL'S DASHED TETHER** — a broken line in the empty space between `Ped.` and
   * `✻`, so the eye can see which release belongs to which press (his ask, 2026-08-21, and then the
   * look: *"instead of dotted line probably looks better discontinuing lines similar to ottava, but
   * just when is selected of course"*).
   *
   * ⭐ **A HINT, ⛔ not the mark**: it exists only while the pedal is selected and is removed with the
   * rest of the highlight, so the printed dress stays Gould's two signs with nothing between them.
   * The geometry — one segment per ROW, neighbours only — is `elements/pedalTether`'s.
   *
   * ⚠️ It is drawn BEFORE the squares (the call order in `elements/pedal`), so a handle always sits
   * over the line rather than under it.
   *
   * ⭐⭐ **EVERY SELECTED PEDAL GETS ONE, including the ones a PASSAGE BOX swept up** — his report,
   * 2026-08-21: *"why i dont see the dashed line of the pedal when a pedal is selected as part of a
   * passage? the dotted line is an element of the pedal selection so we should always show it."*
   * Right, and it follows from what the tether IS: {@link selectedIdsOf}'s note says a box member
   * gets COLOUR but not HANDLES, because a handle edits ONE mark and a bar's worth of them would be
   * unreadable. A tether edits nothing — it answers *which `✻` belongs to which `Ped.`*, which is a
   * question a box selection asks harder than a click does, since it can hold several pedals at once.
   *
   * ⛔ **The PRESSABLE entry stays on the single-click selection** ({@link selectedOf}), and that is
   * the same line the handles are drawn on. A box member's tether is a picture; making it a press
   * target would let a click inside the passage silently swap the selection for one pedal's drag.
   */
  applyPedalTether(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return
    const armed = selectedOf(this.state, 'pedal')?.id
    for (const id of this.selectedIdsOf('pedal')) {
      this.drawPedalTether(svg, engine, id, id === armed)
    }
  }

  /** One pedal's tether — {@link applyPedalTether}'s body, per id. `pressable` registers the hit
   *  entry, and only the singly-selected pedal gets it. */
  private drawPedalTether(
    svg: SVGSVGElement, engine: MusicEngine, pedalId: string, pressable: boolean,
  ): void {
    const registry = engine.getElementRegistry()
    // ⛔ No fallback size — the tether's dashes are staff-space measures, and a guessed scale would
    // draw a small staff's hint in a normal staff's dashes.
    const staffSpacePx = pedalStaffSpacePx(registry, pedalId)
    if (!staffSpacePx) return

    // ⭐ The registry goes in so a row that carries on to the next system can run its dashes to the
    // line's edge (`elements/pedalTether`, his ask 2026-08-21).
    for (const tether of pedalTethers(registry.getByType('pedal'), pedalId, registry)) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(tether.x1))
      line.setAttribute('x2', String(tether.x2))
      line.setAttribute('y1', String(tether.y))
      line.setAttribute('y2', String(tether.y))
      line.setAttribute('stroke', ELEMENT_SELECTION_FILL)
      line.setAttribute('stroke-width', '1.5')
      line.setAttribute('stroke-dasharray', tetherDashArray(staffSpacePx))
      line.setAttribute('class', 'pedal-tether')
      this.addNode(svg, line)

      // ⭐⭐ …and it is PRESSABLE while it is drawn (his ask, 2026-08-21: *"the dashed line should be
      // selectable too for the draging, now is invisible for the click"*). ⚠️ The entry lives exactly
      // as long as the line does — `clearHighlights` removes it — so the rule *a press may only reach
      // INK* still holds: an unselected pedal owns nothing between its signs.
      if (!pressable) continue
      registry.add({
        type: 'pedal-tether',
        pedalId,
        bbox: {
          x: Math.min(tether.x1, tether.x2),
          y: tether.y - TETHER_HIT,
          width: Math.abs(tether.x2 - tether.x1),
          height: TETHER_HIT * 2,
        },
      })
    }
  }

  applyTrillSelectionHighlight(): void {
    for (const id of this.selectedIdsOf('trill')) this.recolorTrill(id)
  }

  /**
   * Paint one trill — its `tr` and its wavy line — inside its own group.
   *
   * ⭐ **A VOICE colour, and the one in this family that should be** (his call, 2026-08-19): *"a
   * trill is always associated to a note, so the trill has the color of the note voice it is
   * anchored to"*. Its auxiliary is a step above THAT pitch, so it belongs to that note the way an
   * articulation does — where a wedge, an 8va and a pedal govern a region and take the element ink.
   *
   * ⚠️ Read off the anchor NOTE, not `Trill.voice` — the slur's rule (`recolorSlur`) and for its
   * reason: the field is written at creation and a later voice move does not chase it, while the
   * note is the thing the mark actually hangs off.
   */
  private recolorTrill(id: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const group = engine.getTrillSVGGroup(id)
    if (!group) return

    const trill = engine.getTrillById(id)
    const anchorVoice = trill ? engine.getNote(trill.startNoteId)?.voice : undefined
    const SELECTION_COLOR = voiceFillColor(anchorVoice ?? trill?.voice ?? 0)
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
    // draggable handles) AND any slur fully covered by a box ({@link selectedIdsOf}).
    for (const id of this.selectedIdsOf('slur')) this.recolorSlur(id)
  }

  /** Paint one slur in its voice's colour, inside its OWN `<g class="slur">` group only. */
  private recolorSlur(slurId: string): void {
    const engine = this.getEngine()
    if (!engine) return
    // Recolor inside the slur's OWN <g class="slur"> group only — never a
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
    // An arc emits TWO paths — a stroke-only outline and a fill-only body
    // (`engrave/curves/curveInk`) — so set fill AND stroke on each, or a selected slur
    // shows an orange body with a dark outline (see docs/slur-plan.md §7.3). A re-render redraws the slur black, so no explicit
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
  private static readonly SLUR_HANDLE_R = HANDLE_R
  private static readonly SLUR_HANDLE_HIT = HANDLE_HIT

  /** The tint a note wears while it is a slur endpoint's ANCHOR — the blue-square blue, so the note
   *  and the square that points at it read as one thing. Both tinting paths share it: the drag's
   *  candidate and the armed end's standing anchor are the same statement ("this note"), made once
   *  by the mouse and once by the keyboard, and a second hex here would let them drift apart.
   *  ⚠️ NOT `selectionColors`' element blue: this is the slur handles' own colour language (that
   *  module says so — orange = open join, blue = true end), not "something is selected". */
  private static readonly SLUR_ANCHOR_FILL = '#2563EB'
  private static readonly SLUR_ANCHOR_STROKE = '#1D4ED8'

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
        // ⭐ The dot you grabbed reads as PICKED — bigger, a darker amber, a thicker white ring —
        // the round handles' half of what the blue squares have had since the endpoint nudge (his
        // ask, 2026-08-17: *"we do not know when the control points for the arc is selected"*).
        // Matched on the SEGMENT too, not just the index: a cross-system slur draws a pair per
        // system and `cpIndex` alone would light one on each. Cosmetic only — the registry bbox
        // below is untouched, so what you can grab does not change.
        const picked = slur.controlPoint?.cpIndex === i
          && slur.controlPoint.segmentRole === partial.segmentRole
          && slur.controlPoint.segmentOrdinal === partial.segmentOrdinal
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', String(cp.x))
        dot.setAttribute('cy', String(cp.y))
        dot.setAttribute('r', String(picked ? R + 1.5 : R))
        dot.setAttribute('fill', picked ? '#B45309' : '#F59E0B')
        dot.setAttribute('stroke', '#ffffff')
        dot.setAttribute('stroke-width', picked ? '2.5' : '1.5')
        dot.setAttribute('class', picked ? 'slur-handle slur-handle--selected' : 'slur-handle')
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

  /**
   * ⭐ **Tint the note an ARMED slur endpoint is anchored TO** (his ask, 2026-08-18: *"when
   * reanchoring with keyboard we dont highlight the note, i think we should, that is the way to let
   * know the user the new anchor"*).
   *
   * ⭐ **It serves the mouse too, and there is no longer a second tint for that.** The drag used to
   * paint a CANDIDATE — the note it would snap onto if released — because it re-anchored by snapping
   * and the ink jumped there. Since the drag became the same carried move as the arrows
   * (`interactions/slurEndpointWalk`) there is no candidate distinct from the anchor: the anchor
   * follows the ink live, so tinting the anchor IS tinting where the end is going.
   *
   * ⭐ **Standing, not a flash.** A `Ctrl+Shift+←/→` re-anchor could have blinked the note it landed
   * on, but a blink needs a timer, an undo of itself, and a rule for what a second press mid-blink
   * does — and it would answer the question only for the half-second after you asked it. Painting
   * the anchor for as long as the square stays armed is the same information with no lifecycle at
   * all: it is DERIVED from `selectedElement` + the slur, so nothing has to be set, cleared, or kept
   * in step, and a re-anchor shows simply as the tint being on a different note afterwards. It also
   * answers the question BEFORE the first press, which a flash cannot.
   *
   */
  applyArmedSlurAnchorNote(): void {
    const engine = this.getEngine()
    const armed = selectedOf(this.state, 'slur')
    if (!engine || !armed?.endpoint) return
    const slur = engine.getSlurById(armed.id)
    if (!slur) return
    this.highlightNote(
      armed.endpoint === 'start' ? slur.startNoteId : slur.endNoteId,
      HighlightController.SLUR_ANCHOR_FILL,
      HighlightController.SLUR_ANCHOR_STROKE,
    )
  }
}
