import { dbg } from '@/utils/debug'
import type { Widget } from '../content/Widget'
import { bus } from '@/bus'
import { voiceFillColor } from '../../utils/voiceColors'
import { INDICATOR_INK } from '../../utils/selectionColors'
import { CHROME } from '../../utils/chromeColors'
import { keypadPageSelection } from './keypadPageSelection'
import { keypadPage, VOICES, type GlyphSpec, type Icon, type KeypadCell } from './keypadLayouts'
import { pressKeypadCell } from './keypadPress'
import { bakeGlyphStack } from './tremoloBake'

/**
 * The Keypad, as a window's content.
 *
 * A widget and not a toolkit addition, on purpose (see the warning in content/Widget.ts): the
 * toolkit is Column/Row/Columns/Button, and a 4×5 grid of glyph keys with three merged cells is not
 * a new piece of layout vocabulary — it is one panel that happens to be shaped like a numeric
 * keypad. It builds its own DOM, fills the box it is handed, and reads nothing about where it is.
 *
 * What it DOES hold is which keys are lit, because that is what the panel is FOR: it is a picture of
 * the state you are about to write in — this duration, this accidental, these articulations. The
 * light is not decoration on a click, it is the state itself. What it is not, yet, is connected: the
 * score never hears about any of it, and every key logs and stops.
 */

/**
 * One key — and the ONE number that sizes the panel. Glyphs, icons, the voice row and the window's
 * own width are all arithmetic from here, so the Keypad is resized by editing this line and nothing
 * else. (The icons are drawn on a 40×26 canvas, which is what `ICON_SCALE` is measured against.)
 */
const CELL = 33
const GAP = 3
/** A glyph sits comfortably at a bit over half the key; an icon fills a bit more of it. */
const GLYPH = Math.round(CELL * 0.62)
const ICON_SCALE = CELL / 56
/**
 * The margin around the keys — TIGHTER than a window's usual 14/16px, and the widget overrides its
 * box to get it. A Keypad is a slab of keys, not a page with text on it: the frame belongs against
 * the keys, and a generous margin would just make the panel bigger without making it clearer.
 */
const PAD = 3

/**
 * The panel's exact width: four keys, three gaps, its own margin — and the FRAME's 1px border on
 * each side. The window's width is border-box, so leaving those 2px out steals them from the
 * content and the grid sits a pixel off-centre, which is exactly as visible as it sounds.
 */
export const KEYPAD_WIDTH = 4 * CELL + 3 * GAP + 2 * PAD + 2

const COLOR = {
  // The KEYS are solid — it is the panel's background that is glass. A key is a thing you aim at
  // and read a glyph off; make it see-through and the stave behind it fights the glyph. So the
  // score shows in the gaps and around the grid, and never through a key. The neutrals are the
  // shared chrome palette (utils/chromeColors) — a key is the same slate as a window's, on purpose.
  face: CHROME.surface,
  edge: CHROME.edge,
  hover: CHROME.edge, // a hover brightens face one step up the gray scale — which is the edge grey
  lit: CHROME.accent,
  // The select arrow's lit blue. It is NOT the chrome accent: it is the shared non-voice INDICATOR_INK
  // (selectionColors) — the same blue the gutter and every non-note element selection wear — deliberately
  // darker than voice-1's (#3B82F6) so it can never be misread as voice-coloured.
  mode: INDICATOR_INK,
  glyph: CHROME.ink,
}

/** Bravura first — these are glyphs, not text, so the music font MUST lead the stack. */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

export class KeypadWidget implements Widget {
  // Which voice button is lit (0-based; 4 = the local "All"), or null for NONE — the voice row can be
  // dark, exactly like the other keys, when nothing / more than one note is selected. Seeded from and
  // kept in step with the editor's active voice via {@link syncVoiceFromSeam}.
  private voice: number | null = null

  private readonly keys: { cell: KeypadCell; button: HTMLButtonElement }[] = []
  private readonly voiceButtons: HTMLButtonElement[] = []

