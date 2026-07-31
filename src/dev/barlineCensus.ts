/**
 * TEMPORARY — the measuring instrument for "why do some barlines look thicker than others?"
 * (docs/firefox-zoom-repaint.md). Dev builds only; delete when the question is closed.
 *
 * ## Why it has to run in HIS browser
 *
 * The thing being investigated is invisible to every automated check we have. A headless screenshot
 * of the same score in Firefox and in Chromium comes out **byte-identical**, because
 * `page.screenshot()` forces a synchronous, correct repaint — the trap already recorded in the
 * write-up. So the only instrument that can see the problem is one that runs in the window a person
 * is actually looking at.
 *
 * What it reports is not a picture but the thing that DECIDES the picture: where each barline's ink
 * falls **on the device-pixel grid**. A line whose left edge is at 412.0 device pixels and whose
 * width is 1.0 covers exactly one column and comes out solid black. The same line at 412.5 covers
 * half of two columns and comes out as a pale two-pixel smear — twice as wide, half as dark, from
 * identical ink. That is the whole of the phenomenon, and these two numbers are all of it.
 *
 * The device grid is CSS pixels × `devicePixelRatio`, and the CSS position already includes the
 * editor's zoom (a transform on an ancestor), which is why every number here comes out of
 * `getScreenCTM()` rather than out of any of our own state.
 */

/** One barline as the screen will actually resolve it. */
export interface BarlineOnScreen {
  /** The left edge in device pixels — whole means crisp, fractional means split across columns. */
  left: number
  /** The width in device pixels. */
  width: number
  /** How far the left edge sits into a pixel: 0 is perfectly aligned, 0.5 is worst. */
  phase: number
  /** True when this line lands on whole pixels and so renders as solid columns. */
  crisp: boolean
}

const EPSILON = 0.02

/** Read every drawn barline's device-pixel geometry. Pure DOM reading — draws nothing, changes
 *  nothing. `dpr` is a parameter so a test can pin a screen it does not have. */
export function barlinesOnScreen(
  root: ParentNode = document,
  dpr: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
): BarlineOnScreen[] {
  const out: BarlineOnScreen[] = []
  for (const rect of root.querySelectorAll<SVGRectElement>('g.vf-stavebarline rect')) {
    const ctm = rect.getScreenCTM()
    if (!ctm) continue
    const x = parseFloat(rect.getAttribute('x') ?? '0')
    const w = parseFloat(rect.getAttribute('width') ?? '0')
    const left = (ctm.a * x + ctm.e) * dpr
    const width = ctm.a * w * dpr
    const phase = left - Math.floor(left)
    out.push({
      left,
      width,
      phase,
      crisp: Math.min(phase, 1 - phase) < EPSILON && Math.abs(width - Math.round(width)) < EPSILON,
    })
  }
  return out.sort((a, b) => a.left - b.left)
}

/**
 * `__barlines.dump()` — the table, plus the one line that answers the question.
 *
 * A row per barline: where it starts on the pixel grid and how wide it is there. The verdict counts
 * how many are landing between pixels, because that — not the amount of ink — is what makes one
 * barline look heavier than its neighbour.
 */
export function dumpBarlineCensus(root: ParentNode = document): void {
  const lines = barlinesOnScreen(root)
  if (lines.length === 0) {
    console.log('[barlines] nothing drawn to measure')
    return
  }
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const blurry = lines.filter(l => !l.crisp)
  const widths = [...new Set(lines.map(l => l.width.toFixed(2)))]

  console.log(
    `[barlines] ${lines.length} drawn · devicePixelRatio ${dpr} · ` +
      `widths on screen: ${widths.join(', ')} device px`,
  )
  console.table(
    lines.map((l, i) => ({
      '#': i + 1,
      'left (device px)': l.left.toFixed(3),
      'width': l.width.toFixed(3),
      'phase': l.phase.toFixed(3),
      'crisp': l.crisp ? 'yes' : 'NO — splits across two columns',
    })),
  )
  if (blurry.length === 0) {
    console.log(
      `[barlines] ✅ all ${lines.length} land on whole pixels at one width. ` +
        'If they still look uneven, the difference is NOT in what we drew — the browser is ' +
        'showing a scaled copy of an older rasterisation (docs/firefox-zoom-repaint.md).',
    )
  } else {
    console.log(
      `[barlines] ⚠️ ${blurry.length} of ${lines.length} land BETWEEN pixels — those are the ones ` +
        'that look fatter and paler. Hinting either has not run or has run against a stale zoom.',
    )
  }
}
