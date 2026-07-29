/**
 * THE GHOSTS — every translucent preview the editor draws, extracted from {@link VexFlowRenderer}
 * (docs/refactor-plan-2026-07-27.md Phase 6a). Free functions over the drawing context and the
 * score's `<svg>`, like {@link FanPass} and the tie / slur / dynamics passes.
 *
 * Two families, and the difference between them is where the preview LIVES:
 *
 *  - {@link drawNoteGhost} — the note about to be entered, drawn **in the bar it will land in**. It
 *    therefore needs the render's own layout (which bar sits where, and how far the staff-spacing
 *    overrides push its system down), which is why those arrive as arguments.
 *  - the cursor ghosts (`drawClefGhost`, `drawRestGhost`, `drawDynamicGhost`, …) — ONE glyph shown
 *    loose, following the pointer. They are drawn on a throwaway 0-line stave and translated to the
 *    cursor, so they need nothing from the score at all.
 *
 * Every one of them is an **overlay** (docs/render-performance-plan.md §5b): it draws into its own
 * class-tagged `<g>` appended last, so putting one up or taking it down is a DOM append/remove
 * against the already-drawn score — never a re-layout. `VexFlowRenderer.clearGhosts` is the
 * take-down, and it sweeps exactly the groups named in {@link GHOST_GROUP_SELECTOR}. ⚠️ **A group
 * whose class is not in that list is never removed** — the ghost then smears a trail across the
 * score, one copy per mouse position. Add the class there in the same breath as drawing it.
 *
 * ⚠️ Each takes the previous ghost's take-down and the "is there a page to draw on" check from its
 * caller — `VexFlowRenderer.ghostOverlay` — so every function here starts with a real page and a
 * real context. What each still guards for itself is its own emptiness (a tempo mark with no text,
 * an empty articulation list): that is about the MARK, not about the page.
 */
import { Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Modifier, Dot, Barline, type SVGContext } from 'vexflow'
import type { Score, Clef, GhostNote, TimeSignature, Dynamic, TempoMark, NoteDuration, TremoloMark, PitchStep, Accidental as ScoreAccidental, ArticulationType } from '@/types/music'
import type { ToolGhost } from './ghostTypes'
import { fracToNumber, fracCreate, fracAdd } from '@/utils/fraction'
import { beatToFrac } from '@/utils/musicUtils'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { durationToVexflow, writtenLength } from '@/utils/durations'
import { getMeterInfo, timeSignatureVexKey } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { measureEndingClef, effectiveClefAt, middleLineDiatonicPos, resolveStaffClefs } from '@/utils/clefUtils'
import { spellingToVexflowKey, spellingDiatonicPos, alterToString } from '@/utils/pitchSpelling'
import { staffOf } from '@/utils/lanes'
import { resolveStaffSize } from '@/engine/models/staffSize'
import { staffMeasureView, staffIdAtIndex } from '@/engine/models/staffContent'
import { layoutTupletMark, drawTupletMark } from './ScoreTuplet'
import { CenteredTremolo } from './CenteredTremolo'
import { buildDynamicAnnotation, enlargeDynamicGlyphRuns } from './DynamicsLayout'
import { drawTempoText } from './TempoLayout'
import { convertDuration, restSupportingLedgerLine, drawsTimeSignature, ARTICULATION_RENDER_ORDER } from './NoteBuilder'
import { TIE_BOW } from './TieRenderer'
import { drawCurveArc, CURVE_THICKNESS } from './curveArc'
import { LEDGER_LINE_STYLE, type MeasureWidthInfo, type StaffSpacingLayout } from './layoutConfig'
import type { SurfaceMetrics } from '@/engine/layout/surface'

/**
 * The preview ghosts (note / clef / time-sig / dynamic / tempo …) each draw into their own
 * class-tagged `<g>`, appended last — this is the list `VexFlowRenderer.clearGhosts` sweeps.
 *
 * ⚠️ `vf-ghost-tempo`, not `ghost-tempo`. The hand-built groups below say
 * `setAttribute('class', 'ghost-…-group')`; the ones that go through VexFlow's `openGroup(…)` get
 * the `vf-` prefix from VexFlow itself. The selector used to say `.ghost-tempo`, matched nothing,
 * and so never took a tempo ghost down: they piled up, one per mouse position, as a permanent blue
 * smear. (Nothing swept them either, since P4 made ghosts overlays — hovering no longer forces the
 * full render that used to hide the leak.)
 */
export const GHOST_GROUP_SELECTOR =
  '.ghost-note-group, .ghost-rest-group, .ghost-clef-group, .ghost-timesig-group, .ghost-dynamic-group, .vf-ghost-articulation, .vf-ghost-accidental, .vf-ghost-tie, .vf-ghost-dot, .vf-ghost-tremolo, .vf-ghost-tempo'

/**
 * How far the ghost's tuplet number floats above the note, in STAFF SPACES — measured from the stem
 * tip (stem up) or the notehead (stem down) to the number's baseline.
 *
 * In spaces and not pixels so it holds at any staff size, and ONE knob because both stem directions
 * take the same gap: it is the same "clear of the note" distance, and the anchor is what differs.
 * Tune here.
 */
const GHOST_TUPLET_NUMBER_GAP = 1.5

