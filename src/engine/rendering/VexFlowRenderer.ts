import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Annotation, Modifier, Beam, StaveTie, Dot, Barline, ClefNote, Tuplet as VexFlowTuplet } from 'vexflow'
// Engine-owned notation styles (cursor ghosts, selection highlight). Imported here
// so they travel with the renderer — no UI-framework wiring required. See notation.css.
import './notation.css'
import type { Score, Measure, Clef, ArticulationType, Tuplet, ChordRest, Fraction, PitchStep, GhostNote, TimeSignature, Dynamic } from '@/types/music'
import { fracToNumber, fracEq, fracCompare, fracLte, fracIsZero, fracCreate, fracAdd } from '@/utils/fraction'
import { measureOpeningClef, measureEndingClef, effectiveClefAt, effectiveClefBefore, middleLineDiatonicPos } from '@/utils/clefUtils'
import { beatToFrac, measureCapacityFrac } from '@/utils/musicUtils'
import { durationToVexflow, durationToFraction } from '@/utils/durations'
import { getMeterInfo, type MeterInfo } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { computeBeamGroups } from '@/utils/beaming'
import { ElementRegistry, type TupletGeometry, type ClefSegment } from '@/engine/ElementRegistry'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos } from '@/utils/pitchSpelling'
import type { RenderPass } from './RenderPass'
import { renderTies, getTieDirection } from './TieRenderer'
import { renderSlurs } from './SlurRenderer'
import { attachDynamicsToSlots, layoutCoLocatedDynamics, buildDynamicAnnotation, registerDynamics } from './DynamicsLayout'
import {
  convertDuration,
  chooseVoiceMode,
  createStaveNotesFromSlots,
  makeClefResolver,
  drawsTimeSignature,
  ARTICULATION_RENDER_ORDER,
  resolveTupletLocation,
  innerFlipTupletYOffset,
  type TupletNoteStem,
} from './NoteBuilder'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG, VIEWPORT_TWO_LINE_HEIGHT, type MeasureWidthInfo } from './layoutConfig'

// Re-exported for existing importers (MusicEngine, App.vue, RenderPass) that referenced
// these from the renderer before they moved to ./layoutConfig.
export { LAYOUT_CONFIG, VIEWPORT_TWO_LINE_HEIGHT, type MeasureWidthInfo }

/**
 * Bounds information for a rendered measure
 */
export interface MeasureBounds {
  /** X position where the measure starts */
  measureX: number
  /** Y position of the measure */
  measureY: number
  /** Total width of the measure */
  measureWidth: number
  /** X position where notes can start (after clef/time sig) */
  noteStartX: number
  /** X position where notes must end */
  noteEndX: number
}

/**
 * VexFlow wrapper service for rendering musical notation
 * This service abstracts VexFlow complexity and provides a clean API
 */
export class VexFlowRenderer {
  private renderer: Renderer | null = null
  private context: any = null
  private readonly svgContainer: HTMLElement
  /** Stored bounds for each rendered measure (keyed by measure number) */
  private measureBounds: Map<number, MeasureBounds> = new Map()
  /** Registry tracking all rendered elements and their positions */
  private elementRegistry: ElementRegistry = new ElementRegistry()
  /** Map of note IDs to their rendered StaveNotes (for tie rendering) */
  private staveNoteMap: Map<string, { staveNote: StaveNote; noteIndex: number }> = new Map()
  /** Map of tuplet IDs to their rendered VexFlow Tuplet objects (for scoped highlight) */
  private tupletObjectMap: Map<string, VexFlowTuplet> = new Map()
  /** Map of dynamic IDs to their rendered VexFlow Annotation objects (for scoped highlight) */
  private dynamicObjectMap: Map<string, Annotation> = new Map()
  /** Map of slur IDs to their rendered SVG group (`<g class="vf-slur">`) for scoped highlight */
  private slurGroupMap: Map<string, SVGGElement> = new Map()
  /** Map of tie from-note IDs to their rendered SVG group (`<g class="vf-tie">`) for scoped highlight */
  private tieGroupMap: Map<string, SVGGElement> = new Map()
  /** Dynamic currently being edited in the in-canvas text overlay — skipped while
   *  rendering so the engraved glyph doesn't show doubled under the editor. */
  private suppressedDynamicId: string | null = null
  /** Map of measure numbers to their layout info (including line number) */
  private measureLayoutInfo: Map<number, MeasureWidthInfo> = new Map()
  /** Snapshot of the layout captured when frozen. While non-null, renderScore
   *  reuses it instead of recomputing line breaks/widths — used during a clef
   *  drag to stop the score reflowing. Survives clear() (kept off measureLayoutInfo). */
  private frozenLayout: Map<number, MeasureWidthInfo> | null = null
  /** The clef currently being dragged (or null). Used to keep a dragged clef that
   *  sits in a redundant position visible during the drag (it would otherwise be
   *  hidden at beat 0), instead of disappearing under the cursor. */
  private draggingClef: { measure: number; beat: Fraction } | null = null

  constructor(containerElement: HTMLElement) {
    this.svgContainer = containerElement
  }

  /**
   * Get the element registry (contains positions of all rendered elements)
   */
  getElementRegistry(): ElementRegistry {
    return this.elementRegistry
  }

  /**
   * Get the bounds for a specific measure (after rendering)
   */
  getMeasureBounds(measureNumber: number): MeasureBounds | undefined {
    return this.measureBounds.get(measureNumber)
  }

  /**
   * Get all measure bounds
   */
  getAllMeasureBounds(): Map<number, MeasureBounds> {
    return this.measureBounds
  }

  /**
   * Bundle this render's per-render state into a {@link RenderPass}. The pass carries
   * **references** to the instance-field maps (not copies), so the sub-renderers that
   * consume it populate the very maps the post-render accessors later read. Call only
   * after `measureLayoutInfo` has been (re)assigned for this render.
   */
  private createRenderPass(): RenderPass {
    return {
      context: this.context,
      staveNoteMap: this.staveNoteMap,
      tupletObjectMap: this.tupletObjectMap,
      dynamicObjectMap: this.dynamicObjectMap,
      slurGroupMap: this.slurGroupMap,
      tieGroupMap: this.tieGroupMap,
      measureLayoutInfo: this.measureLayoutInfo,
      measureBounds: this.measureBounds,
      elementRegistry: this.elementRegistry,
      suppressedDynamicId: this.suppressedDynamicId,
    }
  }

  /**
   * Initialize the VexFlow renderer
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   */
  initialize(width: number, height: number): void {
    // Clear any existing content
    this.svgContainer.innerHTML = ''

    // Create VexFlow SVG renderer
    this.renderer = new Renderer(this.svgContainer as HTMLDivElement, Renderer.Backends.SVG)
    this.renderer.resize(width, height)
    this.context = this.renderer.getContext()

    // Disable save/restore to avoid structuredClone issues with Vue reactivity
    this.context.save = () => {}
    this.context.restore = () => {}
  }

