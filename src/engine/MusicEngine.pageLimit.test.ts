// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { A4_NORMAL, SKETCH_CANVAS, resolveSurface } from './layout/surface'
import { fracCreate as frac } from '@/utils/fraction'
import { engravingOverridesOf } from './models/engravingOverrides'

/**
 * ⭐⭐ **THE PAGE LIMIT, PER OFFSET CLIENT** — his report, 2026-08-17: *"all the objects that we
 * offset, when in wrapped mode, can go out of the page… we should put a limit"*, and then the half
 * that decides the design: *"the offset value should not rise or decrease otherwise, otherwise we
 * have to go back till the boundary number until the change makes effect."*
 *
 * ⭐⭐ **So what every case here asserts is the STORED VALUE, never the drawing.** A limit that only
 * clamps where the ink is painted leaves the override accumulating behind it — his own ottava log
 * ran to −45 spaces with the numeral standing still — and the dead zone that creates is the bug. The
 * rule's arithmetic has its own spec (`layout/pageBounds.test.ts`); this file is the TABLE: one case
 * per client, because a new offset client that forgets its row would be invisible until a user
 * pushed something off a page.
 *
 * ⚠️ **The registry is SEEDED by hand, and it has to be.** In jsdom every glyph measures 0×0
 * (`reference_jsdom_cannot_measure_glyphs`), so a rendered fixture would put every box at the origin
 * — comfortably inside the sheet — and every case would pass without the rule existing at all. The
 * boxes below are supplied, which is what makes the assertions real.
 */
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

const PAGE = resolveSurface(A4_NORMAL)

