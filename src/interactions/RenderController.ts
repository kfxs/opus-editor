import type { MusicEngine } from '../engine/MusicEngine'
import type { Clef } from '../types/music'
import type { EditorState } from './EditorState'
import type { HighlightController } from './HighlightController'

/**
 * Orchestrates score rendering and ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 */
export class RenderController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private highlight: HighlightController,
  ) {}

  private applyHighlights(): void {
    this.highlight.applySelectionHighlight()
    this.highlight.applyArticulationHighlight()
    this.highlight.applyAccidentalHighlight()
    this.highlight.applyTupletSelectionHighlight()
    this.highlight.applyTieHighlight()
    this.highlight.applyClefSelectionHighlight()
    this.highlight.applyKeyboardCursor()
  }

  renderScore(): void {
    const engine = this.getEngine()
    if (!engine) return
    engine.clearCanvas()
    engine.renderScore()
    this.applyHighlights()
  }

  /** Returns true if a ghost note was actually rendered (used to hide the cursor). */
  renderPreview(coords: { x: number; y: number }): boolean {
    const engine = this.getEngine()
    if (!engine) return false
    const ghostRendered = engine.renderScoreWithPreview(
      coords,
      this.state.selectedDuration,
      this.state.selectedAccidental || undefined,
      this.state.selectedDots,
      this.state.accent || this.state.staccato || this.state.tenuto
        ? ([
            ...(this.state.accent ? ['accent'] : []),
            ...(this.state.staccato ? ['staccato'] : []),
            ...(this.state.tenuto ? ['tenuto'] : []),
          ] as import('../types/music').ArticulationType[])
        : undefined,
    )
    this.applyHighlights()
    return ghostRendered
  }

  /** Render the score with a translucent ghost clef at the hovered measure. */
  renderClefGhost(coords: { x: number; y: number }, clef: Clef): void {
    const engine = this.getEngine()
    if (!engine) return
    engine.renderScoreWithClefGhost(coords, clef)
    this.applyHighlights()
  }
}
