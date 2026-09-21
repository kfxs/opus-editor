/**
 * Which face a category tag resolves to — VexFlow's `Metrics` font tree, as ours (S13a). ⚠️ That it
 * answers exactly what `Metrics.getFontInfo` answered was proved once, in one process, over 44 tags
 * (`docs/history/vexflow-removal-map.md` S13a); pinned here is what the rows and the walk promise.
 */
import { describe, it, expect } from 'vitest'
import { rootFontFamily, ROOT_FONT_SIZE_PT, categoryFont } from './fontCategories'

describe('categoryFont', () => {
  it('⭐ a tag with no row is the ROOT face — the music stack at 30 pt', () => {
    expect(categoryFont('EngravedClef.walk')).toEqual({ family: 'Bravura,Academico', size: 30, weight: 'normal', style: 'normal' })
    expect([rootFontFamily(), ROOT_FONT_SIZE_PT]).toEqual(['Bravura,Academico', 30])
  })

  it('a category keeps the deepest value on its path, and the root for the rest', () => {
    expect(categoryFont('Annotation').size).toBe(10)
    expect(categoryFont('StaveTempo.glyph').size).toBe(25)
    expect(categoryFont('StaveTempo.name')).toMatchObject({ size: 14, weight: 'bold' })
    expect(categoryFont('Stroke.text')).toMatchObject({ size: 10, weight: 'bold', style: 'italic' })
  })

  it('the size is the size times the scale', () => {
    expect(categoryFont('GraceNote').size).toBe(20)
  })

  it('a path that leaves the tree keeps what it found above', () => {
    expect(categoryFont('Annotation.nothing.here').size).toBe(10)
  })

  it('hands out a fresh object each call', () => {
    const a = categoryFont('Annotation')
    a.size = 99
    expect(categoryFont('Annotation').size).toBe(10)
  })
})
