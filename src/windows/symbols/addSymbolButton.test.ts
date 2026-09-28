// @vitest-environment jsdom
/**
 * {@link AddSymbolButton} — live only for a picked, drawable glyph and exactly ONE selected note or rest;
 * a click publishes the request and nothing else (docs/plans/symbol-plan.md P2).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { AddSymbolButton, symbolTarget, whyDisabled } from './addSymbolButton'
import { bus } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

const note = (id: string) => ({ kind: 'note', data: { id } }) as unknown as InspectedElement
const rest = (id: string) => ({ kind: 'rest', data: { id } }) as unknown as InspectedElement

describe('symbolTarget', () => {
  it('names exactly one note or rest, and nothing else', () => {
    expect(symbolTarget([note('n1')])).toBe('n1')
    expect(symbolTarget([rest('r1')])).toBe('r1')
    expect(symbolTarget([])).toBeNull()
    expect(symbolTarget([note('n1'), note('n2')])).toBeNull()
    expect(symbolTarget([{ kind: 'dynamic', data: { id: 'd' } } as unknown as InspectedElement])).toBeNull()
    expect(symbolTarget([{ kind: 'note', data: { id: 'n1', missing: true } } as unknown as InspectedElement])).toBeNull()
  })
})

describe('whyDisabled', () => {
  it('says what is missing, in order: a glyph, a drawable one, a target', () => {
    expect(whyDisabled(null, 'n1')).toMatch(/Pick a glyph/)
    expect(whyDisabled('controlBeginBeam', 'n1')).toMatch(/draws no ink/)
    expect(whyDisabled('pictGlsp', null)).toMatch(/Select one note or rest/)
    expect(whyDisabled('pictGlsp', 'n1')).toBeNull()
  })
})

describe('AddSymbolButton', () => {
  let button: AddSymbolButton
  afterEach(() => { button.destroy(); bus.inspection.set([]) })

  it('follows the selection; a click publishes the glyph onto the selected event, then closes the window', () => {
    const host = document.createElement('div')
    const closed = vi.fn()
    button = new AddSymbolButton(closed)
    button.mount(host)
    const el = host.querySelector('button')!
    const sent = vi.fn()
    const off = bus.glyphMarkAdd.onSet(sent)

    button.setGlyph('pictGlsp')
    expect(el.disabled).toBe(true) // nothing selected yet
    bus.inspection.set([note('n1')])
    expect(el.disabled).toBe(false)
    el.click()
    expect(sent).toHaveBeenCalledWith({ noteId: 'n1', glyph: 'pictGlsp' })
    expect(closed).toHaveBeenCalledTimes(1) // …and the window is told to close

    bus.inspection.set([note('n1'), note('n2')])
    expect(el.disabled).toBe(true)
    off()
  })
})