  /** The grid element, held so a page turn can swap it out without touching the voice row. */
  private gridEl: HTMLElement | null = null

  /** The arrow, the duration keys and the accidental keys light from the EDITOR's stores, not the
   *  panel's own — so the panel listens to each and repaints when it changes elsewhere (the dev
   *  toolbar, a shortcut, selecting a note). */
  private unsubscribeMode: (() => void) | null = null
  private unsubscribeDuration: (() => void) | null = null
  private unsubscribeAccidental: (() => void) | null = null
  private unsubscribeArticulation: (() => void) | null = null
  private unsubscribeDot: (() => void) | null = null
  private unsubscribeTie: (() => void) | null = null
  private unsubscribeRest: (() => void) | null = null
  private unsubscribeVoice: (() => void) | null = null
  /** The page seam. The panel does not OWN which page is showing — it subscribes, exactly as it does
   *  for the duration or the voice, so a page turned from the numpad (with the panel open) re-lays
   *  this grid without the key press ever addressing the widget. */
  private unsubscribePage: (() => void) | null = null
  /** The page-2 beam cluster: mode set, subdivide, beam-rest. */
  private unsubscribeBeam: (() => void) | null = null
  private unsubscribeSubdivide: (() => void) | null = null
  /** The page-2 mark cluster: the tremolo count, the two-note pair, and the feathered beam. */
  private unsubscribeTremolo: (() => void) | null = null
  private unsubscribeTremoloPair: (() => void) | null = null
  private unsubscribeFan: (() => void) | null = null
  private unsubscribeBeamOver: (() => void) | null = null

  mount(host: HTMLElement): void {
    // A little more air under the title bar than around the rest: the bar is a solid band, and the
    // top row of keys butting straight into it reads as a mistake.
    host.style.padding = `${PAD + 4}px ${PAD}px ${PAD}px`
    // The panel NEVER scrolls. It is exactly as big as its keys, so a scrollbar here could only mean
    // a glyph has outgrown its key — and a scrollbar is a worse way to find that out than a clipped
    // glyph is. (The window box defaults to `overflow: auto`; a Keypad is not a document.)
    host.style.overflow = 'hidden'

    const root = document.createElement('div')
    root.style.display = 'flex'
    root.style.flexDirection = 'column'
    root.style.gap = `${GAP * 2}px`
    root.style.flex = 'none'

    this.gridEl = this.buildGrid()
    root.appendChild(this.gridEl)
    root.appendChild(this.buildVoices())
    host.appendChild(root)

    // Repaint whenever the tool mode / armed duration / armed accidental changes ANYWHERE — the
    // toolbar, a shortcut, clicking a note. These keys track the editor's state, not just their clicks.
    this.unsubscribeMode = bus.mode.onHighlight(() => this.paint())
    this.unsubscribeDuration = bus.duration.onHighlight(() => this.paint())
    this.unsubscribeAccidental = bus.accidental.onHighlight(() => this.paint())
    this.unsubscribeArticulation = bus.articulation.onHighlight(() => this.paint())
    this.unsubscribeDot = bus.dot.onHighlight(() => this.paint())
    this.unsubscribeTie = bus.tie.onHighlight(() => this.paint())
    this.unsubscribeRest = bus.rest.onHighlight(() => this.paint())
    // The voice row lights the EDITOR's active voice, changed from anywhere (Alt+1..4, the toolbar,
    // selecting a note in another voice). Seed it from the seam's current value — keypadSync primes
    // the highlight before this window opens, so onHighlight alone would miss the initial state.
    this.syncVoiceFromSeam()
    this.unsubscribeVoice = bus.voice.onHighlight(() => {
      this.syncVoiceFromSeam()
      this.paint()
    })

    // Re-lay the grid whenever the page changes — from this panel's own `+` cell or from the numpad's
    // `+`, which the app's shortcut wiring owns now (it must work with the panel shut, so it cannot
    // live here). Either way the seam changes and the panel follows.
    this.unsubscribePage = keypadPageSelection.subscribe(() => this.showPage())
    // Page 2's beam cluster tracks the editor like every other key — lit from the note under the
    // cursor / the armed mode, changed from anywhere (this pad, the numpad, the dev toolbar's Beam row).
    this.unsubscribeBeam = bus.beam.onHighlight(() => this.paint())
    this.unsubscribeSubdivide = bus.subdivide.onHighlight(() => this.paint())
    this.unsubscribeBeamOver = bus.beamOver.onHighlight(() => this.paint())
    // ⚠️ And page 2's MARK cluster, which had no subscription at all: pressing a tremolo (or a
    // feathered beam) on the selected note changes the SCORE and no other seam, so every other store
    // short-circuits on "no change" and the pad never repainted — the key you just pressed stayed
    // dark until something else happened to move. Each of these is engine-read; each needs its own.
    this.unsubscribeTremolo = bus.tremolo.onHighlight(() => this.paint())
    this.unsubscribeTremoloPair = bus.tremoloPair.onHighlight(() => this.paint())
    this.unsubscribeFan = bus.fan.onHighlight(() => this.paint())

    this.paint()
  }

