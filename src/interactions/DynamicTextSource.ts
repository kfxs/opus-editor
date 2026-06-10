import type { MusicEngine } from '../engine/MusicEngine'
import type { EditableTextSource } from './TextEditController'
import { DYNAMIC_TEXT_FONT, DYNAMIC_TEXT_SIZE } from '../engine/rendering/dynamicStyle'

/**
 * {@link EditableTextSource} for a custom-text (`kind:'text'`) dynamic. Bridges the
 * generic text editor to the dynamics model + renderer: seeds from `Dynamic.text`,
 * writes back via `engine.updateDynamic`, positions over the registry bbox, and
 * hides/restores the engraved glyph during the edit.
 */
export class DynamicTextSource implements EditableTextSource {
  readonly kind = 'dynamic' as const

  /** Screen rect captured at construction — i.e. BEFORE hideOriginal suppresses the
   *  glyph from the render. Once suppressed, the registry no longer has the mark's
   *  bbox, so we must snapshot it while it's still drawn. */
  private readonly screenRect: { x: number; y: number; width: number; height: number }

  constructor(
    readonly targetId: string,
    readonly isNew: boolean,
    private engine: MusicEngine,
    private getCanvas: () => HTMLElement | null,
    private render: () => void,
  ) {
    this.screenRect = this.computeScreenRect()
  }

  getText(): string {
    return this.engine.getDynamicById(this.targetId)?.text ?? ''
  }

  getScreenRect(): { x: number; y: number; width: number; height: number } {
    return this.screenRect
  }

  /**
   * Map the dynamic's SVG-space registry bbox to viewport (client) pixels via the
   * SVG's forward CTM. Scroll/zoom-correct — the score container scrolls
   * (`overflow-auto`), so a naive page-offset would drift (see plan §6). The overlay
   * is positioned `fixed`, so client coords are exactly what we need.
   */
  private computeScreenRect(): { x: number; y: number; width: number; height: number } {
    const empty = { x: 0, y: 0, width: 0, height: 0 }
    const el = this.engine.getElementRegistry().getByType('dynamic').find(e => e.id === this.targetId)
    const svg = this.getCanvas()?.querySelector('svg') as SVGSVGElement | null
    if (!el || !svg) return empty
    const ctm = svg.getScreenCTM()
    if (!ctm) return empty

    const p1 = svg.createSVGPoint()
    p1.x = el.bbox.x
    p1.y = el.bbox.y
    const p2 = svg.createSVGPoint()
    p2.x = el.bbox.x + el.bbox.width
    p2.y = el.bbox.y + el.bbox.height
    const s1 = p1.matrixTransform(ctm)
    const s2 = p2.matrixTransform(ctm)
    return { x: s1.x, y: s1.y, width: s2.x - s1.x, height: s2.y - s1.y }
  }

  /**
   * Match the engraving: same serif italic and size the renderer uses for custom
   * text. VexFlow interprets a numeric annotation size as points, so we mirror that
   * unit here (see VexFlowRenderer's ghost path).
   */
  getFontCSS(): { fontFamily: string; fontSize: string; fontStyle: string; color: string } {
    return {
      fontFamily: DYNAMIC_TEXT_FONT,
      fontSize: `${DYNAMIC_TEXT_SIZE}pt`,
      fontStyle: 'italic',
      color: '#000000',
    }
  }

  /**
   * Empty-text rule: a blank mark is meaningless. A *newly placed* one is deleted;
   * an *existing* one keeps its prior text (treated as cancel). Non-empty writes
   * through and re-renders (the engine's updateDynamic does not redraw on its own).
   */
  commit(text: string): void {
    const trimmed = text.trim()
    if (trimmed === '') {
      if (this.isNew) {
        this.engine.removeDynamic(this.targetId)
        this.render()
      }
      return
    }
    this.engine.updateDynamic(this.targetId, { text: trimmed })
    this.render()
  }

  /** Escape: a freshly placed (still-blank) mark leaves nothing behind; an existing
   *  mark is untouched. */
  cancel(): void {
    if (this.isNew) {
      this.engine.removeDynamic(this.targetId)
      this.render()
    }
  }

  /**
   * Remove / restore the engraved glyph by suppressing it from the render (the
   * renderer skips the suppressed dynamic), then re-rendering. Robust by
   * construction: the glyph simply isn't drawn, so there's no doubled text under
   * the overlay — no fragile DOM hiding. The overlay position is unaffected because
   * it uses the rect snapshotted at construction (before this suppression).
   */
  hideOriginal(hidden: boolean): void {
    this.engine.setSuppressedDynamicId(hidden ? this.targetId : null)
    this.render()
  }
}
