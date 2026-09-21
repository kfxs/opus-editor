/**
 * ⭐⭐ **THE SVG PAINTER — ours** (S13b of `docs/history/vexflow-removal-map.md`, P1e of
 * `docs/plans/own-engraving-engine.md`).
 *
 * VexFlow's `SVGContext` (`svgcontext.js`) and the `Renderer` that made it, transcribed as far as this
 * editor calls them. It is the implementation {@link DrawContext} was declared for: every pass that
 * draws already speaks that interface, so this is what stands behind it on the page.
 *
 * ## ⚠️ Transcribed EXACTLY — the SVG text is the contract
 *
 * - **An attribute is written only where it DIFFERS from the enclosing group's** (`applyAttributes`
 *   against `groupAttributes`), and only when truthy — so a `0` stroke width or an empty dash is never
 *   written, and a group re-states only what changed since its parent.
 * - **Key ORDER is attribute order in the markup**: the default attributes are built in VexFlow's order
 *   (`stroke-width`, `stroke-dasharray`, `fill`, `stroke`, `shadowBlur`, `shadowColor`, then the font).
 *   ⚠️ That is why the root `<svg>` carries `shadowColor="black"` — kept.
 * - Every coordinate is rounded to **3 places** (`Tables.RENDER_PRECISION_PLACES`).
 * - `save`/`restore` deep-copy `state` and `attributes` with `structuredClone`, and `restore` REPLACES
 *   both objects — ⚠️ `markPreviewPass` and the renderer rewind a pass by assigning these two fields,
 *   which is why they are public here.
 * - A path's attributes ignore the font and the box fields; a rect's ignore the font; a text's the box.
 *
 * ⛔ Not transcribed — nothing here calls them: `arc`, `quadraticCurveTo`, `openRotation`,
 * `setLineCap`, `setShadowColor`/`setShadowBlur` (the shadow ATTRIBUTES are kept: `fill`/`stroke` read
 * them), `clearRect`, `measureText`, and the canvas backend.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { rootFontFamily } from '@/engine/fonts/fontCategories'
import { fontToCss, validateFont, type FontInfo } from '@/engine/fonts/fontFace'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** `Tables.RENDER_PRECISION_PLACES` = 3. */
const PRECISION = Math.pow(10, 3)

/** The attributes each element kind never takes — `ATTRIBUTES_TO_IGNORE`. */
const ATTRIBUTES_TO_IGNORE: Record<string, Record<string, true>> = {
  path: {
    x: true, y: true, width: true, height: true,
    'font-family': true, 'font-weight': true, 'font-style': true, 'font-size': true,
  },
  rect: { 'font-family': true, 'font-weight': true, 'font-style': true, 'font-size': true },
  text: { width: true, height: true },
}

type Attributes = Record<string, string | number | undefined>

/** `Font.fromCSSString`: a CSS shorthand parsed by the page, as VexFlow did it (one reused `<span>`). */
let fontParser: HTMLSpanElement | undefined
function fontFromCss(css: string): Required<Pick<FontInfo, 'family' | 'size' | 'weight' | 'style'>> {
  fontParser ??= document.createElement('span')
  fontParser.style.font = css
  const { fontFamily, fontSize, fontWeight, fontStyle } = fontParser.style
  return { family: fontFamily, size: fontSize, weight: fontWeight, style: fontStyle }
}

export class SvgPainter implements DrawContext {
  /** The page's root `<svg>` — what the read-backs and the ghosts query. */
  readonly svg: SVGSVGElement
  width = 0
  height = 0
  fontCSSString = ''
  /** The scale and the font — `SVGContext.state`. ⚠️ Public: a pass rewinds it by assignment. */
  state: Attributes & { scaleX: number; scaleY: number }
  /** The ink the next element takes — `SVGContext.attributes`. ⚠️ Public: a pass rewinds it by assignment. */
  attributes: Attributes
  private parent: SVGElement
  private readonly groups: SVGElement[]
  private readonly groupAttributes: Attributes[] = []
  private readonly stateStack: { state: SvgPainter['state']; attributes: Attributes }[] = []
  private path = ''
  private readonly pen = { x: NaN, y: NaN }