  /** The seam subscriptions outlive this widget's DOM, so they must be released when it closes. */
  destroy(): void {
    this.unsubscribeMode?.()
    this.unsubscribeMode = null
    this.unsubscribeDuration?.()
    this.unsubscribeDuration = null
    this.unsubscribeAccidental?.()
    this.unsubscribeAccidental = null
    this.unsubscribeArticulation?.()
    this.unsubscribeArticulation = null
    this.unsubscribeDot?.()
    this.unsubscribeDot = null
    this.unsubscribeTie?.()
    this.unsubscribeTie = null
    this.unsubscribeRest?.()
    this.unsubscribeRest = null
    this.unsubscribeVoice?.()
    this.unsubscribeVoice = null
    this.unsubscribePage?.()
    this.unsubscribePage = null
    this.unsubscribeTremolo?.()
    this.unsubscribeTremolo = null
    this.unsubscribeTremoloPair?.()
    this.unsubscribeTremoloPair = null
    this.unsubscribeFan?.()
    this.unsubscribeFan = null
    this.unsubscribeBeam?.()
    this.unsubscribeBeam = null
    this.unsubscribeSubdivide?.()
    this.unsubscribeSubdivide = null
    this.unsubscribeBeamOver?.()
    this.unsubscribeBeamOver = null
  }

  /**
   * The numpad. Cells flow in reading order and the three merged keys are spanned by their KEY, not
   * by an index — `+` and `Enter` are tall, `0` is wide, on every numeric keypad ever made. The rest
   * of the grid then flows around them on its own.
   */
  private buildGrid(): HTMLElement {
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = `repeat(4, ${CELL}px)`
    grid.style.gridAutoRows = `${CELL}px`
    grid.style.gap = `${GAP}px`

    // A page turn rebuilds the grid, so the key list is rebuilt with it — clear last page's buttons.
    this.keys.length = 0
    for (const cell of keypadPage(keypadPageSelection.get()).cells) {
      const button = this.baseButton()
      // Just the name — the numpad key it mirrors is not (yet) a wired shortcut, so quoting it in the
      // tooltip only promised a keystroke that does nothing.
      button.title = cell.select === 'mode' ? 'Select' : cell.action
      button.appendChild(renderIcon(cell.icon))
      button.addEventListener('click', () => this.press(cell))

      if (cell.key === '+' || cell.key === 'Enter') button.style.gridRow = 'span 2'
      if (cell.key === '0') button.style.gridColumn = 'span 2'

      grid.appendChild(button)
      this.keys.push({ cell, button })
    }
    return grid
  }

  /**
   * Show the page the seam is on. Rebuilds ONLY the grid — the voice row and the window are untouched
   * — then repaints so the new page's lights are right. The lit set is shared across pages, so a
   * duration chosen on the note-entry page is still chosen when you come back to it.
   */
  private showPage(): void {
    const grid = this.buildGrid()
    this.gridEl?.replaceWith(grid)
    this.gridEl = grid
    this.paint()
    dbg(`[keypad] page ${keypadPage(keypadPageSelection.get()).name}`)
  }

