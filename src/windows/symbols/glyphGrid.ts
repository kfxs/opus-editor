import type { Widget } from '../content/Widget'
import { CHROME } from '../../utils/chromeColors'
import { escapeXml, glyphSvgMarkup } from './glyphSvg'
import type { Glyph, RangeBlock } from './smufl'

/**
 * The chart itself: one continuous scroll, a heading over each SMuFL range, a wall of glyphs under
 * it — Sibelius's Symbols panel (docs/symbols-window-plan.md).
 *
 * ⚠️ **A cell holds a glyph and nothing else.** No codepoint under it, no name, no badge. That rule
 * is the whole look: what makes the panel readable is that the eye meets ink and not labels. Every
 * other fact belongs to the bars above and below (P1/P2), never in here.
 *
 * ## Why the blocks fill lazily
 *
 * 2932 glyphs is 2932 SVG texts, and building them all at open costs a visible freeze — in a music
 * font, where each one is a real outline to shape. MuseScore dodges this by showing ONE range at a
 * time; the price is that you cannot scroll from noteheads into slash noteheads, and that price is
 * exactly what we refused. So a block reserves its height up front (its glyph count is known, so
 * its height is arithmetic) and builds its cells only when it scrolls near — the scrollbar is
 * therefore truthful from the first frame, and nothing jumps under the pointer as blocks fill.
 */

/** One cell, in px. The chart's one size knob: cells, reserved heights and the glyph all follow. */
const CELL = 44
/**
 * The glyph's font-size. Comfortably under {@link CELL}, because SMuFL's em square is only the
 * STAFF (four spaces) — a G clef is some seven spaces tall and a staff bracket taller still, so a
 * glyph sized to fill the cell would have most of the chart hanging out of it.
 */
const GLYPH_PX = 26
/**
 * Air between cells. Not decoration: each cell draws its own box, and at gap 0 two neighbouring
 * boxes share an edge that reads as one heavy 2px rule. It also gives the oversized glyphs — a
 * staff bracket is several cells tall — somewhere to bleed that is not the next glyph's box.
 */
const GAP = 2
/** Gutter around a block's grid, and the space a heading keeps from the block above it. */
const PAD = 10

export interface GlyphGridOptions {
  /** Fires with the range id whose block the scroll is currently sitting in. */
  onActiveBlock?: (id: string) => void
  /** Fires with the canonical name of a clicked glyph — what the detail bar reads. */
  onSelect?: (name: string) => void
}

export class GlyphGrid implements Widget {
  private scroller: HTMLElement | null = null
  /** Per block: its section element, its cell container, and whether the cells are built yet. */
  private readonly sections = new Map<string, { el: HTMLElement; cells: HTMLElement; filled: boolean }>()
  private visibility: IntersectionObserver | null = null
  private resize: ResizeObserver | null = null
  private active = ''
  private scrollQueued = false
  /** The selected glyph's NAME survives a rebuild; the element that drew it does not. */
  private selected = ''
  private selectedCell: SVGElement | null = null

  constructor(
    private blocks: RangeBlock[],
    private readonly opts: GlyphGridOptions = {},
  ) {}