export function drawNoteGhost(
  ctx: SVGContext,
  svg: SVGElement,
  ghostNote: GhostNote,
  score: Score,
  measureWidths: Map<number, MeasureWidthInfo>,
  /** The render's OWN per-system push-down, so the ghost lands where the committed note will. */
  spacing: StaffSpacingLayout,
  /** The render's OWN surface, for the same reason: the ghost has to stand on the same page the
   *  music does, so it reads the margins from the render rather than from a constant. */
  surface: SurfaceMetrics,
): boolean {
  try {
    const measure = score.measures.find(m => m.number === ghostNote.measure)
    if (!measure) {
      console.warn('Measure not found for ghost note:', ghostNote.measure)
      return false
    }

    const widthInfo = measureWidths.get(ghostNote.measure)
    if (!widthInfo) {
      console.warn('Width info not found for ghost note measure:', ghostNote.measure)
      return false
    }

    // Guard against a malformed spelling (no step) — skip the preview rather
    // than crash the whole score render.
    if (ghostNote.step === undefined) {
      return false
    }

    // Calculate X position by summing widths of previous measures on the same line. The line's own
    // left edge, not a bare margin: under a side-by-side page spread, a system on the second sheet
    // starts a page to the right — and the ghost must stand where the committed note will.
    const lineLeft = spacing.lineLeftPx[widthInfo.lineNumber] ?? surface.marginLeftPx
    let measureX = lineLeft
    for (const m of score.measures) {
      if (m.number === ghostNote.measure) break
      const mInfo = measureWidths.get(m.number)
      if (mInfo && mInfo.lineNumber === widthInfo.lineNumber) {
        measureX += mInfo.finalWidth
      } else if (mInfo && mInfo.lineNumber < widthInfo.lineNumber) {
        measureX = lineLeft
      }
    }

    // The ghost previews entry on the staff the cursor is over (multi-staff): its Y is that
    // staff's row within the system and its clef is that staff's own clef — so the preview lands
    // exactly where the click will place the note.
    const staffIndex = staffOf(ghostNote)
    const staffId = staffIdAtIndex(score, staffIndex)
    // Match the real render's PER-SYSTEM staff-spacing push-down (Client #7) so the
    // translucent ghost lands exactly where the committed note will, on any staff/system
    // with spacing ≠ 0. Resolved against this ghost's own line — and passed IN, because the
    // spacing depends on the view mode and the linear-view knob, which are the renderer's.
    const line = widthInfo.lineNumber
    const systemTop = spacing.lineTopPx[line] ?? surface.marginTopPx
    // The render's own per-staff offset — strides AND space-above, already summed. Recomputing it
    // from `staffIndex × stride` is what would put the ghost on the wrong staff the moment one of
    // them is drawn small (docs/staff-size-plan.md §5).
    const measureY = systemTop + (spacing.staffTopPx[line]?.[staffIndex] ?? 0)
    const staveWidth = widthInfo.finalWidth
    const effectiveClefs = resolveStaffClefs(score, staffId).opening
    const openingClef: Clef = effectiveClefs.get(ghostNote.measure) || 'treble'
    // Match the real stave: only redraw the clef when it changes across the
    // barline (vs the previous measure's ending clef), not opening-to-opening.
    const prevEndClef = ghostNote.measure > 1 ? measureEndingClef(score, ghostNote.measure - 1, staffId) : undefined
    const hasClefChange = prevEndClef !== undefined && openingClef !== prevEndClef
    // The ghost note must be positioned by the clef in effect at its beat
    // (mid-measure changes), not just the measure's opening clef.
    const clef: Clef = effectiveClefAt(score, ghostNote.measure, beatToFrac(ghostNote.beat), staffId)

    // ⭐ The ghost is drawn in ITS STAFF'S own space, like the bar it previews into: the throwaway
    // stave is built at `x/k, y/k, width/k` and the whole ghost group carries `scale(k)`
    // (docs/staff-size-plan.md §4.1, §4.3). Full size, k is 1 and this is the arithmetic it
    // replaced. Get it wrong and the preview is a full-size note over a small staff — the one
    // place where "what you see is what you get" is the entire point of the drawing.
    const scale = staffId ? resolveStaffSize(score, staffId) : 1
    const isFirstInLine = measureX === lineLeft
    // The ghost sits at a real pitch, so it gets real ledger lines — same ink as the engraved ones.
    const tempStave = new Stave(measureX / scale, measureY / scale, staveWidth / scale)
    tempStave.setDefaultLedgerLineStyle(LEDGER_LINE_STYLE)
    if (ghostNote.measure === 1 || isFirstInLine) {
      tempStave.addClef(openingClef)
    } else if (hasClefChange) {
      tempStave.addClef(openingClef, 'small')
    }
    if (drawsTimeSignature(measure)) {
      tempStave.addTimeSignature(timeSignatureVexKey(measure.timeSignature))
    }
    // Match the real stave's note area so the ghost note aligns with where the committed note
    // will land (a cautionary end clef narrows the note area) — and match it on THIS staff, since
    // the courtesy is per staff now and only some staves may carry one.
    const ghostCautionaryClef = widthInfo.cautionaryEndClefs?.[staffIndex]
    if (ghostCautionaryClef) {
      tempStave.addEndClef(ghostCautionaryClef, 'small')
    }
    if (widthInfo.cautionaryEndTimeSig) {
      tempStave.addEndTimeSignature(timeSignatureVexKey(widthInfo.cautionaryEndTimeSig))
    }
    tempStave.setContext(ctx)

    const vexNote = spellingToVexflowKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
    const vexDuration = convertDuration(ghostNote.duration as NoteDuration, ghostNote.dots || 0)

    // Stem direction — same diatonic approach as createStaveNotesFromSlots.
    // Include any existing notes at the same beat so the ghost matches the chord's stem.
    const middleDiatonic = middleLineDiatonicPos(clef)
    let stemDirection = -1  // default down; middle-line notes follow this convention
    let maxDist = 0
    const checkDiatonic = (step: PitchStep, octave: number) => {
      const dPos = spellingDiatonicPos(step, octave)
      const dist = Math.abs(dPos - middleDiatonic)
      if (dist > maxDist) { maxDist = dist; stemDirection = dPos >= middleDiatonic ? -1 : 1 }
    }
    // Only this staff's chords at the beat influence the ghost's stem (a chord on another
    // staff at the same beat is an independent stream).
    for (const slot of staffMeasureView(measure, staffId, score).slots) {
      if (slot.type === 'chord' && Math.abs(fracToNumber(slot.beat) - ghostNote.beat) < 0.001) {
        for (const p of slot.notes) checkDiatonic(p.step, p.octave)
      }
    }
    checkDiatonic(ghostNote.step, ghostNote.octave)

    const staveNote = new StaveNote({
      keys: [vexNote],
      duration: vexDuration,
      clef,
      autoStem: false,
    })
    staveNote.setStemDirection(stemDirection)

    const dots = ghostNote.dots || 0
    for (let d = 0; d < dots; d++) {
      Dot.buildAndAttach([staveNote], { all: true })
    }

    if (ghostNote.alter !== 0) {
      const sign = alterToString(ghostNote.alter)
      staveNote.addModifier(new Accidental(sign), 0)
    } else if (ghostNote.forceAccidental) {
      // Armed natural: alter 0 has no sign of its own, so draw the ♮ explicitly.
      staveNote.addModifier(new Accidental('n'), 0)
    }

    // The armed entry tremolo, through the SAME modifier the engraved mark uses — so the ghost
    // wears its strokes exactly where the committed note will, stem stretches and all. Added
    // before the articulations for no reason but reading order; a tremolo is one modifier and
    // stacks with nothing.
    if (ghostNote.tremolo !== undefined) {
      staveNote.addModifier(new CenteredTremolo(ghostNote.tremolo), 0)
    }

    if (ghostNote.articulations?.length) {
      const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
      const sortedGhostArticulations = ghostNote.articulations.slice().sort(
        (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
      )
      for (const art of sortedGhostArticulations) {
        staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
      }
    }

    // Meter-aware rest fill around the ghost note (same engine as the model).
    // Positions are exact Fractions in quarter-note beats.
    const meter = getMeterInfo(measure.timeSignature)
    const noteStart = beatToFrac(ghostNote.beat)
    const noteEnd = fracAdd(noteStart, writtenLength(ghostNote))

    const makeRest = (r: RestSlot) => {
      const sn = new StaveNote({ keys: ['b/4'], duration: durationToVexflow(r.duration, r.dots) + 'r' })
      if (r.dots) Dot.buildAndAttach([sn], { all: true })
      return sn
    }

    const tickables: StaveNote[] = []
    for (const r of fillRests(fracCreate(0, 1), noteStart, meter)) tickables.push(makeRest(r))
    tickables.push(staveNote)
    for (const r of fillRests(noteEnd, measureCapacityFrac(measure), meter)) tickables.push(makeRest(r))

    // VexFlow wants the literal time signature, not quarter-beats.
    const voice = new Voice({
      numBeats: measure.timeSignature.numerator,
      beatValue: measure.timeSignature.denominator,
    }).setMode(Voice.Mode.SOFT)
    voice.addTickables(tickables)

    const noteAreaWidth = tempStave.getNoteEndX() - tempStave.getNoteStartX()
    const rightPadding = 15
    const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
    new Formatter().joinVoices([voice]).format([voice], formatWidth)

    staveNote.setStave(tempStave)

    let targetShiftX: number | null = null
    if (ghostNote.rawX !== undefined) {
      try {
        // `rawX` is the pointer, in SVG coordinates; `getAbsoluteX` answers in the stave's own.
        // The transform below translates in the PARENT's space, so the note's x has to be carried
        // out of the staff's before the two are subtracted.
        const noteX = staveNote.getAbsoluteX() * scale
        targetShiftX = ghostNote.rawX - noteX
      } catch (_e) {
        // getAbsoluteX might not be available before draw
      }
    }

    const childrenBefore = svg.children.length
    staveNote.setContext(ctx).draw()

    // The armed tuplet's number, over the ghost — "this click STARTS a 5:4", which a notehead
    // alone cannot say. Drawn the way VexFlow draws a real one: a `new Element('Tuplet')`, so the
    // font is whatever `Metrics` says the Tuplet category is (Bravura at its own size) rather
    // than a hardcoded stack that goes stale the day VexFlow retunes, and the text is SMuFL
    // tuplet digits (see tupletMarkText). Same geometry too — VexFlow puts the number a line and
    // a half above the top staff line, less its own textYOffset.
    //
    // Drawn INSIDE the childrenBefore window on purpose: it is then swept into `.ghost-note-group`
    // and tinted with the rest of the ghost by the code below, instead of needing its own
    // teardown. NO bracket: a tuplet's bracket spans notes that do not exist until the click.
    if (ghostNote.tupletLabel?.length) {
      // Laid out by the SAME function the engraved mark uses, so the preview's runs are the page's
      // runs at the page's sizes — a ghost drawn any other way previews a different mark.
      const mark = layoutTupletMark(ghostNote.tupletLabel)
      for (const { el } of mark.pieces) el.setContext(ctx)
      // The number rides the NOTE, not the staff: it floats a fixed gap above whatever the note's
      // highest point is — the stem TIP when the stem is up, the NOTEHEAD when it hangs down.
      //
      // Deliberately NOT VexFlow's own rule, which then clamps the result to at least 1.5 lines
      // above the top staff line: that clamp is right for a real tuplet (a bracket spanning several
      // notes needs one height for all of them) and wrong for a ghost, which is ONE note following
      // the cursor — clamped, the number stops tracking and drifts away from the notehead as you
      // move down the staff.
      const stem = staveNote.getStemExtents()
      const anchorY = !staveNote.hasStem()
        ? Math.min(...staveNote.getYs()) // a whole note: the notehead is the whole of it
        : stemDirection === 1
          ? stem.topY // stem up — the tip is the highest point
          : stem.baseY // stem down — the stem hangs below, so the notehead is
      // Centred on the NOTEHEAD, not on the note's origin: `getAbsoluteX()` is where the note
      // attaches (accidentals and dots push it around), so a number centred there sits off to one
      // side of the head it belongs to. The head's own two edges say where it actually is.
      const headCenterX = (staveNote.getNoteHeadBeginX() + staveNote.getNoteHeadEndX()) / 2
      // Every run centred as ONE mark, on one baseline — see ScoreTuplet.draw.
      drawTupletMark(
        ctx,
        mark,
        headCenterX - mark.width / 2,
        anchorY - GHOST_TUPLET_NUMBER_GAP * tempStave.getSpacingBetweenLines(),
      )
    }

    const newElements: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) {
      newElements.push(svg.children[i])
    }

    if (newElements.length > 0) {
      // ALWAYS wrap, even with no shift to apply: the group is what makes the ghost an
      // overlay — loose elements in the SVG could never be taken down again (P4).
      const ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      ghostGroup.setAttribute('class', 'ghost-note-group')
      // Translate FIRST — it is measured in the parent's space — then the staff's own scale, the
      // same composition `replaySnapshot` uses on a moved bar.
      const shift = targetShiftX !== null ? `translate(${targetShiftX}, 0)` : ''
      const scaled = scale !== 1 ? `scale(${scale})` : ''
      const transform = [shift, scaled].filter(Boolean).join(' ')
      if (transform) ghostGroup.setAttribute('transform', transform)
      for (const element of newElements) {
        svg.removeChild(element)
      }
      for (const element of newElements) {
        ghostGroup.appendChild(element)
      }
      svg.appendChild(ghostGroup)
    }

    // Ghost paints in the active voice's colour (V1 blue / V2 green); default blue.
    const ghostFill = ghostNote.fillColor ?? '#3B82F6'
    const ghostStroke = ghostNote.strokeColor ?? '#2563EB'
    const applyGhostStyle = (element: Element) => {
      const tagName = element.tagName.toLowerCase()
      if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
        element.setAttribute('fill', ghostFill)
        element.setAttribute('stroke', ghostStroke)
        element.setAttribute('opacity', '0.7')
        const currentStyle = element.getAttribute('style') || ''
        element.setAttribute('style', currentStyle + `; fill: ${ghostFill} !important; stroke: ${ghostStroke} !important; opacity: 0.7 !important;`)
      } else if (tagName === 'text') {
        element.setAttribute('fill', ghostFill)
        element.setAttribute('opacity', '0.7')
        const currentStyle = element.getAttribute('style') || ''
        element.setAttribute('style', currentStyle + `; fill: ${ghostFill} !important; opacity: 0.7 !important;`)
      } else if (tagName === 'line') {
        element.setAttribute('stroke', ghostStroke)
        element.setAttribute('opacity', '0.7')
        const currentStyle = element.getAttribute('style') || ''
        element.setAttribute('style', currentStyle + `; stroke: ${ghostStroke} !important; opacity: 0.7 !important;`)
      }
      for (let i = 0; i < element.children.length; i++) {
        applyGhostStyle(element.children[i])
      }
    }

    for (let i = childrenBefore; i < svg.children.length; i++) {
      applyGhostStyle(svg.children[i])
    }

    return true
  } catch (error) {
    console.error('Could not render ghost note with dynamic widths:', error)
    return false
  }
}

