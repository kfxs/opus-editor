import { tempoFieldsFromTool } from '../utils/tempoText'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Clef, TimeSignature, Dynamic, TempoMark } from '../types/music'
import type { DynamicTool, TempoTool, EditorState } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import type { HighlightController } from './HighlightController'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'
import { renderCensus } from '../dev/renderCensus' // P0 instrument — temporary, see §8

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

  /**
   * Make the picture right again.
   *
   * Most calls here change no content: the census (docs/render-performance-findings.md §P0.4)
   * found that **82% of renders in an ordinary editing session** were a selection move, a hover,
   * a pan or a ghost being erased — each paying a full layout + draw of the whole score to shift
   * a highlight. So the score is only re-engraved when it is actually *stale* (content, view
   * state, or a leftover ghost — see `MusicEngine.isRenderStale`). Otherwise the SVG on screen
   * is already correct and we take the old highlights off and put the new ones on, in place.
   */
  renderScore(): void {
    const engine = this.getEngine()
    if (!engine) return
    // P0 instrument (temporary): no cause given — the census recovers the call site from the
    // stack, which is the whole point: an edit and a selection both arrive through this method.
    renderCensus.setCause()

    // Any ghost showing is stale the moment we get here (P4: an overlay, so this is a DOM
    // removal). Erasing a ghost used to be reason enough for a full render — it is not.
    engine.clearGhosts()

    if (engine.isRenderStale()) {
      engine.clearCanvas()
      engine.renderScore()
      // The SVG the highlights were painted on no longer exists.
      this.highlight.discardHighlights()
    } else {
      this.highlight.clearHighlights()
    }

    this.applyHighlights()
    this.afterRender?.()
  }

  /**
   * Draw the ghost note under the cursor.
   *
   * Since P4 this is an **overlay**: the engraved score and its highlights stay exactly as they
   * are and only the ghost's own `<g>` is swapped. The census (P0.4) found the hover ghost was
   * the single most expensive cause in an editing session — 43% of all render time — spent
   * re-laying-out hundreds of bars to move one translucent notehead.
   *
   * @returns true if a ghost note was actually drawn (used to hide the cursor).
   */
  renderPreview(coords: { x: number; y: number }): boolean {
    const engine = this.getEngine()
    if (!engine) return false
    renderCensus.setCause('ghost:note')
    // The ghost is placed against the LAST render's layout, so the score under it must be
    // current first. Usually it already is, and this costs nothing.
    this.ensureScoreDrawn(engine)
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
    return ghostRendered
  }

  /** Re-engrave the score only if it is actually stale — the ghosts draw ON TOP of it and must
   *  not re-engrave it themselves (P4). Repaints the highlights when it does redraw, since the
   *  SVG they were painted on is then gone. */
  private ensureScoreDrawn(engine: MusicEngine): void {
    if (!engine.isRenderStale()) return
    engine.clearCanvas()
    engine.renderScore()
    this.highlight.discardHighlights()
    this.applyHighlights()
  }

  /** Render the score with a translucent ghost clef at the hovered measure. */
  renderClefGhost(coords: { x: number; y: number }, clef: Clef): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:clef')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithClefGhost(coords, clef)
  }

  /** Render the score with a translucent ghost time signature following the cursor. */
  renderTimeSignatureGhost(coords: { x: number; y: number }, ts: TimeSignature): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:timesig')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithTimeSignatureGhost(coords, ts)
  }

  /**
   * Render the score with a translucent ghost tempo mark following the cursor — showing
   * exactly what the armed preset will engrave ('Allegro', '♩ = 120', 'Allegro (♩ = 120)').
   */
  renderTempoGhost(coords: { x: number; y: number }, tool: TempoTool): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:tempo')
    // Through the SAME tool→text step the click uses (MouseController), so the preview shows the
    // string that will actually be engraved. Spreading the raw tool instead left a bare-metronome
    // ghost with no `text` — and a mark with no text draws nothing, so it never appeared.
    const ghost: TempoMark = { id: 'ghost-tempo', beat: { num: 0, den: 1 }, ...tempoFieldsFromTool(tool) }
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithTempoGhost(coords, ghost)
  }

  /**
   * Render the score with a translucent ghost dynamic following the cursor. The
   * `'text'` tool previews the custom-text placeholder; a level tool previews its
   * glyph (p/mp/mf/f).
   */
  renderDynamicGhost(coords: { x: number; y: number }, tool: DynamicTool): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:dynamic')
    const beat = { num: 0, den: 1 }
    const ghost: Dynamic = tool === 'text'
      ? { id: 'ghost-dynamic', beat, kind: 'text', text: 'Text', placement: 'below' }
      : { id: 'ghost-dynamic', beat, kind: 'level', level: tool, placement: 'below' }
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithDynamicGhost(coords, ghost)
  }

  /** Render the score with a colored paste caret following the cursor (armed paste). */
  renderPasteCaret(coords: { x: number; y: number }): void {
    this.renderScore() // census: attributed to its caller, like any plain renderScore
    this.highlight.drawPasteCaret(coords)
  }
}
