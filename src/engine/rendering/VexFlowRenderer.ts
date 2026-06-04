import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Modifier, Beam, StaveTie, Dot, Barline, ClefNote, Tuplet as VexFlowTuplet } from 'vexflow'
import type { Score, Measure, NoteDuration, Clef, ArticulationType, Tuplet, ChordRest, Chord, Fraction, PitchStep, PitchAlter, GhostNote } from '@/types/music'
import { fracToNumber, fracEq, fracCompare, fracLte, fracIsZero, fracCreate, fracAdd } from '@/utils/fraction'
import { measureOpeningClef, measureEndingClef, effectiveClefAt, effectiveClefBefore } from '@/utils/clefUtils'
import { beatToFrac } from '@/utils/musicUtils'
import { durationToVexflow, durationToFraction } from '@/utils/durations'
import { getMeterInfo } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { ElementRegistry, type TupletGeometry, type ClefSegment } from '@/engine/ElementRegistry'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos } from '@/utils/pitchSpelling'

/**
 * Articulation render order — from note outward (first = closest to note head).
 * Staccato always hugs the note, tenuto sits next, accent is outermost.
 * This applies whether the group is above or below the staff.
 * To change the order in the future, edit this array.
 */
const ARTICULATION_RENDER_ORDER: ArticulationType[] = ['staccato', 'tenuto', 'accent']

/**
 * Clef configuration for stem direction calculation.
 * middleLineDiatonicPos: spellingDiatonicPos() of the middle (3rd) staff line.
 *   treble B4  = diatonic 34  (4×7+6)
 *   bass   D3  = diatonic 22  (3×7+1)
 *   alto   C4  = diatonic 28  (4×7+0)
 *   tenor  A3  = diatonic 26  (3×7+5)
 */
const CLEF_CONFIG: Record<Clef, { middleLineDiatonicPos: number }> = {
  treble: { middleLineDiatonicPos: 34 },  // B4
  bass:   { middleLineDiatonicPos: 22 },  // D3
  alto:   { middleLineDiatonicPos: 28 },  // C4
  tenor:  { middleLineDiatonicPos: 26 },  // A3
}

/**
 * Layout configuration for proportional measure spacing
 */
const LAYOUT_CONFIG = {
  /** Minimum pixels between notes for clickability */
  MIN_NOTE_SPACING: 18,
  /** Minimum measure width even for empty measures */
  MIN_MEASURE_WIDTH: 100,
  /** Maximum measure width to prevent one measure dominating */
  MAX_MEASURE_WIDTH: 400,
  /** Space for clef symbol on first measure of line */
  CLEF_WIDTH: 45,
  /** Space for a mid-line clef change (smaller than a line-start clef) */
  CLEF_CHANGE_WIDTH: 30,
  /** Space for time signature */
  TIME_SIG_WIDTH: 30,
  /** Padding before/after barlines */
  BARLINE_PADDING: 10,
  /** Default container width */
  CONTAINER_WIDTH: 1000,
  /** Margin around the score */
  MARGIN: 20,
  /** Stave height */
  STAVE_HEIGHT: 120,
  /** Vertical spacing between lines */
  VERTICAL_SPACING: 30,
}

/**
 * Width calculation result for a measure
 */
