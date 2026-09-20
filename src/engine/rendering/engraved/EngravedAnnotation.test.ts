// @vitest-environment jsdom
/**
 * A text annotation of ours (S12g) — the dynamics'. ⚠️ That it draws, stacks and is read back exactly
 * as before was proved on the page (`docs/history/vexflow-removal-map.md` S12g); its placement is pinned in
 * `engrave/notes/annotationPlacement.test.ts`. Pinned here is the contract its readers rely on.
 */
import { describe, it, expect } from 'vitest'
import { EngravedAnnotation } from './EngravedAnnotation'
import { ANNOTATION_ALIGN } from '@/engine/engrave/notes/annotationPlacement'

describe('EngravedAnnotation', () => {
  it('reads back the justification it was given', () => {
    const text = new EngravedAnnotation('mf')
    text.setVerticalJustification('above')
    text.setJustification(ANNOTATION_ALIGN.RIGHT)
    expect(text.getSide()).toBe('top')
    expect(text.getAlign()).toBe('right')
    text.setVerticalJustification('below')
    text.setJustification(ANNOTATION_ALIGN.CENTER_STEM)
    expect(text.getSide()).toBe('bottom')
    expect(text.getAlign()).toBe('centerStem')
  })

  it('⭐ is still filed as an Annotation — the modifier context buckets by category', () => {
    expect(new EngravedAnnotation('p').getCategory()).toBe('Annotation')
  })

  it('⭐ lays a face over the category default, field by field — the object the painter is handed', () => {
    const text = new EngravedAnnotation('dolce')
    expect(text.fontInfo).toEqual({ family: 'Bravura,Academico', size: 10, weight: 'normal', style: 'normal' })
    text.setFont({ family: 'Georgia', size: 16, style: 'italic' })
    expect(text.fontInfo).toEqual({ family: 'Georgia', size: 16, weight: 'normal', style: 'italic' })
  })

  it('⚠️ keeps a WRITTEN width (a dynamic buys no room) until its face changes', () => {
    const text = new EngravedAnnotation('p')
    text.setWidth(0)
    expect(text.getWidth()).toBe(0)
    expect(text.getBoundingBox().getW()).toBe(0)
    text.setWidth(12).setFont({ size: 20 })
    expect(text.getWidth()).not.toBe(12)
  })
})
