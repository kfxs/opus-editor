/**
 * TEMPORARY — the P0 measurement instrument for the spacing model (docs/spacing-model-plan.md P0).
 * Delete when P5 closes; nothing in the app may depend on it.
 *
 * P0 exists because *"nothing can be called an improvement without a before"*. This module IS the
 * before: it reads the drawing and reports, per bar, **where every column landed and how wide the
 * gap after it is, in staff spaces** — the unit Gould's table is written in, so a measured gap and
 * the rule that will replace it can be compared without converting anything.
 *
 * ## Why a browser, and why here
 *
 * Headless every music glyph measures 0×0 (docs/spacing-model-research.md §5.4), so a census taken
 * in jsdom would report the *floor* talking to itself. The numbers have to come off a real render
 * with real Bravura metrics, which means two callers, both real:
 *
 *  - `e2e/spacing.e2e.ts`, through `window.__h.columnGaps()` — the repeatable measurement;
 *  - `__spacing.dump()` in a dev build — because he reads the score by eye and wants the numbers
 *    for the bar he is looking at, on his own score, not on a fixture.
 *
 * So the ARITHMETIC is a pure exported function ({@link censusColumns}) that both call, and only
 * the DOM reading differs: the harness feeds it the readers it already has, and the app feeds it
 * {@link readDrawing}. If the two ever disagree, one of them is reading the drawing wrong — which
 * for a measuring instrument is worth knowing.
 *
 * ⚠️ This measures ANCHORS, not ink. A column's x is where VexFlow placed the leftmost notehead of
 * that column; the ink either side of it (accidentals, dots, ledger overhang) is the OTHER half of
 * the model and does not exist until P3. A gap here is therefore centre-to-centre, which is exactly
 * what Gould's 3½-spaces-per-quarter is a statement about.
 */

/** A glyph as drawn: where VexFlow anchored it. Shape-compatible with `e2e/harness.ts`'s `Glyph`. */
export interface CensusGlyph {
  x: number
  y: number
  /** SMuFL codepoint, lower-case hex — what tells a notehead from a rest. */
  code: string
}

/** One bar of one staff as drawn. Shape-compatible with `e2e/harness.ts`'s `StaveBox`. */
export interface CensusStave {
  measure: number
  staff: number
  x1: number
  x2: number
  /** y of the TOP stave line. `bottom - top` is four staff-spaces of REAL ink, which is how a staff
   *  drawn small reports its gaps in ITS OWN spaces rather than the score's. */
  top: number
  bottom: number
}

/** A rhythmic position at which something starts, as it came out on the page. */
export interface CensusColumn {
  /** Score px of the leftmost glyph sharing this column. */
  x: number
  /** Every glyph anchored here — a chord is several, a fan's members are one column each. */
  codes: string[]
  /** The gap to the NEXT column, in staff spaces. The last column's is the gap to the barline. */
  gap: number
}

/** One bar of one staff, censused. */
export interface BarSpacing {
  measure: number
  staff: number
  /** One staff space in score px, read off the drawn stave rather than assumed. */
  spacePx: number
  /** The bar's drawn width, stave line to stave line, in staff spaces. */
  width: number
  /**
   * From the stave's left edge to the first column, in staff spaces.
   *
   * ⚠️ NOT a spacing number to compare against a rule: it carries the header where there is one
   * (clef, key, meter) plus VexFlow's own note-start inset — `getAbsoluteX()` adds
   * `Metrics.get('Stave.padding')` = 12 px on top of `stave.getNoteStartX()` (plan §P4). It is here
   * so a bar's spaces add up to its width, and so a header's cost is visible instead of hidden.
   */
  lead: number
  columns: CensusColumn[]
}