  /**
   * A press. WHAT it does is {@link pressKeypadCell}'s answer, shared with the numpad key this cell
   * mirrors — the panel only lights and logs the result.
   */
  private press(cell: KeypadCell): void {
    pressKeypadCell(cell)

    // The page key has already re-laid the grid through the seam (with its own paint and log), and the
    // cell we were handed belongs to the page we just left — so nothing below applies to it.
    if (cell.select === 'page') return

    this.paint()
    // Wired keys report their light; an unwired `momentary` cell (a feathered beam) always reads ` off`.
    const state = this.isLit(cell) ? ' on' : ' off'
    dbg(`[keypad] ${cell.action}${state} — key ${cell.key}, voice ${this.voice != null ? VOICES[this.voice] : 'none'}`)
  }

  /**
   * Is this key lit? The one place the question is answered, for both {@link paint} and the press log.
   * By kind: the tool mode (the arrow), the armed duration/accidental/dot, the tie, the rest, the active
   * articulations (a set), and page 2's beam cluster (the beam MODE set, the subdivide, the beam-rest).
   * EVERY light on the panel comes from an editor store — the widget holds none of its own, so it cannot
   * show you a state the score does not have. An unwired `momentary` cell (a feathered beam) stays dark.
   */
  private isLit(cell: KeypadCell): boolean {
    if (cell.select === 'mode') return bus.mode.get() === 'selection'
    if (cell.select === 'duration') return cell.duration === bus.duration.get()
    if (cell.select === 'accidental') return cell.accidental === bus.accidental.get()
    if (cell.select === 'articulation') return !!cell.articulation && bus.articulation.isActive(cell.articulation)
    if (cell.select === 'dot') return bus.dot.get() === 'dot'
    if (cell.select === 'tie') return bus.tie.get() === 'tie'
    if (cell.select === 'beam') return !!cell.beam && bus.beam.isActive(cell.beam)
    if (cell.select === 'subdivide') return bus.subdivide.get() === 'subdivide'
    if (cell.select === 'beamOver') return bus.beamOver.get() === 'beamOver'
    // ⚠️ TWO AXES, lit independently: the count key says how fast, the pair key says the strokes go
    // between two notes, and a two-note tremolo is BOTH — so `Enter` lights beside `3`, not instead
    // of it (docs/two-note-tremolo-plan.md §4).
    if (cell.select === 'tremolo') return !!cell.tremolo && cell.tremolo === bus.tremolo.get()
    if (cell.select === 'tremoloPair') return bus.tremoloPair.get() === 'tremoloPair'
    // The feathered beams are a radio like the tremolo counts — a note carries ONE fan.
    if (cell.select === 'fan') return !!cell.fan && cell.fan === bus.fan.get()
    // An unwired key (the feathered beams on page 2) shows no light.
    if (cell.select === 'momentary') return false
    return cell.select === 'rest' && bus.rest.get() === 'rest'
  }

  /**
   * Voice 1–4 and All. Small, and CENTRED under the numpad rather than stretched across it: the
   * voice row is a setting you leave alone, not a row of keys you play, and five cells spanning the
   * full width read as a sixth row of the pad.
   */
  private buildVoices(): HTMLElement {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.justifyContent = 'center'
    row.style.gap = `${GAP}px`

    VOICES.forEach((name, i) => {
      const button = this.baseButton()
      button.style.height = `${Math.round(CELL * 0.45)}px`
      button.style.minWidth = `${Math.round(CELL * 0.78)}px`
      button.style.padding = `0 ${GAP + 1}px`
      button.style.fontSize = `${Math.round(CELL * 0.3)}px`
      button.style.fontWeight = '600'
      button.textContent = name
      button.title = `voice ${name}`
      button.addEventListener('click', () => {
        if (name === 'All') {
          // "All" is not an editor entry voice — keep it a local highlight for now (unwired).
          this.voice = i
          this.paint()
        } else {
          // 1–4: drive the editor's active voice through the seam (same as Alt+1..4 / the toolbar);
          // the highlight mirror lights the button back, so we don't set `this.voice` here.
          bus.voice.press((i + 1) as 1 | 2 | 3 | 4)
        }
        dbg(`[keypad] voice ${name}`)
      })
      row.appendChild(button)
      this.voiceButtons.push(button)
    })
    return row
  }