interface MeasureWidthInfo {
  measureNumber: number
  minWidth: number
  finalWidth: number
  lineNumber: number
  /** Cautionary clef drawn at this measure's end when the next line opens with a
   *  different clef (last measure of a line only). */
  cautionaryEndClef?: Clef
}

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
   * Convert our NoteDuration to VexFlow duration format
   * Appends 'd' for each dot (e.g., "qd" for dotted quarter, "qdd" for double-dotted)
   */
  private convertDuration(duration: NoteDuration, dots: number = 0): string {
    return durationToVexflow(duration, dots)
  }

  /**
   * Create StaveNotes directly from ChordRest slots.
   * One slot → one StaveNote. Rests → rest StaveNote; Chords → multi-key StaveNote.
   * @param slots - Slots already sorted by beat position
   * @param clefForBeat - Resolves the clef in effect at a given beat (for note
   *   positioning and stem direction). A single Clef is accepted for convenience.
   */
  private createStaveNotesFromSlots(
    slots: ChordRest[],
    clefForBeat: ((beat: Fraction) => Clef) | Clef = 'treble',
  ): StaveNote[] {
    const resolveClef: (beat: Fraction) => Clef =
      typeof clefForBeat === 'function' ? clefForBeat : () => clefForBeat
    const staveNotes: StaveNote[] = []

    // Track the currently active alteration per diatonic staff position within this measure.
    // Key = spellingDiatonicPos(step, octave). Value = active PitchAlter (0 = natural).
    // A position absent from the map has not yet appeared in this measure.
    const activeMeasureAlterations = new Map<number, PitchAlter>()

    for (const slot of slots) {
      if (slot.type === 'rest') {
        const vexDuration = this.convertDuration(slot.duration, slot.dots || 0)
        // Rests are positioned at fixed staff positions independent of clef.
        // The 'b/4' key anchors the rest to the middle line under the default
        // (treble) clef — passing a clef would shift it (e.g. high in bass clef).
        const staveNote = new StaveNote({ keys: ['b/4'], duration: vexDuration + 'r' })
        for (let d = 0; d < (slot.dots || 0); d++) {
          Dot.buildAndAttach([staveNote], { all: true })
        }
        staveNotes.push(staveNote)
        continue
      }

      // Chord slot — decide which accidental sign (if any) to display for each pitch.
      // displayAccidentals: noteId → VexFlow accidental string, or null if suppressed.
      const displayAccidentals = new Map<string, string | null>()
      for (const p of slot.notes) {
        if (p.tiedFrom) {
          // Tied continuation: never re-show the accidental
          displayAccidentals.set(p.id, null)
          continue
        }
        const dPos = spellingDiatonicPos(p.step, p.octave)
        const activeAlter = activeMeasureAlterations.get(dPos)  // undefined = not seen yet

        if (p.alter !== 0) {
          // Non-natural pitch — show sign unless the same alteration is already active
          if (!p.forceAccidental && activeAlter === p.alter) {
            displayAccidentals.set(p.id, null)  // suppress: redundant
          } else {
            const sign = p.alter === 2 ? '##' : p.alter === 1 ? '#' : p.alter === -1 ? 'b' : 'bb'
            displayAccidentals.set(p.id, sign)
            activeMeasureAlterations.set(dPos, p.alter)
          }
        } else {
          // Natural pitch (alter === 0)
          if (activeAlter !== undefined && activeAlter !== 0) {
            // A previous note on this staff position was altered — show ♮ to cancel it
            displayAccidentals.set(p.id, 'n')
            activeMeasureAlterations.set(dPos, 0)
          } else if (p.forceAccidental) {
            // Caller explicitly wants a courtesy natural sign
            displayAccidentals.set(p.id, 'n')
            activeMeasureAlterations.set(dPos, 0)
          } else {
            displayAccidentals.set(p.id, null)  // no sign needed
          }
        }
      }

      // Sort pitches low→high by MIDI value (VexFlow requires ascending key order for chords)
      const sortedPitches = [...slot.notes].sort(
        (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave)
      )
      // Build VexFlow key strings directly from spelling — no MIDI lookup table needed
      const keys = sortedPitches.map(p => spellingToVexflowKey(p.step, p.alter, p.octave))

      // Clef in effect at this slot's beat (mid-measure changes move notes).
      const slotClef = resolveClef(slot.beat)

      // Stem direction — compare diatonic staff position against clef's middle line
      let stemDirection: number
      if (slot.stemDirection === 'up') {
        stemDirection = 1
      } else if (slot.stemDirection === 'down') {
        stemDirection = -1
      } else {
        const middleDiatonic = CLEF_CONFIG[slotClef].middleLineDiatonicPos
        let maxDist = 0
        stemDirection = -1  // default down; middle-line notes follow this convention
        for (const p of slot.notes) {
          const dPos = spellingDiatonicPos(p.step, p.octave)
          const dist = Math.abs(dPos - middleDiatonic)
          if (dist > maxDist) {
            maxDist = dist
            stemDirection = dPos >= middleDiatonic ? -1 : 1
          }
        }
      }

      const vexDuration = this.convertDuration(slot.duration, slot.dots || 0)
      const staveNote = new StaveNote({ keys, duration: vexDuration, clef: slotClef, autoStem: false })
      staveNote.setStemDirection(stemDirection)

      // Add accidental modifiers — VexFlow accepts '#', 'b', 'n', '##', 'bb'
      sortedPitches.forEach((p, idx) => {
        const acc = displayAccidentals.get(p.id) ?? null
        if (acc) staveNote.addModifier(new Accidental(acc), idx)
      })

      // Dots
      for (let d = 0; d < (slot.dots || 0); d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }

      // Articulations are per-chord (stored on slot, not per pitch).
      // Sorted by ARTICULATION_RENDER_ORDER so the first added sits closest to the note head.
      const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
      const sortedArticulations = (slot.articulations ?? []).slice().sort(
        (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b)
      )
      for (const art of sortedArticulations) {
        staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
      }

      staveNotes.push(staveNote)
    }

    return staveNotes
  }

  /**
   * Build a resolver for the clef in effect at any beat within a measure.
   * Starts from the measure's opening clef and applies each clef change whose
   * beat is at/before the queried beat.
   */
  private makeClefResolver(measure: Measure, openingClef: Clef): (beat: Fraction) => Clef {
    const changes = (measure.clefs ?? []).slice().sort((a, b) => fracCompare(a.beat, b.beat))
    return (beat: Fraction): Clef => {
      let current = openingClef
      for (const ch of changes) {
        if (fracLte(ch.beat, beat)) current = ch.clef
        else break
      }
      return current
    }
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
   * Check if a duration is beamable (8th note or shorter)
   */
  private isBeamableDuration(duration: NoteDuration): boolean {
    return duration === '8' || duration === '16' || duration === '32'
  }

  /**
   * Get the beat boundary for grouping beams
   * In 4/4, we typically beam per beat (quarter note)
   * This returns which beat group a note belongs to
   */
  private getBeatGroup(beat: number, _beatsPerMeasure: number): number {
    // For now, group by integer beat (beam within each beat)
    // This can be enhanced later for different time signatures
    // e.g., in 6/8, beam in groups of 3 eighth notes
    return Math.floor(beat)
  }

  /**
   * Calculate the stem direction for an entire beam group.
   * Uses the pitch furthest from the middle line across all slots.
   * @param slots - ChordRest slots in the beam group
   * @param clef - Clef type for middle line reference
   * @returns VexFlow stem direction value (1 = UP, -1 = DOWN)
   */
  private calculateBeamGroupStemDirection(slots: ChordRest[], clef: Clef = 'treble'): number {
    // Explicit override on any note in the group takes priority over pitch calculation
    for (const slot of slots) {
      if (slot.type === 'chord' && slot.stemDirection === 'up') return 1
      if (slot.type === 'chord' && slot.stemDirection === 'down') return -1
    }

    // No override — use the pitch furthest from the middle line
    const middleDiatonic = CLEF_CONFIG[clef].middleLineDiatonicPos
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
   * @param beatsPerMeasure - Number of beats in the measure
   * @returns Array of beam group info with stave notes and slots
   */
  private createBeamGroups(
    staveNotes: StaveNote[],
    slots: ChordRest[],
    beatsPerMeasure: number
  ): { staveNotes: StaveNote[]; slots: ChordRest[] }[] {
    const beamGroups: { staveNotes: StaveNote[]; slots: ChordRest[] }[] = []
    let currentStaveNotes: StaveNote[] = []
    let currentSlots: ChordRest[] = []
    let currentBeatGroup: number | null = null
    let isForced = false  // true when group was started by an explicit 'begin'

    const flush = () => {
      if (currentStaveNotes.length >= 2) {
        beamGroups.push({ staveNotes: currentStaveNotes, slots: currentSlots })
      }
      currentStaveNotes = []
      currentSlots = []
      currentBeatGroup = null
      isForced = false
    }

    for (let i = 0; i < staveNotes.length && i < slots.length; i++) {
      const staveNote = staveNotes[i]
      const slot = slots[i]

      // Rests always break beams (can't beam silence)
      if (slot.type === 'rest') { flush(); continue }

      // Non-beamable durations (quarter and above) always break beams
      if (!this.isBeamableDuration(slot.duration)) { flush(); continue }

      const beam = slot.beam  // BeamMode | undefined

      if (beam === 'single') {
        // Force no beam — flush current group, skip this note
        flush()
        continue
      }

      if (beam === 'begin') {
        // Start a new explicit group (flush any current one first)
        flush()
        currentStaveNotes = [staveNote]
        currentSlots = [slot]
        currentBeatGroup = this.getBeatGroup(fracToNumber(slot.beat), beatsPerMeasure)
        isForced = true
        continue
      }

      if (beam === 'continue') {
        // Bridge across a beat boundary — override normal grouping rules
        if (currentStaveNotes.length > 0) {
          currentStaveNotes.push(staveNote)
          currentSlots.push(slot)
        } else {
          // Orphaned continue (no preceding group) — start one
          currentStaveNotes = [staveNote]
          currentSlots = [slot]
          isForced = true
        }
        currentBeatGroup = this.getBeatGroup(fracToNumber(slot.beat), beatsPerMeasure)
        continue
      }

      if (beam === 'end') {
        // Close the current group after adding this note
        if (currentStaveNotes.length > 0) {
          currentStaveNotes.push(staveNote)
          currentSlots.push(slot)
        } else {
          // Orphaned end — emit a single-note group (will be ignored by flush min-2 check)
          currentStaveNotes = [staveNote]
          currentSlots = [slot]
        }
        flush()
        continue
      }

      // beam === undefined/'auto' — use standard beat-boundary logic
      if (isForced) {
        // Inside a forced group (between begin and a future end) — add without boundary check
        currentStaveNotes.push(staveNote)
        currentSlots.push(slot)
        currentBeatGroup = this.getBeatGroup(fracToNumber(slot.beat), beatsPerMeasure)
      } else {
        const beatGroup = this.getBeatGroup(fracToNumber(slot.beat), beatsPerMeasure)
        if (currentBeatGroup === null || beatGroup === currentBeatGroup) {
          currentStaveNotes.push(staveNote)
          currentSlots.push(slot)
          currentBeatGroup = beatGroup
        } else {
          flush()
          currentStaveNotes = [staveNote]
          currentSlots = [slot]
          currentBeatGroup = beatGroup
        }
      }
    }

    flush()
    return beamGroups
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
   * Create VexFlow Tuplet objects for a measure (adjusts tick values on notes).
   * Must be called BEFORE voice.addTickables() for correct tick calculation.
   * @param measure - The measure containing tuplet definitions
   * @param slots - ChordRest slots sorted by beat (parallel to staveNotes)
   * @param staveNotes - The VexFlow StaveNotes array
   * @returns Map of tupletId to VexFlow Tuplet objects
   */
  private createTupletsForMeasure(
    measure: Measure,
    slots: ChordRest[],
    staveNotes: StaveNote[]
  ): Map<string, VexFlowTuplet> {
    const vexTuplets = new Map<string, VexFlowTuplet>()

    if (!measure.tuplets || measure.tuplets.length === 0) {
      return vexTuplets
    }

    // Build mapping from tupletId to StaveNotes (one slot → one StaveNote)
    const tupletStaveNoteMap = new Map<string, StaveNote[]>()

    for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
      const slot = slots[i]
      if (slot.tupletId) {
        if (!tupletStaveNoteMap.has(slot.tupletId)) {
          tupletStaveNoteMap.set(slot.tupletId, [])
        }
        tupletStaveNoteMap.get(slot.tupletId)!.push(staveNotes[i])
      }
    }

    // Create VexFlow Tuplet objects
    for (const [tupletId, tupletStaveNotes] of tupletStaveNoteMap) {
      const tupletData = measure.tuplets.find(t => t.id === tupletId)
      if (tupletData && tupletStaveNotes.length >= 2) {
        try {
          const vexTuplet = new VexFlowTuplet(tupletStaveNotes, {
            numNotes: tupletData.numNotes,
            notesOccupied: tupletData.notesOccupied,
          })
          vexTuplets.set(tupletId, vexTuplet)
        } catch (e) {
          // Ignore tuplet creation errors
        }
      }
    }

    return vexTuplets
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
   * Calculate minimum width needed for a single measure based on its content
   * Uses VexFlow's Formatter to estimate space needed for notes
   */
  private calculateMinimumMeasureWidth(
    measure: Measure,
    isFirstInLine: boolean,
    clef: Clef,
    hasClefChange: boolean = false
  ): number {
    // Start with base overhead
    let overhead = LAYOUT_CONFIG.BARLINE_PADDING * 2

    // Add clef width for first measure of each line
    if (isFirstInLine) {
      overhead += LAYOUT_CONFIG.CLEF_WIDTH
    } else if (hasClefChange) {
      // Mid-line clef change renders a smaller clef at the measure start
      overhead += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
    }

    // Add time signature width for measure 1
    if (measure.number === 1) {
      overhead += LAYOUT_CONFIG.TIME_SIG_WIDTH
    }

    // Budget width for each mid-measure (inline) clef change
    const midClefCount = (measure.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
    overhead += midClefCount * LAYOUT_CONFIG.CLEF_CHANGE_WIDTH

    // If measure has no notes or only rests, use minimum width
    const actualNotes = measure.slots.filter(s => s.type === 'chord')
    if (actualNotes.length === 0) {
      return Math.max(LAYOUT_CONFIG.MIN_MEASURE_WIDTH, overhead + 40)
    }

    // Create temporary voice to calculate width
    const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
    const staveNotes = this.createStaveNotesFromSlots(sortedSlots, this.makeClefResolver(measure, clef))

    // Create VexFlow Tuplets BEFORE adding notes to voice (adjusts tick values)
    this.createTupletsForMeasure(measure, sortedSlots, staveNotes)

    const voice = new Voice({
      numBeats: measure.timeSignature.numerator,
      beatValue: measure.timeSignature.denominator,
    })

    try {
      voice.addTickables(staveNotes)

      // Use VexFlow's formatter to calculate minimum width
      const formatter = new Formatter()
      formatter.joinVoices([voice])
      const minNoteWidth = formatter.preCalculateMinTotalWidth([voice])

      // Add safety buffer (15%) and ensure minimum note spacing
      const noteCount = sortedSlots.filter(s => s.type === 'chord').length
      const minSpacingWidth = noteCount * LAYOUT_CONFIG.MIN_NOTE_SPACING
      const calculatedWidth = Math.max(minNoteWidth * 1.15, minSpacingWidth)

      // Total width = note space + overhead
      let totalWidth = calculatedWidth + overhead

      // Apply min/max constraints
      totalWidth = Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
      totalWidth = Math.min(totalWidth, LAYOUT_CONFIG.MAX_MEASURE_WIDTH)

      return totalWidth
    } catch (error) {
      // If calculation fails, fall back to minimum width
      console.warn(`Could not calculate width for measure ${measure.number}:`, error)
      return LAYOUT_CONFIG.MIN_MEASURE_WIDTH
    }
  }

  /**
   * Distribute available width proportionally among measures on a line
   */
  private distributeLineWidths(
    measureInfos: MeasureWidthInfo[],
    availableWidth: number
  ): void {
    if (measureInfos.length === 0) return

    const totalMinWidth = measureInfos.reduce((sum, m) => sum + m.minWidth, 0)

    if (totalMinWidth >= availableWidth) {
      // Need to compress - distribute proportionally to minimum widths
      const compressionRatio = availableWidth / totalMinWidth
      if (compressionRatio < 0.7) {
        console.warn(`Severe measure compression (${(compressionRatio * 100).toFixed(0)}%) on line - measures may be crowded`)
      }
      for (const info of measureInfos) {
        info.finalWidth = info.minWidth * compressionRatio
      }
    } else {
      // Have extra space - distribute proportionally
      const extraSpace = availableWidth - totalMinWidth
      for (const info of measureInfos) {
        const proportion = info.minWidth / totalMinWidth
        info.finalWidth = info.minWidth + (extraSpace * proportion)
      }
    }
  }

  /**
   * Calculate widths for all measures using a two-pass algorithm
   * Pass 1: Calculate minimum widths and group into lines
   * Pass 2: Distribute available space proportionally within each line
   */
  private calculateMeasureWidths(
    score: Score,
    effectiveClefs: Map<number, Clef>
  ): Map<number, MeasureWidthInfo> {
    const results = new Map<number, MeasureWidthInfo>()
    const margin = LAYOUT_CONFIG.MARGIN
    const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

    // Pass 1: Calculate minimum widths and assign to lines
    let currentLine = 0
    let currentLineWidth = 0
    let currentLineMeasures: MeasureWidthInfo[] = []

    for (const measure of score.measures) {
      const isFirstInLine = currentLineMeasures.length === 0
      const clef = effectiveClefs.get(measure.number) || 'treble'
      // Redraw the clef at a mid-line measure start only when it actually changes
      // across the barline — i.e. differs from the previous measure's *ending*
      // clef (a mid-measure change already shows its clef inline in that measure).
      const prevEndClef = measure.number > 1 ? measureEndingClef(score, measure.number - 1) : undefined
      const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
      const minWidth = this.calculateMinimumMeasureWidth(measure, isFirstInLine, clef, hasClefChange)

      // Check if measure fits on current line
      if (currentLineWidth + minWidth > availableWidth && currentLineMeasures.length > 0) {
        // Finalize current line
        this.distributeLineWidths(currentLineMeasures, availableWidth)
        for (const info of currentLineMeasures) {
          results.set(info.measureNumber, info)
        }

        // Start new line
        currentLine++
        currentLineWidth = 0
        currentLineMeasures = []

        // Recalculate width for new line (first-in-line gets a full clef, so a
        // clef change is absorbed into the line-start clef — no extra width)
        const newMinWidth = this.calculateMinimumMeasureWidth(measure, true, clef)

        const info: MeasureWidthInfo = {
          measureNumber: measure.number,
          minWidth: newMinWidth,
          finalWidth: newMinWidth,
          lineNumber: currentLine,
        }
        currentLineMeasures.push(info)
        currentLineWidth = newMinWidth
      } else {
        const info: MeasureWidthInfo = {
          measureNumber: measure.number,
          minWidth,
          finalWidth: minWidth,
          lineNumber: currentLine,
        }
        currentLineMeasures.push(info)
        currentLineWidth += minWidth
      }
    }

    // Finalize last line
    if (currentLineMeasures.length > 0) {
      this.distributeLineWidths(currentLineMeasures, availableWidth)
      for (const info of currentLineMeasures) {
        results.set(info.measureNumber, info)
      }
    }

    this.applyCautionaryClefs(score, effectiveClefs, results, availableWidth)

    return results
  }

  /**
   * Add a cautionary clef to the last measure of any line whose *next* line opens
   * with a different clef. The warning shows the upcoming clef just before the
   * line break (standard engraving). Runs after line assignment, so it reserves
   * width on the affected measure and re-distributes that line only — line
   * membership is never changed (no re-wrapping).
   */
  private applyCautionaryClefs(
    score: Score,
    effectiveClefs: Map<number, Clef>,
    results: Map<number, MeasureWidthInfo>,
    availableWidth: number
  ): void {
    const linesToRedistribute = new Set<number>()

    for (let i = 0; i < score.measures.length - 1; i++) {
      const current = results.get(score.measures[i].number)
      const next = results.get(score.measures[i + 1].number)
      if (!current || !next || next.lineNumber <= current.lineNumber) continue

      // The next line opens here; warn only if the clef actually changes across
      // the break (its opening clef differs from this measure's ending clef).
      const nextOpeningClef = effectiveClefs.get(next.measureNumber) || 'treble'
      if (nextOpeningClef === measureEndingClef(score, current.measureNumber)) continue

      current.cautionaryEndClef = nextOpeningClef
      current.minWidth += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
      linesToRedistribute.add(current.lineNumber)
    }

    // Re-distribute each affected line so the reserved width shrinks note spacing
    // rather than overflowing the margin.
    for (const lineNumber of linesToRedistribute) {
      const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
      this.distributeLineWidths(lineMeasures, availableWidth)
    }
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
   */
  renderMeasure(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean = false,
    clef: Clef = 'treble',
    hasClefChange: boolean = false,
    cautionaryEndClef?: Clef,
    ghostClefBeat?: Fraction
  ): void {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    const stave = this.buildAndDrawStave(measure, x, y, width, isFirstInLine, clef, hasClefChange, cautionaryEndClef)

    // Resolve the clef in effect at any beat within this measure: starts from the
    // opening clef and applies each clef change at/after its beat.
    const clefForBeat = this.makeClefResolver(measure, clef)
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
      const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
      // notesOnly: one StaveNote per slot (used for beams, tuplets, registration).
      const staveNotes = this.createStaveNotesFromSlots(sortedSlots, clefForBeat)

      // Tuplets must be created BEFORE adding notes to voice — VexFlow adjusts tick values
      const { vexTuplets, tupletStaveNoteMap } = this.buildVexTuplets(sortedSlots, staveNotes, measure, clef)

      // tickables: notesOnly + inline ClefNotes interleaved at change boundaries.
      // ClefNotes ignore ticks, so the voice tick total still matches the notes.
      const { tickables, clefNoteByBeat } = this.interleaveClefNotes(sortedSlots, staveNotes, midChanges)

      const voice = new Voice({
        numBeats: measure.timeSignature.numerator,
        beatValue: measure.timeSignature.denominator,
      })

      try {
        voice.addTickables(tickables)

        const beams = this.buildBeams(staveNotes, sortedSlots, measure.timeSignature.numerator, clefForBeat)

        const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX()
        const formatWidth = Math.max(noteAreaWidth - 15, 50)
        new Formatter().joinVoices([voice]).format([voice], formatWidth)
        voice.draw(this.context, stave)

        for (const beam of beams) {
          beam.setContext(this.context).draw()
        }

        this.drawAndRegisterTuplets(vexTuplets, tupletStaveNoteMap, measure)
        this.registerSlotElements(sortedSlots, staveNotes, measure)
        this.registerBeams(beams, measure)
        this.registerMidMeasureClefs(clefNoteByBeat, measure)

        // Extend clef regions with each inline clef's actual X position.
        for (const { clef: segClef, clefNote } of clefNoteByBeat) {
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
  ): Stave {
    const stave = new Stave(x, y, width)

    if (measure.number === 1 || isFirstInLine) {
      // Line start: full-size clef showing the effective clef for this measure
      stave.addClef(clef)
    } else if (hasClefChange) {
      // Mid-line clef change: smaller clef at the start of the measure it applies to
      stave.addClef(clef, 'small')
    }
    if (measure.number === 1) {
      stave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
    }
    if (cautionaryEndClef) {
      // Cautionary clef before a line break: warns of the next line's new clef.
      stave.addEndClef(cautionaryEndClef, 'small')
    }

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
  ): { vexTuplets: VexFlowTuplet[]; tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }> } {
    const tupletStaveNoteMap = new Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }>()

    for (let idx = 0; idx < sortedSlots.length && idx < staveNotes.length; idx++) {
      const slot = sortedSlots[idx]
      if (slot.tupletId) {
        const tupletData = (measure.tuplets || []).find(t => t.id === slot.tupletId)
        if (tupletData) {
          if (!tupletStaveNoteMap.has(slot.tupletId)) {
            tupletStaveNoteMap.set(slot.tupletId, { staveNotes: [], tuplet: tupletData })
          }
          tupletStaveNoteMap.get(slot.tupletId)!.staveNotes.push(staveNotes[idx])
        }
      }
    }

    const vexTuplets: VexFlowTuplet[] = []
    for (const [_tupletId, { staveNotes: tupletStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
      if (tupletStaveNotes.length >= 2) {
        try {
          const location = this.calculateTupletLocation(tupletStaveNotes, clef)
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
    numBeats: number,
    clefForBeat: (beat: Fraction) => Clef,
  ): Beam[] {
    const beamGroups = this.createBeamGroups(staveNotes, sortedSlots, numBeats)
    const beams: Beam[] = []

    for (const beamGroup of beamGroups) {
      try {
        // A beam group lies within one clef region; use the clef at its first slot.
        const groupClef = beamGroup.slots.length ? clefForBeat(beamGroup.slots[0].beat) : 'treble'
        const beamStemDirection = this.calculateBeamGroupStemDirection(beamGroup.slots, groupClef)
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
    tupletStaveNoteMap: Map<string, { staveNotes: StaveNote[]; tuplet: Tuplet }>,
    measure: Measure,
  ): void {
    for (const vexTuplet of vexTuplets) {
      try {
        vexTuplet.setContext(this.context!).draw()

        const tupletNotes = vexTuplet.getNotes() as StaveNote[]
        if (tupletNotes.length === 0) continue

        for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
          if (!tStaveNotes.includes(tupletNotes[0])) continue

          const vt = vexTuplet as any
          const notes = vt.notes as StaveNote[]
          const firstNote = notes?.[0]
          const lastNote = notes?.[notes.length - 1]
          if (!firstNote || !lastNote) break

          const location = (vt.options?.location ?? 1) as 1 | -1
          const bracketed = vt.options?.bracketed ?? true

          // Compute stem Y extents across all notes in the tuplet
          let stemMinY = Infinity
          let stemMaxY = -Infinity
          for (const note of notes) {
            try {
              const stemExtents = note.getStemExtents?.()
              if (stemExtents) {
                stemMinY = Math.min(stemMinY, stemExtents.topY, stemExtents.baseY)
                stemMaxY = Math.max(stemMaxY, stemExtents.topY, stemExtents.baseY)
              }
            } catch (e) { /* ignore */ }
          }
          if (stemMinY === Infinity || stemMaxY === -Infinity) {
            for (const note of notes) {
              try {
                const noteBox = note.getBoundingBox()
                if (noteBox) {
                  stemMinY = Math.min(stemMinY, noteBox.getY())
                  stemMaxY = Math.max(stemMaxY, noteBox.getY() + noteBox.getH())
                }
              } catch (e) { /* ignore */ }
            }
          }

          const bracketPadding = 5
          const xStart = bracketed ? firstNote.getTieLeftX() - bracketPadding : firstNote.getStemX()
          const xEnd = bracketed ? lastNote.getTieRightX() + bracketPadding : lastNote.getStemX()
          const tupletWidth = xEnd - xStart

          // Position bracket above or below stems with a fixed gap
          const bracketGap = 10
          const totalHeight = 45
          const bracketY = location === 1
            ? stemMinY - bracketGap - totalHeight
            : stemMaxY + bracketGap

          const tupletGeometry: TupletGeometry = {
            x: xStart,
            y: bracketY,
            width: tupletWidth,
            bracketed,
            location,
            bracketLegLength: 10,
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
            bbox: { x: xStart, y: bracketY, width: tupletWidth, height: totalHeight },
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
                  let articulationIndex = 0
                  for (const modifier of modifiers) {
                    if (modifier.getCategory() === 'Articulation') {
                      const artBox = modifier.getBoundingBox()
                      if (artBox) {
                        this.elementRegistry.add({
                          type: 'articulation',
                          noteId: pitch.id,
                          articulationType: slot.articulations[articulationIndex],
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

    if (measure.number === 1) {
      this.elementRegistry.add({
        type: 'timeSignature',
        measure: measure.number,
        bbox: {
          x: x + LAYOUT_CONFIG.CLEF_WIDTH,
          y,
          width: LAYOUT_CONFIG.TIME_SIG_WIDTH,
          height: LAYOUT_CONFIG.STAVE_HEIGHT,
        },
      })
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
      : this.calculateMeasureWidths(score, effectiveClefs)
    // Store for use in tie rendering (to determine which line each measure is on)
    this.measureLayoutInfo = measureWidths

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

      this.renderMeasure(measure, currentX, y, widthInfo.finalWidth, isFirstInLine, clef, hasClefChange, widthInfo.cautionaryEndClef, ghostClefBeat)

      currentX += widthInfo.finalWidth
    })

    // Render ties between measures after all measures are drawn
    this.renderTies(score)

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
      if (ghostNote.measure === 1) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }
      // Match the real stave's note area so the ghost note aligns with where the
      // committed note will land (a cautionary end clef narrows the note area).
      if (widthInfo.cautionaryEndClef) {
        tempStave.addEndClef(widthInfo.cautionaryEndClef, 'small')
      }
      tempStave.setContext(this.context!)

      const vexNote = spellingToVexflowKey(ghostNote.step, ghostNote.alter, ghostNote.octave)
      const vexDuration = this.convertDuration(ghostNote.duration as any, ghostNote.dots || 0)

      // Stem direction — same diatonic approach as createStaveNotesFromSlots.
      // Include any existing notes at the same beat so the ghost matches the chord's stem.
      const middleDiatonic = CLEF_CONFIG[clef].middleLineDiatonicPos
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
      for (const r of fillRests(noteEnd, meter.barQuarters, meter)) tickables.push(makeRest(r))

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

      const applyGhostStyle = (element: Element) => {
        const tagName = element.tagName.toLowerCase()
        if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; stroke: #2563EB !important; opacity: 0.7 !important;')
        } else if (tagName === 'text') {
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; opacity: 0.7 !important;')
        } else if (tagName === 'line') {
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; stroke: #2563EB !important; opacity: 0.7 !important;')
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
   * Determine tie direction for a pitch within a chord.
   * Returns: -1 for UP (top note), 1 for DOWN (bottom note).
   * @param pitch - MIDI pitch of the note being tied
   * @param beat - Beat position of the chord containing this pitch
   * @param measure - The measure to look up chord info in
   */
  private getTieDirection(notePitch: import('@/types/music').NotePitch, beat: Fraction, measure: Measure): number | undefined {
    // Find the chord slot at this beat
    const chordAtBeat = measure.slots.find(
      s => s.type === 'chord' && fracEq(s.beat, beat)
    ) as Chord | undefined

    const thisDiatonic = spellingDiatonicPos(notePitch.step, notePitch.octave)

    if (!chordAtBeat || chordAtBeat.notes.length <= 1) {
      // Single note — tie direction based on diatonic distance from middle line (treble B4=34)
      const middleDiatonic = CLEF_CONFIG['treble'].middleLineDiatonicPos
      return thisDiatonic >= middleDiatonic ? -1 : 1
    }

    // Sort all chord notes by diatonic staff position
    const sortedDiatonics = chordAtBeat.notes
      .map(n => spellingDiatonicPos(n.step, n.octave))
      .sort((a, b) => a - b)
    const lowestDiatonic  = sortedDiatonics[0]
    const highestDiatonic = sortedDiatonics[sortedDiatonics.length - 1]

    if (thisDiatonic === highestDiatonic) return -1  // Top note: tie curves UP
    if (thisDiatonic === lowestDiatonic)  return 1   // Bottom note: tie curves DOWN

    // Middle note: follow nearest outer voice
    const distToTop    = highestDiatonic - thisDiatonic
    const distToBottom = thisDiatonic    - lowestDiatonic
    return distToTop <= distToBottom ? -1 : 1
  }

  /**
   * Draw a tie arc where both endpoints share the source note's Y position.
   * Ties always connect the same pitch, so the arc must be horizontally flat.
   * Replicates VexFlow's StaveTie.renderTie() algorithm with firstY === lastY.
   * Returns the bounding box of the drawn arc, or null on failure.
   */
  private drawFlatTie(
    fromInfo: { staveNote: StaveNote; noteIndex: number },
    toInfo: { staveNote: StaveNote; noteIndex: number },
    direction: number,
  ): { x: number; y: number; width: number; height: number } | null {
    if (!this.context) return null
    try {
      const firstX = fromInfo.staveNote.getTieRightX()
      const lastX = toInfo.staveNote.getTieLeftX()
      const ys = fromInfo.staveNote.getYs()
      const y = ys[fromInfo.noteIndex] ?? ys[0]
      if (y === undefined || isNaN(y)) return null

      // Match VexFlow StaveTie defaults: cp1=8, cp2=12, yShift=7
      const cp1 = 8
      const cp2 = 12
      const tieY = y + 7 * direction
      const cpX = (firstX + lastX) / 2
      const topCP = tieY + cp1 * direction
      const bottomCP = tieY + cp2 * direction

      this.context.beginPath()
      this.context.moveTo(firstX, tieY)
      this.context.quadraticCurveTo(cpX, topCP, lastX, tieY)
      this.context.quadraticCurveTo(cpX, bottomCP, firstX, tieY)
      this.context.closePath()
      this.context.fill()

      // Bounding box: x range is firstX→lastX, y range spans from tieY to the arc apex
      const arcTop = Math.min(tieY, topCP)
      const arcBottom = Math.max(tieY, bottomCP)
      return { x: firstX, y: arcTop, width: lastX - firstX, height: arcBottom - arcTop }
    } catch (e) {
      console.error('Could not draw flat tie:', e)
      return null
    }
  }

  /**
   * Render ties between notes that have tiedTo/tiedFrom properties
   */
  private renderTies(score: Score): void {
    if (!this.context) return

    // Track which ties we've already processed to avoid duplicates
    const processedTies = new Set<string>()

    // Find all notes with ties by iterating chord slots directly
    for (const measure of score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        for (const pitch of slot.notes) {
          if (!pitch.tiedTo) continue

          const tieKey = `${pitch.id}->${pitch.tiedTo}`
          if (processedTies.has(tieKey)) continue
          processedTies.add(tieKey)

          const fromInfo = this.staveNoteMap.get(pitch.id)
          const toInfo = this.staveNoteMap.get(pitch.tiedTo)

          if (fromInfo?.staveNote && toInfo?.staveNote) {
            try {
              const fromMeasure = slot.measure
              // Find the measure containing the target pitch
              let toMeasure: number | undefined
              outer: for (const m of score.measures) {
                for (const s of m.slots) {
                  if (s.type === 'chord' && s.notes.some(p => p.id === pitch.tiedTo)) {
                    toMeasure = m.number
                    break outer
                  }
                  if (s.type === 'rest' && s.id === pitch.tiedTo) {
                    toMeasure = m.number
                    break outer
                  }
                }
              }

              const fromLayout = this.measureLayoutInfo.get(fromMeasure)
              const toLayout = toMeasure ? this.measureLayoutInfo.get(toMeasure) : undefined
              const fromLine = fromLayout?.lineNumber ?? 0
              const toLine = toLayout?.lineNumber ?? 0
              const sameLine = fromLine === toLine

              const tieDirection = this.getTieDirection(pitch, slot.beat, measure)
              // note alias for registry callbacks below
              const note = { id: pitch.id, tiedTo: pitch.tiedTo, measure: fromMeasure }

              if (sameLine) {
                // Same line: draw flat arc anchored at the source note's Y
                // (ties always connect the same pitch, so both endpoints share the same Y)
                const bbox = this.drawFlatTie(fromInfo, toInfo, tieDirection ?? 1)
                if (bbox) {
                  this.elementRegistry.add({
                    type: 'tie',
                    fromNoteId: note.id,
                    toNoteId: note.tiedTo!,
                    fromMeasure: fromMeasure,
                    toMeasure: toMeasure!,
                    bbox,
                  })
                }
              } else {
                // Different lines (line break): two partial ties
                // First partial: from note to end of line
                const firstPartialTie = new StaveTie({
                  firstNote: fromInfo.staveNote,
                  firstIndexes: [fromInfo.noteIndex],
                })
                if (tieDirection !== undefined) {
                  firstPartialTie.setDirection(tieDirection)
                }
                firstPartialTie.setContext(this.context!).draw()

                // Register first partial tie
                try {
                  const box = firstPartialTie.getBoundingBox()
                  if (box) {
                    this.elementRegistry.add({
                      type: 'tie',
                      fromNoteId: note.id,
                      toNoteId: note.tiedTo!,
                      fromMeasure: fromMeasure,
                      toMeasure: toMeasure!,
                      isPartial: true,
                      partialType: 'end', // ends at line break
                      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                    })
                  }
                } catch (e) {
                  // getBoundingBox may fail
                }

                // Second partial: from start of line to note
                const secondPartialTie = new StaveTie({
                  lastNote: toInfo.staveNote,
                  lastIndexes: [toInfo.noteIndex],
                })
                if (tieDirection !== undefined) {
                  secondPartialTie.setDirection(tieDirection)
                }
                secondPartialTie.setContext(this.context!).draw()

                // Register second partial tie
                try {
                  const box = secondPartialTie.getBoundingBox()
                  if (box) {
                    this.elementRegistry.add({
                      type: 'tie',
                      fromNoteId: note.id,
                      toNoteId: note.tiedTo!,
                      fromMeasure: fromMeasure,
                      toMeasure: toMeasure!,
                      isPartial: true,
                      partialType: 'start', // starts at line break
                      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                    })
                  }
                } catch (e) {
                  // getBoundingBox may fail
                }
              }
            } catch (e) {
              console.error('Could not render tie:', e)
            }
          }
        }
      }
    }
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

    const tieDirection = this.getTieDirection(foundNotePitch, foundBeat, foundMeasure)
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
}
