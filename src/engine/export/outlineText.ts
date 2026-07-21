import type { Font } from 'opentype.js'
import { loadAllExportFonts, fontKey } from './exportFonts'
import { dbg } from '@/utils/debug'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Turn the music glyphs of an export SVG into **outlines** — the step that makes a PDF possible
 * at all, and the reason the export is vector rather than a picture of a score.
 *
 * ## Why outline instead of embedding the font
 *
 * See exportFonts.ts: the shipped faces are woff2, no PDF writer embeds woff2, and jsPDF cannot
 * embed OTF/CFF outlines as text even given the file. Outlining sidesteps the whole question —
 * the PDF ends up with no font dependency whatsoever, which is also the one thing you can be sure
 * survives every viewer and every printer. The cost is that a notehead is no longer searchable
 * text, which for a notehead is not a cost.
 *
 * ## Where the positions come from
 *
 * From the browser, not from us. `getStartPositionOfChar(i)` gives the exact baseline point of
 * every rendered character — after text-anchor, after tspan flow, after kerning. We ask it where
 * each character landed and put that character's outline exactly there, so the PDF is the picture
 * the screen already agreed on rather than a re-derivation of it that can drift. This is also why
 * the SVG must still be attached and laid out when this runs.
 *
 * ## What stays text
 *
 * Runs set in a stack we have no file for — the dynamics' `Georgia, "Times New Roman", …` words —
 * keep their characters as a `<text>` node, re-anchored to their measured position and re-labelled
 * with a standard PDF face. They go into the PDF as real, selectable text. Only what we can
 * outline faithfully gets outlined.
 */
export async function outlineSvgText(svg: SVGSVGElement): Promise<void> {
  const fonts = await loadAllExportFonts()
  // Snapshot first: the walk replaces nodes as it goes.
  for (const text of Array.from(svg.querySelectorAll('text'))) {
    outlineOneText(text as SVGTextElement, fonts)
  }
}

/** One character's rendered facts: where it landed, and how it was set. */
interface CharPlacement {
  char: string
  x: number
  y: number
  style: RunStyle
}

interface RunStyle {
  families: string[]
  sizePx: number
  fill: string
  italic: boolean
  bold: boolean
}

function outlineOneText(text: SVGTextElement, fonts: Map<string, Font>): void {
  if (typeof text.getNumberOfChars !== 'function') return // jsdom: nothing was ever laid out

  const chars = collectChars(text)
  if (!chars) return

  const parent = text.parentNode
  if (!parent) return

  const group = document.createElementNS(SVG_NS, 'g')
  // A transform on the <text> establishes the user space the measured positions are expressed in,
  // so the replacement has to stand in the same space.
  const transform = text.getAttribute('transform')
  if (transform) group.setAttribute('transform', transform)

  // Consecutive characters we cannot outline become ONE <text> again — a word stays a word.
  let pendingText: CharPlacement[] = []
  const flushText = () => {
    if (pendingText.length === 0) return
    group.appendChild(buildTextNode(pendingText))
    pendingText = []
  }

  for (const placement of chars) {
    // Whitespace draws nothing, so it takes whatever mode the run is already in: inside a kept
    // run it must stay (or "p sub." would come out "psub."), and on its own it is dropped rather
    // than becoming a `<text>` node containing one invisible space. (The engraving is full of
    // lone non-breaking spaces — a tempo mark's word/glyph joins are made of them.)
    if (isWhitespace(placement.char)) {
      if (pendingText.length > 0) pendingText.push(placement)
      continue
    }

    const font = pickFont(placement.style, placement.char, fonts)
    if (!font) {
      pendingText.push(placement)
      continue
    }
    flushText()
    const path = font.getPath(placement.char, placement.x, placement.y, placement.style.sizePx)
    const d = path.toPathData(3)
    if (!d) continue // a space, or any character with no outline
    const node = document.createElementNS(SVG_NS, 'path')
    node.setAttribute('d', d)
    node.setAttribute('fill', placement.style.fill)
    node.setAttribute('stroke', 'none')
    group.appendChild(node)
  }
  flushText()

  parent.replaceChild(group, text)
}

/**
 * Every rendered character of one `<text>`, with its measured baseline point and the style of the
 * `<tspan>` (or the `<text>` itself) it belongs to.
 *
 * Returns null when the DOM's character count and the browser's disagree — which means whitespace
 * collapsing has shifted the indices, and any position we read would belong to a different
 * character than we think. That text is then left exactly as it is: a run drawn slightly less
 * faithfully beats a run drawn in the wrong place.
 */
function collectChars(text: SVGTextElement): CharPlacement[] | null {
  const owners: Element[] = []
  let content = ''
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = node.nodeValue ?? ''
    const owner = (node.parentElement ?? text) as Element
    for (let i = 0; i < data.length; i++) owners.push(owner)
    content += data
  }

  if (content.length === 0) return null
  if (text.getNumberOfChars() !== content.length) {
    dbg('export', 'text left as-is (whitespace collapsed):', JSON.stringify(content))
    return null
  }

  const styles = new Map<Element, RunStyle>()
  const placements: CharPlacement[] = []
  for (let i = 0; i < content.length; i++) {
    // SMuFL lives in the BMP, but a surrogate pair must still travel as one character.
    const code = content.charCodeAt(i)
    const isSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < content.length
    const char = isSurrogate ? content.slice(i, i + 2) : content[i]

    const owner = owners[i]
    let style = styles.get(owner)
    if (!style) {
      style = readStyle(owner)
      styles.set(owner, style)
    }

    let point: { x: number; y: number }
    try {
      point = text.getStartPositionOfChar(i)
    } catch {
      return null // the browser refuses to place it; leave the whole run alone
    }
    placements.push({ char, x: point.x, y: point.y, style })
    if (isSurrogate) i++
  }
  return placements
}

