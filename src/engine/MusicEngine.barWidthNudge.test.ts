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
import { MIN_COLUMN_GAP } from './layout/spacingPadding'
import { STAFF_SPACE_PX } from './models/staffSize'
import { SKETCH_CANVAS } from './layout/surface'

/** VexFlow's `Stave.padding`: in every note's `getAbsoluteX` and in no stave's `getNoteStartX`. */
const STAVE_PADDING_PX = 12
import type { NoteParams } from '@/types/music'

const STEP_PX = 10

describe('MusicEngine.barWidthRoom', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  /** `count` bars of four quarter notes, drawn.
   *
   * ⚠️ Callers asking about JUSTIFICATION must pass enough bars to fill more than one system. The
   * last system is ragged by default now (LilyPond's `ragged-last`), and on a ragged line there is
   * no transfer to invert: the bar grows, nothing pays, and the slope is 1. Correct — but it is not
   * what a test about the §4 inversion means to measure. */
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

  it('answers on a bar mid-line, with a slope strictly between 0 and 1', () => {
    bars(24) // more than one system, so the tested line is justified rather than the ragged last
    const line = lineOfBarOne()
    expect(line.length).toBeGreaterThan(2) // a middle bar must exist for this to assert anything
    const room = engine.barWidthRoom(line[1])!
    expect(room).not.toBeNull()
    expect(room.barlineSlope).toBeGreaterThan(0)
    expect(room.barlineSlope).toBeLessThan(1)
    expect(room.noteSpace).toBeGreaterThan(0)
    expect(room.stretch).toBe(1)
  })

  it('…and on the FIRST bar of a line the slope is exactly 1 — everything that pays sits right of it', () => {
    // Growth is a transfer now: the bars that give the room up are chosen by content, not by
    // position, and for the opening bar every one of them is to its right. So nothing slides its
    // barline back and it moves by precisely what was asked. Under the old proportional model the
    // bar shrank its own justified share too, so it always moved less — the promise §4 exists to
    // make was the one thing it could not quite keep.
    bars(8)
    expect(engine.barWidthRoom(lineOfBarOne()[0])!.barlineSlope).toBe(1)
  })

  it('on the FIRST bar of a line the two slopes coincide — nothing sits left of it to slide', () => {
    bars(8)
    const room = engine.barWidthRoom(lineOfBarOne()[0])!
    expect(room.barlineSlope).toBeCloseTo(room.widthSlope, 9) // P(m) = I(m)
  })

  it('…and further along the line the barline moves LESS than the bar grows', () => {
    bars(24)
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

    // …and TWO put it back down. The reported bug was the 1-vs-10 asymmetry, and that is what this
    // guards; 2 is the plan's own known issue #4 (the threshold aims conservatively, because the bar
    // below is measured as a line-opener carrying a full clef it stops paying once it moves up).
    // A line now also SQUEEZES before it wraps — a growing bar takes room from its neighbours first
    // — so there is a little more to absorb on the way out than there used to be. Measured, not
    // guessed: the loop reports exactly 2.
    let presses = 0
    while (onLineOne() > 1 && presses < 20) { press(1, STEP_PX); presses++ }
    expect(onLineOne()).toBe(1)
    expect(presses).toBeLessThanOrEqual(2)
  })

  it('the MOUSE answer stays continuous in that same state — it moves, but never jumps', () => {
    // The two solvers diverge only here. The drag must not jump (teleporting the layout under a
    // pointer is the desync §4 exists to prevent) and must not freeze either — a drag that reaches
    // this state mid-gesture would be dead in the hand, and a bar stretched to fill its system
    // could never be dragged back. So: a small continuous step for the mouse, a threshold jump for
    // the key.
    for (let i = 0; i < 200; i++) press(1, STEP_PX)
    const room = engine.barWidthRoom(1)!
    expect(room.barlineSlope).toBe(0) // pinned — no stretch moves this barline
    const mouse = room.stretchForBarlineDelta(-STEP_PX)
    const key = room.stretchForStep(-STEP_PX)
    expect(mouse).toBeLessThan(room.stretch)              // it does move…
    expect(mouse).toBeGreaterThan(key)                    // …by far less than the key's jump
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
    expect(barlineXOf(1)).toBeGreaterThan(SKETCH_CANVAS.widthPx - SKETCH_CANVAS.marginPx * 3)
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
    // ⚠️ Enough bars to fill more than one system. Four fit on one, and one line is the LAST line,
    // which is ragged by default — nothing is justified there, so nothing is transferred and no
    // neighbour takes up what an empty bar gives back. That is correct, and it is not what this
    // block is about.
    while (engine.getScore().measures.length < 24) engine.addMeasure()
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

    // ONE press, while the line still holds the same bars: the empty bar gives room back and the bar
    // with music takes it. THAT transfer is the feature, and it is what a share proportional to a
    // lowered claim buys.
    //
    // ⚠️ One and not two, and the count is not arbitrary — it is how much room the line has spare
    //    before another bar fits on it. It has moved twice as the spacing model landed (three
    //    presses, then two, now one) because the model keeps changing how wide a bar of music is.
    //    The number is a property of THIS fixture, never of the feature; the paragraph below is what
    //    the feature actually promises.
    engine.nudgeBarWidth(3, -10)
    engine.renderScore()
    expect(width(3), 'the empty bar stood down').toBeLessThan(emptyBefore)
    expect(width(1), 'and the bar with music took the room').toBeGreaterThan(busyBefore)

    // ⚠️ Keep pressing and bar 1 comes back DOWN — because the room given up is soon enough for an
    // EIGHTH bar to join the line, and eight bars share what seven had. That is casting-off doing its
    // job, not the transfer failing, and it is new only in scale: the spacing model made a bar of
    // music ask for the room its durations earn instead of a flat 1.8 spaces an event, so a 900px
    // line holds seven bars where it used to hold nine and a re-cast is a press or two away instead
    // of never. The empty bar's own gesture is unaffected — it goes on shrinking to its floor and
    // lands at ~28% of where it started, comfortably past the 0.7 the complaint was about (the
    // reserved-space model this replaced could manage about 6%).
    for (let i = 0; i < 10; i++) { engine.nudgeBarWidth(3, -10); engine.renderScore() }
    expect(width(3)).toBeLessThan(emptyBefore * 0.7)
  })

  it('⭐ the rest stays CENTRED however narrow the bar gets', () => {
    // Reported by eye: a shrunk empty bar looked like it had lost its room from the right, because
    // VexFlow centres the measure rest on the box the formatter was handed (`formatWidth`) rather
    // than on the bar's note area. The two differ by a constant ~4px — nothing in a wide bar, plainly
    // off-centre in an 87px one. See VexFlowRenderer.centerMeasureRests.
    //
    // ⚠️ Under jsdom a glyph measures 0 wide, so `bbox.width` is 0 and this compares the rest's
    // ANCHOR against the area centre. That is still exactly what the fix moves, and the offset it
    // corrects has no glyph-width term in it — but it does mean a browser is what proves the glyph
    // itself looks centred.
    // ⚠️ Measured against the BAR — its own two barlines — and not against the registry's note area.
    //    Those differ by `Stave.padding`, and centring on the note area is what put every measure
    //    rest 0.65 staff spaces right of its bar until he caught it by eye. What a reader judges a
    //    whole-bar rest against is the space between the lines either side of it.
    const offset = (m: number): number => {
      // The bar's own span — barline to barline. `noteStartX` would be the note AREA, which is a
      // `Stave.padding` narrower on the left and is exactly the thing that was off.
      const geo = engine.getElementRegistry().getStaffGeometry(m, 0)!
      const bounds = { measureX: geo.noteStartX - STAVE_PADDING_PX, measureWidth: geo.noteEndX - geo.noteStartX + STAVE_PADDING_PX }
      const rest = engine.getElementRegistry().getByMeasure(m).find(e => e.type === 'rest')!
      return (rest.bbox.x + rest.bbox.width / 2) - (bounds.measureX + bounds.measureWidth / 2)
    }
    const wide = width(3)
    expect(offset(3)).toBeCloseTo(0, 6)
    for (let i = 0; i < 6; i++) { engine.nudgeBarWidth(3, -10); engine.renderScore() }
    // Genuinely narrower — otherwise the assertion below proves nothing.
    expect(width(3)).toBeLessThan(wide * 0.8)
    expect(offset(3)).toBeCloseTo(0, 6)
  })

  it('⭐ keeps shrinking when the neighbours are already at their floors', () => {
    // Reported from use, off the console log: after growing a bar hard and shrinking it back, the
    // stretch froze — every press stored the value it already had, and the log claimed the bar was
    // "alone on its system" while sitting next to seven others. Cause: the threshold-jump branch
    // was gated on `widthSlope === 0`, which under the transfer model also means "the neighbours
    // have nothing left to give" — and its shrink target is a fixed point there.
    //
    // Handing room BACK needs no payer, so a shrink must always move.
    for (let i = 0; i < 60; i++) { engine.nudgeBarWidth(3, 10); engine.renderScore() } // spend the line
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      const stored = engine.nudgeBarWidth(3, -10)
      engine.renderScore()
      expect(stored).not.toBeNull()
      seen.push(stored!)
    }
    // Strictly decreasing until the floor — never the same number twice running.
    const stuck = seen.findIndex((v, i) => i > 0 && Math.abs(v - seen[i - 1]) < 1e-9)
    expect({ stuck, seen: seen.map(v => +v.toFixed(3)) }).toEqual({ stuck: -1, seen: seen.map(v => +v.toFixed(3)) })
    expect(seen[seen.length - 1]).toBeLessThan(seen[0])
  })

  it('⭐ keeps shrinking when the bar BELOW is stretched too — the threshold jump is a fixed point there', () => {
    // Reported from use, reproduced from his score: bar 1 sat alone on system 1 at ×15.738 and every
    // ← press re-stored ×15.738. The threshold aims just past the first bar of the next system —
    // but that bar was ITSELF stretched (×4.625), so after the jump it still did not fit, bar 1 was
    // still alone, and the next press computed the identical target. A dead gesture that logs a jump.
    //
    // The fix is not a cleverer threshold (it would have to be right about every reason a bar might
    // not fit) — it is that a press which changes nothing falls back to a continuous step.
    engine.setBarWidth(1, 15.7375)
    engine.setBarWidth(2, 4.625)
    engine.renderScore()
    const seen: number[] = []
    for (let i = 0; i < 6; i++) {
      const stored = engine.nudgeBarWidth(1, -10)
      engine.renderScore()
      expect(stored).not.toBeNull()
      seen.push(stored!)
    }
    const stuck = seen.findIndex((v, i) => i > 0 && Math.abs(v - seen[i - 1]) < 1e-9)
    expect({ stuck, seen: seen.map(v => +v.toFixed(3)) }).toEqual({ stuck: -1, seen: seen.map(v => +v.toFixed(3)) })
    expect(seen[seen.length - 1]).toBeLessThan(15.7375)
  })

  it('stops where one column of music would: it never collapses past the rest', () => {
    let last = 1
    for (let i = 0; i < 40; i++) { last = engine.nudgeBarWidth(3, -10)!; engine.renderScore() }
    expect(engine.nudgeBarWidth(3, -10)).toBeCloseTo(last, 6)
    expect(width(3)).toBeGreaterThan(MIN_COLUMN_GAP * STAFF_SPACE_PX)
  })

  it('a bar WITH music keeps the floor as planned — its music still sets its claim', () => {
    // The scoping the user drew: only the empty case changed. Bar 1 is busy, so shrinking it stops
    // at the measured MIN_NOTE_SPACING-per-column floor, well short of an empty bar's range.
    //
    // ⚠️ Asserted against the model's own FLOOR, not against a fraction of where the bar started.
    // It used to say `> before × 0.5`, which held only while those two numbers happened to be close.
    // What the bar is entitled to is: it stops, it stops well short of collapsing, and it never
    // crosses the floor its own music sets — eight eighths are eight columns and a barline, so eight
    // GAPS, each floored at the tightest two noteheads may come.
    const before = width(1)
    for (let i = 0; i < 60; i++) { engine.nudgeBarWidth(1, -10); engine.renderScore() }
    const settled = width(1)
    engine.nudgeBarWidth(1, -10); engine.renderScore()
    expect(width(1), 'it has stopped — the presses are dead now').toBeCloseTo(settled, 6)
    expect(settled, 'and it stopped at or above its own music\'s floor')
      .toBeGreaterThanOrEqual(8 * MIN_COLUMN_GAP * STAFF_SPACE_PX)
    // ⚠️ It gives up very little now, and that IS its music setting its claim: these eighths are on
    //    C4, which in treble is a LEDGER note, and a ledger line is 1.80 staff spaces against a bare
    //    notehead's 1.13 (docs/spacing-model-plan.md P3.1). A run of ledgered eighths is nearly
    //    incompressible by construction. The bar still moves — it just has almost nothing to give.
    expect(settled, 'it did give something up').toBeLessThan(before)
  })

  it('is reversible — widening puts it back', () => {
    // A 3px press, not the 10px two of them used to be. Pressing INTO the floor and back out again
    // overshoots — the dead presses have nothing to undo — and an empty bar's whole shrink range is
    // now ONE ordinary press wide: its note space is its honest 40px rather than an inflated 80, so
    // every press is worth twice the multiplier it used to be. Coarse in the other direction from
    // the reported "36 presses to walk a bar across a system", and the same cause: the multiplier
    // is the wrong parameter for the step. docs/bar-width-plan.md "Known issues" #3.
    const before = width(3)
    engine.nudgeBarWidth(3, -3); engine.renderScore()
    expect(width(3)).toBeLessThan(before)
    engine.nudgeBarWidth(3, 3); engine.renderScore()
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

/**
 * The growth threshold when the line is SPENT — every neighbour already at its floor, but the bar
 * still has company. Its own describe because the state needs building: jsdom measures glyphs as
 * zero wide, so an ordinary score's line never runs out of slack and the bug cannot occur in it.
 * The neighbours are shrunk to `BAR_STRETCH_MIN` to put the line where his score was.
 */
describe('bar width — growing into a spent line', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 24) engine.addMeasure()
    for (const eighth of [0, 1, 2, 3, 4, 5, 6, 7]) {
      engine.addNoteAtBeat({
        step: 'G', octave: 4, duration: '8', measure: 3, beat: fracCreate(eighth, 2),
      } as NoteParams)
    }
    for (let m = 2; m <= 12; m++) engine.setBarWidth(m, 0.25) // spend the line
    engine.renderScore()
  })

  it('⭐ never leaps to the ceiling while the bar still has company', () => {
    // Reported off the log: ×4.750 → ×21.625 on ONE press. The growth threshold aims at "worth more
    // than the whole line" — right for a bar that is ALONE, badly wrong for one that merely has
    // neighbours with nothing left to give. Same mistake as the shrink direction had: a rule written
    // for a lone bar applied to a spent one. With company the threshold is where the LAST bar on the
    // line gets pushed off. Measured here: ×7.75 → ×21.63 before, ×7.75 → ×8.04 after.
    let previous = engine.getBarWidth(1)
    let sawCompany = false
    for (let i = 0; i < 30; i++) {
      const alone = engine.barWidthRoom(1)?.alone ?? false
      const stored = engine.nudgeBarWidth(1, STEP_PX)!
      engine.renderScore()
      if (!alone) {
        sawCompany = true
        expect(stored).toBeLessThan(previous * 2)
      }
      previous = stored
    }
    expect(sawCompany).toBe(true) // …or the loop above asserted nothing
  })
})

