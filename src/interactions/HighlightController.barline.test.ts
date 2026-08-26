// @vitest-environment jsdom
/**
 * The barline selection highlight **colours the sign we drew**.
 *
 * 🚨 **His report, 2026-08-26**, on plain barlines: *"when i select a barline the highlight is a
 * little bit confusing… are we overlapping the blue to another black barline?"*, then *"why was the
 * highlight before starting this project better than now?"* It used to PAINT a 2 px rect at
 * `noteEndX`, which covered VexFlow's 1.6 px line exactly — and stopped covering anything much once
 * P2 made us draw the signs ourselves (a final bar is ~1 space of ink, all of it left of the
 * boundary, and the hinting pass may nudge a plain line off the registry's x by half a device pixel).
 *
 * ⚠️ So this is now a RECOLOUR, and the header of `applyBarlineSelectionHighlight` records why the
 * PAINT-don't-RECOLOUR rule does not reach it: that rule is about VexFlow's nodes, and every failure
 * it lists is a *finding* failure of a DOM we no longer read.
 *
 * ⚠️⚠️ jsdom draws no glyphs, but it does build the pass's `<g>`s and their rects — this file asks
 * only which nodes were coloured, never where any of them is. WHERE the sign lands is
 * `e2e/barlineTypes.e2e.ts`'s.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '@/engine/MusicEngine'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import type { EditorState } from './EditorState'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'

describe('barline selection highlight', () => {
  let engine: MusicEngine
  let container: HTMLElement
  let state: EditorState
  let highlight: HighlightController

  /** Every piece of ink the highlight claimed — strokes AND repeat dots. */
  const marked = () => [...container.querySelectorAll('.selected-barline')]
  const blue = () => marked().filter(el => el.getAttribute('fill') === ELEMENT_SELECTION_FILL)
  /** The pass's own group for the sign ending `measure` on staff 0. */
  const sign = (measure: number) => container.querySelector(`[id="vf-barline-${measure}-0-end"]`)
  /** …and for one a bar drew at its own START — a displaced `|:`, or a system-opening one. */
  const startSign = (measure: number) => container.querySelector(`[id="vf-barline-${measure}-0-start"]`)

  const select = (measure: number) => {
    highlight.clearHighlights()
    state.selectedElement = { kind: 'barline', measure }
    highlight.applyBarlineSelectionHighlight()
  }

  /** Select the `|:` that OPENS `measure` — the other half of the family (`./elements/repeatStart`). */
  const selectOpenRepeat = (measure: number) => {
    highlight.clearHighlights()
    state.selectedElement = { kind: 'repeatStart', measure }
    highlight.applyRepeatStartSelectionHighlight()
  }

  beforeEach(() => {
    // ⚠️ The body is cleared between tests: every fixture draws the SAME group ids, and a stale
    // container left in the document makes an id lookup answer for the wrong score.
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 24) engine.addMeasure()
    engine.renderScore()
    state = createEditorState()
    highlight = new HighlightController(() => engine, () => container, state)
  })

  it('marks nothing when no barline is selected', () => {
    highlight.applyBarlineSelectionHighlight()
    expect(marked()).toHaveLength(0)
  })

  it('⭐ a PLAIN line: the drawn stroke itself goes blue — no second mark laid beside it', () => {
    // His case. One stroke, one recoloured node, and it is the node the pass drew — so the hinting
    // pass may move it and the colour goes with it.
    select(4)
    const strokes = [...sign(4)!.querySelectorAll('rect')]
    expect(strokes, 'the pass drew one stroke for a plain line').toHaveLength(1)
    expect(blue()).toHaveLength(1)
    expect(blue()[0]).toBe(strokes[0])
  })

  it('⭐⭐ a FINAL bar: BOTH strokes go blue — the thin and the thick', () => {
    // The old 2 px rect covered half a pixel of the thick line and put the rest of itself on blank
    // staff to the right of the sign.
    engine.setBarlineStyle(4, 'final')
    engine.renderScore()
    select(4)
    expect([...sign(4)!.querySelectorAll('rect')], 'thin + thick').toHaveLength(2)
    expect(blue()).toHaveLength(2)
  })

  it('⭐⭐ an END REPEAT: its DOTS are coloured too, still drawn by the font', () => {
    engine.setRepeatEnd(4, true)
    engine.renderScore()
    select(4)
    const dots = [...sign(4)!.querySelectorAll('text')]
    expect(dots, 'two repeat dots').toHaveLength(2)
    for (const dot of dots) expect(dot.getAttribute('fill')).toBe(ELEMENT_SELECTION_FILL)
    expect(blue().length, 'two strokes and two dots').toBe(4)
  })

  it('🚨 when the NEIGHBOUR opens the repeat, the barline lights the WHOLE `|:` — never the thick alone', () => {
    // 🚨 **HIS CORRECTION, 2026-08-26**, from the running app: he placed an open repeat on the left of
    // bar 2, clicked the line, got `✓ Barline selected | ends measure:1` — and *"here we highlight
    // just the thick"*. *"We should always highlight the music semantic and no part of it."*
    //
    // A boundary carries ONE sign (`signAtBoundary`): bar 5's `|:` REPLACES bar 4's plain line, so
    // bar 4 owns no ink here at all. The divider is the only piece of the sign standing on its
    // boundary — and 0.5 spaces of a 1.5-space sign is a fragment, not a selection. So a selection
    // with nothing of its own here lights the whole sign that is drawn on its line.
    engine.setRepeatStart(5, true)
    engine.renderScore()
    select(4)
    expect([...sign(4)!.querySelectorAll('rect')], 'thick + thin').toHaveLength(2)
    expect([...sign(4)!.querySelectorAll('text')], 'and its two dots').toHaveLength(2)
    expect(blue(), 'all four pieces of it').toHaveLength(4)
  })

  it('⭐⭐ the OPEN REPEAT is its own selection, drawn in the PREVIOUS bar\'s group', () => {
    // The mirror of the test above: same ink, the other owner. The `|:` is filed under bar 4 because
    // bar 4 held the pen at that spot, but it is bar 5's statement — so this finds it by looking for
    // bar 5's own start group first and falling back to bar 4's end group.
    engine.setRepeatStart(5, true)
    engine.renderScore()
    selectOpenRepeat(5)
    expect(startSign(5), 'no start group of its own — it stands on the boundary').toBeNull()
    expect(blue(), 'thick + thin + two dots').toHaveLength(4)
  })

  it('🚨 the `|:` OPENING THE SCORE — the sign his report could not reach', () => {
    // *"I can not highlight open repeat on the beginning of the score"*. Bar 1 always draws a
    // header, so its repeat is displaced past the clef and meter (Gould p. 234) — it stands at NO
    // boundary, which is why no `barline` selection could ever have named it.
    engine.setRepeatStart(1, true)
    engine.renderScore()
    expect(startSign(1), 'drawn as bar 1\'s OWN start group').not.toBeNull()
    selectOpenRepeat(1)
    expect(blue(), 'thick + thin + two dots').toHaveLength(4)
  })

  it('⭐⭐ `:||:` — each half lights ALONE, and they share only the divider', () => {
    // His, 2026-08-26: *"when we have open+end and I choose it, it highlights everything but it
    // should highlight just the part that was clicked"*. One drawn sign, two statements: bar 4's
    // `:|` and bar 5's `|:`, meeting on one thick line that belongs to both.
    engine.setRepeatEnd(4, true)
    engine.setRepeatStart(5, true)
    engine.renderScore()
    const group = sign(4)!
    expect([...group.querySelectorAll('rect')], 'thin · THICK · thin').toHaveLength(3)
    expect([...group.querySelectorAll('text')], 'a pair of dots each side').toHaveLength(4)

    select(4)
    const endHalf = blue()
    expect(endHalf, 'thin + divider + its own two dots').toHaveLength(4)

    selectOpenRepeat(5)
    const startHalf = blue()
    expect(startHalf, 'the other thin + divider + the other two dots').toHaveLength(4)

    // ⭐ The overlap between the two is exactly the divider — one node, and it is the thick line.
    const shared = endHalf.filter(el => startHalf.includes(el))
    expect(shared).toHaveLength(1)
    expect(shared[0].getAttribute('data-half')).toBe('shared')
    expect(Number(shared[0].getAttribute('width')), 'the 0.5-space thick line').toBeCloseTo(5, 5)

    // ⭐⭐ …and NEITHER half is a fragment: each is a complete repeat sign — its two dots, its thin
    // stroke and the thick line the two designs share (Gould p. 234's design (A) is ONE divider).
    for (const half of [endHalf, startHalf]) {
      expect(half.filter(el => el.tagName === 'text'), 'a full pair of dots').toHaveLength(2)
      expect(half.filter(el => el.tagName === 'rect'), 'thin + THICK').toHaveLength(2)
    }
  })

  it('⭐⭐ a thin stroke is grown to 2 px of blue — symmetrically, and a THICK one is left alone', () => {
    // His call: *"why not make the highlight 2px again? what was wrong was the black, correct?"* —
    // 2 px is the weight the highlight always had; what was wrong was that it was a separate rect
    // that missed the sign. Applied to the drawn stroke itself there is no black to leave behind.
    engine.setBarlineStyle(4, 'final')
    engine.renderScore()
    const before = [...sign(4)!.querySelectorAll('rect')]
      .map(r => ({ x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) }))
      .sort((a, b) => a.w - b.w)
    select(4)
    const after = [...sign(4)!.querySelectorAll('rect')]
      .map(r => ({ x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) }))
      .sort((a, b) => a.w - b.w)

    const [thin, thick] = [0, 1]
    expect(before[thin].w, 'the thin stroke is 0.16 spaces').toBeCloseTo(1.6, 5)
    expect(after[thin].w, 'grown to the highlight weight').toBe(2)
    expect(after[thin].x + after[thin].w / 2, 'about its own centre — it does not move')
      .toBeCloseTo(before[thin].x + before[thin].w / 2, 5)
    expect(after[thick], 'the thick line was already heavier — untouched').toEqual(before[thick])
  })

  it('clears completely — every fill goes back to what the pass wrote', () => {
    const before = [...sign(4)!.querySelectorAll('rect')].map(r => r.getAttribute('fill'))
    select(4)
    expect(blue().length).toBeGreaterThan(0)
    highlight.clearHighlights()
    expect(marked()).toHaveLength(0)
    expect([...sign(4)!.querySelectorAll('rect')].map(r => r.getAttribute('fill'))).toEqual(before)
  })
})