  /** `new Renderer(element, SVG).getContext()`: a fresh `<svg>` appended to `element`. */
  constructor(private readonly element: HTMLElement) {
    const svg = this.create('svg') as SVGSVGElement
    svg.setAttribute('pointer-events', 'none')
    this.element.appendChild(svg)
    this.svg = svg
    this.parent = this.svg
    this.groups = [this.svg]
    const defaultFontAttributes = {
      'font-family': rootFontFamily(),
      'font-size': '10pt',
      'font-weight': 'normal',
      'font-style': 'normal',
    }
    this.state = { scaleX: 1, scaleY: 1, ...defaultFontAttributes }
    this.attributes = {
      'stroke-width': 1.0, 'stroke-dasharray': 'none', fill: 'black', stroke: 'black', shadowBlur: 0, shadowColor: 'black',
      ...defaultFontAttributes,
    }
    this.applyAttributes(svg, this.attributes)
    this.groupAttributes.push({ ...this.attributes })
  }

  private round(n: number): number {
    return Math.round(n * PRECISION) / PRECISION
  }

  private create(kind: string): SVGElement {
    return document.createElementNS(SVG_NS, kind) as SVGElement
  }

  // ── Groups ──

  openGroup(cls?: string, id?: string): SVGGElement {
    const group = this.create('g') as SVGGElement
    this.groups.push(group)
    this.parent.appendChild(group)
    this.parent = group
    // ⭐ S15c: the BARE class and id — VexFlow's `vf-` prefix (its namespace inside a host page) is gone.
    if (cls) group.setAttribute('class', cls)
    if (id) group.setAttribute('id', id)
    this.applyAttributes(group, this.attributes)
    this.groupAttributes.push({ ...this.groupAttributes[this.groupAttributes.length - 1], ...this.attributes })
    return group
  }

  closeGroup(): void {
    this.groups.pop()
    this.groupAttributes.pop()
    this.parent = this.groups[this.groups.length - 1]
  }

  private add(elem: SVGElement): void {
    this.parent.appendChild(elem)
  }

  // ── Style ──

  setFillStyle(style: string): this {
    this.attributes.fill = style
    return this
  }

  setStrokeStyle(style: string): this {
    this.attributes.stroke = style
    return this
  }

  setLineWidth(width: number): this {
    this.attributes['stroke-width'] = width
    return this
  }

  setLineDash(lineDash: number[]): this {
    if (Object.prototype.toString.call(lineDash) === '[object Array]') {
      this.attributes['stroke-dasharray'] = lineDash.join(',')
      return this
    }
    throw new Error('SvgPainter: lineDash must be an array of integers.')
  }

  // ── Size and scale ──

  /** `Renderer.resize` → `SVGContext.resize`: the element's and the svg's sizes, then the viewBox. */
  resize(width: number, height: number): this {
    this.width = width
    this.height = height
    this.element.style.width = width.toString()
    this.svg.style.width = width.toString()
    this.svg.style.height = height.toString()
    this.applyAttributes(this.svg, { width, height })
    this.scale(this.state.scaleX, this.state.scaleY)
    return this
  }

  scale(x: number, y: number): void {
    this.state.scaleX = this.state.scaleX ? this.state.scaleX * x : x
    this.state.scaleY = this.state.scaleY ? this.state.scaleY * y : y
    const visibleWidth = this.width / this.state.scaleX
    const visibleHeight = this.height / this.state.scaleY
    this.setViewBox(0, 0, visibleWidth, visibleHeight)
  }

  setViewBox(viewBoxOrMinX: string | number, minY?: number, width?: number, height?: number): void {
    if (typeof viewBoxOrMinX === 'string') this.svg.setAttribute('viewBox', viewBoxOrMinX)
    else this.svg.setAttribute('viewBox', viewBoxOrMinX + ' ' + minY + ' ' + width + ' ' + height)
  }

  /** ⚠️ Written only where truthy AND different from the enclosing group's — see the header. */
  private applyAttributes(element: SVGElement, attributes: Attributes): SVGElement {
    const ignore = ATTRIBUTES_TO_IGNORE[element.nodeName]
    for (const name in attributes) {
      if (ignore && ignore[name]) continue
      const value = attributes[name]
      if (value && (this.groupAttributes.length === 0 || value != this.groupAttributes[this.groupAttributes.length - 1][name])) {
        element.setAttributeNS(null, name, String(value))
      }
    }
    return element
  }

  clear(): void {
    while (this.svg.lastChild) this.svg.removeChild(this.svg.lastChild)
  }

  // ── Rectangles ──

