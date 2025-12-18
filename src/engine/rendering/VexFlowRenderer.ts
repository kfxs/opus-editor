import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import type { Score, Measure, Note as MusicNote, NoteDuration, Clef, Accidental as AccidentalType } from '@/types/music'
import { midiToNoteName } from '@/utils/musicUtils'

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

  constructor(containerElement: HTMLElement) {
    this.svgContainer = containerElement
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

        // Format and render the voice
        new Formatter().joinVoices([voice]).format([voice], width - 100)
        voice.draw(this.context, stave)
      } catch (error) {
        console.error(`  ❌ Could not render measure ${measure.number}: ${error}`)
        console.error(`  - Measure data:`, JSON.stringify(measure, null, 2))
      }
    }

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

      // Format the voice to get proper positioning
      new Formatter().joinVoices([voice]).format([voice], staveWidth - 100)

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

          // If this note forms a second, shift the note head to the right
          if (needsDisplacement) {
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
   * Render the complete score with an optional ghost note preview
   * @param score - Score to render
   * @param ghostNote - Optional ghost note to render in blue/transparent
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  renderScoreWithGhostNote(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawY?: number }): boolean {
    // renderScore now clears first, so no need to clear here
    return this.renderScore(score, ghostNote)
  }

  /**
   * Render the complete score
   * @param score - Score to render
   * @param ghostNote - Optional ghost note preview
   * @returns true if ghost note was rendered, false if not (or no ghost note provided)
   */
  renderScore(score: Score, ghostNote?: { pitch: number; duration: string; measure: number; beat: number; rawY?: number }): boolean {
    if (!this.context || !this.renderer) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Always clear before rendering to prevent accumulation
    this.clear()

    // Calculate layout parameters first
    const numMeasures = score.measures.length
    const margin = 20
    const staveHeight = 120
    const verticalSpacing = 30
    const containerWidth = 1000

    // Determine how many measures fit per line
    let measuresPerLine = Math.max(1, Math.floor(numMeasures / 2))
    if (measuresPerLine > 4) measuresPerLine = 4 // Max 4 measures per line

    // Calculate how many lines we need
    const numLines = Math.ceil(numMeasures / measuresPerLine)
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

    // Reuse the same context (VexFlow best practice: "single context per renderer")
    // No need to call getContext() again unless we recreated the renderer

    // Calculate measure width to fit in container (no gaps between measures)
    const availableWidth = containerWidth - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine)

    // Get clef from score (default to treble)
    const clef: Clef = score.clef || 'treble'

    // Render each measure
    score.measures.forEach((measure, index) => {
      const line = Math.floor(index / measuresPerLine)
      const positionInLine = index % measuresPerLine
      const isFirstInLine = positionInLine === 0

      // Measures are continuous - no gaps between them
      const x = margin + positionInLine * staveWidth
      const y = margin + line * (staveHeight + verticalSpacing)

      this.renderMeasure(measure, x, y, staveWidth, isFirstInLine, clef)
    })

    // Render ghost note AFTER all measures (as an overlay)
    let ghostNoteRendered = false
    if (ghostNote) {
      ghostNoteRendered = this.renderGhostNoteOverlay(
        ghostNote,
        score,
        measuresPerLine,
        margin,
        staveWidth,
        staveHeight,
        verticalSpacing
      )
    }

    return ghostNoteRendered
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
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }
}
