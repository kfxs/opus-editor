/**
 * ⭐ **A TEXT ANNOTATION OF OURS** — S9f of `docs/vexflow-removal-map.md` gave it readers for its
 * justification; ⭐ **S12g made it ours**: no longer VexFlow's `Annotation`. In this editor the
 * annotations are the DYNAMICS (`./DynamicsLayout.buildDynamicAnnotation`).
 *
 * It keeps the modifier contract (`./EngravedModifier`) and what `Annotation` added:
 *
 *  - the TEXT and its FACE — `Element.setFont(object)`: the category's default face (the root music
 *    face at `Annotation.fontSize`, 10) with the given one laid over it; the object is handed to the
 *    painter exactly as VexFlow handed it;
 *  - its two JUSTIFICATIONS, VexFlow's numbers (`engrave/notes/annotationPlacement`);
 *  - its WIDTH: the text measured in its face, unless WRITTEN — a dynamic's is set to 0 so it buys no
 *    room; VexFlow kept a written width until the face changed, so {@link setFont} drops it;
 *  - its PLACEMENT — `Annotation.draw` transcribed as `engrave/notes/annotationPlacement`;
 *  - its INK: `openGroup('annotation', id)`, the face set, the text filled at its point (`renderText`).
 *
 * ⚠️ **`getSVGElement` is kept, and answers the group THIS annotation opened** — seven layout passes and
 * the highlight read the drawn text back through it (the dynamics' DOM-box reads). VexFlow looked it up
 * by id across the whole DOCUMENT; the handle is the same live node (no pass clones the page), without
 * the lookup.
 */
import type { EngravedNote } from './EngravedNote'
import type { DrawGroup } from '@/engine/paint/DrawGroup'
import type { AnnotationAlign, AnnotationSide } from '@/engine/engrave/notes/annotationStack'
import { ANNOTATION_ALIGN, ANNOTATION_SIDE, placeAnnotation } from '@/engine/engrave/notes/annotationPlacement'
import { ANNOTATION_FONT_SIZE_PT, MUSIC_FONT_STACK } from '@/engine/engrave/inheritedFonts'
import { textRowBelowY, staffLineY } from '@/engine/engrave/staff/staffFrame'
import { measureTextMetrics } from './glyphPainter'
import { fontSizeToPx } from './drawnFontSize'
import { requireNoteFrame } from './staveFrame'
import { noteRuler } from './noteRuler'
import { drawGroupOf, svgNode } from './svgDrawGroup'
import { EngravedModifier, MODIFIER_POSITION, type ModifierMetrics } from './EngravedModifier'

/** An annotation's face — `Element`'s `FontInfo`, the four fields in the order VexFlow merges them. */
export interface AnnotationFont {
  family: string
  size: number | string
  weight: string
  style: string
}

/** The face an annotation has until one is set — the `Annotation` row over the root (`metrics.js:62–66,79`). */
const DEFAULT_FONT: AnnotationFont = { family: MUSIC_FONT_STACK, size: ANNOTATION_FONT_SIZE_PT, weight: 'normal', style: 'normal' }

const ALIGN_OF: Readonly<Record<number, AnnotationAlign>> = {
  [ANNOTATION_ALIGN.LEFT]: 'left',
  [ANNOTATION_ALIGN.CENTER]: 'center',
  [ANNOTATION_ALIGN.RIGHT]: 'right',
  [ANNOTATION_ALIGN.CENTER_STEM]: 'centerStem',
}
const ALIGN_OF_STRING: Readonly<Record<string, number>> = { left: ANNOTATION_ALIGN.LEFT, center: ANNOTATION_ALIGN.CENTER, right: ANNOTATION_ALIGN.RIGHT, centerStem: ANNOTATION_ALIGN.CENTER_STEM }
const SIDE_OF_STRING: Readonly<Record<string, number>> = { above: ANNOTATION_SIDE.TOP, top: ANNOTATION_SIDE.TOP, below: ANNOTATION_SIDE.BOTTOM, bottom: ANNOTATION_SIDE.BOTTOM, center: ANNOTATION_SIDE.CENTER, centerStem: ANNOTATION_SIDE.CENTER_STEM }

