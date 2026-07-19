import type { MusicEngine } from '../engine/MusicEngine'
import type { EditableTextSource } from './TextEditController'
import { parseTempoText } from '../utils/tempoText'
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
 * **A double-click edits the WHOLE mark as one string** — `Allegro (♩ = 144)` — and the model is
 * READ BACK OUT of what you typed (`utils/tempoText`). That is how Sibelius works, and it is the
 * only version that isn't a lie: the number you can see is the number that plays. Retype 144 as
 * 120 and the score plays at 120; delete the metronome and the mark stops stating a speed; type
 * a word beside it and it keeps its number.
 *
 * The alternative — one editable "face" per double-click, word or number — was tried and thrown
 * out: it can't express `Allegro` → `Allegro (♩ = 144)` (adding a metronome that wasn't there),
 * and it makes the mark feel like a form rather than a piece of text.
 *
 * Placing the overlay takes three measurements off the ENGRAVED mark, all snapshotted at
 * construction while it is still drawn (once {@link hideOriginal} runs, it is gone from the
 * render and there is nothing left to measure): where it sits, the font it is painted in
 * ({@link measureFont}), and its BASELINE ({@link measureBaseline}) — the last because SVG text
 * hangs off its baseline while an HTML box hangs off the top of its line box, so aligning tops
 * leaves the browser's leading wedged in between.
 */
export class TempoTextSource implements EditableTextSource {
  readonly kind = 'tempo' as const

  private readonly screenRect: { x: number; y: number; width: number; height: number }
  private readonly font: { fontFamily: string; fontSize: string; fontStyle: string; fontWeight: string; color: string }
  private readonly baselineY: number | undefined

  constructor(
    readonly targetId: string,
    readonly isNew: boolean,
    private engine: MusicEngine,
    private getCanvas: () => HTMLElement | null,
    private render: () => void,
    private getZoom: () => number = () => 1,
    /** Optional override for the INITIAL editor text (mount seed only). The Ctrl+Alt+T "insert
     *  tempo" flow passes `''` to open the box BLANK even though the freshly-placed mark carries a
     *  placeholder in the model — the placeholder only exists so the mark renders a measurable box.
     *  Undefined ⇒ seed from the model's own text (the double-click-an-existing-mark case). */
    private seedText?: string,
  ) {
    // Measure the ENGRAVED mark itself rather than deriving anything: its <g> is in the DOM
    // (TempoLayout opens it with the mark's id), so the browser can tell us exactly where it is
    // painted and in what font. Both are then true by construction — no CTM math to drift, no
    // font constant to fall out of sync with VexFlow's Metrics.
    const group = this.engine.getTempoSVGGroup(targetId)
    const anchor = this.textPiece(group)
    this.screenRect = this.measureRect(group, anchor)
    this.font = this.measureFont(anchor)
    this.baselineY = this.measureBaseline(anchor)
  }

  /**
   * The `<text>` node the overlay's TEXT is measured against — its font and its baseline.
   *
   * `StaveTempo` paints the mark as a row of separate nodes (`Allegro`, `(`, `♩`, `=`, `144`,
   * `)`), and the notehead among them is NOT one of them for this purpose: it is engraved in the
   * music font at a much larger size, so its box reaches higher up the page and its font is not
   * the font the words are set in. Measuring it — or the group, which it dominates — floats the
   * caret above the text and sizes it wrong. So we take the first node that is real text: any
   * node but the glyph.
   */
  private textPiece(group: SVGGElement | null): SVGTextElement | null {
    if (!group || typeof getComputedStyle !== 'function') return null
    const texts = Array.from(group.querySelectorAll('text')) as SVGTextElement[]
    if (texts.length === 0) return null
    // The glyph nodes are the ones VexFlow fills with a SMuFL codepoint (Private Use Area);
    // every other node is a word, a digit, a paren or an '='.
    const isGlyph = (t: SVGTextElement) => /[\uE000-\uF8FF]/.test(t.textContent ?? '')
    return texts.find(t => !isGlyph(t)) ?? texts[0]
  }

  /**
   * Where the overlay goes: the mark's LEFT edge (it replaces the whole mark, so it starts where
   * the mark starts), on the text's own line. `getBoundingClientRect()` is already client-space
   * and already accounts for scroll, the SVG's CTM and the zoom transform — exactly what the
   * `position: fixed` overlay needs, with no CTM math to drift.
   */
  private measureRect(
    group: SVGGElement | null,
    anchor: SVGTextElement | null,
  ): { x: number; y: number; width: number; height: number } {
    if (!group || !anchor || typeof group.getBoundingClientRect !== 'function') return this.rectFromRegistry()
    const whole = group.getBoundingClientRect()
    const text = anchor.getBoundingClientRect()
    if (whole.width === 0 && whole.height === 0) return this.rectFromRegistry()
    // x/width from the whole mark; y/height from the text line inside it — the mark's own box is
    // taller than its text, because the notehead glyph is engraved larger than the words.
    return { x: whole.x, y: text.y, width: whole.width, height: text.height }
  }