/**
 * Render the score, then overlay a free-floating translucent ghost clef that
 * follows the cursor (like the ghost note). The clef glyph is drawn alone (via
 * a 0-line stave so no staff lines appear), wrapped in a `.ghost-clef-group`
 * for CSS tinting, and translated so its center sits at the cursor.
 * @returns true if the ghost clef was drawn
 */
/**
 * Overlay a free-floating translucent ghost REST that follows the cursor — the preview for the
 * armed rest stamp. Drawn as a real rest {@link StaveNote} of the armed duration + dots, on a
 * 0-line stave (so no staff lines come with it), then translated to the cursor: the same trick
 * the clef ghost uses, because both are one glyph shown loose rather than engraved in a bar.
 *
 * A real StaveNote and not a bare glyph, because the ghost must answer "how long, and dotted?" —
 * the two things a rest IS. VexFlow draws the dots at the right offset for each duration; hand-
 * placing them would be inventing a rule the font already knows.
 *
 * THE ATTACH LINE. A whole and a half rest are the same rectangle: what tells them apart is that
 * a whole rest HANGS from a line and a half rest SITS on one. Floating at the cursor, the ghost
 * touches no line at all, so both would read the same — a coin-flip on the most basic choice the
 * tool offers. So for the line-attached rests (whole/half, dotted or not) the ghost draws the ONE
 * line it attaches to, exactly as the score does for a rest a shift has pushed off the staff
 * (drawRestLedgerLines / restSupportingLedgerLine). Shorter rests are not line-attached and get
 * nothing — an eighth rest is unmistakable on its own.
 *
 * @returns true if the ghost rest was drawn
 */
