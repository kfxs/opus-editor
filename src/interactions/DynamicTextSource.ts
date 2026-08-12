import type { MusicEngine } from '../engine/MusicEngine'
import type { EditableTextSource, TextEditInsert, TextEditInsertion } from './TextEditController'
import type { MenuItem } from '../menus/MenuItem'
import { buildExpressionMenu } from '../menus/expressionMenu'
import { DYNAMIC_TEXT_FONT, DYNAMIC_TEXT_SIZE, DYNAMIC_GLYPH_SIZE } from '../engine/rendering/dynamicStyle'
import { dynamicLabel, levelToGlyphString, splitDynamicRuns } from '../utils/dynamics'

/** Escape the few characters that matter when a run is placed into innerHTML (see
 *  {@link DynamicTextSource.getSeedHtml}). The SMuFL glyph codepoints are unaffected. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * How much bigger the music glyph is than the words beside it. **A RATIO, not a size** — and that
 * is the point: the chip is the only thing in the box with a font of its own, so if it carried an
 * absolute size it would need to know about zoom as well, and the two would drift.
 *
 * They did. The chip was `${DYNAMIC_GLYPH_SIZE}pt` flat while {@link DynamicTextSource.getFontCSS}
 * scaled the box by zoom, so at the editor's default 0.7 the glyph came up at 30pt against 9.8pt
 * text — a 3:1 ratio where the engraving uses 2.1:1, i.e. a huge `f`. Past zoom 1.0 it inverted and
 * the glyph came up too small.
 *
 * In `em` the chip is *relative to whatever the box is set to*, so zoom is decided in exactly one
 * place ({@link DynamicTextSource.getFontCSS}) and this expresses the engraving relationship
 * instead of a second absolute number to keep in step. Derived from the two constants rather than
 * written as 2.14, so changing either still yields the right proportion.
 *
 * (`TempoTextSource` never hit this: a tempo mark's note glyph is the SAME size as its digits, so
 * it inserts as ordinary text and inherits the box's font. Nothing sized on its own, nothing to
 * drift. The chip exists here only because a dynamic mixes two sizes in one box.)
 */
const GLYPH_EM = DYNAMIC_GLYPH_SIZE / DYNAMIC_TEXT_SIZE

/**
 * One glyph run as an ATOMIC CHIP: a `contenteditable="false"` span at the big music size.
 * The caret can't enter it, so it behaves as a single flagged token — the same markup whether
 * it arrives by seeding an existing mark or by a Ctrl-key insertion, which is what lets a chip
 * typed in the editor read back identically to one loaded from the model.
 */
function glyphChipHtml(glyph: string): string {
  // ⚠️⚠️ **`line-height: 0` is load-bearing, not cosmetic.** An inline box's height is its
  // line-height, but its POSITION about the baseline is computed from its own font's ascent — so a
  // 2.14em chip in a 15px line still reaches ~5px higher than the words beside it, growing the line
  // box and pushing its baseline down. That is the mark visibly dropping when a glyph goes in, and
  // it survives pinning the line-height on the box (measured: h 15 → 20, baseline down 2.7px). At
  // zero the chip contributes no height at all and simply overflows, which is what an oversized
  // glyph should do — the line is the words', and the glyph hangs off it.
  return `<span contenteditable="false" style="font-size:${GLYPH_EM}em;font-style:normal;line-height:0">${escapeHtml(glyph)}</span>`
}

/**
 * Keys that stamp a dynamics glyph into the editor at the caret: Ctrl+<letter> ⇒ that letter in
 * the *dynamic font* (Ctrl+F ⇒ 𝆑), never the ASCII one — a typed ASCII `f` is silent by design
 * (see utils/dynamics, which owns the letter⇄codepoint table: U+E520–E525 for `p m f r s z`, plus
 * `n` for niente, which VexFlow's own table omits though Bravura has the glyph).
 * Combine them to spell `pp`, `sfz`, `rf`, … The palette in menus/expressionMenu.ts offers the same
 * set by name, and its rows echo these bindings — keep the two in step.
 *
 * `z` is the odd one out, and Sibelius hit the same wall: plain Ctrl+Z is Undo while typing, so
 * Sibelius binds the z glyph to Ctrl+Shift+Z — which is what we use too, matching it exactly.
 * The cost is the contenteditable's native text-REDO inside an open dynamic editor; the score's
 * own Ctrl+Shift+Z redo is untouched, since these keys are read only by {@link DomTextEdit} while
 * the overlay holds focus and ShortcutManager's isInInput guard already stands down there.
 * (rpmseattle.com/of_note "Enter and Edit Dynamics as Music text characters".)
 *
 * One row per glyph — extend here, not at the call site.
 */
