import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import type { Score, Measure, Note as MusicNote, NoteDuration } from '@/types/music'
import { midiToNoteName } from '@/utils/musicUtils'

/**
 * VexFlow wrapper service for rendering musical notation
 * This service abstracts VexFlow complexity and provides a clean API
 */
export class VexFlowRenderer {
  private renderer: Renderer | null = null
  private context: any = null
  private readonly svgContainer: HTMLElement

  constructor(containerElement: HTMLElement) {
    this.svgContainer = containerElement
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
   */
  private createStaveNote(note: MusicNote): StaveNote {
    const vexDuration = this.convertDuration(note.duration)
    const vexNote = this.midiToVexFlowNote(note.pitch)

    const staveNote = new StaveNote({
      keys: [vexNote],
      duration: vexDuration,
    })

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
   * Render a single measure
   * @param measure - Measure to render
   * @param x - X position on canvas
   * @param y - Y position on canvas
   * @param width - Width of the measure
   * @param isFirstInLine - Whether this is the first measure in a line
   */
  renderMeasure(measure: Measure, x: number, y: number, width: number, isFirstInLine: boolean = false): void {
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

    // Create notes for this measure
    if (measure.notes.length > 0) {
      const staveNotes = measure.notes.map(note => this.createStaveNote(note))

      // Create a voice with the notes
      const voice = new Voice({
        num_beats: measure.timeSignature.numerator,
        beat_value: measure.timeSignature.denominator,
      })
      voice.addTickables(staveNotes)

      // Format and render the voice
      new Formatter().joinVoices([voice]).format([voice], width - 100)
      voice.draw(this.context, stave)
    }
  }

  /**
   * Render the complete score
   * @param score - Score to render
   */
  renderScore(score: Score): void {
    if (!this.context || !this.renderer) {
      throw new Error('Renderer not initialized. Call initialize() first.')
    }

    // Get the SVG element to determine available space
    const svg = this.getSVGElement()
    if (!svg) return

    const containerWidth = parseInt(svg.getAttribute('width') || '1000')
    const containerHeight = parseInt(svg.getAttribute('height') || '400')

    // Calculate layout parameters to fit measures within container
    const numMeasures = score.measures.length
    const margin = 20
    const staveHeight = 120
    const verticalSpacing = 30

    // Determine how many measures fit per line
    let measuresPerLine = Math.max(1, Math.floor(numMeasures / 2))
    if (measuresPerLine > 4) measuresPerLine = 4 // Max 4 measures per line

    // Calculate measure width to fit in container
    const availableWidth = containerWidth - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine) - 20

    // Calculate how many lines we need
    const numLines = Math.ceil(numMeasures / measuresPerLine)
    const totalHeight = numLines * (staveHeight + verticalSpacing)

    // Adjust container height if needed
    if (totalHeight > containerHeight) {
      this.renderer.resize(containerWidth, totalHeight + margin * 2)
    }

    // Render each measure
    score.measures.forEach((measure, index) => {
      const line = Math.floor(index / measuresPerLine)
      const positionInLine = index % measuresPerLine
      const isFirstInLine = positionInLine === 0

      const x = margin + positionInLine * (staveWidth + 20)
      const y = margin + line * (staveHeight + verticalSpacing)

      this.renderMeasure(measure, x, y, staveWidth, isFirstInLine)
    })
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    if (this.svgContainer) {
      this.svgContainer.innerHTML = ''
    }
  }

  /**
   * Get the SVG element
   */
  getSVGElement(): SVGElement | null {
    return this.svgContainer.querySelector('svg')
  }
}
