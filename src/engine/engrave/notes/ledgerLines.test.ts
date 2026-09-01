/**
 * The ledger line's rule, in jsdom — ⭐ which is the point of taking it: the same assertions used to
 * need a browser, because the only record of a drawn line was the DOM.
 *
 * ⚠️ Ink EXTENTS are still not testable here (a glyph's drawn width needs a font), so the head width
 * is a parameter and these specs hand it one — exactly as the three callers do.
 */
import { describe, it, expect } from 'vitest'
import { ledgerLineRuns, drawLedgerLines, type LedgerLineRun } from './ledgerLines'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, ScenePrimitive } from '@/engine/scene/Scene'

type ScenePath = Extract<ScenePrimitive, { kind: 'path' }>

/** The paths a recorder wrote down, in draw order. */
function paths(scene: Scene): ScenePath[] {
  return scene.children.filter((c): c is ScenePath => c.kind === 'path')
}

/** Bravura's notehead at a 10 px staff space, near enough — these specs care about arithmetic. */
const HEAD = 11.8
/** VexFlow's `StaveNote.LEDGER_LINE_OFFSET`, which is what we draw with today (⛔ not the font's 0.4). */
const OVERHANG = 3

describe('ledgerLineRuns — which lines, and how far each runs', () => {
  it('a note inside the staff forces none', () => {
    expect(ledgerLineRuns([{ line: 3, x: 100 }], HEAD, OVERHANG)).toEqual([])
    // The staff's own outermost lines are 1 and 5, and neither is a ledger.
    expect(ledgerLineRuns([{ line: 1, x: 100 }, { line: 5, x: 100 }], HEAD, OVERHANG)).toEqual([])
  })

  it('⭐ middle C in treble — ONE line, centred on the head', () => {
    const runs = ledgerLineRuns([{ line: 0, x: 100 }], HEAD, OVERHANG)
    expect(runs).toEqual([{ line: 0, x1: 97, x2: 100 + HEAD + 3 }])
  })

  it('the levels run OUTWARD from the staff, one per whole line, and stop at the head', () => {
    expect(ledgerLineRuns([{ line: 8, x: 0 }], HEAD, OVERHANG).map(r => r.line)).toEqual([6, 7, 8])
    expect(ledgerLineRuns([{ line: -2, x: 0 }], HEAD, OVERHANG).map(r => r.line)).toEqual([0, -1, -2])
  })

  it('a head IN A SPACE hangs off the last whole line below it — 7.5 gets 6 and 7, not 7.5', () => {
    expect(ledgerLineRuns([{ line: 7.5, x: 0 }], HEAD, OVERHANG).map(r => r.line)).toEqual([6, 7])
  })

  it('a note off BOTH ends (a two-head chord spanning the staff) gets both stacks', () => {
    const runs = ledgerLineRuns([{ line: -1, x: 0 }, { line: 7, x: 0 }], HEAD, OVERHANG)
    expect(runs.map(r => r.line)).toEqual([6, 7, 0, -1])
  })

  describe('⭐⭐ a DISPLACED head — Gould p. 27', () => {
    // A second across the stem: the upper head is pushed a notehead to the right (stems up), less
    // half a stem width. This is exactly VexFlow's `NoteHead.getAbsoluteX` displacement.
    const STEM = 1.5
    const displacedX = 100 + HEAD - STEM / 2

    it('*"when the displaced note is on a line, the ledger line extends the full width of both"*', () => {
      const runs = ledgerLineRuns([{ line: 7, x: 100 }, { line: 8, x: displacedX }], HEAD, OVERHANG)
      const outermost = runs.find(r => r.line === 8)!
      const shared = runs.find(r => r.line === 7)!
      // Level 7 is reached by BOTH heads, so it spans them.
      expect(shared.x1).toBe(100 - OVERHANG)
      expect(shared.x2).toBe(displacedX + HEAD + OVERHANG)
      // 🚨 …and that width is VexFlow's `doubleWidth` to the pixel — `2 * (glyphWidth + strokePx) -
      // Stem.WIDTH / 2` — which is the check that this rule REPLACED an implementation rather than
      // guessed at one.
      expect(shared.x2 - shared.x1).toBeCloseTo(2 * (HEAD + OVERHANG) - STEM / 2, 10)
      // Level 8 is reached by the displaced head alone: *"shortened to single notehead width"*.
      expect(outermost.x2 - outermost.x1).toBeCloseTo(HEAD + 2 * OVERHANG, 10)
      expect(outermost.x1).toBe(displacedX - OVERHANG)
    })

    it('…and a head further out than the pair takes a single-width line of its own', () => {
      const runs = ledgerLineRuns(
        [{ line: 6, x: 100 }, { line: 7, x: displacedX }, { line: 9, x: 100 }], HEAD, OVERHANG)
      expect(runs.find(r => r.line === 9)!.x2 - runs.find(r => r.line === 9)!.x1)
        .toBeCloseTo(HEAD + 2 * OVERHANG, 10)
      // Level 6 is under all three, so it is the wide one.
      expect(runs.find(r => r.line === 6)!.x2).toBe(displacedX + HEAD + OVERHANG)
    })
  })

  it('a TRIMMED overhang shortens both ends — the accidental clearance’s one lever', () => {
    const full = ledgerLineRuns([{ line: 0, x: 100 }], HEAD, 3)[0]
    const trimmed = ledgerLineRuns([{ line: 0, x: 100 }], HEAD, 2)[0]
    expect(trimmed.x1 - full.x1).toBe(1)
    expect(full.x2 - trimmed.x2).toBe(1)
  })

  it('no heads at all (a rest) forces nothing', () => {
    expect(ledgerLineRuns([], HEAD, OVERHANG)).toEqual([])
  })
})

describe('drawLedgerLines — the ink', () => {
  const runs: LedgerLineRun[] = [{ line: 0, x1: 97, x2: 115 }, { line: -1, x1: 97, x2: 115 }]
  const yOfLine = (line: number): number => 100 + (5 - line) * 10

  it('⭐ one stroked two-point path per run, at the staff’s own y', () => {
    const recorder = new SceneRecorder()
    drawLedgerLines(recorder, runs, yOfLine, { strokeStyle: '#444', lineWidth: 2 })
    const drawn = paths(recorder.scene)
    expect(drawn).toHaveLength(2)
    expect(drawn[0]).toMatchObject({
      painted: 'stroke',
      ops: [{ op: 'moveTo', x: 97, y: 150 }, { op: 'lineTo', x: 115, y: 150 }],
      style: { stroke: '#444', lineWidth: 2 },
    })
    // ⭐ The y comes from the CALLER's staff, never from arithmetic here — rule 5.
    expect(drawn[1]).toMatchObject({ ops: [{ op: 'moveTo', x: 97, y: 160 }, { op: 'lineTo', x: 115, y: 160 }] })
  })

  it('⛔ draws nothing at all — not even a save — when there is nothing to draw', () => {
    const recorder = new SceneRecorder()
    drawLedgerLines(recorder, [], yOfLine, { strokeStyle: '#444' })
    expect(recorder.scene.children).toEqual([])
  })

  it('⚠️ leaves an unset style property alone, exactly as `Element.applyStyle` does', () => {
    const recorder = new SceneRecorder()
    recorder.setStrokeStyle('#000')
    drawLedgerLines(recorder, runs.slice(0, 1), yOfLine, { lineWidth: 2 })
    expect(paths(recorder.scene)[0].style.stroke, 'the context kept the colour it had').toBe('#000')
  })
})
