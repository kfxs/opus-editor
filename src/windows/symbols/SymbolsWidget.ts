import type { Widget } from '../content/Widget'
import { CHROME } from '../../utils/chromeColors'
import { CopyChips } from './copyChips'
import { GlyphGrid } from './glyphGrid'
import { glyphSvgMarkup } from './glyphSvg'
import { filterBlocks } from './search'
import { loadSmufl, type RangeBlock, type Smufl } from './smufl'

/**
 * The Symbols window's content: the search strip on top, the ranges down the left, the chart on
 * the right (docs/symbols-window-plan.md, P0–P1).
 *
 * The left column is NAVIGATION, not a mode: clicking a range scrolls the one continuous chart to
 * it, and scrolling past its end simply arrives in the next range — the difference between this and
 * MuseScore's one-range-at-a-time dialog, and the reason the grid is a single scroller. Narrowing
 * is the SEARCH BOX's job and only its job; two things that both filter would be two things to
 * disagree with each other.
 *
 * Its own DOM rather than the widget toolkit: `Widget.ts` reserves the toolkit for what REPEATS,
 * and a two-pane browser with a lazily-built 2932-cell chart is the case that file tells you to
 * write by hand.
 */

/** The range list's width. Wide enough for "Standard accidentals (12-EDO)" to survive one ellipsis. */
const LIST_WIDTH = 186
/** The information column's width. Two or three words of a description per line, a chip per row. */
const DETAIL_WIDTH = 232
/**
 * How long the field waits before filtering. The scan itself is trivial (2932 glyphs, two string
 * compares each); what it pays for is the REBUILD behind it, and rebuilding on every keystroke of
 * "notehead" is eight charts nobody looked at.
 */
const TYPING_PAUSE_MS = 120

/**
 * Let the search field own Escape — but only while there is something to undo.
 *
 * The window layer claims Escape on `document` in the CAPTURE phase, deliberately, so that it can
 * take the key rather than race the score's own handler for it (WindowLayer.onKeyDown). A listener
 * on the field therefore CANNOT stop it: capture runs before every bubble handler, whoever
 * registered first. `data-owns-keys` is the one way in — the layer looks for it on the event's
 * target and stands down.
 *
 * So the attribute has to come and go with the field's content: present while typing, so Escape
 * clears the search; absent once the field is empty, so the same key closes the window. And it must
 * be REMOVED, not set to `''` — `closest('[data-owns-keys]')` matches an empty attribute just as
 * happily, and the window would never close again.
 */
function claimEscape(field: HTMLInputElement): void {
  if (field.value === '') delete field.dataset.ownsKeys
  else field.dataset.ownsKeys = 'true'
}

export class SymbolsWidget implements Widget {
  private destroyed = false
  private grid: GlyphGrid | null = null
  private list: HTMLElement | null = null
  private count: HTMLElement | null = null
  private empty: HTMLElement | null = null
  /** The whole chart, kept so a filter is always computed from it and never from a filtered copy. */
  private all: RangeBlock[] = []
  private total = 0
  private smufl: Smufl | null = null
  private readonly chips = new CopyChips()
  private specimen: HTMLElement | null = null
  private detail: HTMLElement | null = null
  private column: HTMLElement | null = null
  private infoVisible = true
  /** Range id → its row in the left list, so the active row can be lit as the chart scrolls. */
  private readonly rows = new Map<string, HTMLElement>()
  private activeRow: HTMLElement | null = null
  private typingTimer: ReturnType<typeof setTimeout> | null = null

  mount(host: HTMLElement): void {
    // `.window-content` is ALREADY a flex column (see WindowLayer's CSS) — stated here so the next
    // reader does not have to discover it the way the first cut did, with the panes stacked.
    // ROW: the information column runs the window's full height on the right, so the split at the
    // top level is left-area | information, and the search belongs INSIDE the left area.
    host.style.display = 'flex'
    host.style.flexDirection = 'row'
    host.style.minHeight = '0'
    // The content box scrolls by default; here the two PANES scroll, independently, and an outer
    // scrollbar around them would be a second way to move the same content.
    host.style.overflow = 'hidden'
    // …and its 14/16px padding belongs to a dialog, not to a chart: the list's divider should meet
    // the frame, and the chart should use the full width it is given.
    host.style.padding = '0'
    host.style.font = '13px system-ui, sans-serif'
    host.style.color = CHROME.ink

    const status = document.createElement('div')
    status.textContent = 'Loading the SMuFL chart…'
    status.style.padding = '16px'
    status.style.color = CHROME.inkMuted
    host.appendChild(status)

    loadSmufl().then(
      smufl => {
        // The window can be closed while 400 KB is in flight; then this host is already detached
        // and building into it would be building into nothing.
        if (this.destroyed) return
        status.remove()
        this.smufl = smufl
        this.build(host, smufl.blocks)
      },
      (error: unknown) => {
        if (this.destroyed) return
        // Say what failed and stop. A chart that silently shows nothing reads as "the font has no
        // glyphs", which would send someone hunting in exactly the wrong place.
        status.textContent = `Could not load the SMuFL metadata: ${String(error)}`
      },
    )
  }

