import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import { toolGhost, GHOST_CAUSE } from './toolGhost'
import { ELEMENT_SPECS } from './elements/chain'
import type { HighlightController } from './HighlightController'
import { voiceFillColor, voiceStrokeColor } from '../utils/voiceColors'
import { renderProbe } from '../engine/RenderProbe' // P0 instrument seam — temporary, see §8
import { musicFontReady } from '../engine/rendering/musicFontReady'
import type { MarkPreviewKind } from '../engine/rendering/markPreviewPass'

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

  /** Has the music font landed? Until it has, {@link renderScore} defers instead of engraving. */
  private fontReady = false
  /** The one deferred render, so N asks while the font decodes cost one render and not N. */
  private fontPending?: Promise<void>

  private applyHighlights(): void {
    // The passes that read the multi-selection SET (`selectedItems`), so they run whatever the
    // single-select element happens to be: the notes, the articulation groups, and every MARK a
    // box drags along with them (`interactions/enclosedMarks`).
    //
    // ⭐ Each of these paints the single-click selection of its kind TOO — one pass per kind, asked
    // "which ids of yours are selected?" (`HighlightController.selectedIdsOf`), so the ink of a
    // selected mark is painted in exactly one place however it came to be selected. The kind's row
    // in `ELEMENT_SPECS` is then only the EXTRA a single click earns: the anchor guide, the handles.
    this.highlight.applySelectionHighlight()
    this.highlight.applyArticulationHighlight()
    this.highlight.applyDynamicSelectionHighlight()
    this.highlight.applySlurSelectionHighlight()
    this.highlight.applyHairpinSelectionHighlight()
    this.highlight.applyTrillSelectionHighlight()
    this.highlight.applyOttavaSelectionHighlight()
    this.highlight.applyPedalSelectionHighlight()
    // ⭐ The pedal's DASHED TETHER is a set pass too (his report, 2026-08-21) — it is a picture of
    // WHICH `✻` closes which `Ped.`, not a handle, so every selected pedal gets one however it came
    // to be selected. ⚠️ Before `applySelectedElementHighlight`, so the endpoint squares of the one
    // a click picked land OVER the line.
    this.highlight.applyPedalTether()
    this.highlight.applyTempoSelectionHighlight()
    this.applySelectedElementHighlight()
    this.highlight.applyKeyboardCursor()
  }

  /**
   * Paint whatever the ONE selected element is — and nothing else.
   *
   * ⭐ **The exhaustiveness point.** This used to be thirteen unconditional calls, each re-reading
   * its own `selected*Id` field and returning immediately when that field was null; a fourteenth
   * element kind could be added, selected, and simply never drawn, with nothing to say so. It
   * became a `switch` with {@link assertNeverElement}, and is now a lookup in
   * {@link ELEMENT_SPECS} — a Record TOTAL over the union, so the guarantee is the same (a
   * fifteenth kind fails to BUILD until it says how it paints) and the answer now sits in the
   * kind's OWN module beside its hit-test, rather than in a switch here that has to be kept in
   * step with one over there (docs/modularity-plan-2026-07-28.md Phase 1).
   *
   * Only one row can run, so their order means nothing (it used to: thirteen fields could in
   * principle all be set). The rows that paint nothing new are deliberate, and say so where they
   * are written: a selected dynamic, slur or articulation already had its INK painted by the set
   * passes above, and what the element selection adds is the extra affordance — the anchor line,
   * the drag handles — that only the single-click selection gets.
   */
  private applySelectedElementHighlight(): void {
    const element = this.state.selectedElement
    if (!element) return
    ELEMENT_SPECS[element.kind].highlight(this.highlight)
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
    // ⭐⭐ **Nothing is ENGRAVED before the music font exists** — see
    // `engine/rendering/musicFontReady.ts` for the measurement. VexFlow has no metrics table: it
    // measures every glyph off a canvas, so a render that beats Bravura engraves to the FALLBACK
    // face and each empty bar's whole rest lands ~9.7px (about a staff space) left of its centre.
    //
    // ⛔ The gate belongs HERE and not at App's boot render, which is what the first attempt got
    //    wrong: the editor's real first render is not the one App asks for, it is `ViewportHost`'s
    //    MutationObserver noticing the SVG appear and calling back through `onViewChange` —
    //    measured at t=312ms against the font's t=410ms. This method is the ONE funnel every
    //    render in the app goes through, so it is the only place that can promise it.
    //
    // ⚠️ NOT a silent early return: the deferred call re-enters this method, so the render is
    //    postponed and never dropped. Coalesced on purpose — several renders can be asked for while
    //    the font decodes, and each would draw the same picture from the same state, so the one
    //    that runs afterwards is all of them.
    if (!this.fontReady) {
      this.fontPending ??= musicFontReady().then(() => {
        this.fontReady = true
        this.renderScore()
      })
      return
    }
    // P0 instrument (temporary): no cause given — the census recovers the call site from the
    // stack, which is the whole point: an edit and a selection both arrive through this method.
    renderProbe().setCause()

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
   * ⭐⭐ **ONE FRAME OF A MARK GESTURE — redraw the family that is moving, and nothing else**
   * (docs/render-performance-plan.md §12.5a, `engine/rendering/markPreviewPass`).
   *
   * The same shape `renderPreview` below already has, one level up: the engraved score and its
   * measure groups stay exactly as they are, and only the moving family's `<g>`s are swapped. The
   * census measured the alternative at ~11 ms a frame with **0% of bars re-engraved** — the music
   * never changed, so all of it went on re-deriving what was already on screen.
   *
   * ⛔ **Falls back to a real render rather than leaving the picture stale** when there is no usable
   * snapshot — the first frame of a gesture after a reload, say.
   *
   * ⚠️ No `clearGhosts` here, deliberately: a drag draws no cursor ghost, and that sweep is a
   * document-wide `querySelectorAll` over a dozen classes — exactly the kind of whole-score work
   * this method exists to stop paying.
   */
  previewMarks(kind: MarkPreviewKind, markId?: string): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!this.fontReady) { this.renderScore(); return }

    // The highlights' inverse has to run while the DOM it applies to is still standing — the same
    // reason `renderScore` takes them off first (a recolour left on a node we are about to remove
    // would strand its undo entry on a detached element).
    this.highlight.clearHighlights()
    if (!engine.previewMarks(kind, markId)) { this.renderScore(); return }
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
    renderProbe().setCause('ghost:note')
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
      // The armed entry tremolo rides ON the ghost note, for the armed tuplet's reason below: what
      // the click enters IS a note, and the mark is something that note wears. (The tremolo STAMP is
      // the other thing entirely — a marking tool, whose ghost is the mark with no note under it.)
      this.state.selectedTremolo ?? undefined,
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

  /**
   * Draw the preview for WHATEVER is armed, at `coords` — the single answer to "what does the next
   * click do?". A marking tool (clef / time signature / dynamic / tempo / the five stamps) previews
   * ITS mark and hides the keyboard cursor; with none armed it falls through to the ghost NOTE.
   *
   * Lives here, not in MouseController, because it is not a mouse gesture: it is a pure function of
   * `state`. The mouse calls it on every move — but so does PaletteController the moment a tool is
   * armed, which is what makes the ghost appear immediately on the keypress instead of waiting for
   * the pointer to twitch. That symmetry is the whole point: arming and hovering must show the same
   * thing, so they must go through the same function.
   *
   * ⚠️ What is left here is the part that is the CONTROLLER's: hide the cursor, ask the census what
   * this render was for, and make sure the score under the overlay is current before drawing on it.
   * WHICH glyph is {@link toolGhost}'s answer and HOW it is drawn is `GHOST_DRAWERS`'s — this used
   * to be a twelve-case switch over eleven `render*Ghost` methods of my own, each forwarding to a
   * one-liner on `MusicEngine` and another on `VexFlowRenderer`
   * (docs/modularity-plan-2026-07-28.md Phase 2).
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
    // of them, including the two that then draw nothing.
    this.state.showCursor = false

    const ghost = toolGhost(tool, { duration: this.state.selectedDuration, dots: this.state.selectedDots })
    // A tool with no preview (the click-to-type entry tools) draws nothing AND skips the repaint —
    // the blue cursor is the signal, and there is nothing to put on the page.
    if (!ghost) return

    const engine = this.getEngine()
    if (!engine) return
    renderProbe().setCause(GHOST_CAUSE[ghost.kind])
    this.ensureScoreDrawn(engine)
    engine.renderScoreWithToolGhost(coords, ghost)
  }
}
