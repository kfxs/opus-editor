import { Container, type Widget } from './Widget'

/**
 * The three containers. Between them they lay out anything a window has needed so far, and they are
 * deliberately the whole layout vocabulary — see the warning in Widget.ts.
 *
 * All three fill the box they are handed and let their children fill the cells they are handed. No
 * widget in the tree ever measures itself, so a window resized to its floor still works.
 */

export interface StackOptions {
  /** Space between children, in px. */
  gap?: number
  /** Which child, if any, soaks up the leftover space. Default: none — children take what they need. */
  grow?: number
}

/** Children stacked top to bottom. */
export class Column extends Container {
  constructor(
    children: Widget[],
    private readonly opts: StackOptions = {},
  ) {
    super(children)
  }

  mount(host: HTMLElement): void {
    host.style.overflow = 'hidden'
    const el = flexBox('column', this.opts.gap)
    mountChildren(el, this.children, this.opts.grow)
    host.appendChild(el)
  }
}

/** Children laid left to right. */
export class Row extends Container {
  constructor(
    children: Widget[],
    private readonly opts: StackOptions & { align?: 'start' | 'center' | 'end' } = {},
  ) {
    super(children)
  }

  mount(host: HTMLElement): void {
    const el = flexBox('row', this.opts.gap)
    el.style.alignItems = 'center'
    if (this.opts.align) {
      el.style.justifyContent = { start: 'flex-start', center: 'center', end: 'flex-end' }[
        this.opts.align
      ]
    }
    el.style.flex = 'none' // a row is as tall as its contents; it never soaks up slack
    mountChildren(el, this.children, this.opts.grow)
    host.appendChild(el)
  }
}

/** Children side by side in equal columns, each cell independent — one can scroll while the other doesn't. */
export class Columns extends Container {
  constructor(
    children: Widget[],
    private readonly opts: { gap?: number; divider?: boolean } = {},
  ) {
    super(children)
  }

  mount(host: HTMLElement): void {
    // The host must NOT scroll: the cells are what scroll (if their widget wants to).
    host.style.overflow = 'hidden'

    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = `repeat(${this.children.length}, 1fr)`
    grid.style.columnGap = `${this.opts.gap ?? 16}px`
    grid.style.flex = '1' // fills a definite box; sizes to content in one being measured for fitContent
    grid.style.minHeight = '0' // or a grid row refuses to shrink below its content, killing the scroll

    this.children.forEach((child, i) => {
      const cell = document.createElement('div')
      cell.style.display = 'flex'
      cell.style.flexDirection = 'column'
      cell.style.minHeight = '0'
      cell.style.minWidth = '0'
      if (i > 0 && this.opts.divider !== false) {
        cell.style.borderLeft = '1px solid #4b5563'
        cell.style.paddingLeft = `${this.opts.gap ?? 16}px`
      }
      child.mount(cell)
      grid.appendChild(cell)
    })

    host.appendChild(grid)
  }
}

function flexBox(direction: 'row' | 'column', gap?: number): HTMLElement {
  const el = document.createElement('div')
  el.style.display = 'flex'
  el.style.flexDirection = direction
  el.style.gap = `${gap ?? 10}px`
  // `flex: 1`, not `height: 100%`: it fills a definite box, and sizes to its content in a window
  // being measured for `fitContent` — where a percentage height would collapse to auto.
  el.style.flex = '1'
  el.style.minHeight = '0'
  return el
}

/** `grow` marks the one child that absorbs slack; the rest keep their natural size. */
function mountChildren(el: HTMLElement, children: Widget[], grow?: number): void {
  children.forEach((child, i) => {
    const slot = document.createElement('div')
    slot.style.minHeight = '0'
    slot.style.minWidth = '0'
    slot.style.display = 'flex'
    slot.style.flexDirection = 'column'
    slot.style.flex = i === grow ? '1' : 'none'
    child.mount(slot)
    el.appendChild(slot)
  })
}
