import type { MusicEngine } from '../engine/MusicEngine'
import type { EditableTextSource } from './TextEditController'
import { DYNAMIC_TEXT_FONT, DYNAMIC_TEXT_SIZE, DYNAMIC_GLYPH_SIZE } from '../engine/rendering/dynamicStyle'
import { dynamicLabel, splitDynamicRuns } from '../utils/dynamics'

/** Escape the few characters that matter when a run is placed into innerHTML (see
 *  {@link DynamicTextSource.getSeedHtml}). The SMuFL glyph codepoints are unaffected. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * {@link EditableTextSource} for ANY dynamic — level ('p'/'f'…) or custom text.
 * Bridges the generic text editor to the dynamics model + renderer: seeds from the
 * mark as painted (a level's glyph or the text), reads its engraved font off the DOM,
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
    /** Current view zoom. The overlay is `position: fixed` (screen space), so unlike the box —
     *  which scales for free via `getScreenCTM` — its font must be scaled by hand (§5.4). */
    private getZoom: () => number = () => 1,
    /** Optional override for the INITIAL editor text (the mount seed only). The Ctrl+E
     *  "insert dynamic on selection" flow passes `''` to open the overlay BLANK even though
     *  the freshly-placed mark carries a placeholder in the model — the placeholder only
     *  exists so the mark renders a real box to position the overlay against. Undefined ⇒
     *  seed from the model's own text (the double-click-an-existing-mark case). */
    private seedText?: string,
  ) {
    this.screenRect = this.computeScreenRect()
  }

  getText(): string {
    // `??` (not `||`) so an explicit '' override wins — a blank seed is intentional.
    if (this.seedText !== undefined) return this.seedText
    const d = this.engine.getDynamicById(this.targetId)
    // The text already holds the SMuFL glyph characters for its dynamic runs, so it IS the
    // seed — glyph chips + words verbatim. (`getSeedHtml` styles those runs; this plain string
    // is the fallback / the `textContent` the box reads back on commit.)
    return d ? dynamicLabel(d) : ''
  }

  /**
   * Pre-styled seed HTML for the box: each glyph run (`mp`, `f`) becomes an ATOMIC CHIP — a
   * `contenteditable="false"` span drawn at the big music size that reads as "this is a dynamic".
   * The caret can't enter a chip, so whatever you type lands beside it as ordinary editable text
   * at the box's base text size (see {@link getFontCSS}) — before, after, or between chips — with
   * no huge-text bleed. That is the model the user asked for: the dynamic is a fixed flagged token,
   * everything else is normal-size expression text.
   *
   * Returns null when there's no glyph run (pure text) or for the blank-seed override — the box
   * then seeds as plain text. `textContent` of this HTML equals {@link getText} (a chip's text IS
   * the SMuFL glyph), so commit reads the same string back verbatim.
   */
  getSeedHtml(): string | null {
    if (this.seedText !== undefined) return null
    const d = this.engine.getDynamicById(this.targetId)
    if (!d) return null
    const runs = splitDynamicRuns(dynamicLabel(d))
    if (!runs.some(r => r.glyph && r.text.trim() !== '')) return null // no glyph run → plain text

    return runs.map(r => {
      if (r.glyph) {
        const glyph = escapeHtml(r.text) // already the SMuFL glyph characters
        // contenteditable=false → the chip is atomic; the caret sits beside it, never within,
        // so text you type lands as ordinary base-size text before/after/between chips.
        return `<span contenteditable="false" style="font-size:${DYNAMIC_GLYPH_SIZE}pt;font-style:normal">${glyph}</span>`
      }
      // Words inherit the box's italic serif at the text size; NBSP keeps run-edge spaces
      // from collapsing in the contenteditable (commit normalizes NBSP back to a space).
      return escapeHtml(r.text).replace(/ /g, ' ')
    }).join('')
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
   * The box's BASE font: expression italic serif at the TEXT size, always — so anything you
   * TYPE comes out expression-sized. Glyph runs are made big by the spans in {@link getSeedHtml},
   * not by the box size, so a bare `f` and `f dolce` edit identically (the glyph big, words
   * small) instead of a bare `f` opening the whole box at glyph size. Bravura is appended as the
   * per-char fallback so glyph codepoints still draw (the serif face lacks them). VexFlow takes a
   * numeric annotation size as points, so we mirror that unit.
   */
  getFontCSS(): { fontFamily: string; fontSize: string; fontStyle: string; color: string } {
    return {
      fontFamily: `${DYNAMIC_TEXT_FONT}, Bravura`,
      fontSize: `${DYNAMIC_TEXT_SIZE * this.getZoom()}pt`,
      fontStyle: 'italic',
      color: '#000000',
    }
  }

  /**
   * Persist the box: store its text VERBATIM — glyph chips (SMuFL characters) stay glyphs, typed
   * text stays plain — so the played level (derived from the glyph runs on read) is preserved and
   * a typed letter is never promoted to a dynamic. NBSP (used to keep run-edge spaces in the styled
   * box) becomes a plain space. An empty box removes the mark. Re-renders (update/remove does not).
   */
  commit(text: string): void {
    const trimmed = text.replace(/\u00A0/g, ' ').trim()
    if (trimmed === '') {
      this.engine.removeDynamic(this.targetId)
      this.render()
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