  mount(host: HTMLElement): void {
    const scroller = document.createElement('div')
    // Positioned, so that every block's `offsetParent` IS this scroller and `offsetTop` is its
    // distance down the chart. Left static, a block measures itself against whatever positioned
    // ancestor happens to be above the window, and both the scroll-to and the active-range marker
    // read a number that has nothing to do with this box.
    scroller.style.position = 'relative'
    // Fills its pane as a flex child; `height: 100%` stays as the fallback for a plain block host.
    scroller.style.flex = '1'
    scroller.style.minHeight = '0'
    scroller.style.height = '100%'
    scroller.style.overflowY = 'auto'
    scroller.style.overflowX = 'hidden'
    scroller.style.padding = `0 ${PAD}px ${PAD}px`

    // rootMargin: start building a block a screen before it arrives, so the cells are already there
    // by the time it is looked at. `root` is the scroller, not the viewport — the window scrolls
    // inside itself and the document never moves.
    this.visibility = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          this.fill(entry.target as HTMLElement)
        }
      },
      { root: scroller, rootMargin: '600px 0px' },
    )

    scroller.addEventListener('scroll', this.onScroll)
    // ONE listener for up to 2932 cells, on the scroller: a per-cell handler would have to be
    // attached by the same code that builds cells from an HTML string, which is the reason that
    // build is fast in the first place.
    scroller.addEventListener('click', this.onClick)
    host.appendChild(scroller)
    this.scroller = scroller

    this.render()

    // Reserving needs a WIDTH, and a node has none until it is in the document. Re-run on resize
    // for the blocks still unbuilt: the column count changes with the window, and a reserved height
    // that no longer matches would drift the scrollbar.
    this.resize = new ResizeObserver(() => this.reserveAll())
    this.resize.observe(scroller)
  }

  /**
   * Show a different set of blocks — what the search box does.
   *
   * A rebuild, not a hide: a filtered chart holds a few dozen cells where the whole one holds 2932,
   * and keeping the other 2900 in the document to be skipped is paying the price the lazy fill
   * exists to avoid. Sections are cheap to make precisely because they start empty.
   */
  setBlocks(blocks: RangeBlock[]): void {
    this.blocks = blocks
    this.active = ''
    this.render()
    if (this.scroller) this.scroller.scrollTop = 0
    this.reportActive()
  }

  private render(): void {
    const scroller = this.scroller
    if (!scroller) return

    // One observer for the life of the grid: disconnect drops every old target at once, which is
    // exactly what a rebuild wants — the nodes it was watching are about to be discarded.
    this.visibility?.disconnect()
    scroller.replaceChildren()
    this.sections.clear()

    for (const block of this.blocks) {
      const section = document.createElement('section')

      const heading = document.createElement('h2')
      heading.textContent = block.title
      heading.style.margin = `${PAD * 1.6}px 0 ${PAD * 0.6}px`
      heading.style.font = '600 12px system-ui, sans-serif'
      heading.style.letterSpacing = '0.04em'
      heading.style.textTransform = 'uppercase'
      heading.style.color = CHROME.inkMuted
      section.appendChild(heading)

      const cells = document.createElement('div')
      cells.style.display = 'grid'
      cells.style.gridTemplateColumns = `repeat(auto-fill, ${CELL}px)`
      cells.style.gap = `${GAP}px`
      cells.dataset.range = block.id
      section.appendChild(cells)

      scroller.appendChild(section)
      this.sections.set(block.id, { el: section, cells, filled: false })
      this.visibility?.observe(cells)
    }

    this.reserveAll()
  }

  destroy(): void {
    this.visibility?.disconnect()
    this.resize?.disconnect()
    this.scroller?.removeEventListener('scroll', this.onScroll)
    this.scroller?.removeEventListener('click', this.onClick)
    this.selectedCell = null
    this.visibility = null
    this.resize = null
    this.scroller = null
    this.sections.clear()
  }

  /** Bring a range's block to the top of the view — what the range list on the left does. */
  scrollToBlock(id: string): void {
    const section = this.sections.get(id)
    if (!section || !this.scroller) return
    this.scroller.scrollTop = section.el.offsetTop
  }

  private reserveAll(): void {
    for (const block of this.blocks) {
      const section = this.sections.get(block.id)
      if (!section || section.filled) continue
      section.cells.style.minHeight = `${this.reservedHeight(block.glyphs.length)}px`
    }
  }

  /** The height a block WILL take, from its glyph count — so the scrollbar is honest before the
   *  cells exist. Column count is measured, never assumed: the window is resizable. */
  private reservedHeight(count: number): number {
    const width = this.scroller?.clientWidth ?? 0
    // How `auto-fill` counts: n cells fit when n·CELL + (n−1)·GAP ≤ W. The gap has to be in BOTH
    // sums — left out, the reservation drifts a row every dozen blocks and the scrollbar lies.
    const columns = Math.max(1, Math.floor((width - PAD * 2 + GAP) / (CELL + GAP)))
    const rows = Math.ceil(count / columns)
    return rows * CELL + Math.max(0, rows - 1) * GAP
  }

  private fill(cells: HTMLElement): void {
    const id = cells.dataset.range ?? ''
    const section = this.sections.get(id)
    const block = this.blocks.find(b => b.id === id)
    if (!section || !block || section.filled) return

    // One innerHTML per block, not 250 createElement calls: this runs while the user is scrolling
    // toward the block, and the parse is measurably cheaper than the node-by-node build.
    cells.innerHTML = block.glyphs.map(cellSvg).join('')
    // The reservation has done its job; let the real content own the height from here.
    cells.style.minHeight = ''
    section.filled = true
    this.visibility?.unobserve(cells)
    // A block can be built AFTER its glyph was selected — select one, scroll away, scroll back —
    // so a freshly filled block has to be told what is already selected.
    if (this.selected) this.paintSelection(cells.querySelector(`[data-glyph="${this.selected}"]`))
  }

  private readonly onClick = (event: MouseEvent): void => {
    const cell = (event.target as Element | null)?.closest?.('[data-glyph]')
    if (!(cell instanceof SVGElement)) return
    const name = cell.dataset.glyph ?? ''
    this.selected = name
    this.paintSelection(cell)
    this.opts.onSelect?.(name)
  }

  /** Light the selected cell and put out the last one. The box is already there; only its ink
   *  changes, so nothing moves and no cell resizes under the pointer. */
  private paintSelection(cell: Element | null): void {
    if (this.selectedCell && this.selectedCell !== cell) {
      this.selectedCell.querySelector('rect')?.setAttribute('stroke', CHROME.edge)
      this.selectedCell.querySelector('rect')?.setAttribute('stroke-width', '1')
    }
    this.selectedCell = cell instanceof SVGElement ? cell : null
    const rect = this.selectedCell?.querySelector('rect')
    rect?.setAttribute('stroke', CHROME.accent)
    rect?.setAttribute('stroke-width', '2')
  }

  private readonly onScroll = (): void => {
    if (this.scrollQueued) return
    this.scrollQueued = true
    requestAnimationFrame(() => {
      this.scrollQueued = false
      this.reportActive()
    })
  }

  /** Which block the top of the view is in — the list on the left marks it. */
  private reportActive(): void {
    const scroller = this.scroller
    if (!scroller || !this.opts.onActiveBlock) return
    // A few px past the top edge: a heading sitting exactly ON the edge belongs to the block it
    // introduces, not to the one it has just left.
    const top = scroller.scrollTop + PAD

    let current = this.blocks[0]?.id ?? ''
    for (const block of this.blocks) {
      const section = this.sections.get(block.id)
      if (!section || section.el.offsetTop > top) break
      current = block.id
    }
    if (current === this.active) return
    this.active = current
    this.opts.onActiveBlock(current)
  }
}

/**
 * One cell: an SVG box with the glyph on its baseline.
 *
 * ⚠️ SVG and not a `<span>`, for the reason `widgets.ts` learned the hard way — an HTML line box is
 * sized by the font's line metrics and CLIPS a note's stem. In SVG we state the box ourselves and
 * put the baseline where we want it. `overflow: visible` lets the genuinely huge glyphs (brackets,
 * octave lines) bleed into the gutter rather than be cut in half; a chart that lies about a glyph's
 * shape is worse than one that is briefly untidy.
 */
function cellSvg(glyph: Glyph): string {
  // The box is drawn INSIDE the SVG rather than as a CSS border: a border would sit outside the
  // SVG's viewport and enlarge the cell past CELL, which is the number the reservation arithmetic
  // above is built on.
  //
  // The tooltip is the ONLY fact a cell carries, and it is not drawn: everything else about the
  // glyph belongs to the detail bar, so the chart stays a wall of glyphs.
  return glyphSvgMarkup(glyph.char, {
    box: CELL,
    size: GLYPH_PX,
    outline: true,
    title: `${glyph.name}  ${glyph.codepoint}`,
    attrs: `data-glyph="${escapeXml(glyph.name)}" style="cursor: pointer"`,
  })
}