export function drawRestGhost(ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, duration: NoteDuration, dots: number): boolean {
  try {
    const childrenBefore = svg.children.length

    // A 0-line stave draws nothing itself, and gives the rest something to be positioned against.
    const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    // 'b/4' anchors a rest to the middle line under the default clef — the same key NoteBuilder
    // uses, so the ghost is positioned by the same rule as the real thing.
    const rest = new StaveNote({ keys: ['b/4'], duration: convertDuration(duration, dots) + 'r' })
    for (let d = 0; d < dots; d++) Dot.buildAndAttach([rest], { all: true })
    rest.setStave(tempStave)
    rest.setContext(ctx)

    // A voice+formatter gives the note a tickcontext (it will not draw without one).
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickable(rest)
    new Formatter().joinVoices([voice]).format([voice], 100)
    rest.draw()

    // The attach line, for the two rests that have one — drawn with the glyph so it travels with
    // it under the transform below.
    const line = restSupportingLedgerLine(duration, false, rest.getLineForRest())
    if (line !== null || duration === 'w' || duration === 'h') {
      const xBegin = rest.getNoteHeadBeginX()
      const xEnd = rest.getNoteHeadEndX()
      const PAD = 3 // px the line overhangs the glyph on each side — reads as a staff line, not a strike-through
      const y = tempStave.getYForNote(rest.getLineForRest())
      ctx.beginPath()
      ctx.moveTo(xBegin - PAD, y)
      ctx.lineTo(xEnd + PAD, y)
      ctx.stroke()
    }

    const newElements: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) newElements.push(svg.children[i])
    if (newElements.length === 0) return false

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'ghost-rest-group')
    for (const el of newElements) svg.removeChild(el)
    for (const el of newElements) group.appendChild(el)
    svg.appendChild(group)

    // Park it clear of the pointer — LEFT and UP — rather than centred on it, which buries the
    // glyph under the arrow (whose body extends down-right from its tip). The same reason the
    // accidental ghost parks left and the dot ghost right-and-up: a ghost you cannot see is not a
    // preview. Up matters more here than for those two, because the rest is a solid block and the
    // arrow sits squarely on it.
    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const GAP_X = 5
      const LIFT_Y = 10
      const dx = cursorX - GAP_X - (gbox.x + gbox.width / 2)
      const dy = cursorY - LIFT_Y - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}

