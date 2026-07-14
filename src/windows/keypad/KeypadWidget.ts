import type { Widget } from '../content/Widget'
import { DEFAULT_DURATION, KEYPAD_CELLS, VOICES, type Icon, type KeypadCell } from './keypadLayouts'

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
  // score shows in the gaps and around the grid, and never through a key.
  face: '#374151',
  edge: '#4b5563',
  hover: '#4b5563',
  lit: '#2563eb',
  glyph: '#f3f4f6',
}

/** Bravura first — these are glyphs, not text, so the music font MUST lead the stack. */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

export class KeypadWidget implements Widget {
  /** Every key that is currently lit, by action. The panel's whole state, and the score's shadow. */
  private readonly lit = new Set<string>([DEFAULT_DURATION])
  private voice = 0

  private readonly keys: { cell: KeypadCell; button: HTMLButtonElement }[] = []
  private readonly voiceButtons: HTMLButtonElement[] = []

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

    root.appendChild(this.buildGrid())
    root.appendChild(this.buildVoices())
    host.appendChild(root)

    this.paint()
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

    for (const cell of KEYPAD_CELLS) {
      const button = this.baseButton()
      button.title = `${cell.action}  (${cell.key})`
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
   * A press. What it means to the lights depends only on the cell's `select` — see the doc on
   * {@link Select}. Nothing else in the panel needs to know that ♯ and ♭ are related.
   */
  private press(cell: KeypadCell): void {
    switch (cell.select) {
      case 'duration':
      case 'accidental': {
        const wasLit = this.lit.has(cell.action)
        for (const sibling of KEYPAD_CELLS) {
          if (sibling.select === cell.select) this.lit.delete(sibling.action)
        }
        // A duration can only move; an accidental can also be taken back off.
        if (!(wasLit && cell.select === 'accidental')) this.lit.add(cell.action)
        break
      }
      case 'toggle':
        if (this.lit.has(cell.action)) this.lit.delete(cell.action)
        else this.lit.add(cell.action)
        break
      case 'momentary':
        break
    }

    this.paint()
    const state = cell.select === 'momentary' ? '' : this.lit.has(cell.action) ? ' on' : ' off'
    console.log(`[keypad] ${cell.action}${state} — key ${cell.key}, voice ${VOICES[this.voice]}`)
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
        this.voice = i
        this.paint()
        console.log(`[keypad] voice ${name}`)
      })
      row.appendChild(button)
      this.voiceButtons.push(button)
    })
    return row
  }

  /** The lights, redrawn from the state. There is no other place a button's colour is set. */
  private paint(): void {
    for (const { cell, button } of this.keys) light(button, this.lit.has(cell.action))
    this.voiceButtons.forEach((button, i) => light(button, i === this.voice))
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
    s.transition = 'background 80ms linear'

    button.addEventListener('mousedown', (e) => e.preventDefault())
    // Hover brightens an UNLIT key only: a lit key is already saying something, and dulling it under
    // the cursor would read as "not pressed".
    button.addEventListener('mouseenter', () => {
      if (button.dataset.lit !== 'true') button.style.background = COLOR.hover
    })
    button.addEventListener('mouseleave', () => {
      if (button.dataset.lit !== 'true') button.style.background = COLOR.face
    })
    return button
  }
}

function light(button: HTMLButtonElement, on: boolean): void {
  button.dataset.lit = on ? 'true' : 'false'
  button.style.background = on ? COLOR.lit : COLOR.face
  button.style.borderColor = on ? COLOR.lit : COLOR.edge
  button.style.boxShadow = on ? `inset 0 0 0 1px ${COLOR.glyph}33` : 'none'
}

function renderIcon(icon: Icon): HTMLElement {
  const el = document.createElement('span')
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.lineHeight = '1'

  if (icon.dy) el.style.transform = `translateY(${(GLYPH * icon.dy) / 26}px)`

  if ('svg' in icon) {
    el.innerHTML = icon.svg
    const svg = el.firstElementChild as SVGElement
    svg.setAttribute('width', `${Math.round(40 * ICON_SCALE)}`)
    svg.setAttribute('height', `${Math.round(26 * ICON_SCALE)}`)
    return el
  }
  el.textContent = icon.glyph
  el.style.fontFamily = MUSIC_FONT
  // A cell's own `size` and `dy` are quoted against a 26px glyph, so a mark that needs to be bigger
  // or lower stays proportionally so at any key size.
  el.style.fontSize = `${Math.round(GLYPH * (icon.size ?? 26) / 26)}px`
  return el
}
