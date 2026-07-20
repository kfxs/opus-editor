import type { Widget } from './Widget'
import { CHROME } from '../../utils/chromeColors'

/**
 * The leaf widgets. Dumb DOM builders, no state, no binding — see the warning in Widget.ts before
 * adding to this file.
 */

/** A run of prose that does NOT scroll — it is as tall as it needs to be. Pair with `fitContent`. */
export class Text implements Widget {
  constructor(private readonly paragraphs: string[]) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.style.flex = 'none'
    for (const text of this.paragraphs) {
      const p = document.createElement('p')
      p.textContent = text
      p.style.margin = '0 0 10px'
      el.appendChild(p)
    }
    if (el.lastElementChild) (el.lastElementChild as HTMLElement).style.marginBottom = '0'
    host.appendChild(el)
  }
}

/** A scrolling run of prose. It is the SCROLLER, so it works in a window box or in one grid cell. */
export class ScrollText implements Widget {
  constructor(private readonly paragraphs: string[]) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.style.overflowY = 'auto'
    el.style.flex = '1'
    el.style.minHeight = '0'
    el.style.paddingRight = '8px' // keep the scrollbar off the text

    for (const text of this.paragraphs) {
      const p = document.createElement('p')
      p.textContent = text
      p.style.margin = '0 0 10px'
      el.appendChild(p)
    }
    host.appendChild(el)
  }
}

/** One row of a {@link ChoiceList}: what it IS, and the picture that stands for it. */
export interface Choice {
  value: string
  /** SVG markup — the row is a PICTURE, not a caption (a clef is drawn, never spelled). */
  picture: string
}

/**
 * A sunken, scrolling box of pictures, exactly one of them chosen — the shape every "pick a
 * notation" dialog has (clef, key signature, time signature, instrument): a list you scroll, a row
 * you click, one selection at a time.
 *
 * It knows nothing about music. The caller draws the rows and names their values; this widget owns
 * the box, the scrolling, and which row is lit.
 */
export class ChoiceList implements Widget {
  private selected: string
  private readonly rows = new Map<string, HTMLElement>()

  constructor(
    private readonly choices: Choice[],
    private readonly opts: {
      selected?: string
      onChange?: (value: string) => void
      /** Double-click: choose it AND commit, the shortcut past the OK button every list dialog has. */
      onActivate?: (value: string) => void
    } = {},
  ) {
    this.selected = opts.selected ?? choices[0]?.value ?? ''
  }

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    const s = el.style
    s.flex = '1'
    s.minHeight = '0'
    s.overflowY = 'auto'
    s.border = `1px solid ${CHROME.edge}`
    s.borderRadius = '6px'
    s.background = CHROME.field
    // Air BETWEEN the rows, not inside them: the gap separates the lit bands, so which row is chosen
    // stays legible when two pictures sit close together. The padding keeps the first and last row
    // off the box's own border.
    s.display = 'flex'
    s.flexDirection = 'column'
    s.gap = '6px'
    s.padding = '6px 0'

    for (const choice of this.choices) {
      const row = document.createElement('div')
      row.innerHTML = choice.picture
      row.style.cursor = 'pointer'
      row.style.display = 'flex'
      row.style.justifyContent = 'center'
      row.addEventListener('click', () => this.select(choice.value))
      // The first click of the pair has already selected it, so activate can just fire — and it
      // fires with the ROW's value, not the current selection, so a fast double-click on a row that
      // was never selected still commits the row you actually hit.
      row.addEventListener('dblclick', () => this.opts.onActivate?.(choice.value))
      el.appendChild(row)
      this.rows.set(choice.value, row)
    }

    host.appendChild(el)
    this.paint()
  }

  get value(): string {
    return this.selected
  }

  private select(value: string): void {
    if (value === this.selected) return
    this.selected = value
    this.paint()
    this.opts.onChange?.(value)
  }

  private paint(): void {
    for (const [value, row] of this.rows) {
      // The lit row is a TINT, not the solid accent: the picture on it is the point, and a solid
      // blue behind a thin-stroked staff swallows it.
      row.style.background = value === this.selected ? 'rgba(37, 99, 235, 0.35)' : 'transparent'
    }
  }
}

