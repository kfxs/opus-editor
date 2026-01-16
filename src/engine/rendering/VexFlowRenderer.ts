import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, StaveTie } from 'vexflow'
import type { Score, Measure, Note as MusicNote, NoteDuration, Clef, Accidental as AccidentalType } from '@/types/music'
import { midiToNoteName } from '@/utils/musicUtils'
import { ElementRegistry, type StaffGeometry } from '@/engine/ElementRegistry'

/**
 * Clef configuration for stem direction calculation
 * middleLinePitch: MIDI pitch of the middle line (B4=71 for treble, D3=50 for bass, etc.)
 */
const CLEF_CONFIG: Record<Clef, { middleLinePitch: number }> = {
  treble: { middleLinePitch: 71 },  // B4
  bass: { middleLinePitch: 50 },    // D3
  alto: { middleLinePitch: 60 },    // C4 (middle C)
  tenor: { middleLinePitch: 57 },   // A3
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
    this.renderer = new Renderer(this.svgContainer, Renderer.Backends.SVG)
    this.renderer.resize(width, height)
    this.context = this.renderer.getContext()

    // Disable save/restore to avoid structuredClone issues with Vue reactivity
    this.context.save = () => {}
    this.context.restore = () => {}
  }

  /**
   * Convert our NoteDuration to VexFlow duration format
   */
  private convertDuration(duration: NoteDuration): string {
    const durationMap: Record<NoteDuration, string> = {
      w: 'w',
      h: 'h',
      q: 'q',
      '8': '8',
      '16': '16',
      '32': '32',
    }
    return durationMap[duration]
  }

  /**
   * Convert MIDI note to VexFlow note format
   * @param midiNote - MIDI note number
   * @returns VexFlow note string (e.g., 'C/4', 'A#/3')
   */
  private midiToVexFlowNote(midiNote: number): string {
    const noteName = midiToNoteName(midiNote)
    // Convert 'C#4' to 'C#/4' format
    const match = noteName.match(/^([A-G][#b]?)(\d+)$/)
    if (!match) {
      throw new Error(`Invalid note name: ${noteName}`)
    }
    return `${match[1]}/${match[2]}`
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
  private calculateChordStemDirection(notes: MusicNote[], clef: Clef = 'treble'): number {
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
   * Create a VexFlow StaveNote from our Note type
   * Can handle single notes or chords (multiple pitches)
   * @param note - The main note
   * @param chordNotes - All notes in the chord (for stem direction calculation)
   * @param clef - Clef type for stem direction calculation
   */
  private createStaveNote(
    note: MusicNote,
    chordNotes: MusicNote[] = [note],
    clef: Clef = 'treble'
  ): StaveNote {
    const vexDuration = this.convertDuration(note.duration)

    // Handle rests differently - rests don't have stem direction
    if (note.isRest) {
      const staveNote = new StaveNote({
        keys: ['b/4'], // Rests use a placeholder key
        duration: vexDuration + 'r', // Add 'r' for rest
      })
      return staveNote
    }

    // Regular note or chord
    // Collect all pitches from chord notes
    const allPitches = chordNotes.map(n => n.pitch)

    // Sort pitches from lowest to highest (VexFlow requires this for chords)
    allPitches.sort((a, b) => a - b)

    // Convert to VexFlow note names
    const keys = allPitches.map(pitch => this.midiToVexFlowNote(pitch))

    // Calculate stem direction
    // Check if any note has a manual stem direction override
    // Using numeric values directly: 1 = UP, -1 = DOWN
    const manualDirection = chordNotes.find(n => n.stemDirection && n.stemDirection !== 'auto')
    let stemDirection: number

    if (manualDirection?.stemDirection === 'up') {
      stemDirection = 1 // UP
    } else if (manualDirection?.stemDirection === 'down') {
      stemDirection = -1 // DOWN
    } else {
      // Auto-calculate based on pitch and clef
      stemDirection = this.calculateChordStemDirection(chordNotes, clef)
    }

    const staveNote = new StaveNote({
      keys: keys,
      duration: vexDuration,
      auto_stem: false,
    })

    // Explicitly set stem direction AFTER creation
    // VexFlow sometimes ignores the constructor option
    staveNote.setStemDirection(stemDirection)

    // VexFlow automatically handles note displacement for seconds (adjacent notes)
    // The lower note in a second interval will be shifted to the right side of the stem

    // Add accidentals for each note in the chord
    chordNotes.forEach((chordNote, index) => {
      if (chordNote.accidental) {
        const accidentalMap: Record<string, string> = {
          '#': '#',
          b: 'b',
          n: 'n',
        }
        // Find the index in the sorted keys array
        const sortedIndex = allPitches.indexOf(chordNote.pitch)
        if (sortedIndex !== -1) {
          staveNote.addModifier(new Accidental(accidentalMap[chordNote.accidental]), sortedIndex)
        }
      }
    })

    return staveNote
  }

  /**
   * Group notes by beat position to identify chords
   * Returns an array of note groups, where each group is at the same beat
   */
  private groupNotesByBeat(notes: MusicNote[]): MusicNote[][] {
    const beatGroups = new Map<number, MusicNote[]>()

    for (const note of notes) {
      const beat = note.beat
      if (!beatGroups.has(beat)) {
        beatGroups.set(beat, [])
      }
      beatGroups.get(beat)!.push(note)
    }

    // Convert to array and sort by beat position
    return Array.from(beatGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([beat, notes]) => notes)
  }

  /**
   * Create StaveNotes from note groups (handles both single notes and chords)
   * @param noteGroups - Groups of notes at same beat positions
   * @param clef - Clef type for stem direction calculation
   */
  private createStaveNotesFromGroups(noteGroups: MusicNote[][], clef: Clef = 'treble'): StaveNote[] {
    const staveNotes: StaveNote[] = []

    for (const group of noteGroups) {
      // Separate rests from regular notes
      const rests = group.filter(n => n.isRest)
      const regularNotes = group.filter(n => !n.isRest)

      // Add rests (rests cannot form chords)
      for (const rest of rests) {
        staveNotes.push(this.createStaveNote(rest, [rest], clef))
      }

      // Add regular notes (as single note or chord)
      if (regularNotes.length > 0) {
        // Use the first note as the base, pass all chord notes for stem calculation
        const baseNote = regularNotes[0]
        staveNotes.push(this.createStaveNote(baseNote, regularNotes, clef))
      }
    }

    return staveNotes
  }

  /**
   * Calculate total beats used by notes in a measure
   * Groups notes by beat to properly handle chords (chord = 1 beat, not N beats)
   */
  private calculateUsedBeats(notes: MusicNote[]): number {
    const durationToBeats: Record<NoteDuration, number> = {
      w: 4,
      h: 2,
      q: 1,
      '8': 0.5,
      '16': 0.25,
      '32': 0.125,
    }

    // Group by beat position to avoid counting chords multiple times
    const noteGroups = this.groupNotesByBeat(notes)

    let totalBeats = 0
    for (const group of noteGroups) {
      // Each group (single note or chord) counts once
      // Use the duration of the first note (all notes in a chord should have same duration)
      totalBeats += durationToBeats[group[0].duration] || 1
    }
    return totalBeats
  }

  /**
   * Convert beats to rest durations (may need multiple rests)
   * Returns an array of VexFlow duration strings with 'r' suffix for rests
   */
  private beatsToRestDurations(beats: number): string[] {
    const rests: string[] = []
    let remaining = beats
    const epsilon = 0.001 // Tolerance for floating point comparison

    // Break down into whole, half, quarter, etc.
    while (remaining > epsilon) {
      if (remaining >= 4 - epsilon) {
        rests.push('wr')
        remaining -= 4
      } else if (remaining >= 2 - epsilon) {
        rests.push('hr')
        remaining -= 2
      } else if (remaining >= 1 - epsilon) {
        rests.push('qr')
        remaining -= 1
      } else if (remaining >= 0.5 - epsilon) {
        rests.push('8r')
        remaining -= 0.5
      } else if (remaining >= 0.25 - epsilon) {
        rests.push('16r')
        remaining -= 0.25
      } else if (remaining >= 0.125 - epsilon) {
        rests.push('32r')
        remaining -= 0.125
      } else {
        // Prevent infinite loop if remaining is very small
        break
      }
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
  private getBeatGroup(beat: number, beatsPerMeasure: number): number {
    // For now, group by integer beat (beam within each beat)
    // This can be enhanced later for different time signatures
    // e.g., in 6/8, beam in groups of 3 eighth notes
    return Math.floor(beat)
  }

  /**
   * Calculate the stem direction for an entire beam group
   * Uses the note furthest from the middle line to determine direction
   * This ensures all notes in a beam have consistent stem direction
   * @param allNotes - All notes in the beam group (flattened from note groups)
   * @param clef - Clef type for middle line reference
   * @returns VexFlow stem direction value (1 = UP, -1 = DOWN)
   */
  private calculateBeamGroupStemDirection(allNotes: MusicNote[], clef: Clef = 'treble'): number {
    if (allNotes.length === 0) return 1 // UP by default

    const middlePitch = CLEF_CONFIG[clef].middleLinePitch

    // Find the note furthest from the middle line
    let maxDistance = 0
    let furthestPitch = allNotes[0].pitch

    for (const note of allNotes) {
      if (note.isRest) continue
      const staffPitch = this.getStaffPositionPitch(note.pitch, note.accidental)
      const distance = Math.abs(staffPitch - middlePitch)

      if (distance > maxDistance) {
        maxDistance = distance
        furthestPitch = staffPitch
      }
    }

    // If furthest note is on or above middle line, stems go down; otherwise up
    return furthestPitch >= middlePitch ? -1 : 1
  }

  /**
   * Create beam groups from stave notes and their corresponding music notes
   * Returns arrays of StaveNotes that should be beamed together, along with note data
   *
   * @param staveNotes - The VexFlow StaveNote objects
   * @param noteGroups - The original note groups (for duration/beat info)
   * @param beatsPerMeasure - Number of beats in the measure
   * @returns Array of beam group info with stave notes and music notes
   */
  private createBeamGroups(
    staveNotes: StaveNote[],
    noteGroups: MusicNote[][],
    beatsPerMeasure: number
  ): { staveNotes: StaveNote[]; musicNotes: MusicNote[][] }[] {
    const beamGroups: { staveNotes: StaveNote[]; musicNotes: MusicNote[][] }[] = []
    let currentStaveNotes: StaveNote[] = []
    let currentMusicNotes: MusicNote[][] = []
    let currentBeatGroup: number | null = null

    for (let i = 0; i < staveNotes.length && i < noteGroups.length; i++) {
      const staveNote = staveNotes[i]
      const noteGroup = noteGroups[i]
      const firstNote = noteGroup[0]

      // Skip rests - they break beams
      if (firstNote.isRest) {
        // Save current group if it has 2+ notes
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, musicNotes: currentMusicNotes })
        }
        currentStaveNotes = []
        currentMusicNotes = []
        currentBeatGroup = null
        continue
      }

      // Check if this note is beamable
      if (!this.isBeamableDuration(firstNote.duration)) {
        // Non-beamable note breaks the beam
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, musicNotes: currentMusicNotes })
        }
        currentStaveNotes = []
        currentMusicNotes = []
        currentBeatGroup = null
        continue
      }

      // This note is beamable - check beat boundary
      const beatGroup = this.getBeatGroup(firstNote.beat, beatsPerMeasure)

      if (currentBeatGroup === null || beatGroup === currentBeatGroup) {
        // Same beat group or starting new group
        currentStaveNotes.push(staveNote)
        currentMusicNotes.push(noteGroup)
        currentBeatGroup = beatGroup
      } else {
        // Different beat group - save current and start new
        if (currentStaveNotes.length >= 2) {
          beamGroups.push({ staveNotes: currentStaveNotes, musicNotes: currentMusicNotes })
        }
        currentStaveNotes = [staveNote]
        currentMusicNotes = [noteGroup]
        currentBeatGroup = beatGroup
      }
    }

    // Don't forget the last group
    if (currentStaveNotes.length >= 2) {
      beamGroups.push({ staveNotes: currentStaveNotes, musicNotes: currentMusicNotes })
    }

    return beamGroups
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
    const actualNotes = measure.notes.filter(n => !n.isRest)
    if (actualNotes.length === 0) {
      return Math.max(LAYOUT_CONFIG.MIN_MEASURE_WIDTH, overhead + 40)
    }

    // Create temporary voice to calculate width
    const sortedNotes = [...measure.notes].sort((a, b) => a.beat - b.beat)
    const noteGroups = this.groupNotesByBeat(sortedNotes)
    const staveNotes = this.createStaveNotesFromGroups(noteGroups, clef)

    const voice = new Voice({
      num_beats: measure.timeSignature.numerator,
      beat_value: measure.timeSignature.denominator,
    })

    try {
      voice.addTickables(staveNotes)

      // Use VexFlow's formatter to calculate minimum width
      const formatter = new Formatter()
      formatter.joinVoices([voice])
      const minNoteWidth = formatter.preCalculateMinTotalWidth([voice])

      // Add safety buffer (15%) and ensure minimum note spacing
      const noteCount = noteGroups.filter(g => !g[0].isRest).length
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

    // Create notes for this measure (measures always have notes - at minimum rests)
    if (measure.notes.length > 0) {
      // Sort notes by beat position before rendering
      const sortedNotes = [...measure.notes].sort((a, b) => a.beat - b.beat)

      // Group notes by beat position to handle chords
      const noteGroups = this.groupNotesByBeat(sortedNotes)
      const staveNotes = this.createStaveNotesFromGroups(noteGroups, clef)

      // Calculate how many beats are used (using sorted notes)
      const usedBeats = this.calculateUsedBeats(sortedNotes)
      const requiredBeats = measure.timeSignature.numerator

      if (usedBeats !== requiredBeats) {
        console.error(`  ⚠️ MISMATCH: Measure has ${usedBeats} beats but should have exactly ${requiredBeats}!`)
      }

      // Create a voice with the notes
      const voice = new Voice({
        num_beats: measure.timeSignature.numerator,
        beat_value: measure.timeSignature.denominator,
      })

      try {
        voice.addTickables(staveNotes)

        // Create beams BEFORE drawing (so VexFlow hides the flags)
        const beamGroups = this.createBeamGroups(
          staveNotes,
          noteGroups,
          measure.timeSignature.numerator
        )

        const beams: Beam[] = []
        for (const beamGroup of beamGroups) {
          try {
            // Calculate unified stem direction for the entire beam group
            // This ensures all notes in the beam have consistent stems
            const allNotesInBeam = beamGroup.musicNotes.flat()
            const beamStemDirection = this.calculateBeamGroupStemDirection(allNotesInBeam, clef)

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

        // === Register elements after drawing ===

        // Register notes and rests
        // We need to track staveNote index separately since rests and chords create separate staveNotes
        let staveNoteIndex = 0
        for (const noteGroup of noteGroups) {
          // Separate rests from regular notes (same logic as createStaveNotesFromGroups)
          const rests = noteGroup.filter(n => n.isRest)
          const regularNotes = noteGroup.filter(n => !n.isRest)

          // Register rests (each rest is a separate staveNote)
          for (const rest of rests) {
            if (staveNoteIndex < staveNotes.length) {
              const staveNote = staveNotes[staveNoteIndex]
              try {
                const box = staveNote.getBoundingBox()
                if (box) {
                  this.elementRegistry.add({
                    type: 'rest',
                    id: rest.id,
                    measure: measure.number,
                    beat: rest.beat,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })
                }
              } catch (e) {
                // getBoundingBox may fail
              }
              staveNoteIndex++
            }
          }

          // Register regular notes (chord is one staveNote with multiple pitches)
          if (regularNotes.length > 0 && staveNoteIndex < staveNotes.length) {
            const staveNote = staveNotes[staveNoteIndex]
            try {
              const box = staveNote.getBoundingBox()
              if (box) {
                // Sort notes by pitch to match VexFlow's internal ordering
                const sortedNotes = [...regularNotes].sort((a, b) => a.pitch - b.pitch)

                for (let keyIndex = 0; keyIndex < sortedNotes.length; keyIndex++) {
                  const note = sortedNotes[keyIndex]
                  this.elementRegistry.add({
                    type: 'note',
                    id: note.id,
                    measure: measure.number,
                    beat: note.beat,
                    pitch: note.pitch,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })

                  // Store StaveNote reference for tie rendering
                  // keyIndex matches VexFlow's sorted pitch order
                  this.staveNoteMap.set(note.id, { staveNote, noteIndex: keyIndex })

                  // Register accidental if present
                  if (note.accidental) {
                    try {
                      // Get modifiers and find the accidental for this note index
                      const modifiers = staveNote.getModifiers()
                      for (const modifier of modifiers) {
                        if (modifier.getCategory() === 'accidentals') {
                          const accidental = modifier as Accidental
                          // Check if this accidental is for this key index
                          if ((accidental as any).index === keyIndex ||
                              (accidental as any).note_index === keyIndex ||
                              modifiers.filter(m => m.getCategory() === 'accidentals').indexOf(modifier) === keyIndex) {
                            const accBox = accidental.getBoundingBox()
                            if (accBox) {
                              this.elementRegistry.add({
                                type: 'accidental',
                                noteId: note.id,
                                measure: measure.number,
                                beat: note.beat,
                                pitch: note.pitch,
                                accidentalType: note.accidental,
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
            staveNoteIndex++
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
   * Render ghost note after all measures (called from renderScore)
   * Uses VexFlow's actual note rendering on a temporary invisible stave
   * @returns true if ghost note was rendered, false if skipped
   */
  private renderGhostNoteOverlay(
    ghostNote: { pitch: number; duration: string; measure: number; beat: number },
    score: Score,
    measuresPerLine: number,
    margin: number,
    staveWidth: number,
    staveHeight: number,
    verticalSpacing: number
  ): boolean {
    try {
      // Find the measure this ghost note belongs to
      const measure = score.measures.find(m => m.number === ghostNote.measure)
      if (!measure) {
        console.warn('⚠️ Measure not found for ghost note:', ghostNote.measure)
        return false
      }

      // Calculate which line and position this measure is on
      const measureIndex = ghostNote.measure - 1
      const line = Math.floor(measureIndex / measuresPerLine)
      const positionInLine = measureIndex % measuresPerLine

      const measureX = margin + positionInLine * staveWidth
      const measureY = margin + line * (staveHeight + verticalSpacing)

      // Get clef from score
      const clef: Clef = score.clef || 'treble'

      // Create a temporary invisible stave for rendering the ghost note
      const tempStave = new Stave(measureX, measureY, staveWidth)

      // Add clef and time signature to match the actual stave layout
      const isFirstInLine = positionInLine === 0
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(clef)
      }
      if (ghostNote.measure === 1) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }

      tempStave.setContext(this.context!)

      // Convert our note to VexFlow format
      const vexNote = this.midiToVexFlowNote(ghostNote.pitch)
      const vexDuration = this.convertDuration(ghostNote.duration as any)

      // Check if there are existing notes at the same beat (potential chord)
      const notesAtSameBeat = measure.notes.filter(
        n => !n.isRest && Math.abs(n.beat - ghostNote.beat) < 0.001
      )

      // Check if the ghost note forms a second with any existing note
      const formsSecond = notesAtSameBeat.some(existingNote => {
        const interval = Math.abs(existingNote.pitch - ghostNote.pitch)
        // A second is 1 or 2 semitones (minor second or major second)
        return interval === 1 || interval === 2
      })

      // Calculate stem direction for ghost note
      // If there are notes at same beat, consider them for chord stem direction
      const ghostMusicNote: MusicNote = {
        id: 'ghost',
        pitch: ghostNote.pitch,
        duration: ghostNote.duration as NoteDuration,
        measure: ghostNote.measure,
        beat: ghostNote.beat,
      }
      const chordNotes = notesAtSameBeat.length > 0
        ? [...notesAtSameBeat, ghostMusicNote]
        : [ghostMusicNote]
      const stemDirection = this.calculateChordStemDirection(chordNotes, clef)

      // Create the StaveNote
      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
        auto_stem: false,
      })

      // Explicitly set stem direction AFTER creation
      staveNote.setStemDirection(stemDirection)

      // Add accidental if present (position will be adjusted after rendering)
      if (ghostNote.accidental) {
        const accidentalMap: Record<string, string> = { '#': '#', 'b': 'b', 'n': 'n' }
        staveNote.addModifier(new Accidental(accidentalMap[ghostNote.accidental]), 0)
      }

      // Store whether this forms a second for later displacement
      const needsDisplacement = formsSecond

      // Create a voice with the ghost note plus padding rests to fill the measure
      const totalBeats = measure.timeSignature.numerator
      const noteDuration = this.durationToBeats(ghostNote.duration)

      // Calculate beats before and after the ghost note
      const beatsBeforeNote = ghostNote.beat
      const beatsAfterNote = totalBeats - ghostNote.beat - noteDuration

      // Don't render if the ghost note would overflow the measure
      if (beatsAfterNote < -0.001) {
        // Ghost note doesn't fit in this measure - skip rendering
        return false
      }

      const tickables: any[] = []

      // Add invisible rests before the note
      if (beatsBeforeNote > 0) {
        const restsBefore = this.beatsToRestDurations(beatsBeforeNote)
        for (const restDuration of restsBefore) {
          tickables.push(new StaveNote({
            keys: ['b/4'],
            duration: restDuration,
          }))
        }
      }

      // Add the ghost note
      tickables.push(staveNote)

      // Add invisible rests after the note
      if (beatsAfterNote > 0) {
        const restsAfter = this.beatsToRestDurations(beatsAfterNote)
        for (const restDuration of restsAfter) {
          tickables.push(new StaveNote({
            keys: ['b/4'],
            duration: restDuration,
          }))
        }
      }

      // Create voice and format
      const voice = new Voice({
        num_beats: totalBeats,
        beat_value: measure.timeSignature.denominator,
      })
      voice.addTickables(tickables)

      // Format the voice to get proper positioning with right padding
      const noteAreaWidth = tempStave.getNoteEndX() - tempStave.getNoteStartX()
      const rightPadding = 15 // Padding before barline
      const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
      new Formatter().joinVoices([voice]).format([voice], formatWidth)

      // Now render only the ghost note (not the rests, not the stave)
      // We'll extract the SVG elements and modify their styling
      const svg = this.getSVGElement()
      if (!svg) {
        console.error('❌ SVG element not found for ghost note')
        return
      }

      // CRITICAL: Set the stave for the note so it can calculate Y values
      staveNote.setStave(tempStave)

      // Get the current number of children (before rendering)
      const childrenBefore = svg.children.length

      // Render the ghost note (this will add elements to the SVG)
      staveNote.setContext(this.context!).draw()

      // Collect ghost note elements for styling and accidental repositioning
      let noteHeadElement: Element | null = null
      let accidentalElement: Element | null = null

      const collectGhostElements = (element: Element) => {
        const tagName = element.tagName.toLowerCase()
        if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
          if (!noteHeadElement && (tagName === 'ellipse' || tagName === 'path')) {
            noteHeadElement = element
          }
        } else if (tagName === 'text') {
          accidentalElement = element
        }
        for (let i = 0; i < element.children.length; i++) {
          collectGhostElements(element.children[i])
        }
      }

      for (let i = childrenBefore; i < svg.children.length; i++) {
        collectGhostElements(svg.children[i])
      }

      // Reposition accidental relative to note head if both exist
      if (noteHeadElement && accidentalElement && ghostNote.accidental) {
        const noteHeadBBox = (noteHeadElement as SVGGraphicsElement).getBBox()
        const accidentalBBox = (accidentalElement as SVGGraphicsElement).getBBox()

        // Position accidental's right edge at a fixed gap from the notehead's left edge
        const gap = 3 // pixels between accidental right edge and notehead left edge
        const noteHeadLeftX = noteHeadBBox.x
        const accidentalRightX = accidentalBBox.x + accidentalBBox.width
        const targetAccidentalRightX = noteHeadLeftX - gap
        const offsetX = targetAccidentalRightX - accidentalRightX

        // Apply transform to reposition accidental
        const currentTransform = accidentalElement.getAttribute('transform') || ''
        const newTransform = currentTransform ? `${currentTransform} translate(${offsetX}, 0)` : `translate(${offsetX}, 0)`
        accidentalElement.setAttribute('transform', newTransform)
      }

      // Recursively apply blue color and displacement to all elements
      const applyBlueColorAndDisplacement = (element: Element) => {
        const tagName = element.tagName.toLowerCase()

        // Apply blue color to note shapes (paths, ellipses, circles)
        if (tagName === 'path' || tagName === 'ellipse' || tagName === 'circle') {
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; stroke: #2563EB !important; opacity: 0.7 !important;')
        } else if (tagName === 'text') {
          // Text glyphs: only fill, no stroke (stroke makes them appear larger)
          element.setAttribute('fill', '#3B82F6')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; fill: #3B82F6 !important; opacity: 0.7 !important;')

          // If this note forms a second, shift the note head to the right (but not the accidental)
          if (needsDisplacement && element !== accidentalElement) {
            const transform = element.getAttribute('transform') || ''
            const newTransform = transform ? `${transform} translate(10, 0)` : 'translate(10, 0)'
            element.setAttribute('transform', newTransform)
          }
        } else if (tagName === 'line') {
          // Lines (stems) - only stroke, NO displacement
          element.setAttribute('stroke', '#2563EB')
          element.setAttribute('opacity', '0.7')
          const currentStyle = element.getAttribute('style') || ''
          element.setAttribute('style', currentStyle + '; stroke: #2563EB !important; opacity: 0.7 !important;')
        }

        // Recursively process children
        for (let i = 0; i < element.children.length; i++) {
          applyBlueColorAndDisplacement(element.children[i])
        }
      }

      // Process all new top-level elements
      for (let i = childrenBefore; i < svg.children.length; i++) {
        applyBlueColorAndDisplacement(svg.children[i])
      }

      return true
    } catch (error) {
      console.error('❌ Could not render ghost note overlay:', error)
      return false
    }
  }

  /**
   * Helper to convert duration to beats
   */
  private durationToBeats(duration: string): number {
    const map: Record<string, number> = {
      w: 4,
      h: 2,
      q: 1,
      '8': 0.5,
      '16': 0.25,
      '32': 0.125,
    }
    return map[duration] || 1
  }

  /**
   * Render ghost note with dynamic measure widths
   * Uses the pre-calculated measure widths to position the ghost note correctly
   * @param rawX - Raw cursor X position for smooth visual positioning
   */
  private renderGhostNoteWithDynamicWidths(
    ghostNote: { pitch: number; duration: string; measure: number; beat: number; rawX?: number },
    score: Score,
    measureWidths: Map<number, MeasureWidthInfo>,
    margin: number,
    staveHeight: number,
    verticalSpacing: number
  ): boolean {
    try {
      // Find the measure this ghost note belongs to
      const measure = score.measures.find(m => m.number === ghostNote.measure)
      if (!measure) {
        console.warn('Measure not found for ghost note:', ghostNote.measure)
        return false
      }

      // Get the measure's width info
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
          // Reset for new line
          measureX = margin
        }
      }

      const measureY = margin + widthInfo.lineNumber * (staveHeight + verticalSpacing)
      const staveWidth = widthInfo.finalWidth

      // Get clef from score
      const clef: Clef = score.clef || 'treble'

      // Create a temporary invisible stave for rendering the ghost note
      const tempStave = new Stave(measureX, measureY, staveWidth)

      // Add clef and time signature to match the actual stave layout
      const isFirstInLine = measureX === margin
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef(clef)
      }
      if (ghostNote.measure === 1) {
        tempStave.addTimeSignature(`${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`)
      }

      tempStave.setContext(this.context!)

      // Convert our note to VexFlow format
      const vexNote = this.midiToVexFlowNote(ghostNote.pitch)
      const vexDuration = this.convertDuration(ghostNote.duration as any)

      // Check if there are existing notes at the same beat (potential chord)
      const notesAtSameBeat = measure.notes.filter(
        n => !n.isRest && Math.abs(n.beat - ghostNote.beat) < 0.001
      )

      // Check if the ghost note forms a second with any existing note
      const formsSecond = notesAtSameBeat.some(existingNote => {
        const interval = Math.abs(existingNote.pitch - ghostNote.pitch)
        return interval === 1 || interval === 2
      })

      // Calculate stem direction for ghost note
      const ghostMusicNote: MusicNote = {
        id: 'ghost',
        pitch: ghostNote.pitch,
        duration: ghostNote.duration as NoteDuration,
        measure: ghostNote.measure,
        beat: ghostNote.beat,
      }
      const chordNotes = notesAtSameBeat.length > 0
        ? [...notesAtSameBeat, ghostMusicNote]
        : [ghostMusicNote]
      const stemDirection = this.calculateChordStemDirection(chordNotes, clef)

      // Create the StaveNote
      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
        auto_stem: false,
      })

      staveNote.setStemDirection(stemDirection)

      // Add accidental if present (position will be adjusted after rendering)
      if (ghostNote.accidental) {
        const accidentalMap: Record<string, string> = { '#': '#', 'b': 'b', 'n': 'n' }
        staveNote.addModifier(new Accidental(accidentalMap[ghostNote.accidental]), 0)
      }

      const needsDisplacement = formsSecond

      // Create a voice with the ghost note plus padding rests to fill the measure
      const totalBeats = measure.timeSignature.numerator
      const noteDuration = this.durationToBeats(ghostNote.duration)

      const beatsBeforeNote = ghostNote.beat
      const beatsAfterNote = totalBeats - ghostNote.beat - noteDuration

      // Ghost note can overflow the measure (we support overwriting notes)
      // Use effective beats for voice calculation
      const effectiveBeatsAfter = Math.max(0, beatsAfterNote)
      const effectiveTotalBeats = beatsBeforeNote + noteDuration + effectiveBeatsAfter

      const tickables: any[] = []

      if (beatsBeforeNote > 0) {
        const restsBefore = this.beatsToRestDurations(beatsBeforeNote)
        for (const restDuration of restsBefore) {
          tickables.push(new StaveNote({
            keys: ['b/4'],
            duration: restDuration,
          }))
        }
      }

      tickables.push(staveNote)

      if (effectiveBeatsAfter > 0) {
        const restsAfter = this.beatsToRestDurations(effectiveBeatsAfter)
        for (const restDuration of restsAfter) {
          tickables.push(new StaveNote({
            keys: ['b/4'],
            duration: restDuration,
          }))
        }
      }

      // Use SOFT mode to allow notes that overflow the measure
      // This is needed for ghost note preview when placing longer notes
      const voice = new Voice({
        num_beats: totalBeats,
        beat_value: measure.timeSignature.denominator,
      }).setMode(Voice.Mode.SOFT)
      voice.addTickables(tickables)

      // Format the voice using actual note area with right padding
      const noteAreaWidth = tempStave.getNoteEndX() - tempStave.getNoteStartX()
      const rightPadding = 15 // Padding before barline
      const formatWidth = noteAreaWidth > 0 ? Math.max(noteAreaWidth - rightPadding, 50) : staveWidth - 100
      new Formatter().joinVoices([voice]).format([voice], formatWidth)

      const svg = this.getSVGElement()
      if (!svg) {
        console.error('SVG element not found for ghost note')
        return false
      }

      staveNote.setStave(tempStave)

      // === NEW APPROACH: Don't use setXShift, instead transform the whole group after rendering ===
      // This ensures all elements (stem, notehead, flag, accidental) move together
      let targetShiftX: number | null = null

      if (ghostNote.rawX !== undefined) {
        try {
          // Get where VexFlow will render the note
          const noteX = staveNote.getAbsoluteX()
          // Calculate shift needed to move note to cursor position
          targetShiftX = ghostNote.rawX - noteX

          if (ghostNote.accidental) {
            console.log('=== GHOST NOTE SHIFT (new approach) ===')
            console.log('rawX:', ghostNote.rawX)
            console.log('VexFlow noteX:', noteX)
            console.log('targetShiftX:', targetShiftX)
            console.log('=======================================')
          }
        } catch (e) {
          // getAbsoluteX might not be available
        }
      }

      const childrenBefore = svg.children.length

      staveNote.setContext(this.context!).draw()

      // === NEW SIMPLE APPROACH ===
      // Instead of trying to detect and reposition individual elements,
      // we wrap ALL new SVG elements in a group and transform the entire group.
      // This ensures stem, notehead, flag, accidental, and leger lines all move together.

      // Collect all new top-level elements that VexFlow just added
      const newElements: Element[] = []
      for (let i = childrenBefore; i < svg.children.length; i++) {
        newElements.push(svg.children[i])
      }

      if (newElements.length > 0 && targetShiftX !== null) {
        // Create a wrapper group for all ghost note elements
        const ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ghostGroup.setAttribute('class', 'ghost-note-group')

        // Apply the transform to shift everything to the correct position
        ghostGroup.setAttribute('transform', `translate(${targetShiftX}, 0)`)

        if (ghostNote.accidental) {
          console.log('=== GHOST NOTE GROUP TRANSFORM ===')
          console.log('targetShiftX:', targetShiftX)
          console.log('Elements in group:', newElements.length)
          console.log('==================================')
        }

        // Move all new elements into the group
        // We need to do this in reverse order to maintain correct order when moving
        for (const element of newElements) {
          svg.removeChild(element)
        }
        for (const element of newElements) {
          ghostGroup.appendChild(element)
        }

        // Add the group to the SVG
        svg.appendChild(ghostGroup)
      }

      // Apply ghost styling (blue color, transparency) to all elements recursively
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

        // Recurse into children
        for (let i = 0; i < element.children.length; i++) {
          applyGhostStyle(element.children[i])
        }
      }

      // Apply styling to all elements in the SVG (either in the group or directly)
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
   * Render the complete score with an optional ghost note preview
   * @param score - Score to render
   * @param ghostNote - Optional ghost note to render in blue/transparent
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  renderScoreWithGhostNote(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawX?: number; rawY?: number; accidental?: '#' | 'b' | 'n' }): boolean {
    // renderScore now clears first, so no need to clear here
    return this.renderScore(score, ghostNote)
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview (rawX for smooth cursor following)
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  renderScore(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawX?: number; rawY?: number; accidental?: '#' | 'b' | 'n' }): boolean {
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

  /**
   * Determine tie direction for a note in a chord
   * Returns: -1 for UP (top note), 1 for DOWN (bottom note), or undefined for single notes
   */
  private getTieDirection(note: MusicNote, measure: Measure): number | undefined {
    // Find all non-rest notes at the same beat in this measure
    const notesAtBeat = measure.notes.filter(
      n => !n.isRest && n.beat === note.beat
    )

    if (notesAtBeat.length <= 1) {
      // Single note - use stem direction convention
      // Stem up → tie down (1), Stem down → tie up (-1)
      const clef = 'treble' // TODO: get from score if needed
      const middlePitch = clef === 'treble' ? 71 : 50 // B4 for treble
      return note.pitch >= middlePitch ? 1 : -1
    }

    // Sort by pitch to find position in chord
    const sortedPitches = notesAtBeat.map(n => n.pitch).sort((a, b) => a - b)
    const lowestPitch = sortedPitches[0]
    const highestPitch = sortedPitches[sortedPitches.length - 1]

    if (note.pitch === highestPitch) {
      // Top note of chord: tie curves UP
      return -1
    } else if (note.pitch === lowestPitch) {
      // Bottom note of chord: tie curves DOWN
      return 1
    } else {
      // Middle note: follow the nearest outer voice
      const distToTop = highestPitch - note.pitch
      const distToBottom = note.pitch - lowestPitch
      return distToTop <= distToBottom ? -1 : 1
    }
  }

  /**
   * Render ties between notes that have tiedTo/tiedFrom properties
   */
  private renderTies(score: Score): void {
    if (!this.context) return

    // Track which ties we've already processed to avoid duplicates
    const processedTies = new Set<string>()

    // Find all notes with ties
    for (const measure of score.measures) {
      for (const note of measure.notes) {
        if (note.tiedTo && !note.isRest) {
          // Create a unique key for this tie relationship
          const tieKey = `${note.id}->${note.tiedTo}`
          if (processedTies.has(tieKey)) {
            continue
          }
          processedTies.add(tieKey)

          // This note ties forward to another note
          const fromInfo = this.staveNoteMap.get(note.id)
          const toInfo = this.staveNoteMap.get(note.tiedTo)

          if (fromInfo?.staveNote && toInfo?.staveNote) {
            try {
              // Get measure numbers
              const fromMeasure = note.measure
              const toNote = score.measures.flatMap(m => m.notes).find(n => n.id === note.tiedTo)
              const toMeasure = toNote?.measure

              // Get line numbers for both measures
              const fromLayout = this.measureLayoutInfo.get(fromMeasure)
              const toLayout = toMeasure ? this.measureLayoutInfo.get(toMeasure) : undefined
              const fromLine = fromLayout?.lineNumber ?? 0
              const toLine = toLayout?.lineNumber ?? 0
              const sameLine = fromLine === toLine

              // Determine tie direction based on chord position
              const tieDirection = this.getTieDirection(note, measure)

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
}
