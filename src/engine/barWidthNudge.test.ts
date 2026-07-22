// @vitest-environment jsdom
/**
 * The keyboard half of bar width (docs/bar-width-plan.md §4–§6, P1) — and above all the two
 * things that are NOT arithmetic we may invent.
 *
 * The barline must land where the gesture asked, which needs the §4 inversion (widening a bar
 * shrinks its own justified share AND every bar's before it on the line, so the barline moves by
 * less than was added). And the only real limit is the one measured off the last render — the room
 * the bar's own music is using.
 *
 * ⚠️ Running out of line is NOT a limit: the music re-wraps, as it does in Sibelius / Finale /
 * MuseScore. Neither is a pinned system-ending barline: it cannot move, but its bar can still be
 * resized, and that is exactly how a bar travels between systems. Both were walls once (plan §5),
 * both were reported as the gesture seizing up, and both are gone.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate } from '@/utils/fraction'
import { LAYOUT_CONFIG } from './rendering/layoutConfig'
import type { NoteParams } from '@/types/music'

const STEP_PX = 10

describe('MusicEngine.barWidthRoom', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  /** `count` bars of four quarter notes, drawn. */
  const bars = (count: number) => {
    while (engine.getScore().measures.length < count) engine.addMeasure()
    for (let m = 1; m <= count; m++) {
      for (const beat of [0, 1, 2, 3]) {
        engine.addNoteAtBeat({
          step: 'C', octave: 4, duration: 'q', measure: m, beat: fracCreate(beat, 1),
        } as NoteParams)
      }
    }
    engine.renderScore()
  }

  /** Which system a bar was drawn on, read off the picture: bars on one system share a top line. */
  const topY = (measure: number): number =>
    engine.getElementRegistry().getStaffGeometry(measure, 0)!.lineYPositions[0]

  /** The bars sharing a system with bar 1, in order — the line the tests work on. */
  const lineOfBarOne = (): number[] =>
    engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1))

  it('declines before anything is drawn — an unrendered bar has no picture to measure', () => {
    while (engine.getScore().measures.length < 3) engine.addMeasure()
    expect(engine.barWidthRoom(1)).toBeNull()
  })

  it('reports the system-ending barline as PINNED — slope 0, but still an answer', () => {
    // It cannot move (justification holds it at the right margin), and that must not be read as
    // "this bar cannot be resized": resizing it is how music moves between systems.
    bars(8)
    const line = lineOfBarOne()
    expect(line.length).toBeGreaterThan(1) // otherwise this asserts nothing
    const room = engine.barWidthRoom(line[line.length - 1])!
    expect(room).not.toBeNull()
    expect(room.barlineSlope).toBe(0)
  })

  it('answers on a bar that is not last on its line, with a slope strictly between 0 and 1', () => {
    bars(8)
    const room = engine.barWidthRoom(lineOfBarOne()[0])!
    expect(room).not.toBeNull()
    expect(room.barlineSlope).toBeGreaterThan(0)
    expect(room.barlineSlope).toBeLessThan(1)
    expect(room.noteSpace).toBeGreaterThan(0)
    expect(room.stretch).toBe(1)
  })

  it('on the FIRST bar of a line the two slopes coincide — nothing sits left of it to slide', () => {
    bars(8)
    const room = engine.barWidthRoom(lineOfBarOne()[0])!
    expect(room.barlineSlope).toBeCloseTo(room.widthSlope, 9) // P(m) = I(m)
  })

  it('…and further along the line the barline moves LESS than the bar grows', () => {
    bars(8)
    const line = lineOfBarOne()
    expect(line.length).toBeGreaterThan(2) // a middle bar has to exist for this to assert anything
    const room = engine.barWidthRoom(line[1])!
    // The bars BEFORE it shrink too and slide its barline back: P(m) > I(m), so the slope is lower.
    expect(room.barlineSlope).toBeLessThan(room.widthSlope)
  })

  it('linear view takes the other branch — nothing is justified, so the slope is exactly 1', () => {
    bars(4)
    engine.setViewMode('linear')
    engine.renderScore()
    const room = engine.barWidthRoom(1)!
    expect(room.barlineSlope).toBe(1)
    expect(room.widthSlope).toBe(1)
  })

  it('declines an unknown measure', () => {
    bars(4)
    expect(engine.barWidthRoom(99)).toBeNull()
  })
})

