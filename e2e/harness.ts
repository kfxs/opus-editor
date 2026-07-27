/**
 * The browser side of the geometry net (docs/refactor-plan-2026-07-27.md Phase 5).
 *
 * Unit tests run in jsdom, which has no layout and no fonts: every glyph measures 0×0, so an
 * assertion about where the ink landed agrees with itself and proves nothing
 * (`docs/ARCHITECTURE.md`, and the comment at the head of `VexFlowRenderer.fan.test.ts` saying so
 * in as many words). This page exists to run the SAME engine in a REAL browser, with the real
 * Bravura metrics, so the numbers are real.
 *
 * It boots the engine and NOTHING else — no `App`, no controllers, no dev shell. So a failure here
 * is about the renderer, never about wiring (`App.smoke.test.ts` already covers wiring in jsdom).
 * It also keeps the page to ONE score: VexFlow reaches back for what it drew with document-wide
 * `getElementById`, so two engines on a page make those ids ambiguous and the first in tree order
 * wins.
 *
 * The specs drive `window.__h` through `page.evaluate`. Everything they need to READ off the
 * drawing is a function here, so a spec can be a statement about geometry instead of a pile of DOM
 * queries. The readers deliberately parse the drawing's own numbers — a `<text>`'s x/y, a `<path>`'s
 * `d` — rather than calling `getBBox()`: a music glyph is a `<text>`, and its box is the text
 * layout box (160px tall for a notehead), not its ink.
 */
import { MusicEngine } from '@/engine/MusicEngine'
import { exportScorePdf } from '@/engine/export/pdfExport'
import { fracCreate } from '@/utils/fraction'

/** A glyph as drawn: its SMuFL codepoint (lower-case hex) and the anchor VexFlow placed it at. */
export interface Glyph {
  code: string
  x: number
  y: number
}

/** A straight line: a stem, a ledger line, a stave line. */
export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** A beam — drawn as a closed quadrilateral, so it has a thickness as well as a slope. */
export interface Quad {
  /** Left and right edges of the quad. */
  left: number
  right: number
  /** Middle of the quad's left and right edges — the line the beam reads as, and hence its slope. */
  yLeft: number
  yRight: number
}

/** One bar of one staff, as drawn: its own stave lines' extent. */
export interface StaveBox {
  measure: number
  staff: number
  x1: number
  x2: number
  /** y of the TOP stave line — bars on the same system share it. */
  top: number
}

export interface Harness {
  engine: MusicEngine
  /** `beat` is an exact Fraction everywhere in the model — never a float. */
  frac: typeof fracCreate
  /** Re-engrave. Awaits the font before the first one, so nothing measures fallback metrics. */
  render(): Promise<void>
  /** Every glyph matching `selector` (default: all of them), left to right. */
  glyphs(selector?: string): Glyph[]
  /** The noteheads, left to right. A notehead's anchor y IS the pitch's line/space. */
  noteheads(): Glyph[]
  /** The rests, left to right — including the ones the model fills empty beats with. */
  rests(): Glyph[]
  /**
   * The stems, left to right. `y1` is the notehead end, `y2` the tip (VexFlow draws them so), and a
   * BEAMED note's stem is already at the length its beam gave it — the beam group nests the same
   * `vf-stem` elements rather than drawing its own.
   */
  stems(): Segment[]
  /** Straight lines drawn inside `selector` — ledger lines, stems, stave lines. */
  segments(selector: string): Segment[]
  /** Closed 4-point paths inside `selector` — every beam, fan ramp line and tremolo stroke is one. */
  quads(selector: string): Quad[]
  /**
   * The beams that cross a barline, one entry per drawn fragment (a fragment holds one quad per
   * beam LINE, so an eighth-note join has one and a sixteenth-note join two).
   *
   * A `Beam` that spans two bars cannot live in either bar's group, so it is drawn as a direct
   * child of the `<svg>` — exactly the handle `CrossBarBeams.test.ts` identifies them by.
   */
  crossBarBeams(): Quad[][]
  /** Every barline, left to right (VexFlow draws a thin barline as a `<rect>`). */
  barlines(): { x: number; y: number; height: number }[]
  /** Every drawn bar of every staff — the source for "which system is this bar on?". */
  staves(): StaveBox[]
  /** Export the current score as a PDF (it downloads — the spec catches the download). */
  exportPdf(): Promise<void>
}

declare global {
  interface Window {
    __h: Harness
  }
}

const host = document.getElementById('score')
if (!host) throw new Error('#score not found — harness.html must provide the render target')

const engine = new MusicEngine({ container: host, width: 1000, height: 400 })

function svg(): SVGSVGElement {
  const el = host!.querySelector('svg')
  if (!el) throw new Error('no score <svg> — nothing has rendered yet')
  return el as SVGSVGElement
}

function all<T extends Element>(selector: string): T[] {
  return [...svg().querySelectorAll<T>(selector)]
}

const num = (el: Element, attr: string): number => Number(el.getAttribute(attr) ?? '0')

