import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Modifier, Beam, StaveTie, Dot, Tuplet as VexFlowTuplet } from 'vexflow'
import type { Score, Measure, NoteDuration, Clef, Accidental as AccidentalType, ArticulationType, Tuplet, ChordRest, Chord, Fraction } from '@/types/music'
import { fracToNumber, fracEq, fracCompare } from '@/utils/fraction'
import { ElementRegistry, type TupletGeometry } from '@/engine/ElementRegistry'
import { spellingToMidi, spellingToVexflowKey, spellingDiatonicPos, midiToSpelling, alterToAccidental } from '@/utils/pitchSpelling'
import type { PitchAlter } from '@/types/music'

/** Internal flat note used only for ghost-note stem-direction calculation. */
interface FlatNoteForStem {
  pitch: number
  accidental?: AccidentalType
}

/**
 * Clef configuration for stem direction calculation.
 * middleLinePitch:       MIDI of the middle (3rd) staff line — used by legacy flat-Note paths.
 * middleLineDiatonicPos: spellingDiatonicPos() of the same note — used by NotePitch paths.
 *   treble B4  = diatonic 34  (4×7+6)
 *   bass   D3  = diatonic 22  (3×7+1)
 *   alto   C4  = diatonic 28  (4×7+0)
 *   tenor  A3  = diatonic 26  (3×7+5)
 */
