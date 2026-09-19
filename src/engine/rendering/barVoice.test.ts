// @vitest-environment jsdom
/**
 * One voice of one bar, ours (S9i). ⚠️ That its bookkeeping is exactly `Voice`'s and
 * `Formatter.getResolutionMultiplier`'s was proved once, side by side on random voices, and the page
 * of random scores rendered at the previous commit and after it (`docs/vexflow-removal-map.md` §5.2);
 * pinned here is what the module promises.
 */
import { describe, it, expect, vi } from 'vitest'
import type { EngravedStave } from './EngravedStave'
import { ClefNote, type RenderContext } from 'vexflow'
import { EngravedNote } from './EngravedNote'
import { TICK_RESOLUTION, ticksValue } from '@/engine/layout/tickCount'
import { type BarTickable, BarVoice, barVoiceOf, drawBarVoice, sharedResolution } from './barVoice'

const note = (duration: string) => new EngravedNote({ keys: ['c/4'], duration })
const triplet = () => {
  const n = note('8')
  n.applyTickMultiplier(2, 3)
  return n
}

describe('BarVoice', () => {
  it('counts in the same clock as the notes — a whole note is TICK_RESOLUTION', () => {
    expect(note('w').getTicks().value()).toBe(TICK_RESOLUTION)
  })

  it("knows the meter's length and what its tickables use", () => {
    const voice = new BarVoice({ numerator: 3, denominator: 4 }, 'full').addAll([note('q'), note('h')])
    expect(ticksValue(voice.totalTicks)).toBe(3 * TICK_RESOLUTION / 4)
    expect(ticksValue(voice.ticksUsed)).toBe(3 * TICK_RESOLUTION / 4)
    expect(voice.resolutionMultiplier).toBe(1)
  })

  it("takes a triplet's denominator as its resolution, keeping the total's VALUE", () => {
    const voice = new BarVoice({ numerator: 2, denominator: 4 }, 'full')
      .addAll([triplet(), triplet(), triplet(), note('q')])
    expect(voice.resolutionMultiplier).toBe(3)
    expect(voice.ticksUsed.denominator).toBe(3)
    expect(ticksValue(voice.totalTicks)).toBe(TICK_RESOLUTION / 2)
  })

  it('⛔ a FULL voice refuses a note past the bar; a SOFT one keeps it', () => {
    const full = new BarVoice({ numerator: 1, denominator: 4 }, 'full').add(note('q'))
    expect(() => full.add(note('q'))).toThrow(/Too many ticks/)
    expect(ticksValue(full.ticksUsed)).toBe(TICK_RESOLUTION / 4)
    const soft = new BarVoice({ numerator: 1, denominator: 4 }, 'soft').addAll([note('q'), note('q')])
    expect(soft.tickables).toHaveLength(2)
  })

  it('an inline clef joins without counting', () => {
    const clef = new ClefNote('bass', 'small')
    const voice = new BarVoice({ numerator: 4, denominator: 4 }, 'full').addAll([note('h'), clef])
    expect(voice.tickables).toContain(clef)
    expect(ticksValue(voice.ticksUsed)).toBe(TICK_RESOLUTION / 2)
  })

  it("remembers which voice a tickable joined — the multi-voice rule's identity", () => {
    const a = note('q')
    const voice = new BarVoice({ numerator: 4, denominator: 4 }, 'soft').add(a)
    expect(barVoiceOf(a)).toBe(voice)
    expect(barVoiceOf(note('q'))).toBeUndefined()
  })
})

describe('sharedResolution', () => {
  it("is the LCM of the voices' resolutions", () => {
    const plain = new BarVoice({ numerator: 2, denominator: 4 }, 'full').addAll([note('q'), note('q')])
    const trip = new BarVoice({ numerator: 2, denominator: 4 }, 'full').addAll([triplet(), triplet(), triplet(), note('q')])
    expect(sharedResolution([plain, trip])).toBe(3)
  })

  it('⛔ refuses voices of different lengths, and no voices at all', () => {
    const a = new BarVoice({ numerator: 2, denominator: 4 }, 'soft')
    const b = new BarVoice({ numerator: 3, denominator: 4 }, 'soft')
    expect(() => sharedResolution([a, b])).toThrow(/same total duration/)
    expect(() => sharedResolution([])).toThrow(/no voices/)
  })
})

describe('drawBarVoice', () => {
  it('puts each tickable on the stave, hands it the context, and draws it with its style — in order', () => {
    const calls: string[] = []
    const fake = (name: string) => ({
      shouldIgnoreTicks: () => true,
      setStave: vi.fn(() => calls.push(`${name}.stave`)),
      setContext: vi.fn(() => calls.push(`${name}.context`)),
      drawWithStyle: vi.fn(() => calls.push(`${name}.draw`)),
    }) as unknown as BarTickable
    const voice = new BarVoice({ numerator: 4, denominator: 4 }, 'soft').addAll([fake('a'), fake('b')])
    const stave = {} as EngravedStave
    const context = {} as RenderContext
    drawBarVoice(voice, context, stave)
    expect(calls).toEqual(['a.stave', 'a.context', 'a.draw', 'b.stave', 'b.context', 'b.draw'])
    expect(voice.tickables[0].setStave).toHaveBeenCalledWith(stave)
    expect(voice.tickables[0].setContext).toHaveBeenCalledWith(context)
  })
})