/** The one red in the toolkit: something you typed is wrong. Local, not a CHROME token — the chrome
 *  palette is neutrals plus the accent, and a colour that MEANS something stays out of it. */
const ERROR_INK = '#f87171'

export interface ButtonOptions {
  /** 'primary' is the one that commits — the Save in a Save window. */
  variant?: 'primary' | 'default'
  disabled?: boolean
}

/** A button. It calls back; it does not know what it is for. */
export class Button implements Widget {
  private el: HTMLButtonElement | null = null

  constructor(
    private readonly label: string,
    private readonly onClick: () => void,
    private readonly opts: ButtonOptions = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('button')
    el.type = 'button'
    el.textContent = this.label
    el.disabled = this.opts.disabled ?? false

    const primary = this.opts.variant === 'primary'
    const s = el.style
    s.padding = '6px 14px'
    s.borderRadius = '6px'
    s.border = `1px solid ${primary ? CHROME.accent : CHROME.edge}`
    s.background = primary ? CHROME.accent : CHROME.surface
    s.color = CHROME.ink
    s.font = 'inherit'
    s.fontWeight = '600'
    s.cursor = el.disabled ? 'default' : 'pointer'
    s.opacity = el.disabled ? '0.5' : '1'
    s.flex = 'none'

    el.addEventListener('click', () => this.onClick())
    host.appendChild(el)
    this.el = el
  }

  setDisabled(disabled: boolean): void {
    if (!this.el) return
    this.el.disabled = disabled
    this.el.style.cursor = disabled ? 'default' : 'pointer'
    this.el.style.opacity = disabled ? '0.5' : '1'
  }
}

/** A line of text. Reserved (with {@link TextInput}) for porting App.vue's custom-meter /
 *  pickup dialogs to plain-TS windows; no caller yet, kept as the ready building block. */
export class Label implements Widget {
  private el: HTMLElement | null = null

  constructor(
    private text: string,
    /** `muted` is a hint under a field; `error` is what is WRONG with what you typed. Two tones and
     *  not a free colour: a widget that takes any colour becomes the place colours are decided. */
    private readonly opts: { muted?: boolean; tone?: 'error' } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.textContent = this.text
    el.style.flex = 'none'
    if (this.opts.muted) el.style.color = CHROME.inkMuted
    if (this.opts.tone === 'error') el.style.color = ERROR_INK
    host.appendChild(el)
    this.el = el
  }

  setText(text: string): void {
    this.text = text
    if (this.el) this.el.textContent = text
  }
}

/** A single-line text field. Reads its value on demand; it does not bind to anything. */
export class TextInput implements Widget {
  private el: HTMLInputElement | null = null

  constructor(
    private readonly opts: {
      value?: string
      placeholder?: string
      onEnter?: () => void
      /** Every keystroke — for a field that is JUDGED as you type (a grouping that must sum). */
      onInput?: (value: string) => void
    } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('input')
    el.type = 'text'
    el.value = this.opts.value ?? ''
    if (this.opts.placeholder) el.placeholder = this.opts.placeholder

    const s = el.style
    s.padding = '6px 10px'
    s.borderRadius = '6px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.field
    s.color = CHROME.ink
    s.font = 'inherit'
    s.flex = 'none'
    s.minWidth = '0'

    if (this.opts.onEnter) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.opts.onEnter?.()
      })
    }
    if (this.opts.onInput) el.addEventListener('input', () => this.opts.onInput?.(el.value))
    host.appendChild(el)
    this.el = el
  }

  get value(): string {
    return this.el?.value ?? this.opts.value ?? ''
  }

  focus(): void {
    this.el?.focus()
    this.el?.select()
  }
}

/**
 * The form controls below are native `<input>`s and a native `<select>`, tinted with
 * `accent-color`, rather than divs drawn to look like them. A hand-drawn checkbox has to
 * re-implement focus, keyboard toggling, the indeterminate state and the label-click target, and
 * gets each of them slightly wrong; the browser's already work. Only the COLOUR is ours.
 */

/** One choice in a {@link RadioGroup}. `picture` is SVG markup when the option is drawn (a meter,
 *  a clef) — `label` when it is a word. A row may mix the two. */
