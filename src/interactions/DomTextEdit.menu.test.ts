// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { DomTextEdit } from './DomTextEdit'
import { MenuLayer } from '../menus/MenuLayer'

/**
 * The real MenuLayer, not a spy — this catches breaks BETWEEN the overlay and the layer (a wrong
 * host, a bad coordinate conversion, a panel that never reaches the DOM) which a mocked opener
 * hides completely.
 *
 * ⚠️ Its OWN file on purpose. Every mount registers document-level listeners and leaves a caret in
 * the shared document; run beside the mocked-opener tests and a leaked instance answers this test's
 * events too, so the rows being clicked belong to someone else. Vitest isolates per FILE, so a file
 * boundary is the only reliable clean slate here.
 */
function mountOpts(over: Partial<Parameters<DomTextEdit['mount']>[0]> = {}) {
  return {
    text: '',
    rect: { x: 10, y: 10, width: 40, height: 20 },
    font: { fontFamily: 'serif', fontSize: '14pt', fontStyle: 'italic', color: '#000' },
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
}

// Integration: the real MenuLayer, not a spy. Catches breaks BETWEEN the overlay and the layer —
// a wrong host, a bad coordinate conversion, a panel that never reaches the DOM — which a mocked
// opener happily hides.
describe('DomTextEdit + a real MenuLayer', () => {
  it('right-click actually puts a panel with the words in the DOM', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const layer = new MenuLayer()
    layer.mount(host)

    expect(layer.host).toBe(host) // the getter openMenuAtViewport depends on

    const openAt = (x: number, y: number, items: Parameters<typeof layer.open>[0]['items']) => {
      const box = layer.host!.getBoundingClientRect()
      layer.open({ x: x - box.left, y: y - box.top, items })
    }

    const dom = new DomTextEdit(openAt)
    dom.mount(mountOpts({
      buildContextMenu: (insertText) => [{ label: 'dolce', onSelect: () => insertText('dolce') }],
    }))

    document.body.dispatchEvent(new MouseEvent('contextmenu', { clientX: 300, clientY: 300, bubbles: true, cancelable: true }))

    const panel = host.querySelector('.menu-panel')
    expect(panel, 'a menu panel should be in the DOM').not.toBeNull()
    expect(panel!.textContent).toContain('dolce')

    // …and choosing it still reaches the caret through the real chain.
    const row = panel!.querySelector('.menu-row') as HTMLElement
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.querySelector('.text-edit-overlay')!.textContent).toContain('dolce')

    dom.unmount()
    layer.destroy()
    host.remove()
  })
})