const DYNAMIC_INSERT_KEYS: ReadonlyArray<{ key: string; shift?: boolean; alt?: boolean; glyph?: string; word?: string }> = [
  { key: 'f', glyph: 'f' },
  { key: 'p', glyph: 'p' },
  { key: 'm', glyph: 'm' },
  { key: 'n', glyph: 'n' }, // niente — the letter we add ourselves (see utils/dynamics)
  { key: 'r', glyph: 'r' },
  { key: 's', glyph: 's' },
  // Ctrl+Shift+Z — see the note above on why this one isn't a bare Ctrl+Z.
  { key: 'z', shift: true, glyph: 'z' },
  // The two WORDS Sibelius gives keys of their own, on its bindings. Not glyphs: they insert as
  // ordinary prose, so they never change the played level. Both are live Chrome shortcuts
  // (Ctrl+Shift+C is the DevTools inspector, Ctrl+Shift+D bookmarks all tabs) — but neither is in
  // Chrome's RESERVED set, so preventDefault genuinely suppresses them, unlike Ctrl+Shift+T.
  { key: 'c', shift: true, word: 'cresc.' },
  { key: 'd', shift: true, word: 'dim.' },
]

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

  /** The engraved mark's own text BASELINE, snapshotted beside the rect — see
   *  {@link DynamicTextSource.measureBaseline}. */
  private readonly baselineY: number | undefined

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
    this.baselineY = this.measureBaseline()
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
      // r.text is already the SMuFL glyph characters. contenteditable=false → the chip is
      // atomic; the caret sits beside it, never within, so text you type lands as ordinary
      // base-size text before/after/between chips.
      if (r.glyph) return glyphChipHtml(r.text)
      // Words inherit the box's italic serif at the text size; NBSP keeps run-edge spaces
      // from collapsing in the contenteditable (commit normalizes NBSP back to a space).
      return escapeHtml(r.text).replace(/ /g, ' ')
    }).join('')
  }

  /**
   * The expression palette (menus/expressionMenu.ts): a dynamics column and a words column.
   * Words go in as ordinary italic prose and never touch playback; dynamics go in as the same
   * atomic glyph chip a Ctrl+<letter> makes, so a mark placed from the menu is indistinguishable
   * from one typed — same markup, same read-back, same played level.
   */
  getContextMenu(insert: TextEditInsert): MenuItem[] {
    return buildExpressionMenu({
      text: word => insert.text(word),
      dynamic: letters => insert.html(glyphChipHtml(levelToGlyphString(letters))),
    })
  }

  /** Ctrl+<key> ⇒ insert a glyph chip, or a word, at the caret (see {@link DYNAMIC_INSERT_KEYS}). */
  getInsertions(): TextEditInsertion[] {
    return DYNAMIC_INSERT_KEYS.map(({ key, shift, alt, glyph, word }) => ({
      key,
      ctrl: true,
      shift,
      alt,
      html: glyph ? glyphChipHtml(levelToGlyphString(glyph)) : escapeHtml(word ?? ''),
    }))
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
   * ⭐⭐ **The screen Y the engraved mark SITS ON**, so the overlay can put its own text on the same
   * line instead of merely starting in the same place. The tempo editor has always done this
   * ({@link TempoTextSource.measureBaseline}); the dynamic editor did not, and the difference shows
   * the moment the box holds something taller than its base font.
   *
   * ⚠️ **The bug it fixes, since it is not obvious from the code.** Without a baseline the overlay is
   * TOP-aligned, on the registry box — which for a level mark is `baseline − DYNAMIC_GLYPH_INK_ABOVE`.
   * Inside the box the browser then puts the first line's baseline wherever the tallest thing on that
   * line demands: typed words (14pt) land near the top and look right, but the moment a glyph CHIP
   * (2.14em) joins them the line box grows and the baseline — with everything on it — drops ~20px.
   * So the mark you were typing MOVED as you typed it, and did not match a normally-entered one.
   * Reported 2026-08-12. Aligning on the baseline makes the box's own height irrelevant.
   *
   * A dynamic is ONE `<text>` node (its glyph runs are `<tspan>`s that keep the node's baseline —
   * `applyMixedDynamicRuns`), so unlike a tempo mark there is no choosing between pieces. The node's
   * own `y`, pushed through its screen CTM, folds in scroll, the zoom transform, the staff's scale
   * AND the dynamics-line translate. `undefined` outside a real browser — the overlay then falls
   * back to top-alignment, as before.
   */
  private measureBaseline(): number | undefined {
    const group = this.engine.getDynamicSVGGroup(this.targetId)
    const text = group?.querySelector?.('text') as SVGTextElement | null
    if (!text || typeof text.getScreenCTM !== 'function' || typeof DOMPoint !== 'function') return undefined
    const ctm = text.getScreenCTM()
    if (!ctm) return undefined
    const y = text.y?.baseVal?.numberOfItems ? text.y.baseVal.getItem(0).value : 0
    const x = text.x?.baseVal?.numberOfItems ? text.x.baseVal.getItem(0).value : 0
    return new DOMPoint(x, y).matrixTransform(ctm).y
  }

  /** The engraved baseline, snapshotted at construction (see {@link measureBaseline}). */
  getBaselineY(): number | undefined {
    return this.baselineY
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