export function drawClefGhost(ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, clef: Clef): boolean {
  try {
    const childrenBefore = svg.children.length

    // Draw just the clef glyph: a stave with 0 lines and no barlines renders
    // only the clef modifier. Initial position is arbitrary — we reposition below.
    const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.addClef(clef)
    tempStave.setContext(ctx).draw()

    const newElements: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) {
      newElements.push(svg.children[i])
    }
    if (newElements.length === 0) return false

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'ghost-clef-group')
    for (const el of newElements) svg.removeChild(el)
    for (const el of newElements) group.appendChild(el)
    svg.appendChild(group)

    // Center the glyph on the cursor so it tracks the mouse freely.
    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const dx = cursorX - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}

/**
 * Render the score with a free-floating translucent ghost time signature that
 * follows the cursor (mirrors {@link drawClefGhost}). Draws just the
 * TS glyph on a 0-line stave, wrapped in a `.ghost-timesig-group` for CSS
 * tinting, translated so its centre sits at the cursor.
 * @returns true if the ghost time signature was drawn
 */
export function drawTimeSignatureGhost(ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, ts: TimeSignature): boolean {
  try {
    const childrenBefore = svg.children.length

    const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.addTimeSignature(timeSignatureVexKey(ts))
    tempStave.setContext(ctx).draw()

    const newElements: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) {
      newElements.push(svg.children[i])
    }
    if (newElements.length === 0) return false

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'ghost-timesig-group')
    for (const el of newElements) svg.removeChild(el)
    for (const el of newElements) group.appendChild(el)
    svg.appendChild(group)

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const dx = cursorX - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}

/**
 * Render the score with a free-floating translucent ghost dynamic that follows
 * the cursor (mirrors {@link drawClefGhost}). Builds the real dynamic
 * Annotation (level glyph in the music font, or custom italic text) on a
 * throwaway note, then keeps only the annotation's SVG group — discarding the
 * temp stave/notehead — wrapped in a `.ghost-dynamic-group` and centred on the
 * cursor. On click the mark is applied to the clicked slot (see MouseController).
 *
 * GOTCHA (font-size inheritance): a dynamic level glyph's `<text>` is emitted
 * with NO explicit `font-size` — VexFlow lets it inherit the size from its
 * ancestors in the score's SVG tree. Re-parenting that `<text>` to a group at
 * the SVG root (as we do here) breaks the inheritance chain, so the glyph would
 * collapse to the browser default (~16px) and look tiny next to a placed mark.
 * We therefore re-apply the annotation's resolved font on the wrapper group
 * below. This is a pure SVG/VexFlow behaviour, unrelated to the UI framework.
 * @returns true if the ghost dynamic was drawn
 */
/**
 * Render the score with a GHOST tempo mark following the cursor — the preview for the
 * armed tempo tool, mirroring the clef / time-signature / dynamic ghosts. Without it the
 * note-entry ghost is shown while a tempo tool is armed, which says the wrong thing about
 * what the next click will do.
 *
 * Simpler than the dynamic ghost: a dynamic must be hung off a throwaway StaveNote (it is a
 * note modifier), whereas a tempo mark is text painted straight onto the context — so there are
 * no leftover notehead/stem elements to discard afterwards, and no stave is needed at all. It
 * is drawn by the same `drawTempoText` the score uses, so the preview cannot drift from it.
 */