/**
 * How close two anchors must be to count as ONE column, as a fraction of a staff space.
 *
 * ⚠️ 0.5 sits in a real gap in today's drawing and will not survive the model: the tightest gap the
 * editor currently draws is `MIN_NOTE_SPACING` = 1.8 spaces, and a DISPLACED notehead (the lower
 * note of a second) is offset by about 1.18 — so at 0.5 a second reads as two columns, which is
 * wrong but visibly wrong. None of P0's fixtures contains one.
 */
const SAME_COLUMN = 0.5

/**
 * The census: drawn glyphs, grouped into columns, per bar.
 *
 * Pure — no DOM, no VexFlow — so it is unit-testable on fixtures even though its INPUTS can only be
 * had from a browser. Glyphs outside every bar are dropped; a glyph inside more than one bar's
 * x-range (bars on different systems overlap horizontally) goes to the staff it is vertically
 * nearest, which is also what puts a grand staff's two hands in the right bar.
 */
export function censusColumns(staves: CensusStave[], glyphs: CensusGlyph[]): BarSpacing[] {
  const bars = staves.map(stave => ({ stave, glyphs: [] as CensusGlyph[] }))

  for (const glyph of glyphs) {
    let best: (typeof bars)[number] | undefined
    let bestDistance = Infinity
    for (const bar of bars) {
      const { x1, x2, top, bottom } = bar.stave
      if (glyph.x < x1 || glyph.x > x2) continue
      const distance = Math.abs(glyph.y - (top + bottom) / 2)
      if (distance < bestDistance) {
        best = bar
        bestDistance = distance
      }
    }
    best?.glyphs.push(glyph)
  }

  return bars.map(({ stave, glyphs: inBar }) => {
    const spacePx = (stave.bottom - stave.top) / 4
    const sorted = [...inBar].sort((a, b) => a.x - b.x)

    const columns: CensusColumn[] = []
    for (const glyph of sorted) {
      const last = columns[columns.length - 1]
      if (last && glyph.x - last.x <= SAME_COLUMN * spacePx) last.codes.push(glyph.code)
      else columns.push({ x: glyph.x, codes: [glyph.code], gap: 0 })
    }
    for (const [i, column] of columns.entries()) {
      const next = columns[i + 1]?.x ?? stave.x2
      column.gap = round((next - column.x) / spacePx)
    }

    return {
      measure: stave.measure,
      staff: stave.staff,
      spacePx,
      width: round((stave.x2 - stave.x1) / spacePx),
      lead: round(((columns[0]?.x ?? stave.x2) - stave.x1) / spacePx),
      columns,
    }
  })
}

/** Two decimals: a hundredth of a staff space is a tenth of a pixel, which is past where the ink is. */
function round(spaces: number): number {
  return Math.round(spaces * 100) / 100
}

/** SMuFL: noteheads U+E0A0–E0FF, rests U+E4E0–E4FF. Everything else a bar draws is not a column. */
function startsAColumn(code: string): boolean {
  const point = parseInt(code, 16)
  return (point >= 0xe0a0 && point <= 0xe0ff) || (point >= 0xe4e0 && point <= 0xe4ff)
}

/**
 * Read a drawn score's staves and column glyphs out of its `<svg>`.
 *
 * ⚠️ Stave lines are composed through each path's CTM rather than read off its `d`. A measure group
 * is REUSED between renders — a bar whose shape is unchanged but whose place is not gets
 * *translated* rather than re-engraved — so its lines keep the coordinates they were drawn at and a
 * `transform` carries them to where they actually are. The glyph anchors are read raw, because
 * nothing the score itself draws has a transform above it (a cursor GHOST does, and is not here).
 */