export interface RadioOption {
  value: string
  label?: string
  picture?: string
  /** Extra widget shown after the label — the spinners beside Sibelius's "Other:". */
  trailing?: Widget
}

/** Exactly one of N, laid out in a row. The horizontal sibling of {@link ChoiceList}: that one is a
 *  scrolling box of pictures, this is a line of radios you take in at a glance. */
export class RadioGroup implements Widget {
  private selected: string
  private readonly inputs: HTMLInputElement[] = []
  /** Radios only group by shared `name`; two RadioGroups in one window must not fight. */
  private static nextName = 1
  private readonly name = `radio-group-${RadioGroup.nextName++}`

  constructor(
    private readonly options: RadioOption[],
    private readonly opts: {
      selected?: string
      gap?: number
      onChange?: (value: string) => void
      /** Double-click a row: choose it AND commit — the shortcut past OK that a picker is expected
       *  to have, the same gesture {@link ChoiceList} offers. */
      onActivate?: (value: string) => void
    } = {},
  ) {
    this.selected = opts.selected ?? options[0]?.value ?? ''
  }

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.style.display = 'flex'
    el.style.flexWrap = 'wrap'
    el.style.alignItems = 'center'
    el.style.gap = `${this.opts.gap ?? 14}px`
    el.style.flex = 'none'

    for (const option of this.options) {
      // A <label> wrapping the control makes the whole row a hit target, for free.
      const row = document.createElement('label')
      row.style.display = 'flex'
      row.style.alignItems = 'center'
      row.style.gap = '6px'
      row.style.cursor = 'pointer'

      const input = document.createElement('input')
      input.type = 'radio'
      input.name = this.name
      input.checked = option.value === this.selected
      input.style.accentColor = CHROME.accent
      input.style.margin = '0'
      input.addEventListener('change', () => {
        this.selected = option.value
        this.opts.onChange?.(option.value)
      })
      // Fires with the ROW's value, not the current selection: the first click of the pair has
      // already moved the dot, but a fast double-click on a row that never got selected must still
      // commit the row you actually hit.
      row.addEventListener('dblclick', () => this.opts.onActivate?.(option.value))
      row.appendChild(input)
      this.inputs.push(input)

      if (option.picture) {
        const picture = document.createElement('span')
        picture.innerHTML = option.picture
        picture.style.display = 'flex'
        row.appendChild(picture)
      }
      if (option.label) {
        const label = document.createElement('span')
        label.textContent = option.label
        row.appendChild(label)
      }
      el.appendChild(row)

      // Mounted OUTSIDE the label: a spinner inside it would toggle the radio on every click.
      if (option.trailing) {
        const slot = document.createElement('div')
        slot.style.display = 'flex'
        option.trailing.mount(slot)
        el.appendChild(slot)
      }
    }

    host.appendChild(el)
  }

  get value(): string {
    return this.selected
  }

  /**
   * Choose an option from OUTSIDE — typing in the field that belongs to one, most of all: editing
   * the spinners beside "Other:" is choosing Other, and leaving the dot on 4/4 while the user types
   * a 5 into another row's field says the dialog is not listening.
   *
   * Deliberately does NOT fire `onChange`: the caller is already handling the interaction that
   * caused it, and notifying it back would be an echo — the shape that turns into a loop the first
   * time a listener writes anything.
   */
  select(value: string): void {
    if (value === this.selected) return
    this.selected = value
    const index = this.options.findIndex((o) => o.value === value)
    if (index >= 0 && this.inputs[index]) this.inputs[index].checked = true
  }

  destroy(): void {
    for (const option of this.options) option.trailing?.destroy?.()
  }
}

/** A labelled checkbox. Reports on change; holds its own state and nothing else's. */
export class Checkbox implements Widget {
  private el: HTMLInputElement | null = null

  constructor(
    private readonly label: string,
    private readonly opts: { checked?: boolean; onChange?: (checked: boolean) => void } = {},
  ) {}

