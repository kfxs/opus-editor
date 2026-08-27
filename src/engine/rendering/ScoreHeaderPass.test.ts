// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSurface, A4_NORMAL, SKETCH_CANVAS } from '@/engine/layout/surface'
import type { Score } from '@/types/music'
import { drawSketchHeader, scoreTextClass, sketchHeaderRoomPx } from './ScoreHeaderPass'

/**
 * The sketched header block (`./ScoreHeaderPass` — read its ⛔ note first; this is scaffolding, and
 * the spec is here to hold the three things the rest of the render depends on: the ROOM it takes,
 * the gate both callers share, and that each field draws its own line).
 *
 * ⚠️ No assertion here measures ink. The lines' own glyphs are 0×0 in jsdom, so what is checked is
 * the arithmetic this module authored — the room, and the coordinates it wrote onto each `<text>`.
 */

const PAGE = resolveSurface(A4_NORMAL)
const CANVAS = resolveSurface(SKETCH_CANVAS)

const score = (fields: Partial<Pick<Score, 'title' | 'composer'>>): Score =>
  ({ id: 's', measures: [], ...fields }) as Score

let svg: SVGElement

beforeEach(() => {
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
})

const line = (field: 'title' | 'composer') => svg.querySelector(`.${scoreTextClass(field)}`)

describe('sketchHeaderRoomPx', () => {
  it('is the block, once, when there is anything to draw in wrapped view on paper', () => {
    expect(sketchHeaderRoomPx(score({ title: 'Fragment 1' }), PAGE, 'wrapped')).toBe(100) // 10 spaces
  })

  it('🚨 a COMPOSER buys AIR under it — his report; the title alone already had some', () => {
    // The frame is 10 spaces either way; a composer is aligned to its BOTTOM edge, so it ends where
    // the frame does and the 5 spaces LilyPond holds between markup and system are added for it.
    expect(sketchHeaderRoomPx(score({ composer: 'Brahms' }), PAGE, 'wrapped')).toBe(150)
    expect(sketchHeaderRoomPx(score({ title: 'T', composer: 'B' }), PAGE, 'wrapped')).toBe(150)
  })

  it('⭐ is 0 in LINEAR view — one endless system has no page to head', () => {
    expect(sketchHeaderRoomPx(score({ title: 'Fragment 1' }), PAGE, 'linear')).toBe(0)
  })

  it('⭐ is 0 on a CANVAS — not paper, so there is no page to head there either', () => {
    expect(sketchHeaderRoomPx(score({ title: 'Fragment 1' }), CANVAS, 'wrapped')).toBe(0)
  })

  it('is 0 when both fields are absent or blank — the paper is not spent on nothing', () => {
    expect(sketchHeaderRoomPx(score({}), PAGE, 'wrapped')).toBe(0)
    expect(sketchHeaderRoomPx(score({ title: '   ', composer: '' }), PAGE, 'wrapped')).toBe(0)
  })
})

describe('drawSketchHeader', () => {
  it('draws the TITLE centred on the first page\'s content width', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'Fragment 1' }), 'wrapped')
    const text = line('title')
    expect(text?.textContent).toBe('Fragment 1')
    expect(text?.getAttribute('text-anchor')).toBe('middle')
    expect(Number(text?.getAttribute('x')))
      .toBeCloseTo(PAGE.marginLeftPx + PAGE.contentWidthPx / 2, 6)
  })

  it('⭐ draws the COMPOSER right-aligned and BELOW it — the convention, not decoration', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'T', composer: 'Brahms' }), 'wrapped')
    const composer = line('composer')
    expect(composer?.textContent).toBe('Brahms')
    expect(composer?.getAttribute('text-anchor')).toBe('end')
    expect(Number(composer?.getAttribute('x')))
      .toBeCloseTo(PAGE.marginLeftPx + PAGE.contentWidthPx, 6)
    expect(Number(composer?.getAttribute('y')))
      .toBeGreaterThan(Number(line('title')?.getAttribute('y')))
  })

  it('keeps both lines inside the room it reserved, with the composer\'s air below them', () => {
    const s = score({ title: 'T', composer: 'B' })
    drawSketchHeader(svg, PAGE, s, 'wrapped')
    const bottom = PAGE.marginTopPx + sketchHeaderRoomPx(s, PAGE, 'wrapped')
    for (const field of ['title', 'composer'] as const) {
      const y = Number(line(field)?.getAttribute('y'))
      expect(y, field).toBeGreaterThan(PAGE.marginTopPx)
      expect(y, field).toBeLessThan(bottom)
    }
  })

  it('draws only the fields that are there', () => {
    drawSketchHeader(svg, PAGE, score({ composer: 'Brahms' }), 'wrapped')
    expect(line('title')).toBeNull()
    expect(line('composer')).not.toBeNull()
  })

  it('trims what it draws — the text is the same one the room was priced for', () => {
    drawSketchHeader(svg, PAGE, score({ title: '  Sonata  ' }), 'wrapped')
    expect(line('title')?.textContent).toBe('Sonata')
  })

  it('⛔ states `stroke="none"` — an unstated stroke outlines every letter (his report)', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'Sonata' }), 'wrapped')
    expect(line('title')?.getAttribute('stroke')).toBe('none')
  })

  it('draws nothing in linear view, on a canvas, nor for a blank field', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'T' }), 'linear')
    expect(line('title')).toBeNull()
    drawSketchHeader(svg, CANVAS, score({ title: 'T' }), 'wrapped')
    expect(line('title')).toBeNull()
    drawSketchHeader(svg, PAGE, score({ title: '' }), 'wrapped')
    expect(line('title')).toBeNull()
  })

  it('⭐ SWEEPS its last block — a re-render must not stack two headers', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'First' }), 'wrapped')
    drawSketchHeader(svg, PAGE, score({ title: 'Second' }), 'wrapped')
    expect(svg.querySelectorAll('.score-header')).toHaveLength(1)
    expect(line('title')?.textContent).toBe('Second')
  })

  it('sweeps it when the text goes away too — ⚠️ an early return would leave the old one standing', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'First' }), 'wrapped')
    drawSketchHeader(svg, PAGE, score({}), 'wrapped')
    expect(svg.querySelector('.score-header')).toBeNull()
  })

  it('answers no hit-test from the GROUP — the press is answered from the measured registry', () => {
    drawSketchHeader(svg, PAGE, score({ title: 'T' }), 'wrapped')
    expect(svg.querySelector('.score-header')?.getAttribute('pointer-events')).toBe('none')
  })
})