  /** The lights, redrawn from the state. There is no other place a button's colour is set. */
  private paint(): void {
    // Every lit key wears the ACTIVE voice's colour, so the whole panel says which voice you are
    // writing into (utils/voiceColors — the same map the score paints selection with: V1 blue, V2
    // green, V3 orange, V4 purple).
    const voiceColor = this.activeVoiceColor()
    // The select arrow is a MODE indicator, so by default it keeps the panel's own gutter blue. But a
    // blue arrow beside an orange/green/purple lit panel is a jarring clash — so when a voice IS
    // highlighted it borrows that voice's colour and reads as one panel; with no voice lit (nothing /
    // multiple notes selected) it falls back to its own blue.
    const arrowColor = this.voice != null ? voiceColor : COLOR.mode
    for (const { cell, button } of this.keys) {
      light(button, this.isLit(cell), cell.select === 'mode' ? arrowColor : voiceColor)
    }
    // Only the active voice's own button is lit, so it too shows the active voice's colour.
    this.voiceButtons.forEach((button, i) =>
      light(button, i === this.voice, VOICES[i] === 'All' ? COLOR.lit : voiceFillColor(i)),
    )
  }

  /** The colour every lit key wears: the active voice's (V1 blue, V2 green, V3 orange, V4 purple).
   *  'All' is not a single voice, so it falls back to the panel's default blue. */
  private activeVoiceColor(): string {
    if (this.voice == null) return COLOR.lit
    return VOICES[this.voice] === 'All' ? COLOR.lit : voiceFillColor(this.voice)
  }

  /** Point `this.voice` (the lit index) at the editor's active voice, or null when the seam is dark
   *  (nothing / multiple notes selected). The seam holds it 1-based (UI convention); the row is
   *  0-based, and only voices 1–4 map — "All" is never the active voice. */
  private syncVoiceFromSeam(): void {
    const active = bus.voice.get()
    this.voice = active != null ? active - 1 : null
  }

  /**
   * A key. It never takes focus — `preventDefault` on mousedown — because the score's keyboard
   * handling must survive a click on the panel, exactly as it does in Sibelius.
   */
  private baseButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    const s = button.style
    s.display = 'flex'
    s.alignItems = 'center'
    s.justifyContent = 'center'
    s.padding = '0'
    s.overflow = 'hidden' // a tall glyph is clipped by its key, never allowed to stretch the panel
    s.borderRadius = '6px'
    s.border = `1px solid ${COLOR.edge}`
    s.background = COLOR.face
    s.color = COLOR.glyph
    s.font = 'inherit'
    s.cursor = 'pointer'
    // No transition by default: the HIGHLIGHT is the state itself, not an animation of it, so it must
    // snap the instant a note is selected or a key pressed — a fade would wash the fill in behind the
    // border/glow (which never faded) and read as lag. The gentle ease is a HOVER affordance only, so
    // the hover handlers switch it on for their own change and `light()` switches it back off.

    button.addEventListener('mousedown', (e) => e.preventDefault())
    // Hover brightens an UNLIT key only: a lit key is already saying something, and dulling it under
    // the cursor would read as "not pressed". The fade is turned on HERE (never on `light()`), so only
    // the hover eases; setting transition before the background means it animates at the next flush.
    button.addEventListener('mouseenter', () => {
      if (button.dataset.lit === 'true') return
      button.style.transition = 'background 80ms linear'
      button.style.background = COLOR.hover
    })
    button.addEventListener('mouseleave', () => {
      if (button.dataset.lit === 'true') return
      button.style.transition = 'background 80ms linear'
      button.style.background = COLOR.face
    })
    return button
  }
}

