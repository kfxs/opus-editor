import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import {
  BARLINE_SIGNS,
  applyBarlineSign,
  barlineTargetFromSelection,
  nearestBoundary,
  stampBarlineAtClick,
  type BarlineSign,
} from './barlineStamp'
import { STAFF_BAND_PAD_PX } from './staffBand'

/**
 * The barline palette's press — P4 of docs/barline-types-plan.md.
 *
 * Subject: {@link barlineStamp}, sitting beside this file. The `MusicEngine` is real (the write, its
 * refusals and its undo entry are all its answers); nothing here is drawn, and nothing here asks
 * where a pixel landed in MUSICAL terms. ⭐ It does ask which drawn LINE a press is nearest, on a
 * stubbed registry of boxes — that is his rule of 2026-08-26 and it is arithmetic, not layout.
 */
vi.mock('../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('barlineStamp', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void

  /** The bar as the model now holds it — what every assertion below reads back. */
  const bar = (n: number) => engine.getScore().measures.find(m => m.number === n)

  const selectBarlineEnding = (measure: number) => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'barline', measure }
  }
  const selectMeasures = (anchor: number, focus: number) => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'measureRange', anchor, focus, staff: 0, focusStaff: 0, boxStyle: 'double' }
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 5; i++) engine.addMeasure() // bars 1–5 (plus the score's own opening bar)
    state = createEditorState()
    render = vi.fn()
  })

  describe('⭐ the SIDE of a PASSAGE each sign stands on — the one gesture that names bars', () => {
    it('the closing signs are on the RIGHT, the open repeat on the LEFT', () => {
      // *"an endbar is always on the right, an open is on the left side of the measure"* — his rule,
      // and the table is the only place it is written down. ⚠️ Read by the measure-range gesture
      // ALONE now: the other two name a LINE, which has no sides to choose between.
      expect(BARLINE_SIGNS.final.side).toBe('right')
      expect(BARLINE_SIGNS.repeatEnd.side).toBe('right')
      expect(BARLINE_SIGNS.invisible.side).toBe('right')
      expect(BARLINE_SIGNS.repeatStart.side).toBe('left')
    })
  })

  describe('barlineTargetFromSelection', () => {
    it('answers null with nothing selected — the palette ARMS instead', () => {
      for (const sign of Object.keys(BARLINE_SIGNS) as BarlineSign[]) {
        expect(barlineTargetFromSelection(state, sign)).toBeNull()
      }
    })

    it('answers null in ENTRY mode, where a selection is the keyboard caret', () => {
      state.selectedElement = { kind: 'barline', measure: 3 }
      state.selectedTool = 'entry'
      expect(barlineTargetFromSelection(state, 'final')).toBeNull()
    })

    it('🚨 a selected BARLINE is a LINE — every sign lands on it, whatever its side', () => {
      // ⚠️ This is the change of 2026-08-26: it used to step to bar N+1 for the open repeat. Both
      // answers name the same line; naming it once is what stops the two gestures drifting.
      selectBarlineEnding(3)
      for (const sign of Object.keys(BARLINE_SIGNS) as BarlineSign[]) {
        expect(barlineTargetFromSelection(state, sign), sign).toEqual({ endsMeasure: 3 })
      }
    })

    it('⭐ a selected OPEN REPEAT is the same line seen from the other side', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'repeatStart', measure: 4 }
      expect(barlineTargetFromSelection(state, 'final')).toEqual({ endsMeasure: 3 })
    })

    it('🚨 …and bar 1\'s open repeat is the SCORE\'S OPENING EDGE, a line no bar ends', () => {
      // The sign his report could not reach. `null` is a boundary, not "nothing" — it is what makes
      // the eraser able to take the initial repeat away.
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'repeatStart', measure: 1 }
      expect(barlineTargetFromSelection(state, 'plain')).toEqual({ endsMeasure: null })
    })

    it('⭐ takes a measure range by the SIGN\'S OWN END — last line for a closing sign, first for an open', () => {
      // Anchor above focus on purpose: the box is dragged in both directions, and the sign's side is
      // what decides, never which end was clicked first.
      selectMeasures(5, 2)
      expect(barlineTargetFromSelection(state, 'final')).toEqual({ endsMeasure: 5 })
      expect(barlineTargetFromSelection(state, 'repeatEnd')).toEqual({ endsMeasure: 5 })
      // The line OPENING bar 2 is the line ending bar 1.
      expect(barlineTargetFromSelection(state, 'repeatStart')).toEqual({ endsMeasure: 1 })
    })

    it('a range starting at bar 1 opens on the score\'s own edge', () => {
      selectMeasures(1, 3)
      expect(barlineTargetFromSelection(state, 'repeatStart')).toEqual({ endsMeasure: null })
    })

    it('a SINGLE box counts as well as the double one — both name bars out loud', () => {
      state.selectedTool = 'selection'
      state.selectedElement = { kind: 'measureRange', anchor: 2, focus: 3, staff: 0, focusStaff: 0, boxStyle: 'single' }
      expect(barlineTargetFromSelection(state, 'final')).toEqual({ endsMeasure: 3 })
    })

    it('a NOTE selection names no line — a press with notes selected arms the stamp', () => {
      state.selectedTool = 'selection'
      state.selectedNoteId = 'note-1'
      expect(barlineTargetFromSelection(state, 'final')).toBeNull()
    })
  })

  describe('applyBarlineSign', () => {
    const at = (endsMeasure: number | null) => ({ endsMeasure })

    it('a final barline is a STYLE on the bar the line ends', () => {
      expect(applyBarlineSign(engine, 'final', at(2))).toBe(true)
      expect(bar(2)?.barline).toEqual({ style: 'final' })
      expect(bar(2)?.repeatEnd).toBeUndefined()
    })

    it('⭐ an INVISIBLE barline is the family\'s other style — same field, same line', () => {
      expect(applyBarlineSign(engine, 'invisible', at(2))).toBe(true)
      expect(bar(2)?.barline).toEqual({ style: 'invisible' })
    })

    it('⭐ the two repeats are NOT styles — each is its own field, on its own bar', () => {
      applyBarlineSign(engine, 'repeatEnd', at(2))
      applyBarlineSign(engine, 'repeatStart', at(2))
      // Both statements stand on the SAME line, stored by the two bars that meet there.
      expect(bar(2)?.repeatEnd).toEqual({})
      expect(bar(3)?.repeatStart).toEqual({})
      expect(bar(2)?.barline).toBeUndefined()
    })

    it('⭐ every row writes its own field, and the table is TOTAL over the union', () => {
      for (const sign of Object.keys(BARLINE_SIGNS) as BarlineSign[]) {
        expect(typeof BARLINE_SIGNS[sign].place, sign).toBe('function')
      }
    })

    it('🚨🚨 A BUTTON ADDS ITS OWN SIGN — the two repeats COMPOSE into `:||:`, never replace', () => {
      // 🚨 His report, 2026-08-26: with a `|:` standing on this line, pressing END REPEAT *"overwrote
      // the open repeat… completely wrong."* That pair IS the back-to-back sign, so a button that
      // erased half of it would make `:||:` unbuildable from the palette.
      applyBarlineSign(engine, 'repeatStart', at(2))
      expect(applyBarlineSign(engine, 'repeatEnd', at(2))).toBe(true)
      expect(bar(3)?.repeatStart, 'the open repeat is still there').toEqual({})
      expect(bar(2)?.repeatEnd).toEqual({})
    })

    it('🚨 …but a STYLE OVERRIDES a repeat — there is no final-bar-and-repeat sign', () => {
      // His twin report the same hour: *"I click a final here and it just made disappear the end
      // repeat, but I don't see it writing the final."* Not overriding was the bug that time.
      applyBarlineSign(engine, 'repeatEnd', at(2))
      applyBarlineSign(engine, 'repeatStart', at(2))
      expect(applyBarlineSign(engine, 'final', at(2))).toBe(true)
      expect(bar(2)?.barline).toEqual({ style: 'final' })
      expect(bar(2)?.repeatEnd).toBeUndefined()
      expect(bar(3)?.repeatStart).toBeUndefined()
    })

    it('⭐ …and a REPEAT overrides the style, the other way round', () => {
      applyBarlineSign(engine, 'final', at(2))
      applyBarlineSign(engine, 'repeatEnd', at(2))
      expect(bar(2)?.barline).toBeUndefined()
      expect(bar(2)?.repeatEnd).toEqual({})
    })

    it('⛔ the ERASER is the one that clears — and it takes BOTH owners of the line', () => {
      applyBarlineSign(engine, 'repeatEnd', at(2))
      applyBarlineSign(engine, 'repeatStart', at(2))
      applyBarlineSign(engine, 'final', at(2))
      expect(applyBarlineSign(engine, 'plain', at(2))).toBe(true)
      expect(bar(2)?.barline).toBeUndefined()
      expect(bar(2)?.repeatEnd).toBeUndefined()
      expect(bar(3)?.repeatStart).toBeUndefined()
    })

    it('🚨 the ERASER takes the `|:` OPENING BAR 1 — the sign no bar-shaped rule can name', () => {
      applyBarlineSign(engine, 'repeatStart', at(null))
      expect(bar(1)?.repeatStart).toEqual({})
      expect(applyBarlineSign(engine, 'plain', at(null))).toBe(true)
      expect(bar(1)?.repeatStart).toBeUndefined()
    })

    it('⛔ refuses anything but `|:` at the opening edge — no bar ends there to carry a style', () => {
      expect(applyBarlineSign(engine, 'final', at(null))).toBe(false)
      expect(applyBarlineSign(engine, 'repeatEnd', at(null))).toBe(false)
      expect(bar(1)?.barline).toBeUndefined()
    })

    it('answers false for a line that is not there, and changes nothing', () => {
      expect(applyBarlineSign(engine, 'final', at(99))).toBe(false)
      expect(bar(99)).toBeUndefined()
    })

    it('answers false for a sign that is already there', () => {
      applyBarlineSign(engine, 'final', at(2))
      expect(applyBarlineSign(engine, 'final', at(2))).toBe(false)
    })

    it('one undo takes the sign back', () => {
      applyBarlineSign(engine, 'final', at(2))
      engine.undo()
      expect(bar(2)?.barline).toBeUndefined()
    })

    it('⭐ …and ONE undo takes back a `:||:` chosen from PROPERTIES, two statements on two bars', () => {
      // The chooser's sentence, not the palette's: it names the sign the line IS. One undo entry.
      expect(engine.setBoundarySign(2, 'repeatBoth')).toBe(true)
      expect(bar(2)?.repeatEnd).toEqual({})
      expect(bar(3)?.repeatStart).toEqual({})
      engine.undo()
      expect(bar(2)?.repeatEnd).toBeUndefined()
      expect(bar(3)?.repeatStart).toBeUndefined()
    })
  })

  describe('nearestBoundary — 🚨 the LINE NEAREST THE POINTER, his rule of 2026-08-26', () => {
    /** A registry holding the drawn lines at the given x's, all on one staff band (y 0…40). */
    const registryOf = (
      barlines: Array<{ measure: number; x: number }>,
      repeats: Array<{ measure: number; x: number }> = [],
      painted: number[] = barlines.map(b => b.measure),
    ) => ({
      getByType: (type: 'barline' | 'repeatStart') => (type === 'barline' ? barlines : repeats)
        .map(({ measure, x }) => ({ measure, staff: 0, bbox: { x, y: 0, width: 4, height: 40 } })),
      isPainted: (measure: number) => painted.includes(measure),
    })

    it('answers the nearest line, not the bar the press fell in', () => {
      // 🚨 His report: a press at 457.8 on the line ending bar 3 (box @455.2) stamped bar 4, because
      // `pixelToMeasure` puts a press ON a boundary in the bar to its RIGHT.
      const registry = registryOf([{ measure: 3, x: 455.2 }, { measure: 4, x: 564.7 }])
      expect(nearestBoundary(registry, 457.8, 20)).toEqual({ endsMeasure: 3 })
    })

    it('…and the other one once the pointer is closer to it', () => {
      const registry = registryOf([{ measure: 3, x: 455.2 }, { measure: 4, x: 564.7 }])
      expect(nearestBoundary(registry, 540, 20)).toEqual({ endsMeasure: 4 })
    })

    it('⭐ an OPEN REPEAT is a candidate too — which is how the eraser reaches bar 1\'s', () => {
      const registry = registryOf([{ measure: 3, x: 455.2 }], [{ measure: 1, x: 80 }])
      expect(nearestBoundary(registry, 85, 20)).toEqual({ endsMeasure: null })
    })

    it('⛔ skips a line that was never PAINTED — tier 1 registers every bar in the score', () => {
      const registry = registryOf([{ measure: 3, x: 455.2 }, { measure: 9, x: 460 }], [], [3])
      expect(nearestBoundary(registry, 459, 20)).toEqual({ endsMeasure: 3 })
    })

    it('🚨 a press just UNDER the bottom line still lands — the band is padded', () => {
      // His report: six declines in a row at y 391 while y 386 placed a sign. The box is exactly the
      // five staff lines (0…40 here); the tolerance is `./staffBand`'s, shared with the measure click.
      const registry = registryOf([{ measure: 3, x: 455.2 }])
      expect(nearestBoundary(registry, 455, 40 + STAFF_BAND_PAD_PX)).toEqual({ endsMeasure: 3 })
      expect(nearestBoundary(registry, 455, -STAFF_BAND_PAD_PX)).toEqual({ endsMeasure: 3 })
    })

    it('⛔ answers null well off the staff — a barline is system-wide, the y picks the staff', () => {
      const registry = registryOf([{ measure: 3, x: 455.2 }])
      expect(nearestBoundary(registry, 455, 200)).toBeNull()
    })
  })

  describe('stampBarlineAtClick', () => {
    const registry = {
      getByType: (type: 'barline' | 'repeatStart') => (type === 'barline'
        ? [2, 3, 4].map(measure => ({ measure, staff: 0, bbox: { x: measure * 100, y: 0, width: 4, height: 40 } }))
        : []),
      isPainted: () => true,
    }

    it('leaves the click alone when the tool is not armed', () => {
      expect(stampBarlineAtClick(state, engine, registry, 300, 20, render)).toBe(false)
      expect(bar(3)?.barline).toBeUndefined()
      expect(render).not.toHaveBeenCalled()
    })

    it('🚨 puts the sign on the NEAREST line, not on the bar the press fell in', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'final' }
      // 302 is inside bar 4 by the containing-bar rule, and one pixel from bar 3's line by his.
      expect(stampBarlineAtClick(state, engine, registry, 302, 20, render)).toBe(true)
      expect(bar(3)?.barline).toEqual({ style: 'final' })
      expect(bar(4)?.barline).toBeUndefined()
      expect(render).toHaveBeenCalled()
    })

    it('the open repeat lands on the bar the nearest line OPENS', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'repeatStart' }
      stampBarlineAtClick(state, engine, registry, 302, 20, render)
      expect(bar(4)?.repeatStart).toEqual({})
      expect(bar(3)?.repeatStart).toBeUndefined()
    })

    it('⛔ consumes but does not place a press on no staff — stamping the nearest line would be a guess', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'final' }
      expect(stampBarlineAtClick(state, engine, registry, 302, 500, render)).toBe(true)
      expect(bar(3)?.barline).toBeUndefined()
      expect(render).not.toHaveBeenCalled()
    })

    it('stays armed — these are placed in runs', () => {
      state.selectedMarkingTool = { kind: 'barline', sign: 'repeatEnd' }
      stampBarlineAtClick(state, engine, registry, 200, 20, render)
      stampBarlineAtClick(state, engine, registry, 400, 20, render)
      expect(bar(2)?.repeatEnd).toEqual({})
      expect(bar(4)?.repeatEnd).toEqual({})
      expect(state.selectedMarkingTool).toEqual({ kind: 'barline', sign: 'repeatEnd' })
    })
  })
})
