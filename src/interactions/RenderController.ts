import { tempoFieldsFromTool } from '../utils/tempoText'
import { dynamicTextFromTool } from '../utils/dynamics'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Clef, TimeSignature, Dynamic, TempoMark, ArticulationType, Accidental, TremoloMark } from '../types/music'
import type { DynamicTool, TempoTool, EditorState } from './EditorState'
import { activeVoiceToModel, assertNeverTool } from './EditorState'
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
    this.highlight.applyDotHighlight()
    this.highlight.applyTupletSelectionHighlight()
    this.highlight.applyTieHighlight()
    this.highlight.applyClefSelectionHighlight()
    this.highlight.applyTimeSignatureSelectionHighlight()
    this.highlight.applyBarlineSelectionHighlight()
    this.highlight.applyDynamicSelectionHighlight()
    this.highlight.applyDynamicAnchorLine()
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

    // Take the highlight layer OFF before re-engraving, and put it back after.
    //
    // This used to be conditional: a real render could just DISCARD the undo log, on the grounds
    // that "the SVG the highlights were painted on no longer exists". Since P5.4 that is false —
    // a render REUSES the measure groups it did not have to redraw, so a recolour left on a reused
    // group survives the render, and discarding the log would strand it there: a note that stays
    // blue forever. The inverse has to actually run, while the DOM it applies to is still intact.
    this.highlight.clearHighlights()

    if (engine.isRenderStale()) {
      // No clearCanvas() — that wiped the whole SVG, which is exactly what P5.4 must not do.
      // renderScore now tears down only what it is going to rebuild (`clearForRender`).
      engine.renderScore()
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
      // An armed tuplet rides ON the ghost note rather than replacing it: what the click enters IS a
      // note, and the tuplet is what that note starts. So this is a label on the note, not a
      // ninth marking-tool ghost.
      //
      // The SHAPE goes down, not a finished mark: the armed tuplet is a TupletShape minus its actual
      // note value (the value is the armed duration, put back together here), and everything else
      // about the mark depends on the bar under the cursor — which this side cannot see. `deriveM`
      // travels so the engine knows whether M is a request or an answer, and the armed style so the
      // preview obeys the dialog rather than the automatic rule.
      this.state.armedTuplet
        ? {
            shape: {
              ...this.state.armedTuplet,
              baseDuration: this.state.selectedDuration,
              baseDots: this.state.selectedDots,
            },
            deriveM: this.state.armedTuplet.deriveM,
            style: this.state.armedTuplet.format?.numberStyle,
          }
        : undefined,
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
    const ghost: Dynamic = { id: 'ghost-dynamic', beat, text: dynamicTextFromTool(tool), placement: 'below' }
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithDynamicGhost(coords, ghost)
  }

  /** Render the score with translucent ghost articulation glyph(s) following the cursor — the
   *  preview for the armed articulation stamp tool (additive: all armed articulations, stacked). */
  renderArticulationGhost(coords: { x: number; y: number }, types: ArticulationType[]): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:articulation')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithArticulationGhost(coords, types)
  }

  /** Render the score with a translucent ghost accidental glyph following the cursor — the preview
   *  for the armed accidental stamp tool. */
  renderAccidentalGhost(coords: { x: number; y: number }, accidental: Accidental): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:accidental')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithAccidentalGhost(coords, accidental)
  }

  /** Render the score with the translucent ghost tremolo mark following the cursor — the preview for
   *  the armed tremolo stamp. The mark itself, not the palette's note-wearing-strokes picture; the
   *  note it lands on is resolved at click time. Strokes or the Penderecki sign — one modifier draws
   *  both, so the preview cannot disagree with what gets engraved. */
  renderTremoloGhost(coords: { x: number; y: number }, mark: TremoloMark): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:tremolo')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithTremoloGhost(coords, mark)
  }

  /** Render the score with a translucent ghost tie following the cursor — the preview for the armed
   *  tie stamp tool. Engraved as a REAL tie (same primitive and shape constants), but it previews
   *  only the MARK, never which notes will be joined — the engine resolves that on click. */
  renderTieGhost(coords: { x: number; y: number }): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:tie')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithTieGhost(coords)
  }

  /** Render the score with a translucent ghost dot following the cursor — the preview for the armed
   *  dot stamp tool. Valueless: the dot is on or off, so there is nothing to preview but the mark. */
  renderDotGhost(coords: { x: number; y: number }): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:dot')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithDotGhost(coords)
  }

  /** Render the score with a translucent ghost REST following the cursor — the preview for the armed
   *  rest stamp. The ONLY stamp ghost with a value to show, and it reads it from the armed length
   *  rather than the tool: a rest IS its duration + dots, and those are the note-entry fields the
   *  duration/dot keys go on setting while the tool is live (see MARKING_TOOL_USES_ARMED_LENGTH). */
  renderRestGhost(coords: { x: number; y: number }): void {
    const engine = this.getEngine()
    if (!engine) return
    renderCensus.setCause('ghost:rest')
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithRestGhost(coords, this.state.selectedDuration, this.state.selectedDots)
  }

  /**
   * Draw the preview for WHATEVER is armed, at `coords` — the single answer to "what does the next
   * click do?". A marking tool (clef / time signature / dynamic / tempo / the four stamps) previews
   * ITS mark and hides the keyboard cursor; with none armed it falls through to the ghost NOTE.
   *
   * Lives here, not in MouseController, because it is not a mouse gesture: it is a pure function of
   * `state` over this class's own ghost methods. The mouse calls it on every move — but so does
   * PaletteController the moment a tool is armed, which is what makes the ghost appear immediately
   * on the keypress instead of waiting for the pointer to twitch. That symmetry is the whole point:
   * arming and hovering must show the same thing, so they must go through the same function.
   */
  renderToolGhost(coords: { x: number; y: number }): void {
    const tool = this.state.selectedMarkingTool

    // Nothing armed → the ghost NOTE, and the keyboard cursor stays if no note was drawn.
    if (!tool) {
      const ghostNoteRendered = this.renderPreview(coords)
      this.state.showCursor = !ghostNoteRendered
      return
    }

    // A marking tool previews ITSELF, never a ghost note — a ghost note here would say "the next
    // click enters a note", which is exactly what it will not do. The keyboard cursor hides for all
    // of them. EXHAUSTIVE: a ninth tool fails to compile at assertNeverTool until it is drawn.
    this.state.showCursor = false
    switch (tool.kind) {
      case 'clef': this.renderClefGhost(coords, tool.clef); return
      case 'timeSignature': this.renderTimeSignatureGhost(coords, tool.timeSignature); return
      case 'dynamic': this.renderDynamicGhost(coords, tool.dynamic); return
      // Click-to-type entry (expression Ctrl+E, tempo Ctrl+Alt+T): NO ghost. A blue cursor signals
      // "click to place & type", so there is nothing to preview — skip the repaint the others do.
      case 'dynamicEntry':
      case 'tempoEntry': return
      // The actual MARK ('Allegro (♩ = 120)'), so what you see is what gets engraved.
      case 'tempo': this.renderTempoGhost(coords, tool.tempo); return
      // Stacked, so the ghost reads as everything the click will stamp.
      case 'articulation': this.renderArticulationGhost(coords, tool.types); return
      case 'accidental': this.renderAccidentalGhost(coords, tool.sign); return
      // Single-valued, and the MARK rather than the palette's picture — strokes or the Penderecki
      // sign, both through the one modifier that engraves them.
      case 'tremolo': this.renderTremoloGhost(coords, tool.tremolo); return
      // The two valueless stamps carry nothing to preview: their ghost is the mark itself, and
      // WHICH note it lands on is resolved at click time.
      case 'tie': this.renderTieGhost(coords); return
      case 'dot': this.renderDotGhost(coords); return
      // The one stamp whose ghost carries a VALUE — the armed length, which is what a rest is.
      case 'rest': this.renderRestGhost(coords); return
      default: assertNeverTool(tool)
    }
  }

  /** Render the score with a colored paste caret following the cursor (armed paste). */
  renderPasteCaret(coords: { x: number; y: number }): void {
    this.renderScore() // census: attributed to its caller, like any plain renderScore
    this.highlight.drawPasteCaret(coords)
  }
}