function light(button: HTMLButtonElement, on: boolean, litColor: string = COLOR.lit): void {
  button.dataset.lit = on ? 'true' : 'false'
  // Snap, don't fade: setting transition to none in the same synchronous write as the colours means
  // the browser sees zero duration at the next style flush, so the highlight appears instantly. (The
  // hover handlers re-arm the 80ms ease for their own change — this only ever governs the lit state.)
  button.style.transition = 'none'
  button.style.background = on ? litColor : COLOR.face
  button.style.borderColor = on ? litColor : COLOR.edge
  button.style.boxShadow = on ? `inset 0 0 0 1px ${COLOR.glyph}33` : 'none'
}

function renderIcon(icon: Icon): HTMLElement {
  const el = document.createElement('span')
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.lineHeight = '1'

  if ('svg' in icon) {
    if (icon.dy) el.style.transform = `translateY(${(GLYPH * icon.dy) / 26}px)`
    el.innerHTML = icon.svg
    const svg = el.firstElementChild as SVGElement
    svg.setAttribute('width', `${Math.round(40 * ICON_SCALE)}`)
    svg.setAttribute('height', `${Math.round(26 * ICON_SCALE)}`)
    return el
  }

  // A BAKED drawing: the same layers recipe, rendered to one svg (tremoloBake) instead of a live
  // span-stack. Sized to the SAME GLYPH×GLYPH box the spans use, so its 26-unit viewBox scales to
  // GLYPH/26 px per unit — the spans' exact arithmetic. Overflow shows (the note's stem runs past the
  // little box) and the button clips it, just as with the spans.
  if ('bake' in icon) {
    const svg = bakeGlyphStack(icon.bake, MUSIC_FONT)
    svg.style.width = `${GLYPH}px`
    svg.style.height = `${GLYPH}px`
    svg.style.overflow = 'visible'
    el.appendChild(svg)
    return el
  }

  // The REWORK path (keypadLayouts' rework()): the SAME recipe as a baked cell, but drawn as the raw
  // stacked glyphs — each span fills the GLYPH box, centres its glyph, then slides by dx/dy. Kept so a
  // drawing can be tuned live before it is baked; production cells go through `bake` above, not here.
  if ('layers' in icon) {
    el.style.position = 'relative'
    el.style.width = `${GLYPH}px`
    el.style.height = `${GLYPH}px`
    for (const layer of icon.layers) {
      const span = glyphSpan(layer)
      span.style.position = 'absolute'
      span.style.inset = '0'
      span.style.display = 'flex'
      span.style.alignItems = 'center'
      span.style.justifyContent = 'center'
      el.appendChild(span)
    }
    return el
  }

  // A row of glyphs (the quarter + eighth rest on one key) or a single glyph — one builder either way.
  const parts = 'glyphs' in icon ? icon.glyphs : [icon]
  if (parts.length > 1) el.style.gap = `${Math.round(GLYPH * 0.24)}px`
  for (const part of parts) el.appendChild(glyphSpan(part))
  return el
}

/** One music-font glyph. Its `size` and `dy` are both quoted against a 26px glyph, so a mark that
 *  needs to be bigger or lower stays proportionally so at any key size. */
function glyphSpan(spec: GlyphSpec): HTMLElement {
  const el = document.createElement('span')
  el.textContent = spec.glyph
  el.style.fontFamily = MUSIC_FONT
  el.style.lineHeight = '1'
  el.style.fontSize = `${Math.round(GLYPH * (spec.size ?? 26) / 26)}px`
  const tx = spec.dx ? (GLYPH * spec.dx) / 26 : 0
  const ty = spec.dy ? (GLYPH * spec.dy) / 26 : 0
  if (tx || ty) el.style.transform = `translate(${tx}px, ${ty}px)`
  return el
}
