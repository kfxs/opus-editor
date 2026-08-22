// @vitest-environment jsdom
/**
 * Subject: {@link layoutFlushCensus}, sitting beside this file.
 *
 * ⭐ It answers the one question eight wall-clock regions could not: a region reports where the
 * forced-layout bill LANDED, never who ran it up, because the first read after a batch of writes
 * pays for all of them. This instrument charges each read to its own caller.
 *
 * ⚠️ jsdom has no layout, so the *durations* here are meaningless and nothing below asserts on one.
 * What is testable is everything that has ever gone wrong in an instrument in this repo: the
 * attribution, the accounting, and whether it puts the prototypes back.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { layoutFlushCensus } from './layoutFlushCensus'

/** A named function, so its frame is the one the census must report. */
function theCallerWeExpect(el: Element): DOMRect {
  return el.getBoundingClientRect()
}

let el: Element

beforeEach(() => {
  // ⚠️ `disable()` unpatches but deliberately KEEPS the counts, so a dump after a run still works.
  layoutFlushCensus.reset()
  el = document.createElement('div')
  document.body.appendChild(el)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'table').mockImplementation(() => {})
})

afterEach(() => {
  layoutFlushCensus.disable()
  el.remove()
  vi.restoreAllMocks()
})

describe('it charges a forcing read to its CALLER, not to itself', () => {
  it('⭐ names the function that made the read', () => {
    layoutFlushCensus.enable()
    theCallerWeExpect(el)

    const { sites } = layoutFlushCensus.report()
    expect(sites.map(s => s.site)).toContain('theCallerWeExpect')
  })

  it('🚨 never names its own wrapper — that would be true of every row and useful in none', () => {
    layoutFlushCensus.enable()
    theCallerWeExpect(el)

    const named = layoutFlushCensus.report().sites.map(s => String(s.site))
    expect(named.some(n => /probedLayoutRead|LayoutFlushCensus/.test(n))).toBe(false)
  })

  it('counts every read, and keeps callers apart', () => {
    layoutFlushCensus.enable()
    theCallerWeExpect(el)
    theCallerWeExpect(el)
    const other = () => el.getBoundingClientRect()
    other()

    const r = layoutFlushCensus.report()
    expect(r.reads).toBe(3)
    expect(r.sites.find(s => s.site === 'theCallerWeExpect')?.reads).toBe(2)
    expect(r.sites, 'the other caller has its own row').toHaveLength(2)
  })
})

describe('the patch is reversible, and inert until asked', () => {
  it('⛔ records nothing before enable()', () => {
    theCallerWeExpect(el)
    expect(layoutFlushCensus.report().reads).toBe(0)
  })

  it('🚨 disable() puts the prototype back — the ORIGINAL function, not another wrapper', () => {
    const before = Element.prototype.getBoundingClientRect
    layoutFlushCensus.enable()
    expect(Element.prototype.getBoundingClientRect, 'patched while recording').not.toBe(before)

    layoutFlushCensus.disable()
    expect(Element.prototype.getBoundingClientRect).toBe(before)
  })

  it('⚠️ a second enable() re-arms without stacking a second wrapper on the first', () => {
    layoutFlushCensus.enable()
    const patched = Element.prototype.getBoundingClientRect
    layoutFlushCensus.enable()

    expect(Element.prototype.getBoundingClientRect, 'still exactly one layer').toBe(patched)
    layoutFlushCensus.disable()
    expect(Element.prototype.getBoundingClientRect, '…and one undo still restores it').not.toBe(patched)
  })

  it('⭐ …and a second enable() starts the counts from zero', () => {
    layoutFlushCensus.enable()
    theCallerWeExpect(el)
    expect(layoutFlushCensus.report().reads).toBe(1)

    layoutFlushCensus.enable()
    expect(layoutFlushCensus.report().reads).toBe(0)
  })

  it('the reads still WORK while patched — an instrument may not change the answer', () => {
    layoutFlushCensus.enable()
    expect(theCallerWeExpect(el)).toBeInstanceOf(Object)
    expect(theCallerWeExpect(el)).toHaveProperty('width')
  })
})