describe('MusicEngine.nudgeBarWidth', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 8) engine.addMeasure()
    for (let m = 1; m <= 8; m++) {
      for (const beat of [0, 1, 2, 3]) {
        engine.addNoteAtBeat({
          step: 'C', octave: 4, duration: 'q', measure: m, beat: fracCreate(beat, 1),
        } as NoteParams)
      }
    }
    engine.renderScore()
  })

  /** One press, exactly as `shortcutWiring` does it: nudge, then repaint — the repaint is part of
   *  the gesture, because the next press measures itself against the new picture. */
  const press = (measure: number, deltaPx: number): number | null => {
    const stored = engine.nudgeBarWidth(measure, deltaPx)
    engine.renderScore()
    return stored
  }

  /** Where the barline ENDING this bar was drawn — the thing the gesture claims to move. */
  const barlineXOf = (measure: number): number =>
    engine.getElementRegistry().getStaffGeometry(measure, 0)!.noteEndX

  const topY = (measure: number): number =>
    engine.getElementRegistry().getStaffGeometry(measure, 0)!.lineYPositions[0]

  const systemCount = (): number =>
    new Set(engine.getScore().measures.map(m => topY(m.number))).size

  const lastOfBarOnesLine = (): number =>
    engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).pop()!

  it('⭐ the barline moves by what was asked — the §4 inversion, not the raw stretch', () => {
    const before = barlineXOf(1)
    press(1, STEP_PX)
    // Within a pixel: the closed form is exact, the drawn barline carries VexFlow's own rounding.
    expect(barlineXOf(1) - before).toBeCloseTo(STEP_PX, 0)
  })

  it('accumulates: two presses move the barline twice as far', () => {
    const before = barlineXOf(1)
    press(1, STEP_PX)
    press(1, STEP_PX)
    expect(barlineXOf(1) - before).toBeCloseTo(STEP_PX * 2, 0)
  })

  it('widen then tighten returns to where it started', () => {
    press(1, STEP_PX * 3)
    press(1, -STEP_PX * 3)
    expect(engine.getBarWidth(1)).toBeCloseTo(1, 3)
  })

  it('stops at the floor rather than crushing the music, and stays there', () => {
    let last = 1
    for (let i = 0; i < 100; i++) last = press(1, -STEP_PX)!
    expect(last).toBeGreaterThan(0) // finite, positive — never marched through zero
    expect(press(1, -STEP_PX)).toBeCloseTo(last, 6)
  })

  it('⭐ running out of line RE-WRAPS — a bar goes to the next system, it does not get stuck', () => {
    // Reported from use: stopping at the line's capacity reads as the bar seizing up for no visible
    // reason. Sibelius / Finale / MuseScore all re-wrap instead, and so do we.
    const barsOnLineBefore = engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).length
    for (let i = 0; i < 40; i++) press(1, STEP_PX)
    const barsOnLineAfter = engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).length
    expect(barsOnLineAfter).toBeLessThan(barsOnLineBefore)
    expect(systemCount()).toBeGreaterThan(1)
  })

  it('…and shrinking pulls one back up, so the gesture is reversible', () => {
    for (let i = 0; i < 40; i++) press(1, STEP_PX)
    const squeezed = engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).length
    for (let i = 0; i < 80; i++) press(1, -STEP_PX)
    expect(engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).length)
      .toBeGreaterThan(squeezed)
  })

  it('⭐ crossing the casting-off boundary costs ONE press each way', () => {
    // Reported from use, off the console log: one press pushed the last bar down onto the next
    // system and TEN were needed to bring it back. Once bar 1 is alone nothing about it can move,
    // so the per-pixel fallback was spending presses on a picture that could not change — in a unit
    // ~10× smaller than the slope-scaled press that had just crossed the boundary.
    const onLineOne = () =>
      engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1)).length
    for (let i = 0; i < 200 && onLineOne() > 1; i++) press(1, STEP_PX)
    expect(onLineOne()).toBe(1) // bar 1 now holds the system by itself

    press(1, -STEP_PX)
    expect(onLineOne()).toBeGreaterThan(1) // …one press brings a bar back up

    press(1, STEP_PX)
    expect(onLineOne()).toBe(1) // …and one press puts it back down
  })

  it('the MOUSE answer stays continuous in that same state — it never jumps the casting-off', () => {
    // The two solvers diverge only here, and the drag must take the other branch: teleporting the
    // layout while a pointer holds the barline is the desync §4 exists to prevent.
    for (let i = 0; i < 200; i++) press(1, STEP_PX)
    const room = engine.barWidthRoom(1)!
    expect(room.barlineSlope).toBe(0)               // pinned: P2 should decline the grab here
    expect(room.stretchForBarlineDelta(-STEP_PX)).toBe(room.stretch) // …and nothing moves meanwhile
    expect(room.stretchForStep(-STEP_PX)).toBeLessThan(room.stretch) // while a key press jumps
  })

  it('the system-ending bar RESIZES even though its barline cannot move', () => {
    const last = lastOfBarOnesLine()
    const before = engine.getBarWidth(last)
    expect(press(last, STEP_PX)).not.toBeNull()
    expect(engine.getBarWidth(last)).toBeGreaterThan(before)
  })

  it('⭐ a bar can be stretched until it IS the whole line, and stops exactly there', () => {
    // The thing a fixed multiplier ceiling made unreachable: 8× the note space is a third of a line
    // on a sparse bar. The ceiling is the line itself, derived per bar.
    for (let i = 0; i < 120; i++) press(1, STEP_PX)
    expect(engine.getScore().measures.map(m => m.number).filter(n => topY(n) === topY(1))).toEqual([1])
    // Alone on its system, justified to the full line — and further pressing changes nothing.
    const filled = engine.getBarWidth(1)
    expect(press(1, STEP_PX)).toBeCloseTo(filled, 6)
    expect(barlineXOf(1)).toBeGreaterThan(LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 3)
  })

  it('a bar stretched until it is alone on its system can still be brought back', () => {
    // The trap a decline-when-pinned rule would have left: no key could undo it but Backspace.
    for (let i = 0; i < 60; i++) press(1, STEP_PX)
    const wide = engine.getBarWidth(1)
    for (let i = 0; i < 20; i++) press(1, -STEP_PX)
    expect(engine.getBarWidth(1)).toBeLessThan(wide)
  })

  it('each press is its own undo step, and undo puts the width back', () => {
    press(1, STEP_PX)
    const one = engine.getBarWidth(1)
    press(1, STEP_PX)
    expect(engine.getBarWidth(1)).not.toBe(one)
    engine.undo()
    expect(engine.getBarWidth(1)).toBeCloseTo(one, 6)
    engine.undo()
    expect(engine.getBarWidth(1)).toBe(1)
  })
})