  destroy(): void {
    this.destroyed = true
    if (this.typingTimer !== null) clearTimeout(this.typingTimer)
    this.typingTimer = null
    this.grid?.destroy()
    this.chips.destroy()
    this.grid = null
    this.list = null
    this.specimen = null
    this.detail = null
    this.column = null
    this.count = null
    this.empty = null
    this.rows.clear()
    this.activeRow = null
  }

  private build(host: HTMLElement, blocks: RangeBlock[]): void {
    this.all = blocks
    this.total = blocks.reduce((n, block) => n + block.glyphs.length, 0)

    // The left area — search across the top, ranges and chart beneath it. It is a unit because the
    // search acts on what is under it and on nothing else; the information column is not filtered,
    // it is the current selection, so the search does not reach over it.
    const main = document.createElement('div')
    main.style.flex = '1'
    main.style.minWidth = '0'
    main.style.minHeight = '0'
    main.style.display = 'flex'
    main.style.flexDirection = 'column'
    main.appendChild(this.buildSearchStrip())

    const panes = document.createElement('div')
    panes.style.display = 'flex'
    panes.style.flex = '1'
    panes.style.minHeight = '0'

    const list = document.createElement('nav')
    // Positioned for the same reason the chart's scroller is: a row's `offsetTop` must be its
    // distance down THIS list.
    list.style.position = 'relative'
    list.style.flex = 'none'
    list.style.width = `${LIST_WIDTH}px`
    list.style.minHeight = '0'
    list.style.overflowY = 'auto'
    list.style.padding = '8px 4px'
    list.style.borderRight = `1px solid ${CHROME.edge}`

    for (const block of blocks) {
      const row = document.createElement('div')
      row.textContent = block.title
      row.title = `${block.title}  ${block.span}`
      row.style.padding = '4px 8px'
      row.style.borderRadius = '4px'
      row.style.cursor = 'pointer'
      row.style.whiteSpace = 'nowrap'
      row.style.overflow = 'hidden'
      row.style.textOverflow = 'ellipsis'
      row.addEventListener('click', () => this.grid?.scrollToBlock(block.id))
      list.appendChild(row)
      this.rows.set(block.id, row)
    }

    const right = document.createElement('div')
    right.style.flex = '1'
    right.style.minWidth = '0'
    right.style.minHeight = '0'
    // A flex column, so the chart fills it with `flex: 1` instead of `height: 100%` — the rule
    // WindowLayer's own CSS states, for the same reason: a percentage height against a parent that
    // is itself being measured resolves to auto.
    right.style.display = 'flex'
    right.style.flexDirection = 'column'

    // Said in words, not left as an empty pane: an editor that shows nothing is read as broken long
    // before it is read as "no matches".
    const empty = document.createElement('p')
    empty.style.display = 'none'
    empty.style.margin = '0'
    empty.style.padding = '16px'
    empty.style.color = CHROME.inkMuted
    right.appendChild(empty)
    this.empty = empty

    panes.appendChild(list)
    panes.appendChild(right)
    main.appendChild(panes)
    host.appendChild(main)
    host.appendChild(this.buildDetailColumn())
    this.list = list

    this.grid = new GlyphGrid(blocks, {
      onActiveBlock: id => this.markActive(id),
      onSelect: name => this.showDetail(name),
    })
    this.grid.mount(right)
    this.markActive(blocks[0]?.id ?? '')
    this.report('', this.total)
    this.showDetail('')
  }

  /**
   * Put the information column away, and bring it back.
   *
   * Two uses of this window want different things: looking a glyph UP wants the facts, and just
   * BROWSING wants the widest possible wall of glyphs. Hiding is display, not teardown — the
   * column keeps its selection and its chips, so bringing it back shows what it showed before, and
   * the chart simply reflows (the grid re-reserves its blocks on any width change).
   *
   * It says what it will DO — "Hide info" / "Show info" — rather than being an icon that has to be
   * learnt, and it sits at the end of the search strip: the strip is where the controls are.
   */
  private buildInfoToggle(): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.style.flex = 'none'
    button.style.padding = '3px 8px'
    button.style.borderRadius = '4px'
    button.style.border = `1px solid ${CHROME.edge}`
    button.style.background = 'transparent'
    button.style.color = CHROME.inkMuted
    button.style.cursor = 'pointer'
    button.style.font = 'inherit'
    button.style.fontSize = '12px'