export function readDrawing(svg: SVGSVGElement): { staves: CensusStave[]; glyphs: CensusGlyph[] } {
  const toScore = svg.getScreenCTM()!.inverse()
  const placedAt = (el: Element, x: number, y: number): DOMPoint => {
    const point = svg.createSVGPoint()
    point.x = x
    point.y = y
    return point.matrixTransform((el as SVGGraphicsElement).getScreenCTM()!).matrixTransform(toScore)
  }

  const staves: CensusStave[] = []
  for (const group of svg.querySelectorAll<SVGGElement>('g.vf-measure[id]')) {
    // The group id is the renderer's own measure key: `vf-m<measure>-s<staff>`.
    const key = /^vf-m(\d+)-s(\d+)$/.exec(group.getAttribute('id') ?? '')
    if (!key) continue
    const lines = [...group.querySelectorAll<SVGPathElement>('g.vf-stave path')]
      .map(path => ({ path, points: horizontalLine(path.getAttribute('d') ?? '') }))
      .filter((line): line is { path: SVGPathElement; points: number[] } => line.points !== null)
      .map(({ path, points }) => [placedAt(path, points[0], points[1]), placedAt(path, points[2], points[3])])
    if (lines.length === 0) continue
    staves.push({
      measure: Number(key[1]),
      staff: Number(key[2]),
      x1: Math.min(...lines.map(l => l[0].x)),
      x2: Math.max(...lines.map(l => l[1].x)),
      top: Math.min(...lines.map(l => l[0].y)),
      bottom: Math.max(...lines.map(l => l[0].y)),
    })
  }

  const glyphs: CensusGlyph[] = []
  for (const text of svg.querySelectorAll<SVGTextElement>('g.vf-notehead text')) {
    const content = text.textContent ?? ''
    if (content.length === 0) continue
    const code = content.codePointAt(0)!.toString(16)
    if (!startsAColumn(code)) continue
    glyphs.push({ code, x: Number(text.getAttribute('x') ?? '0'), y: Number(text.getAttribute('y') ?? '0') })
  }

  return { staves, glyphs }
}

/** `[x1, y1, x2, y2]` of a two-point HORIZONTAL `d` — a stave line — or null for anything else. */
function horizontalLine(d: string): number[] | null {
  const points = [...d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])])
  if (points.length !== 2 || Math.abs(points[0][1] - points[1][1]) >= 0.001) return null
  return [points[0][0], points[0][1], points[1][0], points[1][1]]
}

/**
 * Census the score drawn inside `container` right now. No re-render, so the instrument never
 * perturbs what it is measuring.
 *
 * ⛔ Deliberately two free functions rather than a `spacingCensus` object: this instrument holds no
 * state (`renderCensus` is a singleton because it accumulates one), and a singleton is a decision
 * the repo counts — `docs/DESIGN-PRINCIPLES.md` boundary case 5, enforced by `lint:singletons`.
 */
export function spacingBars(container: ParentNode = document): BarSpacing[] {
  const svg = container.querySelector('svg')
  if (!svg) {
    console.warn('[spacing] no score <svg> found')
    return []
  }
  const { staves, glyphs } = readDrawing(svg as SVGSVGElement)
  return censusColumns(staves, glyphs)
}

/** The dev-console instrument: `__spacing.dump()` — one row per bar, gaps in staff spaces. */
export function dumpSpacingCensus(container: ParentNode = document): void {
  const bars = spacingBars(container).filter(bar => bar.columns.length > 0)
  if (bars.length === 0) {
    console.log('[spacing] nothing drawn to measure')
    return
  }
  console.log(
    `[spacing] ${bars.length} bar(s), gaps in STAFF SPACES (Gould's quarter = 3.5). ` +
      '`lead` carries the header + VexFlow\'s 12px inset and is not a spacing number.',
  )
  console.table(
    bars.map(bar => ({
      bar: bar.measure,
      staff: bar.staff,
      cols: bar.columns.length,
      width: bar.width,
      lead: bar.lead,
      gaps: bar.columns.map(column => column.gap.toFixed(2)).join(' '),
      'widest gap': Math.max(...bar.columns.map(c => c.gap)),
      'tightest gap': Math.min(...bar.columns.map(c => c.gap)),
    })),
  )
}