describe('shrinking an EMPTY bar', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 4) engine.addMeasure()
    // One busy bar, the rest untouched — the reported case: "one really long and one normal, and
    // there is still space to shrink on it".
    for (const eighth of [0, 1, 2, 3, 4, 5, 6, 7]) {
      engine.addNoteAtBeat({
        step: 'C', octave: 4, duration: '8', measure: 1, beat: fracCreate(eighth, 2),
      } as NoteParams)
    }
    engine.renderScore()
  })

  const width = (measure: number): number => {
    const g = engine.getElementRegistry().getStaffGeometry(measure, 0)!
    return g.noteEndX - g.noteStartX
  }

  it('⭐ it gets out of the way — and the room goes to the bar that has music', () => {
    const emptyBefore = width(3)
    const busyBefore = width(1)
    for (let i = 0; i < 12; i++) { engine.nudgeBarWidth(3, -10); engine.renderScore() }
    // Better than halved, not the ~6% the reserved-space model could manage.
    expect(width(3)).toBeLessThan(emptyBefore * 0.5)
    expect(width(1)).toBeGreaterThan(busyBefore)
  })

  it('stops where one column of music would: it never collapses past the rest', () => {
    let last = 1
    for (let i = 0; i < 40; i++) { last = engine.nudgeBarWidth(3, -10)!; engine.renderScore() }
    expect(engine.nudgeBarWidth(3, -10)).toBeCloseTo(last, 6)
    expect(width(3)).toBeGreaterThan(LAYOUT_CONFIG.MIN_NOTE_SPACING)
  })

  it('a bar WITH music keeps the floor as planned — its music still sets its claim', () => {
    // The scoping the user drew: only the empty case changed. Bar 1 is busy, so shrinking it stops
    // at the measured MIN_NOTE_SPACING-per-column floor, well short of an empty bar's range.
    const before = width(1)
    for (let i = 0; i < 40; i++) { engine.nudgeBarWidth(1, -10); engine.renderScore() }
    expect(width(1)).toBeGreaterThan(before * 0.5)
  })

  it('is reversible — widening puts it back', () => {
    // Two presses, deliberately: an empty bar's whole shrink range is only a few of them (the
    // multiplier has far less room below 1 than above it), and pressing INTO the floor and back
    // out again overshoots — the dead presses have nothing to undo. Worth knowing.
    const before = width(3)
    for (let i = 0; i < 2; i++) { engine.nudgeBarWidth(3, -10); engine.renderScore() }
    expect(width(3)).toBeLessThan(before)
    for (let i = 0; i < 2; i++) { engine.nudgeBarWidth(3, 10); engine.renderScore() }
    expect(width(3)).toBeCloseTo(before, 0)
  })
})

describe('MusicEngine.resetBarWidth', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 6) engine.addMeasure()
    for (let m = 1; m <= 6; m++) {
      for (const beat of [0, 1, 2, 3]) {
        engine.addNoteAtBeat({
          step: 'C', octave: 4, duration: 'q', measure: m, beat: fracCreate(beat, 1),
        } as NoteParams)
      }
    }
    engine.renderScore()
  })

  it('drops the stretch in one step, however many presses made it', () => {
    for (let i = 0; i < 5; i++) { engine.nudgeBarWidth(1, STEP_PX); engine.renderScore() }
    const stretched = engine.getBarWidth(1)
    expect(stretched).not.toBe(1)
    expect(engine.resetBarWidth(1)).toBe(true)
    expect(engine.getBarWidth(1)).toBe(1)
    expect(JSON.parse(engine.exportJSON()).engravingOverrides ?? {}).toEqual({})
    engine.undo()
    expect(engine.getBarWidth(1)).toBeCloseTo(stretched, 6)
  })

  it('says false when there was nothing to reset, so the key can fall through', () => {
    expect(engine.resetBarWidth(1)).toBe(false)
  })
})