  /**
   * Interleave inline ClefNotes (for mid-measure clef changes) among the slot
   * StaveNotes. Each change is inserted before the first slot at/after its beat.
   * ClefNotes ignore ticks, so the voice's tick total is unaffected.
   * @returns the combined tickable list and a map of beat→ClefNote for registration
   */
  private interleaveClefNotes(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    midChanges: { beat: Fraction; clef: Clef }[],
  ): { tickables: (StaveNote | ClefNote)[]; clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> } {
    const tickables: (StaveNote | ClefNote)[] = []
    const clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> = []
    const remaining = [...midChanges]

    const emit = (change: { beat: Fraction; clef: Clef }) => {
      const clefNote = new ClefNote(change.clef, 'small')
      tickables.push(clefNote)
      clefNoteByBeat.push({ beat: change.beat, clef: change.clef, clefNote })
    }

    for (let i = 0; i < sortedSlots.length; i++) {
      const slotBeat = sortedSlots[i].beat
      // Emit any pending clef change whose beat is at/before this slot's beat.
      while (remaining.length && fracLte(remaining[0].beat, slotBeat)) {
        emit(remaining.shift()!)
      }
      tickables.push(staveNotes[i])
    }
    // Any leftover changes (beat past all slots) append at the end.
    for (const change of remaining) emit(change)

    return { tickables, clefNoteByBeat }
  }