const CLEF_CONFIG: Record<Clef, { middleLinePitch: number; middleLineDiatonicPos: number }> = {
  treble: { middleLinePitch: 71, middleLineDiatonicPos: 34 },  // B4
  bass:   { middleLinePitch: 50, middleLineDiatonicPos: 22 },  // D3
  alto:   { middleLinePitch: 60, middleLineDiatonicPos: 28 },  // C4
  tenor:  { middleLinePitch: 57, middleLineDiatonicPos: 26 },  // A3
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
  /** Map of measure numbers to their layout info (including line number) */
  private measureLayoutInfo: Map<number, MeasureWidthInfo> = new Map()

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
    const durationMap: Record<NoteDuration, string> = {
      w: 'w',
      h: 'h',
      q: 'q',
      '8': '8',
      '16': '16',
      '32': '32',
    }
    let vexDuration = durationMap[duration]
    // Append 'd' for each dot - VexFlow uses this to calculate correct ticks
    for (let i = 0; i < dots; i++) {
      vexDuration += 'd'
    }
    return vexDuration
  }

  /**
   * Convert a MIDI note number to a VexFlow key string (e.g. 'c#/4').
   * Used only by the ghost-note rendering path, which still receives MIDI.
   * The optional hint resolves enharmonic spelling for black keys.
   */
  private midiToVexFlowNote(midi: number, hint?: '#' | 'b' | 'n'): string {
    const s = midiToSpelling(midi, hint)
    return spellingToVexflowKey(s.step, s.alter, s.octave)
  }

  /**
   * Get the staff position pitch for stem direction calculation
   * Adjusts for accidentals since they don't affect visual staff position
   * @param pitch - MIDI pitch
   * @param accidental - Optional accidental
   * @returns The pitch representing the visual staff position
   */
  private getStaffPositionPitch(pitch: number, accidental?: AccidentalType): number {
    switch (accidental) {
      case '#': return pitch - 1   // Sharp: visual position is one semitone lower
      case 'b': return pitch + 1   // Flat: visual position is one semitone higher
      // Future: case 'x': return pitch - 2  // Double sharp
      // Future: case 'bb': return pitch + 2 // Double flat
      default: return pitch
    }
  }

  /**
   * Calculate stem direction for a single note
   * @param pitch - MIDI pitch
   * @param accidental - Optional accidental
   * @param clef - Clef type (default: 'treble')
   * @returns VexFlow stem direction value (Stem.UP = 1, Stem.DOWN = -1)
   */
  private calculateStemDirection(
    pitch: number,
    accidental?: AccidentalType,
    clef: Clef = 'treble'
  ): number {
    const staffPitch = this.getStaffPositionPitch(pitch, accidental)
    const middlePitch = CLEF_CONFIG[clef].middleLinePitch
    // Notes on or above middle line: stem down
    // Notes below middle line: stem up
    // Using numeric values directly: 1 = UP, -1 = DOWN
    const direction = staffPitch >= middlePitch ? -1 : 1
    return direction
  }

  /**
   * Calculate stem direction for a chord (multiple notes at same beat)
   * Uses the note furthest from the middle line to determine direction
   * @param notes - Array of notes in the chord
   * @param clef - Clef type (default: 'treble')
   * @returns VexFlow stem direction value
   */
  private calculateChordStemDirection(notes: FlatNoteForStem[], clef: Clef = 'treble'): number {
    // Using numeric values directly: 1 = UP, -1 = DOWN
    if (notes.length === 0) return 1
    if (notes.length === 1) {
      return this.calculateStemDirection(notes[0].pitch, notes[0].accidental, clef)
    }

    const middlePitch = CLEF_CONFIG[clef].middleLinePitch

    // Find the note furthest from the middle line
    let maxDistance = 0
    let stemDirection = 1 // UP

    for (const note of notes) {
      const staffPitch = this.getStaffPositionPitch(note.pitch, note.accidental)
      const distance = Math.abs(staffPitch - middlePitch)

      if (distance > maxDistance) {
        maxDistance = distance
        // Direction based on this furthest note
        stemDirection = staffPitch >= middlePitch ? -1 : 1 // -1 = DOWN, 1 = UP
      }
    }

    return stemDirection
  }

  /**
   * Create StaveNotes directly from ChordRest slots.
   * One slot → one StaveNote. Rests → rest StaveNote; Chords → multi-key StaveNote.
   * @param slots - Slots already sorted by beat position
   * @param clef - Clef type for stem direction calculation
   */
  private createStaveNotesFromSlots(slots: ChordRest[], clef: Clef = 'treble'): StaveNote[] {
    const staveNotes: StaveNote[] = []

    // Track the currently active alteration per diatonic staff position within this measure.
    // Key = spellingDiatonicPos(step, octave). Value = active PitchAlter (0 = natural).
    // A position absent from the map has not yet appeared in this measure.
    const activeMeasureAlterations = new Map<number, PitchAlter>()

    for (const slot of slots) {
      if (slot.type === 'rest') {
        const vexDuration = this.convertDuration(slot.duration, slot.dots || 0)
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

      // Stem direction — compare diatonic staff position against clef's middle line
      let stemDirection: number
      if (slot.stemDirection === 'up') {
        stemDirection = 1
      } else if (slot.stemDirection === 'down') {
        stemDirection = -1
      } else {
        const middleDiatonic = CLEF_CONFIG[clef].middleLineDiatonicPos
        let maxDist = 0
        stemDirection = 1
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
      const staveNote = new StaveNote({ keys, duration: vexDuration, autoStem: false })
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

      // Articulations from first (unsorted) pitch — articulations are per-chord
      const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
      const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
      for (const art of slot.notes[0]?.articulations || []) {
        staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
      }

      staveNotes.push(staveNote)
    }

    return staveNotes
  }

  /**
   * Calculate total beats used by notes in a measure
   * Groups notes by beat to properly handle chords (chord = 1 beat, not N beats)
   */
  private durationToBeats(duration: string, dots: number = 0): number {
    const map: Record<string, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125 }
    const baseBeats = map[duration] || 1
    const dotMultiplier = dots > 0 ? 2 - Math.pow(0.5, dots) : 1
    return baseBeats * dotMultiplier
  }

  private beatsToRestDurations(beats: number): string[] {
    const rests: string[] = []
    let remaining = beats
    const epsilon = 0.001
    while (remaining > epsilon) {
      if (remaining >= 4 - epsilon) { rests.push('wr'); remaining -= 4 }
      else if (remaining >= 2 - epsilon) { rests.push('hr'); remaining -= 2 }
      else if (remaining >= 1 - epsilon) { rests.push('qr'); remaining -= 1 }
      else if (remaining >= 0.5 - epsilon) { rests.push('8r'); remaining -= 0.5 }
      else if (remaining >= 0.25 - epsilon) { rests.push('16r'); remaining -= 0.25 }
      else if (remaining >= 0.125 - epsilon) { rests.push('32r'); remaining -= 0.125 }
      else break
    }
    return rests
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

    for (let i = 0; i < staveNotes.length && i < slots.length; i++) {
      const staveNote = staveNotes[i]
      const slot = slots[i]

      // Rests break beams
      if (slot.type === 'rest') {
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, slots: currentSlots })
        }
        currentStaveNotes = []
        currentSlots = []
        currentBeatGroup = null
        continue
      }

      // Non-beamable notes break the beam
      if (!this.isBeamableDuration(slot.duration)) {
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, slots: currentSlots })
        }
        currentStaveNotes = []
        currentSlots = []
        currentBeatGroup = null
        continue
      }

      // Beamable chord — check beat boundary
      const beatGroup = this.getBeatGroup(fracToNumber(slot.beat), beatsPerMeasure)

      if (currentBeatGroup === null || beatGroup === currentBeatGroup) {
        currentStaveNotes.push(staveNote)
        currentSlots.push(slot)
        currentBeatGroup = beatGroup
      } else {
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, slots: currentSlots })
        }
        currentStaveNotes = [staveNote]
        currentSlots = [slot]
        currentBeatGroup = beatGroup
      }
    }

    if (currentStaveNotes.length >= 2) {
      beamGroups.push({ staveNotes: currentStaveNotes, slots: currentSlots })
    }

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
   * Calculate minimum width needed for a single measure based on its content
   * Uses VexFlow's Formatter to estimate space needed for notes
   */
  private calculateMinimumMeasureWidth(
    measure: Measure,
    isFirstInLine: boolean,
    clef: Clef
  ): number {
    // Start with base overhead
    let overhead = LAYOUT_CONFIG.BARLINE_PADDING * 2

    // Add clef width for first measure of each line
    if (isFirstInLine) {
      overhead += LAYOUT_CONFIG.CLEF_WIDTH
    }

    // Add time signature width for measure 1
    if (measure.number === 1) {
      overhead += LAYOUT_CONFIG.TIME_SIG_WIDTH
    }

    // If measure has no notes or only rests, use minimum width
    const actualNotes = measure.slots.filter(s => s.type === 'chord')
    if (actualNotes.length === 0) {
      return Math.max(LAYOUT_CONFIG.MIN_MEASURE_WIDTH, overhead + 40)
    }

    // Create temporary voice to calculate width
    const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
    const staveNotes = this.createStaveNotesFromSlots(sortedSlots, clef)

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
  private calculateMeasureWidths(score: Score): Map<number, MeasureWidthInfo> {
    const results = new Map<number, MeasureWidthInfo>()
    const clef: Clef = score.clef || 'treble'
    const margin = LAYOUT_CONFIG.MARGIN
    const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

    // Pass 1: Calculate minimum widths and assign to lines
    let currentLine = 0
    let currentLineWidth = 0
    let currentLineMeasures: MeasureWidthInfo[] = []

    for (const measure of score.measures) {
      const isFirstInLine = currentLineMeasures.length === 0
      const minWidth = this.calculateMinimumMeasureWidth(measure, isFirstInLine, clef)

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

        // Recalculate width for new line (first-in-line overhead may differ)
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

    return results
  }

  /**
   * Render a single measure
   * @param measure - Measure to render
   * @param x - X position on canvas
   * @param y - Y position on canvas
   * @param width - Width of the measure
   * @param isFirstInLine - Whether this is the first measure in a line
   * @param clef - Clef type for rendering and stem direction
   */
  renderMeasure(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean = false,
    clef: Clef = 'treble'
  ): void {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Create a stave
    const stave = new Stave(x, y, width)

    // Add clef for first measure or first measure of each line
    if (measure.number === 1 || isFirstInLine) {
      stave.addClef(clef)
    }

    // Add time signature only for the very first measure
    if (measure.number === 1) {
      stave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
    }

    // Draw the stave
    stave.setContext(this.context).draw()

    // Store the actual bounds from VexFlow (after clef/time sig are accounted for)
    this.measureBounds.set(measure.number, {
      measureX: x,
      measureY: y,
      measureWidth: width,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
    })

    // Create notes for this measure (measures always have slots - at minimum rests)
    if (measure.slots.length > 0) {
      // Sort slots by beat position before rendering
      const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
      const staveNotes = this.createStaveNotesFromSlots(sortedSlots, clef)

      // === Create VexFlow Tuplets BEFORE adding notes to voice ===
      // This is critical: VexFlow Tuplet adjusts tick values via setTuplet()
      // which must happen before voice.addTickables() for correct tick calculation
      const tupletStaveNoteMap = new Map<string, { staveNotes: StaveNote[], tuplet: Tuplet }>()

      // Build the mapping from tupletId to StaveNotes (one slot → one StaveNote)
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

      // Create VexFlow Tuplet objects BEFORE adding to voice
      // This adjusts the tick values of the notes
      const vexTuplets: VexFlowTuplet[] = []
      for (const [_tupletId, { staveNotes: tupletStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
        if (tupletStaveNotes.length >= 2) {
          try {
            // Calculate tuplet bracket location (above or below)
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

      // Create a voice with the notes
      // Note: Tuplets have already adjusted tick values above
      const voice = new Voice({
        numBeats: measure.timeSignature.numerator,
        beatValue: measure.timeSignature.denominator,
      })

      try {
        voice.addTickables(staveNotes)

        // Create beams BEFORE drawing (so VexFlow hides the flags)
        const beamGroups = this.createBeamGroups(
          staveNotes,
          sortedSlots,
          measure.timeSignature.numerator
        )

        const beams: Beam[] = []
        for (const beamGroup of beamGroups) {
          try {
            // Calculate unified stem direction for the entire beam group
            // This ensures all notes in the beam have consistent stems
            const beamStemDirection = this.calculateBeamGroupStemDirection(beamGroup.slots, clef)

            // Apply the unified stem direction to all notes in the beam group
            for (const staveNote of beamGroup.staveNotes) {
              staveNote.setStemDirection(beamStemDirection)
            }

            const beam = new Beam(beamGroup.staveNotes)
            beams.push(beam)
          } catch (beamError) {
            // Silently skip beam errors (e.g., if notes can't be beamed)
            console.warn(`Could not create beam: ${beamError}`)
          }
        }

        // Format and render the voice using actual note area with right padding
        // Subtract padding to prevent notes/rests from being too close to barline
        const noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX()
        const rightPadding = 15 // Padding before barline
        const formatWidth = Math.max(noteAreaWidth - rightPadding, 50)
        new Formatter().joinVoices([voice]).format([voice], formatWidth)
        voice.draw(this.context, stave)

        // Draw beams AFTER the voice
        for (const beam of beams) {
          beam.setContext(this.context).draw()
        }

        // Draw tuplets AFTER the voice and register them
        for (const vexTuplet of vexTuplets) {
          try {
            vexTuplet.setContext(this.context!).draw()

            // Register the tuplet element using VexFlow's actual rendered coordinates
            const tupletNotes = vexTuplet.getNotes() as StaveNote[]
            if (tupletNotes.length > 0) {
              // Find the corresponding tuplet data
              for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData }] of tupletStaveNoteMap) {
                if (tStaveNotes.includes(tupletNotes[0])) {
                  // Get the actual bounding box of the tuplet's text element ("3")
                  // VexFlow stores the number in textElement with its own getBoundingBox()
                  const vt = vexTuplet as any
                  const notes = vt.notes as StaveNote[]
                  const firstNote = notes?.[0]
                  const lastNote = notes?.[notes.length - 1]

                  if (firstNote && lastNote) {
                    // Get the location (TOP=1, BOTTOM=-1) from options
                    const location = (vt.options?.location ?? 1) as 1 | -1
                    const bracketed = vt.options?.bracketed ?? true

                    // VexFlow's textElement doesn't store absolute coordinates after render
                    // So we calculate the position based on VexFlow's drawing algorithm:
                    // For BOTTOM: text is below the lowest stem + offset
                    // For TOP: text is above the highest stem - offset

                    // Get stem extents to calculate tuplet position
                    // VexFlow's getStemExtents() returns topY and baseY, but the semantics
                    // differ between stem-up and stem-down notes:
                    // - Stem UP: topY is at stem tip (smaller Y), baseY at notehead (larger Y)
                    // - Stem DOWN: topY is at stem tip (larger Y), baseY at notehead (smaller Y)
                    // So we take the actual min/max of both values to get the true vertical range
                    let stemMinY = Infinity
                    let stemMaxY = -Infinity
                    for (const note of notes) {
                      try {
                        const stemExtents = note.getStemExtents?.()
                        if (stemExtents) {
                          // Take actual min/max regardless of which property
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

                    // Calculate X bounds from notes for the bracket
                    const bracketPadding = 5
                    const xStart = bracketed
                      ? firstNote.getTieLeftX() - bracketPadding
                      : firstNote.getStemX()
                    const xEnd = bracketed
                      ? lastNote.getTieRightX() + bracketPadding
                      : lastNote.getStemX()
                    const width = xEnd - xStart

                    // Calculate Y position based on VexFlow's rendering algorithm
                    // The tuplet bracket and "3" are positioned relative to stem endpoints
                    // Based on debug: "3" center is at ~y=130 when stemMaxY=95 (BOTTOM)
                    // So offset is approximately 35 pixels from stem end
                    let bracketY: number
                    let bracketHeight: number
                    const bracketGap = 10       // Gap between stem end and bracket
                    const totalHeight = 45      // Total height to cover bracket + text

                    if (location === 1) {
                      // TOP: bracket and text above the highest stem
                      bracketY = stemMinY - bracketGap - totalHeight
                      bracketHeight = totalHeight
                    } else {
                      // BOTTOM: bracket and text below the lowest stem
                      // Start just below stems and extend down to cover the "3"
                      bracketY = stemMaxY + bracketGap
                      bracketHeight = totalHeight
                    }

                    // Build comprehensive geometry
                    const tupletGeometry: TupletGeometry = {
                      x: xStart,
                      y: bracketY,
                      width: width,
                      bracketed: bracketed,
                      location: location,
                      bracketLegLength: 10,
                      bracketThickness: 1,
                      bracketPadding: bracketPadding,
                      notationCenterX: xStart + width / 2,
                      textYOffset: vt.options?.textYOffset ?? 0,
                      yOffset: vt.options?.yOffset ?? 0,
                    }

                    this.elementRegistry.add({
                      type: 'tuplet',
                      tupletId: tupletId,
                      measure: measure.number,
                      startBeat: fracToNumber(tupletData.startBeat),
                      numNotes: tupletData.numNotes,
                      bbox: {
                        x: xStart,
                        y: bracketY,
                        width: width,
                        height: bracketHeight,
                      },
                      tupletGeometry,
                    })
                  }
                  break
                }
              }
            }
          } catch (e) {
            // Drawing or getBoundingBox may fail
          }
        }

        // === Register elements after drawing ===

        // Register notes and rests — one staveNote per slot (positional correspondence)
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
              }
            } catch (e) {
              // getBoundingBox may fail
            }
          } else {
            // Chord — one staveNote with multiple pitches
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

                  // Store StaveNote reference for tie rendering
                  // keyIndex matches VexFlow's sorted pitch order
                  this.staveNoteMap.set(pitch.id, { staveNote, noteIndex: keyIndex })

                  // Register articulations if present (only on the lowest-pitch note, index 0)
                  if (keyIndex === 0 && pitch.articulations?.length) {
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
                              articulationType: pitch.articulations[articulationIndex],
                              measure: measure.number,
                              beat: fracToNumber(slot.beat),
                              bbox: { x: artBox.x, y: artBox.y, width: artBox.w, height: artBox.h },
                            })
                          }
                          articulationIndex++
                        }
                      }
                    } catch (e) {
                      // Articulation bounding box may not be available
                    }
                  }

                  // Register accidental if one may have been rendered.
                  // We attempt registration whenever alter is non-zero or forceAccidental is set.
                  // The inner try-catch handles cases where no modifier was actually drawn.
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
                    } catch (e) {
                      // Accidental bounding box may not be available
                    }
                  }
                }
              }
            } catch (e) {
              // getBoundingBox may fail
            }
          }
        }

        // Register beams
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
          } catch (e) {
            // getBoundingBox may fail
          }
        }
      } catch (error) {
        console.error(`  ❌ Could not render measure ${measure.number}: ${error}`)
        console.error(`  - Measure data:`, JSON.stringify(measure, null, 2))
      }
    }

    // Register the staff and its geometry
    try {
      const staveBox = stave.getBoundingBox()
      if (staveBox) {
        this.elementRegistry.add({
          type: 'staff',
          measure: measure.number,
          bbox: { x: staveBox.x, y: staveBox.y, width: staveBox.w, height: staveBox.h },
        })
      }

      // Store staff geometry for accurate pitch calculation
      // VexFlow's getYForLine(line) returns Y position for staff line 0-4
      const lineYPositions: [number, number, number, number, number] = [
        stave.getYForLine(0),
        stave.getYForLine(1),
        stave.getYForLine(2),
        stave.getYForLine(3),
        stave.getYForLine(4),
      ]
      const lineSpacing = lineYPositions[1] - lineYPositions[0]

      this.elementRegistry.setStaffGeometry({
        measure: measure.number,
        lineYPositions,
        lineSpacing,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        clef,
      })
    } catch (e) {
      // getBoundingBox or getYForLine may fail
    }

    // Register clef (first measure or first in line)
    if (measure.number === 1 || isFirstInLine) {
      // Clef is positioned at the start of the stave
      this.elementRegistry.add({
        type: 'clef',
        measure: measure.number,
        bbox: { x: x, y: y, width: LAYOUT_CONFIG.CLEF_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    }

    // Register time signature (first measure only)
    if (measure.number === 1) {
      const timeSigX = x + LAYOUT_CONFIG.CLEF_WIDTH
      this.elementRegistry.add({
        type: 'timeSignature',
        measure: measure.number,
        bbox: { x: timeSigX, y: y, width: LAYOUT_CONFIG.TIME_SIG_WIDTH, height: LAYOUT_CONFIG.STAVE_HEIGHT },
      })
    }

    // Register barline (at the end of each measure)
    this.elementRegistry.add({
      type: 'barline',
      measure: measure.number,
      bbox: { x: x + width - 2, y: y, width: 4, height: LAYOUT_CONFIG.STAVE_HEIGHT },
    })
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview (rawX for smooth cursor following)
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  renderScore(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawX?: number; rawY?: number; accidental?: '#' | 'b' | 'n'; dots?: number; articulations?: ArticulationType[] }): boolean {
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

    // Get clef from score (default to treble)
    const clef: Clef = score.clef || 'treble'

    // Calculate proportional widths for all measures
    const measureWidths = this.calculateMeasureWidths(score)
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

      this.renderMeasure(measure, currentX, y, widthInfo.finalWidth, isFirstInLine, clef)

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
    ghostNote: { pitch: number; duration: string; measure: number; beat: number; rawX?: number; accidental?: '#' | 'b' | 'n'; dots?: number; articulations?: ArticulationType[] },
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
      const clef: Clef = score.clef || 'treble'

      const tempStave = new Stave(measureX, measureY, staveWidth)
      const isFirstInLine = measureX === margin
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(clef)
      }
      if (ghostNote.measure === 1) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }
      tempStave.setContext(this.context!)

      const vexNote = this.midiToVexFlowNote(ghostNote.pitch)
      const vexDuration = this.convertDuration(ghostNote.duration as any, ghostNote.dots || 0)

      // Collect pitches at the same beat position for chord stem-direction calculation.
      // calculateChordStemDirection expects flat MusicNote objects (MIDI pitch), so we
      // derive MIDI from the stored spelling here.
      const notesAtSameBeat: FlatNoteForStem[] = []
      for (const slot of measure.slots) {
        if (slot.type === 'chord' && Math.abs(fracToNumber(slot.beat) - ghostNote.beat) < 0.001) {
          for (const p of slot.notes) {
            notesAtSameBeat.push({
              pitch: spellingToMidi(p.step, p.alter, p.octave),
              accidental: alterToAccidental(p.alter),
            })
          }
        }
      }

      const ghostMusicNote: FlatNoteForStem = {
        pitch: ghostNote.pitch,
      }
      const chordNotes = notesAtSameBeat.length > 0
        ? [...notesAtSameBeat, ghostMusicNote]
        : [ghostMusicNote]
      const stemDirection = this.calculateChordStemDirection(chordNotes, clef)

      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
        autoStem: false,
      })
      staveNote.setStemDirection(stemDirection)

      const dots = ghostNote.dots || 0
      for (let d = 0; d < dots; d++) {
        Dot.buildAndAttach([staveNote], { all: true })
      }

      if (ghostNote.accidental) {
        const accidentalMap: Record<string, string> = { '#': '#', 'b': 'b', 'n': 'n' }
        staveNote.addModifier(new Accidental(accidentalMap[ghostNote.accidental as '#' | 'b' | 'n']), 0)
      }

      if (ghostNote.articulations?.length) {
        const articulationVexCodes: Record<ArticulationType, string> = { accent: 'a>', staccato: 'a.', tenuto: 'a-' }
        const articulationPosition = stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE
        for (const art of ghostNote.articulations) {
          staveNote.addModifier(new Articulation(articulationVexCodes[art]).setPosition(articulationPosition), 0)
        }
      }

      const totalBeats = measure.timeSignature.numerator
      const noteDuration = this.durationToBeats(ghostNote.duration)
      const beatsBeforeNote = ghostNote.beat
      const beatsAfterNote = totalBeats - ghostNote.beat - noteDuration
      const effectiveBeatsAfter = Math.max(0, beatsAfterNote)

      const tickables: any[] = []
      if (beatsBeforeNote > 0) {
        for (const restDuration of this.beatsToRestDurations(beatsBeforeNote)) {
          tickables.push(new StaveNote({ keys: ['b/4'], duration: restDuration }))
        }
      }
      tickables.push(staveNote)
      if (effectiveBeatsAfter > 0) {
        for (const restDuration of this.beatsToRestDurations(effectiveBeatsAfter)) {
          tickables.push(new StaveNote({ keys: ['b/4'], duration: restDuration }))
        }
      }

      const voice = new Voice({
        numBeats: totalBeats,
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
                // Same line: single continuous tie
                const tie = new StaveTie({
                  firstNote: fromInfo.staveNote,
                  lastNote: toInfo.staveNote,
                  firstIndexes: [fromInfo.noteIndex],
                  lastIndexes: [toInfo.noteIndex],
                })
                if (tieDirection !== undefined) {
                  tie.setDirection(tieDirection)
                }
                tie.setContext(this.context!).draw()

                // Register tie in element registry
                try {
                  const box = tie.getBoundingBox()
                  if (box) {
                    this.elementRegistry.add({
                      type: 'tie',
                      fromNoteId: note.id,
                      toNoteId: note.tiedTo!,
                      fromMeasure: fromMeasure,
                      toMeasure: toMeasure!,
                      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                    })
                  }
                } catch (e) {
                  // getBoundingBox may fail
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
   * Render score with an optional ghost note overlay (preview note during mouse hover)
   * Returns true if ghost note was rendered
   */
  renderScoreWithGhostNote(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawX?: number; rawY?: number; accidental?: '#' | 'b' | 'n'; dots?: number; articulations?: ArticulationType[] }): boolean {
    return this.renderScore(score, ghostNote)
  }
}