  /**
   * The screen Y the engraved text is SITTING ON. VexFlow emits `<text x y>` with the default
   * alphabetic baseline, so the node's own `y` — pushed through its screen CTM, which folds in
   * scroll and the zoom transform — is the baseline, in the same viewport pixels the `fixed`
   * overlay is positioned in. `undefined` outside a real browser: the overlay then falls back
   * to top-alignment (see {@link EditableTextSource.getBaselineY}).
   */
  private measureBaseline(anchor: SVGTextElement | null): number | undefined {
    if (!anchor || typeof anchor.getScreenCTM !== 'function' || typeof DOMPoint !== 'function') return undefined
    const ctm = anchor.getScreenCTM()
    if (!ctm) return undefined
    const y = anchor.y?.baseVal?.numberOfItems ? anchor.y.baseVal.getItem(0).value : 0
    const x = anchor.x?.baseVal?.numberOfItems ? anchor.x.baseVal.getItem(0).value : 0
    return new DOMPoint(x, y).matrixTransform(ctm).y
  }

  /** The engraved text's baseline, snapshotted at construction (see {@link measureBaseline}). */
  getBaselineY(): number | undefined {
    return this.baselineY
  }

  /**
   * The font the mark is ACTUALLY engraved in, read off a text node. VexFlow resolves it from
   * Metrics (`StaveTempo.name` — bold, and in VexFlow's own text font), so reading it back is the
   * only way to guarantee the overlay matches. Computed style is used, not the attributes, so an
   * inherited font resolves too.
   */
  private measureFont(anchor: SVGTextElement | null): { fontFamily: string; fontSize: string; fontStyle: string; fontWeight: string; color: string } {
    if (!anchor) {
      return {
        fontFamily: FALLBACK_FONT.family,
        fontSize: `${parseFloat(FALLBACK_FONT.size) * this.getZoom()}pt`,
        fontStyle: FALLBACK_FONT.style,
        fontWeight: FALLBACK_FONT.weight,
        color: '#000000',
      }
    }
    const cs = getComputedStyle(anchor)
    // Zoom is a CSS `transform: scale()` on the score layer: it scales what is PAINTED but not
    // the computed font-size. The rect above (getBoundingClientRect) already includes that scale;
    // the font size does not — so it is the one thing we must scale by hand, since the overlay is
    // `position: fixed` and lives outside the zoomed layer.
    const px = parseFloat(cs.fontSize) || 14
    return {
      fontFamily: cs.fontFamily || FALLBACK_FONT.family,
      fontSize: `${px * this.getZoom()}px`,
      fontStyle: cs.fontStyle || FALLBACK_FONT.style,
      fontWeight: cs.fontWeight || FALLBACK_FONT.weight,
      color: '#000000',
    }
  }

  /** The mark IS its text — no formatting step, nothing to drift. `??` (not `||`) so an explicit
   *  '' seed override wins: a blank box for the "type your own tempo" flow is intentional. */
  getText(): string {
    return this.seedText ?? this.engine.getTempoMarkById(this.targetId)?.text ?? ''
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
   * Persist the edit: read the typed string back into the mark (`parseTempoText` owns the rules —
   * including the one about not letting an edit delete a metronome it couldn't see).
   *
   * A string that says NOTHING removes the mark (a blank mark is meaningless — the dynamics rule,
   * applied honestly). A string whose metronome carries a nonsense number is rejected outright
   * and the mark left as it was: `♩ = 0` is an infinite clock, and `updateTempoMark` would throw.
   */
  commit(text: string): void {
    const mark = this.engine.getTempoMarkById(this.targetId)
    if (!mark) return

    const parsed = parseTempoText(text, mark)

    if (!parsed.ok) {
      if (parsed.reason === 'empty') {
        this.engine.removeTempoMark(this.targetId)
        this.render()
      } else {
        console.warn(`[Tempo] "${text}" — bpm must be between ${MIN_BPM} and ${MAX_BPM}; edit discarded`)
      }
      return
    }

    // The string is stored AS TYPED (bar a shorthand unit becoming its glyph); unit/dots/bpm are
    // what playback reads, parsed back out of it. Nothing re-composes the string, so nothing can
    // lose the brackets you deleted or the words you put after the number.
    this.engine.updateTempoMark(this.targetId, {
      text: parsed.text,
      unit: parsed.unit,
      dots: parsed.dots,
      bpm: parsed.bpm,
    })
    this.render()
  }

  /** Escape: a freshly placed mark leaves nothing behind; an existing one is untouched. */
  cancel(): void {
    if (this.isNew) {
      this.engine.removeTempoMark(this.targetId)
      this.render()
    }
  }

  /** Suppress the engraved mark while the overlay is open — the overlay shows the WHOLE mark, so
   *  the whole mark comes off the page or the two would be drawn on top of each other. (The
   *  renderer skips a suppressed mark; no fragile DOM hiding.) */
  hideOriginal(hidden: boolean): void {
    this.engine.setSuppressedTempoId(hidden ? this.targetId : null)
    this.render()
  }
}
