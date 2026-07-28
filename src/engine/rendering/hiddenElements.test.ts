// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { applyHiddenTreatment, hiddenTreatment, HIDDEN_ELEMENT_COLOR } from './hiddenElements'

/**
 * The audience table and the two treatments. Node identity and attributes only — no geometry:
 * jsdom has no layout, and a treatment is about ink, not position.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** jsdom re-serialises a `style` colour as `rgb(r, g, b)`, so a hex never compares equal there.
 *  Both spellings mean the same paint; normalise before asserting. */
function isHiddenGray(value: string): boolean {
  const hex = HIDDEN_ELEMENT_COLOR.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  return value.toLowerCase() === HIDDEN_ELEMENT_COLOR.toLowerCase() || value === `rgb(${r}, ${g}, ${b})`
}

/** A stand-in for a rendered `vf-stavenote` group: a glyph `<text>` and a dot `<path>`, in a
 *  parent, so removal is observable from the parent's side. */
function stubGroup(): { parent: SVGSVGElement; group: SVGGElement } {
  const parent = document.createElementNS(SVG_NS, 'svg')
  const group = document.createElementNS(SVG_NS, 'g')
  group.appendChild(document.createElementNS(SVG_NS, 'text'))
  group.appendChild(document.createElementNS(SVG_NS, 'path'))
  parent.appendChild(group)
  document.body.appendChild(parent)
  return { parent, group }
}

describe('hiddenTreatment', () => {
  it('tints for the editor and omits for print', () => {
    expect(hiddenTreatment('editor')).toBe('tint')
    expect(hiddenTreatment('print')).toBe('omit')
  })
})

describe('applyHiddenTreatment', () => {
  it('for the editor, grays every glyph in the group and keeps it in the tree', () => {
    const { parent, group } = stubGroup()
    applyHiddenTreatment(group, 'editor')

    expect(group.parentNode, 'still rendered — you must be able to select and unhide it').toBe(parent)
    for (const el of Array.from(group.querySelectorAll('text, path'))) {
      // Both, because VexFlow writes either and a stylesheet fill would beat a bare attribute.
      expect(el.getAttribute('fill')).toBe(HIDDEN_ELEMENT_COLOR)
      expect(isHiddenGray((el as SVGElement).style.fill)).toBe(true)
    }
  })

  it('for print, removes the group outright — no gray ink on paper', () => {
    const { parent, group } = stubGroup()
    applyHiddenTreatment(group, 'print')

    expect(group.parentNode).toBeNull()
    expect(parent.querySelectorAll('g').length, 'nothing of it left behind').toBe(0)
  })

  it('for print, does not merely recolour to white or transparent', () => {
    // A hidden element must be ABSENT, not invisible: an invisible glyph still selects in a PDF
    // viewer, still copies out as text, and still prints on a non-white stock.
    const { parent, group } = stubGroup()
    applyHiddenTreatment(group, 'print')
    expect(parent.querySelectorAll('text, path').length).toBe(0)
  })
})
