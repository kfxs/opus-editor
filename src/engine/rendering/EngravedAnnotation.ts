/**
 * ⭐ **A TEXT ANNOTATION WHOSE JUSTIFICATION WE CAN READ** — S9f of `docs/vexflow-removal-map.md`.
 *
 * VexFlow keeps an annotation's horizontal and vertical justification `protected`, and the column rule
 * that is ours now (`engrave/notes/annotationStack`, run by `./modifierColumns`) needs both. ⛔ This
 * class adds two readers and nothing else: construction, category (it inherits `Annotation`'s static
 * `CATEGORY`, so the modifier context still files it as an `Annotation`), drawing and font are VexFlow's.
 * The dynamics are built as one (`./DynamicsLayout.buildDynamicAnnotation`).
 */
import { Annotation } from 'vexflow'
import type { AnnotationAlign, AnnotationSide } from '@/engine/engrave/notes/annotationStack'

const ALIGN_OF: Readonly<Record<number, AnnotationAlign>> = {
  [Annotation.HorizontalJustify.LEFT]: 'left',
  [Annotation.HorizontalJustify.CENTER]: 'center',
  [Annotation.HorizontalJustify.RIGHT]: 'right',
  [Annotation.HorizontalJustify.CENTER_STEM]: 'centerStem',
}

export class EngravedAnnotation extends Annotation {
  /** How the text sits along its note. */
  getAlign(): AnnotationAlign {
    return ALIGN_OF[this.horizontalJustification]
  }

  /** Which side of the note it stands on. */
  getSide(): AnnotationSide {
    if (this.verticalJustification === Annotation.VerticalJustify.TOP) return 'top'
    if (this.verticalJustification === Annotation.VerticalJustify.BOTTOM) return 'bottom'
    return 'other'
  }
}