function readStyle(element: Element): RunStyle {
  const computed = getComputedStyle(element)
  return {
    families: computed.fontFamily.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '')),
    sizePx: parseFloat(computed.fontSize) || 0,
    fill: computed.fill || '#000000',
    italic: computed.fontStyle === 'italic' || computed.fontStyle.startsWith('oblique'),
    bold: parseInt(computed.fontWeight, 10) >= 600 || computed.fontWeight === 'bold',
  }
}

/**
 * The font that actually drew this character — resolved the way the browser resolves it: walk the
 * CSS stack in order and take the first family that HAS the character, **at the run's weight**. A
 * stack of `Bravura, Academico` therefore outlines a notehead from Bravura and a word from
 * Academico, exactly as rendered; a bold tempo word comes from Academico's real bold face, because
 * that is the face the browser used (VexFlow registers it as one). A family we have no file for
 * normally stops the walk (→ null, "keep it as text"), because from there on the browser's choice
 * is not ours to reproduce.
 *
 * ⭐ With ONE exception, and it is the one that matters: a **SMuFL codepoint**. Dynamics are set in
 * a stack that leads with words (`Georgia, "Times New Roman", Times, serif, Bravura` —
 * dynamicStyle.ts), and no text font on earth carries U+E000–U+F8FF, so for those characters the
 * browser is certainly falling through to the music font at the end. Stopping at Georgia would
 * hand a music glyph to a text face and print rubbish.
 */
function pickFont(style: RunStyle, char: string, fonts: Map<string, Font>): Font | null {
  const musical = isPrivateUse(char)
  for (const family of style.families) {
    // A family with no bold file of its own falls back to its regular face — the same one the
    // browser would synthesise from, and closer than dropping the whole run to a text face.
    const font = fonts.get(fontKey(family, style.bold)) ?? fonts.get(fontKey(family, false))
    if (!font) {
      if (musical) continue // a text face cannot be drawing this — keep looking for the music font
      return null
    }
    if (font.charToGlyphIndex(char) > 0) return font
  }
  return null
}

/** The Unicode private use area, where every SMuFL glyph lives. */
function isPrivateUse(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code >= 0xe000 && code <= 0xf8ff
}

function isWhitespace(char: string): boolean {
  return /^[\s ]$/.test(char)
}

/**
 * Rebuild a non-outlinable run as a `<text>` standing on its own measured position: the run starts
 * where the browser started it, anchored `start`, so `text-anchor` and tspan flow are already
 * baked into that one number and nothing downstream has to reproduce them.
 *
 * The run keeps ONE x/y and the whole string — per-character positioning would be more faithful,
 * but the PDF writer lays a string out with the PDF font's own metrics either way, and a word that
 * stays a word stays selectable text in the file. What can differ is the letter spacing inside a
 * short word ("cresc.", "sub."); where it sits cannot.
 *
 * The family is collapsed to a standard PDF face, the one thing a PDF can always draw: the words
 * this path handles are set in a serif system stack (`Georgia, "Times New Roman", Times, serif`),
 * and Times is what that stack asks for on a machine without Georgia.
 */
function buildTextNode(placements: CharPlacement[]): SVGTextElement {
  const first = placements[0]
  const node = document.createElementNS(SVG_NS, 'text')
  node.setAttribute('x', String(first.x))
  node.setAttribute('y', String(first.y))
  node.setAttribute('text-anchor', 'start')
  node.setAttribute('font-family', pdfBaseFont(first.style.families))
  node.setAttribute('font-size', `${first.style.sizePx}px`)
  node.setAttribute('font-style', first.style.italic ? 'italic' : 'normal')
  node.setAttribute('font-weight', first.style.bold ? 'bold' : 'normal')
  node.setAttribute('fill', first.style.fill)
  // ⚠️ Every one of these is stated, never left to inherit. VexFlow's `openGroup` stamps the
  // context's current attributes onto the `<g>` it opens, so an annotation's group carries a black
  // 1px STROKE — which the original `<text>` cancelled with its own `stroke="none"` and this
  // replacement, if it says nothing, inherits. Stroked text is text drawn twice: the expression
  // words came out of the PDF looking bold. Same reasoning for weight and style: state them.
  node.setAttribute('stroke', 'none')
  node.setAttribute('xml:space', 'preserve')
  node.textContent = placements.map(p => p.char).join('')
  return node
}

const SERIF_HINTS = ['serif', 'georgia', 'times', 'garamond', 'academico']

function pdfBaseFont(families: string[]): string {
  const stack = families.join(' ').toLowerCase()
  if (families.some(f => f.toLowerCase() === 'monospace')) return 'courier'
  return SERIF_HINTS.some(hint => stack.includes(hint)) ? 'times' : 'helvetica'
}