export class EngravedAnnotation extends EngravedModifier {
  static override get CATEGORY(): string {
    return 'Annotation'
  }

  private readonly text: string
  private font: AnnotationFont = { ...DEFAULT_FONT }
  private horizontal: number = ANNOTATION_ALIGN.CENTER
  private vertical: number = ANNOTATION_SIDE.TOP
  /** A width written over the measured one — see the header. Dropped by {@link setFont}. */
  private widthOverride: number | null = null
  /** The group the last draw opened — see the header. */
  private group: DrawGroup | null = null

  constructor(text: string) {
    super()
    this.text = text
  }

  getText(): string {
    return this.text
  }

  /** The face, as handed to the painter — `Element.fontInfo`. */
  get fontInfo(): AnnotationFont {
    return this.font
  }

  /** `Element.setFont(object)`: the default face with `font` laid over it. Drops a written width. */
  setFont(font: Partial<AnnotationFont>): this {
    this.font = { ...DEFAULT_FONT, ...font }
    this.widthOverride = null
    return this
  }

  setJustification(just: number | string): this {
    this.horizontal = typeof just === 'string' ? ALIGN_OF_STRING[just] : just
    return this
  }

  setVerticalJustification(just: number | string): this {
    this.vertical = typeof just === 'string' ? SIDE_OF_STRING[just] : just
    return this
  }

  /** How the text sits along its note. */
  getAlign(): AnnotationAlign {
    return ALIGN_OF[this.horizontal]
  }

  /** Which side of the note it stands on. */
  getSide(): AnnotationSide {
    if (this.vertical === ANNOTATION_SIDE.TOP) return 'top'
    if (this.vertical === ANNOTATION_SIDE.BOTTOM) return 'bottom'
    return 'other'
  }

  private measured() {
    return measureTextMetrics('Annotation', this.text, this.font)
  }

  getWidth(): number {
    return this.widthOverride ?? this.measured().width
  }

  setWidth(width: number): this {
    this.widthOverride = width
    return this
  }

  protected inkMetrics(): ModifierMetrics {
    const { ascent, descent } = this.measured()
    return { width: this.getWidth(), ascent, descent }
  }

  /** The group the last draw opened, as a DOM node — see the header. */
  getSVGElement(): SVGGElement | undefined {
    return svgNode(this.group)
  }

  /** ⭐ **OURS** — `Annotation.draw`: where the text stands (`engrave/notes/annotationPlacement`), then its ink. */
  draw(): void {
    const ctx = this.checkContext()
    const note = this.checkAttachedNote() as EngravedNote
    this.setRendered()
    const frame = requireNoteFrame(note)
    const ruler = noteRuler(note)
    const { x, y } = placeAnnotation({
      align: this.horizontal,
      side: this.vertical,
      textLine: this.textLine,
      textWidth: this.getWidth(),
      textHeight: fontSizeToPx(this.font.size),
      // ⚠️ ABOVE, whatever the side — VexFlow asks every annotation for that point.
      startX: note.getModifierStartXY(MODIFIER_POSITION.ABOVE, this.checkIndex()).x,
      stemX: ruler.stemX,
      hasStem: ruler.hasStem,
      stemDirection: ruler.hasStem ? ruler.stemDirection : 1,
      stemTopY: ruler.stemTipY,
      stemBaseY: ruler.stemBaseY,
      staffSpace: frame.spacePx,
      topLineY: staffLineY(frame, 0),
      headYs: ruler.headYs,
      noteTopTextY: () => note.getYForTopText(this.textLine),
      staveBottomTextY: () => textRowBelowY(frame, this.textLine),
    })
    this.x = x
    this.y = y
    // `openGroup('annotation', id)` + `renderText(ctx, 0, 0)`: the face, then the text at its point.
    this.group = drawGroupOf(ctx.openGroup('annotation', this.getAttribute('id')))
    ctx.setFont(this.font)
    ctx.fillText(this.text, this.x + this.xShift, this.y + this.yShift)
    ctx.closeGroup()
  }
}
