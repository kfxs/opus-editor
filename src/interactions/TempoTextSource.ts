import type { MusicEngine } from '../engine/MusicEngine'
import type { EditableTextSource } from './TextEditController'
import { MIN_BPM, MAX_BPM } from '../utils/tempoMap'

/**
 * Fallback font, used only if the engraved mark can't be measured (it always can in a real
 * browser). VexFlow resolves `StaveTempo.name` from its own Metrics — currently
 * `Bravura,Academico` bold — but we do NOT hardcode that: the real font is read off the
 * rendered `<text>` below, so this survives a VexFlow metrics change or a theme.
 */
const FALLBACK_FONT = { family: 'Academico, serif', size: '14pt', weight: 'bold', style: 'normal' }

/**
 * {@link EditableTextSource} for a {@link TempoMark}. The twin of {@link DynamicTextSource},
 * bridging the generic text editor to the tempo model + renderer.
 *
 * **What a double-click edits depends on the mark's visible face:**
 * - A mark with a WORD ('Allegro', 'Allegro (♩ = 120)') edits the **word**. `bpm`, `unit`
 *   and `dots` are left strictly untouched — renaming never moves the tempo (decision D2).
 *   That is what makes "Allegro" → "Allegro con brio" safe, and it is why `text` was
 *   modeled as free text rather than an enum in the first place.
 * - A mark with NO word (a bare `♩ = 120`) edits the **number** — the only text it shows.
 *   The typed value is parsed and validated; garbage or an out-of-range bpm is rejected
 *   (the edit is treated as a cancel) rather than silently producing a nonsense clock.
 *
 * ⚠️ **KNOWN ISSUE (open): the overlay still sits slightly too HIGH.** The two big causes are
 * fixed (see {@link findEditedTextNode} and {@link measureFont}), but a residual offset remains:
 * SVG text is positioned by its BASELINE, an HTML box by the TOP OF ITS LINE BOX, so `top =
 * inkTop` leaves the browser's internal leading above the glyph. The fix is to align the two
 * BASELINES (offset `top` by the HTML font's ascent), probably by adding a `baselineY` to
 * `EditableTextSource` so `DomTextEdit` corrects it once for dynamics and tempo alike.
 * See docs/tempo-marks-plan.md §8b.
 */
export class TempoTextSource implements EditableTextSource {
  readonly kind = 'tempo' as const

  /** True when this mark shows no word, so the editable face is its bpm number. */
  private readonly editsNumber: boolean

  /** Screen rect + font captured at construction — i.e. BEFORE hideOriginal suppresses the
   *  mark from the render. Once suppressed the mark is no longer in the DOM to measure, so
   *  both must be snapshotted while it is still drawn. (Same constraint as DynamicTextSource.) */
  private readonly screenRect: { x: number; y: number; width: number; height: number }
  private readonly font: { fontFamily: string; fontSize: string; fontStyle: string; fontWeight: string; color: string }

  constructor(
    readonly targetId: string,
    readonly isNew: boolean,
    private engine: MusicEngine,
    private getCanvas: () => HTMLElement | null,
    private render: () => void,
    private getZoom: () => number = () => 1,
  ) {
    const mark = this.engine.getTempoMarkById(targetId)
    this.editsNumber = !mark?.text
    // Measure the ENGRAVED mark itself rather than deriving anything: its <g> is in the
    // DOM (TempoLayout opens it with the mark's id), so the browser can tell us exactly
    // where it is painted and in what font. Both are then true by construction — no CTM
    // math to drift, no font constant to fall out of sync with VexFlow's Metrics.
    const group = this.engine.getTempoSVGGroup(targetId)
    const target = this.findEditedTextNode(group)
    this.screenRect = this.measureRect(target)
    this.font = this.measureFont(target)
  }

  /**
   * The ONE `<text>` node the overlay is editing — the word, or the digits.
   *
   * NOT the mark's whole `<g>`: that group also holds the metronome, whose notehead glyph
   * is engraved at a much larger font size (25 vs the word's ~14) and therefore reaches
   * HIGHER than the word does. Measuring the group would put the caret above the word,
   * on the notehead's line. (The registry bbox is the same whole-mark box — right for
   * hit-testing the mark, wrong for editing one word inside it.)
   *
   * Matched by content, so it holds for either editable face; falls back to the first
   * text node (StaveTempo paints the word first) if the match fails.
   */
  private findEditedTextNode(group: SVGGElement | null): SVGTextElement | null {
    if (!group || typeof getComputedStyle !== 'function') return null
    const texts = Array.from(group.querySelectorAll('text')) as SVGTextElement[]
    if (texts.length === 0) return null
    const wanted = this.getText().trim()
    return texts.find(t => (t.textContent ?? '').trim() === wanted) ?? texts[0]
  }

