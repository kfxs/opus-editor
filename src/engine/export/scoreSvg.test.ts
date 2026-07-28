// @vitest-environment jsdom
/**
 * Subject: {@link renderScoreSvg}, sitting beside this file — specifically the one thing that makes
 * it different from the editor's own render besides culling and ghosts: it engraves for **print**,
 * so an element the user has HIDDEN leaves no ink at all instead of the editor's gray.
 *
 * That was a real bug: hiding a rest (Ctrl+Shift+H) grayed it on screen and then printed the gray
 * rest into the PDF, because the export re-renders the score through the same renderer and nothing
 * told that renderer it was engraving paper.
 *
 * jsdom has no layout, so nothing here asks where anything is — these count nodes and read fills,
 * which are real in jsdom. The geometry side of the export lives in `e2e/pdfExport.e2e.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { renderScoreSvg } from './scoreSvg'
import { HIDDEN_ELEMENT_COLOR } from '../rendering/hiddenElements'
import type { Score } from '@/types/music'

let container: HTMLElement
let engine: MusicEngine

/** One quarter note at beat 0 of bar 1 — the remaining three beats fill with rests, which is what
 *  gives us something to hide. */
function makeEngine(): MusicEngine {
  const e = new MusicEngine({ container, width: 800, height: 400 })
  e.addNoteAtBeat({
    step: 'C', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 },
  } as unknown as Parameters<MusicEngine['addNoteAtBeat']>[0])
  e.renderScore()
  return e
}

/** Hide the bar's first rest and return the score. */
function withHiddenRest(e: MusicEngine): Score {
  const rest = e.getScore().measures[0].slots.find(s => s.type === 'rest')
  if (!rest) throw new Error('fixture produced no rest to hide')
  e.runBatch('Hide/Show 1 rest(s)', () => { e.toggleRestHidden(rest.id) })
  return e.getScore()
}

/** Every element the render painted with the editor's hidden-gray, by attribute or by style.
 *  ⚠️ jsdom re-serialises a `style` colour as `rgb(r, g, b)`, so the hex is matched both ways —
 *  otherwise the "no gray reached paper" assertion below would pass without looking at anything. */
function grayInk(root: ParentNode): Element[] {
  const hex = HIDDEN_ELEMENT_COLOR.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  const rgb = `rgb(${r}, ${g}, ${b})`
  return Array.from(root.querySelectorAll('text, path')).filter((el) => {
    const svgEl = el as SVGElement
    const attr = (svgEl.getAttribute('fill') ?? '').toLowerCase()
    return attr === HIDDEN_ELEMENT_COLOR.toLowerCase() || svgEl.style.fill === rgb
  })
}

const staveNotes = (root: ParentNode) => root.querySelectorAll('g.vf-stavenote').length

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  engine = makeEngine()
})

afterEach(() => {
  container.remove()
})

describe('renderScoreSvg engraves for print', () => {
  it('omits a hidden rest entirely — the PDF gets no ink for it, not even gray', async () => {
    const before = await renderScoreSvg(engine.getScore())
    const visibleRestCount = staveNotes(before.svg)
    before.dispose()

    const { svg, dispose } = await renderScoreSvg(withHiddenRest(engine))
    try {
      expect(grayInk(svg), 'the editor gray must never reach paper').toEqual([])
      expect(staveNotes(svg), 'exactly the hidden rest is gone').toBe(visibleRestCount - 1)
    } finally {
      dispose()
    }
  })

  /**
   * The control, and the point of the whole design: the SAME score in the SAME renderer keeps the
   * rest when the audience is the editor. Without this, a bug that simply stopped drawing hidden
   * rests everywhere would pass the test above — and you could no longer find or unhide one.
   */
  it('while the editor still shows it, gray and selectable', () => {
    engine.renderScore() // settle before the hide, so the repaint below is the hide's doing
    withHiddenRest(engine)
    engine.renderScore()

    const svg = container.querySelector('svg')
    expect(svg, 'the editor rendered nothing').not.toBeNull()
    expect(grayInk(svg!).length, 'the hidden rest lost its gray on screen').toBeGreaterThan(0)
  })
})
