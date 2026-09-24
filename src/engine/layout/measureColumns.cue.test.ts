import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { setCue } from '@/engine/models/cueOps'
import { measureColumns } from './measureColumns'
import { resetCueSize, setCueSize } from './cueSize'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./measureColumns` — a CUE chord asks for its ink at its size (cue-size-plan C8: the INK shrinks
 * first). Its boxes shrink about where they stand — ⛔ not `sized()`, which is a whole small staff.
 */
describe('measureColumns — a cue chord\'s room', () => {
  afterEach(() => resetCueSize())

  /** A dotted C♯4 eighth (head, ledger, sign, dot, stem, flag) at beat 0; its column's ink by kind. */
  const inkOf = (cue: boolean) => {
    const model = new ScoreModel()
    const n = model.addNote({ step: 'C', alter: 1, octave: 4, duration: '8', dots: 1, measure: 1, beat: frac(0, 1) })
    if (cue) setCue(model.getScore(), [n.id], true)
    const ink = measureColumns(model.getMeasure(1)!)[0].ink
    return (kind: string) => ink.find(b => b.kind === kind)!
  }

  it('⭐ every box of the note is ¾ as wide either side of the head', () => {
    const full = inkOf(false)
    const cue = inkOf(true)
    for (const kind of ['note', 'ledger', 'accidental', 'dot', 'stem', 'flag']) {
      expect(full(kind), kind).toBeDefined()
      expect(cue(kind).left, `${kind} left`).toBeCloseTo(full(kind).left * 0.75, 9)
      expect(cue(kind).right, `${kind} right`).toBeCloseTo(full(kind).right * 0.75, 9)
    }
  })

  it('⭐ a head keeps its LINE (the full staff’s) and shrinks about it; the ledger’s band does not move', () => {
    const full = inkOf(false)
    const cue = inkOf(true)
    const mid = (b: { top: number; bottom: number }) => (b.top + b.bottom) / 2
    expect(mid(cue('note'))).toBeCloseTo(mid(full('note')), 9)
    expect(cue('note').bottom - cue('note').top).toBeCloseTo((full('note').bottom - full('note').top) * 0.75, 9)
    expect(cue('ledger')).toMatchObject({ top: full('ledger').top, bottom: full('ledger').bottom })
  })

  it('⭐ the stem shrinks TOWARD its head — its base stays, its tip comes in', () => {
    const full = inkOf(false)('stem')
    const cue = inkOf(true)('stem')
    // Stem up from C♯4: the base is the box's bottom.
    expect(cue.bottom).toBeCloseTo(full.bottom, 9)
    expect(cue.bottom - cue.top).toBeCloseTo((full.bottom - full.top) * 0.75, 9)
  })

  it('⭐ the room follows the armed preset', () => {
    setCueSize(0.5)
    expect(inkOf(true)('note').right).toBeCloseTo(inkOf(false)('note').right * 0.5, 9)
  })
})