  /**
   * The painted box of that node, in viewport pixels. `getBoundingClientRect()` is already
   * client-space and already accounts for scroll, the SVG's CTM and the zoom transform —
   * exactly what the `position: fixed` overlay needs, with no CTM math to drift.
   */
  private measureRect(target: SVGTextElement | null): { x: number; y: number; width: number; height: number } {
    if (!target) return this.rectFromRegistry() // no DOM (tests) — best effort
    const r = target.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return this.rectFromRegistry()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }

  /**
   * The font the mark is ACTUALLY engraved in, read off its first `<text>` node. VexFlow
   * resolves it from Metrics (`StaveTempo.name` — bold, and in VexFlow's own text font),
   * so reading it back is the only way to guarantee the overlay matches. Computed style is
   * used, not the attributes, so an inherited font resolves too.
   */
  private measureFont(text: SVGTextElement | null): { fontFamily: string; fontSize: string; fontStyle: string; fontWeight: string; color: string } {
    // Read the font off the very node being edited — the word's, not the notehead glyph's
    // (which is a different, much larger font in the same group).
    if (!text) {
      return {
        fontFamily: FALLBACK_FONT.family,
        fontSize: `${parseFloat(FALLBACK_FONT.size) * this.getZoom()}pt`,
        fontStyle: FALLBACK_FONT.style,
        fontWeight: FALLBACK_FONT.weight,
        color: '#000000',
      }
    }
    const cs = getComputedStyle(text)
    // Zoom is a CSS `transform: scale()` on the score layer: it scales what is PAINTED but
    // not the computed font-size. The rect above (getBoundingClientRect) already includes
    // that scale; the font size does not — so it is the one thing we must scale by hand,
    // since the overlay is `position: fixed` and lives outside the zoomed layer.
    const px = parseFloat(cs.fontSize) || 14
    return {
      fontFamily: cs.fontFamily || FALLBACK_FONT.family,
      fontSize: `${px * this.getZoom()}px`,
      fontStyle: cs.fontStyle || FALLBACK_FONT.style,
      fontWeight: cs.fontWeight || FALLBACK_FONT.weight,
      color: '#000000',
    }
  }

  getText(): string {
    const mark = this.engine.getTempoMarkById(this.targetId)
    if (!mark) return ''
    return this.editsNumber ? String(mark.bpm ?? '') : (mark.text ?? '')
  }

  getScreenRect(): { x: number; y: number; width: number; height: number } {
    return this.screenRect
  }

  /** Fallback only: map the mark's SVG-space registry bbox into viewport pixels. */
  private rectFromRegistry(): { x: number; y: number; width: number; height: number } {
    const empty = { x: 0, y: 0, width: 0, height: 0 }
    const el = this.engine.getElementRegistry().getByType('tempo').find(e => e.id === this.targetId)
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

  /** The engraved mark's own font, snapshotted at construction (see {@link measureFont}). */
  getFontCSS(): { fontFamily: string; fontSize: string; fontStyle: string; fontWeight: string; color: string } {
    return this.font
  }

  /**
   * Persist the edit.
   *
   * Editing the NUMBER: a non-numeric or out-of-range value is rejected outright (kept as
   * it was) — a tempo of 0 is an infinite clock, and `updateTempoMark` would throw. Editing
   * the WORD: an empty word erases just the word, keeping the metronome, when there is a
   * number left to carry the mark's meaning; a mark left with neither word nor number is
   * meaningless, so it is removed (the dynamics empty-text rule, applied honestly).
   */
  commit(text: string): void {
    const trimmed = text.trim()
    const mark = this.engine.getTempoMarkById(this.targetId)
    if (!mark) return

    if (this.editsNumber) {
      const bpm = Number(trimmed)
      if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
        console.warn(`[Tempo] "${trimmed}" is not a bpm between ${MIN_BPM} and ${MAX_BPM} — edit discarded`)
        return
      }
      this.engine.updateTempoMark(this.targetId, { bpm })
      this.render()
      return
    }

    if (trimmed === '') {
      // No word left. Keep the mark only if its metronome still says something.
      if (mark.bpm !== undefined && mark.showMetronome) {
        this.engine.updateTempoMark(this.targetId, { text: undefined })
      } else {
        this.engine.removeTempoMark(this.targetId)
      }
      this.render()
      return
    }

    // The word, and ONLY the word — bpm/unit/dots are not in the update (decision D2).
    this.engine.updateTempoMark(this.targetId, { text: trimmed })
    this.render()
  }

  /** Escape: a freshly placed mark leaves nothing behind; an existing one is untouched. */
  cancel(): void {
    if (this.isNew) {
      this.engine.removeTempoMark(this.targetId)
      this.render()
    }
  }

  /** Suppress the engraved mark while the overlay is open, so there is no doubled text
   *  under it (the renderer skips a suppressed mark — no fragile DOM hiding). */
  hideOriginal(hidden: boolean): void {
    this.engine.setSuppressedTempoId(hidden ? this.targetId : null)
    this.render()
  }
}