  rect(x: number, y: number, width: number, height: number, attributes?: Attributes): this {
    if (height < 0) {
      y += height
      height *= -1
    }
    const rectangle = this.create('rect')
    attributes = attributes ?? { fill: 'none', 'stroke-width': this.attributes['stroke-width'], stroke: 'black' }
    x = this.round(x)
    y = this.round(y)
    width = this.round(width)
    height = this.round(height)
    this.applyAttributes(rectangle, { x, y, width, height, ...attributes })
    this.add(rectangle)
    return this
  }

  fillRect(x: number, y: number, width: number, height: number): this {
    return this.rect(x, y, width, height, { fill: this.attributes.fill, stroke: 'none' })
  }

  pointerRect(x: number, y: number, width: number, height: number): this {
    return this.rect(x, y, width, height, { opacity: '0', 'pointer-events': 'auto' })
  }

  // ── Paths ──

  beginPath(): this {
    this.path = ''
    this.pen.x = NaN
    this.pen.y = NaN
    return this
  }

  moveTo(x: number, y: number): this {
    x = this.round(x)
    y = this.round(y)
    this.path += 'M' + x + ' ' + y
    this.pen.x = x
    this.pen.y = y
    return this
  }

  lineTo(x: number, y: number): this {
    x = this.round(x)
    y = this.round(y)
    this.path += 'L' + x + ' ' + y
    this.pen.x = x
    this.pen.y = y
    return this
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
    x = this.round(x)
    y = this.round(y)
    x1 = this.round(x1)
    y1 = this.round(y1)
    x2 = this.round(x2)
    y2 = this.round(y2)
    this.path += 'C' + x1 + ' ' + y1 + ',' + x2 + ' ' + y2 + ',' + x + ' ' + y
    this.pen.x = x
    this.pen.y = y
    return this
  }

  closePath(): this {
    this.path += 'Z'
    return this
  }

  private getShadowStyle(): string {
    return `filter: drop-shadow(0 0 ${(this.attributes.shadowBlur as number) / 1.5}px ${this.attributes.shadowColor})`
  }

  fill(attributes?: Attributes): this {
    const path = this.create('path')
    if (typeof attributes === 'undefined') attributes = { ...this.attributes, stroke: 'none' }
    attributes.d = this.path
    if ((this.attributes.shadowBlur as number) > 0) attributes.style = this.getShadowStyle()
    this.applyAttributes(path, attributes)
    this.add(path)
    return this
  }

  stroke(): this {
    const path = this.create('path')
    const attributes: Attributes = { ...this.attributes, fill: 'none', d: this.path }
    if ((this.attributes.shadowBlur as number) > 0) attributes.style = this.getShadowStyle()
    this.applyAttributes(path, attributes)
    this.add(path)
    return this
  }

  // ── Text ──

  fillText(text: string, x: number, y: number): this {
    if (!text || text.length <= 0) return this
    x = this.round(x)
    y = this.round(y)
    const attributes: Attributes = { ...this.attributes, stroke: 'none', x, y }
    const txt = this.create('text')
    txt.textContent = text
    this.applyAttributes(txt, attributes)
    this.add(txt)
    return this
  }

  /** `SVGContext.setFont` → `Font.validate` (a bare CSS shorthand parsed by the page) → the font attributes. */
  setFont(f?: string | object, size?: string | number, weight?: string | number, style?: string): this {
    const fontInfo = typeof f === 'string' && size === undefined && weight === undefined && style === undefined
      ? fontFromCss(f)
      : validateFont(f as FontInfo | string | undefined, size, weight, style)
    this.fontCSSString = fontToCss(fontInfo)
    const fontAttributes = {
      'font-family': fontInfo.family,
      'font-size': fontInfo.size,
      'font-weight': fontInfo.weight,
      'font-style': fontInfo.style,
    }
    this.attributes = { ...this.attributes, ...fontAttributes }
    this.state = { ...this.state, ...fontAttributes }
    return this
  }

  getFont(): string {
    return this.fontCSSString
  }

  // ── The state stack ──

  save(): this {
    this.stateStack.push({ state: structuredClone(this.state), attributes: structuredClone(this.attributes) })
    return this
  }

  restore(): this {
    const saved = this.stateStack.pop()
    if (saved) {
      this.state = structuredClone(saved.state)
      this.attributes = structuredClone(saved.attributes)
    }
    return this
  }
}
