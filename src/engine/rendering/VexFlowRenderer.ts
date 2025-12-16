import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, TickContext } from 'vexflow'
import type { Score, Measure, Note as MusicNote, NoteDuration } from '@/types/music'
import { midiToNoteName } from '@/utils/musicUtils'

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
   * Create a VexFlow StaveNote from our Note type
   * Can handle single notes or chords (multiple pitches)
   */
  private createStaveNote(note: MusicNote, additionalPitches?: number[]): StaveNote {
    const vexDuration = this.convertDuration(note.duration)

    // Handle rests differently
    if (note.isRest) {
      // Create a rest (add 'r' suffix to duration)
      const staveNote = new StaveNote({
        keys: ['b/4'], // Rests use a placeholder key
        duration: vexDuration + 'r', // Add 'r' for rest
      })
      return staveNote
    }

    // Regular note or chord
    // Collect all pitches (main note + additional chord notes)
    const allPitches = [note.pitch, ...(additionalPitches || [])]

    // Sort pitches from lowest to highest (VexFlow requires this for chords)
    allPitches.sort((a, b) => a - b)

    // Convert to VexFlow note names
    const keys = allPitches.map(pitch => this.midiToVexFlowNote(pitch))

    const staveNote = new StaveNote({
      keys: keys,
      duration: vexDuration,
      auto_stem: true, // Enable automatic stem direction
    })

    // VexFlow automatically handles note displacement for seconds (adjacent notes)
    // The lower note in a second interval will be shifted to the right side of the stem

    // Add accidentals if specified
    if (note.accidental) {
      const accidentalMap: Record<string, string> = {
        '#': '#',
        b: 'b',
        n: 'n',
      }
      staveNote.addModifier(new Accidental(accidentalMap[note.accidental]), 0)
    }

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
   */
  private createStaveNotesFromGroups(noteGroups: MusicNote[][]): StaveNote[] {
    const staveNotes: StaveNote[] = []

    for (const group of noteGroups) {
      // Separate rests from regular notes
      const rests = group.filter(n => n.isRest)
      const regularNotes = group.filter(n => !n.isRest)

      // Add rests (rests cannot form chords)
      for (const rest of rests) {
        staveNotes.push(this.createStaveNote(rest))
      }

      // Add regular notes (as single note or chord)
      if (regularNotes.length > 0) {
        // Use the first note as the base, pass other pitches for chord
        const baseNote = regularNotes[0]
        const additionalPitches = regularNotes.slice(1).map(n => n.pitch)
        staveNotes.push(this.createStaveNote(baseNote, additionalPitches))
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
   */
  renderMeasure(
    measure: Measure,
    x: number,
    y: number,
    width: number,
    isFirstInLine: boolean = false
  ): void {
    if (!this.context) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Create a stave
    const stave = new Stave(x, y, width)

    // Add clef for first measure or first measure of each line
    if (measure.number === 1 || isFirstInLine) {
      stave.addClef('treble')
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

      // DEBUG: Log measure data before processing (disabled for performance)
      // console.log(`📊 MEASURE ${measure.number} DATA:`)
      // console.log(`  - Notes count: ${measure.notes.length}`)
      // console.log(`  - Notes:`, sortedNotes.map(n => `${n.isRest ? 'REST-' : ''}${n.duration} at beat ${n.beat}`))

      // Group notes by beat position to handle chords
      const noteGroups = this.groupNotesByBeat(sortedNotes)
      const staveNotes = this.createStaveNotesFromGroups(noteGroups)

      // Calculate how many beats are used (using sorted notes)
      const usedBeats = this.calculateUsedBeats(sortedNotes)
      const requiredBeats = measure.timeSignature.numerator

      // console.log(`  - Used beats: ${usedBeats} / Required: ${requiredBeats}`)

      if (usedBeats !== requiredBeats) {
        console.error(`  ⚠️ MISMATCH: Measure has ${usedBeats} beats but should have exactly ${requiredBeats}!`)
      }

      // console.log(`  - Total StaveNotes to render: ${staveNotes.length}`)

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
        // console.log(`  ✅ Measure ${measure.number} rendered successfully`)
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

      // Create a temporary invisible stave for rendering the ghost note
      const tempStave = new Stave(measureX, measureY, staveWidth)

      // Add clef and time signature to match the actual stave layout
      const isFirstInLine = positionInLine === 0
      if (ghostNote.measure === 1 || isFirstInLine) {
        tempStave.addClef('treble')
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

      // Create the StaveNote
      const staveNote = new StaveNote({
        keys: [vexNote],
        duration: vexDuration,
      })

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
    // Clear the canvas first to avoid accumulation
    this.clear()

    // Render the score with ghost note
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

    // console.log('renderScore() - About to render', numMeasures, 'measures')
    // console.log('SVG element:', svg)
    // console.log('Context:', this.context)
    // console.log('Renderer:', this.renderer)

    // Get current SVG size
    const currentWidth = parseInt(svg.getAttribute('width') || '0')
    const currentHeight = parseInt(svg.getAttribute('height') || '0')

    // console.log(`Current size: ${currentWidth}x${currentHeight}, Target: ${containerWidth}x${totalHeight}`)

    // Only resize if dimensions changed (following VexFlow best practice)
    if (currentWidth !== containerWidth || currentHeight !== totalHeight) {
      // console.log('Resizing SVG...')
      this.renderer!.resize(containerWidth, totalHeight)
      // Note: According to VexFlow docs, resize() modifies the existing SVG
      // element's attributes, it does NOT create a new element
    }

    // Reuse the same context (VexFlow best practice: "single context per renderer")
    // No need to call getContext() again unless we recreated the renderer

    // Calculate measure width to fit in container (no gaps between measures)
    const availableWidth = containerWidth - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine)

    // console.log(`Rendering ${numMeasures} measures, ${measuresPerLine} per line`)

    // Render each measure
    score.measures.forEach((measure, index) => {
      const line = Math.floor(index / measuresPerLine)
      const positionInLine = index % measuresPerLine
      const isFirstInLine = positionInLine === 0

      // Measures are continuous - no gaps between them
      const x = margin + positionInLine * staveWidth
      const y = margin + line * (staveHeight + verticalSpacing)

      // console.log(`Rendering measure ${measure.number} at (${x}, ${y})`)
      this.renderMeasure(measure, x, y, staveWidth, isFirstInLine)
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

    // console.log('renderScore() complete - SVG children count:', svg.childNodes.length)
    return ghostNoteRendered
  }

  /**
   * Clear the canvas content without removing the SVG element
   */
  clear(): void {
    // According to VexFlow best practices, we should keep the SVG element
    // and only clear its contents, not remove the element itself
    const svg = this.getSVGElement()
    // console.log('clear() called, SVG exists:', !!svg)
    if (svg) {
      // console.log('SVG before clear - children count:', svg.childNodes.length)
      // Clear all children of the SVG, but keep the SVG element itself
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild)
      }
      // console.log('SVG after clear - children count:', svg.childNodes.length)
    }
    // Note: We do NOT clear measureBounds here because the layout stays the same
    // and we need the bounds for coordinate mapping between renders
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }
}