/**
 * The ceiling. Its own fixture because the bug needs a bar that becomes the whole system **while
 * still narrower than the line** — which only happens when a NEIGHBOUR is stretched too, so it is
 * pushed off early rather than by this bar filling the line. Taken from the reported score:
 * bar 2 at ×2.
 */
describe('bar width — the ceiling is where the bar becomes the system', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 64) engine.addMeasure()
    for (const eighth of [0, 1, 2, 3, 4]) {
      engine.addNoteAtBeat({
        step: 'F', octave: 4, duration: '8', measure: 3, beat: fracCreate(eighth, 2),
      } as NoteParams)
    }
    engine.setBarWidth(2, 2)
    engine.renderScore()
  })

  it('⭐ no press buys anything once the bar IS the system', () => {
    // Asked, from the log: "a measure has a max width, the width of the line, so after that we
    // should not add more". There WAS a ceiling — the stretch at which the bar's width reaches the
    // full line — but it is blind to the bar having already become the whole system by pushing its
    // neighbours off. Measured, as reported: alone at ×17.1, ceiling still ×21.6, so one press
    // bought +4.5 that drew the identical picture, seven more did nothing, and every unit had to be
    // walked back before anything moved. Reproduced here at ×17.14 against ×21.63.
    //
    // Dead range is worse than a wall: a wall you can see.
    let firstAlone: number | null = null
    for (let i = 0; i < 90; i++) {
      const room = engine.barWidthRoom(1)
      if (room?.alone && firstAlone === null) firstAlone = room.stretch
      engine.nudgeBarWidth(1, STEP_PX)
      engine.renderScore()
    }
    expect(firstAlone).not.toBeNull()
    // Not one pixel of stretch past the moment it became the system.
    expect(engine.getBarWidth(1)).toBeCloseTo(firstAlone!, 6)
    expect(engine.barWidthRoom(1)!.maxStretch).toBeCloseTo(firstAlone!, 6)
  })
})

