/**
 * Subject: `./headerGapConsole` — the two header-gap knobs, as an instrument.
 *
 * ⭐ What is worth pinning about a console is not its printing: it is that **the knob is wired to
 * something**. A typo that silently did nothing, or a row that armed without re-rendering, would be
 * the worst possible instrument for a question only HIS EYE can answer.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { headerGapConsole } from './headerGapConsole'
import {
  ACTIVE_CLEF_METER_RULE, clefMeterSettings, resetClefMeterRule,
} from '@/engine/layout/clefMeterGap'
import { headerGapSettings, resetHeaderGapRule } from '@/engine/layout/headerAccidentalLadder'

afterEach(() => { resetClefMeterRule(); resetHeaderGapRule() })

describe('the CLEF→METER knob', () => {
  it('⭐ arms a row AND re-renders — a knob wired to nothing is worse than no knob', () => {
    const render = vi.fn()
    const out = headerGapConsole(render).clefMeter('lilypond')
    expect(clefMeterSettings().rule).toBe('lilypond')
    expect(render, 'the picture must follow the setting').toHaveBeenCalledTimes(1)
    expect(out.armed).toBe('lilypond')
  })

  it('⛔ REFUSES a typo — and does NOT render, so nothing looks like it worked', () => {
    const render = vi.fn()
    const out = headerGapConsole(render).clefMeter('gould' as never)
    expect(clefMeterSettings().rule, 'still what shipped').toBe(ACTIVE_CLEF_METER_RULE)
    expect(render).not.toHaveBeenCalled()
    expect(out.armed).toBe(ACTIVE_CLEF_METER_RULE)
  })

  it('⭐ reads back every row, so the next thing to try is on screen', () => {
    const out = headerGapConsole(vi.fn()).dumpClefMeter()
    expect(Object.keys(out.ink).sort()).toEqual(['books', 'lilypond', 'rossCompass', 'stone'])
    expect(out.ink.stone, 'the armed number, his choice 2026-09-12').toBe(1.0)
  })

  it('⭐ reset goes back to what shipped, and renders', () => {
    const render = vi.fn()
    const c = headerGapConsole(render)
    c.clefMeter('rossCompass')
    expect(c.resetClefMeter().armed).toBe(ACTIVE_CLEF_METER_RULE)
    expect(render).toHaveBeenCalledTimes(2)
  })
})

describe('⛔ the two knobs are INDEPENDENT — they are two questions on one run', () => {
  it('arming the clef→meter gap leaves the accidental ladder alone, and the reverse', () => {
    const c = headerGapConsole(vi.fn())
    const ladderBefore = headerGapSettings().rule
    c.clefMeter('books')
    expect(headerGapSettings().rule).toBe(ladderBefore)
    c.rule('gould')
    expect(clefMeterSettings().rule, 'still `books`').toBe('books')
  })
})
