// @vitest-environment jsdom
/**
 * A bar's voices, formatted by us (S9h-a). ⚠️ That this is exactly `Formatter.format` was proved once —
 * every context's metrics and x and every note's line and x on 6,000 random bars, and the rendered
 * page of 60 scores (`docs/history/vexflow-removal-map.md` §5.2); pinned here is what the module promises.
 */
import { describe, it, expect } from 'vitest'
import { EngravedBeam } from './EngravedBeam'
import { BarVoice, type BarTickable } from './barVoice'
import { EngravedNote } from './EngravedNote'
import { attachModifierColumns } from './modifierColumns'
import { TickColumn, alignVoiceRests, createTickColumns, formatColumns } from './columnFormat'

const note = (key: string, duration: string) => new EngravedNote({ keys: [key], duration })
const voiceOf = (...tickables: BarTickable[]) =>
  new BarVoice({ numerator: 4, denominator: 4 }, 'soft').addAll(tickables)

describe('createTickColumns', () => {
  it('gives notes of different voices that start together ONE column, of our class, ticks sorted', () => {
    const upper = [note('c/5', 'h'), note('d/5', 'h')]
    const lower = [note('c/4', 'q'), note('d/4', 'q'), note('e/4', 'h')]
    const { map, list, array } = createTickColumns([voiceOf(...upper), voiceOf(...lower)])
    expect(array.every(c => c instanceof TickColumn)).toBe(true)
    expect(list).toEqual([...list].sort((a, b) => a - b))
    expect(list).toHaveLength(3)
    expect(upper[0].getTickContext()).toBe(lower[0].getTickContext())
    expect(upper[1].getTickContext()).toBe(lower[2].getTickContext())
    expect(map[list[1]].getTickables()).toEqual([lower[1]])
  })
})

describe('alignVoiceRests', () => {
  it('moves a beamed middle-line rest to the notes around it', () => {
    const group = [note('e/5', '8'), note('b/4', '8r'), note('a/5', '8')]
    new EngravedBeam(group)
    alignVoiceRests([voiceOf(...group, note('c/4', 'q'), note('c/4', 'h'))])
    expect(group[1].getKeyLine(0)).not.toBe(3)
  })

  it('⛔ refuses a tickable it was not written for', () => {
    const voice = voiceOf(note('c/4', 'w'))
    ;(voice.tickables as unknown[]).push({})
    expect(() => alignVoiceRests([voice])).toThrow(/neither an EngravedNote nor an EngravedClefChange/)
  })
})

describe('formatColumns', () => {
  it('formats: every note has a column and an x, left to right', () => {
    const notes = [note('c/4', 'q'), note('d/4', 'q'), note('e/4', 'q'), note('f/4', 'q')]
    const voices = [voiceOf(...notes)]
    attachModifierColumns(voices)
    const { list, map } = formatColumns(voices, 300)
    expect(list).toHaveLength(4)
    const xs = list.map(t => map[t].getX())
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(new Set(xs).size).toBe(4)
  })
})

describe('TickColumn — ours since S12j-b (VexFlow\'s `TickContext`, transcribed)', () => {
  /** A stand-in tickable: its ticks, and the column it is told it stands in. */
  const tickable = (numerator: number, denominator = 1) => {
    const t = { ticks: { numerator, denominator }, column: undefined as unknown,
      shouldIgnoreTicks: () => false, getTicks: () => t.ticks, setTickContext: (c: unknown) => { t.column = c } }
    return t
  }
  type Stand = Parameters<TickColumn['addTickable']>[0]

  it('⭐ keeps the longest and shortest tickables — compared unreduced, kept as copies', () => {
    const column = new TickColumn({ tickID: 0 })
    const a = tickable(4096), b = tickable(16384, 2), c = tickable(2048)
    for (const t of [a, b, c]) column.addTickable(t as unknown as Stand)
    expect(column.getMaxTicks()).toEqual({ numerator: 16384, denominator: 2 })
    expect(column.getMaxTicks()).not.toBe(b.ticks)
    expect(column.getMinTicks()).toEqual({ numerator: 2048, denominator: 1 })
    expect(column.getMaxTickable()).toBe(b)
    expect(a.column).toBe(column)
  })

  it('files each tickable by its voice, and pads its width by one either side', () => {
    const column = new TickColumn()
    const t = tickable(4096)
    column.addTickable(t as unknown as Stand, 1)
    expect(column.getTickableForVoice(1)).toBe(t)
    column.width = 10
    expect(column.getWidth()).toBe(12)
  })

  it('moves its x by an offset over a base — `setXOffset` after `setX`', () => {
    const column = new TickColumn()
    column.setX(100)
    column.setXOffset(5)
    expect([column.getX(), column.getXBase(), column.getXOffset()]).toEqual([105, 100, 5])
  })
})
