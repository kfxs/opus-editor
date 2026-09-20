// @vitest-environment jsdom
/**
 * Our SVG painter (S13b) — VexFlow's `SVGContext`, transcribed. ⚠️ That the page it writes is
 * byte-identical to VexFlow's was proved once, in jsdom and in Chromium, against the previous commit
 * (`docs/history/vexflow-removal-map.md` S13b); pinned here are the rules the markup depends on.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SvgPainter } from './SvgPainter'

let host: HTMLDivElement
let painter: SvgPainter

beforeEach(() => {
  host = document.createElement('div')
  painter = new SvgPainter(host)
})

describe('SvgPainter', () => {
  it('appends one <svg> carrying the default ink, in VexFlow\'s attribute order', () => {
    expect(host.children).toHaveLength(1)
    expect([...painter.svg.attributes].map(a => `${a.name}=${a.value}`)).toEqual([
      'pointer-events=none', 'stroke-width=1', 'stroke-dasharray=none', 'fill=black', 'stroke=black', 'shadowColor=black',
      'font-family=Bravura,Academico', 'font-size=10pt', 'font-weight=normal', 'font-style=normal',
    ])
  })

  it('sizes the svg and scales its viewBox', () => {
    painter.resize(200, 100)
    painter.scale(2, 2)
    expect(painter.svg.getAttribute('width')).toBe('200')
    expect(painter.svg.getAttribute('viewBox')).toBe('0 0 100 50')
  })

  it('⭐ writes an attribute only where it DIFFERS from the enclosing group, and the class and id AS GIVEN', () => {
    painter.setFillStyle('red')
    const group = painter.openGroup('note', 'n1')
    // ⭐ S15c: exactly what was asked for — VexFlow's namespace prefix is gone, and every selector reads the bare name.
    expect(group.getAttribute('class')).toBe('note')
    expect(group.getAttribute('id')).toBe('n1')
    expect(group.getAttribute('fill')).toBe('red')
    painter.fillText('x', 1, 2)
    const text = group.querySelector('text')!
    expect(text.getAttribute('fill')).toBeNull() // the group already says red
    expect(text.getAttribute('stroke')).toBe('none')
    painter.closeGroup()
  })

  it('rounds every coordinate to three places', () => {
    painter.beginPath()
    painter.moveTo(1.23456, 2)
    painter.lineTo(3, 4.00049)
    painter.stroke()
    expect(painter.svg.querySelector('path')!.getAttribute('d')).toBe('M1.235 2L3 4')
  })

  it('a filled path takes no stroke, a stroked one no fill', () => {
    painter.beginPath(); painter.moveTo(0, 0); painter.lineTo(1, 1); painter.closePath(); painter.fill()
    painter.beginPath(); painter.moveTo(0, 0); painter.lineTo(1, 1); painter.stroke()
    const [filled, stroked] = painter.svg.querySelectorAll('path')
    expect(filled.getAttribute('stroke')).toBe('none')
    expect(filled.getAttribute('d')).toBe('M0 0L1 1Z')
    expect(stroked.getAttribute('fill')).toBe('none')
  })

  it('save / restore brings the ink back — and REPLACES the objects a pass rewinds by assignment', () => {
    const before = painter.attributes
    painter.save()
    painter.setStrokeStyle('blue')
    painter.restore()
    expect(painter.attributes.stroke).toBe('black')
    expect(painter.attributes).not.toBe(before)
  })

  it('a font takes POINTS for a number, and a bare CSS shorthand is parsed by the page', () => {
    painter.setFont('Academico', 12, 'bold')
    expect(painter.attributes['font-size']).toBe('12pt')
    expect(painter.getFont()).toBe('bold 12pt Academico')
    painter.setFont('italic 16px Georgia')
    expect(painter.attributes['font-style']).toBe('italic')
  })

  it('a pointer rect is invisible but catches the pointer; a fill rect takes no stroke', () => {
    painter.pointerRect(0, 0, 5, 5)
    painter.fillRect(0, 0, 5, -5)
    const [pointer, filled] = painter.svg.querySelectorAll('rect')
    expect(pointer.getAttribute('opacity')).toBe('0')
    expect(pointer.getAttribute('pointer-events')).toBe('auto')
    expect([filled.getAttribute('y'), filled.getAttribute('height'), filled.getAttribute('stroke')]).toEqual(['-5', '5', 'none'])
  })
})
