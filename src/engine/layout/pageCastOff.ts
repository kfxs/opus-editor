import type { SurfaceMetrics } from './surface'

/**
 * **The vertical casting-off**: which page each system lands on, and where it sits on that page.
 *
 * The horizontal twin of this already exists and is much the larger job (`MeasureLayout` decides
 * how many bars fit on a line, and justifies them). This is the whole vertical algorithm, and it is
 * short for a reason: a system's height is already known — `staffSpacingLayout` computed it,
 * overrides and all — so casting off vertically is only ever "does the next one still fit".
 *
 * ⭐ It asks the surface exactly ONE question: `contentHeightPx`. `null` is "no page" and nothing
 * ever breaks, which is the canvas — so the sketching surface takes the same code path rather than
 * a special case. And it reads the room BEFORE a break (page minus its own top/bottom margins),
 * never the page height: how the sheets are then STACKED into one tall SVG is a drawing decision
 * and belongs to `PagePass`, not to this.
 */
export interface PageCastOff {
  /** `pageOfLine[line]` — which page that system landed on. All 0 when there is no page. */
  pageOfLine: number[]
  /** `lineTopInPagePx[line]` — the system's top, measured from the top of ITS OWN page. */
  lineTopInPagePx: number[]
  /** How many pages the music took. **1 for a canvas**: the single endless strip is one page. */
  pageCount: number
}

/** Float noise only — a system must not fall off a page because a sum landed on 1525.9999999999. */
const EPSILON = 1e-6

/**
 * Does system `line` OPEN its page — is what sits above it the page's top MARGIN rather than
 * another system?
 *
 * The one question the staff-spacing floor asks of the casting-off, and it has to be asked here
 * because only this pass knows where the breaks fell. A system's "space above" tightens the gap to
 * whatever is above it; where that is another system there is room to take, and where it is the
 * top of the sheet there is none — taking it walks the music off the paper. See
 * `MIN_SPACING_ABOVE_AT_PAGE_TOP` in `./staffStride`.
 */
export function opensPage(pageOfLine: readonly number[], line: number): boolean {
  if (line < 0 || line >= pageOfLine.length) return false
  return line === 0 || pageOfLine[line] !== pageOfLine[line - 1]
}

export function pageCastOff(
  /** Each system's drawn height, in score order — `StaffSpacingLayout.lineHeightPx`. */
  lineHeightPx: readonly number[],
  surface: SurfaceMetrics,
): PageCastOff {
  const room = surface.contentHeightPx
  const pageOfLine: number[] = []
  const lineTopInPagePx: number[] = []

  let page = 0
  /** How much of the current page's room the systems already on it have taken. */
  let used = 0

  for (const height of lineHeightPx) {
    // ⚠️ `used > 0` is what makes a system TALLER THAN A PAGE terminate. Such a system (many
    // staves, or a big staff-spacing override) cannot fit anywhere, so asking "does it fit?" of an
    // empty page must answer YES: it takes that page for itself and overflows the bottom, and the
    // next system starts a fresh one. Drop the guard and it is pushed to a new page forever —
    // an infinite loop, or a run of blank pages, depending on how the loop is written.
    if (room !== null && used > 0 && used + height > room + EPSILON) {
      page++
      used = 0
    }
    pageOfLine.push(page)
    lineTopInPagePx.push(surface.marginTopPx + used)
    used += height
  }

  // An empty score still has a sheet of paper to look at.
  return { pageOfLine, lineTopInPagePx, pageCount: page + 1 }
}
