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
  reportGrid(lines, blurry)
}

/**
 * `__barlines.boxes()` — every barline you can CLICK, against every barline you can SEE.
 *
 * The question this answers is *"is the selection landing on a barline that isn't there?"*. The two
 * are separate facts and can disagree:
 *
 *  - the **hit-box** is registered by tier 1, which runs for **every bar in the score**, drawn or
 *    not — that is what keeps hit-testing honest for music scrolled off-screen;
 *  - the **ink** is tier 2's, and a culled bar has none.
 *
 * A row with `ink: NO` is a barline you can select and cannot see. A row with `drag: —` is one the
 * bar-width gesture will refuse, silently, because the room cannot be measured: `barWidthRoom`
 * declines on a dirty model, on a bar with nothing drawn, and on a bar with no note space to
 * multiply. The two failures look identical from the outside — the barline lights up and will not
 * move — so this prints both, and which bar each belongs to.
 */
export function barlineBoxes(engine: BarlineEngine, root: ParentNode = document): void {
  const registered = engine.getElementRegistry().getByType('barline')
  if (registered.length === 0) {
    console.log('[barlines] no barline hit-boxes registered')
    return
  }

  // Where ink actually is, by its asked-for x (the hinting pass moves the drawn x, never this one).
  const ink = new Set(
    [...root.querySelectorAll<SVGRectElement>('g.vf-stavebarline rect')].map(r =>
      Math.round(parseFloat(r.dataset.baselineX ?? r.getAttribute('x') ?? '0')),
    ),
  )

  const rows = registered.map(el => {
    const measure = el.measure
    // The registered box straddles the line: `x + width - 2`, 4 wide. Its centre is the boundary.
    const boundary = Math.round(el.bbox.x + el.bbox.width / 2)
    const room = measure === undefined ? null : engine.barWidthRoom(measure)
    return {
      bar: measure ?? '?',
      staff: el.staff ?? 0,
      'boundary x': boundary,
      'ink': [boundary - 1, boundary, boundary + 1].some(x => ink.has(x)) ? 'yes' : 'NO — invisible',
      'drag': room ? `${room.minStretch.toFixed(2)}…${room.maxStretch.toFixed(2)}` : '— REFUSES',
      'now': measure === undefined ? '?' : engine.getBarWidth(measure).toFixed(3),
      'barline moves': room ? (room.barlineSlope > 0 ? 'yes' : 'pinned (ends its system)') : '—',
    }
  })

  const invisible = rows.filter(r => r.ink !== 'yes')
  const stuck = rows.filter(r => r.drag === '— REFUSES')
  console.log(
    `[barlines] ${rows.length} clickable · ${ink.size} drawn · ` +
      `${invisible.length} clickable-but-invisible · ${stuck.length} that refuse the drag`,
  )
  console.table(rows)
  if (invisible.length > 0) {
    console.log(
      `[barlines] ⚠️ bars ${invisible.map(r => r.bar).join(', ')} have a hit-box with no line under ` +
        'it. Clicking there selects a barline you cannot see.',
    )
  }
  if (stuck.length > 0) {
    console.log(
      `[barlines] ⚠️ bars ${stuck.map(r => r.bar).join(', ')} will not drag: the room cannot be ` +
        'measured (nothing drawn for the bar, or the model is dirty). The selection still happens.',
    )
  }
}

/** What the census needs of the engine — named here so `dev/` states its own dependency. */
export interface BarlineEngine {
  getElementRegistry(): {
    getByType(type: 'barline'): { measure?: number; staff?: number; bbox: { x: number; width: number } }[]
  }
  barWidthRoom(measure: number): { minStretch: number; maxStretch: number; barlineSlope: number } | null
  getBarWidth(measure: number): number
}

function reportGrid(lines: BarlineOnScreen[], blurry: BarlineOnScreen[]): void {
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