  mount(host: HTMLElement): void {
    const row = document.createElement('label')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '7px'
    row.style.cursor = 'pointer'
    row.style.flex = 'none'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.opts.checked ?? false
    input.style.accentColor = CHROME.accent
    input.style.margin = '0'
    input.addEventListener('change', () => this.opts.onChange?.(input.checked))

    const label = document.createElement('span')
    label.textContent = this.label

    row.append(input, label)
    host.appendChild(row)
    this.el = input
  }

  get checked(): boolean {
    return this.el?.checked ?? this.opts.checked ?? false
  }
}

/** A drop-down. Options may carry `html` so a row can be a GLYPH (a note value) and not a word. */
export class Select implements Widget {
  private el: HTMLSelectElement | null = null

  constructor(
    private readonly options: { value: string; label: string }[],
    private readonly opts: { selected?: string; width?: number; onChange?: (value: string) => void } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('select')
    for (const option of this.options) {
      const node = document.createElement('option')
      node.value = option.value
      node.textContent = option.label
      el.appendChild(node)
    }
    el.value = this.opts.selected ?? this.options[0]?.value ?? ''

    const s = el.style
    s.padding = '3px 6px'
    s.borderRadius = '4px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.field
    s.color = CHROME.ink
    s.font = 'inherit'
    s.flex = 'none'
    if (this.opts.width) s.width = `${this.opts.width}px`

    el.addEventListener('change', () => this.opts.onChange?.(el.value))
    host.appendChild(el)
    this.el = el
  }

  get value(): string {
    return this.el?.value ?? this.opts.selected ?? ''
  }
}

/** A small number field — the beats/unit spinners beside "Other:". */
export class NumberInput implements Widget {
  private el: HTMLInputElement | null = null

  constructor(
    private readonly opts: {
      value?: number
      min?: number
      max?: number
      width?: number
      /** Committed — blur, Enter, or a stepper click. */
      onChange?: (value: number) => void
      /** Every keystroke and stepper press. What "the user is editing this field" looks like. */
      onInput?: (value: number) => void
    } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('input')
    el.type = 'number'
    el.value = String(this.opts.value ?? 4)
    if (this.opts.min !== undefined) el.min = String(this.opts.min)
    if (this.opts.max !== undefined) el.max = String(this.opts.max)

    const s = el.style
    s.width = `${this.opts.width ?? 56}px`
    s.padding = '3px 6px'
    s.borderRadius = '4px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.field
    s.color = CHROME.ink
    s.font = 'inherit'
    s.accentColor = CHROME.accent
    s.flex = 'none'

    el.addEventListener('change', () => this.opts.onChange?.(Number(el.value)))
    el.addEventListener('input', () => this.opts.onInput?.(Number(el.value)))
    host.appendChild(el)
    this.el = el
  }

  get value(): number {
    return Number(this.el?.value ?? this.opts.value ?? 0)
  }
}

/** One row of a {@link GlyphSelect}: the value, the glyph that stands for it, and its name. */
export interface GlyphChoice {
  value: string
  /** SMuFL glyph, in the score's notation font. */
  glyph: string
  /** Not shown — the tooltip and the accessible name, so the control is not mute. */
  label: string
}

/**
 * A drop-down whose rows are GLYPHS rather than words — the pickup-length picker, where the choice
 * is a note value, and a note value is drawn: "Quarter" DESCRIBES a crotchet, ♩ IS one.
 *
 * ONE object, field and list together. This began as a button that opened the MENU layer, and that
 * was the wrong primitive twice over. A menu is a list of COMMANDS; a dropdown is a picker with a
 * CURRENT VALUE, which has to be visible the moment the list opens and has to move under the arrow
 * keys — and `MenuItem` deliberately refuses checkmarks and radio groups, so the one thing this
 * needs is the one thing that type is designed not to have. The menu's row metrics are tuned for
 * the score's context menu too, so the list came out mis-sized inside a window.
 *
 * The list is appended to `document.body`, fixed-positioned against the button's client rect,
 * because a window's content box scrolls and clips: a popup parented inside it would be cut off by
 * the very frame it belongs to. It is torn down on close and on {@link destroy}, so nothing outlives
 * the window.
 */
export class GlyphSelect implements Widget {
  private selected: string
  private button: HTMLButtonElement | null = null
  private list: HTMLElement | null = null
  /** Which row the keyboard is on while the list is open; -1 when closed. */
  private active = -1

