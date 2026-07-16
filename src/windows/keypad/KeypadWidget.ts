import type { Widget } from '../content/Widget'
import { modeSelection } from '../../interactions/modeSelection'
import { durationSelection } from '../../interactions/durationSelection'
import { accidentalSelection } from '../../interactions/accidentalSelection'
import { articulationSelection } from '../../interactions/articulationSelection'
import { dotSelection } from '../../interactions/dotSelection'
import { tieSelection } from '../../interactions/tieSelection'
import { restSelection } from '../../interactions/restSelection'
import { voiceFillColor } from '../../utils/voiceColors'
import { CHROME } from '../../utils/chromeColors'
import { KEYPAD_PAGES, VOICES, type GlyphSpec, type Icon, type KeypadCell } from './keypadLayouts'

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
  // The select arrow's lit blue. It is NOT the chrome accent: it matches the linear-view gutter ink
  // (GutterRenderer's GUTTER_INK, #1D4ED8 / blue-700) on purpose — both are a NON-voice indicator,
  // and that blue is deliberately darker than voice-1's (#3B82F6) so it can never be misread as
  // voice-coloured. So it stays a local literal, free of the chrome token.
  mode: '#1D4ED8',
  glyph: CHROME.ink,
}

/** Bravura first — these are glyphs, not text, so the music font MUST lead the stack. */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

export class KeypadWidget implements Widget {
  private voice = 0

  private readonly keys: { cell: KeypadCell; button: HTMLButtonElement }[] = []
  private readonly voiceButtons: HTMLButtonElement[] = []

  /** Which page is showing. The `+` key steps it; the voice row and window are unaffected. */
  private page = 0
  /** The grid element, held so a page turn can swap it out without touching the voice row. */
  private gridEl: HTMLElement | null = null

  /** The arrow, the duration keys and the accidental keys light from the EDITOR's stores, not the
   *  panel's own — so the panel listens to each and repaints when it changes elsewhere (the Vue
   *  palette, a shortcut, selecting a note). */
  private unsubscribeMode: (() => void) | null = null
  private unsubscribeDuration: (() => void) | null = null
  private unsubscribeAccidental: (() => void) | null = null
  private unsubscribeArticulation: (() => void) | null = null
  private unsubscribeDot: (() => void) | null = null
  private unsubscribeTie: (() => void) | null = null
  private unsubscribeRest: (() => void) | null = null

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
    this.unsubscribeMode = modeSelection.onHighlight(() => this.paint())
    this.unsubscribeDuration = durationSelection.onHighlight(() => this.paint())
    this.unsubscribeAccidental = accidentalSelection.onHighlight(() => this.paint())
    this.unsubscribeArticulation = articulationSelection.onHighlight(() => this.paint())
    this.unsubscribeDot = dotSelection.onHighlight(() => this.paint())
    this.unsubscribeTie = tieSelection.onHighlight(() => this.paint())
    this.unsubscribeRest = restSelection.onHighlight(() => this.paint())

    // The numpad `+` turns the page too — the panel IS the numpad, so the key its `+` cell mirrors
    // drives it. Global, so it works with the score focused, and only while the panel is open (removed
    // in destroy). Bound here rather than in the app's ShortcutManager because it is the WIDGET's
    // behaviour and its lifecycle is the window's, not the editor's.
    document.addEventListener('keydown', this.onKeyDown)

