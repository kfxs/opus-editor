import { tempoFieldsFromTool } from '../utils/tempoText'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Clef, TimeSignature, Dynamic, TempoMark } from '../types/music'
import type { DynamicTool, TempoTool, EditorState } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import type { HighlightController } from './HighlightController'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'

/**
 * Orchestrates score rendering and ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 */
export class RenderController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private highlight: HighlightController,
    /** Run after a full score render. The linear-view gutter hangs off this: a render can move
     *  the music under a fixed scroll-x (an added note widens a bar), so what the gutter shows
     *  may change even though the viewport never moved. Optional — nothing else needs it. */
    private afterRender?: () => void,
  ) {}

  private applyHighlights(): void {
    this.highlight.applyMeasureBox()
    this.highlight.applySelectionHighlight()
    this.highlight.applyArticulationHighlight()
    this.highlight.applyAccidentalHighlight()
    this.highlight.applyTupletSelectionHighlight()
    this.highlight.applyTieHighlight()
    this.highlight.applySelectionTieHighlight()
    this.highlight.applyClefSelectionHighlight()
    this.highlight.applyTimeSignatureSelectionHighlight()
    this.highlight.applyDynamicSelectionHighlight()
    this.highlight.applyTempoSelectionHighlight()
    this.highlight.applySlurSelectionHighlight()
    this.highlight.applySlurHandles()
    this.highlight.applySlurEndpointCandidate()
    this.highlight.applyKeyboardCursor()
  }

  renderScore(): void {
    const engine = this.getEngine()
    if (!engine) return
    engine.clearCanvas()
    engine.renderScore()
    this.applyHighlights()
    this.afterRender?.()
  }

  /** Returns true if a ghost note was actually rendered (used to hide the cursor). */
  renderPreview(coords: { x: number; y: number }): boolean {
    const engine = this.getEngine()
    if (!engine) return false
    const v = activeVoiceToModel(this.state.activeVoice)
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
      { fill: voiceFillColor(v), stroke: voiceStrokeColor(v) },
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

  /** Render the score with a translucent ghost time signature following the cursor. */
  renderTimeSignatureGhost(coords: { x: number; y: number }, ts: TimeSignature): void {
    const engine = this.getEngine()
    if (!engine) return
    engine.renderScoreWithTimeSignatureGhost(coords, ts)
    this.applyHighlights()
  }

  /**
   * Render the score with a translucent ghost tempo mark following the cursor — showing
   * exactly what the armed preset will engrave ('Allegro', '♩ = 120', 'Allegro (♩ = 120)').
   */
  renderTempoGhost(coords: { x: number; y: number }, tool: TempoTool): void {
    const engine = this.getEngine()
    if (!engine) return
    // Through the SAME tool→text step the click uses (MouseController), so the preview shows the
    // string that will actually be engraved. Spreading the raw tool instead left a bare-metronome
    // ghost with no `text` — and a mark with no text draws nothing, so it never appeared.
    const ghost: TempoMark = { id: 'ghost-tempo', beat: { num: 0, den: 1 }, ...tempoFieldsFromTool(tool) }
    engine.renderScoreWithTempoGhost(coords, ghost)
    this.applyHighlights()
  }

  /**
   * Render the score with a translucent ghost dynamic following the cursor. The
   * `'text'` tool previews the custom-text placeholder; a level tool previews its
   * glyph (p/mp/mf/f).
   */
  renderDynamicGhost(coords: { x: number; y: number }, tool: DynamicTool): void {
    const engine = this.getEngine()
    if (!engine) return
    const beat = { num: 0, den: 1 }
    const ghost: Dynamic = tool === 'text'
      ? { id: 'ghost-dynamic', beat, kind: 'text', text: 'Text', placement: 'below' }
      : { id: 'ghost-dynamic', beat, kind: 'level', level: tool, placement: 'below' }
    engine.renderScoreWithDynamicGhost(coords, ghost)
    this.applyHighlights()
  }

  /** Render the score with a colored paste caret following the cursor (armed paste). */
  renderPasteCaret(coords: { x: number; y: number }): void {
    this.renderScore()
    this.highlight.drawPasteCaret(coords)
  }
}