  constructor(
    private readonly choices: GlyphChoice[],
    private readonly opts: { selected?: string; width?: number; onChange?: (value: string) => void } = {},
  ) {
    this.selected = opts.selected ?? choices[0]?.value ?? ''
  }

  mount(host: HTMLElement): void {
    const el = document.createElement('button')
    el.type = 'button'

    const s = el.style
    s.display = 'flex'
    s.alignItems = 'center'
    s.justifyContent = 'space-between'
    s.gap = '8px'
    s.width = `${this.opts.width ?? 90}px`
    // A HEIGHT, not vertical padding: a note glyph is tall, and a button sized by its line box
    // clips the stem — which is exactly how the first cut of this looked. The extra few pixels are
    // padding UNDER the glyph: the ink is centred in its own box, so without them a notehead sits
    // as close to the field's lower border as the stem does to its upper one, and a notehead is a
    // solid blob where a stem is a hairline — it reads as touching long before the stem does.
    s.height = `${ROW_HEIGHT + FIELD_PAD_BOTTOM}px`
    s.padding = `0 8px ${FIELD_PAD_BOTTOM}px`
    s.borderRadius = '4px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.field
    s.color = CHROME.ink
    s.font = 'inherit'
    s.cursor = 'pointer'
    s.flex = 'none'
    s.overflow = 'visible' // a button clips its content by default; the glyph must not be cut

    el.addEventListener('click', () => (this.list ? this.close() : this.open()))
    el.addEventListener('keydown', this.onButtonKeyDown)

    host.appendChild(el)
    this.button = el
    this.paint()
  }

  get value(): string {
    return this.selected
  }

  destroy(): void {
    this.close()
  }

  private open(): void {
    const button = this.button
    if (!button || this.list) return

    const list = document.createElement('div')
    const s = list.style
    s.position = 'fixed'
    s.zIndex = '2000' // above the window layer (1000): a dropdown belongs to the front, always
    s.minWidth = `${button.offsetWidth}px`
    s.padding = '4px'
    s.borderRadius = '6px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.surface
    s.boxShadow = CHROME.shadow

    this.choices.forEach((choice, i) => {
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'center'
      row.style.height = `${ROW_HEIGHT}px`
      row.style.padding = '0 10px'
      row.style.borderRadius = '4px'
      row.style.cursor = 'pointer'
      row.title = choice.label
      row.appendChild(glyphSvg(choice.glyph))
      row.addEventListener('pointerenter', () => this.setActive(i))
      row.addEventListener('click', () => this.choose(choice.value))
      list.appendChild(row)
    })

    document.body.appendChild(list)
    this.list = list
    // While the list is up, Enter chooses a row and Escape shuts the list — neither is a verdict on
    // the surrounding dialog. The window layer reads this attribute and stands down; it listens on
    // `document` in the capture phase, so it runs before anything here could tell it otherwise.
    button.dataset.ownsKeys = 'true'

    // Below the field, flipped above when there is no room — the same rule a menu follows, and the
    // reason it is measured only after mounting: until then the list has no height.
    const box = button.getBoundingClientRect()
    const below = box.bottom + 2
    const fits = below + list.offsetHeight <= window.innerHeight
    s.left = `${box.left}px`
    s.top = `${fits ? below : Math.max(0, box.top - 2 - list.offsetHeight)}px`

    // The list opens ON the current value: a picker that opens with nothing marked makes you
    // remember what you chose last time.
    this.setActive(this.choices.findIndex((c) => c.value === this.selected))

    // Capture, so a click on any window chrome closes this first. `pointerdown` rather than click:
    // the list must be gone before whatever was clicked acts on it.
    document.addEventListener('pointerdown', this.onOutsidePointerDown, true)
    document.addEventListener('keydown', this.onListKeyDown, true)
  }

  private close(): void {
    if (this.button) delete this.button.dataset.ownsKeys
    document.removeEventListener('pointerdown', this.onOutsidePointerDown, true)
    document.removeEventListener('keydown', this.onListKeyDown, true)
    this.list?.remove()
    this.list = null
    this.active = -1
  }