  /**
   * Register rendered inline clef glyphs as 'clef' elements (with measure + beat)
   * for hit detection (mid-measure clef removal) and clef-segment lookup.
   */
  private registerMidMeasureClefs(
    clefNoteByBeat: Array<{ beat: Fraction; clefNote: ClefNote }>,
    measure: Measure,
  ): void {
    for (const { beat, clefNote } of clefNoteByBeat) {
      try {
        const box = clefNote.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'clef',
            measure: measure.number,
            beat: fracToNumber(beat),
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (e) { /* getBoundingBox may fail */ }
    }
  }


  /**
   * Calculate the stem direction for an entire beam group.
   * Uses the pitch furthest from the middle line across all slots.
   * @param slots - ChordRest slots in the beam group
   * @param clef - Clef type for middle line reference
   * @returns VexFlow stem direction value (1 = UP, -1 = DOWN)
   */
  private calculateBeamGroupStemDirection(slots: ChordRest[], clef: Clef = 'treble', forcedStemDirection?: number): number {
    // Explicit override on any note in the group takes priority over pitch calculation
    for (const slot of slots) {
      if (slot.type === 'chord' && slot.stemDirection === 'up') return 1
      if (slot.type === 'chord' && slot.stemDirection === 'down') return -1
    }

    // Multi-voice default (V1 up / V2 down) wins over the pitch calculation.
    if (forcedStemDirection !== undefined) return forcedStemDirection

    // No override — use the pitch furthest from the middle line
    const middleDiatonic = middleLineDiatonicPos(clef)
    let maxDistance = 0
    let furthestDiatonic = middleDiatonic
    let hasPitch = false

    for (const slot of slots) {
      if (slot.type === 'rest') continue
      for (const p of slot.notes) {
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const distance = Math.abs(dPos - middleDiatonic)
        if (!hasPitch || distance > maxDistance) {
          maxDistance = distance
          furthestDiatonic = dPos
          hasPitch = true
        }
      }
    }

    return furthestDiatonic >= middleDiatonic ? -1 : 1
  }

  /**
   * Create beam groups from stave notes and their corresponding slots.
   * Returns arrays of StaveNotes that should be beamed together, along with slot data.
   *
   * @param staveNotes - The VexFlow StaveNote objects (one per slot)
   * @param slots - ChordRest slots sorted by beat (parallel to staveNotes)
   * @param meter - The measure's metric hierarchy (drives default grouping)
   * @returns Array of beam group info with stave notes and slots
   */
  private createBeamGroups(
    staveNotes: StaveNote[],
    slots: ChordRest[],
    meter: MeterInfo
  ): { staveNotes: StaveNote[]; slots: ChordRest[] }[] {
    // Pure grouping (slot indices) → map back onto the parallel StaveNotes.
    return computeBeamGroups(slots, meter).map((indices) => ({
      staveNotes: indices.map((i) => staveNotes[i]),
      slots: indices.map((i) => slots[i]),
    }))
  }

  /**
   * Calculate the optimal location (above or below) for a tuplet bracket
   * Based on the stem direction of the notes in the tuplet
   * @param staveNotes - The VexFlow StaveNotes in the tuplet
   * @param clef - The clef type for pitch reference
   * @returns VexFlow.Tuplet.LOCATION_TOP (1) or VexFlow.Tuplet.LOCATION_BOTTOM (-1)
   */
  private calculateTupletLocation(staveNotes: StaveNote[], _clef: Clef): number {
    // VexFlow constants: LOCATION_TOP = 1, LOCATION_BOTTOM = -1
    const LOCATION_TOP = 1
    const LOCATION_BOTTOM = -1

    if (staveNotes.length === 0) return LOCATION_TOP

    // Check if all notes have stems down (then bracket goes above)
    // or if all notes have stems up (then bracket goes below)
    // Mixed directions: use majority or default to above
    let stemsUp = 0
    let stemsDown = 0

    for (const note of staveNotes) {
      try {
        const stem = note.getStem()
        if (stem) {
          // getStemDirection returns 1 for up, -1 for down
          const direction = note.getStemDirection()
          if (direction === 1) stemsUp++
          else if (direction === -1) stemsDown++
        } else {
          // No stem (whole note or rest) - use default
          stemsDown++
        }
      } catch (e) {
        // getStem may fail for rests
        stemsDown++
      }
    }

    // Bracket goes opposite to stem direction:
    // - Stems up → bracket below
    // - Stems down → bracket above
    if (stemsUp > stemsDown) {
      return LOCATION_BOTTOM
    } else {
      return LOCATION_TOP
    }
  }

  /**
   * Resolve the opening clef of every measure (the clef drawn at its barline /
   * line start). Mid-measure changes are handled per-slot during rendering.
   * @returns Map of measure number → opening clef
   */
  private computeEffectiveClefs(score: Score): Map<number, Clef> {
    const map = new Map<number, Clef>()
    for (const measure of score.measures) {
      map.set(measure.number, measureOpeningClef(score, measure.number))
    }
    return map
  }

  /**
   * Render a single measure
   * @param measure - Measure to render
   * @param x - X position on canvas
   * @param y - Y position on canvas
   * @param width - Width of the measure
   * @param isFirstInLine - Whether this is the first measure in a line
   * @param clef - Effective clef for this measure (rendering and stem direction)
   * @param hasClefChange - Whether this measure's clef differs from the previous measure
   * @param cautionaryEndClef - Clef to draw at the measure end as a cautionary warning
   *   (set when this is a line's last measure and the next line opens with a new clef)
   * @param ghostClefBeat - Beat of a dragged-redundant clef in this measure to keep
   *   visible during the drag even at beat 0, where it would otherwise be hidden
   * @param cautionaryEndTimeSig - Time signature to draw (full size) at the measure
   *   end as a courtesy warning (set when the next line opens with a meter change)
   */
  renderMeasure(
    pass: RenderPass,
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean = false,
    clef: Clef = 'treble',
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    ghostClefBeat?: Fraction,
    cautionaryEndTimeSig?: TimeSignature
  ): void {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    const stave = this.buildAndDrawStave(measure, x, y, width, isFirstInLine, clef, hasClefChange, cautionaryEndClef, cautionaryEndTimeSig)

    // Resolve the clef in effect at any beat within this measure: starts from the
    // opening clef and applies each clef change at/after its beat.
    const clefForBeat = makeClefResolver(measure, clef)
    // Mid-measure changes (beat > 0) render as inline ClefNotes before their slot.
    const midChanges: { beat: Fraction; clef: Clef }[] = (measure.clefs ?? [])
      .filter(c => !fracIsZero(c.beat))
      .sort((a, b) => fracCompare(a.beat, b.beat))
      .map(c => ({ beat: c.beat, clef: c.clef }))

    // If the dragged-redundant clef sits at beat 0, the opening clef is suppressed
    // (redundant), so render it as an inline clef at the measure start to keep it
    // visible during the drag (it's removed on drop by commitClefMove).
    if (ghostClefBeat !== undefined && fracIsZero(ghostClefBeat)) {
      const opening = (measure.clefs ?? []).find(c => fracIsZero(c.beat))
      if (opening) midChanges.unshift({ beat: opening.beat, clef: opening.clef })
    }

    // Clef regions for pixel↔pitch lookup; opening clef covers the whole measure,
    // each inline clef (added after draw) starts a new region at its X.
    const clefSegments: ClefSegment[] = [{ fromX: x, clef }]

    if (measure.slots.length > 0) {
      const sortedAll = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))

      // Group slots by model voice (0 = primary). With more than one voice, engrave
      // them as independent streams (Sibelius-style): V1 (voice 0) stems up, V2
      // (voice 1) stems down, and rests are pushed apart so they don't collide.
      const REST_LINE_SHIFT = 2
      const voiceIds = [...new Set(sortedAll.map(s => s.voice ?? 0))].sort((a, b) => a - b)
      const multiVoice = voiceIds.length > 1
      const groups = voiceIds.map(v => {
        const slots = sortedAll.filter(s => (s.voice ?? 0) === v)
        const forcedStem = multiVoice ? (v === 0 ? 1 : -1) : undefined
        const restShift = multiVoice ? (v === 0 ? REST_LINE_SHIFT : -REST_LINE_SHIFT) : 0
        // notesOnly: one StaveNote per slot (used for beams, tuplets, registration).
        const staveNotes = createStaveNotesFromSlots(slots, clefForBeat, forcedStem, restShift)
        return { voice: v, slots, staveNotes, forcedStem }
      })

      // Combined parallel arrays (group order) for the once-per-measure passes that
      // already key on voice / tupletId internally — dynamics, tuplets, registration.
      const sortedSlots = groups.flatMap(g => g.slots)
      const staveNotes = groups.flatMap(g => g.staveNotes)

      // Attach dynamics as Annotation modifiers BEFORE formatting so they reserve
      // vertical space and stack with articulations. Co-located marks (stacked at
      // one beat) come back as id-groups, repositioned onto one row after drawing.
      const dynamicGroups = attachDynamicsToSlots(pass, sortedSlots, staveNotes, measure)

      // Tuplets must be created BEFORE adding notes to voice — VexFlow adjusts tick
      // values. A tuplet belongs to one voice, so grouping by tupletId is voice-safe.
      const { vexTuplets, tupletStaveNoteMap } = this.buildVexTuplets(sortedSlots, staveNotes, measure, clef, multiVoice)

      const meter = getMeterInfo(measure.timeSignature)
      const capacity = measureCapacityFrac(measure)

      // One VexFlow Voice per group. Mid-measure clef glyphs are staff-wide, so only
      // the primary voice carries the inline ClefNotes (they're tickless, so the
      // voices still share a tick total and Formatter.joinVoices won't mismatch).
      const built = groups.map((g, gi) => {
        let tickables: (StaveNote | ClefNote)[]
        let clefNoteByBeat: Array<{ beat: Fraction; clef: Clef; clefNote: ClefNote }> = []
        if (gi === 0) {
          const r = this.interleaveClefNotes(g.slots, g.staveNotes, midChanges)
          tickables = r.tickables
          clefNoteByBeat = r.clefNoteByBeat
        } else {
          tickables = g.staveNotes
        }
        const voice = new Voice({
          numBeats: measure.timeSignature.numerator,
          beatValue: measure.timeSignature.denominator,
        }).setMode(chooseVoiceMode(g.slots, capacity))
        voice.addTickables(tickables)
        const beams = this.buildBeams(g.staveNotes, g.slots, meter, clefForBeat, g.forcedStem)
        return { voice, beams, clefNoteByBeat }
      })

      try {
        const vexVoices = built.map(b => b.voice)
        const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX()
        const formatWidth = Math.max(noteAreaWidth - 15, 50)
        new Formatter().joinVoices(vexVoices).format(vexVoices, formatWidth)

        // VexFlow's StaveNote.format() merges two voices' same-duration rests at
        // the same beat into one by setting the lower rest's renderOptions.draw =
        // false. We always want every voice's rest visible (they're already pushed
        // apart by restShift), so re-enable drawing on all rests after formatting.
        if (multiVoice) {
          for (const sn of staveNotes) {
            if (sn.isRest()) (sn.renderOptions as { draw?: boolean }).draw = true
          }
        }

        for (const b of built) {
          b.voice.draw(this.context, stave)
          for (const beam of b.beams) {
            beam.setContext(this.context).draw()
          }
        }

        this.drawAndRegisterTuplets(vexTuplets, tupletStaveNoteMap, measure, multiVoice)
        this.registerSlotElements(sortedSlots, staveNotes, measure)
        registerDynamics(pass, measure)
        // Co-located dynamics: reposition onto one row (placement order, newest
        // right) AFTER registration so their bboxes are present to update.
        layoutCoLocatedDynamics(pass, dynamicGroups)
        for (const b of built) this.registerBeams(b.beams, measure)

        // Mid-measure clefs are carried by the primary voice only.
        const primaryClefNotes = built[0]?.clefNoteByBeat ?? []
        this.registerMidMeasureClefs(primaryClefNotes, measure)

        // Extend clef regions with each inline clef's actual X position.
        for (const { clef: segClef, clefNote } of primaryClefNotes) {
          try {
            const box = clefNote.getBoundingBox()
            if (box) clefSegments.push({ fromX: box.x, clef: segClef })
          } catch (e) { /* getBoundingBox may fail */ }
        }
        clefSegments.sort((a, b) => a.fromX - b.fromX)
      } catch (error) {
        console.error(`  ❌ Could not render measure ${measure.number}: ${error}`)
        console.error(`  - Measure data:`, JSON.stringify(measure, null, 2))
      }
    }