    this.paint()
  }

  /** Document-wide handles (the tool-mode subscription, the numpad key) outlive this widget's DOM, so
   *  they must be released when it closes. */
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
    document.removeEventListener('keydown', this.onKeyDown)
  }

  /**
   * The numpad `+` (and only the numpad `+` — `code`, not `key`, so the main-row `+` is untouched)
   * turns the page. Skipped while typing in a field, or with a modifier held — Ctrl+`+` is the
   * browser's own zoom, and hijacking it would be a surprise.
   */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'NumpadAdd' || e.ctrlKey || e.metaKey || e.altKey) return
    const el = document.activeElement
    if (el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
    e.preventDefault()
    this.turnPage()
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
    for (const cell of KEYPAD_PAGES[this.page]) {
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
   * Turn to the next page (the `+` key). Rebuilds ONLY the grid — the voice row and the window are
   * untouched — then repaints so the new page's lights are right. The lit set is shared across pages,
   * so a duration chosen on page 1 is still chosen when you come back to it.
   */
  private turnPage(): void {
    this.page = (this.page + 1) % KEYPAD_PAGES.length
    const grid = this.buildGrid()
    this.gridEl?.replaceWith(grid)
    this.gridEl = grid
    this.paint()
    console.log(`[keypad] page ${this.page + 1}`)
  }

  /**
   * A press. What it means to the lights depends only on the cell's `select` — see the doc on
   * {@link Select}. Nothing else in the panel needs to know that ♯ and ♭ are related.
   */
  private press(cell: KeypadCell): void {
    switch (cell.select) {
      case 'duration':
        // The armed duration lives in the editor's store, not the panel's lit set — PRESS the value
        // and the store lights it back (App.vue runs the full setDuration path). The store decides the
        // radio; the panel maps nothing. `duration` is always present on a duration cell (keypadLayouts).
        if (cell.duration) durationSelection.press(cell.duration)
        break
      case 'accidental':
        // Same, and the press channel is what lets ♯-then-♯ toggle OFF: setAccidental sees the armed
        // value pressed again and clears it. A state-mirror would swallow the repeat as "no change".
        if (cell.accidental) accidentalSelection.press(cell.accidental)
        break
      case 'articulation':
        // Independent toggles on a set-valued store. PRESS the value; App.vue routes it to the
        // palette's toggleX, which flips the score AND re-pushes the lit set — the store lights it
        // back, so the panel maps nothing. `articulation` is always present here (keypadLayouts).
        if (cell.articulation) articulationSelection.press(cell.articulation)
        break
      case 'dot':
        // On/off, like the accidental: PRESS always fires so re-pressing toggles the dot OFF. App.vue
        // routes it through palette.toggleDot and mirrors selectedDots back in as the highlight.
        dotSelection.press('dot')
        break
      case 'tie':
        // On/off like the dot, but engine-backed: PRESS routes to palette.toggleTie, which flips the
        // note's tie AND re-pushes the highlight (tiedTo isn't reactive, so it can't be mirrored).
        tieSelection.press('tie')
        break
      case 'rest':
        // Silences the selection (routes to palette.convertSelectionToRest via keypadSync). Its light
        // still follows the SCORE, not this click — the click changes the score, and the score lights
        // the key. Pressing it with a rest already selected is a no-op, so the light never toggles off.
        restSelection.press('rest')
        break
      case 'momentary':
        break
      case 'mode':
        // The arrow ACTIVATES selection mode. Its light follows the editor, not this click, so there
        // is no local state to flip — the press routes to enterSelectionMode (via keypadSync), the
        // editor's mode changes, and keypadSync's sync() repaints us. (No-op if already there.)
        modeSelection.press('selection')
        break
      case 'page':
        // Turns the page and re-lays the grid. It has its own paint + log, and the cell we were
        // handed belongs to the page we are leaving — so return before the generic tail below.
        this.turnPage()
        return
    }

    this.paint()
    const state = cell.select === 'momentary' ? '' : this.isLit(cell) ? ' on' : ' off'
    console.log(`[keypad] ${cell.action}${state} — key ${cell.key}, voice ${VOICES[this.voice]}`)
  }

  /**
   * Is this key lit? The one place the question is answered, for both {@link paint} and the press log.
   * By kind: the tool mode (the arrow), the armed duration/accidental/dot, the tie, the rest, and the
   * active articulations (a set). EVERY light on the panel now comes from an editor store — the
   * widget holds none of its own, so it cannot show you a state the score does not have.
   */
  private isLit(cell: KeypadCell): boolean {
    if (cell.select === 'mode') return modeSelection.get() === 'selection'
    if (cell.select === 'duration') return cell.duration === durationSelection.get()
    if (cell.select === 'accidental') return cell.accidental === accidentalSelection.get()
    if (cell.select === 'articulation') return !!cell.articulation && articulationSelection.isActive(cell.articulation)
    if (cell.select === 'dot') return dotSelection.get() === 'dot'
    if (cell.select === 'tie') return tieSelection.get() === 'tie'
    return cell.select === 'rest' && restSelection.get() === 'rest'
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
    // Every lit key wears the ACTIVE voice's colour, so the whole panel says which voice you are
    // writing into (utils/voiceColors — the same map the score paints selection with: V1 blue, V2
    // green). The lone exception is the select arrow: it is a MODE indicator, not a voice-coloured
    // mark, so it keeps the panel's own blue.
    const voiceColor = this.activeVoiceColor()
    for (const { cell, button } of this.keys) {
      light(button, this.isLit(cell), cell.select === 'mode' ? COLOR.mode : voiceColor)
    }
    // Only the active voice's own button is lit, so it too shows the active voice's colour.
    this.voiceButtons.forEach((button, i) =>
      light(button, i === this.voice, VOICES[i] === 'All' ? COLOR.lit : voiceFillColor(i)),
    )
  }

  /** The colour every lit key wears: the active voice's (V1 blue, V2 green). 'All' is not a single
   *  voice, so it falls back to the panel's default blue. */
  private activeVoiceColor(): string {
    return VOICES[this.voice] === 'All' ? COLOR.lit : voiceFillColor(this.voice)
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
  if (spec.dy) el.style.transform = `translateY(${(GLYPH * spec.dy) / 26}px)`
  return el
}
