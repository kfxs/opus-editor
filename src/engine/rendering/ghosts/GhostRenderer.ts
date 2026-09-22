/**
 * THE GHOSTS — every translucent preview the editor draws, extracted from {@link ScoreRenderer}
 * (docs/history/refactor-plan-2026-07-27.md Phase 6a). Free functions over the drawing context and the
 * score's `<svg>`, like {@link FanPass} and the tie / slur / dynamics passes.
 *
 * Two families, and the difference between them is where the preview LIVES:
 *
 *  - {@link drawNoteGhost} — the note about to be entered, drawn **in the bar it will land in**. It
 *    therefore needs the render's own layout (which bar sits where, and how far the staff-spacing
 *    overrides push its system down), which is why those arrive as arguments.
 *  - the cursor ghosts (`drawClefGhost`, `drawRestGhost`, `drawDynamicGhost`, …) — ONE glyph shown
 *    loose, following the pointer, parked by their own ink box, so they need nothing from the score.
 *    ⭐ S11 (`docs/history/vexflow-removal-map.md`) is moving them out one family at a time, each drawn by the
 *    score's OWN classes on our surface: the clef + meter (`./HeaderSignGhost`), the marks and the
 *    dynamic (`./MarkGhost`), the tempo mark (`./TempoGhost`), the rest (`./RestGhost`) and the fan head
 *    (`./FanGhost`). ⭐ The NOTE ghost below too, since S11e: every ghost is drawn by the score's own
 *    classes on a `DrawContext`, and no ghost module imports VexFlow.
 *
 * Every one of them is an **overlay** (docs/history/render-performance-plan.md §5b): it draws into its own
 * class-tagged `<g>` appended last, so putting one up or taking it down is a DOM append/remove
 * against the already-drawn score — never a re-layout. `ScoreRenderer.clearGhosts` is the
 * take-down, and it sweeps exactly the groups named in {@link GHOST_GROUP_SELECTOR}. ⚠️ **A group
 * whose class is not in that list is never removed** — the ghost then smears a trail across the
 * score, one copy per mouse position. Add the class there in the same breath as drawing it.
 *
 * ⚠️ Each takes the previous ghost's take-down and the "is there a page to draw on" check from its
 * caller — `ScoreRenderer.ghostOverlay` — so every function here starts with a real page and a
 * real context. What each still guards for itself is its own emptiness (a tempo mark with no text,
 * an empty articulation list): that is about the MARK, not about the page.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Score, Clef, NoteDuration, PitchStep, ArticulationType } from '@/types/music'
import type { GhostNote, ToolGhost } from './ghostTypes'
import { fracToNumber, fracCreate, fracAdd } from '@/utils/fraction'
import { beatToFrac } from '@/utils/musicUtils'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { noteDurationToken, writtenLength } from '@/utils/durations'
import { getMeterInfo } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { measureEndingClef, effectiveClefAt, middleLineDiatonicPos, resolveStaffClefs } from '@/utils/clefUtils'
import { spellingToNoteKey, spellingDiatonicPos, alterToString } from '@/utils/pitchSpelling'
import { staffOf } from '@/utils/lanes'
import { resolveStaffSize } from '@/engine/models/staffSize'
import { staffMeasureView, staffIdAtIndex } from '@/engine/models/staffContent'
import { layoutTupletMark, drawTupletMark } from '../engraved/ScoreTuplet'
import { CenteredTremolo } from '../engraved/CenteredTremolo'
import { attachModifier } from '../engraved/EngravedModifier'
import { convertDuration, restKey, ARTICULATION_RENDER_ORDER } from '../engraved/NoteBuilder'
import { drawsTimeSignature } from '@/engine/layout/headerInk'
import { drawCurveArc } from '../curves/curveArc'
import { CURVE_PX } from '../curves/curveStyle'
import { ledgerLineStyle, type MeasureWidthInfo, type StaffSpacingLayout } from '@/engine/layout/layoutConfig'
import { drawFanGhost, FAN_GHOST_GROUP_CLASS } from './FanGhost'
import { drawGraceGhost, GRACE_GHOST_GROUP_CLASS } from './GraceGhost'
import { drawTrillGhost, TRILL_GHOST_GROUP_CLASS } from './TrillGhost'
import { drawOttavaGhost, OTTAVA_GHOST_GROUP_CLASS } from './OttavaGhost'
import { drawPedalGhost, PEDAL_GHOST_GROUP_CLASS } from './PedalGhost'
import { drawBarlineGhost, BARLINE_GHOST_GROUP_CLASS } from './BarlineGhost'
import { drawGroupSignGhost, GROUP_SIGN_GHOST_GROUP_CLASS } from './GroupSignGhost'
import { drawKeySignatureGhost, KEY_SIGNATURE_GHOST_GROUP_CLASS } from './KeySignatureGhost'
import { drawClefGhost, drawTimeSignatureGhost } from './HeaderSignGhost'
import { drawArticulationGhost, drawAccidentalGhost, drawTremoloGhost, drawDotGhost, drawDynamicGhost } from './MarkGhost'
import { drawTempoGhost, TEMPO_GHOST_GROUP_CLASS } from './TempoGhost'
import { drawRestGhost, REST_GHOST_GROUP_CLASS } from './RestGhost'
import type { SurfaceMetrics } from '@/engine/layout/surface'
import { barFrame, staveFrame, standOn } from '../staff/staveFrame'
import { drawGroupOf, svgNode } from '../painter/svgDrawGroup'
import { EngravedNote, drawNoteInkThrough } from '../engraved/EngravedNote'
import { EngravedStave } from '../engraved/EngravedStave'
import { EngravedAccidental } from '../engraved/EngravedAccidental'
import { EngravedArticulation } from '../engraved/EngravedArticulation'
import { attachEngravedDots } from '../engraved/EngravedDot'
import { BarVoice } from '../format/barVoice'
import { attachModifierColumns } from '../format/modifierColumns'
import { formatColumns } from '../format/columnFormat'
import { noteRuler } from '../engraved/noteRuler'

/**
 * The preview ghosts (note / clef / time-sig / dynamic / tempo …) each draw into their own
 * class-tagged `<g>`, appended last — this is the list `ScoreRenderer.clearGhosts` sweeps.
 *
 * ⚠️ History worth keeping: until S15c the groups that go through `openGroup(…)` got VexFlow's `vf-`
 * prefix (`vf-ghost-tempo`), unlike the hand-built `setAttribute('class', 'ghost-…-group')` ones below,
 * and a selector must name what is actually written. The selector once said `.ghost-tempo`, matched nothing,
 * and so never took a tempo ghost down: they piled up, one per mouse position, as a permanent blue
 * smear. (Nothing swept them either, since P4 made ghosts overlays — hovering no longer forces the
 * full render that used to hide the leak.)
 */
