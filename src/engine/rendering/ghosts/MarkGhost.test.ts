// @vitest-environment jsdom
/**
 * The mark ghosts (S11b, the dynamic S11c): the armed articulation(s), accidental, dot, tremolo and dynamic, each hung on a lone
 * note built by the score's own classes and pipeline, and drawn alone.
 *
 * ⚠️ jsdom has no `getBBox`, so a sign ghost there measures nothing and takes itself down. This spec
 * STUBS it — the claims are the wiring: which group, which glyphs, in which order, painted how. Where
 * the ink lands against the pointer is the browser's, and was proved once by an A/B of every cursor
 * ghost's ink against the previous commit (`docs/history/vexflow-removal-map.md` S11b).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { MusicEngine } from '../../MusicEngine'
import { GHOST_GROUP_SELECTOR } from './GhostRenderer'

const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect }
let saved: typeof proto.getBBox

describe('MarkGhost', () => {
  let container: HTMLElement
  let engine: MusicEngine
  /** The one ghost that is up — only one ever is — checked to be the KIND's group. (The painter adds a
   *  prefix to the class; the kind is its tail.) */
  const ghost = (kind: string) => {
    const groups = container.querySelectorAll(GHOST_GROUP_SELECTOR)
    expect(groups).toHaveLength(1)
    expect(groups[0].getAttribute('class')!.endsWith(`ghost-${kind}`)).toBe(true)
    return groups[0]
  }
  const codes = (kind: string) =>
    [...ghost(kind).querySelectorAll('text')].map(t => t.textContent!.codePointAt(0)!.toString(16))

  beforeAll(() => {
    saved = proto.getBBox
    proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect
  })
  afterAll(() => { proto.getBBox = saved })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
    engine.renderScore()
  })

  it('stacks several armed articulations closest-to-the-head first, in ONE ghost group', () => {
    expect(engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'articulation', types: ['accent', 'staccato'] })).toBe(true)
    expect(container.querySelectorAll(GHOST_GROUP_SELECTOR)).toHaveLength(1)
    // The staccato is the augmentation-dot glyph, as it is on the page (VexFlow's `a.` row); then the accent.
    expect(codes('articulation')).toEqual(['e1e7', 'e4a0'])
  })

  it('draws the armed accidental, dot and tremolo, each in its own swept group', () => {
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'accidental', accidental: 'b' })
    expect(codes('accidental')).toEqual(['e260']) // accidentalFlat
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'dot', count: 1 })
    expect(codes('dot')).toEqual(['e1e7']) // augmentationDot
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'dot', count: 3 })
    expect(codes('dot')).toEqual(['e1e7', 'e1e7', 'e1e7']) // the armed COUNT (multiple-dots-plan D5)
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'tremolo', mark: 3 })
    expect(codes('tremolo')).toEqual(['e220', 'e220', 'e220']) // tremolo1, three strokes
  })

  it('paints the ghost blue at 0.7, and draws no note — only the mark', () => {
    engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'accidental', accidental: '#' })
    const group = ghost('accidental')
    expect(group.getAttribute('opacity')).toBe('0.7')
    // The sign is the ONLY ink — no head, no stem, no staff line of the lone note it hung on.
    const ink = group.querySelectorAll('text, path, rect, line')
    expect(ink).toHaveLength(1)
    expect(ink[0].getAttribute('fill')).toBe('#3B82F6')
  })

  it('draws the armed dynamic ALONE, its glyph run grown to the glyph size, in the bare-class group', () => {
    const dynamic = { id: 'ghost-dynamic', beat: { num: 0, den: 1 }, text: '\uE521\uE520 dolce' }
    expect(engine.renderScoreWithToolGhost({ x: 200, y: 100 }, { kind: 'dynamic', dynamic })).toBe(true)
    const groups = container.querySelectorAll(GHOST_GROUP_SELECTOR)
    expect(groups).toHaveLength(1)
    // Bare: `notation.css` colours it by this class, not the painter's prefixed one.
    expect(groups[0].getAttribute('class')).toBe('ghost-dynamic-group')
    expect(groups[0].getAttribute('font-style')).toBe('italic')
    // One text — no head, no stem of the lone note — laid out as the score lays it: the level as one
    // precomposed Bravura glyph (`mp`), then the words.
    const texts = groups[0].querySelectorAll('text')
    expect(texts).toHaveLength(1)
    const runs = [...texts[0].querySelectorAll('tspan')]
    expect(runs.map(r => r.getAttribute('font-family'))).toEqual(['Bravura', expect.stringContaining('Georgia')])
    expect(runs[0].textContent!.codePointAt(0)!.toString(16)).toBe('e52c') // dynamicMP
  })
})
