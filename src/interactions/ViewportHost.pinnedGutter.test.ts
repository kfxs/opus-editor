// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createViewportHost, type ViewportHost } from './ViewportHost'

/**
 * The pinned strip's HOST half: declaring linear view's frozen gutter narrows the model's scroll
 * range, so the element has to be re-synced — and that re-sync notifies, which is what the gutter
 * repaints on, which re-declares the strip.
 *
 * ⚠️ **That is a cycle, and it crashed the app.** It does not close itself on "the scroll didn't
 * move": `applyScrollToElement` compares the model's scroll to `scrollLeft`, the limit is a
 * fractional number, and an element that cannot hold it (jsdom has no layout at all — which is why
 * these tests reproduce the crash so exactly) never compares equal. The guard is that re-declaring
 * the SAME strip is not an event.
 */
describe('ViewportHost — the pinned gutter', () => {
  const PIN = { width: 80, inset: 16, overhang: 20 }
  let host: ViewportHost
  let notifies: number
  /** Stands in for the app's own `onViewChange`, which repaints the gutter — and the gutter
   *  re-declares its strip on every repaint. The cycle is the point. */
  let redeclareOnNotify = false

  const div = () => document.createElement('div')

  beforeEach(() => {
    notifies = 0
    redeclareOnNotify = false
    const viewport = div(), content = div(), sizer = div(), zoomLayer = div()
    host = createViewportHost(
      () => viewport, () => content, () => sizer, () => zoomLayer,
      () => {
        notifies++
        if (redeclareOnNotify) host.setPinnedGutter(PIN)
      },
    )
    // A surface with room to scroll: pasteboard 400 + inset 16 + music 2000 + inset 16 + 400.
    host.model.setViewportSize(1000, 340)
    host.model.setPasteboard({ x: 400, y: 400 })
    host.model.setContentSize(2832, 1500)
    host.model.scrollTo(0, 0)
  })

  it('pins the view back inside the new limit and syncs the element once', () => {
    host.setPinnedGutter(PIN)
    expect(host.model.getScroll().x).toBe(396) // 400 + 16 − 20
    expect(notifies).toBe(1)
  })

  it('does nothing at all when the same strip is declared again', () => {
    host.setPinnedGutter(PIN)
    host.setPinnedGutter({ ...PIN })
    expect(notifies).toBe(1) // the second declaration is not an event
  })

  it('does not recurse when the notification re-declares the strip', () => {
    // The real wiring: setPin → sync → notify → gutter repaints → setPin. Before the guard this
    // recursed until the stack blew (RangeError), on the first render of every linear view.
    redeclareOnNotify = true
    host.setPinnedGutter(PIN)
    expect(notifies).toBe(1)
  })

  it('clearing the strip (leaving linear view) is an event exactly once', () => {
    host.setPinnedGutter(PIN)
    host.setPinnedGutter(null)
    host.setPinnedGutter(null)
    // Clearing widens the range, which moves nothing: the view stays where it is, so no re-sync.
    expect(host.model.getScroll().x).toBe(396)
    expect(notifies).toBe(1)
  })
})