export const GHOST_GROUP_SELECTOR =
  `.ghost-note-group, .${REST_GHOST_GROUP_CLASS}, .${FAN_GHOST_GROUP_CLASS}, .${GRACE_GHOST_GROUP_CLASS}, .ghost-clef-group, .ghost-timesig-group, .ghost-dynamic-group, .ghost-articulation, .ghost-accidental, .ghost-tie, .ghost-dot, .ghost-tremolo, .${TEMPO_GHOST_GROUP_CLASS}, .${TRILL_GHOST_GROUP_CLASS}, .${OTTAVA_GHOST_GROUP_CLASS}, .${PEDAL_GHOST_GROUP_CLASS}, .${BARLINE_GHOST_GROUP_CLASS}, .${KEY_SIGNATURE_GHOST_GROUP_CLASS}, .${GROUP_SIGN_GHOST_GROUP_CLASS}`

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
  ctx: DrawContext,
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
    // them is drawn small (docs/plans/staff-size-plan.md §5).
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
    // (docs/plans/staff-size-plan.md §4.1, §4.3). Full size, k is 1 and this is the arithmetic it
    // replaced. Get it wrong and the preview is a full-size note over a small staff — the one
    // place where "what you see is what you get" is the entire point of the drawing.
    const scale = staffId ? resolveStaffSize(score, staffId) : 1
    const isFirstInLine = measureX === lineLeft
    // The ghost sits at a real pitch, so it gets real ledger lines — same ink as the engraved ones.
    // ⭐ S11e: the score's own stave class, given its signs the way `ScoreRenderer` gives a bar its
    // own — so the note area the ghost is formatted into is walked by the same rule.
    const tempStave = new EngravedStave(measureX / scale, measureY / scale, staveWidth / scale)
    tempStave.setDefaultLedgerLineStyle(ledgerLineStyle())
    if (ghostNote.measure === 1 || isFirstInLine) {
      tempStave.addClefSign(openingClef, 'default')
    } else if (hasClefChange) {
      tempStave.addClefSign(openingClef, 'small')
    }
    if (drawsTimeSignature(measure)) {
      tempStave.addMeter(measure.timeSignature)
    }
    // Match the real stave's note area so the ghost note aligns with where the committed note
    // will land (a cautionary end clef narrows the note area) — and match it on THIS staff, since
    // the courtesy is per staff now and only some staves may carry one.
    const ghostCautionaryClef = widthInfo.cautionaryEndClefs?.[staffIndex]
    if (ghostCautionaryClef) {
      tempStave.addClefSign(ghostCautionaryClef, 'small', 'closing')
    }
    if (widthInfo.cautionaryEndTimeSig) {
      tempStave.addMeter(widthInfo.cautionaryEndTimeSig, 'closing')
    }

    const noteKey = spellingToNoteKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
    const durationToken = convertDuration(ghostNote.duration as NoteDuration, ghostNote.dots || 0)

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

    const staveNote = new EngravedNote({
      keys: [noteKey],
      duration: durationToken,
      clef,
      autoStem: false,
    })
    staveNote.setStemDirection(stemDirection)

    const dots = ghostNote.dots || 0
    for (let d = 0; d < dots; d++) {
      attachEngravedDots(staveNote)
    }

    if (ghostNote.alter !== 0) {
      const sign = alterToString(ghostNote.alter)
      attachModifier(staveNote, new EngravedAccidental(sign), 0)
    } else if (ghostNote.forceAccidental) {
      // Armed natural: alter 0 has no sign of its own, so draw the ♮ explicitly.
      attachModifier(staveNote, new EngravedAccidental('n'), 0)
    }

    // The armed entry tremolo, through the SAME modifier the engraved mark uses — so the ghost
    // wears its strokes exactly where the committed note will, stem stretches and all. Added
    // before the articulations for no reason but reading order; a tremolo is one modifier and
    // stacks with nothing.
    if (ghostNote.tremolo !== undefined) {
      attachModifier(staveNote, new CenteredTremolo(ghostNote.tremolo), 0)
    }

    if (ghostNote.articulations?.length) {
      const articulationCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      const articulationPosition = stemDirection === 1 ? 'below' : 'above'
      const sortedGhostArticulations = ghostNote.articulations.slice().sort(
        (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
      )
      for (const art of sortedGhostArticulations) {
        attachModifier(staveNote, new EngravedArticulation(articulationCodes[art]).setPosition(articulationPosition), 0)
      }
    }

    // Meter-aware rest fill around the ghost note (same engine as the model).
    // Positions are exact Fractions in quarter-note beats.
    const meter = getMeterInfo(measure.timeSignature)
    const noteStart = beatToFrac(ghostNote.beat)
    const noteEnd = fracAdd(noteStart, writtenLength(ghostNote))

    const makeRest = (r: RestSlot) => {
      const sn = new EngravedNote({ keys: [restKey(r.duration)], duration: noteDurationToken(r.duration, r.dots) + 'r' })
      if (r.dots) attachEngravedDots(sn)
      return sn
    }

    const tickables: EngravedNote[] = []
    for (const r of fillRests(fracCreate(0, 1), noteStart, meter)) tickables.push(makeRest(r))
    tickables.push(staveNote)
    for (const r of fillRests(noteEnd, measureCapacityFrac(measure), meter)) tickables.push(makeRest(r))

    // The voice takes the literal time signature, not quarter-beats.
    const voices = [new BarVoice(measure.timeSignature, 'soft').addAll(tickables)]

    const tempBar = barFrame(tempStave)
    const noteAreaWidth = tempBar.noteEndX - tempBar.noteStartX
    const rightPadding = 15
    const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
    // ⚠️ Formatted BEFORE the note is put on the stave, as the throwaway VexFlow voice was.
    attachModifierColumns(voices)
    formatColumns(voices, formatWidth)

    standOn(staveNote, tempStave)

    const ruler = noteRuler(staveNote)
    let targetShiftX: number | null = null
    if (ghostNote.rawX !== undefined) {
      try {
        // `rawX` is the pointer, in SVG coordinates; `getAbsoluteX` answers in the stave's own.
        // The transform below translates in the PARENT's space, so the note's x has to be carried
        // out of the staff's before the two are subtracted.
        const noteX = ruler.originX * scale
        targetShiftX = ghostNote.rawX - noteX
      } catch (_e) {
        // getAbsoluteX might not be available before draw
      }
    }

    const childrenBefore = svg.children.length
    drawNoteInkThrough([staveNote], ctx)
    staveNote.setContext(ctx).draw()

    // The armed tuplet's number, over the ghost — "this click STARTS a 5:4", which a notehead
    // alone cannot say. Drawn by the engraved mark's own `layoutTupletMark`, so the font is the
    // page's (Bravura at the tuplet's own size) rather than a second copy that goes stale, and the
    // text is SMuFL tuplet digits (see tupletMarkText). Same geometry too — VexFlow puts the number
    // a line and a half above the top staff line, less its own textYOffset.
    //
    // Drawn INSIDE the childrenBefore window on purpose: it is then swept into `.ghost-note-group`
    // and tinted with the rest of the ghost by the code below, instead of needing its own
    // teardown. NO bracket: a tuplet's bracket spans notes that do not exist until the click.
    if (ghostNote.tupletLabel?.length) {
      // Laid out by the SAME function the engraved mark uses, so the preview's runs are the page's
      // runs at the page's sizes — a ghost drawn any other way previews a different mark.
      const mark = layoutTupletMark(ghostNote.tupletLabel)
      // The number rides the NOTE, not the staff: it floats a fixed gap above whatever the note's
      // highest point is — the stem TIP when the stem is up, the NOTEHEAD when it hangs down.
      //
      // Deliberately NOT VexFlow's own rule, which then clamps the result to at least 1.5 lines
      // above the top staff line: that clamp is right for a real tuplet (a bracket spanning several
      // notes needs one height for all of them) and wrong for a ghost, which is ONE note following
      // the cursor — clamped, the number stops tracking and drifts away from the notehead as you
      // move down the staff.
      const anchorY = !ruler.hasStem
        ? Math.min(...ruler.headYs) // a whole note: the notehead is the whole of it
        : stemDirection === 1
          ? ruler.stemTipY // stem up — the tip is the highest point
          : ruler.stemBaseY // stem down — the stem hangs below, so the notehead is
      // Centred on the NOTEHEAD, not on the note's origin: `getAbsoluteX()` is where the note
      // attaches (accidentals and dots push it around), so a number centred there sits off to one
      // side of the head it belongs to. The head's own two edges say where it actually is.
      const headCenterX = (ruler.headLeftX + ruler.headRightX) / 2
      // Every run centred as ONE mark, on one baseline — see ScoreTuplet.draw.
      drawTupletMark(
        ctx,
        mark,
        headCenterX - mark.width / 2,
        anchorY - GHOST_TUPLET_NUMBER_GAP * staveFrame(tempStave).spacePx,
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
 * Draw ONE translucent ghost tie following the cursor — the preview for the armed tie stamp tool.
 * A tie is a RELATION between two notes, not a glyph, so there is no `draw()` to borrow the way
 * the articulation/accidental ghosts borrow theirs. Instead it is engraved as a REAL tie: the same
 * {@link drawCurveArc} primitive, with the same `CURVE_PX.tieBow` / `.thickness` (`./curveStyle`) an
 * engraved tie uses — a proper cubic that swells at the belly and pinches to a point at each tip.
 * Change those constants and the ghost follows. It says "tie tool armed" and no more: WHICH note
 * ties to WHICH is resolved at click time by {@link MusicEngine.toggleTie} (and logged there),
 * never previewed.
 *
 * ⭐ It used to build a **throwaway `StaveNote`** here purely to satisfy `new Curve(from, to, …)`,
 * whose `renderCurve` never read it; U1 took the arc's ink into `engrave/curves/curveInk` and the
 * fake note went with it. It bows DOWNWARD (direction +1), matching the Keypad's tie key, so the armed tool and
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
function drawTieGhost(ctx: DrawContext, cursorX: number, cursorY: number): boolean {
  try {
    // The arc BEGINS at the cursor and runs to the right, rather than being centred on it — a tie
    // starts at the note you click and reaches forward to the next, so its head belongs where the
    // click will land. Nudged clear of the pointer on both axes so the arrow doesn't cover it.
    // Shared with the PENDING tie's stub (`ScoreRenderer.renderPendingTie`), so the armed
    // preview and the committed-but-unfinished one are one shape (§12 Phase 3b).
    const WIDTH = CURVE_PX.tieStubLength
    const START_GAP_PX = 4
    const LIFT_PX = 4
    const DIRECTION = 1   // +1 = below/sagging, like the Keypad's tie key
    const x0 = cursorX + START_GAP_PX
    const y = cursorY - LIFT_PX

    const cps: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: CURVE_PX.tieBow },
      { x: 0, y: CURVE_PX.tieBow },
    ]

    const opened = drawGroupOf(ctx.openGroup('ghost-tie'))
    try {
      drawCurveArc(
        { context: ctx },
        { x: x0, y }, { x: x0 + WIDTH, y },
        cps, DIRECTION, CURVE_PX.thickness,
      )
    } finally {
      ctx.closeGroup()
    }

    // Paint it ghost blue at 0.7 opacity through the DOM — a preview, not yet content (mirrors
    // the other ghosts), and never through the context: see the note above. An arc emits TWO paths
    // — a stroke-only outline and a fill-only body — so set fill AND stroke on each, or the ghost
    // shows a blue body with a black outline (the same rule as HighlightController.colorTieGroup).
    if (!opened) return false
    opened.tag('opacity', '0.7')
    // ⛔ The NODE: recolouring the drawn shapes is DOM work on ink — the counted escape
    //   (`npm run lint:paint`), where an uncounted `as SVGGElement` cast of VexFlow's `openGroup` was.
    svgNode(opened)!.querySelectorAll('path').forEach(p => {
      p.setAttribute('fill', '#3B82F6')
      p.setAttribute('stroke', '#3B82F6')
    })
    return true
  } catch (_e) {
    return false
  }
}

/**
 * ONE ROW PER GHOST — the table that replaced four layers of forwarding.
 *
 * Drawing a clef ghost used to be `RenderController.renderClefGhost` → `MusicEngine.
 * renderScoreWithClefGhost` → `ScoreRenderer.renderScoreWithClefGhost` → `drawClefGhost`: 42
 * methods across four layers for twelve kinds, and the **twenty in the middle two carried no logic
 * at all** — each was a single delegating statement, so a thirteenth ghost meant editing four files
 * in order to add nothing (docs/history/modularity-plan-2026-07-28.md §4, Phase 2). Now the payload
 * ({@link ToolGhost}) travels whole and only this table knows which glyph goes with which kind.
 *
 * ⚠️ The rows are **adapters, not the bare exports**. The drawers above have genuinely different
 * signatures — `drawClefGhost` needs the score's `<svg>` (it sweeps what it drew into its own group),
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
    ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number,
    ghost: Extract<ToolGhost, { kind: K }>,
  ) => boolean
} = {
  clef: (ctx, svg, x, y, g) => drawClefGhost(ctx, svg, x, y, g.clef),
  timeSignature: (ctx, svg, x, y, g) => drawTimeSignatureGhost(ctx, svg, x, y, g.timeSignature),
  keySignature: (ctx, _svg, x, y, g) => drawKeySignatureGhost(ctx, x, y, g.key),
  tempo: (ctx, _svg, x, y, g) => drawTempoGhost(ctx, x, y, g.mark),
  dynamic: (ctx, svg, x, y, g) => drawDynamicGhost(ctx, svg, x, y, g.dynamic),
  articulation: (ctx, _svg, x, y, g) => drawArticulationGhost(ctx, x, y, g.types),
  accidental: (ctx, _svg, x, y, g) => drawAccidentalGhost(ctx, x, y, g.accidental),
  tremolo: (ctx, _svg, x, y, g) => drawTremoloGhost(ctx, x, y, g.mark),
  tie: (ctx, _svg, x, y) => drawTieGhost(ctx, x, y),
  dot: (ctx, _svg, x, y) => drawDotGhost(ctx, x, y),
  rest: (ctx, svg, x, y, g) => drawRestGhost(ctx, svg, x, y, g.duration, g.dots, g.color),
  fan: (ctx, svg, x, y, g) => drawFanGhost(ctx, svg, x, y, g.duration, g.dots),
  grace: (ctx, svg, x, y, g) => drawGraceGhost(ctx, svg, x, y, g.duration, g.slash),
  trill: (ctx, _svg, x, y) => drawTrillGhost(ctx, x, y),
  ottava: (ctx, _svg, x, y, g) => drawOttavaGhost(ctx, x, y, g.shift),
  pedal: (ctx, _svg, x, y) => drawPedalGhost(ctx, x, y),
  barline: (ctx, _svg, x, y, g) => drawBarlineGhost(ctx, x, y, g.sign),
  group: (ctx, _svg, x, y, g) => drawGroupSignGhost(ctx, x, y, g.symbol),
}

/**
 * Draw whatever ghost the editor asked for, at the cursor. The one dispatch point — `ScoreRenderer`
 * wraps this in `ghostOverlay` (which takes the last ghost down and refuses when there is no page).
 *
 * The cast is the known TypeScript hole in a keyed-dispatch table: `GHOST_DRAWERS[ghost.kind]` widens
 * to a union of functions whose parameters intersect to `never`, even though every individual row is
 * sound. It is contained here — one line, one place — which is the reason this function exists rather
 * than the lookup being written out at the call site.
 */
export function drawToolGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, ghost: ToolGhost,
): boolean {
  const draw = GHOST_DRAWERS[ghost.kind] as (
    ctx: DrawContext, svg: SVGElement, x: number, y: number, ghost: ToolGhost,
  ) => boolean
  return draw(ctx, svg, cursorX, cursorY, ghost)
}
