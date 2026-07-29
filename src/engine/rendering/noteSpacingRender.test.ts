// @vitest-environment jsdom
/**
 * Note spacing at draw time (docs/note-spacing-plan.md §4) — **move the columns, never the glyphs.**
 *
 * Everything here runs in LINEAR view on purpose. Wrapped view re-justifies the whole line when a
 * bar grows, so every x moves a little and no exact assertion survives; linear view gives each bar
 * its intrinsic width verbatim, so the widened note area and the reduced format width cancel and
 * the shift is the *only* thing that moved. That is what makes "moved by exactly 30px" testable.
 *
 * The load-bearing test is the multi-staff one. Each staff formats in its own `Formatter`, so if
 * the anchor were resolved as "the slot at that beat" instead of "the first column at or after that
 * tick", a staff with no note starting there would never shift — and the grand staff would drift
 * apart, which is the exact failure the key drops `staffId` to prevent.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { fracCreate } from '@/utils/fraction'
import { STAFF_SPACE_PX } from '../models/staffSize'
import type { NoteParams } from '@/types/music'

const SPACES = 3
const PX = SPACES * STAFF_SPACE_PX

describe('note spacing — render (§4)', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    engine.setViewMode('linear')
  })

  const put = (p: Omit<Partial<NoteParams>, 'beat'> & { beat: number }) =>
    engine.addNoteAtBeat({
      step: 'C', octave: 4, duration: 'q', measure: 1, ...p, beat: fracCreate(p.beat, 1),
    } as NoteParams)

  /** Every note/rest's x, keyed `staff:beat` — read back off the registry, which registers
   *  post-draw, so it is the drawn truth and not a prediction of it. */
  const columns = (): Map<string, number> => {
    engine.renderScore()
    const out = new Map<string, number>()
    for (const type of ['note', 'rest'] as const) {
      for (const el of engine.getElementRegistry().getByType(type)) {
        out.set(`${el.staff ?? 0}:${el.beat}`, el.headX ?? el.bbox.x)
      }
    }
    return out
  }

  it('everything at and right of the anchor moves by exactly the authored space; nothing left of it moves', () => {
    for (const beat of [0, 1, 2, 3]) put({ beat })
    const before = columns()

    engine.setNoteSpacing(1, fracCreate(2, 1), SPACES, -10)
    const after = columns()

    expect(after.get('0:0')!).toBeCloseTo(before.get('0:0')!, 4)
    expect(after.get('0:1')!).toBeCloseTo(before.get('0:1')!, 4)
    expect(after.get('0:2')!).toBeCloseTo(before.get('0:2')! + PX, 4)
    expect(after.get('0:3')!).toBeCloseTo(before.get('0:3')! + PX, 4)
  })

  it('two spaces in one bar accumulate — the second column pays for both', () => {
    for (const beat of [0, 1, 2, 3]) put({ beat })
    const before = columns()

    engine.setNoteSpacing(1, fracCreate(1, 1), SPACES, -10)
    engine.setNoteSpacing(1, fracCreate(3, 1), SPACES, -10)
    const after = columns()

    expect(after.get('0:0')!).toBeCloseTo(before.get('0:0')!, 4)
    expect(after.get('0:1')!).toBeCloseTo(before.get('0:1')! + PX, 4)
    expect(after.get('0:2')!).toBeCloseTo(before.get('0:2')! + PX, 4)
    expect(after.get('0:3')!).toBeCloseTo(before.get('0:3')! + PX * 2, 4)
  })

  it('a negative space pulls the column left', () => {
    for (const beat of [0, 1, 2, 3]) put({ beat })
    const before = columns()

    engine.setNoteSpacing(1, fracCreate(2, 1), -1, -10)
    const after = columns()

    expect(after.get('0:2')!).toBeCloseTo(before.get('0:2')! - STAFF_SPACE_PX, 4)
  })

  it('⭐ a staff with NO note at the anchor beat still shifts — the anchor is a tick, not a slot', () => {
    engine.addStaffBelow(0)
    for (const beat of [0, 1, 2, 3]) put({ beat })                        // staff 0: q q q q
    put({ beat: 0, duration: 'h', staff: 1 })                             // staff 1: h  h
    put({ beat: 2, duration: 'h', staff: 1 })
    const before = columns()

    // Beat 1 exists on staff 0 only. Staff 1's first column at or after it is beat 2, and it has to
    // move by the same amount or the two staves stop sharing a column.
    engine.setNoteSpacing(1, fracCreate(1, 1), SPACES, -10)
    const after = columns()

    expect(after.get('1:0')!).toBeCloseTo(before.get('1:0')!, 4)
    expect(after.get('1:2')!).toBeCloseTo(before.get('1:2')! + PX, 4)
    // …which is the same thing said the other way: the beat-2 column is still ONE column.
    expect(after.get('0:2')! - after.get('1:2')!).toBeCloseTo(before.get('0:2')! - before.get('1:2')!, 4)
  })

  it('a second voice with nothing at the anchor beat rides its neighbours’ column', () => {
    for (const beat of [0, 1, 2, 3]) put({ beat })                        // V1: q q q q
    put({ beat: 0, duration: 'h', octave: 5, voice: 1 })                  // V2: h  h
    put({ beat: 2, duration: 'h', octave: 5, voice: 1 })
    const before = columns()

    engine.setNoteSpacing(1, fracCreate(2, 1), SPACES, -10)
    const after = columns()

    // Both voices' beat-2 events share one TickContext, so they move together — and are still
    // stacked on the same x afterwards.
    expect(after.get('0:2')!).toBeCloseTo(before.get('0:2')! + PX, 4)
  })

  it('a space in one bar does not move another bar’s columns', () => {
    engine.addMeasure()
    for (const beat of [0, 1, 2, 3]) put({ beat })
    for (const beat of [0, 1, 2, 3]) {
      engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: fracCreate(beat, 1) } as NoteParams)
    }
    engine.renderScore()
    const before = engine.getElementRegistry().getByType('note').filter(n => n.measure === 2).length
    expect(before).toBe(4)

    engine.setNoteSpacing(1, fracCreate(2, 1), SPACES, -10)
    engine.renderScore()

    // Bar 2 slides right as a whole (bar 1 got wider), but its INTERNAL spacing is untouched: the
    // gaps between its own columns are what would betray a leaked shift.
    const bar2 = engine.getElementRegistry().getByType('note')
      .filter(n => n.measure === 2)
      .sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0))
    expect(bar2).toHaveLength(before)
    const gaps = bar2.slice(1).map((n, i) => (n.headX ?? n.bbox.x) - (bar2[i].headX ?? bar2[i].bbox.x))
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 4)
  })

  it('a score with no authored space renders exactly as it did', () => {
    for (const beat of [0, 1, 2, 3]) put({ beat })
    const before = columns()
    const after = columns()
    for (const [key, x] of before) expect(after.get(key)!).toBeCloseTo(x, 6)
  })
})