  private choose(value: string): void {
    this.close()
    this.button?.focus() // the field keeps the keyboard, or Tab restarts from the top of the window
    if (value === this.selected) return
    this.selected = value
    this.paint()
    this.opts.onChange?.(value)
  }

  private setActive(index: number): void {
    if (!this.list || index < 0) return
    this.active = index
    Array.from(this.list.children).forEach((row, i) => {
      ;(row as HTMLElement).style.background = i === index ? CHROME.accent : 'transparent'
    })
  }

  private onOutsidePointerDown = (e: PointerEvent): void => {
    const target = e.target as Node
    if (this.list?.contains(target) || this.button?.contains(target)) return
    this.close()
  }

  /** Open on ↓/Enter/Space, the way a native select does. */
  private onButtonKeyDown = (e: KeyboardEvent): void => {
    if (this.list || !['ArrowDown', 'Enter', ' '].includes(e.key)) return
    e.preventDefault()
    this.open()
  }

  private onListKeyDown = (e: KeyboardEvent): void => {
    if (!this.list) return
    // Escape closes the LIST and stops there — without this it would reach the window's own Escape
    // and cancel the whole dialog, which is a much bigger act than the one the key was asked for.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.close()
      this.button?.focus()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      this.choose(this.choices[this.active]?.value ?? this.selected)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const step = e.key === 'ArrowDown' ? 1 : -1
      // No wrapping — the same rule the menus follow: the ends of a list are ends.
      this.setActive(Math.max(0, Math.min(this.choices.length - 1, this.active + step)))
    }
  }

  private paint(): void {
    const el = this.button
    if (!el) return
    const choice = this.choices.find((c) => c.value === this.selected)
    el.textContent = ''
    el.title = choice?.label ?? ''
    el.setAttribute('aria-label', choice?.label ?? '')

    const caret = document.createElement('span')
    caret.textContent = '▾'
    caret.style.color = CHROME.inkMuted
    caret.style.fontSize = '10px'

    el.append(glyphSvg(choice?.glyph ?? ''), caret)
  }
}

/** Tall enough for a stemmed note at {@link GLYPH_PX} — the field and its rows share it, so the
 *  chosen glyph does not jump when the list opens. */
const ROW_HEIGHT = 28
const GLYPH_PX = 19
/** Air under the glyph in the FIELD only — the list's rows have their neighbours for company. */
const FIELD_PAD_BOTTOM = 3
const GLYPH_BOX_WIDTH = 16

/**
 * A SMuFL glyph in an SVG box, POSITIONED — not an HTML span left to the font's line box.
 *
 * A span was tried first and clipped the stem, and the reason is worth keeping: a note glyph is
 * drawn against a STAFF, not a text line. Its ink reaches some three and a half staff-spaces above
 * the baseline (the stem) and half a space below (the notehead), while an HTML line box is sized
 * from the font's text metrics — so the glyph overflows a box that was never measured for it, and
 * whatever is clipping wins. Padding and `overflow: visible` only move that fight around.
 *
 * SVG ends it: the box is stated, and the baseline is placed so the INK is centred in it. SMuFL's
 * em square is the staff height (4 spaces), so at `GLYPH_PX` one space is a quarter of it, and a
 * stem-up note occupies 0.875em above the baseline and 0.125em below — which is the whole em, and
 * why the arithmetic below is simply "centre one em and sit the baseline where its top ends".
 */
function glyphSvg(glyph: string): HTMLElement {
  const inkAbove = GLYPH_PX * 0.875
  const baseline = (ROW_HEIGHT - GLYPH_PX) / 2 + inkAbove
  const el = document.createElement('span')
  el.style.display = 'flex'
  el.innerHTML = `<svg width="${GLYPH_BOX_WIDTH}" height="${ROW_HEIGHT}" viewBox="0 0 ${GLYPH_BOX_WIDTH} ${ROW_HEIGHT}">
    <text x="${GLYPH_BOX_WIDTH / 2}" y="${baseline}" text-anchor="middle"
          font-family="Bravura, Academico, 'Noto Music', serif" font-size="${GLYPH_PX}"
          fill="${CHROME.ink}">${glyph}</text>
  </svg>`
  return el
}