export function drawTempoGhost(ctx: SVGContext, cursorX: number, cursorY: number, mark: TempoMark): boolean {
  if (!mark.text) return false // nothing to preview (a mark that only sounds)

  try {
    const group = ctx.openGroup('ghost-tempo') as SVGGElement
    try {
      // Drawn at the origin and translated into place below, once its real size is known.
      drawTempoText(ctx, mark.text, 0, cursorY)
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Paint it in the ghost blue (the same colour the ghost note uses) at 0.7 opacity —
    // it is a preview, not yet content.
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    // Start at the cursor horizontally (that is where the mark will anchor) and center
    // it vertically on the pointer, so the preview reads as "this lands here".
    const dx = cursorX - gbox.x
    const dy = cursorY - (gbox.y + gbox.height / 2)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch {
    return false
  }
}

export function drawDynamicGhost(ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, dynamic: Dynamic): boolean {
  try {
    const childrenBefore = svg.children.length

    // Draw the annotation on a throwaway quarter note. The note/stave glyphs are
    // discarded below; we keep only the annotation's SVG group.
    const tempStave = new Stave(0, cursorY, 200)
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const annotation = buildDynamicAnnotation(dynamic)
    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    note.setStave(tempStave)
    note.addModifier(annotation, 0)

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 150)
    voice.draw(ctx, tempStave)

    const annoEl = annotation.getSVGElement?.() as SVGGElement | undefined
    // Enlarge the glyph run(s) just like the score pass does (the annotation is drawn at the
    // small text size for a shared baseline), so the ghost matches what will be placed.
    const annoText = annoEl?.querySelector?.('text') as SVGTextElement | null
    if (annoText) enlargeDynamicGlyphRuns(annoText, dynamic)

    const newElements: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) {
      newElements.push(svg.children[i])
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'ghost-dynamic-group')
    // The dynamic glyph's <text> carries no explicit font-size — it inherits it
    // from its ancestors in the score. Extracting it to the SVG root breaks that
    // chain (the glyph would shrink to the browser default), so re-apply the
    // annotation's resolved font on the group for the <text> to inherit.
    const f = annotation.fontInfo
    if (f) {
      group.setAttribute('font-family', f.family)
      group.setAttribute('font-size', typeof f.size === 'number' ? `${f.size}pt` : String(f.size))
      if (f.style) group.setAttribute('font-style', f.style)
    }
    // Move just the annotation group out (detaches it from the note's group)…
    if (annoEl) group.appendChild(annoEl)
    // …then discard the leftover temp stave/notehead/stem elements.
    for (const el of newElements) {
      if (el.parentNode === svg) svg.removeChild(el)
    }
    if (!annoEl) return false

    svg.appendChild(group)

    // Centre the glyph on the cursor so it tracks the mouse freely.
    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const dx = cursorX - (gbox.x + gbox.width / 2)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}

/**
 * Render the score with a free-floating translucent ghost articulation (accent/staccato/tenuto
 * glyph) that follows the cursor — the preview for the armed articulation stamp tool. On click the
 * articulation is added to the clicked note (see MouseController).
 *
 * Unlike the dynamic ghost, we do NOT keep the modifier's own SVG group and discard a temp note:
 * an Articulation's `draw()` opens no group of its own (it renders straight onto the context via
 * `renderText`, and normally lands INSIDE the note's `vf-stavenote` group), so there is nothing to
 * extract. Instead — like the tempo ghost — we open OUR group, draw ONLY the articulation into it,
 * and close: `note.setStave()` populates the note's Y-values and `Formatter.format()` its tick
 * position, which is everything `Articulation.draw()` reads, so it renders standalone without the
 * note ever being drawn. The group carries VexFlow's `vf-` prefix (→ `.vf-ghost-articulation`,
 * registered in {@link GHOST_GROUP_SELECTOR}).
 *
 * ADDITIVE: `types` may hold more than one armed articulation; they are drawn STACKED (sorted by
 * {@link ARTICULATION_RENDER_ORDER}, an explicit `textLine` per glyph) exactly as a real note with
 * several articulations engraves — so the ghost reads as everything the click will stamp.
 * @returns true if a ghost articulation was drawn
 */
export function drawArticulationGhost(ctx: SVGContext, cursorX: number, cursorY: number, types: ArticulationType[]): boolean {
  if (types.length === 0) return false

  try {
    const tempStave = new Stave(0, cursorY, 200)
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
    const sorted = types.slice().sort(
      (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
    )
    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    note.setStave(tempStave) // populates note.ys (what Articulation.draw reads for its Y)
    const articulations = sorted.map(t => {
      const art = new Articulation(articulationVexCodes[t]).setPosition(Modifier.Position.ABOVE)
      note.addModifier(art, 0) // attaches the note to the modifier (checkAttachedNote)
      return art
    })

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
    note.setStave(tempStave)

    const group = ctx.openGroup('ghost-articulation') as SVGGElement
    try {
      // Stack them: an explicit textLine per glyph so multiple armed articulations don't overlap
      // (we draw the modifiers by hand, so the note's ModifierContext isn't doing the spacing).
      articulations.forEach((art, i) => art.setTextLine(i).setContext(ctx).draw())
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Paint it the ghost blue at 0.7 opacity — a preview, not yet content (mirrors the tempo ghost).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    // Centre the glyph on the cursor horizontally, but lift it a few px so the lowest glyph
    // (staccato) doesn't sit right under the pointer — a small breathing gap reads cleaner.
    const CURSOR_GAP_PX = 8
    const dx = cursorX - (gbox.x + gbox.width / 2)
    const dy = cursorY - (gbox.y + gbox.height / 2) - CURSOR_GAP_PX
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}

/**
 * Draw ONE translucent ghost accidental (♯/♭/♮) following the cursor — the preview for the armed
 * accidental stamp tool. Same standalone-draw approach as {@link drawArticulationGhost}:
 * an `Accidental`'s `draw()` reads its note's stave-Y (`setStave`) and formatted tick-X
 * (`Formatter.format`) but opens no group of its own, so we attach it to a throwaway note, format,
 * then draw ONLY the accidental into OUR `vf-`-prefixed group (`.vf-ghost-accidental`, in
 * {@link GHOST_GROUP_SELECTOR}) — the note itself is never drawn. Single-valued: a note has one
 * accidental, so there is nothing to stack.
 * @returns true if a ghost accidental was drawn
 */
export function drawAccidentalGhost(ctx: SVGContext, cursorX: number, cursorY: number, accidental: ScoreAccidental): boolean {
  try {
    const tempStave = new Stave(0, cursorY, 200)
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    note.setStave(tempStave) // populates note.ys (what Accidental.draw reads for its Y)
    const acc = new Accidental(accidental) // '#' | 'b' | 'n' are VexFlow accidental codes as-is
    note.addModifier(acc, 0) // attaches the note to the modifier (checkAttachedNote)

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
    note.setStave(tempStave)

    const group = ctx.openGroup('ghost-accidental') as SVGGElement
    try {
      acc.setContext(ctx).draw()
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    // Park it to the LEFT of the pointer rather than centred on it — an accidental is engraved to
    // the left of its notehead, so this reads as where the sign will land (the mirror of the dot
    // ghost, which sits right for the same reason), and the arrow stops covering the very glyph
    // it is previewing. Covers all three signs: ♯ ♭ ♮ share this one draw.
    const GAP_X = 10
    const dx = cursorX - GAP_X - (gbox.x + gbox.width / 2)
    const dy = cursorY - (gbox.y + gbox.height / 2)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}

/**
 * Draw the translucent ghost tremolo STROKES following the cursor — the preview for the armed
 * tremolo stamp. Same standalone-draw recipe as {@link drawArticulationGhost}: a
 * throwaway note + stave, `setStave` then `Formatter.format` (between them they populate
 * everything the modifier's `draw()` reads), then draw ONLY the modifier into OUR `vf-`-prefixed
 * group (`.vf-ghost-tremolo`, registered in {@link GHOST_GROUP_SELECTOR} — a group missing from
 * that list is never taken down, and the ghost smears a trail across the score).
 *
 * The ghost is the **real mark**, not the palette's picture: the dev palette draws a note wearing
 * its strokes because a button has to be recognisable, while this draws exactly what the click
 * adds — N copies of `tremolo1`, or the single Penderecki sign. It takes the {@link TremoloMark}
 * rather than a count precisely so those two cannot diverge: one modifier, one placement.
 *
 * ⚠️ Where this differs from every sibling ghost: an `Articulation` positions itself off the
 * NOTEHEAD, but `Tremolo` positions itself off `note.getStemExtents().topY` — so the strokes land
 * far above the throwaway note's origin. The bbox-centring below absorbs that on purpose: it
 * measures where the glyphs ACTUALLY landed and moves the whole group from there, so the offset
 * never has to be known.
 * @returns true if a ghost tremolo was drawn
 */
export function drawTremoloGhost(ctx: SVGContext, cursorX: number, cursorY: number, mark: TremoloMark): boolean {
  try {
    const tempStave = new Stave(0, cursorY, 200)
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    note.setStave(tempStave) // populates the note's Y values (Tremolo.draw reads its stem extents)
    const tremolo = new CenteredTremolo(mark)
    note.addModifier(tremolo, 0) // attaches the note to the modifier (checkAttachedNote)

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
    note.setStave(tempStave)

    const group = ctx.openGroup('ghost-tremolo') as SVGGElement
    try {
      tremolo.setContext(ctx).draw()
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    // Centred on the pointer: the strokes ride the STEM, so there is no notehead side for them to
    // sit off — unlike the accidental (left) and dot (right) ghosts, which preview a horizontal
    // relationship to the note they will join.
    const dx = cursorX - (gbox.x + gbox.width / 2)
    const dy = cursorY - (gbox.y + gbox.height / 2)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}

/**
 * Draw ONE translucent ghost tie following the cursor — the preview for the armed tie stamp tool.
 * A tie is a RELATION between two notes, not a glyph, so there is no `draw()` to borrow the way
 * the articulation/accidental ghosts borrow theirs. Instead it is engraved as a REAL tie: the same
 * {@link drawCurveArc} primitive, with the same {@link TIE_BOW} / {@link CURVE_THICKNESS} an
 * engraved tie uses — a proper cubic that swells at the belly and pinches to a point at each tip.
 * Change those constants and the ghost follows. It says "tie tool armed" and no more: WHICH note
 * ties to WHICH is resolved at click time by {@link MusicEngine.toggleTie} (and logged there),
 * never previewed.
 *
 * `Curve.renderCurve` reads only its params and `renderOptions` — `from`/`to` are used by `draw()`
 * alone, which we never call — so one throwaway note satisfies the constructor without touching
 * the arc. It bows DOWNWARD (direction +1), matching the Keypad's tie key, so the armed tool and
 * the lit key read as one thing, and it STARTS at the cursor rather than straddling it: a tie
 * begins at the note you click and reaches forward, so its head is the part that follows the mouse.
 *
 * STROKED, not filled — so it paints `stroke` where the other ghosts paint `fill`. But like them
 * it paints through the **DOM, after the draw, never the context**. `save()`/`restore()` do work
 * now (they were stubbed for years — see {@link initialize}), so a scoped `setStrokeStyle` would
 * no longer leak; the DOM is still the right answer here, because `openGroup` stamps the context's
 * attributes onto the `<g>` at the moment it opens, and because painting the node afterwards is
 * what lets a ghost recolour without re-engraving.
 * Positioned by absolute path coordinates, so it needs no bbox measure or `translate` either.
 * @returns true if a ghost tie was drawn
 */
export function drawTieGhost(ctx: SVGContext, cursorX: number, cursorY: number): boolean {
  try {
    // The arc BEGINS at the cursor and runs to the right, rather than being centred on it — a tie
    // starts at the note you click and reaches forward to the next, so its head belongs where the
    // click will land. Nudged clear of the pointer on both axes so the arrow doesn't cover it.
    const WIDTH = 20      // a short tie — roughly the span between two adjacent noteheads
    const START_GAP_PX = 4
    const LIFT_PX = 4
    const DIRECTION = 1   // +1 = below/sagging, like the Keypad's tie key
    const x0 = cursorX + START_GAP_PX
    const y = cursorY - LIFT_PX

    // Throwaway anchor: renderCurve never reads it (see above), it only satisfies the ctor.
    const anchor = new StaveNote({ keys: ['b/4'], duration: 'q' })
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: TIE_BOW },
      { x: 0, y: TIE_BOW },
    ]

    const group = ctx.openGroup('ghost-tie') as SVGGElement
    try {
      drawCurveArc(
        { context: ctx },
        { x: x0, y }, { x: x0 + WIDTH, y },
        cps, DIRECTION, CURVE_THICKNESS, anchor, anchor,
      )
    } finally {
      ctx.closeGroup()
    }

    // Paint it ghost blue at 0.7 opacity through the DOM — a preview, not yet content (mirrors
    // the other ghosts), and never through the context: see the note above. `renderCurve` strokes
    // AND fills, so each emitted path carries both and both must be overridden, or the ghost shows
    // a blue body with a black outline (the same rule as HighlightController.colorTieGroup).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('path').forEach(p => {
      p.setAttribute('fill', '#3B82F6')
      p.setAttribute('stroke', '#3B82F6')
    })
    return true
  } catch (_e) {
    return false
  }
}

/**
 * Draw ONE translucent ghost augmentation dot at the cursor — the preview for the armed dot stamp
 * tool. Same standalone-draw approach as {@link drawAccidentalGhost}: a `Dot` is a
 * Modifier whose `draw()` reads its note's stave-Y (`setStave`) and formatted tick-X
 * (`Formatter.format`) but opens no group of its own, so we attach it to a throwaway note, format,
 * then draw ONLY the dot into OUR `vf-`-prefixed group (`.vf-ghost-dot`, in
 * {@link GHOST_GROUP_SELECTOR}) — the note itself is never drawn. Valueless: the dot is on or off,
 * so there is nothing to stack or swap.
 * @returns true if a ghost dot was drawn
 */
export function drawDotGhost(ctx: SVGContext, cursorX: number, cursorY: number): boolean {
  try {
    const tempStave = new Stave(0, cursorY, 200)
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    note.setStave(tempStave) // populates note.ys (what Dot.draw reads for its Y)
    Dot.buildAndAttach([note], { all: true })
    const dot = note.getModifiers().find(m => m.getCategory() === 'Dot')
    if (!dot) return false

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 150) // sets the note's tick X position
    note.setStave(tempStave)

    const group = ctx.openGroup('ghost-dot') as SVGGElement
    try {
      dot.setContext(ctx).draw()
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Paint it ghost blue at 0.7 opacity — a preview, not yet content (mirrors the other ghosts).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    // Park it clear of the pointer, to the RIGHT and slightly up, rather than centred on it: a dot
    // is ~3px, so the arrow would simply cover it (the arrow's body extends down-right from its
    // tip). Same reason the articulation ghost lifts by CURSOR_GAP_PX and the tie starts right of
    // the cursor. It also reads the way the stamp works — the dot lands to the right of the head.
    const GAP_X = 10
    const LIFT_Y = 4
    const dx = cursorX + GAP_X - (gbox.x + gbox.width / 2)
    const dy = cursorY - LIFT_Y - (gbox.y + gbox.height / 2)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}

/**
 * ONE ROW PER GHOST — the table that replaced four layers of forwarding.
 *
 * Drawing a clef ghost used to be `RenderController.renderClefGhost` → `MusicEngine.
 * renderScoreWithClefGhost` → `VexFlowRenderer.renderScoreWithClefGhost` → `drawClefGhost`: 42
 * methods across four layers for twelve kinds, and the **twenty in the middle two carried no logic
 * at all** — each was a single delegating statement, so a thirteenth ghost meant editing four files
 * in order to add nothing (docs/modularity-plan-2026-07-28.md §4, Phase 2). Now the payload
 * ({@link ToolGhost}) travels whole and only this table knows which glyph goes with which kind.
 *
 * ⚠️ The rows are **adapters, not the bare exports**. The drawers above have genuinely different
 * signatures — `drawClefGhost` needs the score's `<svg>` (it hangs a real Stave off it),
 * `drawTempoGhost` does not — and that difference is each drawer's own business, not something to
 * normalise away by giving five of them a parameter they ignore. The adapter is where the two
 * shapes meet, and it is one line.
 *
 * Total over the union, so a new `ToolGhost` member fails to BUILD until it says how it is drawn —
 * the same guarantee `assertNeverTool` gives the armed tools, from a table instead of a switch.
 * ⚠️ SCREAMING_SNAKE deliberately: `scripts/check-singletons.mjs` reads a module-level
 * `export const <camelCase> = {` as new mutable state and would fail `build:check`. This is a frozen
 * lookup table, and the name is how the check can tell (docs/DESIGN-PRINCIPLES.md §1).
 */
export const GHOST_DRAWERS: {
  [K in ToolGhost['kind']]: (
    ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number,
    ghost: Extract<ToolGhost, { kind: K }>,
  ) => boolean
} = {
  clef: (ctx, svg, x, y, g) => drawClefGhost(ctx, svg, x, y, g.clef),
  timeSignature: (ctx, svg, x, y, g) => drawTimeSignatureGhost(ctx, svg, x, y, g.timeSignature),
  tempo: (ctx, _svg, x, y, g) => drawTempoGhost(ctx, x, y, g.mark),
  dynamic: (ctx, svg, x, y, g) => drawDynamicGhost(ctx, svg, x, y, g.dynamic),
  articulation: (ctx, _svg, x, y, g) => drawArticulationGhost(ctx, x, y, g.types),
  accidental: (ctx, _svg, x, y, g) => drawAccidentalGhost(ctx, x, y, g.accidental),
  tremolo: (ctx, _svg, x, y, g) => drawTremoloGhost(ctx, x, y, g.mark),
  tie: (ctx, _svg, x, y) => drawTieGhost(ctx, x, y),
  dot: (ctx, _svg, x, y) => drawDotGhost(ctx, x, y),
  rest: (ctx, svg, x, y, g) => drawRestGhost(ctx, svg, x, y, g.duration, g.dots),
}

/**
 * Draw whatever ghost the editor asked for, at the cursor. The one dispatch point — `VexFlowRenderer`
 * wraps this in `ghostOverlay` (which takes the last ghost down and refuses when there is no page).
 *
 * The cast is the known TypeScript hole in a keyed-dispatch table: `GHOST_DRAWERS[ghost.kind]` widens
 * to a union of functions whose parameters intersect to `never`, even though every individual row is
 * sound. It is contained here — one line, one place — which is the reason this function exists rather
 * than the lookup being written out at the call site.
 */
export function drawToolGhost(
  ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, ghost: ToolGhost,
): boolean {
  const draw = GHOST_DRAWERS[ghost.kind] as (
    ctx: SVGContext, svg: SVGElement, x: number, y: number, ghost: ToolGhost,
  ) => boolean
  return draw(ctx, svg, cursorX, cursorY, ghost)
}