    this.registerStaffAndGeometry(stave, measure, x, y, width, isFirstInLine, clef, hasClefChange, clefSegments)
  }

  private buildAndDrawStave(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    cautionaryEndTimeSig?: TimeSignature,
  ): Stave {
    const stave = new Stave(x, y, width)

    if (measure.number === 1 || isFirstInLine) {
      // Line start: full-size clef showing the effective clef for this measure
      stave.addClef(clef)
    } else if (hasClefChange) {
      // Mid-line clef change: smaller clef at the start of the measure it applies to
      stave.addClef(clef, 'small')
    }
    if (drawsTimeSignature(measure)) {
      stave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
    }
    if (cautionaryEndClef) {
      // Cautionary clef before a line break: warns of the next line's new clef.
      stave.addEndClef(cautionaryEndClef, 'small')
    }
    if (cautionaryEndTimeSig) {
      // Cautionary time signature before a line break: warns of the next line's new
      // meter. Drawn full size (no 'small') and placed after the final barline.
      stave.addEndTimeSignature(`${cautionaryEndTimeSig.numerator}/${cautionaryEndTimeSig.denominator}`)
    }

    // VexFlow's Stem.draw() leaves ctx.lineWidth at Stem.WIDTH (1.5) and Stave.draw()
    // strokes its lines with whatever width is current — so a prior measure's stems
    // would thicken this staff. Pin it back to 1 before drawing the staff lines.
    this.context!.setLineWidth?.(1)
    stave.setContext(this.context!).draw()

    this.measureBounds.set(measure.number, {
      measureX: x,
      measureY: y,
      measureWidth: width,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
    })

    return stave
  }

  private buildVexTuplets(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
    clef: Clef,
    multiVoice: boolean,
  ): { vexTuplets: VexFlowTuplet[]; tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }> } {
    const tupletStaveNoteMap = new Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }>()

    for (let idx = 0; idx < sortedSlots.length && idx < staveNotes.length; idx++) {
      const slot = sortedSlots[idx]
      if (slot.tupletId) {
        const tupletData = (measure.tuplets || []).find(t => t.id === slot.tupletId)
        if (tupletData) {
          if (!tupletStaveNoteMap.has(slot.tupletId)) {
            // A tuplet lives in exactly one voice, so the first slot's voice is the
            // tuplet's voice (0 = primary).
            tupletStaveNoteMap.set(slot.tupletId, { staveNotes: [], tuplet: tupletData, voice: slot.voice ?? 0 })
          }
          tupletStaveNoteMap.get(slot.tupletId)!.staveNotes.push(staveNotes[idx])
        }
      }
    }

    const vexTuplets: VexFlowTuplet[] = []
    for (const [_tupletId, { staveNotes: tupletStaveNotes, tuplet: tupletData, voice }] of tupletStaveNoteMap) {
      if (tupletStaveNotes.length >= 2) {
        try {
          // An explicit placement override (e.g. from the `x` flip) always wins.
          // Otherwise: with multiple voices the bracket follows the voice's stem
          // side (V1 stems up → above, lower voices stems down → below) so the two
          // voices' brackets spread to the outer edges instead of colliding in the
          // middle. With a single voice, fall back to the stem-derived default.
          const location = resolveTupletLocation(
            tupletData.placement,
            multiVoice,
            voice,
            this.calculateTupletLocation(tupletStaveNotes, clef)
          )
          const vexTuplet = new VexFlowTuplet(tupletStaveNotes, {
            numNotes: tupletData.numNotes,
            notesOccupied: tupletData.notesOccupied,
            location,
            bracketed: true,
          })
          vexTuplets.push(vexTuplet)
        } catch (tupletError) {
          console.warn(`Could not create tuplet: ${tupletError}`)
        }
      }
    }

    return { vexTuplets, tupletStaveNoteMap }
  }

  private buildBeams(
    staveNotes: StaveNote[],
    sortedSlots: ChordRest[],
    meter: MeterInfo,
    clefForBeat: (beat: Fraction) => Clef,
    forcedStemDirection?: number,
  ): Beam[] {
    const beamGroups = this.createBeamGroups(staveNotes, sortedSlots, meter)
    const beams: Beam[] = []

    for (const beamGroup of beamGroups) {
      try {
        // A beam group lies within one clef region; use the clef at its first slot.
        const groupClef = beamGroup.slots.length ? clefForBeat(beamGroup.slots[0].beat) : 'treble'
        const beamStemDirection = this.calculateBeamGroupStemDirection(beamGroup.slots, groupClef, forcedStemDirection)
        for (const staveNote of beamGroup.staveNotes) {
          staveNote.setStemDirection(beamStemDirection)
        }
        beams.push(new Beam(beamGroup.staveNotes))
      } catch (beamError) {
        console.warn(`Could not create beam: ${beamError}`)
      }
    }

    return beams
  }

  private drawAndRegisterTuplets(
    vexTuplets: VexFlowTuplet[],
    tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet; voice: number }>,
    measure: Measure,
    multiVoice: boolean,
  ): void {
    for (const vexTuplet of vexTuplets) {
      try {
        const tupletNotes = vexTuplet.getNotes() as StaveNote[]
        if (tupletNotes.length === 0) continue

        for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData, voice }] of tupletStaveNoteMap) {
          if (!tStaveNotes.includes(tupletNotes[0])) continue

          const vt = vexTuplet as any
          const notes = vt.notes as StaveNote[]
          const firstNote = notes?.[0]
          const lastNote = notes?.[notes.length - 1]
          if (!firstNote || !lastNote) break

          const location = (vt.options?.location ?? 1) as 1 | -1
          const bracketed = vt.options?.bracketed ?? true

          // A bracket flipped to the INNER side (toward the other voice) would be shoved
          // to the far edge of the system by VexFlow's staff-edge clamp; nudge it back
          // next to its own notes via yOffset. Must be set BEFORE draw(), which reads it.
          const stems: TupletNoteStem[] = notes.map(n => {
            const ext = (n.getStemExtents?.() ?? { topY: 0, baseY: 0 }) as { topY: number; baseY: number }
            return { stemUp: n.getStemDirection?.() === 1, topY: ext.topY, baseY: ext.baseY }
          })
          const flipOffset = innerFlipTupletYOffset(
            stems, location, voice, multiVoice, vexTuplet.getYPosition()
          )
          if (flipOffset !== 0) vt.options.yOffset = (vt.options.yOffset ?? 0) + flipOffset

          vexTuplet.setContext(this.context!).draw()

          // Use VexFlow's OWN post-draw geometry so the registered hit-box matches the
          // drawn bracket exactly. VexFlow draws the horizontal bracket line at
          // getYPosition(), the legs hanging toward the notes (length location*10), and
          // the number on the outer side. Our previous stem-extent estimate (fixed
          // gap/height) drifted off the real bracket — badly in multi-voice / flipped
          // tuplets, where VexFlow anchors a top bracket above the whole system.
          const bracketPadding = 5
          const xStart = bracketed ? firstNote.getTieLeftX() - bracketPadding : firstNote.getStemX()
          const xEnd = bracketed ? lastNote.getTieRightX() + bracketPadding : lastNote.getStemX()
          const tupletWidth = xEnd - xStart

          const bracketLineY = vexTuplet.getYPosition() // the horizontal bracket line
          const bracketLegLength = 10
          const numberHeight = vt.textElement?.getHeight?.() ?? 14
          // The number sits on the outer side of the line, the legs hang inward. Cover
          // both (plus a little padding) so a click anywhere on the visible bracket or
          // its number registers.
          const vPad = 6
          const bboxY = location === 1
            ? bracketLineY - numberHeight - vPad
            : bracketLineY - bracketLegLength - vPad
          const bboxHeight = numberHeight + bracketLegLength + 2 * vPad

          const tupletGeometry: TupletGeometry = {
            x: xStart,
            y: bracketLineY,
            width: tupletWidth,
            bracketed,
            location,
            bracketLegLength,
            bracketThickness: 1,
            bracketPadding,
            notationCenterX: xStart + tupletWidth / 2,
            textYOffset: vt.options?.textYOffset ?? 0,
            yOffset: vt.options?.yOffset ?? 0,
          }

          this.elementRegistry.add({
            type: 'tuplet',
            tupletId,
            measure: measure.number,
            startBeat: fracToNumber(tupletData.startBeat),
            numNotes: tupletData.numNotes,
            bbox: { x: xStart, y: bboxY, width: tupletWidth, height: bboxHeight },
            tupletGeometry,
          })
          // Keep the VexFlow Tuplet so its own SVG group can be recolored for selection
          // (avoids a document-wide scan that bleeds into neighbouring systems).
          this.tupletObjectMap.set(tupletId, vexTuplet)
          break
        }
      } catch (e) {
        // Drawing or getBoundingBox may fail
      }
    }
  }

  private registerSlotElements(
    sortedSlots: ChordRest[],
    staveNotes: StaveNote[],
    measure: Measure,
  ): void {
    for (let si = 0; si < sortedSlots.length && si < staveNotes.length; si++) {
      const slot = sortedSlots[si]
      const staveNote = staveNotes[si]

      if (slot.type === 'rest') {
        try {
          const box = staveNote.getBoundingBox()
          if (box) {
            this.elementRegistry.add({
              type: 'rest',
              id: slot.id,
              measure: measure.number,
              beat: fracToNumber(slot.beat),
              duration: slot.duration,
              tupletId: slot.tupletId,
              bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
            })
            // Add rest to staveNoteMap so ties pointing to this rest can be rendered
            this.staveNoteMap.set(slot.id, { staveNote, noteIndex: 0 })
          }
        } catch (e) { /* getBoundingBox may fail */ }
      } else {
        try {
          const box = staveNote.getBoundingBox()
          if (box) {
            // Sort pitches low→high by MIDI to match VexFlow's internal key ordering
            const sortedPitches = [...slot.notes].sort(
              (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
            )

            for (let keyIndex = 0; keyIndex < sortedPitches.length; keyIndex++) {
              const pitch = sortedPitches[keyIndex]
              const pitchMidi = spellingToMidi(pitch.step, pitch.alter, pitch.octave)

              this.elementRegistry.add({
                type: 'note',
                id: pitch.id,
                measure: measure.number,
                beat: fracToNumber(slot.beat),
                pitch: pitchMidi,
                duration: slot.duration,
                tupletId: slot.tupletId,
                bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
              })

              // keyIndex matches VexFlow's sorted pitch order
              this.staveNoteMap.set(pitch.id, { staveNote, noteIndex: keyIndex })

              // Articulations: register on the lowest-pitch note (index 0); data lives on chord
              if (keyIndex === 0 && slot.articulations?.length) {
                try {
                  const modifiers = staveNote.getModifiers()
                  // Modifiers were added in ARTICULATION_RENDER_ORDER, NOT slot order — so
                  // index the same sorted list, or the type↔glyph labels get swapped when a
                  // note has multiple articulations (breaking highlight, delete and flip).
                  const sortedArticulations = (slot.articulations ?? []).slice().sort(
                    (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
                  )
                  let articulationIndex = 0
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Articulation') {
                      const artBox = modifier.getBoundingBox()
                      if (artBox) {
                        this.elementRegistry.add({
                          type: 'articulation',
                          noteId: pitch.id,
                          articulationType: sortedArticulations[articulationIndex],
                          measure: measure.number,
                          beat: fracToNumber(slot.beat),
                          bbox: { x: artBox.x, y: artBox.y, width: artBox.w, height: artBox.h },
                        })
                      }
                      articulationIndex++
                    }
                  }
                } catch (e) { /* Articulation bounding box may not be available */ }
              }

              if (pitch.alter !== 0 || pitch.forceAccidental) {
                try {
                  const modifiers = staveNote.getModifiers()
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Accidental') {
                      const accidental = modifier as Accidental
                      if ((accidental as any).index === keyIndex ||
                          (accidental as any).note_index === keyIndex ||
                          modifiers.filter(m => m.getCategory() === 'Accidental').indexOf(modifier) === keyIndex) {
                        const accBox = accidental.getBoundingBox()
                        if (accBox) {
                          const accStr = pitch.alter === 2 ? '##' : pitch.alter === 1 ? '#'
                            : pitch.alter === -1 ? 'b' : pitch.alter === -2 ? 'bb' : 'n'
                          this.elementRegistry.add({
                            type: 'accidental',
                            noteId: pitch.id,
                            measure: measure.number,
                            beat: fracToNumber(slot.beat),
                            pitch: pitchMidi,
                            accidentalType: accStr,
                            bbox: { x: accBox.x, y: accBox.y, width: accBox.w, height: accBox.h },
                          })
                        }
                        break
                      }
                    }
                  }
                } catch (e) { /* Accidental bounding box may not be available */ }
              }
            }
          }
        } catch (e) { /* getBoundingBox may fail */ }
      }
    }
  }

  private registerBeams(beams: Beam[], measure: Measure): void {
    for (const beam of beams) {
      try {
        const box = beam.getBoundingBox()
        if (box) {
          this.elementRegistry.add({
            type: 'beam',
            measure: measure.number,
            bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
          })
        }
      } catch (e) { /* getBoundingBox may fail */ }
    }
  }

  private registerStaffAndGeometry(
    stave: Stave,
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false,
    clefSegments?: ClefSegment[],
  ): void {
    try {
      const staveBox = stave.getBoundingBox()
      if (staveBox) {
        this.elementRegistry.add({
          type: 'staff',
          measure: measure.number,
          bbox: { x: staveBox.x, y: staveBox.y, width: staveBox.w, height: staveBox.h },
        })
      }

      const lineYPositions: [number, number, number, number, number] = [
        stave.getYForLine(0),
        stave.getYForLine(1),
        stave.getYForLine(2),
        stave.getYForLine(3),
        stave.getYForLine(4),
      ]
      this.elementRegistry.setStaffGeometry({
        measure: measure.number,
        lineYPositions,
        lineSpacing: lineYPositions[1] - lineYPositions[0],
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        clef,
        clefSegments: clefSegments && clefSegments.length > 1 ? clefSegments : undefined,
      })
    } catch (e) { /* getBoundingBox or getYForLine may fail */ }

    // Register the opening clef (beat 0) when a clef glyph is drawn at the
    // measure start: at line starts (full clef) or mid-line clef changes (smaller
    // clef). Mid-measure (inline) clefs are registered separately after drawing.
    // beat 0 lets clef removal target the opening clef specifically.
    if (measure.number === 1 || isFirstInLine) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        beat: 0,
        // The big line-start clef is anchored to the line and cannot be dragged.
        immovable: true,
        bbox: { x, y, width: LAYOUT_CONFIG.CLEF_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    } else if (hasClefChange) {
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        beat: 0,
        bbox: { x, y, width: LAYOUT_CONFIG.CLEF_CHANGE_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    }

    if (drawsTimeSignature(measure)) {
      // Position after whatever clef glyph (if any) was drawn at the measure start.
      const clefOffset =
        measure.number === 1 || isFirstInLine
          ? LAYOUT_CONFIG.CLEF_WIDTH
          : hasClefChange
            ? LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
            : 0
      // Clamp the TS hit-box so its right edge never crosses noteStartX. The
      // approximate TIME_SIG_WIDTH over-estimates the real glyph and would
      // otherwise bleed into the note-entry zone, swallowing clicks that land
      // just right of the glyph (rejected as "clicked on timeSignature").
      const tsX = x + clefOffset
      const tsWidth = Math.min(LAYOUT_CONFIG.TIME_SIG_WIDTH, stave.getNoteStartX() - tsX)
      if (tsWidth > 0) {
        this.elementRegistry.add({
          type: 'timeSignature',
          measure: measure.number,
          bbox: {
            x: tsX,
            y,
            width: tsWidth,
            height: LAYOUT_CONFIG.STAVE_HEIGHT,
          },
        })
      }
    }

    this.elementRegistry.add({
      type: 'barline',
      measure: measure.number,
      bbox: { x: x + width - 2, y, width: 4, height: LAYOUT_CONFIG.STAVE_HEIGHT },
    })
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview (rawX for smooth cursor following)
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  /**
   * Freeze/unfreeze the line layout. Freezing snapshots the current measure
   * widths and line assignments; while frozen, renderScore reuses that snapshot
   * so dragging a clef redraws the notes (re-pitched by the moved clef) without
   * reflowing the score. The snapshot is taken here (not in renderScore) because
   * clearCanvas() wipes measureLayoutInfo before each render.
   */
  setLayoutFrozen(frozen: boolean): void {
    this.frozenLayout = frozen && this.measureLayoutInfo.size > 0
      ? new Map(this.measureLayoutInfo)
      : null
  }

  /** Set/clear the clef currently being dragged (to keep a redundant one visible). */
  setDraggingClef(info: { measure: number; beat: Fraction } | null): void {
    this.draggingClef = info
  }

  /**
   * If a clef is being dragged within this measure AND it's redundant (equals the
   * clef in effect just before it, so it'll be removed on drop), return its beat
   * so it can be force-rendered while dragging. Otherwise undefined.
   */
  private ghostClefBeatFor(score: Score, measureNumber: number): Fraction | undefined {
    if (!this.draggingClef || this.draggingClef.measure !== measureNumber) return undefined
    const beat = this.draggingClef.beat
    const measure = score.measures.find(m => m.number === measureNumber)
    const change = measure?.clefs?.find(c => fracEq(c.beat, beat))
    if (!change) return undefined
    return change.clef === effectiveClefBefore(score, measureNumber, beat) ? beat : undefined
  }

  renderScore(score: Score, ghostNote?: GhostNote): boolean {
    if (!this.context || !this.renderer) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Always clear before rendering to prevent accumulation
    this.clear()

    // Use layout configuration
    const margin = LAYOUT_CONFIG.MARGIN
    const staveHeight = LAYOUT_CONFIG.STAVE_HEIGHT
    const verticalSpacing = LAYOUT_CONFIG.VERTICAL_SPACING
    const containerWidth = LAYOUT_CONFIG.CONTAINER_WIDTH

    // Resolve the clef in effect at each measure (handles per-measure changes)
    const effectiveClefs = this.computeEffectiveClefs(score)

    // Calculate proportional widths for all measures (or reuse the frozen layout).
    // Copy the frozen snapshot so the next clear() doesn't wipe it (same Map ref).
    const measureWidths = this.frozenLayout
      ? new Map(this.frozenLayout)
      : calculateMeasureWidths(score, effectiveClefs)
    // Store for use in tie rendering (to determine which line each measure is on)
    this.measureLayoutInfo = measureWidths

    // Bundle this render's per-render state (references to the instance-field maps —
    // see RenderPass for the lifetime contract). Created here, before the measure loop,
    // so the per-measure sub-renderers (dynamics) and the post-measure ones (ties/slurs)
    // share one pass.
    const pass = this.createRenderPass()

    // Find the number of lines from the calculated widths
    let maxLine = 0
    for (const info of measureWidths.values()) {
      maxLine = Math.max(maxLine, info.lineNumber)
    }
    const numLines = maxLine + 1
    const totalHeight = numLines * (staveHeight + verticalSpacing) + margin * 2

    // Check if SVG exists (should always exist after initialization)
    const svg = this.getSVGElement()
    if (!svg) {
      throw new Error('SVG element not found. Renderer may not be properly initialized.')
    }

    // Get current SVG size
    const currentWidth = parseInt(svg.getAttribute('width') || '0')
    const currentHeight = parseInt(svg.getAttribute('height') || '0')

    // Only resize if dimensions changed (following VexFlow best practice)
    if (currentWidth !== containerWidth || currentHeight !== totalHeight) {
      this.renderer!.resize(containerWidth, totalHeight)
    }

    // Render each measure with calculated widths
    let currentLine = -1
    let currentX = margin

    score.measures.forEach((measure) => {
      const widthInfo = measureWidths.get(measure.number)
      if (!widthInfo) {
        console.error(`No width info for measure ${measure.number}`)
        return
      }

      // Check if we've moved to a new line
      if (widthInfo.lineNumber !== currentLine) {
        currentLine = widthInfo.lineNumber
        currentX = margin
      }

      const y = margin + currentLine * (staveHeight + verticalSpacing)
      const isFirstInLine = currentX === margin
      const clef = effectiveClefs.get(measure.number) || 'treble'
      const prevEndClef = measure.number > 1 ? measureEndingClef(score, measure.number - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
      const ghostClefBeat = this.ghostClefBeatFor(score, measure.number)

      this.renderMeasure(pass, measure, currentX, y, widthInfo.finalWidth, isFirstInLine, clef, hasClefChange, widthInfo.cautionaryEndClef, ghostClefBeat, widthInfo.cautionaryEndTimeSig)

      currentX += widthInfo.finalWidth
    })

    // Render ties between measures after all measures are drawn
    renderTies(pass, score)

    // Render phrasing slurs (top-level spans) after ties, in the same post-measure pass
    renderSlurs(pass, score)

    // Render ghost note AFTER all measures (as an overlay)
    let ghostNoteRendered = false
    if (ghostNote) {
      // For ghost note, we need to find the measure's actual position
      const ghostMeasureInfo = measureWidths.get(ghostNote.measure)
      if (ghostMeasureInfo) {
        ghostNoteRendered = this.renderGhostNoteWithDynamicWidths(
          ghostNote,
          score,
          measureWidths,
          margin,
          staveHeight,
          verticalSpacing
        )
      }
    }

    return ghostNoteRendered
  }

  private renderGhostNoteWithDynamicWidths(
    ghostNote: GhostNote,
    score: Score,
    measureWidths: Map<number, MeasureWidthInfo>,
    margin: number,
    staveHeight: number,
    verticalSpacing: number
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

      // Calculate X position by summing widths of previous measures on the same line
      let measureX = margin
      for (const m of score.measures) {
        if (m.number === ghostNote.measure) break
        const mInfo = measureWidths.get(m.number)
        if (mInfo && mInfo.lineNumber === widthInfo.lineNumber) {
          measureX += mInfo.finalWidth
        } else if (mInfo && mInfo.lineNumber < widthInfo.lineNumber) {
          measureX = margin
        }
      }

      const measureY = margin + widthInfo.lineNumber * (staveHeight + verticalSpacing)
      const staveWidth = widthInfo.finalWidth
      const effectiveClefs = this.computeEffectiveClefs(score)
      const openingClef: Clef = effectiveClefs.get(ghostNote.measure) || 'treble'
      // Match the real stave: only redraw the clef when it changes across the
      // barline (vs the previous measure's ending clef), not opening-to-opening.
      const prevEndClef = ghostNote.measure > 1 ? measureEndingClef(score, ghostNote.measure - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && openingClef !== prevEndClef
      // The ghost note must be positioned by the clef in effect at its beat
      // (mid-measure changes), not just the measure's opening clef.
      const clef: Clef = effectiveClefAt(score, ghostNote.measure, beatToFrac(ghostNote.beat))

      const tempStave = new Stave(measureX, measureY, staveWidth)
      const isFirstInLine = measureX === margin
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(openingClef)
      } else if (hasClefChange) {
        tempStave.addClef(openingClef, 'small')
      }
      if (drawsTimeSignature(measure)) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }
      // Match the real stave's note area so the ghost note aligns with where the
      // committed note will land (a cautionary end clef narrows the note area).
      if (widthInfo.cautionaryEndClef) {
        tempStave.addEndClef(widthInfo.cautionaryEndClef, 'small')
      }
      if (widthInfo.cautionaryEndTimeSig) {
        tempStave.addEndTimeSignature(`${widthInfo.cautionaryEndTimeSig.numerator}/${widthInfo.cautionaryEndTimeSig.denominator}`)
      }
      tempStave.setContext(this.context!)

      const vexNote = spellingToVexflowKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
      const vexDuration = convertDuration(ghostNote.duration as any, ghostNote.dots || 0)

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
      for (const slot of measure.slots) {
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
        const sign = ghostNote.alter === 2 ? '##' : ghostNote.alter === 1 ? '#' : ghostNote.alter === -1 ? 'b' : 'bb'
        staveNote.addModifier(new Accidental(sign), 0)
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
      const noteEnd = fracAdd(noteStart, durationToFraction(ghostNote.duration, ghostNote.dots || 0))

      const makeRest = (r: RestSlot) => {
        const sn = new StaveNote({ keys: ['b/4'], duration: durationToVexflow(r.duration, r.dots) + 'r' })
        if (r.dots) Dot.buildAndAttach([sn], { all: true })
        return sn
      }

      const tickables: any[] = []
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

      const svg = this.getSVGElement()
      if (!svg) {
        console.error('SVG element not found for ghost note')
        return false
      }

      staveNote.setStave(tempStave)

      let targetShiftX: number | null = null
      if (ghostNote.rawX !== undefined) {
        try {
          const noteX = staveNote.getAbsoluteX()
          targetShiftX = ghostNote.rawX - noteX
        } catch (e) {
          // getAbsoluteX might not be available before draw
        }
      }

      const childrenBefore = svg.children.length
      staveNote.setContext(this.context!).draw()

      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      if (newElements.length > 0 && targetShiftX !== null) {
        const ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ghostGroup.setAttribute('class', 'ghost-note-group')
        ghostGroup.setAttribute('transform', `translate(${targetShiftX}, 0)`)
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

  /** The rendered SVG group (`<g class="vf-slur">`) for a slur, or null. Scoped
   *  highlight uses this to recolor exactly one slur. Must be called after a render. */
  getSlurSVGGroup(slurId: string): SVGGElement | null {
    return this.slurGroupMap.get(slurId) ?? null
  }

  /** The rendered SVG group (`<g class="vf-tie">`) for a tie, keyed by its from-note id,
   *  or null. Scoped highlight uses this to recolor exactly one tie without a document-wide
   *  bbox path-scan (which bled onto staff lines). Must be called after a render. */
  getTieSVGGroup(fromNoteId: string): SVGGElement | null {
    return this.tieGroupMap.get(fromNoteId) ?? null
  }

  /**
   * Render a dangling (pending) tie from a note with no target yet.
   * Draws a partial arc extending to the right — same as the first half of a cross-barline tie.
   */
  renderPendingTie(noteId: string, score: Score): void {
    if (!this.context) return
    const info = this.staveNoteMap.get(noteId)
    if (!info) return

    // Find the NotePitch and its containing chord/measure
    let foundNotePitch: import('@/types/music').NotePitch | undefined
    let foundBeat: Fraction | undefined
    let foundMeasure: Measure | undefined

    outer: for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'chord') {
          const p = slot.notes.find(n => n.id === noteId)
          if (p) {
            foundNotePitch = p
            foundBeat = slot.beat
            foundMeasure = measure
            break outer
          }
        }
      }
    }

    if (!foundNotePitch || !foundBeat || !foundMeasure) return

    const tieDirection = getTieDirection(foundNotePitch, foundBeat, foundMeasure)
    const pendingTie = new StaveTie({
      firstNote: info.staveNote,
      firstIndexes: [info.noteIndex],
    })
    if (tieDirection !== undefined) {
      pendingTie.setDirection(tieDirection)
    }
    pendingTie.setContext(this.context).draw()
  }

  /**
   * Clear the canvas content without removing the SVG element
   */
  clear(): void {
    // According to VexFlow best practices, we should keep the SVG element
    // and only clear its contents, not remove the element itself
    const svg = this.getSVGElement()
    if (svg) {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild)
      }
    }
    // Clear the element registry for the new render
    this.elementRegistry.clear()
    // Clear the stave note map
    this.staveNoteMap.clear()
    // Clear the tuplet object map
    this.tupletObjectMap.clear()
    // Clear the dynamic object map
    this.dynamicObjectMap.clear()
    // Clear the slur group map
    this.slurGroupMap.clear()
    // Clear the tie group map
    this.tieGroupMap.clear()
    // Clear measure layout info
    this.measureLayoutInfo.clear()
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }

  /**
   * Get the rendered SVG nodes for a note/rest needed to recolor exactly this note
   * (the basis for a bleed-free selection highlight). Must be called after a render
   * (the map and DOM ids are rebuilt each render).
   *
   * - `group`: the note's `<g class="vf-stavenote">` — VexFlow draws its ledger lines,
   *   noteheads and flag inside it (and its stem too, when the note is NOT beamed).
   * - `noteIndex`: the selected pitch's key index within the chord (low→high), matching
   *   the DOM order of the notehead subgroups.
   * - `stem`: the note's stem group, resolved by identity via the Stem object. A beamed
   *   note's stem is drawn by the Beam (inside `<g class="vf-beam">`, NOT the note's
   *   group), so this is the only reliable way to recolor a beamed note's stem.
   */
  getStaveNoteSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number; stem: SVGGElement | null } | null {
    const info = this.staveNoteMap.get(noteId)
    if (!info) return null
    const group = info.staveNote.getSVGElement?.()
    if (!group) return null
    const stem = info.staveNote.getStem?.()?.getSVGElement?.() ?? null
    return {
      group: group as unknown as SVGGElement,
      noteIndex: info.noteIndex,
      stem: (stem as unknown as SVGGElement) ?? null,
    }
  }

  /**
   * Get the rendered SVG group (`<g class="vf-tuplet">`) for a tuplet, containing its
   * bracket and number. Lets the selection highlight recolor exactly this tuplet
   * without a document-wide scan (which bled into neighbouring systems).
   * Must be called after a render.
   */
  getTupletSVGGroup(tupletId: string): SVGGElement | null {
    const group = this.tupletObjectMap.get(tupletId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /**
   * Get the rendered SVG group (`<g class="vf-annotation">`) for a dynamic, so the
   * selection highlight (Phase 6) can recolor exactly this dynamic without a
   * document-wide scan. Must be called after a render. Mirrors getTupletSVGGroup.
   */
  getDynamicSVGGroup(dynamicId: string): SVGGElement | null {
    const group = this.dynamicObjectMap.get(dynamicId)?.getSVGElement?.()
    return (group as unknown as SVGGElement) ?? null
  }

  /** Suppress one dynamic from the next renders (pass null to restore). Used by the
   *  in-canvas text editor so the engraved glyph isn't drawn under the overlay. The
   *  caller must trigger a re-render for this to take effect. */
  setSuppressedDynamicId(dynamicId: string | null): void {
    this.suppressedDynamicId = dynamicId
  }

  /**
   * Render score with an optional ghost note overlay (preview note during mouse hover)
   * Returns true if ghost note was rendered
   */
  renderScoreWithGhostNote(score: Score, ghostNote?: GhostNote): boolean {
    return this.renderScore(score, ghostNote)
  }

  /**
   * Render the score, then overlay a free-floating translucent ghost clef that
   * follows the cursor (like the ghost note). The clef glyph is drawn alone (via
   * a 0-line stave so no staff lines appear), wrapped in a `.ghost-clef-group`
   * for CSS tinting, and translated so its center sits at the cursor.
   * @returns true if the ghost clef was drawn
   */
  renderScoreWithClefGhost(score: Score, cursorX: number, cursorY: number, clef: Clef): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw just the clef glyph: a stave with 0 lines and no barlines renders
      // only the clef modifier. Initial position is arbitrary — we reposition below.
      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addClef(clef)
      tempStave.setContext(this.context!).draw()

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
    } catch (e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost time signature that
   * follows the cursor (mirrors {@link renderScoreWithClefGhost}). Draws just the
   * TS glyph on a 0-line stave, wrapped in a `.ghost-timesig-group` for CSS
   * tinting, translated so its centre sits at the cursor.
   * @returns true if the ghost time signature was drawn
   */
  renderScoreWithTimeSignatureGhost(score: Score, cursorX: number, cursorY: number, ts: TimeSignature): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.addTimeSignature(`${ts.numerator}/${ts.denominator}`)
      tempStave.setContext(this.context!).draw()

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
    } catch (e) {
      return false
    }
  }

  /**
   * Render the score with a free-floating translucent ghost dynamic that follows
   * the cursor (mirrors {@link renderScoreWithClefGhost}). Builds the real dynamic
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
  renderScoreWithDynamicGhost(score: Score, cursorX: number, cursorY: number, dynamic: Dynamic): boolean {
    this.renderScore(score)

    const svg = this.getSVGElement()
    if (!svg) return false

    try {
      const childrenBefore = svg.children.length

      // Draw the annotation on a throwaway quarter note. The note/stave glyphs are
      // discarded below; we keep only the annotation's SVG group.
      const tempStave = new Stave(0, cursorY, 200)
      tempStave.setBegBarType(Barline.type.NONE)
      tempStave.setEndBarType(Barline.type.NONE)
      tempStave.setContext(this.context!)

      const annotation = buildDynamicAnnotation(dynamic)
      const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
      note.setStave(tempStave)
      note.addModifier(annotation, 0)

      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 150)
      voice.draw(this.context!, tempStave)

      const annoEl = annotation.getSVGElement?.() as SVGGElement | undefined

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
    } catch (e) {
      return false
    }
  }
}
