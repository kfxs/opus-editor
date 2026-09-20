import { passageOf } from './measurePassage'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { keySignatureStavesAt } from './keySignatureScope'
import { activeVoiceToModel, selectedOf } from './EditorState'
import { navBeatMap } from '../utils/beatMap'
import { voiceFillColor } from '../utils/voiceColors'
import { ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_STROKE } from '../utils/selectionColors'
import { staffOf } from '@/utils/lanes'
import type { HighlightContext } from './elements/highlightContext'
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
      raiseToFront: group => this.raiseToFront(group),
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
}
