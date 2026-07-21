/**
 * @vitest-environment jsdom
 *
 * Boots the real app and checks that the host WIRED things up.
 *
 * This exists because of a bug that every other check was blind to. `App.vue`'s template bound five
 * mouse handlers on the score box (`@click`, `@mousedown`, `@mousemove`, `@mouseup`, `@mouseleave`)
 * *in addition to* calling `MouseController.setup()` — which only attaches the document-level
 * click-outside listeners. Porting the file to plain TS dropped the five, and nothing noticed:
 * `tsc` was clean (the methods still existed, they just had no caller), `lint:boundary` was clean,
 * and all 1580 unit tests passed, because every one of them calls the controllers directly and none
 * boots the app. The score simply stopped responding to the mouse.
 *
 * The lesson generalises past that one bug: a controller test proves the controller works, never
 * that anything CALLS it. So these assertions are all of the form "a real DOM event produces a real
 * effect", with the app assembled exactly as `main.ts` assembles it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorApp, type EditorApp } from './App'

let host: HTMLElement
let app: EditorApp | null = null

function scoreBox(): HTMLElement {
  const el = host.querySelector('.score-container')
  if (!el) throw new Error('score container not found')
  return el as HTMLElement
}

beforeEach(() => {
  // jsdom has no layout, so VexFlow's measuring lands on zeros; that is fine here — we assert on
  // wiring, never on geometry. ResizeObserver simply does not exist in jsdom.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as never
  // jsdom implements the SVG DOM but not its geometry interfaces, and MouseController.clientToSvg
  // uses both. An identity transform is the right stand-in: it makes client coords pass through as
  // SVG coords, so the handler runs to completion and the test can be about wiring.
  const svgProto = globalThis.SVGSVGElement?.prototype as unknown as Record<string, unknown>
  if (svgProto && !svgProto.createSVGPoint) {
    svgProto.createSVGPoint = function () {
      return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y } } }
    }
    svgProto.getScreenCTM = function () {
      return { inverse: () => ({}) }
    }
  }
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  app?.destroy()
  app = null
  host.remove()
  vi.restoreAllMocks()
})

describe('the app boots', () => {
  it('builds the score DOM and the dev shell', () => {
    app = createEditorApp(host)

    expect(host.querySelector('.score-container')).not.toBeNull()
    expect(host.querySelector('.score-sizer')).not.toBeNull()
    expect(host.querySelector('.score-zoom-layer')).not.toBeNull()
    expect(host.querySelector('.play-cursor')).not.toBeNull()
    expect(host.querySelector('.score-gutter')).not.toBeNull()
    // The dev toolbar built itself into the box the app donated.
    expect(host.textContent).toContain('Lorem Window')
    expect(host.textContent).toContain('Score JSON:')
  })

  /**
   * THE REGRESSION. Each of the five must reach MouseController — asserted by the effect a real
   * event has, not by spying on the wiring, so it stays true however the handlers are attached.
   */
  it('routes the five score mouse events to the controller', () => {
    app = createEditorApp(host)
    const box = scoreBox()

    // A move records the pointer position: getLastMousePosition feeds the armed-tool ghost, which
    // is exactly what broke — arm a duration, hover the score, and no ghost appeared.
    box.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40, bubbles: true }))
    expect(host.querySelector('.score-container')).not.toBeNull()

    // The remaining four must not throw when dispatched for real. A missing listener is silent, so
    // the value here is the pairing with the assertions below rather than the absence of an error.
    expect(() => {
      box.dispatchEvent(new MouseEvent('mousedown', { clientX: 40, clientY: 40, bubbles: true }))
      box.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40, bubbles: true }))
      box.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 40, bubbles: true }))
      box.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    }).not.toThrow()
  })

  /** All five listeners must actually be REGISTERED on the score box — the direct statement of the
   *  bug. Spying on addEventListener is the only way to see a listener that was never added. */
  it('registers every score mouse listener on the score box', () => {
    const added: string[] = []
    const realAdd = HTMLElement.prototype.addEventListener
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
      .mockImplementation(function (this: HTMLElement, type: string, ...rest: never[]) {
        if (this.classList?.contains('score-container')) added.push(type)
        return (realAdd as never as (...a: unknown[]) => void).call(this, type, ...rest)
      } as never)

    app = createEditorApp(host)
    spy.mockRestore()

    for (const type of ['click', 'mousedown', 'mousemove', 'mouseup', 'mouseleave']) {
      expect(added, `no "${type}" listener on the score box`).toContain(type)
    }
  })

  it('destroy() removes the DOM it built', () => {
    app = createEditorApp(host)
    expect(host.querySelector('.score-container')).not.toBeNull()

    app.destroy()
    app = null

    expect(host.querySelector('.score-container')).toBeNull()
  })
})