    const paint = (): void => {
      button.textContent = this.infoVisible ? 'Hide info' : 'Show info'
      button.title = this.infoVisible
        ? 'Hide the information column and give the chart its width'
        : 'Show the information column'
    }
    button.addEventListener('click', () => {
      this.infoVisible = !this.infoVisible
      if (this.column) this.column.style.display = this.infoVisible ? '' : 'none'
      paint()
    })
    paint()
    return button
  }

  /**
   * The information column, full height on the right: everything the chart refuses to draw in a
   * cell — the specimen, the names, the facts, the copy chips.
   *
   * Full height, and OUTSIDE the search strip, because it does not belong to the search: the chart
   * is what a query narrows, while this column is the one glyph you picked. Their edges say so.
   */
  private buildDetailColumn(): HTMLElement {
    const column = document.createElement('aside')
    column.style.flex = 'none'
    column.style.width = `${DETAIL_WIDTH}px`
    column.style.minHeight = '0'
    // Its own scroll: a glyph in eight classes runs long, and pushing the chips out of sight would
    // hide the one control in this window.
    column.style.overflowY = 'auto'
    column.style.display = 'flex'
    column.style.flexDirection = 'column'
    column.style.gap = '10px'
    column.style.padding = '12px 10px'
    column.style.borderLeft = `1px solid ${CHROME.edge}`

    const specimen = document.createElement('div')
    specimen.style.flex = 'none'
    specimen.style.display = 'flex'
    specimen.style.justifyContent = 'center'
    // Room for a glyph drawn at 34px that reaches well past its em square — a bracket, a long
    // octave line — without it colliding with the name underneath.
    specimen.style.minHeight = '56px'

    const detail = document.createElement('div')
    detail.style.display = 'flex'
    detail.style.flexDirection = 'column'
    detail.style.gap = '4px'

    const chips = document.createElement('div')
    this.chips.mount(chips)

    column.appendChild(specimen)
    column.appendChild(detail)
    column.appendChild(chips)

    this.specimen = specimen
    this.detail = detail
    this.column = column
    return column
  }

  /** Fill the bar for a glyph — or, given no glyph, say what to do to fill it. */
  private showDetail(name: string): void {
    const glyph = name === '' ? undefined : this.smufl?.byName.get(name)
    const detail = this.detail
    if (!detail || !this.specimen) return

    this.specimen.innerHTML = glyph ? glyphSvgMarkup(glyph.char, { box: 56, size: 34 }) : ''
    detail.replaceChildren()
    this.chips.setGlyph(glyph ?? null)

    if (!glyph) {
      detail.appendChild(this.line('Click a glyph for its name, its codepoint and the strings to copy.', CHROME.inkMuted))
      return
    }

    const title = this.line(glyph.name, CHROME.ink)
    title.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace'
    title.style.fontWeight = '600'
    detail.appendChild(title)
    if (glyph.description) detail.appendChild(this.line(glyph.description, CHROME.ink))

    // One line of provenance: the codepoint, WHERE it is printed (its range), and WHAT it is (its
    // classes). Range and classes are different questions and both are answered — a glyph is in one
    // range and in any number of classes.
    const range = this.smufl?.rangeOf.get(glyph.name)
    const classes = this.smufl?.classesOf.get(glyph.name) ?? []
    const facts: string[] = [glyph.codepoint]
    if (range) facts.push(`${range.title} · ${range.span}`)
    if (classes.length > 0) facts.push(`Classes: ${classes.join(', ')}`)
    // NOT a stylistic variant: SMuFL's `alternateCodepoint` is the same sign's home in the standard
    // Unicode musical-symbols block — ♭ is U+266D as well as U+E260 — which is the one form that
    // survives outside a music font.
    if (glyph.alternateCodepoint) facts.push(`Unicode: ${glyph.alternateCodepoint}`)
    // A line each, not one run joined by dots: in a column the dots would fall wherever the wrap
    // put them, and the eye could no longer tell which fact it was reading.
    for (const fact of facts) detail.appendChild(this.line(fact, CHROME.inkMuted))
  }

  /** A line of the detail column. It WRAPS — in a 240px column an ellipsis would eat the end of
   *  `accSagittal11v19LargeDiesisDown`, and the end is where those names differ. */
  private line(text: string, color: string): HTMLElement {
    const el = document.createElement('div')
    el.textContent = text
    el.style.color = color
    el.style.fontSize = '12px'
    el.style.lineHeight = '1.45'
    el.style.overflowWrap = 'anywhere'
    return el
  }

  /**
   * The search, across the top of the left area — over the ranges and the chart, and stopping at
   * the information column, because those two are exactly what it narrows.
   */
  private buildSearchStrip(): HTMLElement {
    const strip = document.createElement('div')
    strip.style.display = 'flex'
    strip.style.alignItems = 'center'
    strip.style.gap = '10px'
    strip.style.flex = 'none'
    strip.style.padding = '8px 10px'
    strip.style.borderBottom = `1px solid ${CHROME.edge}`

    const field = document.createElement('input')
    field.type = 'search'
    // The placeholder teaches the second search: nothing else in the window says a codepoint is
    // accepted here, and a developer who does not know will type the name they do not have.
    field.placeholder = 'Search a name, a description, or a codepoint (E0A4)'
    field.style.flex = '1'
    field.style.minWidth = '0'
    field.style.padding = '4px 8px'
    field.style.borderRadius = '4px'
    field.style.border = `1px solid ${CHROME.edge}`
    field.style.background = CHROME.field
    field.style.color = CHROME.ink
    field.style.font = 'inherit'
    field.addEventListener('input', () => {
      claimEscape(field)
      this.scheduleFilter(field.value)
    })
    field.addEventListener('keydown', event => this.onFieldKeyDown(event, field))

    const count = document.createElement('span')
    count.style.flex = 'none'
    count.style.fontSize = '12px'
    count.style.color = CHROME.inkMuted

    strip.appendChild(field)
    strip.appendChild(count)
    strip.appendChild(this.buildInfoToggle())
    this.count = count
    // NOT focused on open. The window is a reference you leave up while you work, and a focused
    // field would swallow every note-entry key the moment it appeared.
    return strip
  }

  /**
   * Escape belongs to the field first, and only then to the window.
   *
   * With text in it, Escape UNDOES THE TYPING — the search is what you want out of the way, and
   * having to reopen a 2932-glyph chart because you wanted to unfilter it is a small cruelty. Empty
   * (or with the cursor anywhere else) the key falls through to the window's `onCancel` and closes.
   *
   * ⚠️ Stopping the event HERE is not what makes that work — see {@link claimEscape}. By the time
   * this runs the window has already had its say.
   */
  private onFieldKeyDown(event: KeyboardEvent, field: HTMLInputElement): void {
    if (event.key !== 'Escape' || field.value === '') return
    event.stopPropagation()
    field.value = ''
    claimEscape(field)
    this.applyFilter('')
  }

  private scheduleFilter(query: string): void {
    if (this.typingTimer !== null) clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => {
      this.typingTimer = null
      this.applyFilter(query)
    }, TYPING_PAUSE_MS)
  }

  private applyFilter(query: string): void {
    // Whatever the field was about to filter by, it is not what we are filtering by now: Escape
    // clears mid-word, and a timer left running would put the abandoned query back 120ms later.
    if (this.typingTimer !== null) clearTimeout(this.typingTimer)
    this.typingTimer = null

    const { blocks, matched } = filterBlocks(this.all, query)
    this.grid?.setBlocks(blocks)
    this.report(query, matched)

    // The list keeps every range, in place — a list that reordered or dropped rows under each
    // keystroke would be unusable as the map it is. Ranges with nothing in them go quiet instead.
    const present = new Set(blocks.map(block => block.id))
    for (const [id, row] of this.rows) {
      const has = present.has(id)
      row.style.opacity = has ? '' : '0.3'
      row.style.pointerEvents = has ? '' : 'none'
    }

    if (this.empty) {
      this.empty.style.display = matched === 0 ? '' : 'none'
      this.empty.textContent = `No glyph matches “${query.trim()}”.`
    }
  }

  /** The count beside the field: a filtered chart must never read as the whole set. */
  private report(query: string, matched: number): void {
    if (!this.count) return
    this.count.textContent =
      query.trim() === ''
        ? `${this.total} glyphs`
        : `showing ${matched} of ${this.total}`
  }

  private markActive(id: string): void {
    const row = this.rows.get(id)
    if (row === this.activeRow) return
    if (this.activeRow) {
      this.activeRow.style.background = ''
      this.activeRow.style.color = ''
    }
    this.activeRow = row ?? null
    if (!row) return
    row.style.background = CHROME.accent
    row.style.color = '#fff'
    this.revealInList(row)
  }

  /**
   * Follow the chart: the marked range must not scroll out of the list while the chart moves.
   *
   * By hand, and NOT `scrollIntoView({ block: 'nearest' })`, which walks every scrollable ancestor
   * — including the window layer's host, which is `overflow: hidden` but still scrollable in code.
   * A range list quietly nudging the SCORE sideways is the kind of fault nobody attributes to the
   * right window.
   */
  private revealInList(row: HTMLElement): void {
    const list = this.list
    if (!list) return
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
    }
  }
}