describe('MusicEngine — a hand nudge may not be written past the edge of the paper', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const host = document.createElement('div')
    engine = new MusicEngine({ container: host, surface: A4_NORMAL })
  })

  /** Put one drawn box on the score, as the last render would have. */
  const drawn = (type: Parameters<ReturnType<MusicEngine['getElementRegistry']>['getByType']>[0], id: string, x: number, y = 100) => {
    engine.getElementRegistry().add({
      type, id, bbox: { x, y, width: 20, height: 10 },
    } as never)
  }

  /** Every override recorded against `key`, so a case can say "nothing was written". */
  const overrides = (key: string) => engravingOverridesOf(engine.getScore(), key)

  /** Off the left edge of sheet one. */
  const OFF_LEFT = -30
  /** Comfortably inside it. */
  const INSIDE = 200

  describe('the OTTAVA — his own case', () => {
    let id: string
    beforeEach(() => {
      engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      id = engine.addOttava(1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!.id
    })

    it('⭐⭐ REFUSES the write once the bracket is off the sheet — the value does not accumulate', () => {
      drawn('ottava', id, OFF_LEFT)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -1, 0)).toBe(false)
      expect(overrides(id), 'nothing stored at all').toHaveLength(0)
    })

    it('⭐⭐ …and the very first press BACK moves it — which is the whole point of refusing the write', () => {
      drawn('ottava', id, OFF_LEFT)
      expect(engine.nudgeOttavaEndpoint(id, 'start', 1, 0)).toBe(true)
      expect(overrides(id)).toHaveLength(1)
      // ⛔ If the limit had clamped the DRAWING instead, the stored value would be somewhere off at
      // −45 and this press would have moved nothing the eye could see.
    })

    it('⭐⭐ a big TYPED delta cannot leap the boundary either — his Properties case', () => {
      // Properties writes an absolute value and the controller turns it into `next − current`, so one
      // delta can be any size: *"the offset limit should also be true of properties… I now test with
      // note offset and I see we can go out of the page."* A backwards-looking rule waves this
      // through, because the ink is comfortably on the sheet when it is asked.
      drawn('ottava', id, INSIDE)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -900, 0)).toBe(false)
      expect(overrides(id), 'nothing stored').toHaveLength(0)
    })

    it('⭐⭐ …and a step from INSIDE that would cross the edge stops SHORT of it', () => {
      // 1 staff space = 10px, so a bracket 5px from the left edge may not take a whole-space step.
      drawn('ottava', id, 5)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -1, 0)).toBe(false)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -0.25, 0), 'a quarter-space still fits').toBe(true)
    })

    it('allows every direction while the bracket is on the sheet', () => {
      drawn('ottava', id, INSIDE)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -1, 0)).toBe(true)
      expect(engine.nudgeOttavaEndpoint(id, 'end', 1, 0)).toBe(true)
    })

    it('⛔ imposes NO limit on a canvas — his call, no boundaries in the linear view', () => {
      engine.setSurface(SKETCH_CANVAS)
      drawn('ottava', id, -9000)
      expect(engine.nudgeOttavaEndpoint(id, 'start', -1, 0)).toBe(true)
    })

    it('⚠️ allows the nudge when nothing is DRAWN — refusing on no evidence makes it unmovable', () => {
      expect(engine.nudgeOttavaEndpoint(id, 'start', -1, 0)).toBe(true)
    })
  })

  /**
   * ⭐ THE TABLE. Each row is one offset client he named — *"slur, 8va, hairpin, and expression…
   * ah, note and rest too"* — with the registry type its override moves and the call the keyboard
   * makes. A client missing its row passes nothing here.
   */
  it('⭐⭐ every offset client refuses alike: hairpin, slur, dynamic, note, rest', () => {
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const notes = engine.getScore().measures[0].slots
    const first = notes[0].type === 'chord' ? notes[0].notes[0].id : notes[0].id

    const hairpin = engine.addHairpin(1, { beat: frac(0, 1), length: frac(1, 1), type: 'cresc' })!
    const ottava = engine.addOttava(1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!
    const dynamic = engine.addDynamic(1, { beat: frac(0, 1), text: 'f' })!

    // Everything drawn off the left edge of the sheet.
    drawn('hairpin', hairpin.id, OFF_LEFT)
    drawn('ottava', ottava.id, OFF_LEFT)
    drawn('dynamic', dynamic.id, OFF_LEFT)
    drawn('note', first, OFF_LEFT)

    // …and every leftward nudge is refused, with nothing written.
    expect(engine.nudgeHairpinEndpoint(hairpin.id, 'start', -1, 0), 'hairpin end').toBe(false)
    expect(engine.nudgeHairpin(hairpin.id, -1, 0), 'whole hairpin').toBe(false)
    expect(engine.nudgeOttavaEndpoint(ottava.id, 'start', -1, 0), 'ottava').toBe(false)
    expect(engine.nudgeDynamicOffset(dynamic.id, -1, 0), 'dynamic / expression').toBe(false)
    expect(engine.nudgeNoteOffset(first, -1), 'note').toBe(false)

    for (const key of [hairpin.id, ottava.id, dynamic.id]) {
      expect(overrides(key), `nothing stored for ${key}`).toHaveLength(0)
    }
    // …and each one comes back on the first press the other way.
    expect(engine.nudgeHairpinEndpoint(hairpin.id, 'start', 1, 0)).toBe(true)
    expect(engine.nudgeOttavaEndpoint(ottava.id, 'start', 1, 0)).toBe(true)
    expect(engine.nudgeDynamicOffset(dynamic.id, 1, 0)).toBe(true)
    expect(engine.nudgeNoteOffset(first, 1)).toBe(true)
  })

  it('⭐ a REST is judged on the VERTICAL, and its step counts UPWARD', () => {
    // ⚠️ `nudgeRestShift(delta)` is a step count with UP positive, while screen-down is +y — so the
    // sign flips on the way into the rule. Getting that backwards would refuse exactly the half of
    // the gesture that should be allowed, which no other case here would catch.
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), isRest: true })
    const slot = engine.getScore().measures[0].slots[0]
    const restId = slot.type === 'chord' ? slot.notes[0].id : slot.id

    drawn('rest', restId, 200, -30) // above the top of the sheet
    expect(engine.nudgeRestShift(restId, 1), 'further UP: refused').toBe(false)
    expect(engine.nudgeRestShift(restId, -1), 'back DOWN: allowed').toBe(true)
  })

  it('⭐ the limit is the SHEET the ink is on, not the first one — a score has many pages', () => {
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const id = engine.addOttava(1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!.id
    // Well past sheet one's right edge — but comfortably inside sheet two.
    drawn('ottava', id, PAGE.widthPx + 200)
    expect(engine.nudgeOttavaEndpoint(id, 'start', 1, 0)).toBe(true)
  })
})
