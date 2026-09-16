// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Annotation } from 'vexflow'
import { EngravedAnnotation } from './EngravedAnnotation'

describe('EngravedAnnotation', () => {
  it('reads back the justification it was given', () => {
    const text = new EngravedAnnotation('mf')
    text.setVerticalJustification('above')
    text.setJustification(Annotation.HorizontalJustify.RIGHT)
    expect(text.getSide()).toBe('top')
    expect(text.getAlign()).toBe('right')
    text.setVerticalJustification('below')
    text.setJustification(Annotation.HorizontalJustify.CENTER_STEM)
    expect(text.getSide()).toBe('bottom')
    expect(text.getAlign()).toBe('centerStem')
  })

  it('⭐ is still filed as an Annotation — the modifier context buckets by category', () => {
    expect(new EngravedAnnotation('p').getCategory()).toBe('Annotation')
  })
})