/**
 * The gesture's LIMITS assume a justified line — a fixed page total, so what one bar gains another
 * pays. The last system is ragged by default (LilyPond's `ragged-last`) and has no fixed total, so
 * those limits do not apply to it.
 */
describe('bar width on a RAGGED last line', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    // Ten empty bars: nine fill the first system, so the last system holds exactly ONE — the state
    // that was reported as unexpandable.
    while (engine.getScore().measures.length < 10) engine.addMeasure()
    engine.renderScore()
  })

  const widthOf = (measure: number): number => {
    const g = engine.getElementRegistry().getStaffGeometry(measure, 0)!
    return g.noteEndX - g.noteStartX
  }

  it('⭐ a bar ALONE on it can still be widened — it is not the whole system', () => {
    // Reported: with the last system ragged, the last measure could not be expanded at all. The
    // ceiling read "a bar alone on its system IS the line, so that is its maximum" — true while the
    // line is justified, false the moment it is not. A lone bar on a ragged line is a SHORT line,
    // with the rest of the page to grow into.
    const room = engine.barWidthRoom(10)!
    expect(room.alone).toBe(true)          // …the state the old ceiling capped
    expect(room.maxStretch).toBeGreaterThan(room.stretch + 1) // …and no longer does

    const before = widthOf(10)
    for (let i = 0; i < 4; i++) { engine.nudgeBarWidth(10, STEP_PX); engine.renderScore() }
    expect(widthOf(10)).toBeGreaterThan(before)
  })

  it('…and it keeps growing press after press, rather than freezing after one', () => {
    const seen: number[] = []
    for (let i = 0; i < 5; i++) {
      engine.nudgeBarWidth(10, STEP_PX)
      engine.renderScore()
      seen.push(widthOf(10))
    }
    const stuck = seen.findIndex((v, i) => i > 0 && Math.abs(v - seen[i - 1]) < 1e-9)
    expect({ stuck, seen: seen.map(v => Math.round(v)) }).toEqual({ stuck: -1, seen: seen.map(v => Math.round(v)) })
  })
})