/** The points of a `d` made only of absolute M/L (+ optional Z) — which is all VexFlow emits for
 *  stems, ledger lines, beams, fan ramps and tremolo strokes. */
function pathPoints(d: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (const m of d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) {
    points.push({ x: Number(m[1]), y: Number(m[2]) })
  }
  return points
}

/** The closed 4-point paths among `elements`, left to right — every beam, fan ramp line and
 *  two-note tremolo stroke is one, and nothing else in a score is. */
function quadsOf(elements: SVGPathElement[]): Quad[] {
  return elements
    .map(p => pathPoints(p.getAttribute('d') ?? ''))
    .filter(pts => pts.length === 4)
    .map(toQuad)
    .sort((a, b) => a.left - b.left || a.yLeft - b.yLeft)
}

function toQuad(points: { x: number; y: number }[]): Quad {
  const xs = points.map(p => p.x)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  // Two corners share each edge (a beam has a thickness); the line it reads as runs between them.
  const at = (x: number) => {
    const ys = points.filter(p => Math.abs(p.x - x) < 0.001).map(p => p.y)
    return (Math.min(...ys) + Math.max(...ys)) / 2
  }
  return { left, right, yLeft: at(left), yRight: at(right) }
}

const byX = <T extends { x: number; y: number }>(a: T, b: T) => a.x - b.x || a.y - b.y

/** SMuFL's ranges are the only thing that tells one glyph from another here — see `noteheads`. */
const inRange = (first: number, last: number) => (glyph: Glyph): boolean => {
  const code = parseInt(glyph.code, 16)
  return code >= first && code <= last
}

let fontsReady = false

const harness: Harness = {
  engine,
  frac: fracCreate,

  async render(): Promise<void> {
    // VexFlow ships Bravura/Academico as web fonts and every glyph is a `<text>`, so a render that
    // beats `document.fonts.ready` measures FALLBACK metrics and engraves to them — the same
    // requirement `renderScoreSvg` documents for the PDF path.
    if (!fontsReady) {
      await document.fonts.ready
      fontsReady = true
    }
    engine.renderScore()
  },

  glyphs(selector = 'text'): Glyph[] {
    return all<SVGTextElement>(selector)
      .filter(t => (t.textContent ?? '').length > 0)
      .map(t => ({ code: t.textContent!.codePointAt(0)!.toString(16), x: num(t, 'x'), y: num(t, 'y') }))
      .sort(byX)
  },

  // ⚠️ A rest is drawn as a `vf-notehead` too — VexFlow gives a rest a StaveNote and its glyph goes
  // in the same group — so the two are told apart by SMuFL's own ranges (noteheads U+E0A0–E0FF,
  // rests U+E4E0–E4FF) and not by the DOM. Without that, "the noteheads" silently includes the
  // rests the model fills the rest of the bar with.
  noteheads: () => harness.glyphs('g.vf-notehead text').filter(inRange(0xe0a0, 0xe0ff)),
  rests: () => harness.glyphs('g.vf-notehead text').filter(inRange(0xe4e0, 0xe4ff)),

  segments(selector: string): Segment[] {
    return all<SVGPathElement>(selector)
      .map(p => pathPoints(p.getAttribute('d') ?? ''))
      .filter(pts => pts.length === 2)
      .map(pts => ({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y }))
      .sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1)
  },

  stems: () => harness.segments('g.vf-stem path'),

  quads: (selector: string) => quadsOf(all<SVGPathElement>(selector)),

  crossBarBeams: () =>
    [...svg().children]
      .filter(el => el.getAttribute('class') === 'vf-beam')
      .map(group => quadsOf([...group.querySelectorAll<SVGPathElement>('path')]))
      .filter(quads => quads.length > 0)
      .sort((a, b) => a[0].yLeft - b[0].yLeft || a[0].left - b[0].left),

  barlines: () =>
    all<SVGRectElement>('g.vf-stavebarline rect')
      .map(r => ({ x: num(r, 'x'), y: num(r, 'y'), height: num(r, 'height') }))
      .sort((a, b) => a.x - b.x),

  staves(): StaveBox[] {
    return all<SVGGElement>('g.vf-measure[id]').flatMap(g => {
      // The group id is the renderer's own measure key: `vf-m<measure>-s<staff>`.
      const key = /^vf-m(\d+)-s(\d+)$/.exec(g.getAttribute('id') ?? '')
      const lines = [...g.querySelectorAll<SVGPathElement>('g.vf-stave path')]
        .map(p => pathPoints(p.getAttribute('d') ?? ''))
        .filter(pts => pts.length === 2 && Math.abs(pts[0].y - pts[1].y) < 0.001)
      if (!key || lines.length === 0) return []
      return [{
        measure: Number(key[1]),
        staff: Number(key[2]),
        x1: Math.min(...lines.map(l => l[0].x)),
        x2: Math.max(...lines.map(l => l[1].x)),
        top: Math.min(...lines.map(l => l[0].y)),
      }]
    }).sort((a, b) => a.top - b.top || a.x1 - b.x1)
  },

  exportPdf: () => exportScorePdf(engine.getScore()),
}

window.__h = harness
