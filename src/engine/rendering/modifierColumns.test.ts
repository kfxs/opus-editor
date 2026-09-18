// @vitest-environment jsdom
/**
 * The modifier contexts are ours (S9b). ⚠️ That no pixel moved was proved once, by rendering the same
 * scores at the previous commit and after it (`docs/vexflow-removal-map.md` §5.2); pinned here is what
 * the seam promises: which notes share a column, and that a kind with no rule is refused.
 */
import { describe, it, expect } from 'vitest'
import { Modifier, Parenthesis, StaveNote } from 'vexflow'
import { BarVoice } from './barVoice'
import { ColumnModifiers, attachModifierColumns } from './modifierColumns'

const note = (key: string, duration: string) => new StaveNote({ keys: [key], duration })
const voiceOf = (...notes: StaveNote[]) =>
  new BarVoice({ numerator: 4, denominator: 4 }, 'soft').addAll(notes)

describe('attachModifierColumns', () => {
  it('gives notes of different voices that START TOGETHER one shared context, of our class', () => {
    const upper = [note('c/5', 'h'), note('d/5', 'h')]
    const lower = [note('c/4', 'q'), note('d/4', 'q'), note('e/4', 'h')]
    attachModifierColumns([voiceOf(...upper), voiceOf(...lower)])

    const ctx = (n: StaveNote) => n.getModifierContext()
    expect(ctx(upper[0])).toBeInstanceOf(ColumnModifiers)
    expect(ctx(upper[0]), 'beat 0').toBe(ctx(lower[0]))
    expect(ctx(upper[1]), 'beat 2').toBe(ctx(lower[2]))
    expect(ctx(lower[1]), 'beat 1 is its own column').not.toBe(ctx(lower[0]))
    expect(ctx(lower[1])).not.toBe(ctx(lower[2]))
  })

  it('attaches nothing for no voices', () => {
    expect(() => attachModifierColumns([])).not.toThrow()
  })
})

describe('ColumnModifiers.preFormat', () => {
  it('⛔ refuses a modifier kind it has no rule for, rather than drawing it unformatted', () => {
    const n = note('c/4', 'q')
    n.addModifier(new Parenthesis(Modifier.Position.LEFT), 0)
    attachModifierColumns([voiceOf(n)])
    expect(() => n.getModifierContext()!.preFormat()).toThrow(/no rule for a Parenthesis/)
  })

  it('formats once', () => {
    const n = note('c/4', 'q')
    attachModifierColumns([voiceOf(n)])
    const ctx = n.getModifierContext()!
    ctx.preFormat()
    expect(() => ctx.preFormat()).not.toThrow()
  })
})
